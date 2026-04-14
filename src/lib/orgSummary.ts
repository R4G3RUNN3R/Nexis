type GuildMember = {
  publicId: number | null;
  name: string;
  role: string;
};

type GuildBoard = {
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

type ConsortiumEmployee = {
  publicId: number | null;
  name: string;
  role: string;
  efficiency: number;
};

type ConsortiumBoard = {
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

const GUILD_STORAGE_PREFIX = "nexis_guild_board_";
const CONSORTIUM_STORAGE_PREFIX = "nexis_consortium_board_";

function readJson<T>(key: string): T | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

export function readGuildBoard(internalId: string) {
  return readJson<GuildBoard>(`${GUILD_STORAGE_PREFIX}${internalId}`);
}

export function readConsortiumBoard(internalId: string) {
  return readJson<ConsortiumBoard>(`${CONSORTIUM_STORAGE_PREFIX}${internalId}`);
}

export function getOrganizationSummary(internalId: string) {
  return {
    guild: readGuildBoard(internalId),
    consortium: readConsortiumBoard(internalId),
  };
}
