import { withTransaction } from "../db/pool.js";
import { HttpError } from "../lib/errors.js";
import { assertAdministrator, assertStaffOrAdmin, isAdministrator } from "../lib/adminAccess.js";
import { assertAdminActionAllowed } from "../lib/adminActionPolicy.js";
import { assertPrivilegeRole } from "../lib/userIdentity.js";
import { buildAdminPlayerPayload, buildMutableRuntimeState } from "../lib/runtimePlayerState.js";
import { addPlayerExperience } from "./progressionService.js";
import { addPlayerRecord } from "./playerRecordsService.js";
import { insertAdminAuditLog } from "../repositories/adminAuditRepository.js";
import {
  createDefaultPlayerState,
  findPlayerStateByUserInternalId,
  upsertPlayerRuntimeState,
} from "../repositories/playerStateRepository.js";
import {
  findUserByInternalId,
  findUserByPublicId,
  searchUsers,
  updateUserPrivilegeRole,
} from "../repositories/usersRepository.js";

function asRecord(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : {};
}

function asWholeNumber(value, fallback = 0) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return fallback;
  return Math.max(0, Math.floor(numeric));
}

const ADMIN_CURRENCY_CAP = 100_000_000;
const ADMIN_ITEM_QUANTITY_CAP = 10_000;
const ADMIN_ITEM_STACK_CAP = 100_000;

function requireAdminWholeNumber(value, { fieldName, min = 0, max, code = "ADMIN_NUMBER_INVALID" }) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric) || !Number.isInteger(numeric)) {
    throw new HttpError(400, `${fieldName} must be a whole number.`, code);
  }
  if (numeric < min) {
    throw new HttpError(400, `${fieldName} must be at least ${min}.`, code);
  }
  if (typeof max === "number" && numeric > max) {
    throw new HttpError(400, `${fieldName} cannot exceed ${max.toLocaleString("en-GB")}.`, code);
  }
  return numeric;
}

function requireReason(reason) {
  const trimmed = String(reason ?? "").trim();
  if (trimmed.length < 3) {
    throw new HttpError(400, "A short reason is required for admin actions.", "ADMIN_REASON_REQUIRED");
  }
  return trimmed;
}

async function loadTarget(client, targetInternalId) {
  const user = await findUserByInternalId(client, targetInternalId);
  if (!user) throw new HttpError(404, "Target player not found.", "TARGET_NOT_FOUND");
  await createDefaultPlayerState(client, user.internalId);
  const playerState = await findPlayerStateByUserInternalId(client, user.internalId);
  if (!playerState) throw new HttpError(404, "Target player state not found.", "TARGET_STATE_NOT_FOUND");
  return { user, playerState };
}

async function resolveActorIdentity(client, actorUser) {
  const claimedInternalId =
    typeof actorUser?.internalId === "string" && actorUser.internalId
      ? actorUser.internalId
      : typeof actorUser?.internalPlayerId === "string" && actorUser.internalPlayerId
        ? actorUser.internalPlayerId
        : null;

  let actor = claimedInternalId ? await findUserByInternalId(client, claimedInternalId) : null;

  if (!actor && typeof actorUser?.publicId === "number") {
    actor = await findUserByPublicId(client, actorUser.publicId);
  }

  if (!actor) {
    throw new HttpError(
      400,
      "Authenticated administrator is missing a linked player identity.",
      "ADMIN_IDENTITY_MISSING",
    );
  }

  return actor;
}

function normalizeStringArray(value) {
  if (!Array.isArray(value)) return [];
  return Array.from(new Set(value.filter((entry) => typeof entry === "string" && entry.trim()).map((entry) => entry.trim())));
}

function summarizeBars(stats) {
  return {
    energy: `${asWholeNumber(stats.energy)} / ${asWholeNumber(stats.maxEnergy)}`,
    stamina: `${asWholeNumber(stats.stamina)} / ${asWholeNumber(stats.maxStamina)}`,
    health: `${asWholeNumber(stats.health)} / ${asWholeNumber(stats.maxHealth)}`,
    comfort: `${asWholeNumber(stats.comfort)} / ${asWholeNumber(stats.maxComfort)}`,
  };
}
function readBarRevision(player) {
  const counters = asRecord(player?.counters);
  return asWholeNumber(counters.barRevision, 0);
}

function stampBarRecovery(player) {
  const counters = asRecord(player.counters);
  const nextRevision = readBarRevision(player) + 1;
  player.counters = {
    ...counters,
    barRevision: nextRevision,
    lastBarRecoveryAt: Date.now(),
  };
  return nextRevision;
}

function applyAdminAction(runtimeState, actionType, payload) {
  const player = { ...runtimeState.player };
  let beforeSummary = {};
  let afterSummary = {};

  switch (actionType) {
        case "fillEnergy": {
      const currentEnergy = asWholeNumber(player.stats.energy);
      const maxEnergy = asWholeNumber(player.stats.maxEnergy, 100);
      if (currentEnergy >= maxEnergy) {
        throw new HttpError(409, "Energy is already full.", "ADMIN_BAR_ALREADY_FULL");
      }
      beforeSummary = { energy: currentEnergy, maxEnergy, barRevision: readBarRevision(player) };
      player.stats = { ...player.stats, energy: maxEnergy };
      const barRevision = stampBarRecovery(player);
      afterSummary = { energy: asWholeNumber(player.stats.energy), maxEnergy, barRevision };
      break;
    }
    case "fillStamina": {
      const currentStamina = asWholeNumber(player.stats.stamina);
      const maxStamina = asWholeNumber(player.stats.maxStamina, 10);
      if (currentStamina >= maxStamina) {
        throw new HttpError(409, "Stamina is already full.", "ADMIN_BAR_ALREADY_FULL");
      }
      beforeSummary = { stamina: currentStamina, maxStamina, barRevision: readBarRevision(player) };
      player.stats = { ...player.stats, stamina: maxStamina };
      const barRevision = stampBarRecovery(player);
      afterSummary = { stamina: asWholeNumber(player.stats.stamina), maxStamina, barRevision };
      break;
    }
    case "fillHealth": {
      const currentHealth = asWholeNumber(player.stats.health);
      const maxHealth = asWholeNumber(player.stats.maxHealth, 100);
      if (currentHealth >= maxHealth) {
        throw new HttpError(409, "Health is already full.", "ADMIN_BAR_ALREADY_FULL");
      }
      beforeSummary = { health: currentHealth, maxHealth, barRevision: readBarRevision(player) };
      player.stats = { ...player.stats, health: maxHealth };
      const barRevision = stampBarRecovery(player);
      afterSummary = { health: asWholeNumber(player.stats.health), maxHealth, barRevision };
      break;
    }
    case "fillComfort": {
      const currentComfort = asWholeNumber(player.stats.comfort);
      const maxComfort = asWholeNumber(player.stats.maxComfort, 100);
      if (currentComfort >= maxComfort) {
        throw new HttpError(409, "Comfort is already full.", "ADMIN_BAR_ALREADY_FULL");
      }
      beforeSummary = { comfort: currentComfort, maxComfort, barRevision: readBarRevision(player) };
      player.stats = { ...player.stats, comfort: maxComfort };
      const barRevision = stampBarRecovery(player);
      afterSummary = { comfort: asWholeNumber(player.stats.comfort), maxComfort, barRevision };
      break;
    }
    case "fillAllBars": {
      const currentBars = {
        energy: asWholeNumber(player.stats.energy),
        stamina: asWholeNumber(player.stats.stamina),
        health: asWholeNumber(player.stats.health),
        comfort: asWholeNumber(player.stats.comfort),
      };
      const maxBars = {
        energy: asWholeNumber(player.stats.maxEnergy, 100),
        stamina: asWholeNumber(player.stats.maxStamina, 10),
        health: asWholeNumber(player.stats.maxHealth, 100),
        comfort: asWholeNumber(player.stats.maxComfort, 100),
      };
      const alreadyFull =
        currentBars.energy >= maxBars.energy &&
        currentBars.stamina >= maxBars.stamina &&
        currentBars.health >= maxBars.health &&
        currentBars.comfort >= maxBars.comfort;
      if (alreadyFull) {
        throw new HttpError(409, "All recovery bars are already full.", "ADMIN_BAR_ALREADY_FULL");
      }
      beforeSummary = { ...summarizeBars(player.stats), barRevision: readBarRevision(player) };
      player.stats = {
        ...player.stats,
        energy: maxBars.energy,
        stamina: maxBars.stamina,
        health: maxBars.health,
        comfort: maxBars.comfort,
      };
      const barRevision = stampBarRecovery(player);
      afterSummary = { ...summarizeBars(player.stats), barRevision };
      break;
    }
    case "setBattleStats": {
      const nextStats = asRecord(payload?.battleStats);
      beforeSummary = { ...player.battleStats };
      player.battleStats = {
        strength: asWholeNumber(nextStats.strength, player.battleStats.strength),
        defense: asWholeNumber(nextStats.defense, player.battleStats.defense),
        speed: asWholeNumber(nextStats.speed, player.battleStats.speed),
        dexterity: asWholeNumber(nextStats.dexterity, player.battleStats.dexterity),
      };
      afterSummary = { ...player.battleStats };
      break;
    }
    case "setWorkingStats": {
      const nextStats = asRecord(payload?.workingStats);
      beforeSummary = { ...player.workingStats };
      player.workingStats = {
        manualLabor: asWholeNumber(nextStats.manualLabor, player.workingStats.manualLabor),
        intelligence: asWholeNumber(nextStats.intelligence, player.workingStats.intelligence),
        endurance: asWholeNumber(nextStats.endurance, player.workingStats.endurance),
      };
      afterSummary = { ...player.workingStats };
      break;
    }
    case "setCurrencies": {
      const nextCurrencies = asRecord(payload?.currencies);
      const readCurrency = (key) => {
        if (!Object.prototype.hasOwnProperty.call(nextCurrencies, key)) {
          return asWholeNumber(player.currencies[key], 0);
        }
        return requireAdminWholeNumber(nextCurrencies[key], {
          fieldName: `${key} currency`,
          min: 0,
          max: ADMIN_CURRENCY_CAP,
          code: "ADMIN_CURRENCY_INVALID",
        });
      };
      beforeSummary = { ...player.currencies };
      player.currencies = {
        copper: readCurrency("copper"),
        silver: readCurrency("silver"),
        gold: readCurrency("gold"),
        platinum: readCurrency("platinum"),
      };
      player.gold = player.currencies.gold;
      afterSummary = { ...player.currencies };
      break;
    }
    case "setPlayerJob": {
      const nextJob = payload?.job == null ? null : String(payload.job).trim();
      beforeSummary = { currentJob: player.current.job };
      player.current = { ...player.current, job: nextJob || null };
      afterSummary = { currentJob: player.current.job };
      break;
    }
    case "addInventoryItem": {
      const itemId = String(payload?.itemId ?? "").trim();
      const quantity = requireAdminWholeNumber(payload?.quantity, {
        fieldName: "Inventory quantity",
        min: 1,
        max: ADMIN_ITEM_QUANTITY_CAP,
        code: "ADMIN_INVENTORY_QUANTITY_INVALID",
      });
      if (!itemId) throw new HttpError(400, "Item ID and positive quantity are required.", "INVALID_INVENTORY_UPDATE");
      const currentQuantity = asWholeNumber(player.inventory[itemId], 0);
      const nextQuantity = currentQuantity + quantity;
      if (nextQuantity > ADMIN_ITEM_STACK_CAP) {
        throw new HttpError(400, `Inventory stack cannot exceed ${ADMIN_ITEM_STACK_CAP.toLocaleString("en-GB")} per item.`, "ADMIN_INVENTORY_STACK_CAP");
      }
      beforeSummary = { itemId, quantity: currentQuantity };
      player.inventory = { ...player.inventory, [itemId]: nextQuantity };
      afterSummary = { itemId, quantity: player.inventory[itemId] };
      break;
    }
    case "removeInventoryItem": {
      const itemId = String(payload?.itemId ?? "").trim();
      const quantity = requireAdminWholeNumber(payload?.quantity, {
        fieldName: "Inventory quantity",
        min: 1,
        max: ADMIN_ITEM_QUANTITY_CAP,
        code: "ADMIN_INVENTORY_QUANTITY_INVALID",
      });
      if (!itemId) throw new HttpError(400, "Item ID and positive quantity are required.", "INVALID_INVENTORY_UPDATE");
      const currentQuantity = asWholeNumber(player.inventory[itemId], 0);
      beforeSummary = { itemId, quantity: currentQuantity };
      const nextQuantity = Math.max(0, currentQuantity - quantity);
      const nextInventory = { ...player.inventory };
      if (nextQuantity > 0) nextInventory[itemId] = nextQuantity;
      else delete nextInventory[itemId];
      player.inventory = nextInventory;
      if (!nextInventory[itemId]) {
        const nextEnhancements = { ...player.itemEnhancements };
        delete nextEnhancements[itemId];
        player.itemEnhancements = nextEnhancements;
      }
      afterSummary = { itemId, quantity: nextQuantity };
      break;
    }
    case "addItemEnhancement": {
      const itemId = String(payload?.itemId ?? "").trim();
      const enhancement = String(payload?.enhancement ?? "").trim();
      if (!itemId || !enhancement) throw new HttpError(400, "Item ID and enhancement are required.", "INVALID_ENHANCEMENT_UPDATE");
      if (asWholeNumber(player.inventory[itemId], 0) <= 0) throw new HttpError(400, "Target must own the item before enhancing it.", "ITEM_REQUIRED_FOR_ENHANCEMENT");
      const currentEnhancements = normalizeStringArray(player.itemEnhancements[itemId]);
      beforeSummary = { itemId, enhancements: currentEnhancements };
      player.itemEnhancements = { ...player.itemEnhancements, [itemId]: Array.from(new Set([...currentEnhancements, enhancement])) };
      afterSummary = { itemId, enhancements: player.itemEnhancements[itemId] };
      break;
    }
    case "removeItemEnhancement": {
      const itemId = String(payload?.itemId ?? "").trim();
      const enhancement = String(payload?.enhancement ?? "").trim();
      if (!itemId || !enhancement) throw new HttpError(400, "Item ID and enhancement are required.", "INVALID_ENHANCEMENT_UPDATE");
      const currentEnhancements = normalizeStringArray(player.itemEnhancements[itemId]);
      beforeSummary = { itemId, enhancements: currentEnhancements };
      const nextEnhancements = currentEnhancements.filter((entry) => entry !== enhancement);
      player.itemEnhancements = { ...player.itemEnhancements };
      if (nextEnhancements.length) player.itemEnhancements[itemId] = nextEnhancements;
      else delete player.itemEnhancements[itemId];
      afterSummary = { itemId, enhancements: nextEnhancements };
      break;
    }
    case "grantExperience": {
      const amount = requireAdminWholeNumber(payload?.amount, { fieldName: "Experience grant", min: 1, max: 1_000_000, code: "ADMIN_XP_INVALID" });
      beforeSummary = { level: player.level, experience: player.experience, health: player.stats.health, maxHealth: player.stats.maxHealth };
      const result = addPlayerExperience({ ...runtimeState, player }, amount, "admin-grant", { now: Date.now() });
      afterSummary = { level: player.level, experience: player.experience, health: player.stats.health, maxHealth: player.stats.maxHealth, xpGained: result.xpGained, levelUps: result.levelUps };
      break;
    }
    case "setInventoryItemQuantity": {
      const itemId = String(payload?.itemId ?? "").trim();
      const quantity = requireAdminWholeNumber(payload?.quantity, { fieldName: "Inventory quantity", min: 0, max: ADMIN_ITEM_STACK_CAP, code: "ADMIN_INVENTORY_QUANTITY_INVALID" });
      if (!itemId) throw new HttpError(400, "Item ID is required.", "INVALID_INVENTORY_UPDATE");
      beforeSummary = { itemId, quantity: asWholeNumber(player.inventory[itemId], 0) };
      const nextInventory = { ...player.inventory };
      if (quantity > 0) nextInventory[itemId] = quantity;
      else delete nextInventory[itemId];
      player.inventory = nextInventory;
      afterSummary = { itemId, quantity };
      break;
    }
    case "clearEquipmentSlot": {
      const slot = String(payload?.slot ?? "").trim();
      if (!slot) throw new HttpError(400, "Equipment slot is required.", "ADMIN_SLOT_REQUIRED");
      beforeSummary = { slot, itemId: player.equipment?.[slot] ?? null };
      const nextEquipment = { ...asRecord(player.equipment) };
      delete nextEquipment[slot];
      player.equipment = nextEquipment;
      afterSummary = { slot, itemId: null };
      break;
    }
    case "unlockSkill":
    case "instantLearnSkill": {
      const skillId = String(payload?.skillId ?? "").trim();
      if (!skillId) throw new HttpError(400, "Skill ID is required.", "ADMIN_SKILL_REQUIRED");
      const skills = { ...asRecord(player.skills) };
      const unlocked = normalizeStringArray(skills.unlocked);
      const learning = { ...asRecord(skills.learning) };
      beforeSummary = { skillId, unlocked: unlocked.includes(skillId), learning: learning[skillId] ?? null };
      delete learning[skillId];
      skills.unlocked = Array.from(new Set([...unlocked, skillId]));
      skills.learning = learning;
      skills.unlockHistory = [{ skillId, unlockedAt: Date.now(), source: actionType }, ...Array.isArray(skills.unlockHistory) ? skills.unlockHistory : []].slice(0, 80);
      player.skills = skills;
      afterSummary = { skillId, unlocked: true, learning: null };
      break;
    }
    case "revokeSkill": {
      const skillId = String(payload?.skillId ?? "").trim();
      if (!skillId) throw new HttpError(400, "Skill ID is required.", "ADMIN_SKILL_REQUIRED");
      const skills = { ...asRecord(player.skills) };
      beforeSummary = { skillId, unlocked: normalizeStringArray(skills.unlocked).includes(skillId) };
      skills.unlocked = normalizeStringArray(skills.unlocked).filter((entry) => entry !== skillId);
      skills.activeSlots = Array.isArray(skills.activeSlots) ? skills.activeSlots.map((entry) => entry === skillId ? null : entry) : [];
      skills.passiveSlots = Array.isArray(skills.passiveSlots) ? skills.passiveSlots.map((entry) => entry === skillId ? null : entry) : [];
      player.skills = skills;
      afterSummary = { skillId, unlocked: false };
      break;
    }
    case "setSkillUseCount": {
      const skillId = String(payload?.skillId ?? "").trim();
      const uses = requireAdminWholeNumber(payload?.uses, { fieldName: "Skill use count", min: 0, max: 1_000_000, code: "ADMIN_SKILL_USES_INVALID" });
      if (!skillId) throw new HttpError(400, "Skill ID is required.", "ADMIN_SKILL_REQUIRED");
      const skills = { ...asRecord(player.skills), useCounts: { ...asRecord(player.skills?.useCounts) } };
      beforeSummary = { skillId, uses: asWholeNumber(skills.useCounts[skillId], 0) };
      skills.useCounts[skillId] = uses;
      player.skills = skills;
      afterSummary = { skillId, uses };
      break;
    }
    case "slotSkill": {
      const skillId = payload?.skillId == null ? null : String(payload.skillId).trim();
      const slotType = payload?.slotType === "passive" ? "passive" : "active";
      const slotIndex = requireAdminWholeNumber(payload?.slotIndex, { fieldName: "Slot index", min: 0, max: 7, code: "ADMIN_SLOT_INDEX_INVALID" });
      const skills = { ...asRecord(player.skills) };
      const key = slotType === "passive" ? "passiveSlots" : "activeSlots";
      const slots = Array.isArray(skills[key]) ? [...skills[key]] : Array.from({ length: slotType === "passive" ? 2 : 4 }, () => null);
      beforeSummary = { slotType, slotIndex, previous: slots[slotIndex] ?? null };
      while (slots.length <= slotIndex) slots.push(null);
      slots[slotIndex] = skillId || null;
      skills[key] = slots;
      player.skills = skills;
      afterSummary = { slotType, slotIndex, skillId: slots[slotIndex] };
      break;
    }
    case "grantEducationCompletion":
    case "revokeEducationCompletion": {
      const courseId = String(payload?.courseId ?? "").trim();
      if (!courseId) throw new HttpError(400, "Course ID is required.", "ADMIN_COURSE_REQUIRED");
      const education = { ...asRecord(runtimeState.education) };
      const completedCourses = normalizeStringArray(education.completedCourses);
      const completed = { ...asRecord(education.completed) };
      beforeSummary = { courseId, completed: completedCourses.includes(courseId) };
      if (actionType === "grantEducationCompletion") {
        education.completedCourses = Array.from(new Set([...completedCourses, courseId]));
        completed[courseId] = { completed: true, completedAt: Date.now(), adminGranted: true };
      } else {
        education.completedCourses = completedCourses.filter((entry) => entry !== courseId);
        delete completed[courseId];
      }
      education.completed = completed;
      runtimeState.education = education;
      player.current = { ...player.current, education: education.activeCourse ?? null };
      afterSummary = { courseId, completed: actionType === "grantEducationCompletion" };
      break;
    }
    case "cancelEducation": {
      beforeSummary = { activeCourse: asRecord(runtimeState.education).activeCourse ?? player.current.education ?? null };
      runtimeState.education = { ...asRecord(runtimeState.education), activeCourse: null };
      player.current = { ...player.current, education: null };
      afterSummary = { activeCourse: null };
      break;
    }
    case "completeAcademyStage": {
      const academyId = String(payload?.academyId ?? "").trim();
      const stageId = String(payload?.stageId ?? "").trim();
      if (!academyId || !stageId) throw new HttpError(400, "Academy ID and stage ID are required.", "ADMIN_ACADEMY_REQUIRED");
      const academy = { ...asRecord(player.cityAcademy) };
      const completed = { ...asRecord(academy.completed) };
      const stages = normalizeStringArray(completed[academyId]);
      beforeSummary = { academyId, stageId, completed: stages.includes(stageId) };
      completed[academyId] = Array.from(new Set([...stages, stageId]));
      academy.completed = completed;
      academy.history = [{ academyId, stageId, completedAt: Date.now(), adminGranted: true }, ...Array.isArray(academy.history) ? academy.history : []].slice(0, 80);
      player.cityAcademy = academy;
      afterSummary = { academyId, stageId, completed: true };
      break;
    }
    case "resetAcademy": {
      const academyId = String(payload?.academyId ?? "").trim();
      const academy = { ...asRecord(player.cityAcademy) };
      beforeSummary = { academyId: academyId || "all", activeStudy: academy.activeStudy ?? null, completed: academy.completed ?? {} };
      if (academyId) {
        const completed = { ...asRecord(academy.completed) };
        delete completed[academyId];
        academy.completed = completed;
      } else {
        academy.completed = {};
      }
      academy.activeStudy = null;
      player.cityAcademy = academy;
      afterSummary = { academyId: academyId || "all", activeStudy: null, completed: academy.completed };
      break;
    }
    case "clearTravelState": {
      const destination = String(payload?.currentCityId ?? player.current.currentCityId ?? runtimeState.travel?.currentCityId ?? "nexis").trim() || "nexis";
      beforeSummary = { travel: runtimeState.travel, currentCityId: player.current.currentCityId };
      runtimeState.travel = { status: "idle", currentCityId: destination, originCityId: destination, destinationCityId: null, arrivalNotice: null, encounterNotice: null };
      player.current = { ...player.current, travel: runtimeState.travel, currentCityId: destination };
      afterSummary = { travel: runtimeState.travel, currentCityId: destination };
      break;
    }
    case "setCityStanding": {
      const cityId = String(payload?.cityId ?? "").trim();
      const value = requireAdminWholeNumber(payload?.value, { fieldName: "City standing", min: 0, max: 1000, code: "ADMIN_CITY_STANDING_INVALID" });
      if (!cityId) throw new HttpError(400, "City ID is required.", "ADMIN_CITY_REQUIRED");
      const standing = { ...asRecord(player.cityStanding) };
      beforeSummary = { cityId, value: standing[cityId] ?? null };
      standing[cityId] = { value, adjustedAt: Date.now(), adminSet: true };
      player.cityStanding = standing;
      afterSummary = { cityId, value: standing[cityId] };
      break;
    }
    case "clearContractState": {
      const contractId = String(payload?.contractId ?? "").trim();
      const cityContracts = { ...asRecord(player.cityContracts) };
      beforeSummary = { contractId: contractId || "all", cityContracts };
      if (contractId && asRecord(cityContracts.records)[contractId]) {
        cityContracts.records = { ...asRecord(cityContracts.records) };
        delete cityContracts.records[contractId];
      } else if (!contractId) {
        cityContracts.records = {};
      }
      player.cityContracts = cityContracts;
      if (!contractId) player.current = { ...player.current, job: null };
      afterSummary = { contractId: contractId || "all", cityContracts: player.cityContracts };
      break;
    }
    default:
      throw new HttpError(400, `Unsupported admin action: ${actionType}`, "UNSUPPORTED_ADMIN_ACTION");
  }

  return { runtimeState: { ...runtimeState, player }, beforeSummary, afterSummary };
}

export async function searchAdminPlayers(actorUser, queryText) {
  assertStaffOrAdmin(actorUser);
  const searchTerm = String(queryText ?? "").trim();
  if (!searchTerm) return [];

  return withTransaction(async (client) => {
    const users = await searchUsers(client, searchTerm, 20);
    return users.map((user) => ({
      internalId: user.internalId,
      publicId: user.publicId,
      email: user.email,
      displayName: `${user.firstName}${user.lastName ? ` ${user.lastName}` : ""}`.trim(),
      entityType: user.entityType,
      privilegeRole: user.privilegeRole,
    }));
  });
}

export async function getAdminPlayer(actorUser, targetInternalId) {
  assertStaffOrAdmin(actorUser);
  return withTransaction(async (client) => {
    const target = await loadTarget(client, targetInternalId);
    return buildAdminPlayerPayload(target.user, target.playerState);
  });
}

export async function performAdminAction(actorUser, targetInternalId, actionType, payload) {
  assertStaffOrAdmin(actorUser);
  const reason = requireReason(payload?.reason);

  return withTransaction(async (client) => {
    const actor = await resolveActorIdentity(client, actorUser);
    const target = await loadTarget(client, targetInternalId);
    const policy = assertAdminActionAllowed(actor, actionType);

    if (actionType === "setAccountPrivilegeRole") {
      if (actor.internalId === target.user.internalId) {
        throw new HttpError(400, "Administrators cannot change their own privilege role from the panel.", "ADMIN_SELF_ROLE_CHANGE_BLOCKED");
      }

      const nextPrivilegeRole = assertPrivilegeRole(payload?.privilegeRole);
      const beforeSummary = {
        privilegeRole: target.user.privilegeRole,
        entityType: target.user.entityType,
      };
      const updatedUser = await updateUserPrivilegeRole(client, target.user.internalId, nextPrivilegeRole);
      const updatedPlayerState = await findPlayerStateByUserInternalId(client, target.user.internalId);
      const afterSummary = {
        privilegeRole: updatedUser.privilegeRole,
        entityType: updatedUser.entityType,
      };

      await insertAdminAuditLog(client, {
        actor,
        target: updatedUser,
        actionType,
        reason,
        beforeSummary: { ...beforeSummary, category: policy.category, actorRole: actor.privilegeRole },
        afterSummary: { ...afterSummary, category: policy.category, actorRole: actor.privilegeRole },
      });

      return {
        target: buildAdminPlayerPayload(updatedUser, updatedPlayerState),
        playerState: updatedPlayerState,
        audit: { actionType, reason, beforeSummary, afterSummary },
      };
    }

    const runtimeState = buildMutableRuntimeState(target.user, target.playerState);
    const { runtimeState: updatedRuntimeState, beforeSummary, afterSummary } = applyAdminAction(runtimeState, actionType, payload);
    addPlayerRecord(updatedRuntimeState, {
      category: "admin",
      summary: `Admin action ${actionType} applied by ${actor.firstName}${actor.lastName ? ` ${actor.lastName}` : ""}.`,
      detail: { actionType, reason, actorPublicId: actor.publicId, beforeSummary, afterSummary },
      source: "admin-dossier",
      route: "/admin",
    });
    const updatedPlayerState = await upsertPlayerRuntimeState(client, target.user.internalId, updatedRuntimeState);

    await insertAdminAuditLog(client, {
      actor,
      target: target.user,
      actionType,
      reason,
      beforeSummary: { ...beforeSummary, category: policy.category, actorRole: actor.privilegeRole },
      afterSummary: { ...afterSummary, category: policy.category, actorRole: actor.privilegeRole },
    });

    return {
      target: buildAdminPlayerPayload(target.user, updatedPlayerState),
      playerState: updatedPlayerState,
      audit: { actionType, reason, beforeSummary, afterSummary },
    };
  });
}
