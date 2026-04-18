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

function asSuccess<T extends Record<string, unknown>>(payload: T): T & { ok: true } {
  return { ok: true, ...payload };
}

const API_TIMEOUT_MS = 3000;

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
      error: "Server unavailable. Falling back to local shard storage.",
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
): Promise<ApiStateSyncResponse> {
  return requestJson<{ playerState: ServerPlayerState }>("/api/state", {
    method: "PUT",
    headers: {
      Authorization: `Bearer ${sessionToken}`,
    },
    body: JSON.stringify(runtimeState),
  }).then((result) => ("ok" in result ? result : asSuccess(result)));
}
