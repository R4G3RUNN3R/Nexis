// ─────────────────────────────────────────────────────────────────────────────
// Nexis — Jobs Context
// XP model: ONE bar per category.
// Every sub-job in a category feeds the category's shared XP/level.
// Sub-job tracking is limited to: totalAttempts, totalSuccesses, chain.
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
import { getCategory, getSubJob, type ItemDrop } from "../data/jobsData";
import { usePlayer } from "./PlayerContext";
import { useAuth } from "./AuthContext";

// ─── Types ────────────────────────────────────────────────────────────────────

/**
 * Per-CATEGORY progress — one XP bar, one level (1–100).
 * This is what shows in the category header.
 */
export type CategoryProgress = {
  level: number;
  xpCurrent: number;
  xpToNextLevel: number;
  totalAttempts: number;
  totalSuccesses: number;
};

/**
 * Per-SUB-JOB tracking — no XP here, just chain streak and attempt counts.
 */
export type SubJobStats = {
  totalAttempts: number;
  totalSuccesses: number;
  chain: number;  // consecutive successes; resets on fail/critFail
};

/** Returned by attemptJob for the UI to render */
export type JobOutcomeResult = {
  outcome: "success" | "fail" | "criticalFail";
  goldEarned: number;
  xpEarned: number;           // XP added to the CATEGORY bar
  itemsDropped: { itemId: string; itemName: string; qty: number }[];
  consequence: "none" | "hospital" | "jail";
  consequenceMinutes: number;
  flavorText: string;
  categoryNewLevel: number;
  categoryLeveledUp: boolean;
  chainCount: number;
};

type JobsStorageState = {
  categoryProgress: Record<string, CategoryProgress>;  // key: categoryId
  subJobStats: Record<string, SubJobStats>;            // key: categoryId::subJobId
};

type JobsContextValue = {
  attemptJob: (categoryId: string, subJobId: string) => JobOutcomeResult | null;
  getCategoryProgress: (categoryId: string) => CategoryProgress;
  getSubJobStats: (categoryId: string, subJobId: string) => SubJobStats;
  // Cooldowns are gone — kept as stub returning 0 so old call-sites don't break
  getCooldownRemaining: (_categoryId: string, _subJobId: string) => number;
  isOnCooldown: (_categoryId: string, _subJobId: string) => boolean;
  now: number;
};

// ─── Constants ────────────────────────────────────────────────────────────────

const STORAGE_KEY = "nexis_jobs";
const MAX_CHAIN_MULTIPLIER = 1.5;
const CHAIN_MULTIPLIER_PER_LINK = 0.02;
const MIN_FAIL_CHANCE = 0.05;
const MIN_CRIT_CHANCE = 0.01;
const TRAINING_WHEELS_LEVEL = 10;
const TRAINING_WHEELS_CRIT_FACTOR = 0.2;
const FAIL_DECAY_DIVISOR = 120;
const CRIT_DECAY_DIVISOR = 150;

// ─── Helpers ─────────────────────────────────────────────────────────────────

function subJobKey(categoryId: string, subJobId: string): string {
  return `${categoryId}::${subJobId}`;
}

function defaultCategoryProgress(): CategoryProgress {
  return {
    level: 1,
    xpCurrent: 0,
    xpToNextLevel: 50,  // level 1→2 = 50 XP, level N→N+1 = N*50 XP
    totalAttempts: 0,
    totalSuccesses: 0,
  };
}

function defaultSubJobStats(): SubJobStats {
  return { totalAttempts: 0, totalSuccesses: 0, chain: 0 };
}

function readStorage(): JobsStorageState {
  if (typeof window === "undefined") return { categoryProgress: {}, subJobStats: {} };
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return { categoryProgress: {}, subJobStats: {} };
    const parsed = JSON.parse(raw) as Partial<JobsStorageState>;
    return {
      categoryProgress: parsed.categoryProgress ?? {},
      subJobStats: parsed.subJobStats ?? {},
    };
  } catch {
    return { categoryProgress: {}, subJobStats: {} };
  }
}

function writeStorage(state: JobsStorageState): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function computeChances(
  baseFailChance: number,
  baseCritFailChance: number,
  level: number,
): { failChance: number; critChance: number; successChance: number } {
  const failChance = Math.max(
    MIN_FAIL_CHANCE,
    baseFailChance * (1 - level / FAIL_DECAY_DIVISOR),
  );
  const rawCrit = baseCritFailChance * (1 - level / CRIT_DECAY_DIVISOR);
  const critChance =
    level < TRAINING_WHEELS_LEVEL
      ? baseCritFailChance * TRAINING_WHEELS_CRIT_FACTOR
      : Math.max(MIN_CRIT_CHANCE, rawCrit);
  const successChance = Math.max(0, 1 - failChance - critChance);
  return { failChance, critChance, successChance };
}

/**
 * Apply XP to category progress, leveling up if threshold crossed.
 * xpToNextLevel = level * 50  (50 at level 1, 100 at level 2, etc.)
 */
function applyXpToCategory(
  prog: CategoryProgress,
  xpGained: number,
): { updated: CategoryProgress; leveledUp: boolean } {
  let { level, xpCurrent, xpToNextLevel } = prog;
  let leveledUp = false;

  xpCurrent += xpGained;

  while (xpCurrent >= xpToNextLevel && level < 100) {
    xpCurrent -= xpToNextLevel;
    level++;
    xpToNextLevel = level * 50;
    leveledUp = true;
  }

  if (level >= 100) {
    level = 100;
    xpCurrent = xpToNextLevel; // full bar at max
  }

  return { updated: { ...prog, level, xpCurrent, xpToNextLevel }, leveledUp };
}

function rollDrops(
  itemDrops: ItemDrop[],
): { itemId: string; itemName: string; qty: number }[] {
  const drops: { itemId: string; itemName: string; qty: number }[] = [];
  for (const drop of itemDrops) {
    if (Math.random() <= drop.dropChance) {
      const qty =
        drop.minQty === drop.maxQty
          ? drop.minQty
          : drop.minQty + Math.floor(Math.random() * (drop.maxQty - drop.minQty + 1));
      drops.push({ itemId: drop.itemId, itemName: drop.itemName, qty });
    }
  }
  return drops;
}

// ─── Context ─────────────────────────────────────────────────────────────────

const JobsContext = createContext<JobsContextValue | null>(null);

export function JobsProvider({ children }: PropsWithChildren) {
  const [storage, setStorage] = useState<JobsStorageState>(readStorage);
  const [now, setNow] = useState(() => Date.now());
  const { serverHydrationVersion } = useAuth();

  // 1-second tick for UI freshness
  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, []);

  useEffect(() => {
    writeStorage(storage);
  }, [storage]);

  useEffect(() => {
    setStorage(readStorage());
  }, [serverHydrationVersion]);

  const { player, isHospitalized, isJailed, hospitalizeFor, jailFor, spendStamina, addItem, addGold, addExperience } =
    usePlayer();

  // ── Getters ───────────────────────────────────────────────────────────────

  const getCategoryProgress = useCallback(
    (categoryId: string): CategoryProgress =>
      storage.categoryProgress[categoryId] ?? defaultCategoryProgress(),
    [storage.categoryProgress],
  );

  const getSubJobStats = useCallback(
    (categoryId: string, subJobId: string): SubJobStats =>
      storage.subJobStats[subJobKey(categoryId, subJobId)] ?? defaultSubJobStats(),
    [storage.subJobStats],
  );

  // Cooldowns removed — always return 0 so call-sites don't break
  const getCooldownRemaining = useCallback(() => 0, []);
  const isOnCooldown = useCallback(() => false, []);

  // ── attemptJob ─────────────────────────────────────────────────────────────

  const attemptJob = useCallback(
    (categoryId: string, subJobId: string): JobOutcomeResult | null => {
      const category = getCategory(categoryId);
      const subJob = getSubJob(categoryId, subJobId);
      if (!category || !subJob) return null;

      // Gates
      if (player.stats.stamina < subJob.staminaCost) return null;
      if (isHospitalized || isJailed) return null;

      // Spend stamina
      spendStamina(subJob.staminaCost);

      // Use CATEGORY level for success rate calculation
      const catProg = getCategoryProgress(categoryId);
      const sjStats = getSubJobStats(categoryId, subJobId);

      const { failChance, critChance, successChance } = computeChances(
        subJob.baseFailChance,
        subJob.baseCritFailChance,
        catProg.level,   // ← category level drives difficulty, not per-sub-job
      );

      const roll = Math.random();
      let outcome: "success" | "fail" | "criticalFail";
      if (roll < successChance)                    outcome = "success";
      else if (roll < successChance + failChance)  outcome = "fail";
      else                                          outcome = "criticalFail";

      // ── Build results ────────────────────────────────────────────────────

      let goldEarned = 0;
      let xpEarned = 0;
      let itemsDropped: { itemId: string; itemName: string; qty: number }[] = [];
      let consequence: "none" | "hospital" | "jail" = "none";
      let consequenceMinutes = 0;
      let flavorText = "";
      let newChain = sjStats.chain;
      let categoryLeveledUp = false;
      let categoryNewLevel = catProg.level;

      if (outcome === "success") {
        const chainMultiplier = Math.min(
          MAX_CHAIN_MULTIPLIER,
          1 + sjStats.chain * CHAIN_MULTIPLIER_PER_LINK,
        );
        const baseGold =
          subJob.baseGoldMin +
          Math.floor(Math.random() * (subJob.baseGoldMax - subJob.baseGoldMin + 1));
        goldEarned = Math.floor(baseGold * chainMultiplier);
        xpEarned = subJob.xpPerSuccess;
        itemsDropped = rollDrops(subJob.itemDrops);
        newChain = sjStats.chain + 1;
        flavorText = "Success!";

        // ── Award gold + items to player ──────────────────────────────────
        addGold(goldEarned);
        addExperience(xpEarned);
        for (const drop of itemsDropped) {
          addItem(drop.itemId, drop.qty);
        }

        const { updated, leveledUp } = applyXpToCategory(catProg, xpEarned);
        categoryLeveledUp = leveledUp;
        categoryNewLevel = updated.level;

        setStorage((prev) => ({
          categoryProgress: {
            ...prev.categoryProgress,
            [categoryId]: {
              ...updated,
              totalAttempts: updated.totalAttempts + 1,
              totalSuccesses: updated.totalSuccesses + 1,
            },
          },
          subJobStats: {
            ...prev.subJobStats,
            [subJobKey(categoryId, subJobId)]: {
              totalAttempts: sjStats.totalAttempts + 1,
              totalSuccesses: sjStats.totalSuccesses + 1,
              chain: newChain,
            },
          },
        }));

      } else if (outcome === "fail") {
        xpEarned = Math.floor(subJob.xpPerSuccess * 0.1);  // 10% XP on fail
        newChain = 0;
        flavorText = "You failed to complete the task. Better luck next time.";
        addExperience(xpEarned);

        const { updated } = applyXpToCategory(catProg, xpEarned);
        categoryNewLevel = updated.level;

        setStorage((prev) => ({
          categoryProgress: {
            ...prev.categoryProgress,
            [categoryId]: {
              ...updated,
              totalAttempts: updated.totalAttempts + 1,
            },
          },
          subJobStats: {
            ...prev.subJobStats,
            [subJobKey(categoryId, subJobId)]: {
              ...sjStats,
              totalAttempts: sjStats.totalAttempts + 1,
              chain: 0,
            },
          },
        }));

      } else {
        // criticalFail — no XP
        flavorText = subJob.critFlavorText;
        newChain = 0;

        if (subJob.critConsequence === "hospital" && subJob.critHospitalMinutes) {
          consequence = "hospital";
          consequenceMinutes = subJob.critHospitalMinutes;
          hospitalizeFor(subJob.critHospitalMinutes, subJob.critFlavorText);
        } else if (subJob.critConsequence === "jail" && subJob.critJailMinutes) {
          consequence = "jail";
          consequenceMinutes = subJob.critJailMinutes;
          jailFor(subJob.critJailMinutes, subJob.critFlavorText);
        }

        setStorage((prev) => ({
          categoryProgress: {
            ...prev.categoryProgress,
            [categoryId]: {
              ...catProg,
              totalAttempts: catProg.totalAttempts + 1,
            },
          },
          subJobStats: {
            ...prev.subJobStats,
            [subJobKey(categoryId, subJobId)]: {
              ...sjStats,
              totalAttempts: sjStats.totalAttempts + 1,
              chain: 0,
            },
          },
        }));
      }

      return {
        outcome,
        goldEarned,
        xpEarned,
        itemsDropped,
        consequence,
        consequenceMinutes,
        flavorText,
        categoryNewLevel,
        categoryLeveledUp,
        chainCount: newChain,
      };
    },
    [
      player,
      isHospitalized,
      isJailed,
      getCategoryProgress,
      getSubJobStats,
      hospitalizeFor,
      jailFor,
      spendStamina,
      addItem,
      addGold,
      addExperience,
    ],
  );

  const value = useMemo<JobsContextValue>(
    () => ({
      attemptJob,
      getCategoryProgress,
      getSubJobStats,
      getCooldownRemaining,
      isOnCooldown,
      now,
    }),
    [attemptJob, getCategoryProgress, getSubJobStats, getCooldownRemaining, isOnCooldown, now],
  );

  return <JobsContext.Provider value={value}>{children}</JobsContext.Provider>;
}

export function useJobs(): JobsContextValue {
  const ctx = useContext(JobsContext);
  if (!ctx) throw new Error("useJobs must be used within a JobsProvider");
  return ctx;
}

// ─── Utilities ────────────────────────────────────────────────────────────────

export function formatCooldown(_ms: number): string {
  return "Ready";
}

export function computeSuccessRate(
  baseFailChance: number,
  baseCritFailChance: number,
  level: number,
): number {
  const { successChance } = computeChances(baseFailChance, baseCritFailChance, level);
  return Math.round(successChance * 100);
}
