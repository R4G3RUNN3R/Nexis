import { HttpError } from "./errors.js";
import { isAdministrator, isStaffOrAdmin } from "./adminAccess.js";

export const ADMIN_ACTION_POLICIES = {
  fillEnergy: {
    category: "player-safe support action",
    minimumRole: "staff",
    label: "Fill Energy",
  },
  fillStamina: {
    category: "player-safe support action",
    minimumRole: "staff",
    label: "Fill Stamina",
  },
  fillHealth: {
    category: "player-safe support action",
    minimumRole: "staff",
    label: "Fill Health",
  },
  fillComfort: {
    category: "player-safe support action",
    minimumRole: "staff",
    label: "Fill Comfort",
  },
  fillAllBars: {
    category: "player-safe support action",
    minimumRole: "staff",
    label: "Fill All Bars",
  },
  setBattleStats: {
    category: "sensitive economy/progression action",
    minimumRole: "admin",
    label: "Set Battle Stats",
  },
  setWorkingStats: {
    category: "sensitive economy/progression action",
    minimumRole: "admin",
    label: "Set Working Stats",
  },
  setCurrencies: {
    category: "sensitive economy/progression action",
    minimumRole: "admin",
    label: "Set Currencies",
  },
  setPlayerJob: {
    category: "sensitive economy/progression action",
    minimumRole: "admin",
    label: "Set Player Job",
  },
  addInventoryItem: {
    category: "sensitive economy/progression action",
    minimumRole: "admin",
    label: "Add Inventory Item",
  },
  removeInventoryItem: {
    category: "sensitive economy/progression action",
    minimumRole: "admin",
    label: "Remove Inventory Item",
  },
  addItemEnhancement: {
    category: "sensitive economy/progression action",
    minimumRole: "admin",
    label: "Add Item Enhancement",
  },
  removeItemEnhancement: {
    category: "sensitive economy/progression action",
    minimumRole: "admin",
    label: "Remove Item Enhancement",
  },
  setAccountPrivilegeRole: {
    category: "account/privilege action",
    minimumRole: "admin",
    label: "Set Account Privilege Role",
  },
};

export function getAdminActionPolicy(actionType) {
  return ADMIN_ACTION_POLICIES[actionType] ?? null;
}

export function assertAdminActionAllowed(actorUser, actionType) {
  const policy = getAdminActionPolicy(actionType);
  if (!policy) {
    throw new HttpError(400, `Unsupported admin action: ${actionType}`, "UNSUPPORTED_ADMIN_ACTION");
  }

  if (policy.minimumRole === "admin") {
    if (!isAdministrator(actorUser)) {
      throw new HttpError(403, "Administrator access required.", "ADMIN_REQUIRED");
    }
    return policy;
  }

  if (!isStaffOrAdmin(actorUser)) {
    throw new HttpError(403, "Staff or administrator access required.", "STAFF_REQUIRED");
  }

  return policy;
}
