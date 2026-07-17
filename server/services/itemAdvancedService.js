import { withTransaction } from "../db/pool.js";
import { HttpError } from "../lib/errors.js";
import { buildMutableRuntimeState } from "../lib/runtimePlayerState.js";
import {
  createDefaultPlayerState,
  findPlayerStateByUserInternalId,
  upsertPlayerRuntimeState,
} from "../repositories/playerStateRepository.js";
import { getCityDefinition, normalizeCityId } from "../data/cityData.js";
import { getRecipeDefinition, getRecipeDefinitions } from "../data/recipeData.js";
import { EQUIPMENT_SLOTS, getAllowedEquipSlots, getItemDefinition, getItemDisplayName, getItemSummary, isEquippable } from "../data/itemData.js";
import { rollLoot, rollSalvageGold } from "../data/lootData.js";
import { addPlayerRecord } from "./playerRecordsService.js";
import { evaluateLegacyAchievementsForRuntime } from "./achievementService.js";
import { getConsortiumEffectPctForRuntime } from "./consortiumPerkService.js";
import { getRecipeDiscoveryStatus } from "./excursionService.js";

const LOADOUT_SLOTS = ["1", "2", "3"];
const MAINTENANCE_DURATION_MS = 6 * 60 * 60 * 1000;

// Salvage Yard: one button, one random eligible item consumed, one random reward roll. No per-item
// selection -- see salvageItemForUser() below.
const SALVAGE_ENERGY_COST = 5;
const SALVAGE_REWARD_CATEGORIES = ["Salvaged materials", "Minor gold", "Rare component chance"];

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

async function loadRuntimeState(client, user) {
  await createDefaultPlayerState(client, user.internalId);
  const playerState = await findPlayerStateByUserInternalId(client, user.internalId);
  if (!playerState) throw new HttpError(404, "Player state unavailable.", "PLAYER_STATE_NOT_FOUND");
  return { playerState, runtimeState: buildMutableRuntimeState(user, playerState) };
}

function ensureInventory(runtimeState) {
  const player = asRecord(runtimeState.player);
  player.inventory = { ...asRecord(player.inventory) };
  runtimeState.player = player;
  return player.inventory;
}

function ensureStats(runtimeState) {
  const player = asRecord(runtimeState.player);
  player.stats = { ...asRecord(player.stats) };
  runtimeState.player = player;
  return player.stats;
}

function ensureEquipment(runtimeState) {
  const player = asRecord(runtimeState.player);
  const current = asRecord(player.equipment);
  const next = {};
  for (const slot of EQUIPMENT_SLOTS) next[slot] = typeof current[slot] === "string" && current[slot] ? current[slot] : null;
  player.equipment = next;
  runtimeState.player = player;
  return next;
}

function ensureMaintenance(runtimeState) {
  const player = asRecord(runtimeState.player);
  player.equipmentMaintenance = { ...asRecord(player.equipmentMaintenance) };
  runtimeState.player = player;
  return player.equipmentMaintenance;
}

function ensureCrafting(runtimeState) {
  const player = asRecord(runtimeState.player);
  const existing = asRecord(player.crafting);
  player.crafting = {
    ...existing,
    craftedCounts: { ...asRecord(existing.craftedCounts) },
    history: asArray(existing.history),
    salvagedCounts: { ...asRecord(existing.salvagedCounts) },
    repairs: asArray(existing.repairs),
  };
  runtimeState.player = player;
  return player.crafting;
}

function ensureLoadouts(runtimeState) {
  const player = asRecord(runtimeState.player);
  const existing = asRecord(player.equipmentLoadouts);
  const presets = { ...asRecord(existing.presets) };
  for (const slot of LOADOUT_SLOTS) {
    const current = asRecord(presets[slot]);
    presets[slot] = {
      slot,
      label: typeof current.label === "string" && current.label.trim() ? current.label.trim().slice(0, 32) : `Loadout ${slot}`,
      equipment: { ...asRecord(current.equipment) },
      savedAt: typeof current.savedAt === "number" ? current.savedAt : null,
    };
  }
  player.equipmentLoadouts = { ...existing, presets, activeSlot: LOADOUT_SLOTS.includes(existing.activeSlot) ? existing.activeSlot : null };
  runtimeState.player = player;
  return player.equipmentLoadouts;
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

function getCurrentCityId(runtimeState) {
  const travel = asRecord(runtimeState.travel);
  const current = asRecord(runtimeState.player?.current);
  return normalizeCityId(travel.currentCityId ?? current.currentCityId, "nexis");
}

function isInTransit(runtimeState) {
  return asRecord(runtimeState.travel).status === "in_transit";
}

function getStanding(runtimeState, cityId) {
  const standing = asRecord(asRecord(runtimeState.player).cityStanding);
  const record = asRecord(standing[normalizeCityId(cityId)]);
  return Math.max(0, Math.floor(asNumber(record.value, record.standing ?? 0)));
}

function getCompletedCourses(runtimeState) {
  const education = asRecord(runtimeState.education);
  const completedCourses = asArray(education.completedCourses).filter((entry) => typeof entry === "string");
  const legacyCompleted = Object.entries(asRecord(education.completed)).filter(([, value]) => value === true || asRecord(value).completed === true).map(([courseId]) => courseId);
  return Array.from(new Set([...completedCourses, ...legacyCompleted]));
}

function getAcademyUnlocks(runtimeState) {
  return asArray(asRecord(runtimeState.player?.cityAcademy).unlocks).filter((entry) => typeof entry === "string");
}

function serializeItemRequirement(runtimeState, entry) {
  const owned = Math.max(0, Math.floor(asNumber(asRecord(runtimeState.player?.inventory)[entry.itemId], 0)));
  return { itemId: entry.itemId, item: getItemSummary(entry.itemId), quantity: entry.quantity, owned, missing: Math.max(0, entry.quantity - owned) };
}

// A Smithing or Alchemy Consortium's Industrial Rhythm / Reagent Efficiency passive discounts the
// gold side of every recipe, regardless of category -- both industries share the same workbench.
function getRecipeGoldCost(runtimeState, recipe) {
  const discountPct = getConsortiumEffectPctForRuntime(runtimeState, "craftGoldDiscountPct");
  return Math.max(0, Math.round(asNumber(recipe.goldCost, 0) * (1 - Math.max(0, discountPct) / 100)));
}

function getRecipeLocks(runtimeState, recipe) {
  const reasons = [];
  const currentCityId = getCurrentCityId(runtimeState);
  const city = getCityDefinition(recipe.cityId);
  if (isInTransit(runtimeState)) reasons.push("Finish current travel before crafting.");
  if (currentCityId !== normalizeCityId(recipe.cityId)) reasons.push(`Travel to ${city.name} to craft this recipe.`);
  const standing = getStanding(runtimeState, recipe.cityId);
  if (standing < recipe.minimumStanding) reasons.push(`Requires ${recipe.minimumStanding} ${city.name} standing. Current standing: ${standing}.`);
  const discovery = getRecipeDiscoveryStatus(runtimeState, recipe);
  if (recipe.discoveryOnly && !discovery.discovered) reasons.push(discovery.lockReason ?? "Recipe has not been discovered through excursions yet.");
  const completed = new Set(getCompletedCourses(runtimeState));
  const missingCourses = recipe.requiredCourses.filter((courseId) => !completed.has(courseId));
  if (missingCourses.length) reasons.push(`Requires ${missingCourses.join(", ")}.`);
  const unlocks = new Set(getAcademyUnlocks(runtimeState));
  const missingUnlocks = recipe.requiredAcademyUnlocks.filter((flag) => !unlocks.has(flag));
  if (missingUnlocks.length) reasons.push(recipe.unlockHint ?? `Requires academy unlock: ${missingUnlocks.join(", ")}.`);
  const gold = Math.max(0, Math.floor(asNumber(runtimeState.player?.gold, 0)));
  const goldCost = getRecipeGoldCost(runtimeState, recipe);
  if (gold < goldCost) reasons.push(`Requires ${goldCost} gold. Current gold: ${gold}.`);
  for (const input of recipe.inputs) {
    const owned = Math.max(0, Math.floor(asNumber(asRecord(runtimeState.player?.inventory)[input.itemId], 0)));
    if (owned < input.quantity) reasons.push(`Requires ${getItemDisplayName(input.itemId)} x${input.quantity}. Owned: ${owned}.`);
  }
  return reasons;
}

function serializeRecipe(runtimeState, recipe) {
  const reasons = getRecipeLocks(runtimeState, recipe);
  return {
    ...recipe,
    goldCost: getRecipeGoldCost(runtimeState, recipe),
    baseGoldCost: recipe.goldCost,
    city: { id: recipe.cityId, name: getCityDefinition(recipe.cityId).name },
    inputs: recipe.inputs.map((entry) => serializeItemRequirement(runtimeState, entry)),
    outputs: recipe.outputs.map((entry) => ({ ...entry, item: getItemSummary(entry.itemId) })),
    currentCityId: getCurrentCityId(runtimeState),
    canCraft: reasons.length === 0,
    lockReason: reasons[0] ?? null,
    rarity: recipe.rarity ?? "common",
    discoveryOnly: Boolean(recipe.discoveryOnly),
    discovery: getRecipeDiscoveryStatus(runtimeState, recipe),
    discoveryHint: recipe.discoveryHint ?? null,
    discoverySources: recipe.discoverySources ?? [],
  };
}

function removeSelfYield(itemId, yieldItems) {
  return yieldItems.filter((entry) => entry.itemId !== itemId);
}

function getSalvageYield(itemId) {
  const item = getItemDefinition(itemId);
  if (!item) return [];
  let yieldItems = [];
  if (item.category === "Equipment") {
    if (item.cityBias === "ironhall") yieldItems = [{ itemId: "scrap_metal", quantity: 2 }, { itemId: "iron_rivets", quantity: 1 }];
    else if (item.cityBias === "silverbough") yieldItems = [{ itemId: "arcane_ink", quantity: 1 }, { itemId: "rough_wood", quantity: 1 }];
    else if (item.cityBias === "highcourt") yieldItems = [{ itemId: "vial_of_ink", quantity: 1 }, { itemId: "scrap_metal", quantity: 1 }];
    else yieldItems = [{ itemId: "scrap_metal", quantity: 1 }, { itemId: "rough_wood", quantity: 1 }];
  } else if (item.category === "Tool") {
    yieldItems = [{ itemId: "rough_wood", quantity: 1 }, { itemId: "scrap_metal", quantity: 1 }];
  } else if (item.category === "Trade Good") {
    if (itemId === "wax_seal") yieldItems = [{ itemId: "vial_of_ink", quantity: 1 }];
    else if (itemId === "vial_of_ink") yieldItems = [{ itemId: "empty_vials", quantity: 1 }];
    else if (item.cityBias === "ironhall") yieldItems = [{ itemId: "scrap_metal", quantity: 1 }];
    else if (item.cityBias === "silverbough") yieldItems = [{ itemId: "empty_vials", quantity: 1 }];
    else if (item.cityBias === "highcourt") yieldItems = [{ itemId: "vial_of_ink", quantity: 1 }];
    else yieldItems = [{ itemId: "rough_wood", quantity: 1 }];
  } else if (item.category === "Loot") {
    yieldItems = [{ itemId: item.cityBias === "silverbough" ? "ward_shard" : "scrap_metal", quantity: 1 }];
  } else if (item.category === "Black Market") {
    yieldItems = [{ itemId: "empty_vials", quantity: 1 }, { itemId: "rough_wood", quantity: 1 }];
  }
  const safeYield = removeSelfYield(itemId, yieldItems);
  if (safeYield.length) return safeYield;
  if (itemId !== "rough_wood") return [{ itemId: "rough_wood", quantity: 1 }];
  return itemId !== "scrap_metal" ? [{ itemId: "scrap_metal", quantity: 1 }] : [];
}

// getSalvageYield() above is kept as the salvage-eligibility oracle: an item is "junk the yard will
// take" exactly when it would have produced a non-empty deterministic yield under the old system.
// That's the pool the server now picks randomly from -- the player no longer chooses which member
// of it gets broken down, and the actual reward is rolled from the shared salvage loot table instead
// of this function's per-item table (see salvageItemForUser()).
function isSalvageEligible(itemId) {
  return getSalvageYield(itemId).length > 0;
}

function getEligibleSalvageItemIds(runtimeState) {
  const inventory = asRecord(runtimeState.player?.inventory);
  return Object.entries(inventory)
    .filter(([itemId, quantity]) => asNumber(quantity, 0) > 0 && isSalvageEligible(itemId))
    .map(([itemId]) => itemId);
}

function serializeSalvageStatus(runtimeState) {
  const stats = ensureStats(runtimeState);
  const energy = Math.max(0, Math.floor(asNumber(stats.energy, 0)));
  const eligibleItemIds = getEligibleSalvageItemIds(runtimeState);
  const reasons = [];
  if (energy < SALVAGE_ENERGY_COST) reasons.push(`Requires ${SALVAGE_ENERGY_COST} energy. Current energy: ${energy}.`);
  if (!eligibleItemIds.length) reasons.push("No salvage-eligible items in inventory.");
  return {
    energyCost: SALVAGE_ENERGY_COST,
    energy,
    eligibleCount: eligibleItemIds.length,
    canSalvage: reasons.length === 0,
    lockReason: reasons[0] ?? null,
    rewardCategories: SALVAGE_REWARD_CATEGORIES,
  };
}

const BASE_REPAIR_FALLBACK_GOLD = 20;

// A Smithing Consortium's Masterwork Discipline passive discounts the gold half of the Iron Rivets
// fallback repair (the Field Repair Kit path is item-only and unaffected).
function getRepairFallbackGoldCost(runtimeState) {
  const discountPct = getConsortiumEffectPctForRuntime(runtimeState, "repairGoldDiscountPct");
  return Math.max(0, Math.round(BASE_REPAIR_FALLBACK_GOLD * (1 - Math.max(0, discountPct) / 100)));
}

function serializeRepairOption(runtimeState, slot, now = Date.now()) {
  const equipment = ensureEquipment(runtimeState);
  const itemId = equipment[slot];
  const inventory = ensureInventory(runtimeState);
  const maintenance = asRecord(ensureMaintenance(runtimeState)[slot]);
  const maintained = itemId && maintenance.itemId === itemId && asNumber(maintenance.bonusUntil, 0) > now;
  const hasKit = asNumber(inventory.field_repair_kit, 0) > 0;
  const fallbackGoldCost = getRepairFallbackGoldCost(runtimeState);
  const hasFallback = asNumber(inventory.iron_rivets, 0) > 0 && asNumber(runtimeState.player?.gold, 0) >= fallbackGoldCost;
  const reasons = [];
  if (!itemId) reasons.push("No equipment in this slot.");
  if (maintained) reasons.push("This item is already maintained.");
  if (itemId && !hasKit && !hasFallback) reasons.push(`Requires Field Repair Kit, or Iron Rivets x1 plus ${fallbackGoldCost} gold.`);
  return {
    slot,
    itemId,
    item: itemId ? getItemSummary(itemId) : null,
    maintained: Boolean(maintained),
    bonusUntil: maintained ? maintenance.bonusUntil : null,
    canRepair: reasons.length === 0,
    lockReason: reasons[0] ?? null,
    cost: hasKit ? { items: [{ itemId: "field_repair_kit", quantity: 1 }], gold: 0 } : { items: [{ itemId: "iron_rivets", quantity: 1 }], gold: fallbackGoldCost },
  };
}

function serializeLoadouts(runtimeState) {
  const loadouts = ensureLoadouts(runtimeState);
  return LOADOUT_SLOTS.map((slot) => {
    const preset = loadouts.presets[slot];
    return {
      slot,
      label: preset.label,
      savedAt: preset.savedAt,
      active: loadouts.activeSlot === slot,
      equipment: EQUIPMENT_SLOTS.map((equipSlot) => {
        const itemId = typeof preset.equipment[equipSlot] === "string" ? preset.equipment[equipSlot] : null;
        return { slot: equipSlot, itemId, item: itemId ? getItemSummary(itemId) : null };
      }),
    };
  });
}

function serializeCraftingPayload(playerState, runtimeState, message = null) {
  const now = Date.now();
  ensureInventory(runtimeState);
  return {
    playerState,
    currentCityId: getCurrentCityId(runtimeState),
    currentCityName: getCityDefinition(getCurrentCityId(runtimeState)).name,
    recipes: getRecipeDefinitions().map((recipe) => serializeRecipe(runtimeState, recipe)),
    salvageStatus: serializeSalvageStatus(runtimeState),
    repairOptions: EQUIPMENT_SLOTS.map((slot) => serializeRepairOption(runtimeState, slot, now)).filter((entry) => entry.itemId),
    loadouts: serializeLoadouts(runtimeState),
    message,
  };
}

export async function getCraftingForUser(user) {
  return withTransaction(async (client) => {
    const { playerState, runtimeState } = await loadRuntimeState(client, user);
    return serializeCraftingPayload(playerState, runtimeState);
  });
}

export async function craftRecipeForUser(user, recipeId) {
  return withTransaction(async (client) => {
    const { runtimeState } = await loadRuntimeState(client, user);
    const recipe = getRecipeDefinition(recipeId);
    if (!recipe) throw new HttpError(404, "Recipe not found.", "CRAFTING_RECIPE_NOT_FOUND");
    const serialized = serializeRecipe(runtimeState, recipe);
    if (!serialized.canCraft) throw new HttpError(409, serialized.lockReason ?? "Recipe is locked.", "CRAFTING_RECIPE_LOCKED");
    for (const input of recipe.inputs) removeInventory(runtimeState, input.itemId, input.quantity);
    for (const output of recipe.outputs) addInventory(runtimeState, output.itemId, output.quantity);
    const gold = Math.max(0, Math.floor(asNumber(runtimeState.player.gold, 0) - getRecipeGoldCost(runtimeState, recipe)));
    runtimeState.player.gold = gold;
    runtimeState.player.currencies = { ...asRecord(runtimeState.player.currencies), gold };
    const crafting = ensureCrafting(runtimeState);
    crafting.craftedCounts[recipe.id] = Math.max(0, Math.floor(asNumber(crafting.craftedCounts[recipe.id], 0))) + 1;
    crafting.history = [{ id: `craft_${recipe.id}_${Date.now()}`, recipeId: recipe.id, title: recipe.title, outputs: recipe.outputs, craftedAt: Date.now() }, ...crafting.history].slice(0, 40);
    runtimeState.player.counters = { ...asRecord(runtimeState.player.counters), itemsCrafted: Math.max(0, Math.floor(asNumber(runtimeState.player.counters?.itemsCrafted, 0))) + 1 };
    addPlayerRecord(runtimeState, { category: "crafting", summary: `Crafted ${recipe.title}.`, detail: { recipeId: recipe.id, outputs: recipe.outputs }, source: "crafting", route: "/crafting", timestamp: Date.now() });
    evaluateLegacyAchievementsForRuntime(runtimeState, user);
    const playerState = await upsertPlayerRuntimeState(client, user.internalId, runtimeState);
    return serializeCraftingPayload(playerState, buildMutableRuntimeState(user, playerState), `${recipe.title} crafted.`);
  });
}

// "Salvage Scrap": one button, 5 energy, no item picker. The server -- not the client -- chooses
// which eligible inventory item is consumed and rolls the reward, all inside one transaction so
// energy deduction, item consumption, and the reward grant either all land or all roll back.
export async function salvageItemForUser(user) {
  return withTransaction(async (client) => {
    const { runtimeState } = await loadRuntimeState(client, user);

    const stats = ensureStats(runtimeState);
    const energy = Math.max(0, Math.floor(asNumber(stats.energy, 0)));
    if (energy < SALVAGE_ENERGY_COST) {
      throw new HttpError(409, `You need ${SALVAGE_ENERGY_COST} energy to salvage scrap. Current energy: ${energy}.`, "SALVAGE_ENERGY_REQUIRED");
    }

    const eligibleItemIds = getEligibleSalvageItemIds(runtimeState);
    if (!eligibleItemIds.length) {
      throw new HttpError(409, "No salvage-eligible items in inventory.", "ITEM_SALVAGE_BLOCKED");
    }
    // Random pick from the eligible pool -- the player never chooses which item breaks down.
    const itemId = eligibleItemIds[Math.floor(Math.random() * eligibleItemIds.length)];

    stats.energy = energy - SALVAGE_ENERGY_COST;
    removeInventory(runtimeState, itemId, 1);

    // Reward roll reuses the shared rollLoot() weighted-table pattern from lootData.js -- the same
    // one combatService/adventureService use for NPC and adventure loot -- rather than a bespoke
    // randomization path. "No item salvages into itself" is preserved by stripping the consumed
    // item out of the roll and guaranteeing a fallback drop if that empties the result.
    let rewardItems = rollLoot("salvage", Math.random).filter((drop) => drop.itemId !== itemId);
    if (!rewardItems.length) {
      const fallbackId = itemId === "rough_wood" ? "scrap_metal" : "rough_wood";
      rewardItems = [{ itemId: fallbackId, label: getItemDisplayName(fallbackId), quantity: 1 }];
    }
    for (const item of rewardItems) addInventory(runtimeState, item.itemId, item.quantity);

    const goldReward = rollSalvageGold(Math.random);
    if (goldReward > 0) {
      const gold = Math.max(0, Math.floor(asNumber(runtimeState.player.gold, 0) + goldReward));
      runtimeState.player.gold = gold;
      runtimeState.player.currencies = { ...asRecord(runtimeState.player.currencies), gold };
    }

    const crafting = ensureCrafting(runtimeState);
    crafting.salvagedCounts[itemId] = Math.max(0, Math.floor(asNumber(crafting.salvagedCounts[itemId], 0))) + 1;
    runtimeState.player.counters = {
      ...asRecord(runtimeState.player.counters),
      itemsSalvaged: Math.max(0, Math.floor(asNumber(runtimeState.player.counters?.itemsSalvaged, 0))) + 1,
      salvageEnergySpent: Math.max(0, Math.floor(asNumber(runtimeState.player.counters?.salvageEnergySpent, 0))) + SALVAGE_ENERGY_COST,
    };

    const summary = [
      rewardItems.map((entry) => `${getItemDisplayName(entry.itemId)} x${entry.quantity}`).join(", "),
      goldReward > 0 ? `${goldReward} gold` : null,
    ].filter(Boolean).join(", ");
    addPlayerRecord(runtimeState, {
      category: "crafting",
      summary: `Salvaged ${getItemDisplayName(itemId)} into ${summary}.`,
      detail: { itemId, rewardItems: rewardItems.map((entry) => ({ itemId: entry.itemId, quantity: entry.quantity })), gold: goldReward, energySpent: SALVAGE_ENERGY_COST },
      source: "salvage",
      route: "/crafting",
      timestamp: Date.now(),
    });
    evaluateLegacyAchievementsForRuntime(runtimeState, user);
    const playerState = await upsertPlayerRuntimeState(client, user.internalId, runtimeState);
    return serializeCraftingPayload(playerState, buildMutableRuntimeState(user, playerState), `Salvaged ${getItemDisplayName(itemId)} into ${summary}.`);
  });
}

export async function repairEquipmentForUser(user, slot) {
  return withTransaction(async (client) => {
    if (!EQUIPMENT_SLOTS.includes(slot)) throw new HttpError(400, "Equipment slot is invalid.", "ITEM_SLOT_INVALID");
    const { runtimeState } = await loadRuntimeState(client, user);
    const option = serializeRepairOption(runtimeState, slot);
    if (!option.canRepair) throw new HttpError(409, option.lockReason ?? "Equipment cannot be repaired.", "ITEM_REPAIR_BLOCKED");
    const costItem = option.cost.items[0];
    removeInventory(runtimeState, costItem.itemId, costItem.quantity);
    if (option.cost.gold > 0) {
      const gold = Math.max(0, Math.floor(asNumber(runtimeState.player.gold, 0) - option.cost.gold));
      runtimeState.player.gold = gold;
      runtimeState.player.currencies = { ...asRecord(runtimeState.player.currencies), gold };
    }
    const now = Date.now();
    ensureMaintenance(runtimeState)[slot] = { itemId: option.itemId, repairedAt: now, bonusUntil: now + MAINTENANCE_DURATION_MS };
    const crafting = ensureCrafting(runtimeState);
    crafting.repairs = [{ slot, itemId: option.itemId, repairedAt: now }, ...crafting.repairs].slice(0, 30);
    const playerState = await upsertPlayerRuntimeState(client, user.internalId, runtimeState);
    return serializeCraftingPayload(playerState, buildMutableRuntimeState(user, playerState), `${getItemDisplayName(option.itemId)} maintained for 6 hours.`);
  });
}

function normalizeLoadoutSlot(slot) {
  const text = String(slot ?? "").trim();
  if (!LOADOUT_SLOTS.includes(text)) throw new HttpError(400, "Loadout slot must be 1, 2, or 3.", "LOADOUT_SLOT_INVALID");
  return text;
}

export async function getLoadoutsForUser(user) {
  return withTransaction(async (client) => {
    const { playerState, runtimeState } = await loadRuntimeState(client, user);
    return { playerState, loadouts: serializeLoadouts(runtimeState), message: null };
  });
}

export async function saveLoadoutForUser(user, slotInput, labelInput = null) {
  return withTransaction(async (client) => {
    const slot = normalizeLoadoutSlot(slotInput);
    const { runtimeState } = await loadRuntimeState(client, user);
    const loadouts = ensureLoadouts(runtimeState);
    const equipment = ensureEquipment(runtimeState);
    loadouts.presets[slot] = {
      slot,
      label: typeof labelInput === "string" && labelInput.trim() ? labelInput.trim().slice(0, 32) : loadouts.presets[slot].label,
      equipment: { ...equipment },
      savedAt: Date.now(),
    };
    loadouts.activeSlot = slot;
    const playerState = await upsertPlayerRuntimeState(client, user.internalId, runtimeState);
    return { playerState, loadouts: serializeLoadouts(buildMutableRuntimeState(user, playerState)), message: `Saved current gear to ${loadouts.presets[slot].label}.` };
  });
}

export async function equipLoadoutForUser(user, slotInput) {
  return withTransaction(async (client) => {
    const slot = normalizeLoadoutSlot(slotInput);
    const { runtimeState } = await loadRuntimeState(client, user);
    const loadouts = ensureLoadouts(runtimeState);
    const preset = loadouts.presets[slot];
    if (!preset?.savedAt) throw new HttpError(409, "Save gear to this loadout before equipping it.", "LOADOUT_EMPTY");
    const currentEquipment = ensureEquipment(runtimeState);
    const inventory = ensureInventory(runtimeState);
    const available = { ...inventory };
    for (const itemId of Object.values(currentEquipment)) {
      if (itemId) available[itemId] = Math.max(0, Math.floor(asNumber(available[itemId], 0) + 1));
    }
    const desired = {};
    for (const equipSlot of EQUIPMENT_SLOTS) {
      const itemId = typeof preset.equipment[equipSlot] === "string" ? preset.equipment[equipSlot] : null;
      if (!itemId) {
        desired[equipSlot] = null;
        continue;
      }
      if (!isEquippable(itemId) || !getAllowedEquipSlots(itemId).includes(equipSlot)) throw new HttpError(409, `${getItemDisplayName(itemId)} no longer fits ${equipSlot}.`, "LOADOUT_ITEM_INVALID");
      desired[equipSlot] = itemId;
    }
    const needed = {};
    for (const itemId of Object.values(desired)) if (itemId) needed[itemId] = Math.max(0, Math.floor(asNumber(needed[itemId], 0) + 1));
    for (const [itemId, quantity] of Object.entries(needed)) {
      if (Math.floor(asNumber(available[itemId], 0)) < quantity) throw new HttpError(409, `Missing ${getItemDisplayName(itemId)} for this loadout.`, "LOADOUT_ITEM_MISSING");
    }
    const nextInventory = { ...available };
    for (const [itemId, quantity] of Object.entries(needed)) {
      const next = Math.max(0, Math.floor(asNumber(nextInventory[itemId], 0) - quantity));
      if (next > 0) nextInventory[itemId] = next;
      else delete nextInventory[itemId];
    }
    runtimeState.player.inventory = nextInventory;
    runtimeState.player.equipment = desired;
    loadouts.activeSlot = slot;
    const playerState = await upsertPlayerRuntimeState(client, user.internalId, runtimeState);
    return { playerState, loadouts: serializeLoadouts(buildMutableRuntimeState(user, playerState)), message: `${preset.label} equipped.` };
  });
}

export function getMaintenanceCombatBonus(runtimeState) {
  const now = Date.now();
  const equipment = ensureEquipment(runtimeState);
  const maintenance = ensureMaintenance(runtimeState);
  const bonus = { accuracyBonus: 0, mitigationBonus: 0 };
  for (const [slot, itemId] of Object.entries(equipment)) {
    const record = asRecord(maintenance[slot]);
    if (itemId && record.itemId === itemId && asNumber(record.bonusUntil, 0) > now) {
      bonus.accuracyBonus += 1;
      bonus.mitigationBonus += 0.01;
    }
  }
  return bonus;
}
