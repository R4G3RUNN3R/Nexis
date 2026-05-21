import { withTransaction } from "../db/pool.js";
import { HttpError } from "../lib/errors.js";
import { buildMutableRuntimeState } from "../lib/runtimePlayerState.js";
import {
  createDefaultPlayerState,
  findPlayerStateByUserInternalId,
  upsertPlayerRuntimeState,
} from "../repositories/playerStateRepository.js";
import { findUserByPublicId } from "../repositories/usersRepository.js";
import { addPlayerRecord } from "./playerRecordsService.js";
import {
  ARMOR_REDUCTION_CAP,
  DAMAGE_TYPES,
  EQUIPMENT_SLOTS,
  VISUAL_EQUIPMENT_SLOTS,
  calculateArmorSetBonuses,
  getAllowedEquipSlots,
  getAllowedVisualSlots,
  getIconManifest,
  getItemDefinition,
  getItemDefinitions,
  getItemDisplayName,
  getItemSummary,
  isEquippable,
  isUsable,
  isWearable,
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

function ensureVisualEquipmentState(runtimeState) {
  const player = asRecord(runtimeState.player);
  const existing = asRecord(player.visualEquipment);
  const slots = {};
  for (const slot of VISUAL_EQUIPMENT_SLOTS) {
    const value = existing[slot];
    slots[slot] = typeof value === "string" && value ? value : null;
  }
  player.visualEquipment = slots;
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

function addReduction(totalReductions, type, amount) {
  if (!DAMAGE_TYPES.includes(type)) return;
  totalReductions[type] = Math.min(ARMOR_REDUCTION_CAP, asNumber(totalReductions[type], 0) + asNumber(amount, 0));
}

function addReductionWithSource(totals, type, amount, sourceLabel) {
  if (!DAMAGE_TYPES.includes(type) || !amount) return;
  const before = asNumber(totals.armorReductions[type], 0);
  addReduction(totals.armorReductions, type, amount);
  const applied = asNumber(totals.armorReductions[type], 0) - before;
  if (applied <= 0) return;
  totals.armorReductionSources[type] = asArray(totals.armorReductionSources[type]);
  totals.armorReductionSources[type].push({ source: sourceLabel, amount: applied });
}

function addWeaponStats(totals, item) {
  const weapon = asRecord(item.weaponStats);
  if (!Object.keys(weapon).length) return;
  totals.weaponStats.damageMin = asNumber(totals.weaponStats.damageMin, 0) + asNumber(weapon.damageMin, 0);
  totals.weaponStats.damageMax = asNumber(totals.weaponStats.damageMax, 0) + asNumber(weapon.damageMax, 0);
  totals.weaponStats.accuracyBonus = asNumber(totals.weaponStats.accuracyBonus, 0) + (asNumber(weapon.accuracy, 75) - 75);
  totals.weaponStats.critBonus = asNumber(totals.weaponStats.critBonus, 0) + asNumber(weapon.critBonus, 0);
  totals.weaponStats.penetration = asNumber(totals.weaponStats.penetration, 0) + asNumber(weapon.penetration, 0);
  const type = DAMAGE_TYPES.includes(weapon.damageType) ? weapon.damageType : "Slashing";
  totals.weaponStats.damageTypes[type] = asNumber(totals.weaponStats.damageTypes[type], 0) + 1;
  if (!totals.weaponStats.primaryDamageType) totals.weaponStats.primaryDamageType = type;
}

function getEquipmentStatTotals(runtimeState) {
  const equipment = ensureEquipmentState(runtimeState);
  const totals = { stats: {}, workingStats: {}, battleStats: {}, combatModifiers: {}, passiveEffects: {}, weaponStats: { damageMin: 0, damageMax: 0, accuracyBonus: 0, critBonus: 0, penetration: 0, primaryDamageType: null, damageTypes: {} }, armorReductions: {}, armorReductionSources: {}, armorSets: [] };
  const equippedItemIds = [];
  for (const itemId of Object.values(equipment)) {
    if (!itemId) continue;
    equippedItemIds.push(itemId);
    const item = getItemDefinition(itemId);
    if (!item) continue;
    for (const [group, values] of Object.entries(asRecord(item.statModifiers))) {
      for (const [key, amount] of Object.entries(asRecord(values))) addNestedNumber(totals, group, key, amount);
    }
    for (const [key, amount] of Object.entries(asRecord(item.combatModifiers))) totals.combatModifiers[key] = asNumber(totals.combatModifiers[key], 0) + asNumber(amount, 0);
    for (const [key, amount] of Object.entries(asRecord(item.passiveEffects))) totals.passiveEffects[key] = asNumber(totals.passiveEffects[key], 0) + asNumber(amount, 0);
    addWeaponStats(totals, item);
    for (const [type, amount] of Object.entries(asRecord(item.armorStats?.reductions))) addReductionWithSource(totals, type, amount, getItemDisplayName(item.id));
  }
  const setBonuses = calculateArmorSetBonuses(equippedItemIds);
  for (const activeSet of asArray(setBonuses.activeSets)) {
    for (const bonus of asArray(activeSet.activeBonuses)) {
      for (const [type, amount] of Object.entries(asRecord(bonus.reductions))) addReductionWithSource(totals, type, amount, `${activeSet.name} ${bonus.threshold}-piece`);
    }
  }
  totals.armorSets = asArray(setBonuses.activeSets);
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

function serializeVisualEquipment(runtimeState) {
  const visualEquipment = ensureVisualEquipmentState(runtimeState);
  return VISUAL_EQUIPMENT_SLOTS.map((slot) => {
    const itemId = visualEquipment[slot];
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
    visualEquipment: serializeVisualEquipment(runtimeState),
    equipmentSlots: EQUIPMENT_SLOTS,
    visualSlots: VISUAL_EQUIPMENT_SLOTS,
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

function normalizeVisualSlot(itemId, requestedSlot) {
  const allowed = getAllowedVisualSlots(itemId);
  if (!allowed.length) throw new HttpError(409, `${getItemDisplayName(itemId)} cannot be worn.`, "ITEM_NOT_WEARABLE");
  if (requestedSlot) {
    if (!allowed.includes(requestedSlot)) throw new HttpError(400, `${getItemDisplayName(itemId)} cannot be worn in ${requestedSlot}.`, "ITEM_VISUAL_SLOT_INVALID");
    return requestedSlot;
  }
  return allowed[0];
}

export async function wearItemForUser(user, itemId, requestedSlot = null) {
  return withTransaction(async (client) => {
    const { runtimeState } = await loadRuntimeState(client, user);
    const item = getItemDefinition(itemId);
    if (!item) throw new HttpError(404, "Item not found.", "ITEM_NOT_FOUND");
    if (!isWearable(itemId)) throw new HttpError(409, `${item.displayName} cannot be worn.`, "ITEM_NOT_WEARABLE");
    const slot = normalizeVisualSlot(itemId, requestedSlot);
    const visualEquipment = ensureVisualEquipmentState(runtimeState);
    removeInventory(runtimeState, itemId, 1);
    if (visualEquipment[slot]) addInventory(runtimeState, visualEquipment[slot], 1);
    visualEquipment[slot] = itemId;
    runtimeState.player.counters = { ...asRecord(runtimeState.player.counters), clothingChanges: Math.max(0, Math.floor(asNumber(runtimeState.player.counters?.clothingChanges, 0))) + 1 };
    const playerState = await upsertPlayerRuntimeState(client, user.internalId, runtimeState);
    return serializeItemPayload(playerState, buildMutableRuntimeState(user, playerState), `Wore ${item.displayName}.`);
  });
}

export async function removeWornItemForUser(user, slot) {
  return withTransaction(async (client) => {
    if (!VISUAL_EQUIPMENT_SLOTS.includes(slot)) throw new HttpError(400, "Clothing slot is invalid.", "ITEM_VISUAL_SLOT_INVALID");
    const { runtimeState } = await loadRuntimeState(client, user);
    const visualEquipment = ensureVisualEquipmentState(runtimeState);
    const itemId = visualEquipment[slot];
    if (!itemId) throw new HttpError(409, "That clothing slot is already empty.", "ITEM_VISUAL_SLOT_EMPTY");
    visualEquipment[slot] = null;
    addInventory(runtimeState, itemId, 1);
    runtimeState.player.counters = { ...asRecord(runtimeState.player.counters), clothingChanges: Math.max(0, Math.floor(asNumber(runtimeState.player.counters?.clothingChanges, 0))) + 1 };
    const playerState = await upsertPlayerRuntimeState(client, user.internalId, runtimeState);
    return serializeItemPayload(playerState, buildMutableRuntimeState(user, playerState), `Removed ${getItemDisplayName(itemId)}.`);
  });
}

export async function destroyItemForUser(user, itemId, quantityInput = 1, confirmation = false) {
  return withTransaction(async (client) => {
    const quantity = Math.max(1, Math.min(99, Math.floor(asNumber(quantityInput, 1))));
    const { runtimeState } = await loadRuntimeState(client, user);
    const item = getItemDefinition(itemId);
    if (!item) throw new HttpError(404, "Item not found.", "ITEM_NOT_FOUND");
    if (confirmation !== true && confirmation !== itemId) throw new HttpError(400, `Confirm destruction of ${item.displayName}.`, "ITEM_DESTROY_CONFIRMATION_REQUIRED");
    removeInventory(runtimeState, itemId, quantity);
    runtimeState.player.counters = { ...asRecord(runtimeState.player.counters), itemsDestroyed: Math.max(0, Math.floor(asNumber(runtimeState.player.counters?.itemsDestroyed, 0))) + quantity, lastItemDestroyedAt: Date.now() };
    addPlayerRecord(runtimeState, { category: "inventory", summary: `Destroyed ${item.displayName} x${quantity}.`, detail: { itemId, quantity, rarity: item.rarity }, source: "inventory", route: "/inventory", timestamp: Date.now() });
    const playerState = await upsertPlayerRuntimeState(client, user.internalId, runtimeState);
    return serializeItemPayload(playerState, buildMutableRuntimeState(user, playerState), `Destroyed ${item.displayName} x${quantity}.`);
  });
}

export async function sendItemForUser(user, itemId, targetPublicIdInput, quantityInput = 1) {
  return withTransaction(async (client) => {
    const quantity = Math.max(1, Math.min(99, Math.floor(asNumber(quantityInput, 1))));
    const item = getItemDefinition(itemId);
    if (!item) throw new HttpError(404, "Item not found.", "ITEM_NOT_FOUND");
    const match = /^P?(\d{7})$/i.exec(String(targetPublicIdInput ?? "").trim());
    if (!match) throw new HttpError(400, "Enter a valid public player ID such as P1000001.", "ITEM_SEND_TARGET_INVALID");
    const targetPublicId = Number.parseInt(match[1], 10);
    if (targetPublicId === user.publicId) throw new HttpError(409, "You cannot send an item to yourself.", "ITEM_SEND_SELF");
    const targetUser = await findUserByPublicId(client, targetPublicId);
    if (!targetUser) throw new HttpError(404, "Recipient not found.", "ITEM_SEND_TARGET_NOT_FOUND");
    const { runtimeState: senderState } = await loadRuntimeState(client, user);
    const { runtimeState: targetState } = await loadRuntimeState(client, targetUser);
    removeInventory(senderState, itemId, quantity);
    addInventory(targetState, itemId, quantity);
    const now = Date.now();
    addPlayerRecord(senderState, { category: "inventory", summary: `Sent ${item.displayName} x${quantity} to P${targetPublicId}.`, detail: { itemId, quantity, targetPublicId }, source: "inventory", route: "/inventory", timestamp: now });
    addPlayerRecord(targetState, { category: "inventory", summary: `Received ${item.displayName} x${quantity} from P${user.publicId}.`, detail: { itemId, quantity, senderPublicId: user.publicId }, source: "inventory", route: "/inventory", timestamp: now });
    await upsertPlayerRuntimeState(client, targetUser.internalId, targetState);
    const playerState = await upsertPlayerRuntimeState(client, user.internalId, senderState);
    return serializeItemPayload(playerState, buildMutableRuntimeState(user, playerState), `Sent ${item.displayName} x${quantity} to P${targetPublicId}.`);
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
