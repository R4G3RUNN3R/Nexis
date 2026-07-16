import { type ServerPlayerState } from "./authApi";

export type WorldProgressionResponse =
  | { ok: true; playerState: ServerPlayerState; cityDiaries: unknown[]; qualities: unknown[]; worldEvents: unknown[]; progress: Record<string, unknown> }
  | { ok: false; error: string; status: number | null };

export async function getWorldProgression(token: string): Promise<WorldProgressionResponse> {
  try {
    const response = await fetch("/api/world-progression", { headers: { Authorization: `Bearer ${token}` } });
    const payload = (await response.json().catch(() => null)) as Record<string, unknown> | null;
    if (!response.ok || !payload?.playerState) {
      return { ok: false, error: String(payload?.error ?? "World progression service unavailable."), status: response.status };
    }
    return {
      ok: true,
      playerState: payload.playerState as ServerPlayerState,
      cityDiaries: Array.isArray(payload.cityDiaries) ? payload.cityDiaries : [],
      qualities: Array.isArray(payload.qualities) ? payload.qualities : [],
      worldEvents: Array.isArray(payload.worldEvents) ? payload.worldEvents : [],
      progress: (payload.progress ?? {}) as Record<string, unknown>,
    };
  } catch {
    return { ok: false, error: "World progression service unavailable.", status: null };
  }
}
