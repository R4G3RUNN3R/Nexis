// ─────────────────────────────────────────────────────────────────────────────
// Nexis — ArenaContext
// Tracks training sessions per tier and writes battle stat gains to PlayerContext.
// ─────────────────────────────────────────────────────────────────────────────

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type PropsWithChildren,
} from "react";
import { arenaTiers, getActiveTierIndex, type BattleStat } from "../data/arenaData";
import { usePlayer } from "./PlayerContext";
import { useAuth } from "./AuthContext";

// ─── Types ────────────────────────────────────────────────────────────────────

export type TrainResult = {
  stat: BattleStat;
  gained: number;
  isSpecialty: boolean;
  tierId: string;
  tierName: string;
  newSessionCount: number;
  tierComplete: boolean;
  nextTierUnlocked: boolean;
  nextTierName: string | null;
};

type ArenaStorageState = {
  sessions: Record<string, number>;  // tierId → total sessions completed
};

type ArenaContextValue = {
  sessions: Record<string, number>;
  train: (tierId: string, stat: BattleStat) => TrainResult | null;
  getTierProgress: (tierId: string) => { sessions: number; pct: number; maxed: boolean };
  isTierUnlocked: (tierId: string) => boolean;
};

// ─── Storage ──────────────────────────────────────────────────────────────────

const STORAGE_KEY = "nexis_arena";

function readStorage(): ArenaStorageState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : { sessions: {} };
  } catch { return { sessions: {} }; }
}

function writeStorage(state: ArenaStorageState): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

// ─── Context ──────────────────────────────────────────────────────────────────

const ArenaContext = createContext<ArenaContextValue | null>(null);

export function ArenaProvider({ children }: PropsWithChildren) {
  const [state, setState] = useState<ArenaStorageState>(readStorage);
  const { player, spendEnergy, addBattleStat, isHospitalized, isJailed } = usePlayer();
  const { serverHydrationVersion } = useAuth();

  useEffect(() => {
    writeStorage(state);
  }, [state]);

  useEffect(() => {
    setState(readStorage());
  }, [serverHydrationVersion]);

  // ── isTierUnlocked ────────────────────────────────────────────────────────
  const isTierUnlocked = useCallback((tierId: string): boolean => {
    const tier = arenaTiers.find((t) => t.id === tierId);
    if (!tier) return false;
    if (!tier.unlockRequirement) return true;
    const reqTier = arenaTiers.find((t) => t.id === tier.unlockRequirement);
    if (!reqTier) return false;
    return (state.sessions[tier.unlockRequirement] ?? 0) >= reqTier.totalToMax;
  }, [state.sessions]);

  // ── getTierProgress ───────────────────────────────────────────────────────
  const getTierProgress = useCallback((tierId: string) => {
    const tier = arenaTiers.find((t) => t.id === tierId);
    if (!tier) return { sessions: 0, pct: 0, maxed: false };
    const done = state.sessions[tierId] ?? 0;
    const pct = Math.min(100, Math.round((done / tier.totalToMax) * 100));
    return { sessions: done, pct, maxed: done >= tier.totalToMax };
  }, [state.sessions]);

  // ── train ─────────────────────────────────────────────────────────────────
  const train = useCallback((tierId: string, stat: BattleStat): TrainResult | null => {
    if (isHospitalized || isJailed) return null;

    const tier = arenaTiers.find((t) => t.id === tierId);
    if (!tier) return null;

    // Check unlock
    if (!isTierUnlocked(tierId)) return null;

    // Check tier not already maxed
    const currentSessions = state.sessions[tierId] ?? 0;
    if (currentSessions >= tier.totalToMax) return null;

    // Check energy
    if (player.stats.energy < tier.energyCost) return null;

    // Spend energy
    spendEnergy(tier.energyCost);

    // Calculate gain
    const isSpecialty = tier.specialtyStats.includes(stat);
    const gained = parseFloat(
      (tier.baseGainPerSession * (isSpecialty ? tier.bonusMultiplier : 1)).toFixed(2)
    );

    // Award battle stat gain
    addBattleStat(stat, gained);

    // Update sessions
    const newSessions = currentSessions + 1;
    setState((prev) => ({
      sessions: { ...prev.sessions, [tierId]: newSessions },
    }));

    // Determine next tier unlock
    const tierIndex = arenaTiers.findIndex((t) => t.id === tierId);
    const tierComplete = newSessions >= tier.totalToMax;
    const nextTier = tierComplete && tierIndex < arenaTiers.length - 1
      ? arenaTiers[tierIndex + 1]
      : null;

    return {
      stat,
      gained,
      isSpecialty,
      tierId,
      tierName: tier.name,
      newSessionCount: newSessions,
      tierComplete,
      nextTierUnlocked: nextTier !== null,
      nextTierName: nextTier?.name ?? null,
    };
  }, [state, player, isHospitalized, isJailed, isTierUnlocked, spendEnergy]);

  const value = useMemo<ArenaContextValue>(() => ({
    sessions: state.sessions,
    train,
    getTierProgress,
    isTierUnlocked,
  }), [state.sessions, train, getTierProgress, isTierUnlocked]);

  return <ArenaContext.Provider value={value}>{children}</ArenaContext.Provider>;
}

export function useArena(): ArenaContextValue {
  const ctx = useContext(ArenaContext);
  if (!ctx) throw new Error("useArena must be used within an ArenaProvider");
  return ctx;
}
