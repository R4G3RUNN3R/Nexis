export type AdminActionCategory =
  | "player-safe support action"
  | "sensitive economy/progression action"
  | "account/privilege action";

export type AdminActionType =
  | "fillEnergy"
  | "fillStamina"
  | "fillHealth"
  | "fillComfort"
  | "fillAllBars"
  | "setBattleStats"
  | "setWorkingStats"
  | "setCurrencies"
  | "setPlayerJob"
  | "addInventoryItem"
  | "removeInventoryItem"
  | "addItemEnhancement"
  | "removeItemEnhancement"
  | "setAccountPrivilegeRole";

export type AdminActionMinimumRole = "staff" | "admin";

export type AdminActionPolicy = {
  category: AdminActionCategory;
  minimumRole: AdminActionMinimumRole;
  label: string;
};

export const ADMIN_ACTION_POLICIES: Record<AdminActionType, AdminActionPolicy> = {
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

export function isAdminOnlyAction(actionType: AdminActionType) {
  return ADMIN_ACTION_POLICIES[actionType].minimumRole === "admin";
}
