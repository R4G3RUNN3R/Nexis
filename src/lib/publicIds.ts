const PUBLIC_ID_DIGITS = 7;
const RESERVED_ID_COUNT = 20;
const PUBLIC_ID_BASE = 1_000_000;
const FIRST_NON_RESERVED_ID = PUBLIC_ID_BASE + RESERVED_ID_COUNT;

const PLAYER_ALLOCATOR_KEY = "nexis_public_id_allocator_player";
const GUILD_ALLOCATOR_KEY = "nexis_public_id_allocator_guild";
const CONSORTIUM_ALLOCATOR_KEY = "nexis_public_id_allocator_consortium";
const INTERNAL_PLAYER_ALLOCATOR_KEY = "nexis_internal_player_allocator";

export const PLAYER_PUBLIC_ID_PREFIX = "P";
export const GUILD_PUBLIC_ID_PREFIX = "G";
export const CONSORTIUM_PUBLIC_ID_PREFIX = "C";

export type PublicEntityType = "player" | "guild" | "consortium";

export type ReservedPublicIdentity = {
  numericId: number;
  displayId: string;
  name: string;
  entityType: "npc" | "system" | "event";
  defaultPrivilegeRole: "player" | "staff" | "admin";
  note?: string;
};

export type AccountIdentityRecord = {
  email: string;
  createdAt: number;
  publicId?: number | null;
  internalPlayerId?: string | null;
};

type AllocatorState = {
  nextNumericId: number;
};

type InternalAllocatorState = {
  nextInternalSequence: number;
};

const ENTITY_CONFIG: Record<PublicEntityType, { prefix: string; storageKey: string }> = {
  player: { prefix: PLAYER_PUBLIC_ID_PREFIX, storageKey: PLAYER_ALLOCATOR_KEY },
  guild: { prefix: GUILD_PUBLIC_ID_PREFIX, storageKey: GUILD_ALLOCATOR_KEY },
  consortium: { prefix: CONSORTIUM_PUBLIC_ID_PREFIX, storageKey: CONSORTIUM_ALLOCATOR_KEY },
};

export const RESERVED_PLAYER_IDENTITIES: ReservedPublicIdentity[] = [
  { numericId: 1_000_000, displayId: "P1000000", name: "Hennet Uthellien", entityType: "system", defaultPrivilegeRole: "admin", note: "Administrator account" },
  { numericId: 1_000_001, displayId: "P1000001", name: "Dianna Uthellien", entityType: "npc", defaultPrivilegeRole: "player" },
  { numericId: 1_000_002, displayId: "P1000002", name: "Varkon Sternhammer", entityType: "npc", defaultPrivilegeRole: "player" },
  { numericId: 1_000_003, displayId: "P1000003", name: "Reverend Mother Serana", entityType: "npc", defaultPrivilegeRole: "player" },
  { numericId: 1_000_004, displayId: "P1000004", name: "Faelar", entityType: "npc", defaultPrivilegeRole: "player" },
  { numericId: 1_000_005, displayId: "P1000005", name: "Solon Elias", entityType: "npc", defaultPrivilegeRole: "player" },
  { numericId: 1_000_006, displayId: "P1000006", name: "Nymeria Shadowsong", entityType: "npc", defaultPrivilegeRole: "player" },
  { numericId: 1_000_007, displayId: "P1000007", name: "CIEL", entityType: "system", defaultPrivilegeRole: "player" },
  { numericId: 1_000_008, displayId: "P1000008", name: "Santa Claus", entityType: "event", defaultPrivilegeRole: "player" },
  { numericId: 1_000_009, displayId: "P1000009", name: "Easter Bunny", entityType: "event", defaultPrivilegeRole: "player" },
  { numericId: 1_000_010, displayId: "P1000010", name: "Shadow Guardian Administrator I", entityType: "system", defaultPrivilegeRole: "admin", note: "Reserved administrator command identity" },
  { numericId: 1_000_011, displayId: "P1000011", name: "Shadow Guardian Administrator II", entityType: "system", defaultPrivilegeRole: "admin", note: "Reserved administrator command identity" },
  { numericId: 1_000_012, displayId: "P1000012", name: "Shadow Guardian Administrator III", entityType: "system", defaultPrivilegeRole: "admin", note: "Reserved administrator command identity" },
  { numericId: 1_000_013, displayId: "P1000013", name: "Shadow Guardian Administrator IV", entityType: "system", defaultPrivilegeRole: "admin", note: "Reserved administrator command identity" },
];

export function getReservedPlayerIdentity(numericId: number | null | undefined) {
  return typeof numericId === "number" ? RESERVED_PLAYER_IDENTITIES.find((identity) => identity.numericId === numericId) ?? null : null;
}

function readAllocator(entity: PublicEntityType): AllocatorState {
  if (typeof window === "undefined") {
    return { nextNumericId: FIRST_NON_RESERVED_ID };
  }

  try {
    const raw = window.localStorage.getItem(ENTITY_CONFIG[entity].storageKey);
    if (!raw) return { nextNumericId: FIRST_NON_RESERVED_ID };

    const parsed = JSON.parse(raw) as Partial<AllocatorState>;
    return {
      nextNumericId:
        typeof parsed.nextNumericId === "number" && Number.isInteger(parsed.nextNumericId)
          ? Math.max(FIRST_NON_RESERVED_ID, parsed.nextNumericId)
          : FIRST_NON_RESERVED_ID,
    };
  } catch {
    return { nextNumericId: FIRST_NON_RESERVED_ID };
  }
}

function writeAllocator(entity: PublicEntityType, state: AllocatorState) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(ENTITY_CONFIG[entity].storageKey, JSON.stringify(state));
}

function readInternalAllocator(): InternalAllocatorState {
  if (typeof window === "undefined") {
    return { nextInternalSequence: 1 };
  }

  try {
    const raw = window.localStorage.getItem(INTERNAL_PLAYER_ALLOCATOR_KEY);
    if (!raw) return { nextInternalSequence: 1 };

    const parsed = JSON.parse(raw) as Partial<InternalAllocatorState>;
    return {
      nextInternalSequence:
        typeof parsed.nextInternalSequence === "number" && Number.isInteger(parsed.nextInternalSequence)
          ? Math.max(1, parsed.nextInternalSequence)
          : 1,
    };
  } catch {
    return { nextInternalSequence: 1 };
  }
}

function writeInternalAllocator(state: InternalAllocatorState) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(INTERNAL_PLAYER_ALLOCATOR_KEY, JSON.stringify(state));
}

function getReservedNumericIds() {
  const reserved = new Set<number>();
  for (let offset = 0; offset < RESERVED_ID_COUNT; offset += 1) {
    reserved.add(PUBLIC_ID_BASE + offset);
  }
  return reserved;
}

function parseInternalSequence(internalPlayerId: string) {
  const match = /^plr_(\d+)$/.exec(internalPlayerId);
  return match ? Number.parseInt(match[1], 10) : 0;
}

function formatInternalPlayerId(sequence: number) {
  return `plr_${String(sequence).padStart(6, "0")}`;
}

function isUsablePlayerNumericId(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value) && value >= FIRST_NON_RESERVED_ID;
}

function isUsableInternalPlayerId(value: unknown): value is string {
  return typeof value === "string" && /^plr_\d+$/.test(value);
}

function sortedAccounts<T extends AccountIdentityRecord>(accounts: Record<string, T>) {
  return Object.entries(accounts).sort(([, left], [, right]) => {
    const leftCreated = typeof left.createdAt === "number" ? left.createdAt : 0;
    const rightCreated = typeof right.createdAt === "number" ? right.createdAt : 0;
    if (leftCreated !== rightCreated) return leftCreated - rightCreated;
    return left.email.localeCompare(right.email);
  });
}

export function formatEntityPublicId(entity: PublicEntityType, numericId: number | null | undefined) {
  if (typeof numericId !== "number" || !Number.isInteger(numericId) || numericId <= 0) {
    return "Pending";
  }

  return `${ENTITY_CONFIG[entity].prefix}${String(numericId).padStart(PUBLIC_ID_DIGITS, "0")}`;
}

export function formatPlayerPublicId(numericId: number | null | undefined) {
  return formatEntityPublicId("player", numericId);
}

export function formatPlayerNameWithPublicId(name: string, numericId: number | null | undefined) {
  const trimmed = name.trim();
  const displayName = trimmed || "Unknown";
  const formatted = formatPlayerPublicId(numericId);
  return formatted === "Pending" ? displayName : `${displayName} [${formatted}]`;
}

export function parsePlayerPublicId(raw: string | undefined) {
  if (!raw || !/^P\d{7}$/.test(raw)) return null;
  const parsed = Number.parseInt(raw.slice(1), 10);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
}

export function getProfileRoute(publicId: number | null | undefined) {
  return isUsablePlayerNumericId(publicId) ? `/profile/${formatPlayerPublicId(publicId)}` : "/profile";
}

export function allocatePublicNumericId(entity: PublicEntityType, existingNumericIds: Iterable<number>) {
  const used = new Set<number>(getReservedNumericIds());
  for (const numericId of existingNumericIds) {
    if (Number.isInteger(numericId) && numericId >= FIRST_NON_RESERVED_ID) {
      used.add(numericId);
    }
  }

  const allocator = readAllocator(entity);
  let candidate = Math.max(FIRST_NON_RESERVED_ID, allocator.nextNumericId);
  while (used.has(candidate)) candidate += 1;

  writeAllocator(entity, { nextNumericId: candidate + 1 });
  return candidate;
}

export function allocatePlayerIdentity(existingAccounts: Iterable<AccountIdentityRecord>) {
  const existingPublicIds: number[] = [];
  const existingInternalIds = new Set<string>();

  for (const account of existingAccounts) {
    if (isUsablePlayerNumericId(account.publicId)) existingPublicIds.push(account.publicId);
    if (isUsableInternalPlayerId(account.internalPlayerId)) existingInternalIds.add(account.internalPlayerId);
  }

  const publicId = allocatePublicNumericId("player", existingPublicIds);

  const allocator = readInternalAllocator();
  let sequence = Math.max(
    1,
    allocator.nextInternalSequence,
    ...Array.from(existingInternalIds.values()).map((value) => parseInternalSequence(value) + 1),
  );
  let internalPlayerId = formatInternalPlayerId(sequence);
  while (existingInternalIds.has(internalPlayerId)) {
    sequence += 1;
    internalPlayerId = formatInternalPlayerId(sequence);
  }

  writeInternalAllocator({ nextInternalSequence: sequence + 1 });

  return { publicId, internalPlayerId };
}

export function migrateStoredAccountIdentities<T extends AccountIdentityRecord>(
  accounts: Record<string, T>,
): {
  accounts: Record<string, T & { publicId: number; internalPlayerId: string }>;
  changed: boolean;
} {
  const usedPublicIds = new Set<number>(getReservedNumericIds());
  const usedInternalIds = new Set<string>();
  const migrated = {} as Record<string, T & { publicId: number; internalPlayerId: string }>;
  let changed = false;

  for (const [email, account] of sortedAccounts(accounts)) {
    const keepPublicId =
      isUsablePlayerNumericId(account.publicId) && !usedPublicIds.has(account.publicId)
        ? account.publicId
        : null;
    const keepInternalId =
      isUsableInternalPlayerId(account.internalPlayerId) && !usedInternalIds.has(account.internalPlayerId)
        ? account.internalPlayerId
        : null;

    if (keepPublicId !== null) usedPublicIds.add(keepPublicId);
    if (keepInternalId !== null) usedInternalIds.add(keepInternalId);
    if (keepPublicId === null || keepInternalId === null) changed = true;

    migrated[email] = {
      ...account,
      publicId: keepPublicId ?? 0,
      internalPlayerId: keepInternalId ?? "",
    };
  }

  const playerAllocator = readAllocator("player");
  const internalAllocator = readInternalAllocator();

  let nextPublicId = Math.max(
    FIRST_NON_RESERVED_ID,
    playerAllocator.nextNumericId,
    ...Array.from(usedPublicIds.values()).map((value) => value + 1),
  );
  while (usedPublicIds.has(nextPublicId)) nextPublicId += 1;

  let nextInternalSequence = Math.max(
    1,
    internalAllocator.nextInternalSequence,
    ...Array.from(usedInternalIds.values()).map((value) => parseInternalSequence(value) + 1),
  );

  for (const [email] of sortedAccounts(accounts)) {
    if (!isUsablePlayerNumericId(migrated[email].publicId)) {
      while (usedPublicIds.has(nextPublicId)) nextPublicId += 1;
      migrated[email].publicId = nextPublicId;
      usedPublicIds.add(nextPublicId);
      nextPublicId += 1;
    }

    if (!isUsableInternalPlayerId(migrated[email].internalPlayerId)) {
      let candidate = formatInternalPlayerId(nextInternalSequence);
      while (usedInternalIds.has(candidate)) {
        nextInternalSequence += 1;
        candidate = formatInternalPlayerId(nextInternalSequence);
      }
      migrated[email].internalPlayerId = candidate;
      usedInternalIds.add(candidate);
      nextInternalSequence += 1;
    }
  }

  const finalNextPublicId = Math.max(FIRST_NON_RESERVED_ID, nextPublicId);
  const finalNextInternalSequence = Math.max(1, nextInternalSequence);

  if (playerAllocator.nextNumericId !== finalNextPublicId) {
    changed = true;
    writeAllocator("player", { nextNumericId: finalNextPublicId });
  }

  if (internalAllocator.nextInternalSequence !== finalNextInternalSequence) {
    changed = true;
    writeInternalAllocator({ nextInternalSequence: finalNextInternalSequence });
  }

  return { accounts: migrated, changed };
}
