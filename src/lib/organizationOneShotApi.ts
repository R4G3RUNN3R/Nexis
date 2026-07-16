export type OrganizationOneShotResponse =
  | { ok: true; organization: Record<string, unknown>; minimumSignups: number; campaigns: unknown[]; legacyRecords: unknown[]; message?: string; legacyRecord?: Record<string, unknown> }
  | { ok: false; error: string; status: number | null };

async function requestOrganizationOneShot(token: string, path: string, init: RequestInit = {}): Promise<OrganizationOneShotResponse> {
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
    if (!response.ok || !payload?.organization || !Array.isArray(payload.campaigns)) {
      return { ok: false, error: String(payload?.error ?? "Organization one-shot service unavailable."), status: response.status };
    }
    return {
      ok: true,
      organization: payload.organization as Record<string, unknown>,
      minimumSignups: Number(payload.minimumSignups ?? 5),
      campaigns: payload.campaigns,
      legacyRecords: Array.isArray(payload.legacyRecords) ? payload.legacyRecords : [],
      message: typeof payload.message === "string" ? payload.message : undefined,
      legacyRecord: payload.legacyRecord as Record<string, unknown> | undefined,
    };
  } catch {
    return { ok: false, error: "Organization one-shot service unavailable.", status: null };
  }
}

export function getOrganizationOneShotBoard(token: string, organizationId: string | number) {
  return requestOrganizationOneShot(token, `/api/organizations/${encodeURIComponent(String(organizationId))}/one-shots`);
}

export function signUpOrganizationOneShot(token: string, organizationId: string | number, campaignId: string) {
  return requestOrganizationOneShot(token, `/api/organizations/${encodeURIComponent(String(organizationId))}/one-shots/${encodeURIComponent(campaignId)}/signup`, { method: "POST", body: JSON.stringify({}) });
}

export function resolveOrganizationOneShot(token: string, organizationId: string | number, campaignId: string) {
  return requestOrganizationOneShot(token, `/api/organizations/${encodeURIComponent(String(organizationId))}/one-shots/${encodeURIComponent(campaignId)}/resolve`, { method: "POST", body: JSON.stringify({}) });
}
