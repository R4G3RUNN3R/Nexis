export type AdminActionCategory =
  | "player-safe support action"
  | "sensitive economy/progression action"
  | "sensitive progression action"
  | "sensitive inventory action"
  | "sensitive gear action"
  | "sensitive skill action"
  | "sensitive education action"
  | "sensitive academy action"
  | "sensitive travel action"
  | "sensitive organization action"
  | "sensitive contract action"
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
  | "setAccountPrivilegeRole"
  | "grantExperience"
  | "setInventoryItemQuantity"
  | "clearEquipmentSlot"
  | "unlockSkill"
  | "revokeSkill"
  | "instantLearnSkill"
  | "setSkillUseCount"
  | "slotSkill"
  | "grantEducationCompletion"
  | "revokeEducationCompletion"
  | "cancelEducation"
  | "completeAcademyStage"
  | "resetAcademy"
  | "clearTravelState"
  | "setCityStanding"
  | "clearContractState";

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
  grantExperience: { category: "sensitive progression action", minimumRole: "admin", label: "Grant Experience" },
  setInventoryItemQuantity: { category: "sensitive inventory action", minimumRole: "admin", label: "Set Inventory Quantity" },
  clearEquipmentSlot: { category: "sensitive gear action", minimumRole: "admin", label: "Clear Equipment Slot" },
  unlockSkill: { category: "sensitive skill action", minimumRole: "admin", label: "Unlock Skill" },
  revokeSkill: { category: "sensitive skill action", minimumRole: "admin", label: "Revoke Skill" },
  instantLearnSkill: { category: "sensitive skill action", minimumRole: "admin", label: "Instant Learn Skill" },
  setSkillUseCount: { category: "sensitive skill action", minimumRole: "admin", label: "Set Skill Use Count" },
  slotSkill: { category: "sensitive skill action", minimumRole: "admin", label: "Slot Skill" },
  grantEducationCompletion: { category: "sensitive education action", minimumRole: "admin", label: "Grant Education Completion" },
  revokeEducationCompletion: { category: "sensitive education action", minimumRole: "admin", label: "Revoke Education Completion" },
  cancelEducation: { category: "sensitive education action", minimumRole: "admin", label: "Cancel Education" },
  completeAcademyStage: { category: "sensitive academy action", minimumRole: "admin", label: "Complete Academy Stage" },
  resetAcademy: { category: "sensitive academy action", minimumRole: "admin", label: "Reset Academy Line" },
  clearTravelState: { category: "sensitive travel action", minimumRole: "admin", label: "Clear Travel State" },
  setCityStanding: { category: "sensitive organization action", minimumRole: "admin", label: "Set City Standing" },
  clearContractState: { category: "sensitive contract action", minimumRole: "admin", label: "Clear Contract State" },
};

export function isAdminOnlyAction(actionType: AdminActionType) {
  return ADMIN_ACTION_POLICIES[actionType].minimumRole === "admin";
}
