export type EntityType = "player" | "npc" | "system" | "event";
export type PrivilegeRole = "player" | "staff" | "admin";

export const ABSOLUTE_OWNER_PUBLIC_ID = 1_000_000;

const RESERVED_PRIVILEGED_PUBLIC_IDS = new Set<number>([
  ABSOLUTE_OWNER_PUBLIC_ID,
  1_000_010,
  1_000_011,
  1_000_012,
  1_000_013,
]);

function readPublicId(input: { publicId?: number | null } | number | null | undefined) {
  if (typeof input === "number") return input;
  if (input && typeof input === "object" && typeof input.publicId === "number") return input.publicId;
  return null;
}

function readPrivilegeRole(input: { privilegeRole?: string | null; publicId?: number | null } | number | null | undefined) {
  if (input && typeof input === "object" && typeof input.privilegeRole === "string") {
    if (input.privilegeRole === "admin" || input.privilegeRole === "staff" || input.privilegeRole === "player") {
      return input.privilegeRole;
    }
  }

  const publicId = readPublicId(input);
  if (typeof publicId === "number" && RESERVED_PRIVILEGED_PUBLIC_IDS.has(publicId)) {
    return "admin";
  }

  return "player";
}

export function isAbsoluteOwner(input: { publicId?: number | null } | number | null | undefined) {
  return readPublicId(input) === ABSOLUTE_OWNER_PUBLIC_ID;
}

export function isAdministrator(input: { privilegeRole?: string | null; publicId?: number | null } | number | null | undefined) {
  return readPrivilegeRole(input) === "admin";
}

export function isStaffOrAdmin(input: { privilegeRole?: string | null; publicId?: number | null } | number | null | undefined) {
  const role = readPrivilegeRole(input);
  return role === "staff" || role === "admin";
}
