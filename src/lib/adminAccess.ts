export const ABSOLUTE_OWNER_PUBLIC_ID = 1_000_000;

const ADMIN_RESERVED_PUBLIC_IDS = new Set<number>([
  ABSOLUTE_OWNER_PUBLIC_ID,
  1_000_010,
  1_000_011,
  1_000_012,
  1_000_013,
]);

export type PrivilegeRole = "player" | "staff" | "admin";

export function isAbsoluteOwner(publicId: number | null | undefined) {
  return publicId === ABSOLUTE_OWNER_PUBLIC_ID;
}

export function isAdministratorRole(role: PrivilegeRole | null | undefined) {
  return role === "admin";
}

export function isStaffOrAdminRole(role: PrivilegeRole | null | undefined) {
  return role === "staff" || role === "admin";
}

export function isAdministrator(
  publicIdOrOptions: number | null | undefined | { publicId?: number | null; privilegeRole?: PrivilegeRole | null },
  privilegeRole?: PrivilegeRole | null,
) {
  if (typeof publicIdOrOptions === "object" && publicIdOrOptions !== null) {
    if (typeof publicIdOrOptions.privilegeRole === "string") {
      return isAdministratorRole(publicIdOrOptions.privilegeRole);
    }

    return typeof publicIdOrOptions.publicId === "number"
      && ADMIN_RESERVED_PUBLIC_IDS.has(publicIdOrOptions.publicId);
  }

  if (typeof privilegeRole === "string") {
    return isAdministratorRole(privilegeRole);
  }

  return typeof publicIdOrOptions === "number" && ADMIN_RESERVED_PUBLIC_IDS.has(publicIdOrOptions);
}

export function isStaffOrAdmin(
  publicIdOrOptions: number | null | undefined | { publicId?: number | null; privilegeRole?: PrivilegeRole | null },
  privilegeRole?: PrivilegeRole | null,
) {
  if (typeof publicIdOrOptions === "object" && publicIdOrOptions !== null) {
    if (typeof publicIdOrOptions.privilegeRole === "string") {
      return isStaffOrAdminRole(publicIdOrOptions.privilegeRole);
    }

    return typeof publicIdOrOptions.publicId === "number"
      && ADMIN_RESERVED_PUBLIC_IDS.has(publicIdOrOptions.publicId);
  }

  if (typeof privilegeRole === "string") {
    return isStaffOrAdminRole(privilegeRole);
  }

  return typeof publicIdOrOptions === "number" && ADMIN_RESERVED_PUBLIC_IDS.has(publicIdOrOptions);
}
