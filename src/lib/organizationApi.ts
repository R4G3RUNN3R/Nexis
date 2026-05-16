import { type ServerPlayerState } from "./authApi";
import {
  type ConsortiumBoard,
  type ConsortiumLogisticsBoard,
  type ConsortiumPointState,
  type ConsortiumTypeDefinition,
  type GuildBoard,
  type OrganizationBaseOwnershipResponse,
  type OrganizationRecord,
  type OrganizationType,
} from "./organizations";

type ApiFailure = { ok: false; error: string; status: number | null };

function sanitizeOrganizationApiError(message: unknown) {
  const text = typeof message === "string" ? message.trim() : "";
  if (!text) return "Organization request failed.";
  if (/^database is unavailable/i.test(text)) {
    return "Organization records are temporarily unavailable. Please retry shortly.";
  }
  return text;
}

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
    if (!response.ok) return { ok: false, error: sanitizeOrganizationApiError(payload?.error ?? `Request failed (${response.status}).`), status: response.status };
    return payload;
  } catch {
    return { ok: false, error: "Organization API unavailable.", status: null };
  }
}

export type MyOrganizationResponse = {
  organization: OrganizationRecord | null;
  consortiumTemplates?: ConsortiumTypeDefinition[];
  consortiumProgress?: ConsortiumPointState | null;
  directory?: Array<Record<string, unknown>>;
};

export const getMyOrganization = (token: string, type: OrganizationType) => requestJson<MyOrganizationResponse>(`/api/organizations/mine?type=${encodeURIComponent(type)}`, token);
export const getOrganizationByPublicId = (token: string, type: OrganizationType, publicId: string) => requestJson<MyOrganizationResponse>(`/api/organizations/public/${encodeURIComponent(publicId)}?type=${encodeURIComponent(type)}`, token);
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
export const updateGuildSettings = (token: string, organizationInternalId: string, payload: Record<string, unknown>) => requestJson<{ organization: GuildBoard }>(`/api/organizations/${encodeURIComponent(organizationInternalId)}/guilds/settings`, token, { method: "POST", body: JSON.stringify(payload) });
export const recruitGuildMember = (token: string, organizationInternalId: string, publicId: string) => requestJson<{ organization: GuildBoard }>(`/api/organizations/${encodeURIComponent(organizationInternalId)}/guilds/members`, token, { method: "POST", body: JSON.stringify({ publicId }) });
export const unlockGuildSkill = (token: string, organizationInternalId: string, skillKey: string) => requestJson<{ organization: GuildBoard }>(`/api/organizations/${encodeURIComponent(organizationInternalId)}/guilds/skills/unlock`, token, { method: "POST", body: JSON.stringify({ skillKey }) });
export const depositGuildArmory = (token: string, organizationInternalId: string, itemId: string, quantity: number) => requestJson<{ organization: GuildBoard; playerState: ServerPlayerState }>(`/api/organizations/${encodeURIComponent(organizationInternalId)}/guilds/armory/deposit`, token, { method: "POST", body: JSON.stringify({ itemId, quantity }) });
export const withdrawGuildArmory = (token: string, organizationInternalId: string, itemId: string, quantity: number) => requestJson<{ organization: GuildBoard; playerState: ServerPlayerState }>(`/api/organizations/${encodeURIComponent(organizationInternalId)}/guilds/armory/withdraw`, token, { method: "POST", body: JSON.stringify({ itemId, quantity }) });
export const launchGuildDungeon = (token: string, organizationInternalId: string, dungeonKey: string) => requestJson<{ organization: GuildBoard }>(`/api/organizations/${encodeURIComponent(organizationInternalId)}/guilds/adventures/launch`, token, { method: "POST", body: JSON.stringify({ dungeonKey }) });
export const planGuildQuest = (token: string, organizationInternalId: string, questKey: string) => requestJson<{ organization: GuildBoard }>(`/api/organizations/${encodeURIComponent(organizationInternalId)}/guilds/quests/plan`, token, { method: "POST", body: JSON.stringify({ questKey }) });
export const assignGuildQuestMember = (token: string, organizationInternalId: string, slotKey: string, publicId: string) => requestJson<{ organization: GuildBoard }>(`/api/organizations/${encodeURIComponent(organizationInternalId)}/guilds/quests/assign`, token, { method: "POST", body: JSON.stringify({ slotKey, publicId }) });
export const cancelGuildQuest = (token: string, organizationInternalId: string) => requestJson<{ organization: GuildBoard }>(`/api/organizations/${encodeURIComponent(organizationInternalId)}/guilds/quests/cancel`, token, { method: "POST" });
export const initiateGuildQuest = (token: string, organizationInternalId: string) => requestJson<{ organization: GuildBoard }>(`/api/organizations/${encodeURIComponent(organizationInternalId)}/guilds/quests/initiate`, token, { method: "POST" });
export const replanGuildQuest = (token: string, organizationInternalId: string) => requestJson<{ organization: GuildBoard }>(`/api/organizations/${encodeURIComponent(organizationInternalId)}/guilds/quests/replan`, token, { method: "POST" });
export const getConsortiumLogisticsBoard = (token: string, organizationInternalId: string) => requestJson<{ logistics: ConsortiumLogisticsBoard }>(`/api/organizations/${encodeURIComponent(organizationInternalId)}/consortiums/logistics`, token);
export const createConsortiumLogisticsOperation = (token: string, organizationInternalId: string, payload: { templateKey: string; mode: "draft" | "launch" }) => requestJson<{ logistics: ConsortiumLogisticsBoard; operationId: string }>(`/api/organizations/${encodeURIComponent(organizationInternalId)}/consortiums/logistics`, token, { method: "POST", body: JSON.stringify(payload) });
export const assignConsortiumLogisticsWorker = (token: string, organizationInternalId: string, operationInternalId: string, payload: { publicId: string; action?: "assign" | "remove"; assignmentRole?: string }) => requestJson<{ logistics: ConsortiumLogisticsBoard; operationId: string }>(`/api/organizations/${encodeURIComponent(organizationInternalId)}/consortiums/logistics/${encodeURIComponent(operationInternalId)}/workers`, token, { method: "POST", body: JSON.stringify(payload) });
export const setConsortiumLogisticsEscort = (token: string, organizationInternalId: string, operationInternalId: string, payload: { mode: "none" | "internal_team" | "guild_contract"; guildPublicId?: string; notes?: string }) => requestJson<{ logistics: ConsortiumLogisticsBoard; operationId: string }>(`/api/organizations/${encodeURIComponent(organizationInternalId)}/consortiums/logistics/${encodeURIComponent(operationInternalId)}/escort`, token, { method: "POST", body: JSON.stringify(payload) });
export const getOrganizationBaseOwnership = (token: string, organizationInternalId: string) => requestJson<OrganizationBaseOwnershipResponse>(`/api/organizations/${encodeURIComponent(organizationInternalId)}/base`, token);
export const acquireOrganizationBase = (token: string, organizationInternalId: string, payload: Record<string, unknown>) => requestJson<{ organization: OrganizationRecord; base: Record<string, unknown> }>(`/api/organizations/${encodeURIComponent(organizationInternalId)}/base/acquire`, token, { method: "POST", body: JSON.stringify(payload) });
export const payOrganizationBaseUpkeep = (token: string, organizationInternalId: string, amountGold: number) => requestJson<{ organization: OrganizationRecord; base: Record<string, unknown>; ledger: { dueGold: number; paidGold: number; outstandingGold: number } }>(`/api/organizations/${encodeURIComponent(organizationInternalId)}/base/pay`, token, { method: "POST", body: JSON.stringify({ amountGold }) });
export const buybackOrganizationBase = (token: string, organizationInternalId: string) => requestJson<{ organization: OrganizationRecord; base: Record<string, unknown>; buyback: Record<string, unknown> }>(`/api/organizations/${encodeURIComponent(organizationInternalId)}/base/buyback`, token, { method: "POST" });
export const sellbackOrganizationPlot = (token: string, organizationInternalId: string) => requestJson<{ organization: OrganizationRecord; base: null; sellback: Record<string, unknown> }>(`/api/organizations/${encodeURIComponent(organizationInternalId)}/base/sellback`, token, { method: "POST" });
export const startOrganizationMainBuild = (token: string, organizationInternalId: string, payload: { buildingKey: string; materials?: Record<string, number>; rushBuild?: boolean; laborSource?: "player_pool" | "npc_contractor" }) => requestJson<{ organization: OrganizationRecord; base: Record<string, unknown>; construction: Record<string, unknown> }>(`/api/organizations/${encodeURIComponent(organizationInternalId)}/base/construction/start`, token, { method: "POST", body: JSON.stringify(payload) });
export const cancelOrganizationMainBuild = (token: string, organizationInternalId: string, payload?: { reason?: string }) => requestJson<{ base: Record<string, unknown>; cancelled: Record<string, unknown> }>(`/api/organizations/${encodeURIComponent(organizationInternalId)}/base/construction/cancel`, token, { method: "POST", body: JSON.stringify(payload ?? {}) });
export const startOrganizationRoomBuild = (token: string, organizationInternalId: string, payload: { roomKey: string; materials?: Record<string, number>; laborSource?: "player_pool" | "npc_contractor" }) => requestJson<{ organization: OrganizationRecord; base: Record<string, unknown>; construction: Record<string, unknown> }>(`/api/organizations/${encodeURIComponent(organizationInternalId)}/base/rooms/start`, token, { method: "POST", body: JSON.stringify(payload) });
export const cancelOrganizationRoomBuild = (token: string, organizationInternalId: string, payload?: { reason?: string }) => requestJson<{ base: Record<string, unknown>; cancelled: Record<string, unknown> }>(`/api/organizations/${encodeURIComponent(organizationInternalId)}/base/rooms/cancel`, token, { method: "POST", body: JSON.stringify(payload ?? {}) });
export const removeOrganizationBaseRoom = (token: string, organizationInternalId: string, payload: { roomKey: string }) => requestJson<{ organization: OrganizationRecord; base: Record<string, unknown>; removed: Record<string, unknown> }>(`/api/organizations/${encodeURIComponent(organizationInternalId)}/base/rooms/remove`, token, { method: "POST", body: JSON.stringify(payload) });
