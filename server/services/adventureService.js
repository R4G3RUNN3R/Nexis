import { withTransaction } from "../db/pool.js";
import { HttpError } from "../lib/errors.js";
import { buildMutableRuntimeState } from "../lib/runtimePlayerState.js";
import { createDefaultPlayerState, findPlayerStateByUserInternalId, upsertPlayerRuntimeState } from "../repositories/playerStateRepository.js";
import { getCityDefinition, normalizeCityId } from "../data/cityData.js";
import { ADVENTURE_CATEGORIES, getAdventureBoardNotices, getAdventureCategory, getAdventureCityStyle, getAdventureDefinition, getAdventureDefinitions, getHiddenSiteForAdventure } from "../data/adventureData.js";
import { getItemDisplayName, getItemSummary } from "../data/itemData.js";
import { applyCombatReward, resolveCombat } from "./combatService.js";
import { addPlayerRecord } from "./playerRecordsService.js";

function asRecord(value) { return value && typeof value === "object" && !Array.isArray(value) ? value : {}; }
function asArray(value) { return Array.isArray(value) ? value : []; }
function asNumber(value, fallback = 0) { const numeric = Number(value); return Number.isFinite(numeric) ? numeric : fallback; }
function currentCityId(runtimeState) { const travel = asRecord(runtimeState.travel); const current = asRecord(runtimeState.player?.current); return normalizeCityId(travel.currentCityId ?? current.currentCityId ?? "nexis"); }
function statusRank(status) { return { unknown: 0, rumored: 1, discovered: 2, explored: 3 }[String(status ?? "unknown")] ?? 0; }
function hiddenSiteRecord(runtimeState, siteId) { return asRecord(asRecord(asRecord(runtimeState.player).worldDiscovery).hiddenSites)[siteId]; }
function levelOf(runtimeState) { return Math.max(1, Math.floor(asNumber(runtimeState.player?.level, 1))); }
function sourcePaths(adventure) { return asArray(adventure.acquisition).map((label) => ({ label, detail: adventure.sourceLabel ?? "Adventure source", route: label.includes("Market") ? "/market" : label.includes("Hidden") ? "/world-map" : "/adventure" })); }

async function loadRuntimeState(client, user) {
  await createDefaultPlayerState(client, user.internalId);
  const playerState = await findPlayerStateByUserInternalId(client, user.internalId);
  if (!playerState) throw new HttpError(404, "Player state unavailable.", "PLAYER_STATE_NOT_FOUND");
  return { playerState, runtimeState: buildMutableRuntimeState(user, playerState) };
}

function availability(runtimeState, adventure) {
  if (!adventure) return { available: false, lockReason: "Adventure unavailable." };
  const playerLevel = levelOf(runtimeState);
  if (adventure.requiredLevel && playerLevel < adventure.requiredLevel) return { available: false, lockReason: `Locked: reach level ${adventure.requiredLevel} to attempt this elite trace.` };
  const site = getHiddenSiteForAdventure(adventure);
  if (site) {
    const record = hiddenSiteRecord(runtimeState, site.id);
    if (statusRank(record.status) < statusRank("rumored")) return { available: false, lockReason: `Locked: discover or rumor ${site.name} through travel, World Map, or city notices.` };
  }
  return { available: true, lockReason: null };
}

function serializeAdventure(runtimeState, adventure) {
  const city = getCityDefinition(adventure.cityId);
  const category = getAdventureCategory(adventure.category);
  const site = getHiddenSiteForAdventure(adventure);
  const state = availability(runtimeState, adventure);
  const rewardItems = asArray(adventure.reward?.items).concat(asArray(adventure.extraDrops)).map((entry) => ({ ...entry, item: getItemSummary(entry.itemId), label: getItemDisplayName(entry.itemId) }));
  return {
    id: adventure.id,
    title: adventure.title,
    summary: adventure.summary,
    category: adventure.category,
    categoryLabel: category?.label ?? adventure.category,
    cityId: adventure.cityId,
    cityName: city.name,
    riskBand: adventure.riskBand,
    threatType: adventure.threatType,
    recommendedPrep: adventure.recommendedPrep,
    rewardCategory: adventure.rewardCategory,
    rewardItems,
    sourceLabel: adventure.sourceLabel,
    sourcePaths: sourcePaths(adventure),
    hiddenSite: site ? { id: site.id, name: site.name, status: String(hiddenSiteRecord(runtimeState, site.id).status ?? "unknown"), summary: site.summary } : null,
    opponent: { id: adventure.opponent.id, name: adventure.opponent.name, level: adventure.opponent.level, damageType: adventure.opponent.damageType, summary: adventure.opponent.summary },
    gearHint: adventure.gearHint,
    available: state.available,
    lockReason: state.lockReason,
  };
}

function buildBoard(runtimeState) {
  const cityId = currentCityId(runtimeState);
  const style = getAdventureCityStyle(cityId);
  const cityAdventures = getAdventureDefinitions().filter((entry) => entry.cityId === cityId || entry.id === "cross_city_concordant_trace");
  const entries = cityAdventures.map((adventure) => serializeAdventure(runtimeState, adventure));
  const categories = ADVENTURE_CATEGORIES.map((category) => {
    const categoryEntries = entries.filter((entry) => entry.category === category.id);
    return { ...category, count: categoryEntries.length, availableCount: categoryEntries.filter((entry) => entry.available).length };
  }).filter((category) => category.count > 0);
  return {
    currentCityId: cityId,
    cityName: getCityDefinition(cityId).name,
    rhythm: `${style.name} adventure desk is posting ${style.tags.join(", ")} work with gear-relevant rewards.`,
    categories,
    entries,
    notices: getAdventureBoardNotices(cityId),
    generatedAt: Date.now(),
  };
}

function markHiddenSiteExplored(runtimeState, adventure, now) {
  const site = getHiddenSiteForAdventure(adventure);
  if (!site) return null;
  const player = asRecord(runtimeState.player);
  const worldDiscovery = { ...asRecord(player.worldDiscovery) };
  const hiddenSites = { ...asRecord(worldDiscovery.hiddenSites) };
  const current = asRecord(hiddenSites[site.id]);
  hiddenSites[site.id] = { ...current, status: "explored", source: "adventure", updatedAt: now, firstRumoredAt: current.firstRumoredAt ?? now, discoveredAt: current.discoveredAt ?? now, exploredAt: now };
  const discoveries = asArray(worldDiscovery.discoveries);
  worldDiscovery.hiddenSites = hiddenSites;
  worldDiscovery.discoveries = [{ id: `adventure_${site.id}_${now}`, siteId: site.id, status: "explored", title: `${site.name} explored`, summary: adventure.summary, createdAt: now, route: "/world-map" }, ...discoveries].slice(0, 40);
  player.worldDiscovery = worldDiscovery;
  runtimeState.player = player;
  return { id: site.id, name: site.name, status: "explored" };
}

export async function getAdventureBoardForUser(user) {
  return withTransaction(async (client) => {
    const { playerState, runtimeState } = await loadRuntimeState(client, user);
    return { playerState, board: buildBoard(runtimeState) };
  });
}

export async function startAdventureForUser(user, adventureId, payload = {}) {
  return withTransaction(async (client) => {
    const adventure = getAdventureDefinition(String(adventureId ?? ""));
    if (!adventure) throw new HttpError(404, "Adventure unavailable.", "ADVENTURE_NOT_FOUND");
    const { runtimeState } = await loadRuntimeState(client, user);
    const state = availability(runtimeState, adventure);
    if (!state.available) throw new HttpError(409, state.lockReason, "ADVENTURE_LOCKED");
    const now = Date.now();
    const combat = resolveCombat(runtimeState, adventure.opponent, { context: "adventure", now, combatItemId: typeof payload.combatItemId === "string" ? payload.combatItemId : null });
    let reward = null;
    let hiddenSite = null;
    if (combat.winner === "player") {
      reward = applyCombatReward(runtimeState, adventure.reward ?? {}, "adventure", now, adventure.extraDrops ?? []);
      hiddenSite = markHiddenSiteExplored(runtimeState, adventure, now);
      const player = asRecord(runtimeState.player);
      player.counters = { ...asRecord(player.counters), adventuresCompleted: Math.max(0, Math.floor(asNumber(player.counters?.adventuresCompleted, 0))) + 1, eliteHuntsWon: Math.max(0, Math.floor(asNumber(player.counters?.eliteHuntsWon, 0))) + (adventure.category === "elite_hunt" ? 1 : 0) };
      runtimeState.player = player;
    }
    addPlayerRecord(runtimeState, { category: "adventure", summary: `${adventure.title}: ${combat.outcome}${reward ? `, ${reward.items.length} item reward(s)` : ""}.`, detail: { adventureId: adventure.id, outcome: combat.outcome, reward, hiddenSite }, source: "adventure", route: "/adventure", timestamp: now });
    const playerState = await upsertPlayerRuntimeState(client, user.internalId, runtimeState);
    return { playerState, board: buildBoard(runtimeState), adventure: serializeAdventure(runtimeState, adventure), combat, reward, hiddenSite, message: reward ? `${adventure.title} completed. Rewards added to inventory.` : `${adventure.title} resolved as ${combat.outcome}.` };
  });
}
