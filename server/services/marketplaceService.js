import { withTransaction } from "../db/pool.js";
import { HttpError } from "../lib/errors.js";
import { buildMutableRuntimeState } from "../lib/runtimePlayerState.js";
import { getCityDefinition, normalizeCityId } from "../data/cityData.js";
import { getItemDefinition, getItemDisplayName, getItemSummary } from "../data/itemData.js";
import { createDefaultPlayerState, findPlayerStateByUserInternalId, upsertPlayerRuntimeState } from "../repositories/playerStateRepository.js";
import { findUserByInternalId } from "../repositories/usersRepository.js";
import { createMarketplaceListing, expireOldMarketplaceListings, findMarketplaceListingById, listMarketplaceListings, listMarketplaceListingsBySeller, updateMarketplaceListingStatus } from "../repositories/marketplaceRepository.js";
import { getCityDemandProfile } from "./liveWorldService.js";
import { addPlayerRecord } from "./playerRecordsService.js";
import { evaluateLegacyAchievementsForRuntime } from "./achievementService.js";

function asRecord(value) { return value && typeof value === "object" && !Array.isArray(value) ? value : {}; }
function asNumber(value, fallback = 0) { const numeric = Number(value); return Number.isFinite(numeric) ? numeric : fallback; }
function slug(value) { return String(value ?? "").trim().toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, ""); }
function getInventory(runtimeState) { const player = asRecord(runtimeState.player); player.inventory = { ...asRecord(player.inventory) }; runtimeState.player = player; return player.inventory; }
function addInventory(runtimeState, itemId, quantity) { const inventory = getInventory(runtimeState); inventory[itemId] = Math.max(0, Math.floor(asNumber(inventory[itemId], 0) + quantity)); }
function removeInventory(runtimeState, itemId, quantity) { const inventory = getInventory(runtimeState); const owned = Math.max(0, Math.floor(asNumber(inventory[itemId], 0))); if (owned < quantity) throw new HttpError(409, `You only have ${owned} ${getItemDisplayName(itemId)}.`, "MARKETPLACE_ITEM_INSUFFICIENT"); const next = owned - quantity; if (next > 0) inventory[itemId] = next; else delete inventory[itemId]; }
function applyGold(runtimeState, amount) { const player = runtimeState.player; const next = Math.max(0, Math.floor(asNumber(player.gold, 0) + amount)); player.gold = next; player.currencies = { ...asRecord(player.currencies), gold: next }; }
async function loadRuntimeState(client, user) { await createDefaultPlayerState(client, user.internalId); const playerState = await findPlayerStateByUserInternalId(client, user.internalId); if (!playerState) throw new HttpError(404, "Player state unavailable.", "PLAYER_STATE_NOT_FOUND"); return { playerState, runtimeState: buildMutableRuntimeState(user, playerState) }; }
function currentCityId(runtimeState) { const travel = asRecord(runtimeState.travel); const current = asRecord(runtimeState.player?.current); return normalizeCityId(travel.currentCityId ?? current.currentCityId ?? "nexis"); }

function serializeListing(listing, viewerUser = null) {
  const item = getItemSummary(listing.itemId);
  const demand = getCityDemandProfile(listing.cityId);
  return {
    id: String(listing.id),
    seller: { publicId: listing.sellerPublicId, name: listing.sellerName },
    itemId: listing.itemId,
    item,
    quantity: listing.quantity,
    unitPrice: listing.unitPrice,
    totalPrice: listing.unitPrice * listing.quantity,
    cityId: listing.cityId,
    cityName: getCityDefinition(listing.cityId).name,
    status: listing.status,
    createdAt: listing.createdAt,
    expiresAt: listing.expiresAt,
    soldAt: listing.soldAt,
    cancelledAt: listing.cancelledAt,
    isOwnListing: Boolean(viewerUser && listing.sellerInternalId === viewerUser.internalId),
    demandTags: demand.tags,
    demandHeadline: demand.headline,
  };
}

function readFilters(query = {}) {
  const category = typeof query.category === "string" ? slug(query.category) : "";
  const cityId = typeof query.cityId === "string" && query.cityId ? normalizeCityId(query.cityId, "") : "";
  const rarity = typeof query.rarity === "string" ? slug(query.rarity) : "";
  const sourceCity = typeof query.sourceCity === "string" ? slug(query.sourceCity) : "";
  const type = typeof query.type === "string" ? slug(query.type) : "";
  const status = ["active", "sold", "cancelled", "expired"].includes(slug(query.status)) ? slug(query.status) : "active";
  const sort = ["price_asc", "price_desc", "newest", "oldest", "rarity"].includes(slug(query.sort)) ? slug(query.sort) : "price_asc";
  const seller = typeof query.seller === "string" ? query.seller.trim().replace(/^P/i, "") : "";
  const maxPrice = Math.max(0, Math.floor(asNumber(query.maxPrice, 0)));
  return { category, cityId, rarity, sourceCity, type, status, sort, seller, maxPrice };
}

function filterListing(listing, filters) {
  const item = getItemDefinition(listing.itemId);
  if (!item) return false;
  if (filters.category && slug(item.category) !== filters.category) return false;
  if (filters.type) {
    const itemType = item.itemRole === "weapon" || item.itemRole === "armor" ? "gear" : item.itemRole === "visual" ? "clothing" : slug(item.category);
    if (itemType !== filters.type) return false;
  }
  if (filters.rarity && slug(item.rarity) !== filters.rarity) return false;
  if (filters.sourceCity && ![slug(item.sourceCity), slug(item.cityBias)].includes(filters.sourceCity)) return false;
  if (filters.seller && String(listing.sellerPublicId) !== filters.seller) return false;
  if (filters.maxPrice && listing.unitPrice > filters.maxPrice) return false;
  return true;
}

function sortListings(listings, sort) {
  const rarityRank = { common: 1, uncommon: 2, rare: 3, legendary: 4 };
  return listings.slice().sort((left, right) => {
    if (sort === "price_desc") return right.unitPrice - left.unitPrice || right.createdAt - left.createdAt;
    if (sort === "newest") return right.createdAt - left.createdAt;
    if (sort === "oldest") return left.createdAt - right.createdAt;
    if (sort === "rarity") return (rarityRank[slug(getItemDefinition(right.itemId)?.rarity)] ?? 0) - (rarityRank[slug(getItemDefinition(left.itemId)?.rarity)] ?? 0) || left.unitPrice - right.unitPrice;
    return left.unitPrice - right.unitPrice || right.createdAt - left.createdAt;
  });
}

function buildPriceGuide(listings) {
  const groups = new Map();
  for (const listing of listings) {
    const group = groups.get(listing.itemId) ?? { itemId: listing.itemId, count: 0, totalQuantity: 0, minPrice: listing.unitPrice, maxPrice: listing.unitPrice, totalUnitPrice: 0, item: getItemSummary(listing.itemId) };
    group.count += 1;
    group.totalQuantity += listing.quantity;
    group.minPrice = Math.min(group.minPrice, listing.unitPrice);
    group.maxPrice = Math.max(group.maxPrice, listing.unitPrice);
    group.totalUnitPrice += listing.unitPrice;
    groups.set(listing.itemId, group);
  }
  return Array.from(groups.values()).map((group) => ({ ...group, averageUnitPrice: Math.round(group.totalUnitPrice / Math.max(1, group.count)) })).sort((left, right) => right.totalQuantity - left.totalQuantity).slice(0, 12);
}

async function buildMarketplacePayload(client, user, runtimeState, filters) {
  const rawListings = await listMarketplaceListings(client, filters);
  const activeListingsForGuide = await listMarketplaceListings(client, { status: "active" });
  const ownRawListings = await listMarketplaceListingsBySeller(client, user.internalId);
  const filteredListings = sortListings(rawListings.filter((listing) => filterListing(listing, filters)), filters.sort);
  const ownListings = ownRawListings.map((listing) => serializeListing(listing, user));
  return {
    listings: filteredListings.map((listing) => serializeListing(listing, user)),
    ownListings,
    recentActivity: ownListings.filter((listing) => listing.status !== "active").slice(0, 12),
    priceGuide: buildPriceGuide(activeListingsForGuide),
    filters,
    inventory: Object.entries(getInventory(runtimeState)).map(([itemId, quantity]) => ({ itemId, quantity: Math.floor(asNumber(quantity, 0)), item: getItemSummary(itemId) })).filter((entry) => entry.quantity > 0 && entry.item?.marketEligible !== false),
    cityDemand: getCityDemandProfile(currentCityId(runtimeState)),
  };
}

export async function getMarketplaceForUser(user, query = {}) {
  return withTransaction(async (client) => {
    await expireOldMarketplaceListings(client);
    const filters = readFilters(query);
    const { playerState, runtimeState } = await loadRuntimeState(client, user);
    return { playerState, marketplace: await buildMarketplacePayload(client, user, runtimeState, filters) };
  });
}

export async function createMarketplaceListingForUser(user, payload = {}) {
  return withTransaction(async (client) => {
    const itemId = String(payload.itemId ?? "").trim();
    const item = getItemDefinition(itemId);
    if (!item) throw new HttpError(404, "Item not found.", "MARKETPLACE_ITEM_NOT_FOUND");
    if (item.marketEligible === false) throw new HttpError(409, `${getItemDisplayName(itemId)} cannot be listed on the player market.`, "MARKETPLACE_ITEM_NOT_ELIGIBLE");
    const quantity = Math.max(1, Math.min(99, Math.floor(asNumber(payload.quantity, 1))));
    const unitPrice = Math.max(1, Math.min(999999, Math.floor(asNumber(payload.unitPrice, item.valueSell ?? 1))));
    const cityId = normalizeCityId(payload.cityId, "nexis");
    const { runtimeState } = await loadRuntimeState(client, user);
    removeInventory(runtimeState, itemId, quantity);
    const sellerName = `${user.firstName}${user.lastName ? ` ${user.lastName}` : ""}`.trim() || "Citizen";
    const listing = await createMarketplaceListing(client, { sellerInternalId: user.internalId, sellerPublicId: user.publicId, sellerName, itemId, quantity, unitPrice, cityId });
    runtimeState.player.counters = { ...asRecord(runtimeState.player.counters), marketplaceListingsCreated: Math.max(0, Math.floor(asNumber(runtimeState.player.counters?.marketplaceListingsCreated, 0) + 1)) };
    addPlayerRecord(runtimeState, { category: "marketplace", summary: `Listed ${getItemDisplayName(itemId)} x${quantity} for ${unitPrice} gold each.`, detail: { itemId, quantity, unitPrice, cityId }, source: "marketplace", route: "/market", timestamp: Date.now() });
    evaluateLegacyAchievementsForRuntime(runtimeState, user);
    const playerState = await upsertPlayerRuntimeState(client, user.internalId, runtimeState);
    return { playerState, listing: serializeListing(listing, user), marketplace: await buildMarketplacePayload(client, user, runtimeState, readFilters({})), message: `Listed ${getItemDisplayName(itemId)} x${quantity} for ${unitPrice} gold each.` };
  });
}

export async function buyMarketplaceListingForUser(user, listingIdInput) {
  return withTransaction(async (client) => {
    const listingId = Math.max(1, Math.floor(asNumber(listingIdInput, 0)));
    const listing = await findMarketplaceListingById(client, listingId, { forUpdate: true });
    if (!listing || listing.status !== "active" || (listing.expiresAt && listing.expiresAt <= Date.now())) throw new HttpError(404, "Marketplace listing unavailable.", "MARKETPLACE_LISTING_UNAVAILABLE");
    if (listing.sellerInternalId === user.internalId) throw new HttpError(409, "You cannot buy your own listing.", "MARKETPLACE_SELF_BUY");
    const { runtimeState: buyerState } = await loadRuntimeState(client, user);
    const totalPrice = listing.quantity * listing.unitPrice;
    if (asNumber(buyerState.player.gold, 0) < totalPrice) throw new HttpError(409, `Requires ${totalPrice} gold.`, "MARKETPLACE_GOLD_INSUFFICIENT");
    const sellerUser = await findUserByInternalId(client, listing.sellerInternalId);
    if (!sellerUser) throw new HttpError(404, "Seller unavailable.", "MARKETPLACE_SELLER_MISSING");
    const { runtimeState: sellerState } = await loadRuntimeState(client, sellerUser);
    applyGold(buyerState, -totalPrice);
    addInventory(buyerState, listing.itemId, listing.quantity);
    buyerState.player.counters = { ...asRecord(buyerState.player.counters), marketplacePurchases: Math.max(0, Math.floor(asNumber(buyerState.player.counters?.marketplacePurchases, 0) + 1)) };
    addPlayerRecord(buyerState, { category: "marketplace", summary: `Bought ${getItemDisplayName(listing.itemId)} x${listing.quantity} for ${totalPrice} gold.`, detail: { listingId, itemId: listing.itemId, quantity: listing.quantity, totalPrice, sellerPublicId: listing.sellerPublicId }, source: "marketplace", route: "/market", timestamp: Date.now() });
    applyGold(sellerState, totalPrice);
    sellerState.player.counters = { ...asRecord(sellerState.player.counters), marketplaceSales: Math.max(0, Math.floor(asNumber(sellerState.player.counters?.marketplaceSales, 0) + 1)) };
    addPlayerRecord(sellerState, { category: "marketplace", summary: `Sold ${getItemDisplayName(listing.itemId)} x${listing.quantity} for ${totalPrice} gold.`, detail: { listingId, itemId: listing.itemId, quantity: listing.quantity, totalPrice, buyerPublicId: user.publicId }, source: "marketplace", route: "/market", timestamp: Date.now() });
    await updateMarketplaceListingStatus(client, listing.id, "sold", { buyerInternalId: user.internalId, buyerPublicId: user.publicId, soldAt: Date.now() });
    evaluateLegacyAchievementsForRuntime(buyerState, user);
    evaluateLegacyAchievementsForRuntime(sellerState, sellerUser);
    const buyerPlayerState = await upsertPlayerRuntimeState(client, user.internalId, buyerState);
    await upsertPlayerRuntimeState(client, sellerUser.internalId, sellerState);
    return { playerState: buyerPlayerState, listing: serializeListing({ ...listing, status: "sold", soldAt: Date.now() }, user), marketplace: await buildMarketplacePayload(client, user, buyerState, readFilters({})), message: `Bought ${getItemDisplayName(listing.itemId)} x${listing.quantity} for ${totalPrice} gold.` };
  });
}

export async function cancelMarketplaceListingForUser(user, listingIdInput) {
  return withTransaction(async (client) => {
    const listingId = Math.max(1, Math.floor(asNumber(listingIdInput, 0)));
    const listing = await findMarketplaceListingById(client, listingId, { forUpdate: true });
    if (!listing || listing.status !== "active") throw new HttpError(404, "Marketplace listing unavailable.", "MARKETPLACE_LISTING_UNAVAILABLE");
    if (listing.sellerInternalId !== user.internalId) throw new HttpError(403, "Only the seller can cancel this listing.", "MARKETPLACE_NOT_SELLER");
    const { runtimeState } = await loadRuntimeState(client, user);
    addInventory(runtimeState, listing.itemId, listing.quantity);
    addPlayerRecord(runtimeState, { category: "marketplace", summary: `Cancelled marketplace listing: ${getItemDisplayName(listing.itemId)} x${listing.quantity}.`, detail: { listingId, itemId: listing.itemId, quantity: listing.quantity }, source: "marketplace", route: "/market", timestamp: Date.now() });
    const cancelled = await updateMarketplaceListingStatus(client, listing.id, "cancelled", { cancelledAt: Date.now() });
    const playerState = await upsertPlayerRuntimeState(client, user.internalId, runtimeState);
    return { playerState, listing: serializeListing(cancelled, user), marketplace: await buildMarketplacePayload(client, user, runtimeState, readFilters({})), message: `Cancelled listing and returned ${getItemDisplayName(listing.itemId)} x${listing.quantity}.` };
  });
}
