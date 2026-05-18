import { withTransaction } from "../db/pool.js";
import { HttpError } from "../lib/errors.js";
import { buildMutableRuntimeState } from "../lib/runtimePlayerState.js";
import {
  createDefaultPlayerState,
  findPlayerStateByUserInternalId,
  upsertPlayerRuntimeState,
} from "../repositories/playerStateRepository.js";
import { getCityDefinition, isValidCityId, normalizeCityId } from "../data/cityData.js";
import {
  getCityBlackMarket,
  getCityMarketProfile,
  getCitySpecialById,
  getCitySpecials,
} from "../data/cityEconomyData.js";
import { resolveTravelForRuntimeState } from "./travelService.js";

const MAX_PURCHASE_QUANTITY = 99;
const CITY_STANDING_TIERS = [
  { value: 0, label: "New Arrival" },
  { value: 2, label: "Known Hand" },
  { value: 4, label: "Trusted Local" },
  { value: 8, label: "City Fixture" },
];

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

function getStandingTier(value) {
  const standing = Math.max(0, Math.floor(asNumber(value, 0)));
  let current = CITY_STANDING_TIERS[0];
  let next = null;
  for (const tier of CITY_STANDING_TIERS) {
    if (standing >= tier.value) current = tier;
    else if (!next) next = tier;
  }
  return { current, next };
}

function cloneTravelState(runtimeState) {
  const travel = asRecord(runtimeState.travel);
  const currentCityId = normalizeCityId(travel.currentCityId, "nexis");
  return {
    status: travel.status === "in_transit" ? "in_transit" : "idle",
    currentCityId,
  };
}

function getCurrentCityId(runtimeState) {
  const travel = cloneTravelState(runtimeState);
  const current = asRecord(runtimeState.player?.current);
  return normalizeCityId(travel.currentCityId ?? current.currentCityId, "nexis");
}

function isInTransit(runtimeState) {
  return cloneTravelState(runtimeState).status === "in_transit";
}

function ensureCityStandingState(runtimeState) {
  const player = asRecord(runtimeState.player);
  const standing = asRecord(player.cityStanding);
  player.cityStanding = { ...standing };
  runtimeState.player = player;
  return player.cityStanding;
}

function getCityStanding(runtimeState, cityId) {
  const normalizedCityId = normalizeCityId(cityId);
  const standingState = ensureCityStandingState(runtimeState);
  const existing = asRecord(standingState[normalizedCityId]);
  const value = Math.max(0, Math.floor(asNumber(existing.value, existing.standing ?? 0)));
  const tiers = getStandingTier(value);
  return {
    cityId: normalizedCityId,
    value,
    tier: tiers.current.label,
    nextTierAt: tiers.next?.value ?? null,
    nextTierLabel: tiers.next?.label ?? null,
    contractCompletions: Math.max(0, Math.floor(asNumber(existing.contractCompletions, 0))),
    academyStagesCompleted: Math.max(0, Math.floor(asNumber(existing.academyStagesCompleted, 0))),
    specialUses: Math.max(0, Math.floor(asNumber(existing.specialUses, 0))),
    updatedAt: typeof existing.updatedAt === "number" ? existing.updatedAt : null,
  };
}

function setCityStanding(runtimeState, cityId, standingRecord) {
  const standingState = ensureCityStandingState(runtimeState);
  standingState[normalizeCityId(cityId)] = { ...standingRecord };
}

function addCityStanding(runtimeState, cityId, amount, now) {
  if (!amount) return getCityStanding(runtimeState, cityId);
  const current = getCityStanding(runtimeState, cityId);
  const next = {
    ...current,
    value: Math.max(0, Math.floor(current.value + asNumber(amount, 0))),
    specialUses: current.specialUses + 1,
    updatedAt: now,
  };
  const tier = getStandingTier(next.value);
  next.tier = tier.current.label;
  next.nextTierAt = tier.next?.value ?? null;
  next.nextTierLabel = tier.next?.label ?? null;
  setCityStanding(runtimeState, cityId, next);
  return next;
}

function getCompletedCourses(runtimeState) {
  const education = asRecord(runtimeState.education);
  const completedCourses = asArray(education.completedCourses).filter((entry) => typeof entry === "string");
  const legacyCompleted = Object.entries(asRecord(education.completed))
    .filter(([, value]) => value === true || asRecord(value).completed === true)
    .map(([courseId]) => courseId);
  return Array.from(new Set([...completedCourses, ...legacyCompleted]));
}

function getMissingCourses(runtimeState, requiredCourses = []) {
  const completed = new Set(getCompletedCourses(runtimeState));
  return requiredCourses.filter((courseId) => !completed.has(courseId));
}

function addLegacyEntry(runtimeState, entry) {
  const legacy = asRecord(runtimeState.legacy);
  const visibleEntries = asArray(legacy.visibleEntries);
  if (visibleEntries.some((current) => asRecord(current).id === entry.id)) {
    runtimeState.legacy = legacy;
    return;
  }
  legacy.visibleEntries = [entry, ...visibleEntries].slice(0, 50);
  runtimeState.legacy = legacy;
}

function ensureSpecialState(runtimeState) {
  const player = asRecord(runtimeState.player);
  const existing = asRecord(player.citySpecials);
  player.citySpecials = { ...existing, records: { ...asRecord(existing.records) } };
  runtimeState.player = player;
  return player.citySpecials;
}

function getSpecialRecord(runtimeState, specialId) {
  return asRecord(ensureSpecialState(runtimeState).records[specialId]);
}

function setSpecialRecord(runtimeState, specialId, record) {
  ensureSpecialState(runtimeState).records[specialId] = { ...record };
}

function assertCity(cityId) {
  const normalizedCityId = normalizeCityId(cityId, "");
  if (!normalizedCityId || !isValidCityId(normalizedCityId)) {
    throw new HttpError(400, "City unavailable.", "CITY_INVALID");
  }
  return normalizedCityId;
}

function validateQuantity(rawQuantity) {
  const quantity = Math.floor(asNumber(rawQuantity, 1));
  if (!Number.isFinite(quantity) || quantity < 1 || quantity > MAX_PURCHASE_QUANTITY) {
    throw new HttpError(400, `Quantity must be between 1 and ${MAX_PURCHASE_QUANTITY}.`, "CITY_MARKET_QUANTITY_INVALID");
  }
  return quantity;
}

function applyItems(player, items) {
  player.inventory = { ...asRecord(player.inventory) };
  for (const item of asArray(items)) {
    const itemId = typeof item.itemId === "string" ? item.itemId : "";
    if (!itemId) continue;
    const quantity = Math.max(1, Math.floor(asNumber(item.quantity, 1)));
    player.inventory[itemId] = Math.max(0, Math.floor(asNumber(player.inventory[itemId], 0) + quantity));
  }
}

function applyGold(runtimeState, nextGold) {
  const player = runtimeState.player;
  const gold = Math.max(0, Math.floor(asNumber(nextGold, 0)));
  player.gold = gold;
  player.currencies = { ...asRecord(player.currencies), gold };
}

function applyReward(runtimeState, reward, now) {
  const player = runtimeState.player;
  if (asArray(reward.items).length) applyItems(player, reward.items);
  if (reward.experience) {
    player.experience = Math.max(0, Math.floor(asNumber(player.experience, 0) + asNumber(reward.experience, 0)));
  }
  player.counters = { ...asRecord(player.counters), lastCityEconomyRewardAt: now };
}

async function loadRuntimeState(client, user) {
  await createDefaultPlayerState(client, user.internalId);
  const playerState = await findPlayerStateByUserInternalId(client, user.internalId);
  if (!playerState) throw new HttpError(404, "Player state unavailable.", "PLAYER_STATE_NOT_FOUND");

  const runtimeState = buildMutableRuntimeState(user, playerState);
  const travelResolution = resolveTravelForRuntimeState(runtimeState);
  if (travelResolution.changed) {
    const nextPlayerState = await upsertPlayerRuntimeState(client, user.internalId, runtimeState);
    return { playerState: nextPlayerState, runtimeState: buildMutableRuntimeState(user, nextPlayerState) };
  }
  return { playerState, runtimeState };
}

function getEconomyContext(runtimeState, cityId) {
  const normalizedCityId = assertCity(cityId);
  const city = getCityDefinition(normalizedCityId);
  const currentCityId = getCurrentCityId(runtimeState);
  const inTransit = isInTransit(runtimeState);
  const isCurrentCity = currentCityId === normalizedCityId;
  const standing = getCityStanding(runtimeState, normalizedCityId);
  return { city, cityId: normalizedCityId, currentCityId, inTransit, isCurrentCity, standing };
}

function serializeStockItem(stockItem, runtimeState, context, quantity = 1, marketOpen = true) {
  const missingCourses = getMissingCourses(runtimeState, stockItem.requiredCourses ?? []);
  const minimumStanding = Math.max(0, Math.floor(asNumber(stockItem.minimumStanding, 0)));
  const standingMissing = Math.max(0, minimumStanding - context.standing.value);
  const price = Math.max(1, Math.floor(asNumber(stockItem.price, 1)));
  const totalPrice = price * quantity;
  const gold = Math.max(0, Math.floor(asNumber(runtimeState.player?.gold, 0)));
  const reasons = [];
  if (!marketOpen) reasons.push("This city market is locked.");
  if (context.inTransit) reasons.push("Finish current travel before buying local goods.");
  if (!context.isCurrentCity) reasons.push(`Travel to ${context.city.name} to buy this stock.`);
  if (standingMissing > 0) reasons.push(`Requires ${minimumStanding} ${context.city.name} standing. Current standing: ${context.standing.value}.`);
  if (missingCourses.length) reasons.push(`Requires ${missingCourses.join(", ")}.`);
  if (gold < totalPrice) reasons.push(`Requires ${totalPrice} gold. Current gold: ${gold}.`);

  return {
    itemId: stockItem.itemId,
    price,
    quantity,
    totalPrice,
    tier: stockItem.tier ?? "core",
    source: stockItem.source ?? "local",
    description: stockItem.description ?? "Local stock.",
    minimumStanding,
    requiredCourses: stockItem.requiredCourses ?? [],
    missingCourses,
    standingMissing,
    canBuy: reasons.length === 0,
    lockReason: reasons[0] ?? null,
  };
}

function getLegalMarketDiscountPercent(runtimeState) {
  const civic = asRecord(runtimeState.civicEmployment);
  const progress = asRecord(asRecord(civic.trackProgress).provisioner);
  const rank = Math.max(0, Math.floor(asNumber(progress.rank, 0)));
  return rank >= 7 ? 8 : 0;
}

function applyDiscount(price, discountPercent) {
  return Math.max(1, Math.round(asNumber(price, 1) * (1 - Math.max(0, discountPercent) / 100)));
}

function serializeMarketProfile(profile, runtimeState, quantity = 1) {
  const context = getEconomyContext(runtimeState, profile.cityId);
  const discountPercent = getLegalMarketDiscountPercent(runtimeState);
  return {
    city: { id: context.city.id, name: context.city.name, role: context.city.role },
    currentCityId: context.currentCityId,
    isCurrentCity: context.isCurrentCity,
    standing: context.standing,
    market: {
      cityId: profile.cityId,
      name: profile.name,
      summary: profile.summary,
      imports: profile.imports,
      exports: profile.exports,
      discountPercent,
      stock: profile.stock.map((entry) => serializeStockItem({ ...entry, price: applyDiscount(entry.price, discountPercent) }, runtimeState, context, quantity)),
    },
  };
}

function serializeBlackMarket(blackMarket, runtimeState, quantity = 1) {
  const context = getEconomyContext(runtimeState, blackMarket.cityId);
  const missingCourses = getMissingCourses(runtimeState, blackMarket.requiredCourses ?? []);
  const standingMissing = Math.max(0, Math.floor(asNumber(blackMarket.minimumStanding, 0)) - context.standing.value);
  const canOpen = missingCourses.length === 0 && standingMissing <= 0;
  const lockReason = canOpen ? null : blackMarket.lockReason ?? "This city's under-market is locked.";
  return {
    city: { id: context.city.id, name: context.city.name, role: context.city.role },
    currentCityId: context.currentCityId,
    isCurrentCity: context.isCurrentCity,
    standing: context.standing,
    blackMarket: {
      cityId: blackMarket.cityId,
      name: blackMarket.name,
      summary: blackMarket.summary,
      minimumStanding: Math.max(0, Math.floor(asNumber(blackMarket.minimumStanding, 0))),
      requiredCourses: blackMarket.requiredCourses ?? [],
      missingCourses,
      standingMissing,
      canOpen,
      lockReason,
      stock: blackMarket.stock.map((entry) => serializeStockItem(entry, runtimeState, context, quantity, canOpen)),
    },
  };
}

function serializeSpecial(special, runtimeState, now = Date.now()) {
  const context = getEconomyContext(runtimeState, special.cityId);
  const missingCourses = getMissingCourses(runtimeState, special.requiredCourses ?? []);
  const minimumStanding = Math.max(0, Math.floor(asNumber(special.minimumStanding, 0)));
  const standingMissing = Math.max(0, minimumStanding - context.standing.value);
  const record = getSpecialRecord(runtimeState, special.id);
  const cooldownUntil = typeof record.cooldownUntil === "number" ? record.cooldownUntil : null;
  const cooldownRemainingMs = cooldownUntil ? Math.max(0, cooldownUntil - now) : 0;
  const costGold = Math.max(0, Math.floor(asNumber(special.costGold, 0)));
  const gold = Math.max(0, Math.floor(asNumber(runtimeState.player?.gold, 0)));
  const reasons = [];
  if (context.inTransit) reasons.push("Finish current travel before using city services.");
  if (!context.isCurrentCity) reasons.push(`Travel to ${context.city.name} to use this city special.`);
  if (standingMissing > 0) reasons.push(`Requires ${minimumStanding} ${context.city.name} standing. Current standing: ${context.standing.value}.`);
  if (missingCourses.length) reasons.push(`Requires ${missingCourses.join(", ")}.`);
  if (cooldownRemainingMs > 0) reasons.push("This city service is cooling down.");
  if (gold < costGold) reasons.push(`Requires ${costGold} gold. Current gold: ${gold}.`);

  return {
    id: special.id,
    cityId: special.cityId,
    name: special.name,
    summary: special.summary,
    actionLabel: special.actionLabel,
    costGold,
    minimumStanding,
    requiredCourses: special.requiredCourses ?? [],
    missingCourses,
    standingMissing,
    cooldownMs: Math.max(0, Math.floor(asNumber(special.cooldownMs, 0))),
    cooldownUntil,
    cooldownRemainingMs,
    reward: special.reward,
    runs: Math.max(0, Math.floor(asNumber(record.runs, 0))),
    canUse: reasons.length === 0,
    lockReason: reasons[0] ?? null,
  };
}

function serializeSpecials(cityId, runtimeState, now = Date.now()) {
  const normalizedCityId = assertCity(cityId);
  const context = getEconomyContext(runtimeState, normalizedCityId);
  return {
    city: { id: context.city.id, name: context.city.name, role: context.city.role },
    currentCityId: context.currentCityId,
    isCurrentCity: context.isCurrentCity,
    standing: context.standing,
    specials: getCitySpecials(normalizedCityId).map((special) => serializeSpecial(special, runtimeState, now)),
  };
}

function buyStock(runtimeState, stockItem, context, quantity, marketOpen) {
  const serialized = serializeStockItem(stockItem, runtimeState, context, quantity, marketOpen);
  if (!serialized.canBuy) {
    throw new HttpError(409, serialized.lockReason ?? "This stock cannot be purchased right now.", "CITY_MARKET_BUY_BLOCKED");
  }
  applyGold(runtimeState, asNumber(runtimeState.player.gold, 0) - serialized.totalPrice);
  applyItems(runtimeState.player, [{ itemId: stockItem.itemId, quantity }]);
  runtimeState.player.counters = {
    ...asRecord(runtimeState.player.counters),
    cityMarketPurchases: Math.max(0, Math.floor(asNumber(runtimeState.player.counters?.cityMarketPurchases, 0) + quantity)),
    lastCityMarketPurchaseAt: Date.now(),
  };
  return serialized;
}

export async function getCityMarketForUser(user, cityId) {
  return withTransaction(async (client) => {
    const { playerState, runtimeState } = await loadRuntimeState(client, user);
    return { playerState, ...serializeMarketProfile(getCityMarketProfile(assertCity(cityId)), runtimeState) };
  });
}

export async function buyCityMarketItemForUser(user, cityId, itemId, quantityInput) {
  return withTransaction(async (client) => {
    const quantity = validateQuantity(quantityInput);
    const { runtimeState } = await loadRuntimeState(client, user);
    const profile = getCityMarketProfile(assertCity(cityId));
    const stockItem = profile.stock.find((entry) => entry.itemId === itemId);
    if (!stockItem) throw new HttpError(404, "This city does not stock that item.", "CITY_MARKET_ITEM_NOT_FOUND");
    const context = getEconomyContext(runtimeState, profile.cityId);
    const discountedStockItem = { ...stockItem, price: applyDiscount(stockItem.price, getLegalMarketDiscountPercent(runtimeState)) };
    const purchase = buyStock(runtimeState, discountedStockItem, context, quantity, true);
    const playerState = await upsertPlayerRuntimeState(client, user.internalId, runtimeState);
    return {
      playerState,
      ...serializeMarketProfile(profile, buildMutableRuntimeState(user, playerState), quantity),
      message: `Purchased ${stockItem.itemId} x${quantity} for ${purchase.totalPrice} gold.`,
    };
  });
}

export async function getCitySpecialsForUser(user, cityId) {
  return withTransaction(async (client) => {
    const { playerState, runtimeState } = await loadRuntimeState(client, user);
    return { playerState, ...serializeSpecials(cityId, runtimeState) };
  });
}

export async function useCitySpecialForUser(user, specialId) {
  return withTransaction(async (client) => {
    const { runtimeState } = await loadRuntimeState(client, user);
    const special = getCitySpecialById(specialId);
    if (!special) throw new HttpError(404, "City service not found.", "CITY_SPECIAL_NOT_FOUND");
    const serialized = serializeSpecial(special, runtimeState);
    if (!serialized.canUse) throw new HttpError(409, serialized.lockReason ?? "This city service is not available right now.", "CITY_SPECIAL_USE_BLOCKED");

    const now = Date.now();
    applyGold(runtimeState, asNumber(runtimeState.player.gold, 0) - serialized.costGold);
    applyReward(runtimeState, special.reward ?? {}, now);
    addCityStanding(runtimeState, special.cityId, asNumber(special.reward?.cityStanding, 0), now);
    const record = getSpecialRecord(runtimeState, special.id);
    const runs = Math.max(0, Math.floor(asNumber(record.runs, 0))) + 1;
    setSpecialRecord(runtimeState, special.id, {
      ...record,
      runs,
      lastUsedAt: now,
      cooldownUntil: now + Math.max(60 * 1000, asNumber(special.cooldownMs, 10 * 60 * 1000)),
    });
    runtimeState.player.counters = {
      ...asRecord(runtimeState.player.counters),
      citySpecialUses: Math.max(0, Math.floor(asNumber(runtimeState.player.counters?.citySpecialUses, 0) + 1)),
      firstCitySpecialUseAt: runtimeState.player.counters?.firstCitySpecialUseAt ?? now,
    };
    if (runs === 1) {
      addLegacyEntry(runtimeState, {
        id: `city_special_${special.id}`,
        title: `${special.name}`,
        summary: `Used ${special.name} in ${getCityDefinition(special.cityId).name}.`,
        kind: "city_special",
        awardedAt: now,
      });
    }
    const playerState = await upsertPlayerRuntimeState(client, user.internalId, runtimeState);
    return {
      playerState,
      ...serializeSpecials(special.cityId, buildMutableRuntimeState(user, playerState), now),
      message: `${special.name} completed. Rewards delivered and local standing updated.`,
    };
  });
}

export async function getBlackMarketForUser(user, cityId) {
  return withTransaction(async (client) => {
    const { playerState, runtimeState } = await loadRuntimeState(client, user);
    return { playerState, ...serializeBlackMarket(getCityBlackMarket(assertCity(cityId)), runtimeState) };
  });
}

export async function buyBlackMarketItemForUser(user, cityId, itemId, quantityInput) {
  return withTransaction(async (client) => {
    const quantity = validateQuantity(quantityInput);
    const { runtimeState } = await loadRuntimeState(client, user);
    const blackMarket = getCityBlackMarket(assertCity(cityId));
    const stockItem = blackMarket.stock.find((entry) => entry.itemId === itemId);
    if (!stockItem) throw new HttpError(404, "This under-market does not stock that item.", "CITY_BLACK_MARKET_ITEM_NOT_FOUND");
    const context = getEconomyContext(runtimeState, blackMarket.cityId);
    const marketState = serializeBlackMarket(blackMarket, runtimeState, quantity);
    const purchase = buyStock(runtimeState, stockItem, context, quantity, marketState.blackMarket.canOpen);
    runtimeState.player.counters = {
      ...asRecord(runtimeState.player.counters),
      blackMarketPurchases: Math.max(0, Math.floor(asNumber(runtimeState.player.counters?.blackMarketPurchases, 0) + quantity)),
      lastBlackMarketPurchaseAt: Date.now(),
    };
    const playerState = await upsertPlayerRuntimeState(client, user.internalId, runtimeState);
    return {
      playerState,
      ...serializeBlackMarket(blackMarket, buildMutableRuntimeState(user, playerState), quantity),
      message: `Purchased ${stockItem.itemId} x${quantity} for ${purchase.totalPrice} gold from the under-market.`,
    };
  });
}
