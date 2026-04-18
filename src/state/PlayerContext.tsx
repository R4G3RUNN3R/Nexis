// ─────────────────────────────────────────────────────────────────────────────
// Nexis — PlayerContext
// Tracks all player state: stats, condition (hospital/jail), education,
// registration, and the sidebar stat model.
// ─────────────────────────────────────────────────────────────────────────────

import React, { createContext, useContext, useEffect, useLayoutEffect, useMemo, useState, useCallback } from "react";
import { useAuth, playerStorageKey } from "./AuthContext";
import { canAccessPropertyTier, getPropertyById, getPropertyComfortCap } from "../data/propertyData";
import { sanitizeStoredTitle } from "../lib/titleAccess";

type Condition =
  | { type: "normal";       until: null;   reason: null }
  | { type: "hospitalized"; until: number; reason: string }
  | { type: "jailed";       until: number; reason: string };

type CurrentEducation = {
  id: string;
  name: string;
  startedAt: number;
  durationMs: number;
} | null;

type PlayerState = {
  internalId: string;
  publicId: number | null;
  name: string;
  lastName: string;
  title: string;
  experience: number;
  level: number;
  rank: string;
  daysPlayed: number;
  gold: number;
  currencies: {
    copper: number;
    silver: number;
    gold: number;
    platinum: number;
  };
  isRegistered: boolean;
  inventory: Record<string, number>;  // itemId → qty
  itemEnhancements: Record<string, string[]>;
  stats: {
    energy: number;
    maxEnergy: number;
    health: number;
    maxHealth: number;
    stamina: number;
    maxStamina: number;
    comfort: number;
    maxComfort: number;
    nerve: number;         // used for risky actions
    maxNerve: number;
    chain: number;         // ← active chain count (resets on fail)
    maxChain: number;      // ← chain target (e.g. 10)
  };
  workingStats: {
    manualLabor: number;
    intelligence: number;
    endurance: number;
  };
  battleStats: {
    strength: number;
    defense: number;
    speed: number;
    dexterity: number;
  };
  property: {
    current: string;
    comfortProvided: number;
    installedUpgrades: string[];
  };
  current: {
    education: CurrentEducation;
    job: string | null;
    travel: string | null;
  };
  condition: Condition;
};

type PlayerContextValue = {
  player: PlayerState;
  now: number;
  isRegistered: boolean;
  registerPlayer: (firstName: string, lastName: string) => void;
  resetPlayer: () => void;
  isHospitalized: boolean;
  hospitalRemainingMs: number;
  hospitalRemainingLabel: string;
  hospitalizeFor: (minutes: number, reason?: string) => void;
  recoverFromHospital: () => void;
  isJailed: boolean;
  jailRemainingMs: number;
  jailRemainingLabel: string;
  jailFor: (minutes: number, reason?: string) => void;
  releaseFromJail: () => void;
  setHealth: (value: number, reason?: string) => void;
  spendEnergy: (amount: number) => void;
  spendComfort: (amount: number) => void;
  spendStamina: (amount: number) => void;
  spendNerve: (amount: number) => void;
  addGold: (amount: number) => void;
  spendGold: (amount: number) => boolean;
  purchaseProperty: (tierId: string, cost: number) => boolean;
  installUpgrade: (upgradeId: string, cost: number) => boolean;
  addItem: (itemId: string, qty: number) => void;
  addWorkingStat: (stat: "manualLabor" | "intelligence" | "endurance", amount: number) => void;
  addBattleStat: (stat: "strength" | "defense" | "speed" | "dexterity", amount: number) => void;
  addExperience: (amount: number) => void;
  startEducation: (id: string, name: string, durationMs: number) => void;
  quitEducation: () => void;
  addLevel: (amount?: number) => void;
};

export function maxStaminaForLevel(level: number): number {
  return 10 + Math.floor(level / 5);
}

const MAX_PLAYER_LEVEL = 100;

function getExperienceToNextLevel(level: number): number {
  return Math.max(50, level * 50);
}

function normalizeExperience(value: number) {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.floor(value));
}

function getLevelFromExperience(experience: number) {
  let level = 1;
  let remainingXp = normalizeExperience(experience);
  let xpToNextLevel = getExperienceToNextLevel(level);

  while (remainingXp >= xpToNextLevel && level < MAX_PLAYER_LEVEL) {
    remainingXp -= xpToNextLevel;
    level += 1;
    xpToNextLevel = getExperienceToNextLevel(level);
  }

  return level;
}

function getExperienceFloorForLevel(level: number) {
  let total = 0;
  for (let currentLevel = 1; currentLevel < level; currentLevel += 1) {
    total += getExperienceToNextLevel(currentLevel);
  }
  return total;
}

const LEGACY_STORAGE_KEY = "nexis_player";
const BASELINE_WORKING_STATS = {
  manualLabor: 10,
  intelligence: 10,
  endurance: 10,
} as const;
const BASELINE_BATTLE_STATS = {
  strength: 10,
  defense: 10,
  speed: 10,
  dexterity: 10,
} as const;

function normalizeWorkingStats(stats: PlayerState["workingStats"]) {
  const allZero =
    stats.manualLabor <= 0 &&
    stats.intelligence <= 0 &&
    stats.endurance <= 0;

  if (!allZero) return stats;
  return { ...BASELINE_WORKING_STATS };
}

function normalizeCurrencies(currencies: PlayerState["currencies"] | undefined, goldFallback: number) {
  return {
    copper: Math.max(0, Math.floor(Number(currencies?.copper ?? 0))),
    silver: Math.max(0, Math.floor(Number(currencies?.silver ?? 0))),
    gold: Math.max(0, Math.floor(Number(currencies?.gold ?? goldFallback))),
    platinum: Math.max(0, Math.floor(Number(currencies?.platinum ?? 0))),
  };
}

function normalizeItemEnhancements(value: PlayerState["itemEnhancements"] | undefined) {
  const source = value ?? {};
  return Object.fromEntries(
    Object.entries(source)
      .map(([itemId, enhancements]) => [itemId, Array.isArray(enhancements) ? Array.from(new Set(enhancements.filter((entry): entry is string => typeof entry === "string" && entry.trim().length > 0).map((entry) => entry.trim()))) : []])
      .filter((entry) => entry[1].length > 0),
  );
}

function normalizeBattleStats(stats: PlayerState["battleStats"]) {
  const allZero =
    stats.strength <= 0 &&
    stats.defense <= 0 &&
    stats.speed <= 0 &&
    stats.dexterity <= 0;

  if (!allZero) return stats;
  return { ...BASELINE_BATTLE_STATS };
}

function normalizeLevel(level: number, experience: number) {
  const fromExperience = getLevelFromExperience(experience);
  if (fromExperience > 1 || experience > 0) return fromExperience;
  return 1;
}

const basePlayer: PlayerState = {
  internalId: "plr_000000",
  publicId: null,
  name: "",
  lastName: "",
  title: "",
  experience: 0,
  level: 1,
  rank: "0",
  daysPlayed: 0,
  gold: 500,
  currencies: { copper: 0, silver: 0, gold: 500, platinum: 0 },
  isRegistered: false,
  inventory: {},
  itemEnhancements: {},
  stats: {
    energy: 100,
    maxEnergy: 100,
    health: 100,
    maxHealth: 100,
    stamina: 10,
    maxStamina: 10,
    comfort: 100,
    maxComfort: 100,
    nerve: 16,
    maxNerve: 84,
    chain: 0,
    maxChain: 10,
  },
  workingStats: { ...BASELINE_WORKING_STATS },
  battleStats: { ...BASELINE_BATTLE_STATS },
  property: { current: "shack", comfortProvided: 100, installedUpgrades: [] },
  current: { education: null, job: null, travel: null },
  condition: { type: "normal", until: null, reason: null },
};

type StoredPlayerState = Partial<PlayerState> & {
  id?: string;
  internalId?: string | null;
  publicId?: number | null;
};

function mergePlayer(stored: StoredPlayerState, identity?: { internalPlayerId: string; publicId: number }): PlayerState {
  const experience = normalizeExperience(typeof stored.experience === "number" ? stored.experience : basePlayer.experience);
  const level = normalizeLevel(typeof stored.level === "number" ? stored.level : basePlayer.level, experience);
  const mergedStats = { ...basePlayer.stats, ...(stored.stats ?? {}) };
  mergedStats.maxStamina = maxStaminaForLevel(level);
  mergedStats.stamina = Math.min(mergedStats.stamina, mergedStats.maxStamina);
  const mergedProperty = { ...basePlayer.property, ...(stored.property ?? {}) };
  const installedUpgrades = Array.isArray(mergedProperty.installedUpgrades)
    ? mergedProperty.installedUpgrades.filter((upgradeId): upgradeId is string => typeof upgradeId === "string")
    : [];
  const propertyCurrent = typeof mergedProperty.current === "string" && mergedProperty.current
    ? mergedProperty.current
    : basePlayer.property.current;
  const derivedMaxComfort = getPropertyComfortCap(propertyCurrent, installedUpgrades);
  mergedStats.maxComfort = derivedMaxComfort;
  mergedStats.comfort = Math.min(mergedStats.comfort, derivedMaxComfort);
  const internalId =
    identity?.internalPlayerId ??
    (typeof stored.internalId === "string" && stored.internalId ? stored.internalId : null) ??
    (typeof stored.id === "string" && stored.id ? stored.id : null) ??
    basePlayer.internalId;
  const publicId =
    identity?.publicId ??
    (typeof stored.publicId === "number" ? stored.publicId : basePlayer.publicId);
  const title = sanitizeStoredTitle(typeof stored.title === "string" ? stored.title : basePlayer.title, publicId);
  return {
    ...basePlayer,
    ...stored,
    internalId,
    publicId,
    title,
    experience,
    level,
    stats: mergedStats,
    workingStats: normalizeWorkingStats({ ...basePlayer.workingStats, ...(stored.workingStats ?? {}) }),
    battleStats: normalizeBattleStats({ ...basePlayer.battleStats, ...(stored.battleStats ?? {}) }),
    property: {
      ...mergedProperty,
      current: propertyCurrent,
      installedUpgrades,
      comfortProvided: derivedMaxComfort,
    },
    current: { ...basePlayer.current, ...(stored.current ?? {}) },
    inventory: { ...basePlayer.inventory, ...(stored.inventory ?? {}) },
    currencies: normalizeCurrencies((stored as Partial<PlayerState>).currencies, typeof stored.gold === "number" ? stored.gold : basePlayer.gold),
    itemEnhancements: normalizeItemEnhancements((stored as Partial<PlayerState>).itemEnhancements),
  };
}

function readStoredPlayer(
  storageKey: string,
  identity?: { internalPlayerId: string; publicId: number },
): PlayerState {
  if (typeof window === "undefined") return identity ? mergePlayer({}, identity) : basePlayer;
  try {
    const raw = window.localStorage.getItem(storageKey);
    if (!raw) return identity ? mergePlayer({}, identity) : basePlayer;
    return mergePlayer(JSON.parse(raw) as StoredPlayerState, identity);
  } catch {
    return identity ? mergePlayer({}, identity) : basePlayer;
  }
}

function writeStoredPlayer(state: PlayerState, storageKey: string): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(storageKey, JSON.stringify(state));
}

function formatDuration(ms: number): string {
  if (ms <= 0) return "0m 0s";
  const totalSeconds = Math.floor(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}m ${seconds}s`;
}

function formatClock(ms: number): string {
  if (ms <= 0) return "00:00";
  const totalSeconds = Math.floor(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

export { formatClock };

const PlayerContext = createContext<PlayerContextValue | null>(null);
const ENERGY_INTERVAL_MS  = 5  * 60 * 1000;
const HEALTH_INTERVAL_MS  = 3  * 60 * 1000;
const STAMINA_INTERVAL_MS = 15 * 60 * 1000;
const COMFORT_INTERVAL_MS = 10 * 60 * 1000;

export function PlayerProvider({ children }: { children: React.ReactNode }) {
  const { activeAccount, serverHydrationVersion } = useAuth();
  const storageKey = activeAccount ? playerStorageKey(activeAccount.email) : LEGACY_STORAGE_KEY;

  const [player, setPlayer] = useState<PlayerState>(() =>
    readStoredPlayer(
      storageKey,
      activeAccount ? { internalPlayerId: activeAccount.internalPlayerId, publicId: activeAccount.publicId } : undefined,
    ),
  );
  const [now, setNow] = useState<number>(() => Date.now());

  useLayoutEffect(() => {
    const identity = activeAccount ? { internalPlayerId: activeAccount.internalPlayerId, publicId: activeAccount.publicId } : undefined;
    const loaded = readStoredPlayer(storageKey, identity);

    if (activeAccount) {
      const seeded: PlayerState = {
        ...loaded,
        internalId: activeAccount.internalPlayerId,
        publicId: activeAccount.publicId,
        name: loaded.name || activeAccount.firstName,
        lastName: loaded.lastName || activeAccount.lastName,
        isRegistered: true,
      };
      setPlayer(seeded);
      writeStoredPlayer(seeded, storageKey);
      return;
    }

    setPlayer(loaded);
  }, [storageKey, activeAccount]);

  useEffect(() => {
    const identity = activeAccount ? { internalPlayerId: activeAccount.internalPlayerId, publicId: activeAccount.publicId } : undefined;
    setPlayer(readStoredPlayer(storageKey, identity));
  }, [storageKey, activeAccount, serverHydrationVersion]);
  useEffect(() => {
    function refreshFromRuntimeCache() {
      const identity = activeAccount ? { internalPlayerId: activeAccount.internalPlayerId, publicId: activeAccount.publicId } : undefined;
      setPlayer(readStoredPlayer(storageKey, identity));
    }

    window.addEventListener("nexis:player-refresh", refreshFromRuntimeCache);
    return () => window.removeEventListener("nexis:player-refresh", refreshFromRuntimeCache);
  }, [storageKey, activeAccount]);

  useEffect(() => {
    let lastTick = Date.now();
    const timer = window.setInterval(() => {
      const tickNow = Date.now();
      const elapsed = tickNow - lastTick;
      lastTick = tickNow;
      setNow(tickNow);
      setPlayer((prev) => {
        let next = prev;
        const energyRegen  = elapsed / ENERGY_INTERVAL_MS;
        const healthRegen  = elapsed / HEALTH_INTERVAL_MS;
        const staminaRegen = elapsed / STAMINA_INTERVAL_MS;
        const comfortRegen = elapsed / COMFORT_INTERVAL_MS;
        const newEnergy  = Math.min(prev.stats.maxEnergy,  prev.stats.energy  + energyRegen);
        const newHealth  = Math.min(prev.stats.maxHealth,  prev.stats.health  + healthRegen);
        const newStamina = Math.min(prev.stats.maxStamina, prev.stats.stamina + staminaRegen);
        const newComfort = Math.min(prev.stats.maxComfort, prev.stats.comfort + comfortRegen);
        next = {
          ...next,
          stats: {
            ...next.stats,
            energy:  parseFloat(newEnergy.toFixed(4)),
            health:  parseFloat(newHealth.toFixed(4)),
            stamina: parseFloat(newStamina.toFixed(4)),
            comfort: parseFloat(newComfort.toFixed(4)),
          },
        };
        if (prev.condition.type === "hospitalized" && prev.condition.until <= tickNow) {
          next = {
            ...next,
            stats: { ...next.stats, health: next.stats.maxHealth },
            condition: { type: "normal", until: null, reason: null },
          };
        }
        if (prev.condition.type === "jailed" && prev.condition.until <= tickNow) {
          next = {
            ...next,
            condition: { type: "normal", until: null, reason: null },
          };
        }
        return next;
      });
    }, 1000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    const correctMax = maxStaminaForLevel(player.level);
    if (player.stats.maxStamina !== correctMax) {
      setPlayer((prev) => ({
        ...prev,
        stats: {
          ...prev.stats,
          maxStamina: correctMax,
          stamina: Math.min(prev.stats.stamina, correctMax),
        },
      }));
    }
  }, [player.level, player.stats.maxStamina]);

  useEffect(() => {
    const derivedComfortCap = getPropertyComfortCap(player.property.current, player.property.installedUpgrades);
    if (
      player.stats.maxComfort === derivedComfortCap &&
      player.property.comfortProvided === derivedComfortCap
    ) {
      return;
    }

    setPlayer((prev) => {
      const nextComfortCap = getPropertyComfortCap(prev.property.current, prev.property.installedUpgrades);
      if (
        prev.stats.maxComfort === nextComfortCap &&
        prev.property.comfortProvided === nextComfortCap
      ) {
        return prev;
      }

      return {
        ...prev,
        stats: {
          ...prev.stats,
          maxComfort: nextComfortCap,
          comfort: Math.min(prev.stats.comfort, nextComfortCap),
        },
        property: {
          ...prev.property,
          comfortProvided: nextComfortCap,
        },
      };
    });
  }, [player.property.current, player.property.installedUpgrades, player.property.comfortProvided, player.stats.maxComfort]);

  useEffect(() => {
    writeStoredPlayer(player, storageKey);
  }, [player, storageKey]);

  const isHospitalized = player.condition.type === "hospitalized";
  const isJailed = player.condition.type === "jailed";
  const hospitalRemainingMs = isHospitalized ? Math.max(0, (player.condition as { until: number }).until - now) : 0;
  const jailRemainingMs = isJailed ? Math.max(0, (player.condition as { until: number }).until - now) : 0;

  const value = useMemo<PlayerContextValue>(() => {
    function registerPlayer(firstName: string, lastName: string) {
      setPlayer((prev) => ({ ...prev, name: firstName.trim(), lastName: lastName.trim(), isRegistered: true }));
    }

    function hospitalizeFor(minutes: number, reason = "Combat defeat") {
      const until = Date.now() + minutes * 60 * 1000;
      setPlayer((prev) => ({
        ...prev,
        stats: { ...prev.stats, health: 0 },
        condition: { type: "hospitalized", until, reason },
        current: { ...prev.current, job: null, travel: null },
      }));
    }

    function recoverFromHospital() {
      setPlayer((prev) => ({
        ...prev,
        stats: { ...prev.stats, health: prev.stats.maxHealth },
        condition: { type: "normal", until: null, reason: null },
      }));
    }

    function jailFor(minutes: number, reason = "Arrested") {
      const until = Date.now() + minutes * 60 * 1000;
      setPlayer((prev) => ({
        ...prev,
        condition: { type: "jailed", until, reason },
        current: { ...prev.current, job: null, travel: null },
      }));
    }

    function releaseFromJail() {
      setPlayer((prev) => ({ ...prev, condition: { type: "normal", until: null, reason: null } }));
    }

    function setHealth(value: number, reason = "Combat defeat") {
      setPlayer((prev) => {
        const nextHealth = Math.max(0, Math.min(prev.stats.maxHealth, value));
        if (nextHealth <= 0) {
          const until = Date.now() + 15 * 60 * 1000;
          return {
            ...prev,
            stats: { ...prev.stats, health: 0 },
            condition: { type: "hospitalized", until, reason },
            current: { ...prev.current, job: null, travel: null },
          };
        }
        return { ...prev, stats: { ...prev.stats, health: nextHealth } };
      });
    }

    function spendEnergy(amount: number) {
      setPlayer((prev) => ({ ...prev, stats: { ...prev.stats, energy: Math.max(0, prev.stats.energy - amount) } }));
    }

    function spendComfort(amount: number) {
      setPlayer((prev) => ({
        ...prev,
        stats: {
          ...prev.stats,
          comfort: parseFloat(Math.max(0, prev.stats.comfort - amount).toFixed(4)),
        },
      }));
    }

    function spendStamina(amount: number) {
      setPlayer((prev) => ({ ...prev, stats: { ...prev.stats, stamina: Math.max(0, prev.stats.stamina - amount) } }));
    }

    function spendNerve(amount: number) {
      setPlayer((prev) => ({ ...prev, stats: { ...prev.stats, nerve: Math.max(0, prev.stats.nerve - amount) } }));
    }

    function addGold(amount: number) {
      setPlayer((prev) => {
        const nextGold = prev.gold + amount;
        return { ...prev, gold: nextGold, currencies: { ...prev.currencies, gold: nextGold } };
      });
    }

    function spendGold(amount: number): boolean {
      let success = false;
      setPlayer((prev) => {
        if (prev.gold < amount) return prev;
        success = true;
        const nextGold = prev.gold - amount;
        return { ...prev, gold: nextGold, currencies: { ...prev.currencies, gold: nextGold } };
      });
      return success;
    }

    function purchaseProperty(tierId: string, cost: number): boolean {
      let success = false;
      setPlayer((prev) => {
        const tier = getPropertyById(tierId);
        if (!tier) return prev;
        if (!canAccessPropertyTier(tier, { publicId: prev.publicId })) return prev;
        if (prev.gold < cost) return prev;
        const nextComfortCap = getPropertyComfortCap(tierId, []);
        success = true;
        return {
          ...prev,
          gold: prev.gold - cost,
          currencies: { ...prev.currencies, gold: prev.gold - cost },
          stats: {
            ...prev.stats,
            maxComfort: nextComfortCap,
            comfort: Math.min(prev.stats.comfort, nextComfortCap),
          },
          property: {
            current: tierId,
            comfortProvided: nextComfortCap,
            installedUpgrades: [],
          },
        };
      });
      return success;
    }

    function addItem(itemId: string, qty: number) {
      setPlayer((prev) => ({
        ...prev,
        inventory: { ...prev.inventory, [itemId]: (prev.inventory[itemId] ?? 0) + qty },
      }));
    }

    function addWorkingStat(stat: "manualLabor" | "intelligence" | "endurance", amount: number) {
      setPlayer((prev) => ({
        ...prev,
        workingStats: {
          ...prev.workingStats,
          [stat]: parseFloat((prev.workingStats[stat] + amount).toFixed(2)),
        },
      }));
    }

    function addBattleStat(stat: "strength" | "defense" | "speed" | "dexterity", amount: number) {
      setPlayer((prev) => ({
        ...prev,
        battleStats: {
          ...prev.battleStats,
          [stat]: parseFloat((prev.battleStats[stat] + amount).toFixed(2)),
        },
      }));
    }

    function installUpgrade(upgradeId: string, cost: number): boolean {
      let success = false;
      setPlayer((prev) => {
        if (prev.gold < cost) return prev;
        if (prev.property.installedUpgrades.includes(upgradeId)) return prev;
        const nextInstalledUpgrades = [...prev.property.installedUpgrades, upgradeId];
        const nextComfortCap = getPropertyComfortCap(prev.property.current, nextInstalledUpgrades);
        success = true;
        return {
          ...prev,
          gold: prev.gold - cost,
          currencies: { ...prev.currencies, gold: prev.gold - cost },
          stats: {
            ...prev.stats,
            maxComfort: nextComfortCap,
            comfort: Math.min(prev.stats.comfort, nextComfortCap),
          },
          property: {
            ...prev.property,
            installedUpgrades: nextInstalledUpgrades,
            comfortProvided: nextComfortCap,
          },
        };
      });
      return success;
    }

    function addExperience(amount: number) {
      setPlayer((prev) => ({
        ...prev,
        experience: normalizeExperience(prev.experience + amount),
        level: getLevelFromExperience(prev.experience + amount),
        stats: {
          ...prev.stats,
          maxStamina: maxStaminaForLevel(getLevelFromExperience(prev.experience + amount)),
          stamina: Math.min(prev.stats.stamina, maxStaminaForLevel(getLevelFromExperience(prev.experience + amount))),
        },
      }));
    }

    function addLevel(amount = 1) {
      const nextAmount = Math.max(0, Math.floor(amount));
      if (!nextAmount) return;
      setPlayer((prev) => {
        const targetLevel = Math.min(MAX_PLAYER_LEVEL, prev.level + nextAmount);
        const nextExperience = getExperienceFloorForLevel(targetLevel);
        return {
          ...prev,
          experience: nextExperience,
          level: targetLevel,
          stats: {
            ...prev.stats,
            maxStamina: maxStaminaForLevel(targetLevel),
            stamina: Math.min(prev.stats.stamina, maxStaminaForLevel(targetLevel)),
          },
        };
      });
    }

    function startEducation(id: string, name: string, durationMs: number) {
      setPlayer((prev) => ({
        ...prev,
        current: { ...prev.current, education: { id, name, startedAt: Date.now(), durationMs } },
      }));
    }

    function quitEducation() {
      setPlayer((prev) => ({ ...prev, current: { ...prev.current, education: null } }));
    }

    return {
      player,
      now,
      isRegistered: player.isRegistered,
      registerPlayer,
      isHospitalized,
      hospitalRemainingMs,
      hospitalRemainingLabel: formatDuration(hospitalRemainingMs),
      hospitalizeFor,
      recoverFromHospital,
      isJailed,
      jailRemainingMs,
      jailRemainingLabel: formatDuration(jailRemainingMs),
      jailFor,
      releaseFromJail,
      setHealth,
      spendEnergy,
      spendComfort,
      spendStamina,
      spendNerve,
      addGold,
      spendGold,
      purchaseProperty,
      installUpgrade,
      addItem,
      addWorkingStat,
      addBattleStat,
      addExperience,
      resetPlayer() {
        setPlayer(basePlayer);
      },
      addLevel,
      startEducation,
      quitEducation,
    };
  }, [player, now, isHospitalized, isJailed, hospitalRemainingMs, jailRemainingMs]);

  return <PlayerContext.Provider value={value}>{children}</PlayerContext.Provider>;
}

export function usePlayer() {
  const context = useContext(PlayerContext);
  if (!context) throw new Error("usePlayer must be used within a PlayerProvider");
  return context;
}
