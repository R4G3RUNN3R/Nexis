import { type CivicJobTrackId } from "../data/civicJobsData";

export type CivicTrackProgress = {
  rank: number;
  jobPoints: number;
  shiftsWorked: number;
  joinedAt: number;
  lastShiftAt: number | null;
};

export type CivicEmploymentState = {
  activeTrackId: CivicJobTrackId | null;
  trackProgress: Partial<Record<CivicJobTrackId, CivicTrackProgress>>;
};

const CIVIC_STATE_PREFIX = "nexis_civic_employment_";
export const CIVIC_SHIFT_COOLDOWN_MS = 6 * 60 * 60 * 1000;
const PROMOTION_POINT_THRESHOLDS: Record<number, number> = {
  1: 0,
  2: 6,
  3: 15,
  4: 30,
  5: 50,
};

function stateKey(internalPlayerId: string) {
  return `${CIVIC_STATE_PREFIX}${internalPlayerId}`;
}

export function defaultCivicEmploymentState(): CivicEmploymentState {
  return {
    activeTrackId: null,
    trackProgress: {},
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function asWholeNumber(value: unknown, fallback: number) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return fallback;
  return Math.max(0, Math.floor(numeric));
}

function normalizeTrackProgress(value: unknown): CivicTrackProgress | null {
  if (!isRecord(value)) return null;
  return {
    rank: Math.max(1, asWholeNumber(value.rank, 1)),
    jobPoints: asWholeNumber(value.jobPoints, 0),
    shiftsWorked: asWholeNumber(value.shiftsWorked, 0),
    joinedAt: asWholeNumber(value.joinedAt, Date.now()),
    lastShiftAt: value.lastShiftAt == null ? null : asWholeNumber(value.lastShiftAt, Date.now()),
  };
}

export function normalizeCivicEmploymentState(value: unknown): CivicEmploymentState {
  if (!isRecord(value)) return defaultCivicEmploymentState();

  const trackProgressSource = isRecord(value.trackProgress) ? value.trackProgress : {};
  const trackProgress = Object.fromEntries(
    Object.entries(trackProgressSource)
      .map(([trackId, progress]) => [trackId, normalizeTrackProgress(progress)] as const)
      .filter((entry): entry is [string, CivicTrackProgress] => entry[1] !== null),
  ) as CivicEmploymentState['trackProgress'];

  return {
    activeTrackId: typeof value.activeTrackId === 'string' ? (value.activeTrackId as CivicJobTrackId) : null,
    trackProgress,
  };
}

export function readCivicEmploymentState(internalPlayerId: string): CivicEmploymentState {
  if (typeof window === "undefined") return defaultCivicEmploymentState();

  try {
    const raw = window.localStorage.getItem(stateKey(internalPlayerId));
    if (!raw) return defaultCivicEmploymentState();
    return normalizeCivicEmploymentState(JSON.parse(raw));
  } catch {
    return defaultCivicEmploymentState();
  }
}

export function writeCivicEmploymentState(internalPlayerId: string, state: CivicEmploymentState) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(stateKey(internalPlayerId), JSON.stringify(normalizeCivicEmploymentState(state)));
}

export function getTrackProgress(
  state: CivicEmploymentState,
  trackId: CivicJobTrackId,
): CivicTrackProgress | null {
  return state.trackProgress[trackId] ?? null;
}

export function createTrackProgress(now = Date.now()): CivicTrackProgress {
  return {
    rank: 1,
    jobPoints: 0,
    shiftsWorked: 0,
    joinedAt: now,
    lastShiftAt: null,
  };
}

export function getShiftCooldownRemaining(progress: CivicTrackProgress | null, now = Date.now()) {
  if (!progress?.lastShiftAt) return 0;
  return Math.max(0, progress.lastShiftAt + CIVIC_SHIFT_COOLDOWN_MS - now);
}

export function getRequiredPointsForRank(rank: number) {
  return PROMOTION_POINT_THRESHOLDS[rank] ?? Number.POSITIVE_INFINITY;
}
