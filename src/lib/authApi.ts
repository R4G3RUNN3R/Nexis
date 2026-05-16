export type ServerAuthUser = {
  email: string;
  username: string | null;
  firstName: string;
  lastName: string;
  publicId: number;
  publicPlayerId: string;
  internalId?: string;
  internalPlayerId: string;
  entityType: "player" | "npc" | "system" | "event";
  privilegeRole: "player" | "staff" | "admin";
  createdAt: number;
};

export type ServerPlayerState = {
  level: number;
  experience?: number;
  gold: number;
  currencies?: Record<string, number>;
  itemEnhancements?: Record<string, string[]>;
  stats: Record<string, number>;
  workingStats: Record<string, number>;
  battleStats: Record<string, number>;
  currentJob: Record<string, unknown> | string | null;
  runtimeState?: {
    player?: Record<string, unknown>;
    jobs?: Record<string, unknown>;
    education?: Record<string, unknown>;
    arena?: Record<string, unknown>;
    timers?: Record<string, unknown>;
    guild?: Record<string, unknown>;
    consortium?: Record<string, unknown>;
    civicEmployment?: Record<string, unknown>;
    travel?: Record<string, unknown>;
    legacy?: Record<string, unknown>;
  };
  createdAt: number;
  updatedAt: number;
} | null;

export type ApiFailure = {
  ok: false;
  error: string;
  unavailable: boolean;
  status: number | null;
  code: string | null;
};

type ApiAuthSuccess = {
  ok: true;
  user: ServerAuthUser;
  playerState: ServerPlayerState;
  sessionToken: string;
  sessionExpiresAt: string | null;
};

type ApiMeSuccess = {
  ok: true;
  user: ServerAuthUser;
  playerState: ServerPlayerState;
};

type RawAuthSuccess = Omit<ApiAuthSuccess, "ok">;
type RawMeSuccess = Omit<ApiMeSuccess, "ok">;

export type ApiAuthResponse = ApiAuthSuccess | ApiFailure;
export type ApiMeResponse = ApiMeSuccess | ApiFailure;
export type ApiStateSyncResponse =
  | {
      ok: true;
      playerState: ServerPlayerState;
    }
  | ApiFailure;

export type ApiPasswordResetRequestResponse =
  | { ok: true; delivered: true }
  | ApiFailure;

export type ApiPasswordResetResponse =
  | { ok: true; reset: true }
  | ApiFailure;

export type ApiTravelResponse =
  | {
      ok: true;
      playerState: ServerPlayerState;
      travel: Record<string, unknown>;
    }
  | ApiFailure;

export type ApiChronicleStatusResponse =
  | {
      ok: true;
      donorTier: Record<string, unknown>;
      legacy: Record<string, unknown>;
      activeRun: Record<string, unknown> | null;
    }
  | ApiFailure;

export type ServerLegacyAchievement = {
  id: string;
  category: string;
  name: string;
  description: string;
  progress: number;
  target: number;
  completed: boolean;
  completedOn?: string;
  rewardPoints: number;
};

export type ApiLegacyAchievementsResponse =
  | {
      ok: true;
      achievementCategories: string[];
      achievements: ServerLegacyAchievement[];
      legacyPoints: {
        totalEarned: number;
        totalSpent: number;
        available: number;
      };
      perkRanks: Record<string, number>;
      newlyAwarded: Array<{
        id: string;
        name: string;
        category: string;
        rewardPoints: number;
      }>;
      legacy: Record<string, unknown>;
    }
  | ApiFailure;

function asSuccess<T extends Record<string, unknown>>(payload: T): T & { ok: true } {
  return { ok: true, ...payload };
}

function asChronicleSuccess(payload: {
  donorTier: Record<string, unknown>;
  legacy: Record<string, unknown>;
  activeRun: Record<string, unknown> | null;
}): ApiChronicleStatusResponse {
  return asSuccess(payload);
}

const API_TIMEOUT_MS = 8000;

async function requestJson<TSuccess>(
  path: string,
  init: RequestInit = {},
): Promise<TSuccess | ApiFailure> {
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), API_TIMEOUT_MS);

  try {
    const response = await fetch(path, {
      ...init,
      headers: {
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

    return payload as TSuccess;
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

export function registerWithServer(data: {
  firstName: string;
  lastName: string;
  email: string;
  password: string;
  existingPublicId?: number;
}): Promise<ApiAuthResponse> {
  return requestJson<RawAuthSuccess>("/api/register", {
    method: "POST",
    body: JSON.stringify(data),
  }).then((result) => ("ok" in result ? result : asSuccess(result)));
}

export function loginWithServer(data: { email: string; password: string }): Promise<ApiAuthResponse> {
  return requestJson<RawAuthSuccess>("/api/login", {
    method: "POST",
    body: JSON.stringify(data),
  }).then((result) => ("ok" in result ? result : asSuccess(result)));
}

export function getCurrentServerUser(sessionToken: string): Promise<ApiMeResponse> {
  return requestJson<RawMeSuccess>("/api/me", {
    method: "GET",
    headers: {
      Authorization: `Bearer ${sessionToken}`,
    },
  }).then((result) => ("ok" in result ? result : asSuccess(result)));
}

export function saveCurrentServerState(
  sessionToken: string,
  runtimeState: Record<string, unknown>,
  options: {
    keepalive?: boolean;
  } = {},
): Promise<ApiStateSyncResponse> {
  return requestJson<{ playerState: ServerPlayerState }>("/api/state", {
    method: "PUT",
    keepalive: options.keepalive,
    headers: {
      Authorization: `Bearer ${sessionToken}`,
    },
    body: JSON.stringify(runtimeState),
  }).then((result) => ("ok" in result ? result : asSuccess(result)));
}

export function requestPasswordReset(data: { email: string }): Promise<ApiPasswordResetRequestResponse> {
  return requestJson<{ delivered: true }>("/api/forgot-password", {
    method: "POST",
    body: JSON.stringify(data),
  }).then((result) => ("ok" in result ? result : asSuccess(result)));
}

export function submitPasswordReset(data: { token: string; password: string }): Promise<ApiPasswordResetResponse> {
  return requestJson<{ reset: true }>("/api/reset-password", {
    method: "POST",
    body: JSON.stringify(data),
  }).then((result) => ("ok" in result ? result : asSuccess(result)));
}

export function getServerTravelState(sessionToken: string): Promise<ApiTravelResponse> {
  return requestJson<{ playerState: ServerPlayerState; travel: Record<string, unknown> }>("/api/travel", {
    method: "GET",
    headers: {
      Authorization: `Bearer ${sessionToken}`,
    },
  }).then((result) => ("ok" in result ? result : asSuccess(result)));
}

export function startServerTravel(
  sessionToken: string,
  destinationCityId: string,
): Promise<ApiTravelResponse> {
  return requestJson<{ playerState: ServerPlayerState; travel: Record<string, unknown> }>("/api/travel/start", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${sessionToken}`,
    },
    body: JSON.stringify({ destinationCityId }),
  }).then((result) => ("ok" in result ? result : asSuccess(result)));
}

export function cancelServerTravel(sessionToken: string): Promise<ApiTravelResponse> {
  return requestJson<{ playerState: ServerPlayerState; travel: Record<string, unknown> }>("/api/travel/cancel", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${sessionToken}`,
    },
  }).then((result) => ("ok" in result ? result : asSuccess(result)));
}

export function getChronicleStatus(sessionToken: string): Promise<ApiChronicleStatusResponse> {
  return requestJson<{ donorTier: Record<string, unknown>; legacy: Record<string, unknown>; activeRun: Record<string, unknown> | null }>("/api/legacy/chronicle", {
    method: "GET",
    headers: {
      Authorization: `Bearer ${sessionToken}`,
    },
  }).then((result) => ("ok" in result ? result : asChronicleSuccess(result)));
}

export function openMonthlyChronicle(sessionToken: string): Promise<ApiChronicleStatusResponse> {
  return requestJson<{ donorTier: Record<string, unknown>; legacy: Record<string, unknown>; activeRun: Record<string, unknown> | null }>("/api/legacy/chronicle/open", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${sessionToken}`,
    },
  }).then((result) => ("ok" in result ? result : asChronicleSuccess(result)));
}

export function submitChronicleChoice(
  sessionToken: string,
  choiceKey: string,
): Promise<ApiChronicleStatusResponse> {
  return requestJson<{ donorTier?: Record<string, unknown>; legacy: Record<string, unknown>; activeRun: Record<string, unknown> | null }>("/api/legacy/chronicle/choice", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${sessionToken}`,
    },
    body: JSON.stringify({ choiceKey }),
  }).then((result) =>
    "ok" in result
      ? result
      : asChronicleSuccess({
          donorTier: result.donorTier ?? {},
          legacy: result.legacy,
          activeRun: result.activeRun,
      }),
  );
}

export function getLegacyAchievements(sessionToken: string): Promise<ApiLegacyAchievementsResponse> {
  return requestJson<{
    achievementCategories: string[];
    achievements: ServerLegacyAchievement[];
    legacyPoints: {
      totalEarned: number;
      totalSpent: number;
      available: number;
    };
    perkRanks: Record<string, number>;
    newlyAwarded: Array<{
      id: string;
      name: string;
      category: string;
      rewardPoints: number;
    }>;
    legacy: Record<string, unknown>;
  }>("/api/legacy/achievements", {
    method: "GET",
    headers: {
      Authorization: `Bearer ${sessionToken}`,
    },
  }).then((result) => ("ok" in result ? result : asSuccess(result)));
}

export function spendLegacyPerkRank(
  sessionToken: string,
  perkId: string,
): Promise<ApiLegacyAchievementsResponse> {
  return requestJson<{
    achievementCategories: string[];
    achievements: ServerLegacyAchievement[];
    legacyPoints: {
      totalEarned: number;
      totalSpent: number;
      available: number;
    };
    perkRanks: Record<string, number>;
    newlyAwarded: Array<{
      id: string;
      name: string;
      category: string;
      rewardPoints: number;
    }>;
    legacy: Record<string, unknown>;
  }>("/api/legacy/perks/rank", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${sessionToken}`,
    },
    body: JSON.stringify({ perkId }),
  }).then((result) => ("ok" in result ? result : asSuccess(result)));
}
