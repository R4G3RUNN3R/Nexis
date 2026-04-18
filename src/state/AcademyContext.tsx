// ─────────────────────────────────────────────────────────────────────────────
// AcademyContext.tsx
// Nexis Browser RPG — React context for academy, profession, and spirit state
// ─────────────────────────────────────────────────────────────────────────────

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useReducer,
} from "react";
import type { WesternPath } from "./academyData";
import type { SpiritElement, SpiritTier } from "./spiritData";
import { spiritsByElement, spiritTierCaps } from "./spiritData";

// ─────────────────────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────────────────────

/** 30 real-day cooldown between academy switches (ms) */
const ACADEMY_SWITCH_COOLDOWN_MS = 30 * 24 * 60 * 60 * 1000;

/** Gold cost to switch active standard academy */
const ACADEMY_SWITCH_GOLD_COST = 50_000;

/** 12-hour spirit switch cooldown (ms) */
const SPIRIT_SWITCH_COOLDOWN_MS = 12 * 60 * 60 * 1000;

const STORAGE_KEY = "nexis_academy_state";

// ─────────────────────────────────────────────────────────────────────────────
// State shape
// ─────────────────────────────────────────────────────────────────────────────

type AcademyProgressEntry = {
  completedRanks: number;
  inProgress: boolean;
  trainingStarted: number | null;    // timestamp when academy was first activated
  currentRankStarted: number | null; // timestamp current rank training began
  westernPath?: WesternPath;
};

type SpiritEntry = {
  bondPercent: number; // 0–10, persists when switching
  tier: SpiritTier;
  unlockedAt: number | null; // timestamp
};

type ProfessionProgressEntry = {
  currentRank: number; // 0 = not started
  inProgress: boolean;
  craftingStarted: number | null;
};

export type AcademyState = {
  // Standard academies
  activeAcademyId: string | null;
  academyProgress: Record<string, AcademyProgressEntry>;
  lastSwitchTimestamp: number | null; // 30-day cooldown gate

  // Professions (always active)
  professionProgress: Record<string, ProfessionProgressEntry>;

  // Spirit binding (unlocked via Southern Rank 4)
  spirits: Record<SpiritElement, SpiritEntry>;
  activeSpirit: SpiritElement | null;
  lastSpiritSwitch: number | null; // 12hr cooldown
};

// ─────────────────────────────────────────────────────────────────────────────
// Default state
// ─────────────────────────────────────────────────────────────────────────────

const defaultSpiritEntry = (tier: SpiritTier = "low"): SpiritEntry => ({
  bondPercent: 0,
  tier,
  unlockedAt: null,
});

const defaultState: AcademyState = {
  activeAcademyId: null,
  academyProgress: {},
  lastSwitchTimestamp: null,
  professionProgress: {},
  spirits: {
    fire: defaultSpiritEntry(),
    wind: defaultSpiritEntry(),
    water: defaultSpiritEntry(),
    earth: defaultSpiritEntry(),
  },
  activeSpirit: null,
  lastSpiritSwitch: null,
};

// ─────────────────────────────────────────────────────────────────────────────
// Action types
// ─────────────────────────────────────────────────────────────────────────────

type Action =
  | {
      type: "SET_ACTIVE_ACADEMY";
      payload: { id: string; timestamp: number };
    }
  | {
      type: "START_TRAINING";
      payload: { academyId: string; timestamp: number };
    }
  | {
      type: "COMPLETE_RANK";
      payload: { academyId: string };
    }
  | {
      type: "CHOOSE_WESTERN_PATH";
      payload: { path: WesternPath };
    }
  | {
      type: "BIND_SPIRIT";
      payload: { element: SpiritElement; timestamp: number };
    }
  | {
      type: "UPDATE_SPIRIT_BOND";
      payload: { element: SpiritElement; deltaPercent: number };
    }
  | {
      type: "UPGRADE_SPIRIT_TIER";
      payload: { element: SpiritElement; tier: SpiritTier };
    }
  | {
      type: "START_PROFESSION_RANK";
      payload: { professionId: string; timestamp: number };
    }
  | {
      type: "COMPLETE_PROFESSION_RANK";
      payload: { professionId: string };
    }
  | {
      type: "HYDRATE";
      payload: AcademyState;
    };

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

function ensureAcademyEntry(
  progress: Record<string, AcademyProgressEntry>,
  id: string
): AcademyProgressEntry {
  return (
    progress[id] ?? {
      completedRanks: 0,
      inProgress: false,
      trainingStarted: null,
      currentRankStarted: null,
    }
  );
}

function ensureProfessionEntry(
  progress: Record<string, ProfessionProgressEntry>,
  id: string
): ProfessionProgressEntry {
  return (
    progress[id] ?? {
      currentRank: 0,
      inProgress: false,
      craftingStarted: null,
    }
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Reducer
// ─────────────────────────────────────────────────────────────────────────────

function reducer(state: AcademyState, action: Action): AcademyState {
  switch (action.type) {
    // ── Academy switching ──────────────────────────────────────────────────
    case "SET_ACTIVE_ACADEMY": {
      const { id, timestamp } = action.payload;
      const existing = ensureAcademyEntry(state.academyProgress, id);
      return {
        ...state,
        activeAcademyId: id,
        lastSwitchTimestamp: timestamp,
        academyProgress: {
          ...state.academyProgress,
          [id]: {
            ...existing,
            trainingStarted: existing.trainingStarted ?? timestamp,
          },
        },
      };
    }

    // ── Training ───────────────────────────────────────────────────────────
    case "START_TRAINING": {
      const { academyId, timestamp } = action.payload;
      const existing = ensureAcademyEntry(state.academyProgress, academyId);
      return {
        ...state,
        academyProgress: {
          ...state.academyProgress,
          [academyId]: {
            ...existing,
            inProgress: true,
            currentRankStarted: timestamp,
          },
        },
      };
    }

    case "COMPLETE_RANK": {
      const { academyId } = action.payload;
      const existing = ensureAcademyEntry(state.academyProgress, academyId);
      return {
        ...state,
        academyProgress: {
          ...state.academyProgress,
          [academyId]: {
            ...existing,
            completedRanks: existing.completedRanks + 1,
            inProgress: false,
            currentRankStarted: null,
          },
        },
      };
    }

    // ── Western path selection ─────────────────────────────────────────────
    case "CHOOSE_WESTERN_PATH": {
      const existing = ensureAcademyEntry(state.academyProgress, "western");
      // Only allow if path not yet chosen
      if (existing.westernPath) return state;
      return {
        ...state,
        academyProgress: {
          ...state.academyProgress,
          western: {
            ...existing,
            westernPath: action.payload.path,
          },
        },
      };
    }

    // ── Spirit binding ─────────────────────────────────────────────────────
    case "BIND_SPIRIT": {
      const { element, timestamp } = action.payload;
      const currentSpirit = state.spirits[element];
      return {
        ...state,
        activeSpirit: element,
        lastSpiritSwitch: timestamp,
        spirits: {
          ...state.spirits,
          [element]: {
            ...currentSpirit,
            unlockedAt: currentSpirit.unlockedAt ?? timestamp,
          },
        },
      };
    }

    case "UPDATE_SPIRIT_BOND": {
      const { element, deltaPercent } = action.payload;
      const current = state.spirits[element];
      const cap = spiritTierCaps[current.tier];
      const newBond = Math.min(cap, Math.max(0, current.bondPercent + deltaPercent));
      return {
        ...state,
        spirits: {
          ...state.spirits,
          [element]: {
            ...current,
            bondPercent: newBond,
          },
        },
      };
    }

    case "UPGRADE_SPIRIT_TIER": {
      const { element, tier } = action.payload;
      const current = state.spirits[element];
      return {
        ...state,
        spirits: {
          ...state.spirits,
          [element]: {
            ...current,
            tier,
            // bond persists; if the new cap is lower (shouldn't happen), clamp it
            bondPercent: Math.min(current.bondPercent, spiritTierCaps[tier]),
          },
        },
      };
    }

    // ── Professions ────────────────────────────────────────────────────────
    case "START_PROFESSION_RANK": {
      const { professionId, timestamp } = action.payload;
      const existing = ensureProfessionEntry(state.professionProgress, professionId);
      return {
        ...state,
        professionProgress: {
          ...state.professionProgress,
          [professionId]: {
            ...existing,
            inProgress: true,
            craftingStarted: timestamp,
          },
        },
      };
    }

    case "COMPLETE_PROFESSION_RANK": {
      const { professionId } = action.payload;
      const existing = ensureProfessionEntry(state.professionProgress, professionId);
      return {
        ...state,
        professionProgress: {
          ...state.professionProgress,
          [professionId]: {
            ...existing,
            currentRank: existing.currentRank + 1,
            inProgress: false,
            craftingStarted: null,
          },
        },
      };
    }

    // ── Hydration ──────────────────────────────────────────────────────────
    case "HYDRATE":
      return action.payload;

    default:
      return state;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Context value type
// ─────────────────────────────────────────────────────────────────────────────

type AcademyContextValue = {
  state: AcademyState;

  /**
   * Switch the player's active standard academy.
   * Checks:
   *   - 30-day cooldown from lastSwitchTimestamp
   *   - Player gold must be >= 50,000 (caller is responsible for deducting gold
   *     after a `true` return — pass current gold so the context can validate)
   *   - Player must currently be in the academy's city (pass currentCityId)
   * Returns true if the switch was accepted; false otherwise with a reason string.
   */
  setActiveAcademy: (
    id: string,
    currentCityId: string,
    academyCityId: string,
    playerGold: number
  ) => { ok: boolean; reason?: string };

  /** Begin training the next rank for an academy. */
  startTraining: (academyId: string) => void;

  /**
   * Mark the current rank of an academy as complete.
   * Passive bonuses from completed ranks are permanent regardless of active academy.
   */
  completeRank: (academyId: string) => void;

  /**
   * Lock in the Western path. One-time choice; permanent (can only be changed
   * via real-money microtransaction once per 30 days — handled outside this context).
   */
  chooseWesternPath: (path: WesternPath) => void;

  /**
   * Switch the active spirit.
   * Checks 12-hour cooldown.
   * Returns { ok: true } or { ok: false, reason: string }.
   */
  bindSpirit: (
    element: SpiritElement
  ) => { ok: boolean; reason?: string };

  /**
   * Increment (or decrement) a spirit's bond percentage.
   * Bond is capped at the spirit's tier cap and floored at 0.
   * Bond persists independently per spirit when the player switches.
   */
  updateSpiritBond: (element: SpiritElement, deltaPercent: number) => void;

  /**
   * Upgrade a spirit to a higher tier (managed externally, e.g. from a quest reward).
   */
  upgradeSpiritTier: (element: SpiritElement, tier: SpiritTier) => void;

  /** Begin crafting the next rank for a profession (item requirements validated externally). */
  startProfessionRank: (professionId: string) => void;

  /** Mark the current profession rank as complete. */
  completeProfessionRank: (professionId: string) => void;

  /**
   * Returns the current effective spirit bond value for the given element,
   * capped at the spirit's tier cap.
   */
  getSpiritBonusValue: (element: SpiritElement) => number;

  /**
   * True if the player has completed Northern Rank 1 (mana bar unlocked permanently).
   * Used to gate Southern Ranks 7 & 8 tooltip/usability.
   */
  hasManaBar: boolean;
};

// ─────────────────────────────────────────────────────────────────────────────
// Context
// ─────────────────────────────────────────────────────────────────────────────

const AcademyContext = createContext<AcademyContextValue | null>(null);

// ─────────────────────────────────────────────────────────────────────────────
// Provider
// ─────────────────────────────────────────────────────────────────────────────

export function AcademyProvider({ children }: { children: React.ReactNode }) {
  const [state, dispatch] = useReducer(reducer, defaultState);

  // ── Hydrate from localStorage on mount ──────────────────────────────────
  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as AcademyState;
        dispatch({ type: "HYDRATE", payload: parsed });
      }
    } catch {
      // Corrupted storage — start fresh
      localStorage.removeItem(STORAGE_KEY);
    }
  }, []);

  // ── Persist to localStorage on every state change ──────────────────────
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch {
      // Storage quota exceeded or private browsing — silently ignore
    }
  }, [state]);

  // ── Action implementations ───────────────────────────────────────────────

  const setActiveAcademy = useCallback(
    (
      id: string,
      currentCityId: string,
      academyCityId: string,
      playerGold: number
    ): { ok: boolean; reason?: string } => {
      // Same academy — no-op
      if (state.activeAcademyId === id) {
        return { ok: false, reason: "This academy is already active." };
      }

      // Travel check — player must be in the academy's city
      if (currentCityId !== academyCityId) {
        return {
          ok: false,
          reason: `You must travel to ${academyCityId} before joining this academy.`,
        };
      }

      // Gold check
      if (playerGold < ACADEMY_SWITCH_GOLD_COST) {
        return {
          ok: false,
          reason: `You need ${ACADEMY_SWITCH_GOLD_COST.toLocaleString()} gold to switch academies.`,
        };
      }

      // 30-day cooldown check
      if (state.lastSwitchTimestamp !== null) {
        const elapsed = Date.now() - state.lastSwitchTimestamp;
        if (elapsed < ACADEMY_SWITCH_COOLDOWN_MS) {
          const remaining = ACADEMY_SWITCH_COOLDOWN_MS - elapsed;
          const days = Math.ceil(remaining / (24 * 60 * 60 * 1000));
          return {
            ok: false,
            reason: `Academy switch is on cooldown. ${days} day(s) remaining.`,
          };
        }
      }

      dispatch({
        type: "SET_ACTIVE_ACADEMY",
        payload: { id, timestamp: Date.now() },
      });
      return { ok: true };
    },
    [state.activeAcademyId, state.lastSwitchTimestamp]
  );

  const startTraining = useCallback(
    (academyId: string) => {
      dispatch({
        type: "START_TRAINING",
        payload: { academyId, timestamp: Date.now() },
      });
    },
    []
  );

  const completeRank = useCallback(
    (academyId: string) => {
      dispatch({ type: "COMPLETE_RANK", payload: { academyId } });
    },
    []
  );

  const chooseWesternPath = useCallback(
    (path: WesternPath) => {
      dispatch({ type: "CHOOSE_WESTERN_PATH", payload: { path } });
    },
    []
  );

  const bindSpirit = useCallback(
    (element: SpiritElement): { ok: boolean; reason?: string } => {
      // Same spirit — no-op
      if (state.activeSpirit === element) {
        return { ok: false, reason: "This spirit is already active." };
      }

      // 12-hour cooldown check
      if (state.lastSpiritSwitch !== null) {
        const elapsed = Date.now() - state.lastSpiritSwitch;
        if (elapsed < SPIRIT_SWITCH_COOLDOWN_MS) {
          const remainingMs = SPIRIT_SWITCH_COOLDOWN_MS - elapsed;
          const remainingHours = Math.ceil(remainingMs / (60 * 60 * 1000));
          return {
            ok: false,
            reason: `Spirit switch is on cooldown. ${remainingHours} hour(s) remaining.`,
          };
        }
      }

      dispatch({
        type: "BIND_SPIRIT",
        payload: { element, timestamp: Date.now() },
      });
      return { ok: true };
    },
    [state.activeSpirit, state.lastSpiritSwitch]
  );

  const updateSpiritBond = useCallback(
    (element: SpiritElement, deltaPercent: number) => {
      dispatch({
        type: "UPDATE_SPIRIT_BOND",
        payload: { element, deltaPercent },
      });
    },
    []
  );

  const upgradeSpiritTier = useCallback(
    (element: SpiritElement, tier: SpiritTier) => {
      dispatch({ type: "UPGRADE_SPIRIT_TIER", payload: { element, tier } });
    },
    []
  );

  const startProfessionRank = useCallback(
    (professionId: string) => {
      dispatch({
        type: "START_PROFESSION_RANK",
        payload: { professionId, timestamp: Date.now() },
      });
    },
    []
  );

  const completeProfessionRank = useCallback(
    (professionId: string) => {
      dispatch({ type: "COMPLETE_PROFESSION_RANK", payload: { professionId } });
    },
    []
  );

  // ── Derived helpers ──────────────────────────────────────────────────────

  /**
   * Returns the bond percentage capped at the current spirit's tier cap.
   * If the spirit has never been bound (bondPercent = 0), returns 0.
   */
  const getSpiritBonusValue = useCallback(
    (element: SpiritElement): number => {
      const entry = state.spirits[element];
      const cap = spiritTierCaps[entry.tier];
      return Math.min(entry.bondPercent, cap);
    },
    [state.spirits]
  );

  /**
   * The mana bar is permanently unlocked once Northern Rank 1 is completed.
   * It remains active regardless of which standard academy is currently active.
   */
  const hasManaBar = useMemo((): boolean => {
    const northern = state.academyProgress["northern"];
    return northern !== undefined && northern.completedRanks >= 1;
  }, [state.academyProgress]);

  // ── Context value ────────────────────────────────────────────────────────

  const value = useMemo<AcademyContextValue>(
    () => ({
      state,
      setActiveAcademy,
      startTraining,
      completeRank,
      chooseWesternPath,
      bindSpirit,
      updateSpiritBond,
      upgradeSpiritTier,
      startProfessionRank,
      completeProfessionRank,
      getSpiritBonusValue,
      hasManaBar,
    }),
    [
      state,
      setActiveAcademy,
      startTraining,
      completeRank,
      chooseWesternPath,
      bindSpirit,
      updateSpiritBond,
      upgradeSpiritTier,
      startProfessionRank,
      completeProfessionRank,
      getSpiritBonusValue,
      hasManaBar,
    ]
  );

  return (
    <AcademyContext.Provider value={value}>
      {children}
    </AcademyContext.Provider>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Hook
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Access the academy context. Must be used within an <AcademyProvider>.
 */
export function useAcademy(): AcademyContextValue {
  const ctx = useContext(AcademyContext);
  if (!ctx) {
    throw new Error("useAcademy must be used within an AcademyProvider.");
  }
  return ctx;
}

export default AcademyContext;
