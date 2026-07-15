import { withTransaction } from "../db/pool.js";
import { HttpError } from "../lib/errors.js";
import { buildMutableRuntimeState } from "../lib/runtimePlayerState.js";
import { createDefaultPlayerState, findPlayerStateByUserInternalId, upsertPlayerRuntimeState } from "../repositories/playerStateRepository.js";
import { getCityDefinition, normalizeCityId } from "../data/cityData.js";
import { ADVENTURE_CATEGORIES, getAdventureBoardNotices, getAdventureCategory, getAdventureCityStyle, getAdventureDefinition, getAdventureDefinitions, getHiddenSiteForAdventure } from "../data/adventureData.js";
import { getItemDisplayName, getItemSummary } from "../data/itemData.js";
import { rollLoot } from "../data/lootData.js";
import { applyCombatReward, resolveCombat } from "./combatService.js";
import { addPlayerRecord } from "./playerRecordsService.js";
import { evaluateLegacyAchievementsForRuntime } from "./achievementService.js";

function asRecord(value) { return value && typeof value === "object" && !Array.isArray(value) ? value : {}; }
function asArray(value) { return Array.isArray(value) ? value : []; }
function asNumber(value, fallback = 0) { const numeric = Number(value); return Number.isFinite(numeric) ? numeric : fallback; }
function currentCityId(runtimeState) { const travel = asRecord(runtimeState.travel); const current = asRecord(runtimeState.player?.current); return normalizeCityId(travel.currentCityId ?? current.currentCityId ?? "nexis"); }
function statusRank(status) { return { unknown: 0, rumored: 1, discovered: 2, explored: 3 }[String(status ?? "unknown")] ?? 0; }
function hiddenSiteRecord(runtimeState, siteId) { return asRecord(asRecord(asRecord(runtimeState.player).worldDiscovery).hiddenSites)[siteId]; }
function levelOf(runtimeState) { return Math.max(1, Math.floor(asNumber(runtimeState.player?.level, 1))); }
function sourcePaths(adventure) { return asArray(adventure.acquisition).map((label) => ({ label, detail: adventure.sourceLabel ?? "Adventure source", route: label.includes("Market") ? "/market" : label.includes("Hidden") ? "/world-map" : "/adventure" })); }

// Server-side status of an item-gated adventure's requirement (e.g. Smuggler's Gate needs a
// Worn Caravan Seal). Shared by availability() (enforcement) and serializeAdventure() (UI display)
// so the lock reason shown to the player and the reason an attempt is rejected can never drift apart.
function getRequiredItemStatus(runtimeState, adventure) {
  if (!adventure.requiredItemId) return null;
  const inventory = asRecord(asRecord(runtimeState.player).inventory);
  const owned = Math.max(0, Math.floor(asNumber(inventory[adventure.requiredItemId], 0)));
  const quantity = Math.max(1, Math.floor(asNumber(adventure.requiredItemQuantity, 1)));
  return {
    itemId: adventure.requiredItemId,
    label: getItemDisplayName(adventure.requiredItemId),
    quantity,
    owned,
    met: owned >= quantity,
    hint: adventure.requiredItemHint ?? null,
  };
}

// Pity-protection status for an adventure with a rare chance-based key-item drop. Guarantees the
// item on the next win once `pityThreshold` completed (won) runs have passed without it dropping.
function getPityStatus(runtimeState, adventure) {
  if (!adventure.pityItemId || !adventure.pityThreshold) return null;
  const pity = asRecord(asRecord(runtimeState.player).lootPity);
  const attempts = Math.max(0, Math.floor(asNumber(pity[adventure.id], 0)));
  return {
    itemId: adventure.pityItemId,
    itemLabel: getItemDisplayName(adventure.pityItemId),
    attempts,
    threshold: adventure.pityThreshold,
    guaranteedOnNextWin: attempts + 1 >= adventure.pityThreshold,
  };
}

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
  // Server-side enforcement of item-gated adventures (e.g. Smuggler's Gate requires a Worn Caravan
  // Seal). This runs on every startAdventureForUser call, not just the board listing, so the attempt
  // is rejected even if a client skips or tampers with the UI's disabled/hidden Start button.
  const requiredItem = getRequiredItemStatus(runtimeState, adventure);
  if (requiredItem && !requiredItem.met) {
    const need = requiredItem.quantity > 1 ? `${requiredItem.quantity}x ${requiredItem.label}` : requiredItem.label;
    const hint = requiredItem.hint ? ` ${requiredItem.hint}` : "";
    return { available: false, lockReason: `Locked: requires ${need} (have ${requiredItem.owned}).${hint}` };
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
    requiredItem: getRequiredItemStatus(runtimeState, adventure),
    pityProgress: getPityStatus(runtimeState, adventure),
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

// Consumes the adventure's required item on a successful (won) attempt. Documented consumption
// point: the item is spent on victory, not merely on attempt, so a losing attempt never costs the
// player their copy and can be retried. Runs inside the same withTransaction as the rest of
// startAdventureForUser and mutates runtimeState in place, so the decrement is persisted atomically
// with the reward grant in the single upsertPlayerRuntimeState call at the end of that transaction —
// there is no window where a second request could reuse the same item copy for another reward.
function consumeRequiredItem(runtimeState, adventure) {
  if (!adventure.requiredItemId) return;
  const player = asRecord(runtimeState.player);
  const inventory = { ...asRecord(player.inventory) };
  const owned = Math.max(0, Math.floor(asNumber(inventory[adventure.requiredItemId], 0)));
  const quantity = Math.max(1, Math.floor(asNumber(adventure.requiredItemQuantity, 1)));
  // Defensive re-check: availability() already gated this at the top of startAdventureForUser, but
  // re-validating right at the consumption site keeps this function safe to call on its own.
  if (owned < quantity) throw new HttpError(409, `Locked: requires ${getItemDisplayName(adventure.requiredItemId)}.`, "ADVENTURE_LOCKED");
  const next = owned - quantity;
  if (next > 0) inventory[adventure.requiredItemId] = next;
  else delete inventory[adventure.requiredItemId];
  player.inventory = inventory;
  runtimeState.player = player;
}

// Applies pity protection to a won run of an adventure with a chance-based key-item drop: if the
// item didn't roll and the player has now hit adventure.pityThreshold consecutive won-but-empty
// runs, force the drop and reset the counter. Otherwise increments (or resets on a natural drop).
// Tracked in player.lootPity[adventure.id], persisted the same way as every other counter here.
function applyLootPity(runtimeState, adventure, extraDrops) {
  if (!adventure.pityItemId || !adventure.pityThreshold) return extraDrops;
  const player = asRecord(runtimeState.player);
  const pity = { ...asRecord(player.lootPity) };
  const attempts = Math.max(0, Math.floor(asNumber(pity[adventure.id], 0)));
  const alreadyDropped = extraDrops.some((drop) => asRecord(drop).itemId === adventure.pityItemId);
  let nextDrops = extraDrops;
  if (alreadyDropped) {
    pity[adventure.id] = 0;
  } else if (attempts + 1 >= adventure.pityThreshold) {
    pity[adventure.id] = 0;
    nextDrops = extraDrops.concat([{ itemId: adventure.pityItemId, quantity: 1 }]);
  } else {
    pity[adventure.id] = attempts + 1;
  }
  player.lootPity = pity;
  runtimeState.player = player;
  return nextDrops;
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
      // Item-gated adventures (Smuggler's Gate) consume their required item only on a win. Placed
      // before reward resolution so a thrown HttpError here rolls back the whole transaction and no
      // reward is ever granted without the item being spent.
      if (adventure.requiredItemId) consumeRequiredItem(runtimeState, adventure);
      let extraDrops = asArray(adventure.extraDrops);
      // Chance-based drop roll happens server-side via the shared loot table, the same rollLoot()
      // pattern combatService.js's resolveNpcCombatWithRewards() already uses for NPC loot families —
      // no parallel randomization path.
      if (adventure.lootFamily) extraDrops = extraDrops.concat(rollLoot(adventure.lootFamily, Math.random));
      extraDrops = applyLootPity(runtimeState, adventure, extraDrops);
      reward = applyCombatReward(runtimeState, adventure.reward ?? {}, "adventure", now, extraDrops);
      hiddenSite = markHiddenSiteExplored(runtimeState, adventure, now);
      const player = asRecord(runtimeState.player);
      player.counters = { ...asRecord(player.counters), adventuresCompleted: Math.max(0, Math.floor(asNumber(player.counters?.adventuresCompleted, 0))) + 1, eliteHuntsWon: Math.max(0, Math.floor(asNumber(player.counters?.eliteHuntsWon, 0))) + (adventure.category === "elite_hunt" ? 1 : 0) };
      runtimeState.player = player;
      // Chronicle milestone logging for adventures that define one (e.g. Smuggler's Gate), following
      // the same addPlayerRecord() pattern used elsewhere in this file and across 14+ other services.
      if (adventure.chronicleMilestone) {
        // Explicit id: addPlayerRecord() auto-generates `record_${category}_${source}_${now}` when
        // no id is given, which would collide with the general completion record below (same
        // category, source, and timestamp) and silently drop one of the two entries.
        addPlayerRecord(runtimeState, { id: `adventure_milestone_${adventure.id}_${now}`, category: "adventure", summary: adventure.chronicleMilestone, detail: { adventureId: adventure.id, milestone: true }, source: "adventure", route: "/adventure", timestamp: now });
      }
    }
    addPlayerRecord(runtimeState, { category: "adventure", summary: `${adventure.title}: ${combat.outcome}${reward ? `, ${reward.items.length} item reward(s)` : ""}.`, detail: { adventureId: adventure.id, outcome: combat.outcome, reward, hiddenSite }, source: "adventure", route: "/adventure", timestamp: now });
    evaluateLegacyAchievementsForRuntime(runtimeState, user, now);
    const playerState = await upsertPlayerRuntimeState(client, user.internalId, runtimeState);
    return { playerState, board: buildBoard(runtimeState), adventure: serializeAdventure(runtimeState, adventure), combat, reward, hiddenSite, message: reward ? `${adventure.title} completed. Rewards added to inventory.` : `${adventure.title} resolved as ${combat.outcome}.` };
  });
}
