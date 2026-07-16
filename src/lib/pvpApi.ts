import { type ServerPlayerState } from "./authApi";

export type PvpHubResponse =
  | { ok: true; playerState: ServerPlayerState; pvp: Record<string, unknown>; catalog: Record<string, unknown>; message?: string; writ?: Record<string, unknown> }
  | { ok: false; error: string; status: number | null };

async function requestPvp(token: string, path: string, init: RequestInit = {}): Promise<PvpHubResponse> {
  try {
    const response = await fetch(path, {
      ...init,
      headers: {
        ...(init.body ? { "Content-Type": "application/json" } : {}),
        ...(init.headers ?? {}),
        Authorization: `Bearer ${token}`,
      },
    });
    const payload = (await response.json().catch(() => null)) as Record<string, unknown> | null;
    if (!response.ok || !payload?.playerState || !payload?.pvp) {
      return { ok: false, error: String(payload?.error ?? "PvP service unavailable."), status: response.status };
    }
    return {
      ok: true,
      playerState: payload.playerState as ServerPlayerState,
      pvp: payload.pvp as Record<string, unknown>,
      catalog: (payload.catalog ?? {}) as Record<string, unknown>,
      message: typeof payload.message === "string" ? payload.message : undefined,
      writ: payload.writ as Record<string, unknown> | undefined,
    };
  } catch {
    return { ok: false, error: "PvP service unavailable.", status: null };
  }
}

export function getPvpHub(token: string) {
  return requestPvp(token, "/api/pvp");
}

export function updatePvpSafety(token: string, safety: Record<string, boolean>) {
  return requestPvp(token, "/api/pvp/safety", { method: "POST", body: JSON.stringify({ safety }) });
}

export function issueBountyWrit(token: string, targetPublicId: number, gold: number, reason: string) {
  return requestPvp(token, "/api/pvp/bounties", { method: "POST", body: JSON.stringify({ targetPublicId, gold, reason }) });
}
