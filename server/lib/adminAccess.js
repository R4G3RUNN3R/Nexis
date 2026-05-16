import { HttpError } from "./errors.js";
import { isAdministratorRole, isStaffOrAdminRole, normalizePrivilegeRole } from "./userIdentity.js";

export const ABSOLUTE_OWNER_PUBLIC_ID = 1_000_000;

export function isAbsoluteOwner(publicId) {
  return publicId === ABSOLUTE_OWNER_PUBLIC_ID;
}

export function isAdministrator(user) {
  return isAdministratorRole(normalizePrivilegeRole(user?.privilegeRole, user?.publicId));
}

export function isStaffOrAdmin(user) {
  return isStaffOrAdminRole(normalizePrivilegeRole(user?.privilegeRole, user?.publicId));
}

export function assertStaffOrAdmin(user) {
  if (!isStaffOrAdmin(user)) {
    throw new HttpError(403, "Staff or administrator access required.", "STAFF_REQUIRED");
  }
}

export function assertAdministrator(user) {
  if (!isAdministrator(user)) {
    throw new HttpError(403, "Administrator access required.", "ADMIN_REQUIRED");
  }
}
