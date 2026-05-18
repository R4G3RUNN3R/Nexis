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
  getBlackMarketFence,
  getCityBlackMarket,
  getCityMarketProfile,
  getCitySpecialById,
  getCitySpecials,
  getLegalTradeGood,
  getLegalTradeGoods,
} from "../data/cityEconomyData.js";
import { resolveTravelForRuntimeState } from "./travelService.js";
import { getItemDisplayName, getItemSummary } from "../data/itemData.js";

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

function getInventoryQuantity(runtimeState, itemId) {
  return Math.max(0, Math.floor(asNumber(asRecord(runtimeState.player?.inventory)[itemId], 0)));
}

function removeItems(player, itemId, quantity) {
  player.inventory = { ...asRecord(player.inventory) };
  const owned = Math.max(0, Math.floor(asNumber(player.inventory[itemId], 0)));
  if (owned < quantity) {
    throw new HttpError(409, `You only have ${owned} of this item to sell.`, "CITY_MARKET_SELL_INSUFFICIENT_ITEM");
  }
  const nextQuantity = owned - quantity;
  if (nextQuantity > 0) player.inventory[itemId] = nextQuantity;
  else delete player.inventory[itemId];
}

function getLegalSellBonusPercent(runtimeState) {
  const completed = new Set(getCompletedCourses(runtimeState));
  let bonus = 0;
  if (completed.has("practical-arithmetic")) bonus += 5;
  if (completed.has("commerce-1") || completed.has("trade-1")) bonus += 3;
  return bonus;
}

function applySellBonus(price, bonusPercent) {
  return Math.max(1, Math.floor(asNumber(price, 1) * (1 + Math.max(0, bonusPercent) / 100)));
}

function getLegalSellPrice(good, cityId, runtimeState) {
  const rawPrice = asNumber(asRecord(good.sellPrices)[cityId], 0);
  if (rawPrice <= 0) return null;
  return applySellBonus(rawPrice, getLegalSellBonusPercent(runtimeState));
}

function getBestLegalDestination(good, originCityId, runtimeState) {
  let best = null;
  for (const [cityId, rawPrice] of Object.entries(asRecord(good.sellPrices))) {
    if (cityId === originCityId) continue;
    const price = applySellBonus(rawPrice, getLegalSellBonusPercent(runtimeState));
    if (!best || price > best.price) {
      best = { cityId, cityName: getCityDefinition(cityId).name, price };
    }
  }
  return best;
}

function serializeLegalSellOffer(good, runtimeState, context, quantity = 1) {
  const ownedQuantity = getInventoryQuantity(runtimeState, good.itemId);
  const missingCourses = getMissingCourses(runtimeState, good.requiredCourses ?? []);
  const unitPrice = getLegalSellPrice(good, context.cityId, runtimeState);
  const totalPrice = unitPrice ? unitPrice * quantity : 0;
  const reasons = [];
  if (context.inTransit) reasons.push("Finish current travel before selling local goods.");
  if (!context.isCurrentCity) reasons.push(`Travel to ${context.city.name} to sell to this market.`);
  if (unitPrice === null) reasons.push(`${context.city.name} is not buying this good right now.`);
  if (ownedQuantity < quantity) reasons.push(`You have ${ownedQuantity}; selling ${quantity} requires more stock.`);
  if (missingCourses.length) reasons.push(`Requires ${missingCourses.join(", ")} to sell this trade lot confidently.`);
  const bestDestination = getBestLegalDestination(good, context.cityId, runtimeState);

  return {
    itemId: good.itemId,
    item: getItemSummary(good.itemId),
    category: good.category,
    sourceCityId: good.sourceCityId,
    sourceCityName: getCityDefinition(good.sourceCityId).name,
    unitPrice: unitPrice ?? 0,
    quantity,
    totalPrice,
    ownedQuantity,
    requiredCourses: good.requiredCourses ?? [],
    missingCourses,
    note: good.note,
    bestDestination,
    canSell: reasons.length === 0,
    lockReason: reasons[0] ?? null,
  };
}

function getLegalSellOffers(runtimeState, context, quantity = 1) {
  return getLegalTradeGoods()
    .filter((good) => getInventoryQuantity(runtimeState, good.itemId) > 0)
    .map((good) => serializeLegalSellOffer(good, runtimeState, context, Math.min(quantity, getInventoryQuantity(runtimeState, good.itemId))))
    .sort((left, right) => right.unitPrice - left.unitPrice);
}

function getCargoSummary(runtimeState, context) {
  const offers = getLegalSellOffers(runtimeState, context, 1);
  const carriedTradeGoods = offers.reduce((total, offer) => total + offer.ownedQuantity, 0);
  const currentCityLiquidationValue = offers.reduce((total, offer) => total + offer.unitPrice * offer.ownedQuantity, 0);
  return {
    carriedTradeGoods,
    currentCityLiquidationValue,
    bestCurrentSale: offers[0] ?? null,
  };
}

function serializeTradeOpportunities(profile, runtimeState, discountPercent) {
  const opportunities = [];
  for (const stockItem of profile.stock) {
    const good = getLegalTradeGood(stockItem.itemId);
    if (!good) continue;
    const buyPrice = applyDiscount(stockItem.price, discountPercent);
    const bestDestination = getBestLegalDestination(good, profile.cityId, runtimeState);
    if (!bestDestination) continue;
    const missingCourses = getMissingCourses(runtimeState, good.requiredCourses ?? []);
    opportunities.push({
      itemId: good.itemId,
      item: getItemSummary(good.itemId),
      category: good.category,
      buyCityId: profile.cityId,
      buyCityName: getCityDefinition(profile.cityId).name,
      buyPrice,
      bestSellCityId: bestDestination.cityId,
      bestSellCityName: bestDestination.cityName,
      bestSellPrice: bestDestination.price,
      expectedMargin: bestDestination.price - buyPrice,
      requiredCourses: good.requiredCourses ?? [],
      missingCourses,
      lockReason: missingCourses.length ? `Requires ${missingCourses.join(", ")} to use this route cleanly.` : null,
      note: good.note,
    });
  }
  return opportunities
    .filter((entry) => entry.expectedMargin > 0 || entry.missingCourses.length)
    .sort((left, right) => right.expectedMargin - left.expectedMargin)
    .slice(0, 6);
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
    item: getItemSummary(stockItem.itemId),
    price,
    quantity,
    totalPrice,
    tier: stockItem.tier ?? "core",
    source: stockItem.source ?? "local",
    description: stockItem.description ?? getItemSummary(stockItem.itemId)?.shortDescription ?? "Local stock.",
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
      sellBonusPercent: getLegalSellBonusPercent(runtimeState),
      stock: profile.stock.map((entry) => serializeStockItem({ ...entry, price: applyDiscount(entry.price, discountPercent) }, runtimeState, context, quantity)),
      sellOffers: getLegalSellOffers(runtimeState, context, quantity),
      tradeOpportunities: serializeTradeOpportunities(profile, runtimeState, discountPercent),
      cargoSummary: getCargoSummary(runtimeState, context),
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
      sellOffers: getBlackMarketSellOffers(blackMarket, runtimeState, context, quantity, canOpen),
    },
  };
}

function serializeBlackMarketSellOffer(fenceItem, blackMarket, runtimeState, context, quantity = 1, marketOpen = true) {
  const ownedQuantity = getInventoryQuantity(runtimeState, fenceItem.itemId);
  const requiredCourses = [...(blackMarket.requiredCourses ?? []), ...(fenceItem.requiredCourses ?? [])];
  const missingCourses = getMissingCourses(runtimeState, requiredCourses);
  const minimumStanding = Math.max(Math.floor(asNumber(blackMarket.minimumStanding, 0)), Math.floor(asNumber(fenceItem.minimumStanding, 0)));
  const standingMissing = Math.max(0, minimumStanding - context.standing.value);
  const unitPrice = Math.max(1, Math.floor(asNumber(fenceItem.price, 1)));
  const reasons = [];
  if (!marketOpen) reasons.push(blackMarket.lockReason ?? "This under-market is locked.");
  if (context.inTransit) reasons.push("Finish current travel before fencing goods.");
  if (!context.isCurrentCity) reasons.push(`Travel to ${context.city.name} to use this under-market.`);
  if (ownedQuantity < quantity) reasons.push(`You have ${ownedQuantity}; fencing ${quantity} requires more stock.`);
  if (standingMissing > 0) reasons.push(`Requires ${minimumStanding} ${context.city.name} standing. Current standing: ${context.standing.value}.`);
  if (missingCourses.length) reasons.push(`Requires ${missingCourses.join(", ")} to fence this safely.`);
  return {
    itemId: fenceItem.itemId,
    item: getItemSummary(fenceItem.itemId),
    unitPrice,
    quantity,
    totalPrice: unitPrice * quantity,
    ownedQuantity,
    minimumStanding,
    requiredCourses,
    missingCourses,
    standingMissing,
    note: fenceItem.note,
    canSell: reasons.length === 0,
    lockReason: reasons[0] ?? null,
  };
}

function getBlackMarketSellOffers(blackMarket, runtimeState, context, quantity = 1, marketOpen = true) {
  return getBlackMarketFence(blackMarket.cityId)
    .filter((entry) => getInventoryQuantity(runtimeState, entry.itemId) > 0)
    .map((entry) => serializeBlackMarketSellOffer(entry, blackMarket, runtimeState, context, Math.min(quantity, getInventoryQuantity(runtimeState, entry.itemId)), marketOpen))
    .sort((left, right) => right.unitPrice - left.unitPrice);
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
      message: `Purchased ${getItemDisplayName(stockItem.itemId)} x${quantity} for ${purchase.totalPrice} gold.`,
    };
  });
}

export async function sellCityMarketItemForUser(user, cityId, itemId, quantityInput) {
  return withTransaction(async (client) => {
    const quantity = validateQuantity(quantityInput);
    const { runtimeState } = await loadRuntimeState(client, user);
    const profile = getCityMarketProfile(assertCity(cityId));
    const good = getLegalTradeGood(itemId);
    if (!good) throw new HttpError(404, "This item is not accepted by legal trade buyers.", "CITY_MARKET_SELL_ITEM_NOT_FOUND");
    const context = getEconomyContext(runtimeState, profile.cityId);
    const offer = serializeLegalSellOffer(good, runtimeState, context, quantity);
    if (!offer.canSell) throw new HttpError(409, offer.lockReason ?? "This item cannot be sold here right now.", "CITY_MARKET_SELL_BLOCKED");
    removeItems(runtimeState.player, itemId, quantity);
    applyGold(runtimeState, asNumber(runtimeState.player.gold, 0) + offer.totalPrice);
    const now = Date.now();
    runtimeState.player.counters = {
      ...asRecord(runtimeState.player.counters),
      cityMarketSales: Math.max(0, Math.floor(asNumber(runtimeState.player.counters?.cityMarketSales, 0) + quantity)),
      firstCityMarketSaleAt: runtimeState.player.counters?.firstCityMarketSaleAt ?? now,
      lastCityMarketSaleAt: now,
    };
    if (!runtimeState.player.counters.firstTradeSaleChronicleAt) {
      runtimeState.player.counters.firstTradeSaleChronicleAt = now;
      addLegacyEntry(runtimeState, { id: `trade_sale_${user.internalId}_${now}`, title: "First Trade Sale", summary: `Sold trade goods in ${context.city.name}.`, kind: "trade", awardedAt: now });
    }
    const playerState = await upsertPlayerRuntimeState(client, user.internalId, runtimeState);
    return {
      playerState,
      ...serializeMarketProfile(profile, buildMutableRuntimeState(user, playerState), quantity),
      message: `Sold ${getItemDisplayName(itemId)} x${quantity} for ${offer.totalPrice} gold in ${context.city.name}.`,
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

export async function sellBlackMarketItemForUser(user, cityId, itemId, quantityInput) {
  return withTransaction(async (client) => {
    const quantity = validateQuantity(quantityInput);
    const { runtimeState } = await loadRuntimeState(client, user);
    const blackMarket = getCityBlackMarket(assertCity(cityId));
    const context = getEconomyContext(runtimeState, blackMarket.cityId);
    const marketState = serializeBlackMarket(blackMarket, runtimeState, quantity);
    const fenceItem = getBlackMarketFence(blackMarket.cityId).find((entry) => entry.itemId === itemId);
    if (!fenceItem) throw new HttpError(404, "This under-market is not buying that item.", "CITY_BLACK_MARKET_SELL_ITEM_NOT_FOUND");
    const offer = serializeBlackMarketSellOffer(fenceItem, blackMarket, runtimeState, context, quantity, marketState.blackMarket.canOpen);
    if (!offer.canSell) throw new HttpError(409, offer.lockReason ?? "This item cannot be fenced here right now.", "CITY_BLACK_MARKET_SELL_BLOCKED");
    removeItems(runtimeState.player, itemId, quantity);
    applyGold(runtimeState, asNumber(runtimeState.player.gold, 0) + offer.totalPrice);
    const now = Date.now();
    runtimeState.player.counters = {
      ...asRecord(runtimeState.player.counters),
      blackMarketSales: Math.max(0, Math.floor(asNumber(runtimeState.player.counters?.blackMarketSales, 0) + quantity)),
      firstBlackMarketSaleAt: runtimeState.player.counters?.firstBlackMarketSaleAt ?? now,
      lastBlackMarketSaleAt: now,
    };
    const playerState = await upsertPlayerRuntimeState(client, user.internalId, runtimeState);
    return {
      playerState,
      ...serializeBlackMarket(blackMarket, buildMutableRuntimeState(user, playerState), quantity),
      message: `Fenced ${getItemDisplayName(itemId)} x${quantity} for ${offer.totalPrice} gold in ${context.city.name}.`,
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
      message: `Purchased ${getItemDisplayName(stockItem.itemId)} x${quantity} for ${purchase.totalPrice} gold from the under-market.`,
    };
  });
}
