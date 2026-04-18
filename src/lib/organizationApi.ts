import { type ServerPlayerState } from "./authApi";
import { type ConsortiumBoard, type ConsortiumPointState, type ConsortiumTypeDefinition, type OrganizationRecord, type OrganizationType } from "./organizations";

type ApiFailure = { ok: false; error: string; status: number | null };

async function requestJson<T>(path: string, token: string, init: RequestInit = {}): Promise<T | ApiFailure> {
  try {
    const response = await fetch(path, {
      ...init,
      headers: {
        ...(init.body ? { "Content-Type": "application/json" } : {}),
        ...(init.headers ?? {}),
        Authorization: `Bearer ${token}`,
      },
    });
    const payload = (await response.json()) as T & { error?: string };
    if (!response.ok) return { ok: false, error: payload?.error ?? `Request failed (${response.status}).`, status: response.status };
    return payload;
  } catch {
    return { ok: false, error: "Organization API unavailable.", status: null };
  }
}

export type MyOrganizationResponse = {
  organization: OrganizationRecord | null;
  consortiumTemplates: ConsortiumTypeDefinition[];
  consortiumProgress: ConsortiumPointState | null;
  directory?: Array<Record<string, unknown>>;
};

export const getMyOrganization = (token: string, type: OrganizationType) => requestJson<MyOrganizationResponse>(`/api/organizations/mine?type=${encodeURIComponent(type)}`, token);
export const createOrganization = (token: string, payload: Record<string, unknown>) => requestJson<{ organization: OrganizationRecord; consortiumProgress: ConsortiumPointState | null; playerState: ServerPlayerState }>(`/api/organizations`, token, { method: "POST", body: JSON.stringify(payload) });
export const claimConsortiumPoints = (token: string, organizationInternalId: string) => requestJson<{ organization: ConsortiumBoard; consortiumProgress: ConsortiumPointState; playerState: ServerPlayerState; grant: number }>(`/api/organizations/${encodeURIComponent(organizationInternalId)}/consortiums/claim-points`, token, { method: "POST" });
export const redeemConsortiumReward = (token: string, organizationInternalId: string, rewardKey: string) => requestJson<{ organization: ConsortiumBoard; consortiumProgress: ConsortiumPointState; playerState: ServerPlayerState; rewardResult: { summary: string; grantedItem?: { itemId: string; quantity: number; label: string } } }>(`/api/organizations/${encodeURIComponent(organizationInternalId)}/consortiums/redeem`, token, { method: "POST", body: JSON.stringify({ rewardKey }) });
export const addOrganizationMember = (token: string, organizationInternalId: string, publicId: string) => requestJson<{ organization: ConsortiumBoard; consortiumProgress: ConsortiumPointState | null }>(`/api/organizations/${encodeURIComponent(organizationInternalId)}/members`, token, { method: "POST", body: JSON.stringify({ publicId }) });
export const applyToConsortium = (token: string, organizationInternalId: string, note: string) => requestJson<{ ok: true }>(`/api/organizations/${encodeURIComponent(organizationInternalId)}/consortiums/apply`, token, { method: "POST", body: JSON.stringify({ note }) });
export const reviewConsortiumApplication = (token: string, organizationInternalId: string, applicantPublicId: string, decision: "accept" | "reject") => requestJson<{ organization: ConsortiumBoard }>(`/api/organizations/${encodeURIComponent(organizationInternalId)}/consortiums/applications/review`, token, { method: "POST", body: JSON.stringify({ applicantPublicId, decision }) });
export const assignConsortiumPosition = (token: string, organizationInternalId: string, publicId: string, positionKey: string) => requestJson<{ organization: ConsortiumBoard }>(`/api/organizations/${encodeURIComponent(organizationInternalId)}/consortiums/positions`, token, { method: "POST", body: JSON.stringify({ publicId, positionKey }) });
export const removeConsortiumMember = (token: string, organizationInternalId: string, publicId: string) => requestJson<{ organization: ConsortiumBoard }>(`/api/organizations/${encodeURIComponent(organizationInternalId)}/consortiums/members/remove`, token, { method: "POST", body: JSON.stringify({ publicId }) });
export const depositConsortiumTreasury = (token: string, organizationInternalId: string, gold: number) => requestJson<{ organization: ConsortiumBoard; playerState: ServerPlayerState }>(`/api/organizations/${encodeURIComponent(organizationInternalId)}/consortiums/treasury/deposit`, token, { method: "POST", body: JSON.stringify({ gold }) });
export const runConsortiumOutreach = (token: string, organizationInternalId: string) => requestJson<{ organization: ConsortiumBoard }>(`/api/organizations/${encodeURIComponent(organizationInternalId)}/consortiums/outreach`, token, { method: "POST" });
