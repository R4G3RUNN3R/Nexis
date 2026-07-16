import { withTransaction } from "../db/pool.js";
import { HttpError } from "../lib/errors.js";
import { buildMutableRuntimeState } from "../lib/runtimePlayerState.js";
import {
  createDefaultPlayerState,
  findPlayerStateByUserInternalId,
  upsertPlayerRuntimeState,
} from "../repositories/playerStateRepository.js";
import { getCityDefinition, normalizeCityId } from "../data/cityData.js";
import {
  EXCURSION_GRID,
  EXCURSION_LOCATIONS,
  calculateExcursionTiming,
  formatExcursionMs,
  getCityExcursionOrigin,
  getExcursionLocation,
  getGradeProfile,
} from "../data/excursionData.js";
import { getItemDefinition, getItemDisplayName, getItemSummary } from "../data/itemData.js";
import { addPlayerRecord, queueProgressionEvent } from "./playerRecordsService.js";
import { evaluateLegacyAchievementsForRuntime } from "./achievementService.js";

function asRecord(value) { return value && typeof value === "object" && !Array.isArray(value) ? value : {}; }
function asArray(value) { return Array.isArray(value) ? value : []; }
function asNumber(value, fallback = 0) { const numeric = Number(value); return Number.isFinite(numeric) ? numeric : fallback; }
function whole(value, fallback = 0) { return Math.max(0, Math.floor(asNumber(value, fallback))); }
function clamp(value, min, max) { return Math.max(min, Math.min(max, value)); }
function pick(list, random) { if (!list.length) return null; return list[Math.min(list.length - 1, Math.floor(random() * list.length))]; }
function chance(random, pct) { return random() < pct; }

async function loadRuntimeState(client, user) {
  await createDefaultPlayerState(client, user.internalId);
  const playerState = await findPlayerStateByUserInternalId(client, user.internalId);
  if (!playerState) throw new HttpError(404, "Player state unavailable.", "PLAYER_STATE_NOT_FOUND");
  return { playerState, runtimeState: buildMutableRuntimeState(user, playerState) };
}

function getCurrentCityId(runtimeState) {
  const travel = asRecord(runtimeState.travel);
  const current = asRecord(runtimeState.player?.current);
  return normalizeCityId(travel.currentCityId ?? current.currentCityId, "nexis");
}

function completedCourseSet(runtimeState) {
  const education = asRecord(runtimeState.education);
  const fromList = asArray(education.completedCourses).filter((entry) => typeof entry === "string");
  const fromRecord = Object.entries(asRecord(education.completed))
    .filter(([, value]) => value === true || asRecord(value).completed === true)
    .map(([courseId]) => courseId);
  return new Set([...fromList, ...fromRecord]);
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
  inventory[itemId] = whole(inventory[itemId], 0) + amount;
}

function addGold(runtimeState, amount) {
  const player = asRecord(runtimeState.player);
  const gold = whole(player.gold, 0) + Math.max(0, Math.floor(asNumber(amount, 0)));
  player.gold = gold;
  player.currencies = { ...asRecord(player.currencies), gold };
  runtimeState.player = player;
}

export function normalizeExcursionState(runtimeState) {
  const player = asRecord(runtimeState.player);
  const current = asRecord(player.excursions);
  player.excursions = {
    active: current.active && typeof current.active === "object" ? current.active : null,
    history: asArray(current.history).filter((entry) => entry && typeof entry === "object").slice(0, 80),
    fragments: {
      skill: { ...asRecord(asRecord(current.fragments).skill) },
      magic: { ...asRecord(asRecord(current.fragments).magic) },
    },
    lastCompletedAt: typeof current.lastCompletedAt === "number" ? current.lastCompletedAt : null,
  };
  runtimeState.player = player;
  return player.excursions;
}

function ensureCraftingDiscovery(runtimeState) {
  const player = asRecord(runtimeState.player);
  const crafting = { ...asRecord(player.crafting) };
  const current = asRecord(crafting.discovery);
  crafting.discovery = {
    discoveredRecipeIds: asArray(current.discoveredRecipeIds).filter((entry) => typeof entry === "string"),
    fragments: { ...asRecord(current.fragments) },
    history: asArray(current.history).filter((entry) => entry && typeof entry === "object").slice(0, 80),
  };
  player.crafting = crafting;
  runtimeState.player = player;
  return crafting.discovery;
}

export function getRecipeDiscoveryStatus(runtimeState, recipe) {
  if (!recipe?.discoveryOnly) {
    return { discovered: true, fragments: 0, requiredFragments: 0, status: "known", lockReason: null };
  }
  const discovery = ensureCraftingDiscovery(runtimeState);
  const discovered = discovery.discoveredRecipeIds.includes(recipe.id);
  const requiredFragments = Math.max(1, whole(recipe.fragmentTarget, 3));
  const fragments = whole(discovery.fragments[recipe.id], 0);
  return {
    discovered,
    fragments,
    requiredFragments,
    status: discovered ? "discovered" : fragments > 0 ? "fragmented" : "rumored",
    lockReason: discovered ? null : `Recipe not discovered. Search excursions for ${recipe.discoveryHint ?? "matching recipe fragments"}.`,
  };
}

function addRecipeDiscovery(runtimeState, recipeId, now, source, direct = false) {
  const discovery = ensureCraftingDiscovery(runtimeState);
  if (!discovery.discoveredRecipeIds.includes(recipeId)) {
    discovery.discoveredRecipeIds = [recipeId, ...discovery.discoveredRecipeIds];
    discovery.history = [{ id: `recipe_${recipeId}_${now}`, recipeId, source, direct, discoveredAt: now }, ...discovery.history].slice(0, 80);
    const player = asRecord(runtimeState.player);
    player.counters = { ...asRecord(player.counters), recipesDiscovered: whole(player.counters?.recipesDiscovered, 0) + 1 };
    runtimeState.player = player;
    queueProgressionEvent(runtimeState, {
      id: `recipe_discovery_${recipeId}_${now}`,
      type: "crafting",
      title: "Recipe discovered",
      summary: `${recipeId.replace(/-/g, " ")} is now available at its city bench.`,
      route: "/crafting",
      createdAt: now,
      detail: { recipeId, source, direct },
    });
    return true;
  }
  return false;
}

function applyRecipeProgress(runtimeState, progress, now, source) {
  const discovery = ensureCraftingDiscovery(runtimeState);
  const updates = [];
  for (const entry of progress) {
    if (!entry.recipeId) continue;
    if (entry.discoveredDirectly) {
      const discovered = addRecipeDiscovery(runtimeState, entry.recipeId, now, source, true);
      updates.push({ ...entry, fragments: entry.fragments ?? 0, totalFragments: whole(discovery.fragments[entry.recipeId], 0), discovered });
      continue;
    }
    const amount = Math.max(1, whole(entry.fragments, 1));
    const total = whole(discovery.fragments[entry.recipeId], 0) + amount;
    discovery.fragments[entry.recipeId] = total;
    const discovered = total >= Math.max(1, whole(entry.requiredFragments, 3)) ? addRecipeDiscovery(runtimeState, entry.recipeId, now, source, false) : false;
    updates.push({ ...entry, fragments: amount, totalFragments: total, discovered });
  }
  return updates;
}

function applyBookFragments(runtimeState, kind, entries, now) {
  const state = normalizeExcursionState(runtimeState);
  const bucket = kind === "magic" ? state.fragments.magic : state.fragments.skill;
  const books = [];
  for (const entry of entries) {
    const family = String(entry.family ?? kind);
    const amount = Math.max(1, whole(entry.quantity, 1));
    bucket[family] = whole(bucket[family], 0) + amount;
    while (bucket[family] >= 10) {
      bucket[family] -= 10;
      const bookItemId = kind === "magic" ? "bound_spellbook" : "compiled_skill_manual";
      addInventory(runtimeState, bookItemId, 1);
      books.push({ family, itemId: bookItemId, quantity: 1, completedAt: now });
    }
  }
  return books;
}

export function rollExcursionReward(location, options = {}) {
  const random = typeof options.random === "function" ? options.random : Math.random;
  const now = typeof options.now === "number" ? options.now : Date.now();
  const completedCourses = options.completedCourses instanceof Set ? options.completedCourses : new Set();
  const profile = getGradeProfile(location.recipeGrade);
  const educationBoost = completedCourses.has("world-geography") ? 1.12 : 1;
  const historyBoost = completedCourses.has("historical-awareness") ? 1.1 : 1;
  const appliedBoost = completedCourses.has("applied-knowledge") ? 1.08 : 1;
  const discoveryBoost = clamp(educationBoost * historyBoost * appliedBoost, 0.85, 1.36);
  const [minGold, maxGold] = location.goldRange ?? [18, 80];
  const gold = Math.floor(minGold + random() * Math.max(1, maxGold - minGold + 1));
  const items = [];
  const recipeProgress = [];
  const skillFragments = [];
  const magicFragments = [];
  const rareFinds = [];
  let knowledge = 0;
  let absoluteFragment = null;

  if (chance(random, 0.72)) {
    const material = pick(location.materialDrops, random);
    if (material) items.push({ ...material, source: "material" });
  }
  if (chance(random, 0.28 * discoveryBoost)) {
    const [minKnowledge, maxKnowledge] = location.knowledgeRange ?? [1, 3];
    knowledge = Math.floor(minKnowledge + random() * Math.max(1, maxKnowledge - minKnowledge + 1));
  }
  if (location.recipeId && chance(random, profile.recipeFragmentChance * discoveryBoost)) {
    recipeProgress.push({ recipeId: location.recipeId, grade: location.recipeGrade, fragments: 1, requiredFragments: location.recipeFragmentTarget, discoveredDirectly: false });
  }
  if (location.recipeId && chance(random, profile.recipeDirectChance * discoveryBoost)) {
    recipeProgress.push({ recipeId: location.recipeId, grade: location.recipeGrade, fragments: 0, requiredFragments: location.recipeFragmentTarget, discoveredDirectly: true });
  }
  if (chance(random, 0.09 * discoveryBoost)) {
    const fragment = pick(location.skillFragments, random);
    if (fragment) skillFragments.push({ ...fragment, source: "skill" });
  }
  if (chance(random, 0.07 * discoveryBoost)) {
    const fragment = pick(location.magicFragments, random);
    if (fragment) magicFragments.push({ ...fragment, source: "magic" });
  }
  if (location.absoluteFragment && chance(random, 0.03 * historyBoost)) {
    absoluteFragment = { itemId: "absolute_story_fragment", quantity: 1 };
    items.push({ ...absoluteFragment, source: "absolute" });
  }
  if (chance(random, 0.02 * discoveryBoost)) {
    const piece = pick(location.itemPieces, random);
    if (piece) {
      const drop = { ...piece, source: "item_piece" };
      items.push(drop);
      rareFinds.push(drop);
    }
  }
  if (chance(random, 0.001 * discoveryBoost)) {
    const rare = pick(location.rareItems, random);
    if (rare) {
      const drop = { ...rare, source: "rare_item" };
      items.push(drop);
      rareFinds.push(drop);
    }
  }
  if (chance(random, 0.012 * discoveryBoost)) {
    const book = pick(location.trainingBooks, random);
    if (book) items.push({ ...book, source: "training_book" });
  }

  return { id: `reward_${location.id}_${now}`, locationId: location.id, gold, items, recipeProgress, skillFragments, magicFragments, rareFinds, knowledge, absoluteFragment, rolledAt: now };
}

export function applyExcursionCompletionToRuntime(runtimeState, active, options = {}) {
  const now = typeof options.now === "number" ? options.now : Date.now();
  if (!active || now < whole(active.completesAt, Number.MAX_SAFE_INTEGER)) return { completed: false, reward: null };
  const location = getExcursionLocation(active.locationId);
  if (!location) return { completed: false, reward: null };
  const completedCourses = completedCourseSet(runtimeState);
  const reward = rollExcursionReward(location, { random: options.random, now, playerLevel: whole(runtimeState.player?.level, 1), completedCourses });
  const recipeUpdates = applyRecipeProgress(runtimeState, reward.recipeProgress, now, location.name);
  const skillBooks = applyBookFragments(runtimeState, "skill", reward.skillFragments, now);
  const magicBooks = applyBookFragments(runtimeState, "magic", reward.magicFragments, now);

  addGold(runtimeState, reward.gold);
  for (const item of reward.items) addInventory(runtimeState, item.itemId, item.quantity);

  const state = normalizeExcursionState(runtimeState);
  const foundItemQuantity = reward.items.reduce((sum, item) => sum + Math.max(1, whole(item.quantity, 1)), 0);
  const rareFindQuantity = reward.rareFinds.reduce((sum, item) => sum + Math.max(1, whole(item.quantity, 1)), 0);
  const player = asRecord(runtimeState.player);
  player.counters = {
    ...asRecord(player.counters),
    excursionsCompleted: whole(player.counters?.excursionsCompleted, 0) + 1,
    excursionItemsFound: whole(player.counters?.excursionItemsFound, 0) + foundItemQuantity,
    excursionRareFinds: whole(player.counters?.excursionRareFinds, 0) + rareFindQuantity,
  };
  runtimeState.player = player;

  const completedEntry = {
    id: active.id,
    locationId: location.id,
    locationName: location.name,
    riskBand: location.riskBand,
    startedAt: active.startedAt,
    completedAt: now,
    timing: active.timing,
    reward: { ...reward, recipeProgress: recipeUpdates, skillBooks, magicBooks },
  };
  state.history = [completedEntry, ...state.history].slice(0, 80);
  state.lastCompletedAt = now;
  state.active = null;

  addPlayerRecord(runtimeState, {
    id: `record_excursion_${location.id}_${now}`,
    category: "exploration",
    summary: `Excursion completed: ${location.name}.`,
    detail: { locationId: location.id, reward: completedEntry.reward },
    source: "excursions",
    route: "/adventure",
    timestamp: now,
  });
  queueProgressionEvent(runtimeState, {
    id: `excursion_complete_${location.id}_${now}`,
    type: "exploration",
    title: "Excursion returned",
    summary: `${location.name}: ${reward.gold} gold, ${foundItemQuantity} item line(s), ${recipeUpdates.length} recipe clue(s).`,
    route: "/adventure",
    createdAt: now,
    detail: { locationId: location.id, reward: completedEntry.reward },
  });
  return { completed: true, reward: completedEntry.reward, historyEntry: completedEntry };
}

function availability(runtimeState, location) {
  if (!location) return { available: false, lockReason: "Excursion location unavailable." };
  const travel = asRecord(runtimeState.travel);
  if (travel.status === "in_transit") return { available: false, lockReason: "Finish current travel before starting an excursion." };
  const state = normalizeExcursionState(runtimeState);
  if (state.active) return { available: false, lockReason: "Complete or wait for the active excursion to return first." };
  const completed = completedCourseSet(runtimeState);
  const missing = location.requiredCourses.filter((courseId) => !completed.has(courseId));
  if (missing.length) return { available: false, lockReason: `Locked: requires ${missing.map((entry) => entry.replace(/-/g, " ")).join(", ")}.` };
  return { available: true, lockReason: null };
}

function serializeLocation(runtimeState, location) {
  const currentCityId = getCurrentCityId(runtimeState);
  const originBox = getCityExcursionOrigin(currentCityId);
  const timing = calculateExcursionTiming({ originBox, targetBox: location.box });
  const state = availability(runtimeState, location);
  const profile = getGradeProfile(location.recipeGrade);
  const recipeStatus = location.recipeId ? getRecipeDiscoveryStatus(runtimeState, { id: location.recipeId, discoveryOnly: true, fragmentTarget: location.recipeFragmentTarget }) : null;
  return {
    id: location.id,
    name: location.name,
    type: location.type,
    regionId: location.regionId,
    box: location.box,
    xPercent: location.xPercent,
    yPercent: location.yPercent,
    riskBand: location.riskBand,
    summary: location.summary,
    rewardFocus: location.rewardFocus,
    recipeGrade: location.recipeGrade,
    recipeId: location.recipeId,
    recipeFragmentTarget: location.recipeFragmentTarget,
    recipeStatus,
    requiredCourses: location.requiredCourses,
    tags: location.tags,
    cityAffinity: location.cityAffinity,
    goldRange: location.goldRange,
    timing: { ...timing, outboundLabel: formatExcursionMs(timing.outboundMs), exploreLabel: formatExcursionMs(timing.exploreMs), returnLabel: formatExcursionMs(timing.returnMs), totalLabel: formatExcursionMs(timing.totalMs) },
    chanceSummary: {
      recipeFragment: Math.round(profile.recipeFragmentChance * 1000) / 10,
      directRecipe: Math.round(profile.recipeDirectChance * 10000) / 100,
      itemPiece: 2,
      rareItem: 0.1,
    },
    available: state.available,
    lockReason: state.lockReason,
  };
}

function serializeActive(active) {
  if (!active) return null;
  const location = getExcursionLocation(active.locationId);
  const now = Date.now();
  const remainingMs = Math.max(0, whole(active.completesAt, now) - now);
  const elapsedMs = Math.max(0, now - whole(active.startedAt, now));
  const totalMs = Math.max(1, whole(active.timing?.totalMs, 1));
  return { ...active, location: location ? { id: location.id, name: location.name, riskBand: location.riskBand, type: location.type } : null, remainingMs, remainingLabel: formatExcursionMs(remainingMs), progressPct: Math.max(0, Math.min(100, Math.round((elapsedMs / totalMs) * 100))) };
}

function serializeBoard(runtimeState, message = null) {
  const state = normalizeExcursionState(runtimeState);
  const currentCityId = getCurrentCityId(runtimeState);
  const originBox = getCityExcursionOrigin(currentCityId);
  const counters = asRecord(runtimeState.player?.counters);
  return {
    grid: EXCURSION_GRID,
    currentCityId,
    currentCityName: getCityDefinition(currentCityId).name,
    originBox,
    active: serializeActive(state.active),
    locations: EXCURSION_LOCATIONS.map((location) => serializeLocation(runtimeState, location)),
    history: state.history.slice(0, 12),
    fragments: state.fragments,
    counters: {
      excursionsCompleted: whole(counters.excursionsCompleted, 0),
      excursionItemsFound: whole(counters.excursionItemsFound, 0),
      excursionRareFinds: whole(counters.excursionRareFinds, 0),
      recipesDiscovered: whole(counters.recipesDiscovered, 0),
    },
    message,
    generatedAt: Date.now(),
  };
}

function resolveDue(runtimeState, user, now = Date.now()) {
  const state = normalizeExcursionState(runtimeState);
  if (!state.active || now < whole(state.active.completesAt, Number.MAX_SAFE_INTEGER)) return null;
  const result = applyExcursionCompletionToRuntime(runtimeState, state.active, { now });
  evaluateLegacyAchievementsForRuntime(runtimeState, user, now);
  return result;
}

export async function getExcursionBoardForUser(user) {
  return withTransaction(async (client) => {
    const { runtimeState } = await loadRuntimeState(client, user);
    const completion = resolveDue(runtimeState, user);
    const playerState = completion ? await upsertPlayerRuntimeState(client, user.internalId, runtimeState) : await findPlayerStateByUserInternalId(client, user.internalId);
    const hydrated = buildMutableRuntimeState(user, playerState);
    return { playerState, board: serializeBoard(hydrated, completion?.completed ? "Excursion returned. Rewards were recorded." : null), completion: completion?.historyEntry ?? null };
  });
}

export async function startExcursionForUser(user, locationId) {
  return withTransaction(async (client) => {
    const location = getExcursionLocation(String(locationId ?? ""));
    if (!location) throw new HttpError(404, "Excursion location unavailable.", "EXCURSION_NOT_FOUND");
    const { runtimeState } = await loadRuntimeState(client, user);
    resolveDue(runtimeState, user);
    const state = availability(runtimeState, location);
    if (!state.available) throw new HttpError(409, state.lockReason, "EXCURSION_LOCKED");
    const now = Date.now();
    const originCityId = getCurrentCityId(runtimeState);
    const originBox = getCityExcursionOrigin(originCityId);
    const timing = calculateExcursionTiming({ originBox, targetBox: location.box });
    const active = {
      id: `excursion_${location.id}_${now}`,
      locationId: location.id,
      originCityId,
      originBox,
      targetBox: location.box,
      startedAt: now,
      outboundArrivesAt: now + timing.outboundMs,
      exploreCompletesAt: now + timing.outboundMs + timing.exploreMs,
      completesAt: now + timing.totalMs,
      timing,
      status: "active",
    };
    const excursionState = normalizeExcursionState(runtimeState);
    excursionState.active = active;
    addPlayerRecord(runtimeState, { category: "exploration", summary: `Excursion started: ${location.name}.`, detail: { locationId: location.id, timing }, source: "excursions", route: "/adventure", timestamp: now });
    const playerState = await upsertPlayerRuntimeState(client, user.internalId, runtimeState);
    const hydrated = buildMutableRuntimeState(user, playerState);
    return { playerState, board: serializeBoard(hydrated, `${location.name} excursion started. Return in ${formatExcursionMs(timing.totalMs)}.`), excursion: serializeActive(active) };
  });
}
