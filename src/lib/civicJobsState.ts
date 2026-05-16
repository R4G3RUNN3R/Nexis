export type CivicTrackProgress = {
  rank: number;
  jobPoints: number;
  shiftsWorked: number;
  joinedAt: number;
  lastShiftAt: number | null;
};

export type CivicEmploymentState = {
  activeTrackId: string | null;
  trackProgress: Record<string, CivicTrackProgress>;
};

export type CivicPassiveMode = "permanent" | "employed";

export type CivicPassive = {
  key: string;
  name: string;
  magnitude: number;
  activeMode: CivicPassiveMode;
  unlockRank: number;
};

export type ActiveCivicPassives = Record<string, number>;

export const CIVIC_SHIFT_COOLDOWN_MS = 24 * 60 * 60 * 1000;
const MAX_CIVIC_RANK = 7;
const PROMOTION_POINT_COSTS: Record<number, number> = {
  2: 5,
  3: 10,
  4: 15,
  5: 20,
  6: 25,
  7: 30,
};

const TRACK_CAPSTONES: Record<string, CivicPassive | undefined> = {
  city_watch: {
    key: "city_watch_hardline",
    name: "Hardline Watch Doctrine",
    magnitude: 8,
    activeMode: "employed",
    unlockRank: 7,
  },
  apothecary_hall: {
    key: "hospital_recovery",
    name: "Field Triage Discipline",
    magnitude: 15,
    activeMode: "permanent",
    unlockRank: 7,
  },
  university: {
    key: "education_speed",
    name: "Scholarly Momentum",
    magnitude: 10,
    activeMode: "permanent",
    unlockRank: 7,
  },
  provisioner: {
    key: "market_discount",
    name: "Procurement Mastery",
    magnitude: 8,
    activeMode: "permanent",
    unlockRank: 7,
  },
  civic_tribunal: {
    key: "jail_reduction",
    name: "Tribunal Leverage",
    magnitude: 15,
    activeMode: "permanent",
    unlockRank: 7,
  },
  gambling_den: {
    key: "gambling_den_house_edge",
    name: "House Edge Discipline",
    magnitude: 8,
    activeMode: "employed",
    unlockRank: 7,
  },
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function asWholeNumber(value: unknown, fallback: number) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return fallback;
  return Math.max(0, Math.floor(numeric));
}

export function defaultCivicEmploymentState(): CivicEmploymentState {
  return {
    activeTrackId: null,
    trackProgress: {},
  };
}

function normalizeTrackProgress(value: unknown): CivicTrackProgress | null {
  if (!isRecord(value)) return null;
  return {
    rank: Math.min(MAX_CIVIC_RANK, Math.max(1, asWholeNumber(value.rank, 1))),
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
  ) as CivicEmploymentState["trackProgress"];

  return {
    activeTrackId: typeof value.activeTrackId === "string" ? value.activeTrackId : null,
    trackProgress,
  };
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

export function getTrackProgress(state: CivicEmploymentState, trackId: string): CivicTrackProgress | null {
  return state.trackProgress[trackId] ?? null;
}

export function getShiftCooldownRemaining(progress: CivicTrackProgress | null, now = Date.now()) {
  if (!progress?.lastShiftAt) return 0;
  return Math.max(0, progress.lastShiftAt + CIVIC_SHIFT_COOLDOWN_MS - now);
}

export function getRequiredPointsForRank(rank: number) {
  if (rank <= 1) return 0;
  return PROMOTION_POINT_COSTS[rank] ?? Number.POSITIVE_INFINITY;
}

export function getUnlockedPassivesForTrack(trackId: string, rank: number) {
  const capstone = TRACK_CAPSTONES[trackId];
  if (!capstone) return [] as CivicPassive[];
  if (rank < capstone.unlockRank) return [] as CivicPassive[];
  return [capstone];
}

export function getActiveCivicJobPassives(state: CivicEmploymentState): ActiveCivicPassives {
  const passives: ActiveCivicPassives = {};
  const activeTrackId = state.activeTrackId;

  for (const [trackId, progress] of Object.entries(state.trackProgress)) {
    for (const passive of getUnlockedPassivesForTrack(trackId, progress.rank)) {
      if (passive.activeMode === "permanent" || trackId === activeTrackId) {
        passives[passive.key] = passive.magnitude;
      }
    }
  }

  return passives;
}