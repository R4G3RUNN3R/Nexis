import { getArenaStateKey } from "./arenaState";
import { consortiumKey, guildKey } from "./organizations";

const JOBS_STORAGE_KEY = "nexis_jobs";
const EDUCATION_STORAGE_KEY = "nexis.education";
const TIMER_STORAGE_KEY = "nexis_timers";

export type CachedRuntimeState = {
  player: Record<string, unknown>;
  jobs: Record<string, unknown>;
  education: Record<string, unknown>;
  arena: Record<string, unknown>;
  timers: Record<string, unknown>;
  guild: Record<string, unknown>;
  consortium: Record<string, unknown>;
  travel: Record<string, unknown>;
  civicEmployment: Record<string, unknown>;
  legacy: Record<string, unknown>;
};

const MAX_PLAYER_LEVEL = 100;

function getExperienceToNextLevel(level: number) {
  return Math.max(50, level * 50);
}

function normalizeExperience(value: unknown) {
  const numeric = Number(value ?? 0);
  if (!Number.isFinite(numeric)) return 0;
  return Math.max(0, Math.floor(numeric));
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

function normalizeLevel(level: unknown, experience: number) {
  const derived = getLevelFromExperience(experience);
  if (derived > 1 || experience > 0) return derived;
  return 1;
}

function playerStorageKey(email: string) {
  return `nexis_player__${email.trim().toLowerCase()}`;
}

function resolveInternalPlayerId(email: string, playerOverride?: Record<string, unknown> | null) {
  const fromOverride = typeof playerOverride?.internalId === "string" ? playerOverride.internalId : null;
  if (fromOverride) return fromOverride;

  const existingPlayer = readRecord(playerStorageKey(email));
  return typeof existingPlayer.internalId === "string" ? existingPlayer.internalId : null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function readRecord(key: string): Record<string, unknown> {
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as unknown;
    return isRecord(parsed) ? parsed : {};
  } catch {
    return {};
  }
}

function writeRecord(key: string, value: unknown) {
  if (!isRecord(value)) return;
  window.localStorage.setItem(key, JSON.stringify(value));
}

const DEFAULT_WORKING_STATS = {
  manualLabor: 10,
  intelligence: 10,
  endurance: 10,
} as const;

const DEFAULT_BATTLE_STATS = {
  strength: 10,
  defense: 10,
  speed: 10,
  dexterity: 10,
} as const;

function normalizeStatRecord<T extends Record<string, number>>(value: unknown, defaults: T): T {
  const merged = {
    ...defaults,
    ...(isRecord(value) ? value : {}),
  } as T;

  const allMissingOrZero = Object.keys(defaults).every((key) => Number(merged[key as keyof T] ?? 0) <= 0);
  return allMissingOrZero ? { ...defaults } : merged;
}

export function readCachedRuntimeState(email: string): CachedRuntimeState {
  const internalPlayerId = resolveInternalPlayerId(email);
  const player = readRecord(playerStorageKey(email));
  return {
    player,
    jobs: readRecord(JOBS_STORAGE_KEY),
    education: readRecord(EDUCATION_STORAGE_KEY),
    arena: internalPlayerId ? readRecord(getArenaStateKey(internalPlayerId)) : {},
    timers: readRecord(TIMER_STORAGE_KEY),
    guild: internalPlayerId ? readRecord(guildKey(internalPlayerId)) : {},
    consortium: internalPlayerId ? readRecord(consortiumKey(internalPlayerId)) : {},
    travel: isRecord(player.current) && isRecord(player.current.travel) ? player.current.travel : {},
    civicEmployment:
      isRecord(player.current) && isRecord(player.current.civicEmployment)
        ? player.current.civicEmployment
        : readRecord("nexis_civic_employment"),
    legacy: readRecord("nexis_legacy"),
  };
}

export function writeCachedRuntimeState(email: string, state: Partial<CachedRuntimeState>) {
  if (typeof window === "undefined") return;

  if (state.player) writeRecord(playerStorageKey(email), state.player);
  if (state.jobs) writeRecord(JOBS_STORAGE_KEY, state.jobs);
  if (state.education) writeRecord(EDUCATION_STORAGE_KEY, state.education);
  if (state.timers) writeRecord(TIMER_STORAGE_KEY, state.timers);
  if (state.civicEmployment) {
    writeRecord("nexis_civic_employment", state.civicEmployment);
    const existingPlayer = readRecord(playerStorageKey(email));
    writeRecord(playerStorageKey(email), {
      ...existingPlayer,
      current: {
        ...(isRecord(existingPlayer.current) ? existingPlayer.current : {}),
        civicEmployment: state.civicEmployment,
      },
    });
  }
  if (state.legacy) writeRecord("nexis_legacy", state.legacy);

  const internalPlayerId = resolveInternalPlayerId(email, isRecord(state.player) ? state.player : null);
  if (internalPlayerId && state.arena) writeRecord(getArenaStateKey(internalPlayerId), state.arena);
  if (internalPlayerId && state.guild) writeRecord(guildKey(internalPlayerId), state.guild);
  if (internalPlayerId && state.consortium) writeRecord(consortiumKey(internalPlayerId), state.consortium);
  if (state.travel) {
    const existingPlayer = readRecord(playerStorageKey(email));
    writeRecord(playerStorageKey(email), {
      ...existingPlayer,
      current: {
        ...(isRecord(existingPlayer.current) ? existingPlayer.current : {}),
        travel: state.travel,
      },
    });
  }
}

type MergeServerStateArgs = {
  email: string;
  user: {
    internalPlayerId: string;
    publicId: number;
    firstName: string;
    lastName: string;
  };
  playerState: {
    level?: number;
    gold?: number;
    stats?: Record<string, number>;
    workingStats?: Record<string, number>;
    battleStats?: Record<string, number>;
    currentJob?: Record<string, unknown> | string | null;
    runtimeState?: Partial<CachedRuntimeState>;
  } | null;
};

export function mergeServerStateIntoCache({
  email,
  user,
  playerState,
}: MergeServerStateArgs) {
  if (typeof window === "undefined") return;

  const existing = readRecord(playerStorageKey(email));
  const runtimePlayer = isRecord(playerState?.runtimeState?.player)
    ? playerState.runtimeState.player
    : {};
  const runtimeJobs = isRecord(playerState?.runtimeState?.jobs)
    ? playerState.runtimeState.jobs
    : null;
  const runtimeEducation = isRecord(playerState?.runtimeState?.education)
    ? playerState.runtimeState.education
    : null;
  const runtimeArena = isRecord(playerState?.runtimeState?.arena)
    ? playerState.runtimeState.arena
    : null;
  const runtimeTimers = isRecord(playerState?.runtimeState?.timers)
    ? playerState.runtimeState.timers
    : null;
  const runtimeGuild =
    isRecord(playerState?.runtimeState?.guild) && Object.keys(playerState.runtimeState.guild).length > 0
      ? playerState.runtimeState.guild
      : null;
  const runtimeConsortium =
    isRecord(playerState?.runtimeState?.consortium) && Object.keys(playerState.runtimeState.consortium).length > 0
      ? playerState.runtimeState.consortium
      : null;
  const runtimeTravel =
    isRecord(playerState?.runtimeState?.travel) && Object.keys(playerState.runtimeState.travel).length > 0
      ? playerState.runtimeState.travel
      : null;
  const runtimeCivicEmployment =
    isRecord(playerState?.runtimeState?.civicEmployment) &&
    Object.keys(playerState.runtimeState.civicEmployment).length > 0
      ? playerState.runtimeState.civicEmployment
      : null;
  const runtimeLegacy =
    isRecord(playerState?.runtimeState?.legacy) && Object.keys(playerState.runtimeState.legacy).length > 0
      ? playerState.runtimeState.legacy
      : null;
  const existingCurrent = isRecord(existing.current) ? existing.current : {};
  const runtimeCurrent = isRecord(runtimePlayer.current) ? runtimePlayer.current : {};

  const mergedCurrent: Record<string, unknown> = {
    ...existingCurrent,
    ...runtimeCurrent,
    ...(runtimeTravel ? { travel: runtimeTravel } : {}),
    ...(runtimeCivicEmployment ? { civicEmployment: runtimeCivicEmployment } : {}),
  };

  const resolvedJob =
    typeof playerState?.currentJob === "string"
      ? playerState.currentJob
      : isRecord(playerState?.currentJob) && typeof playerState.currentJob.current === "string"
        ? playerState.currentJob.current
      : null;

  const mergedExperience = normalizeExperience(
    runtimePlayer.experience ?? existing.experience ?? 0,
  );

  const mergedPlayer: Record<string, unknown> = {
    ...existing,
    ...runtimePlayer,
    internalId: user.internalPlayerId,
    publicId: user.publicId,
    name:
      typeof runtimePlayer.name === "string" && runtimePlayer.name
        ? runtimePlayer.name
        : typeof existing.name === "string" && existing.name
          ? existing.name
          : user.firstName,
    lastName:
      typeof runtimePlayer.lastName === "string" && runtimePlayer.lastName
        ? runtimePlayer.lastName
        : typeof existing.lastName === "string" && existing.lastName
          ? existing.lastName
          : user.lastName,
    isRegistered: true,
    experience: mergedExperience,
    level: normalizeLevel(playerState?.level ?? runtimePlayer.level ?? existing.level, mergedExperience),
    gold: playerState?.gold ?? runtimePlayer.gold ?? existing.gold ?? 500,
    stats: {
      ...(isRecord(existing.stats) ? existing.stats : {}),
      ...(isRecord(runtimePlayer.stats) ? runtimePlayer.stats : {}),
      ...(isRecord(playerState?.stats) ? playerState.stats : {}),
    },
    workingStats: normalizeStatRecord(
      {
        ...(isRecord(existing.workingStats) ? existing.workingStats : {}),
        ...(isRecord(runtimePlayer.workingStats) ? runtimePlayer.workingStats : {}),
        ...(isRecord(playerState?.workingStats) ? playerState.workingStats : {}),
      },
      DEFAULT_WORKING_STATS,
    ),
    battleStats: normalizeStatRecord(
      {
        ...(isRecord(existing.battleStats) ? existing.battleStats : {}),
        ...(isRecord(runtimePlayer.battleStats) ? runtimePlayer.battleStats : {}),
        ...(isRecord(playerState?.battleStats) ? playerState.battleStats : {}),
      },
      DEFAULT_BATTLE_STATS,
    ),
    current: {
      ...mergedCurrent,
      job: resolvedJob ?? (typeof existingCurrent.job === "string" ? existingCurrent.job : null),
    },
  };

  writeRecord(playerStorageKey(email), mergedPlayer);
  if (runtimeJobs) writeRecord(JOBS_STORAGE_KEY, runtimeJobs);
  if (runtimeEducation) writeRecord(EDUCATION_STORAGE_KEY, runtimeEducation);
  if (runtimeArena) writeRecord(getArenaStateKey(user.internalPlayerId), runtimeArena);
  if (runtimeTimers) writeRecord(TIMER_STORAGE_KEY, runtimeTimers);
  if (runtimeGuild) writeRecord(guildKey(user.internalPlayerId), runtimeGuild);
  if (runtimeConsortium) writeRecord(consortiumKey(user.internalPlayerId), runtimeConsortium);
  if (runtimeCivicEmployment) writeRecord("nexis_civic_employment", runtimeCivicEmployment);
  if (runtimeLegacy) writeRecord("nexis_legacy", runtimeLegacy);
}
