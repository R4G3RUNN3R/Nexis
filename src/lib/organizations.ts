import { formatEntityPublicId } from "./publicIds";

export type GuildMember = {
  publicId: number | null;
  name: string;
  role: string;
};

export type GuildBoard = {
  kind: "guild";
  publicId: number;
  name: string;
  tag: string;
  founderPublicId: number | null;
  createdAt: number;
  treasury: number;
  respect: number;
  raidCount: number;
  recruitmentOpen: boolean;
  members: GuildMember[];
};

export type ConsortiumEmployee = {
  publicId: number | null;
  name: string;
  role: string;
  efficiency: number;
};

export type ConsortiumBoard = {
  kind: "consortium";
  publicId: number;
  name: string;
  tag: string;
  founderPublicId: number | null;
  createdAt: number;
  vault: number;
  stars: number;
  employees: ConsortiumEmployee[];
  applicantCount: number;
  advertisingLevel: number;
};

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

export function collectExistingPublicIds(prefix: string): number[] {
  if (typeof window === "undefined") return [];
  const ids: number[] = [];
  for (let i = 0; i < window.localStorage.length; i += 1) {
    const key = window.localStorage.key(i);
    if (!key || !key.startsWith(prefix)) continue;
    try {
      const parsed = JSON.parse(window.localStorage.getItem(key) ?? "null") as { publicId?: number } | null;
      if (parsed && typeof parsed.publicId === "number") ids.push(parsed.publicId);
    } catch {
      // ignore broken entries
    }
  }
  return ids;
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

export function getGuildSummary(internalId: string) {
  const guild = readJson<GuildBoard>(guildKey(internalId));
  if (!guild) return "No guild";
  return `${guild.name} [${formatEntityPublicId("guild", guild.publicId)}]`;
}

export function getConsortiumSummary(internalId: string) {
  const consortium = readJson<ConsortiumBoard>(consortiumKey(internalId));
  if (!consortium) return "No consortium";
  return `${consortium.name} [${formatEntityPublicId("consortium", consortium.publicId)}]`;
}
