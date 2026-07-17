import { assertAdministrator, assertStaffOrAdmin } from "../lib/adminAccess.js";

export function requireStaffOrAdmin(req, _res, next) {
  try {
    assertStaffOrAdmin(req.auth?.user);
    next();
  } catch (error) {
    next(error);
  }
}

export function requireAdministrator(req, _res, next) {
  try {
    assertAdministrator(req.auth?.user);
    next();
  } catch (error) {
    next(error);
  }
}
