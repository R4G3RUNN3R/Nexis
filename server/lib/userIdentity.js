import { HttpError } from "./errors.js";

export const ENTITY_TYPES = ["player", "npc", "system", "event"];
export const PRIVILEGE_ROLES = ["player", "staff", "admin"];

const RESERVED_IDENTITY_META = new Map([
  [1_000_000, { displayName: "Hennet Uthellien", entityType: "system", defaultPrivilegeRole: "admin" }],
  [1_000_001, { displayName: "Dianna Uthellien", entityType: "npc", defaultPrivilegeRole: "player" }],
  [1_000_002, { displayName: "Varkon Sternhammer", entityType: "npc", defaultPrivilegeRole: "player" }],
  [1_000_003, { displayName: "Reverend Mother Serana", entityType: "npc", defaultPrivilegeRole: "player" }],
  [1_000_004, { displayName: "Faelar", entityType: "npc", defaultPrivilegeRole: "player" }],
  [1_000_005, { displayName: "Solon Elias", entityType: "npc", defaultPrivilegeRole: "player" }],
  [1_000_006, { displayName: "Nymeria Shadowsong", entityType: "npc", defaultPrivilegeRole: "player" }],
  [1_000_007, { displayName: "CIEL", entityType: "system", defaultPrivilegeRole: "player" }],
  [1_000_008, { displayName: "Santa Claus", entityType: "event", defaultPrivilegeRole: "player" }],
  [1_000_009, { displayName: "Easter Bunny", entityType: "event", defaultPrivilegeRole: "player" }],
  [1_000_010, { displayName: "Shadow Guardian Administrator I", entityType: "system", defaultPrivilegeRole: "admin" }],
  [1_000_011, { displayName: "Shadow Guardian Administrator II", entityType: "system", defaultPrivilegeRole: "admin" }],
  [1_000_012, { displayName: "Shadow Guardian Administrator III", entityType: "system", defaultPrivilegeRole: "admin" }],
  [1_000_013, { displayName: "Shadow Guardian Administrator IV", entityType: "system", defaultPrivilegeRole: "admin" }],
]);

export function getReservedIdentityMeta(publicId) {
  return typeof publicId === "number" ? RESERVED_IDENTITY_META.get(publicId) ?? null : null;
}

export function normalizeEntityType(value, publicId) {
  if (typeof value === "string" && ENTITY_TYPES.includes(value)) {
    return value;
  }

  return getReservedIdentityMeta(publicId)?.entityType ?? "player";
}

export function normalizePrivilegeRole(value, publicId) {
  if (typeof value === "string" && PRIVILEGE_ROLES.includes(value)) {
    return value;
  }

  return getReservedIdentityMeta(publicId)?.defaultPrivilegeRole ?? "player";
}

export function assertPrivilegeRole(value) {
  if (typeof value !== "string" || !PRIVILEGE_ROLES.includes(value)) {
    throw new HttpError(400, "Unsupported privilege role.", "INVALID_PRIVILEGE_ROLE");
  }
  return value;
}

export function isStaffOrAdminRole(role) {
  return role === "staff" || role === "admin";
}

export function isAdministratorRole(role) {
  return role === "admin";
}
