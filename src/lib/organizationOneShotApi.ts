export type OrganizationOneShotCampaign = {
  id: string;
  organizationType: "guild" | "consortium";
  theme: string;
  title: string;
  category: string;
  summary: string;
  status: "recruiting" | "completed";
  signupCount: number;
  tokenCommittedCount: number;
  minimumSignups: number;
  tokenCost: number;
  tokenRefundChance: number;
  signups: Array<{ publicId: number; displayName: string; roleKey?: string | null; tokenCommitment?: Record<string, unknown> | null }>;
  viewerSignedUp: boolean;
  canResolve: boolean;
  completedAt: number | null;
  rewardTarget?: string;
  rewardPreview: string;
  reward?: Record<string, unknown>;
};

export type OrganizationOneShotLegacyRecord = {
  id?: string;
  timestamp?: number;
  title?: string;
  summary?: string;
  reward?: Record<string, unknown>;
};

export type OrganizationOneShotResponse =
  | { ok: true; organization: Record<string, unknown>; minimumSignups: number; tokenCost?: number; tokenRefundChance?: number; campaigns: OrganizationOneShotCampaign[]; legacyRecords: OrganizationOneShotLegacyRecord[]; message?: string; legacyRecord?: OrganizationOneShotLegacyRecord }
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
      tokenCost: Number(payload.tokenCost ?? 1),
      tokenRefundChance: Number(payload.tokenRefundChance ?? 0.0001),
      campaigns: payload.campaigns as OrganizationOneShotCampaign[],
      legacyRecords: (Array.isArray(payload.legacyRecords) ? payload.legacyRecords : []) as OrganizationOneShotLegacyRecord[],
      message: typeof payload.message === "string" ? payload.message : undefined,
      legacyRecord: payload.legacyRecord as OrganizationOneShotLegacyRecord | undefined,
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
