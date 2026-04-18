import { formatEntityPublicId } from "./publicIds";

export type OrganizationType = "guild" | "consortium";

export type OrganizationPermission =
  | "manage_members"
  | "manage_treasury"
  | "declare_operations"
  | "manage_contracts"
  | "recruit_members"
  | "view_logs"
  | "participate";

export type OrganizationRole = {
  roleKey: string;
  displayName: string;
  rankOrder: number;
  permissions: OrganizationPermission[];
  isSystemRole: boolean;
};

export type OrganizationMember = {
  userInternalId: string;
  publicId: number;
  displayName: string;
  roleKey: string;
  joinedAt: number;
};

export type OrganizationLog = {
  actionType: string;
  actorInternalId: string | null;
  actorPublicId: number | null;
  summary: Record<string, unknown>;
  createdAt: number;
};

export type OrganizationTreasury = {
  copper: number;
  silver: number;
  gold: number;
  platinum: number;
};

export type ConsortiumReward = {
  starTier: number;
  rewardKey: string;
  displayName: string;
  mode: "active" | "passive";
  pointCost: number | null;
  effectSummary: string;
  poolKey: string | null;
  unlocked?: boolean;
  canRedeem?: boolean;
};

export type ConsortiumTypeDefinition = {
  key: string;
  displayName: string;
  creationCost: number;
  description: string;
  rolesFlavor: string[];
  rewards: ConsortiumReward[];
};

export type ConsortiumPointState = {
  consortiumTypeKey: string;
  organizationInternalId: string;
  scope: "type";
  points: number;
  totalEarned: number;
  totalSpent: number;
  lastClaimedAt: number | null;
  dailyGain: number;
};

export type OrganizationRecord = {
  internalId: string;
  publicId: number;
  type: OrganizationType;
  name: string;
  tag: string | null;
  founderInternalId: string;
  founderPublicId: number;
  description: string;
  statusText: string;
  consortiumTypeKey: string | null;
  consortiumTypeName: string | null;
  passiveBonusSummary: string;
  creationCost: number;
  treasury: OrganizationTreasury;
  metadata: Record<string, unknown>;
  createdAt: number;
  updatedAt: number;
  roles: OrganizationRole[];
  members: OrganizationMember[];
  logs: OrganizationLog[];
  starRating?: number;
  consortiumType?: ConsortiumTypeDefinition | null;
  rolesFlavor?: string[];
  memberRoleKey?: string;
  rewardLadder?: ConsortiumReward[];
  unlockedPassives?: ConsortiumReward[];
  redeemableActives?: ConsortiumReward[];
  consortiumPoints?: ConsortiumPointState | null;
};

export type GuildBoard = OrganizationRecord & { type: "guild" };
export type ConsortiumBoard = OrganizationRecord & { type: "consortium" };

export const GUILD_STORAGE_PREFIX = "nexis_guild_board_";
export const CONSORTIUM_STORAGE_PREFIX = "nexis_consortium_board_";

export function guildKey(internalId: string) {
  return `${GUILD_STORAGE_PREFIX}${internalId}`;
}

export function consortiumKey(internalId: string) {
  return `${CONSORTIUM_STORAGE_PREFIX}${internalId}`;
}

export function readJson<T>(key: string): T | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

export function writeJson<T>(key: string, value: T) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(key, JSON.stringify(value));
}

export function readGuildBoard(internalId: string) {
  return readJson<GuildBoard>(guildKey(internalId));
}

export function readConsortiumBoard(internalId: string) {
  return readJson<ConsortiumBoard>(consortiumKey(internalId));
}

function resolveSummaryName(record: Record<string, unknown>) {
  if (typeof record.name === "string" && record.name) {
    return typeof record.publicId === "number" ? `${record.name} [${formatOrganizationBadge("guild", record.publicId)}]` : record.name;
  }
  const membership = record.membership && typeof record.membership === "object" ? record.membership as Record<string, unknown> : null;
  if (membership && typeof membership.name === "string" && membership.name && typeof membership.publicId === "number") {
    const type = typeof membership.consortiumTypeKey === "string" ? "consortium" : "guild";
    return `${membership.name} [${formatOrganizationBadge(type as OrganizationType, membership.publicId)}]`;
  }
  return null;
}

export function getGuildSummary(internalId: string) {
  const guild = readJson<Record<string, unknown>>(guildKey(internalId));
  return guild ? resolveSummaryName(guild) ?? "No guild" : "No guild";
}

export function getConsortiumSummary(internalId: string) {
  const consortium = readJson<Record<string, unknown>>(consortiumKey(internalId));
  return consortium ? resolveSummaryName(consortium) ?? "No consortium" : "No consortium";
}

export function formatDate(timestamp: number) {
  try {
    return new Date(timestamp).toLocaleDateString("en-GB", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  } catch {
    return "Unknown";
  }
}

export function formatOrganizationBadge(type: OrganizationType, publicId: number) {
  return `${formatEntityPublicId(type, publicId)}`;
}
