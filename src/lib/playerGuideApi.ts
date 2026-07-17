import type { ApiFailure } from "./authApi";

export type CommandBriefStep = {
  id: string;
  label: string;
  status: "available" | "current" | "complete" | "locked";
  route: string;
  detail: string;
};

export type CommandBriefAction = {
  id: string;
  label: string;
  route: string;
  reason: string;
  cta: string;
};

export type PlayerCommandBrief = {
  phase: string;
  summary: string;
  primaryAction: CommandBriefAction;
  nextActions: CommandBriefAction[];
  firstSteps: CommandBriefStep[];
  blockers: Array<{ id: string; label: string; detail: string }>;
};

type ApiCommandBriefResponse = { ok: true; commandBrief: PlayerCommandBrief } | ApiFailure;

async function requestJson<TSuccess>(path: string, init: RequestInit = {}): Promise<TSuccess | ApiFailure> {
  try {
    const response = await fetch(path, init);
    let payload: Record<string, unknown> | null = null;
    try {
      payload = (await response.json()) as Record<string, unknown>;
    } catch {
      payload = null;
    }

    if (!response.ok) {
      return {
        ok: false,
        error: typeof payload?.error === "string" ? payload.error : `Request failed (${response.status}).`,
        unavailable: response.status >= 500 || response.status === 404,
        status: response.status,
        code: typeof payload?.code === "string" ? payload.code : null,
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
  }
}

export async function getPlayerCommandBrief(sessionToken: string): Promise<ApiCommandBriefResponse> {
  const result = await requestJson<{ ok?: true; commandBrief: PlayerCommandBrief }>("/api/guide/command-brief", {
    headers: { Authorization: `Bearer ${sessionToken}` },
  });

  if ("ok" in result) return result as ApiCommandBriefResponse;
  return { ok: true, commandBrief: result.commandBrief };
}
