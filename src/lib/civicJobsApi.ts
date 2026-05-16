import type { ApiFailure, ServerPlayerState } from "./authApi";

export type CivicWorkingStatKey = "manualLabor" | "intelligence" | "endurance";
export type CivicBattleStatKey = "strength" | "defense" | "speed" | "dexterity";

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

export type CivicPolicy = {
  consortiumBlocked: boolean;
  rule: string;
  blockedReason: string | null;
};

export type CivicPassive = {
  key: string;
  name: string;
  description: string;
  magnitude: number;
  activeMode?: "permanent" | "employed";
};

export type CivicRank = {
  rank: number;
  title: string;
  dailyGold: number;
  dailyJobPoints: number;
  workingStatGains: Partial<Record<CivicWorkingStatKey, number>>;
  passiveUnlock?: CivicPassive;
  requirementRule?: Record<string, unknown>;
};

export type CivicSpendOptionEffect =
  | { kind: "battle_stat"; stat: CivicBattleStatKey; amount: number }
  | { kind: "working_stat"; stat: CivicWorkingStatKey; amount: number }
  | {
      kind: "inventory_roll";
      pool: Array<{ itemId: string; quantity: number; label?: string }>;
    };

export type CivicSpendOption = {
  id: string;
  label: string;
  description: string;
  costJobPoints: number;
  effect: CivicSpendOptionEffect;
};

export type CivicTrack = {
  id: string;
  name: string;
  entryRequirements?: string[];
  interviewQuestions?: string[];
  entryRule?: Record<string, unknown>;
  spendOptions?: CivicSpendOption[];
  ranks: CivicRank[];
};

export type CivicJobsPayload = {
  playerState: ServerPlayerState;
  civicEmployment: CivicEmploymentState;
  civicPolicy: CivicPolicy;
  tracks: CivicTrack[];
  passives: Record<string, number>;
  message?: string;
  action?: string;
  collection?: {
    trackId: string;
    trackName: string;
    rank: number;
    rankTitle: string;
    dailyGold: number;
    dailyJobPoints: number;
    workingStatGains: Partial<Record<CivicWorkingStatKey, number>>;
    promotions: string[];
  };
  promotion?: {
    trackId: string;
    trackName: string;
    newRank: number;
    newTitle: string;
    spentJobPoints: number;
  };
  spendResult?: {
    trackId: string;
    optionId: string;
    label: string;
    spentJobPoints: number;
    grantedItem?: { itemId: string; quantity: number; label: string } | null;
  };
};

export type CivicJobsResponse = ({ ok: true } & CivicJobsPayload) | ApiFailure;

const API_TIMEOUT_MS = 8000;

async function requestJson(path: string, sessionToken: string, init: RequestInit): Promise<CivicJobsResponse> {
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), API_TIMEOUT_MS);

  try {
    const response = await fetch(path, {
      ...init,
      headers: {
        Authorization: `Bearer ${sessionToken}`,
        ...(init.body ? { "Content-Type": "application/json" } : {}),
        ...(init.headers ?? {}),
      },
      signal: controller.signal,
    });

    let payload: Record<string, unknown> | null = null;
    try {
      payload = (await response.json()) as Record<string, unknown>;
    } catch {
      payload = null;
    }

    if (!response.ok) {
      const code = typeof payload?.code === "string" ? payload.code : null;
      return {
        ok: false,
        error:
          typeof payload?.error === "string"
            ? payload.error
            : `Request failed (${response.status}).`,
        unavailable:
          response.status >= 500 ||
          response.status === 404 ||
          code === "DATABASE_UNAVAILABLE",
        status: response.status,
        code,
      };
    }

    return {
      ok: true,
      ...(payload as CivicJobsPayload),
    };
  } catch {
    return {
      ok: false,
      error: "Server unavailable right now.",
      unavailable: true,
      status: null,
      code: "NETWORK_UNAVAILABLE",
    };
  } finally {
    window.clearTimeout(timeout);
  }
}

export function getCivicJobs(sessionToken: string): Promise<CivicJobsResponse> {
  return requestJson("/api/civic-jobs", sessionToken, { method: "GET" });
}

export function joinCivicJob(sessionToken: string, trackId: string): Promise<CivicJobsResponse> {
  return requestJson("/api/civic-jobs/join", sessionToken, {
    method: "POST",
    body: JSON.stringify({ trackId }),
  });
}

export function collectCivicBenefits(sessionToken: string): Promise<CivicJobsResponse> {
  return requestJson("/api/civic-jobs/collect", sessionToken, {
    method: "POST",
  });
}

export function resignCivicJob(sessionToken: string): Promise<CivicJobsResponse> {
  return requestJson("/api/civic-jobs/resign", sessionToken, {
    method: "POST",
  });
}

export function promoteCivicJob(sessionToken: string): Promise<CivicJobsResponse> {
  return requestJson("/api/civic-jobs/promote", sessionToken, {
    method: "POST",
  });
}

export function spendCivicJobPoints(
  sessionToken: string,
  trackId: string,
  optionId: string,
): Promise<CivicJobsResponse> {
  return requestJson("/api/civic-jobs/spend", sessionToken, {
    method: "POST",
    body: JSON.stringify({ trackId, optionId }),
  });
}
