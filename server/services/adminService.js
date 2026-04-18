import { withTransaction } from "../db/pool.js";
import { HttpError } from "../lib/errors.js";
import { assertAdministrator } from "../lib/adminAccess.js";
import { assertPrivilegeRole } from "../lib/userIdentity.js";
import { buildAdminPlayerPayload, buildMutableRuntimeState } from "../lib/runtimePlayerState.js";
import { insertAdminAuditLog } from "../repositories/adminAuditRepository.js";
import { createDefaultPlayerState, findPlayerStateByUserInternalId, upsertPlayerRuntimeState } from "../repositories/playerStateRepository.js";
import { findUserByInternalId, findUserByPublicId, searchUsers, updateUserPrivilegeRole } from "../repositories/usersRepository.js";

function asRecord(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : {};
}

function asWholeNumber(value, fallback = 0) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return fallback;
  return Math.max(0, Math.floor(numeric));
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

function applyAdminAction(runtimeState, actionType, payload) {
  const player = { ...runtimeState.player };
  let beforeSummary = {};
  let afterSummary = {};

  switch (actionType) {
    case "fillEnergy":
      beforeSummary = { energy: player.stats.energy, maxEnergy: player.stats.maxEnergy };
      player.stats = { ...player.stats, energy: player.stats.maxEnergy };
      afterSummary = { energy: player.stats.energy, maxEnergy: player.stats.maxEnergy };
      break;
    case "fillStamina":
      beforeSummary = { stamina: player.stats.stamina, maxStamina: player.stats.maxStamina };
      player.stats = { ...player.stats, stamina: player.stats.maxStamina };
      afterSummary = { stamina: player.stats.stamina, maxStamina: player.stats.maxStamina };
      break;
    case "fillHealth":
      beforeSummary = { health: player.stats.health, maxHealth: player.stats.maxHealth };
      player.stats = { ...player.stats, health: player.stats.maxHealth };
      afterSummary = { health: player.stats.health, maxHealth: player.stats.maxHealth };
      break;
    case "fillComfort":
      beforeSummary = { comfort: player.stats.comfort, maxComfort: player.stats.maxComfort };
      player.stats = { ...player.stats, comfort: player.stats.maxComfort };
      afterSummary = { comfort: player.stats.comfort, maxComfort: player.stats.maxComfort };
      break;
    case "fillAllBars":
      beforeSummary = summarizeBars(player.stats);
      player.stats = { ...player.stats, energy: player.stats.maxEnergy, stamina: player.stats.maxStamina, health: player.stats.maxHealth, comfort: player.stats.maxComfort };
      afterSummary = summarizeBars(player.stats);
      break;
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
      beforeSummary = { ...player.currencies };
      player.currencies = {
        copper: asWholeNumber(nextCurrencies.copper, player.currencies.copper),
        silver: asWholeNumber(nextCurrencies.silver, player.currencies.silver),
        gold: asWholeNumber(nextCurrencies.gold, player.currencies.gold),
        platinum: asWholeNumber(nextCurrencies.platinum, player.currencies.platinum),
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
      const quantity = asWholeNumber(payload?.quantity, 0);
      if (!itemId || quantity <= 0) throw new HttpError(400, "Item ID and positive quantity are required.", "INVALID_INVENTORY_UPDATE");
      beforeSummary = { itemId, quantity: player.inventory[itemId] ?? 0 };
      player.inventory = { ...player.inventory, [itemId]: asWholeNumber(player.inventory[itemId], 0) + quantity };
      afterSummary = { itemId, quantity: player.inventory[itemId] };
      break;
    }
    case "removeInventoryItem": {
      const itemId = String(payload?.itemId ?? "").trim();
      const quantity = asWholeNumber(payload?.quantity, 0);
      if (!itemId || quantity <= 0) throw new HttpError(400, "Item ID and positive quantity are required.", "INVALID_INVENTORY_UPDATE");
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
    default:
      throw new HttpError(400, `Unsupported admin action: ${actionType}`, "UNSUPPORTED_ADMIN_ACTION");
  }

  return { runtimeState: { ...runtimeState, player }, beforeSummary, afterSummary };
}

export async function searchAdminPlayers(actorUser, queryText) {
  assertAdministrator(actorUser);
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
  assertAdministrator(actorUser);
  return withTransaction(async (client) => {
    const target = await loadTarget(client, targetInternalId);
    return buildAdminPlayerPayload(target.user, target.playerState);
  });
}

export async function performAdminAction(actorUser, targetInternalId, actionType, payload) {
  assertAdministrator(actorUser);
  const reason = requireReason(payload?.reason);

  return withTransaction(async (client) => {
    const actor = await resolveActorIdentity(client, actorUser);
    const target = await loadTarget(client, targetInternalId);

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

      await insertAdminAuditLog(client, { actor, target: updatedUser, actionType, reason, beforeSummary, afterSummary });

      return {
        target: buildAdminPlayerPayload(updatedUser, updatedPlayerState),
        playerState: updatedPlayerState,
        audit: { actionType, reason, beforeSummary, afterSummary },
      };
    }

    const runtimeState = buildMutableRuntimeState(target.user, target.playerState);
    const { runtimeState: updatedRuntimeState, beforeSummary, afterSummary } = applyAdminAction(runtimeState, actionType, payload);
    const updatedPlayerState = await upsertPlayerRuntimeState(client, target.user.internalId, updatedRuntimeState);

    await insertAdminAuditLog(client, { actor, target: target.user, actionType, reason, beforeSummary, afterSummary });

    return {
      target: buildAdminPlayerPayload(target.user, updatedPlayerState),
      playerState: updatedPlayerState,
      audit: { actionType, reason, beforeSummary, afterSummary },
    };
  });
}
