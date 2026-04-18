import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useAuth } from "./AuthContext";

// ─── Resource Configs ────────────────────────────────────────────────────────

export type ResourceConfig = {
  id: string;
  label: string;
  max: number;
  tickAmount: number;
  tickIntervalMs: number;
  color: string;
};

export const RESOURCE_CONFIGS: ResourceConfig[] = [
  {
    id: "energy",
    label: "Energy",
    max: 100,
    tickAmount: 1,
    tickIntervalMs: 5 * 60 * 1000,
    color: "#78a94f",
  },
  {
    id: "health",
    label: "Health",
    max: 100,
    tickAmount: 1,
    tickIntervalMs: 3 * 60 * 1000,
    color: "#e63946",
  },
  {
    id: "stamina",
    label: "Stamina",
    max: 10,
    tickAmount: 1,
    tickIntervalMs: 15 * 60 * 1000,
    color: "#4cc9f0",
  },
  {
    id: "comfort",
    label: "Comfort",
    max: 100,
    tickAmount: 1,
    tickIntervalMs: 10 * 60 * 1000,
    color: "#c9a84c",
  },
];

// ─── State Shape ─────────────────────────────────────────────────────────────

type ResourceEntry = {
  current: number;
  max: number;
  lastTickAt: number;
};

type TimerState = {
  resources: Record<string, ResourceEntry>;
};

// ─── Context Value ────────────────────────────────────────────────────────────

type TimersContextValue = {
  resources: Record<
    string,
    ResourceEntry & {
      config: ResourceConfig;
      timeUntilNextTickMs: number;
      timeUntilNextTickSeconds: number;
    }
  >;
  spendResource: (id: string, amount: number) => boolean;
};

// ─── Storage ──────────────────────────────────────────────────────────────────

const STORAGE_KEY = "nexis_timers";

function buildDefaultState(): TimerState {
  const now = Date.now();
  const resources: Record<string, ResourceEntry> = {};
  for (const cfg of RESOURCE_CONFIGS) {
    resources[cfg.id] = {
      current: cfg.max,
      max: cfg.max,
      lastTickAt: now,
    };
  }
  return { resources };
}

function loadState(): TimerState {
  if (typeof window === "undefined") return buildDefaultState();
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return buildDefaultState();
    const parsed = JSON.parse(raw) as Partial<TimerState>;
    // Merge with defaults to handle missing/new resources
    const defaults = buildDefaultState();
    const resources: Record<string, ResourceEntry> = { ...defaults.resources };
    if (parsed.resources) {
      for (const cfg of RESOURCE_CONFIGS) {
        if (parsed.resources[cfg.id]) {
          resources[cfg.id] = {
            current: Math.min(
              cfg.max,
              Math.max(0, parsed.resources[cfg.id].current ?? 0)
            ),
            max: cfg.max,
            lastTickAt: parsed.resources[cfg.id].lastTickAt ?? Date.now(),
          };
        }
      }
    }
    return { resources };
  } catch {
    return buildDefaultState();
  }
}

function saveState(state: TimerState) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

/**
 * Apply catch-up ticks: if the user was away, grant them ticks they missed.
 * Each resource ticks independently at its own rate.
 */
function applyCatchUpTicks(state: TimerState, now: number): TimerState {
  const resources = { ...state.resources };
  let changed = false;

  for (const cfg of RESOURCE_CONFIGS) {
    const entry = resources[cfg.id];
    if (!entry) continue;
    if (entry.current >= cfg.max) continue;

    const elapsed = now - entry.lastTickAt;
    if (elapsed < cfg.tickIntervalMs) continue;

    const missedTicks = Math.floor(elapsed / cfg.tickIntervalMs);
    if (missedTicks <= 0) continue;

    const gained = missedTicks * cfg.tickAmount;
    const newCurrent = Math.min(cfg.max, entry.current + gained);

    // lastTickAt should be set to the exact time of the last valid tick,
    // not "now", so the countdown resumes from the correct point.
    const lastTickAt = entry.lastTickAt + missedTicks * cfg.tickIntervalMs;

    resources[cfg.id] = { ...entry, current: newCurrent, lastTickAt };
    changed = true;
  }

  return changed ? { resources } : state;
}

// ─── Context ──────────────────────────────────────────────────────────────────

const TimersContext = createContext<TimersContextValue | null>(null);

export function TimerProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<TimerState>(() => {
    const loaded = loadState();
    // Apply catch-up immediately on mount
    return applyCatchUpTicks(loaded, Date.now());
  });
  const { serverHydrationVersion } = useAuth();

  // Keep a ref to latest state for use inside the interval without stale closure
  const stateRef = useRef(state);
  useEffect(() => {
    stateRef.current = state;
  }, [state]);

  // Persist whenever state changes
  useEffect(() => {
    saveState(state);
  }, [state]);

  useEffect(() => {
    setState(applyCatchUpTicks(loadState(), Date.now()));
  }, [serverHydrationVersion]);

  // Single 1-second interval that checks each resource
  useEffect(() => {
    const interval = window.setInterval(() => {
      const now = Date.now();
      setState((prev) => {
        const resources = { ...prev.resources };
        let changed = false;

        for (const cfg of RESOURCE_CONFIGS) {
          const entry = resources[cfg.id];
          if (!entry) continue;
          if (entry.current >= cfg.max) continue;

          const elapsed = now - entry.lastTickAt;
          if (elapsed < cfg.tickIntervalMs) continue;

          // Tick once (single tick per interval check — catch-up handles multiples on load)
          const newCurrent = Math.min(cfg.max, entry.current + cfg.tickAmount);
          resources[cfg.id] = {
            ...entry,
            current: newCurrent,
            lastTickAt: entry.lastTickAt + cfg.tickIntervalMs,
          };
          changed = true;
        }

        return changed ? { resources } : prev;
      });
    }, 1000);

    return () => window.clearInterval(interval);
  }, []);

  const spendResource = useCallback((id: string, amount: number): boolean => {
    let success = false;
    setState((prev) => {
      const entry = prev.resources[id];
      if (!entry) return prev;
      if (entry.current < amount) return prev;
      success = true;
      return {
        resources: {
          ...prev.resources,
          [id]: { ...entry, current: entry.current - amount },
        },
      };
    });
    return success;
  }, []);

  const value = useMemo<TimersContextValue>(() => {
    const now = Date.now();
    const enrichedResources = {} as TimersContextValue["resources"];

    for (const cfg of RESOURCE_CONFIGS) {
      const entry = state.resources[cfg.id];
      if (!entry) continue;

      const isFull = entry.current >= cfg.max;
      const elapsed = now - entry.lastTickAt;
      const timeUntilNextTickMs = isFull
        ? 0
        : Math.max(0, cfg.tickIntervalMs - elapsed);

      enrichedResources[cfg.id] = {
        ...entry,
        config: cfg,
        timeUntilNextTickMs,
        timeUntilNextTickSeconds: Math.ceil(timeUntilNextTickMs / 1000),
      };
    }

    return { resources: enrichedResources, spendResource };
  }, [state, spendResource]);

  return (
    <TimersContext.Provider value={value}>{children}</TimersContext.Provider>
  );
}

export function useTimers(): TimersContextValue {
  const ctx = useContext(TimersContext);
  if (!ctx) {
    throw new Error("useTimers must be used within a TimerProvider");
  }
  return ctx;
}

/** Format seconds as MM:SS */
export function formatMmSs(totalSeconds: number): string {
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}
