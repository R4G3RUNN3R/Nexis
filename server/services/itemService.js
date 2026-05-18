import { withTransaction } from "../db/pool.js";
import { HttpError } from "../lib/errors.js";
import { buildMutableRuntimeState } from "../lib/runtimePlayerState.js";
import {
  createDefaultPlayerState,
  findPlayerStateByUserInternalId,
  upsertPlayerRuntimeState,
} from "../repositories/playerStateRepository.js";
import {
  EQUIPMENT_SLOTS,
  getAllowedEquipSlots,
  getIconManifest,
  getItemDefinition,
  getItemDefinitions,
  getItemDisplayName,
  getItemSummary,
  isEquippable,
  isUsable,
  summarizeItemEffects,
} from "../data/itemData.js";

function asRecord(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : {};
}

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function asNumber(value, fallback = 0) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : fallback;
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

async function loadRuntimeState(client, user) {
  await createDefaultPlayerState(client, user.internalId);
  const playerState = await findPlayerStateByUserInternalId(client, user.internalId);
  if (!playerState) throw new HttpError(404, "Player state unavailable.", "PLAYER_STATE_NOT_FOUND");
  return { playerState, runtimeState: buildMutableRuntimeState(user, playerState) };
}

function ensureEquipmentState(runtimeState) {
  const player = asRecord(runtimeState.player);
  const existing = asRecord(player.equipment);
  const slots = {};
  for (const slot of EQUIPMENT_SLOTS) {
    const value = existing[slot];
    slots[slot] = typeof value === "string" && value ? value : null;
  }
  player.equipment = slots;
  runtimeState.player = player;
  return slots;
}

function ensureInventory(runtimeState) {
  const player = asRecord(runtimeState.player);
  player.inventory = { ...asRecord(player.inventory) };
  runtimeState.player = player;
  return player.inventory;
}

function addInventory(runtimeState, itemId, quantity = 1) {
  const inventory = ensureInventory(runtimeState);
  const amount = Math.max(1, Math.floor(asNumber(quantity, 1)));
  inventory[itemId] = Math.max(0, Math.floor(asNumber(inventory[itemId], 0) + amount));
}

function removeInventory(runtimeState, itemId, quantity = 1) {
  const inventory = ensureInventory(runtimeState);
  const amount = Math.max(1, Math.floor(asNumber(quantity, 1)));
  const owned = Math.max(0, Math.floor(asNumber(inventory[itemId], 0)));
  if (owned < amount) throw new HttpError(409, `You only have ${owned} ${getItemDisplayName(itemId)}.`, "ITEM_INSUFFICIENT_QUANTITY");
  const next = owned - amount;
  if (next > 0) inventory[itemId] = next;
  else delete inventory[itemId];
}

function addNestedNumber(target, group, key, amount) {
  if (!amount) return;
  target[group] = { ...asRecord(target[group]) };
  target[group][key] = asNumber(target[group][key], 0) + asNumber(amount, 0);
}

function getEquipmentStatTotals(runtimeState) {
  const equipment = ensureEquipmentState(runtimeState);
  const totals = { stats: {}, workingStats: {}, battleStats: {}, combatModifiers: {}, passiveEffects: {} };
  for (const itemId of Object.values(equipment)) {
    if (!itemId) continue;
    const item = getItemDefinition(itemId);
    if (!item) continue;
    for (const [group, values] of Object.entries(asRecord(item.statModifiers))) {
      for (const [key, amount] of Object.entries(asRecord(values))) addNestedNumber(totals, group, key, amount);
    }
    for (const [key, amount] of Object.entries(asRecord(item.combatModifiers))) {
      totals.combatModifiers[key] = asNumber(totals.combatModifiers[key], 0) + asNumber(amount, 0);
    }
    for (const [key, amount] of Object.entries(asRecord(item.passiveEffects))) {
      totals.passiveEffects[key] = asNumber(totals.passiveEffects[key], 0) + asNumber(amount, 0);
    }
  }
  return totals;
}

function serializeEquipment(runtimeState) {
  const equipment = ensureEquipmentState(runtimeState);
  return EQUIPMENT_SLOTS.map((slot) => {
    const itemId = equipment[slot];
    const item = itemId ? getItemSummary(itemId) : null;
    return { slot, itemId, item, effects: item ? summarizeItemEffects(itemId) : [] };
  });
}

function serializeInventory(runtimeState) {
  const inventory = ensureInventory(runtimeState);
  return Object.entries(inventory)
    .map(([itemId, quantity]) => ({ itemId, quantity: Math.max(0, Math.floor(asNumber(quantity, 0))), item: getItemSummary(itemId) }))
    .filter((entry) => entry.quantity > 0)
    .sort((left, right) => (left.item?.category ?? "").localeCompare(right.item?.category ?? "") || (left.item?.displayName ?? left.itemId).localeCompare(right.item?.displayName ?? right.itemId));
}

function serializeItemPayload(playerState, runtimeState, message = null) {
  return {
    playerState,
    inventory: serializeInventory(runtimeState),
    equipment: serializeEquipment(runtimeState),
    equipmentSlots: EQUIPMENT_SLOTS,
    equipmentTotals: getEquipmentStatTotals(runtimeState),
    itemBuffs: asRecord(runtimeState.player?.itemBuffs),
    iconManifest: getIconManifest(),
    catalogueCount: getItemDefinitions().length,
    message,
  };
}

function normalizeEquipSlot(itemId, requestedSlot) {
  const allowed = getAllowedEquipSlots(itemId);
  if (!allowed.length) throw new HttpError(409, `${getItemDisplayName(itemId)} cannot be equipped.`, "ITEM_NOT_EQUIPPABLE");
  if (requestedSlot) {
    if (!allowed.includes(requestedSlot)) throw new HttpError(400, `${getItemDisplayName(itemId)} cannot be equipped in ${requestedSlot}.`, "ITEM_SLOT_INVALID");
    return requestedSlot;
  }
  return allowed[0];
}

function applyUseEffects(runtimeState, item, quantity) {
  const player = asRecord(runtimeState.player);
  player.stats = { ...asRecord(player.stats) };
  player.itemBuffs = { ...asRecord(player.itemBuffs) };
  const messages = [];
  for (let index = 0; index < quantity; index += 1) {
    for (const effect of asArray(item.useEffects)) {
      if (effect.type === "restore_health") {
        const max = Math.max(1, asNumber(player.stats.maxHealth, 100));
        player.stats.health = clamp(asNumber(player.stats.health, max) + asNumber(effect.amount, 0), 1, max);
        messages.push(`Restored ${effect.amount} health.`);
      } else if (effect.type === "restore_stamina") {
        const max = Math.max(1, asNumber(player.stats.maxStamina, 10));
        player.stats.stamina = clamp(asNumber(player.stats.stamina, max) + asNumber(effect.amount, 0), 0, max);
        messages.push(`Restored ${effect.amount} stamina.`);
      } else if (effect.type === "restore_energy") {
        const max = Math.max(1, asNumber(player.stats.maxEnergy, 100));
        player.stats.energy = clamp(asNumber(player.stats.energy, max) + asNumber(effect.amount, 0), 0, max);
        messages.push(`Restored ${effect.amount} energy.`);
      } else if (effect.type === "combat_buff") {
        player.itemBuffs.pendingCombat = {
          itemId: item.id,
          label: item.displayName,
          effect: effect.effect,
          amount: effect.amount,
          uses: Math.max(1, Math.floor(asNumber(effect.uses, 1))),
          primedAt: Date.now(),
        };
        messages.push(`${item.displayName} is primed for your next fight.`);
      }
    }
  }
  player.counters = {
    ...asRecord(player.counters),
    itemsUsed: Math.max(0, Math.floor(asNumber(player.counters?.itemsUsed, 0))) + quantity,
    lastItemUseAt: Date.now(),
  };
  runtimeState.player = player;
  return messages;
}

export async function getItemInventoryForUser(user) {
  return withTransaction(async (client) => {
    const { playerState, runtimeState } = await loadRuntimeState(client, user);
    return serializeItemPayload(playerState, runtimeState);
  });
}

export async function equipItemForUser(user, itemId, requestedSlot = null) {
  return withTransaction(async (client) => {
    const { runtimeState } = await loadRuntimeState(client, user);
    const item = getItemDefinition(itemId);
    if (!item) throw new HttpError(404, "Item not found.", "ITEM_NOT_FOUND");
    if (!isEquippable(itemId)) throw new HttpError(409, `${item.displayName} cannot be equipped.`, "ITEM_NOT_EQUIPPABLE");
    const slot = normalizeEquipSlot(itemId, requestedSlot);
    const equipment = ensureEquipmentState(runtimeState);
    removeInventory(runtimeState, itemId, 1);
    if (equipment[slot]) addInventory(runtimeState, equipment[slot], 1);
    equipment[slot] = itemId;
    runtimeState.player.counters = { ...asRecord(runtimeState.player.counters), equipmentChanges: Math.max(0, Math.floor(asNumber(runtimeState.player.counters?.equipmentChanges, 0))) + 1 };
    const playerState = await upsertPlayerRuntimeState(client, user.internalId, runtimeState);
    return serializeItemPayload(playerState, buildMutableRuntimeState(user, playerState), `Equipped ${item.displayName}.`);
  });
}

export async function unequipItemForUser(user, slot) {
  return withTransaction(async (client) => {
    if (!EQUIPMENT_SLOTS.includes(slot)) throw new HttpError(400, "Equipment slot is invalid.", "ITEM_SLOT_INVALID");
    const { runtimeState } = await loadRuntimeState(client, user);
    const equipment = ensureEquipmentState(runtimeState);
    const itemId = equipment[slot];
    if (!itemId) throw new HttpError(409, "That slot is already empty.", "ITEM_SLOT_EMPTY");
    equipment[slot] = null;
    addInventory(runtimeState, itemId, 1);
    runtimeState.player.counters = { ...asRecord(runtimeState.player.counters), equipmentChanges: Math.max(0, Math.floor(asNumber(runtimeState.player.counters?.equipmentChanges, 0))) + 1 };
    const playerState = await upsertPlayerRuntimeState(client, user.internalId, runtimeState);
    return serializeItemPayload(playerState, buildMutableRuntimeState(user, playerState), `Unequipped ${getItemDisplayName(itemId)}.`);
  });
}

export async function useItemForUser(user, itemId, quantityInput = 1) {
  return withTransaction(async (client) => {
    const quantity = Math.max(1, Math.min(10, Math.floor(asNumber(quantityInput, 1))));
    const { runtimeState } = await loadRuntimeState(client, user);
    const item = getItemDefinition(itemId);
    if (!item) throw new HttpError(404, "Item not found.", "ITEM_NOT_FOUND");
    if (!isUsable(itemId)) throw new HttpError(409, `${item.displayName} is not directly usable.`, "ITEM_NOT_USABLE");
    removeInventory(runtimeState, itemId, quantity);
    const messages = applyUseEffects(runtimeState, item, quantity);
    const playerState = await upsertPlayerRuntimeState(client, user.internalId, runtimeState);
    return serializeItemPayload(playerState, buildMutableRuntimeState(user, playerState), messages.join(" ") || `Used ${item.displayName}.`);
  });
}

export function getEquipmentStatTotalsForRuntimeState(runtimeState) {
  return getEquipmentStatTotals(runtimeState);
}
