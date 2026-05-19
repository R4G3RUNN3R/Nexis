import { withTransaction } from "../db/pool.js";
import { HttpError } from "../lib/errors.js";
import { buildMutableRuntimeState } from "../lib/runtimePlayerState.js";
import {
  createDefaultPlayerState,
  findPlayerStateByUserInternalId,
  upsertPlayerRuntimeState,
} from "../repositories/playerStateRepository.js";
import { getTravelOpponentForRoute } from "../data/combatData.js";
import { rollLoot } from "../data/lootData.js";
import { resolveCombat } from "./combatService.js";
import {
  DEFAULT_CITY_ID,
  getCityName,
  getRouteDefinition,
  isValidCityId,
  normalizeCityId,
} from "../data/travelData.js";

const TRAVEL_WIN_DELAY_MS = 5 * 60 * 1000;
const ENCOUNTER_REWARD_COOLDOWN_MS = 15 * 60 * 1000;

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

function normalizeEncounterNotice(value) {
  const record = asRecord(value);
  if (!Object.keys(record).length) return null;
  return record;
}

function cloneTravelState(runtimeState) {
  const record = asRecord(runtimeState.travel);
  const currentCityId = normalizeCityId(record.currentCityId, DEFAULT_CITY_ID);
  return {
    status: record.status === "in_transit" ? "in_transit" : "idle",
    originCityId: normalizeCityId(record.originCityId, currentCityId),
    destinationCityId:
      typeof record.destinationCityId === "string" && record.destinationCityId
        ? normalizeCityId(record.destinationCityId, null)
        : null,
    routeType: record.routeType === "sea" || record.routeType === "mixed" ? record.routeType : "road",
    mode: typeof record.mode === "string" ? record.mode : "caravan",
    departureAt: typeof record.departureAt === "number" ? record.departureAt : null,
    arrivalAt: typeof record.arrivalAt === "number" ? record.arrivalAt : null,
    durationMs: typeof record.durationMs === "number" ? record.durationMs : null,
    currentCityId,
    arrivalNotice: normalizeEncounterNotice(record.arrivalNotice),
    encounterNotice: normalizeEncounterNotice(record.encounterNotice),
  };
}

function syncTravelOntoPlayer(runtimeState, travelState) {
  runtimeState.travel = travelState;
  runtimeState.player.current = {
    ...(runtimeState.player.current ?? {}),
    currentCityId: travelState.currentCityId,
    travel: travelState,
  };
}

function hasCompletedCourse(runtimeState, courseId) {
  const education = asRecord(runtimeState.education);
  const completedCourses = Array.isArray(education.completedCourses) ? education.completedCourses : [];
  if (completedCourses.includes(courseId)) return true;

  const completed = asRecord(education.completed);
  const courseRecord = asRecord(completed[courseId]);
  return completed[courseId] === true || courseRecord.completed === true;
}

function getTravelPower(runtimeState, hasWorldGeography) {
  const player = asRecord(runtimeState.player);
  const battle = asRecord(player.battleStats);
  const working = asRecord(player.workingStats);
  const stats = asRecord(player.stats);
  const battleAverage =
    (asNumber(battle.strength, 10) +
      asNumber(battle.defense, 10) +
      asNumber(battle.speed, 10) +
      asNumber(battle.dexterity, 10)) /
    4;
  const endurance = asNumber(working.endurance, 10);
  const stamina = asNumber(stats.stamina, 10);
  const level = Math.max(1, asNumber(player.level, 1));
  return battleAverage * 1.35 + endurance * 0.75 + stamina * 0.9 + level * 7 + (hasWorldGeography ? 30 : -10);
}

const ENCOUNTER_REWARD_PROFILES = [
  {
    tags: ["sea_lane", "smuggling_pressure", "privateer_waters"],
    goldBase: 36,
    goldDanger: 58,
    items: [
      { itemId: "rations", label: "Rations" },
      { itemId: "healing_tonic", label: "Healing Tonic" },
      { itemId: "torn_map", label: "Tattered Map" },
    ],
    discoveries: [
      "a marked tide channel near Blackharbor",
      "a foreign-goods rumor passed between dock brokers",
      "a safer pier approach for future escort contracts",
    ],
  },
  {
    tags: ["warded_woods", "relic_material_trade", "northern_road"],
    goldBase: 24,
    goldDanger: 46,
    items: [
      { itemId: "wild_herb", label: "Wild Herb" },
      { itemId: "medicinal_herb", label: "Medicinal Herb" },
      { itemId: "torn_map", label: "Tattered Map" },
    ],
    discoveries: [
      "a ward lantern marker outside Silverbough",
      "a relic-caravan footnote worth showing the Conservatory",
      "a safer herbalist path through the northern verge",
    ],
  },
  {
    tags: ["forge_road", "material_convoys", "highland_forge_road", "industrial_court_road"],
    goldBase: 30,
    goldDanger: 52,
    items: [
      { itemId: "coal", label: "Coal" },
      { itemId: "iron_ore", label: "Iron Ore" },
      { itemId: "rope", label: "Rope" },
    ],
    discoveries: [
      "a damaged brace marker on the Ironhall road",
      "a convoy pull-off useful for future material hauls",
      "a forge-road shortcut that needs a better map later",
    ],
  },
  {
    tags: ["court_road", "permit_checks", "permit_caravans", "legal_cargo_lane"],
    goldBase: 28,
    goldDanger: 44,
    items: [
      { itemId: "vial_of_ink", label: "Vial of Ink" },
      { itemId: "wax_seal", label: "Wax Seal" },
      { itemId: "rations", label: "Rations" },
    ],
    discoveries: [
      "a Highcourt permit checkpoint with flexible hours",
      "a court-road clerk who remembers polite travelers",
      "a stamped detour note that may matter later",
    ],
  },
];

function getRewardProfile(route) {
  const tags = Array.isArray(route?.encounterTags) ? route.encounterTags : [];
  return ENCOUNTER_REWARD_PROFILES.find((profile) => profile.tags.some((tag) => tags.includes(tag))) ?? ENCOUNTER_REWARD_PROFILES[0];
}

function pickEncounterReward(route, outcome, randomFn, hasWorldGeography) {
  if (outcome !== "victory" && outcome !== "costly_victory") return null;
  const routeDanger = clamp(asNumber(route.danger, 0.3), 0, 1);
  const profile = getRewardProfile(route);
  const gold = Math.max(6, Math.round(profile.goldBase + routeDanger * profile.goldDanger));
  const experience = outcome === "victory" ? 22 : 12;
  const itemChance = outcome === "victory" ? 0.45 : 0.28;
  const discoveryChance = hasWorldGeography ? 0.42 : 0.14;
  const item = randomFn() < itemChance ? profile.items[Math.floor(randomFn() * profile.items.length)] : null;
  const discovery = randomFn() < discoveryChance ? profile.discoveries[Math.floor(randomFn() * profile.discoveries.length)] : null;
  return { gold, experience, item, discovery, throttled: false };
}

export function resolveTravelEncounterForRoute(runtimeState, route, now = Date.now(), randomFn = Math.random) {
  const hasWorldGeography = hasCompletedCourse(runtimeState, "world-geography");
  const routeDanger = clamp(asNumber(route?.danger, 0.3), 0, 1);
  const durationFactor = clamp(asNumber(route?.durationMs, 10 * 60 * 1000) / (22 * 60 * 1000), 0.15, 1.2);
  const encounterChance = clamp(0.08 + routeDanger * 0.38 + durationFactor * 0.14 + (hasWorldGeography ? -0.12 : 0.22), 0.05, 0.82);
  const encounterRoll = randomFn();

  if (encounterRoll > encounterChance) {
    return null;
  }

  const routeName = `${getCityName(route.originCityId ?? route.from)} to ${getCityName(route.destinationCityId ?? route.to)}`;
  const routePower = getTravelPower(runtimeState, hasWorldGeography);
  const routePressure = 48 + routeDanger * 78 + durationFactor * 24;
  const handlingRoll = randomFn();

  if ((hasWorldGeography && handlingRoll < 0.32) || (!hasWorldGeography && handlingRoll < 0.08 && routePower > routePressure)) {
    return {
      happened: true,
      outcome: "avoided",
      title: "Encounter Avoided",
      summary: hasWorldGeography
        ? `World Geography helped you read the ${routeName} route and avoid trouble before it found you.`
        : `You spotted trouble on the ${routeName} route early enough to steer clear, barely.`,
      hasWorldGeography,
      encounterChance: Math.round(encounterChance * 100),
      routeDanger: Math.round(routeDanger * 100),
      delayMs: 0,
      reward: null,
      resolvedAt: now,
    };
  }

  const opponent = getTravelOpponentForRoute(route);
  const combat = resolveCombat(runtimeState, opponent, {
    context: "travel",
    now,
    randomFn,
    bonusSkillXp: hasWorldGeography ? 1 : 0,
    rounds: hasWorldGeography ? 8 : 7,
  });
  const healthRatio = combat.player.maxHealth > 0 ? combat.player.health / combat.player.maxHealth : 0;
  let outcome = "victory";
  if (combat.winner === "player") {
    outcome = healthRatio > 0.48 || hasWorldGeography ? "victory" : "costly_victory";
  } else {
    outcome = hasWorldGeography && randomFn() > 0.38 ? "costly_victory" : "turned_back";
  }

  const reward = pickEncounterReward(route, outcome, randomFn, hasWorldGeography);
  const lootDrops = outcome === "victory" || outcome === "costly_victory" ? rollLoot(opponent.lootFamily ?? "bandit", randomFn) : [];
  if (reward && lootDrops.length) reward.items = [...(reward.item ? [reward.item] : []), ...lootDrops];
  const titles = {
    victory: "Encounter Victory",
    costly_victory: "Costly Victory",
    turned_back: "Turned Back",
  };
  const summaries = {
    victory: `You handled trouble on the ${routeName} route. The caravan continues after a short delay.`,
    costly_victory: `You forced your way through trouble on the ${routeName} route, but it cost time and stamina.`,
    turned_back: `The ${routeName} route went badly. The caravan turned back to avoid a worse loss.`,
  };

  return {
    happened: true,
    outcome,
    title: titles[outcome],
    summary: summaries[outcome],
    hasWorldGeography,
    encounterChance: Math.round(encounterChance * 100),
    routeDanger: Math.round(routeDanger * 100),
    delayMs: outcome === "victory" || outcome === "costly_victory" ? TRAVEL_WIN_DELAY_MS : 0,
    reward,
    combat: {
      opponent: combat.opponent,
      winner: combat.winner,
      outcome: combat.outcome,
      energySpent: combat.energySpent,
      combatXpGained: combat.combatXpGained,
      skillXpGained: combat.skillXpGained,
      player: combat.player,
      opponentState: combat.opponentState,
      activeSkills: combat.activeSkills,
      skillEvents: combat.skillEvents,
      log: combat.log.slice(0, 8),
    },
    penalties: outcome === "costly_victory" ? { health: 6, stamina: 1 } : outcome === "turned_back" ? { health: 8, stamina: 1 } : null,
    resolvedAt: now,
  };
}


function recordTravelDiscovery(runtimeState, encounter, now) {
  const discovery = encounter?.reward?.discovery;
  if (!discovery || !encounter?.hasWorldGeography) return;
  const education = asRecord(runtimeState.education);
  const discoveries = asArray(education.discoveries);
  const id = `travel_${String(discovery).toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "").slice(0, 48)}`;
  if (discoveries.some((entry) => asRecord(entry).id === id)) { runtimeState.education = education; return; }
  education.discoveries = [{ id, kind: "travel", title: "Route discovery", summary: discovery, status: "discovered", discoveredAt: now, source: encounter.title ?? "Travel encounter" }, ...discoveries].slice(0, 80);
  runtimeState.education = education;
}

function applyTravelEncounterResult(runtimeState, encounter, now) {
  if (!encounter) return encounter;
  const player = runtimeState.player;
  player.counters = { ...asRecord(player.counters) };
  player.stats = { ...asRecord(player.stats) };

  if (encounter.penalties) {
    player.stats.health = Math.max(1, asNumber(player.stats.health, 100) - asNumber(encounter.penalties.health, 0));
    player.stats.stamina = Math.max(0, asNumber(player.stats.stamina, 10) - asNumber(encounter.penalties.stamina, 0));
  }

  const reward = encounter.reward;
  if (!reward) return encounter;

  const lastRewardAt = asNumber(player.counters.lastTravelEncounterRewardAt, 0);
  if (lastRewardAt && now - lastRewardAt < ENCOUNTER_REWARD_COOLDOWN_MS) {
    return {
      ...encounter,
      reward: { ...reward, gold: 0, experience: 0, item: null, items: [], discovery: null, throttled: true },
      summary: `${encounter.summary} You found no extra spoils this time; the route rewards are still cooling down.`,
    };
  }

  player.gold = Math.max(0, Math.floor(asNumber(player.gold, 500) + asNumber(reward.gold, 0)));
  player.currencies = { ...asRecord(player.currencies), gold: player.gold };
  player.experience = Math.max(0, Math.floor(asNumber(player.experience, 0) + asNumber(reward.experience, 0)));
  const rewardItems = asArray(reward.items).length ? asArray(reward.items) : reward.item?.itemId ? [reward.item] : [];
  if (rewardItems.length) {
    player.inventory = { ...asRecord(player.inventory) };
    for (const item of rewardItems) {
      if (!item?.itemId) continue;
      const quantity = Math.max(1, Math.floor(asNumber(item.quantity, 1)));
      player.inventory[item.itemId] = Math.max(0, Math.floor(asNumber(player.inventory[item.itemId], 0) + quantity));
    }
  }
  player.counters.lastTravelEncounterRewardAt = now;
  recordTravelDiscovery(runtimeState, encounter, now);
  return encounter;
}

export function resolveTravelForRuntimeState(runtimeState, now = Date.now()) {
  const current = cloneTravelState(runtimeState);
  if (
    current.status === "in_transit" &&
    typeof current.arrivalAt === "number" &&
    now >= current.arrivalAt &&
    current.destinationCityId
  ) {
    const resolved = {
      status: "idle",
      originCityId: current.destinationCityId,
      destinationCityId: null,
      routeType: current.routeType ?? "road",
      mode: current.mode ?? "caravan",
      departureAt: null,
      arrivalAt: null,
      durationMs: null,
      currentCityId: current.destinationCityId,
      arrivalNotice: {
        destinationCityId: current.destinationCityId,
        destinationName: getCityName(current.destinationCityId),
        arrivedAt: now,
      },
      encounterNotice: current.encounterNotice ?? null,
    };
    syncTravelOntoPlayer(runtimeState, resolved);
    return { changed: true, travelState: resolved };
  }

  syncTravelOntoPlayer(runtimeState, current);
  return { changed: false, travelState: current };
}

async function loadRuntimeState(client, user) {
  await createDefaultPlayerState(client, user.internalId);
  const playerState = await findPlayerStateByUserInternalId(client, user.internalId);
  if (!playerState) {
    throw new HttpError(404, "Player state unavailable.", "PLAYER_STATE_NOT_FOUND");
  }
  const runtimeState = buildMutableRuntimeState(user, playerState);
  const resolution = resolveTravelForRuntimeState(runtimeState);
  if (resolution.changed) {
    const nextPlayerState = await upsertPlayerRuntimeState(client, user.internalId, runtimeState);
    return {
      playerState: nextPlayerState,
      runtimeState: buildMutableRuntimeState(user, nextPlayerState),
    };
  }
  return { playerState, runtimeState };
}

export async function getTravelStateForUser(user) {
  return withTransaction(async (client) => {
    const { playerState, runtimeState } = await loadRuntimeState(client, user);
    return { playerState, travel: cloneTravelState(runtimeState) };
  });
}

export async function startTravelForUser(user, payload) {
  return withTransaction(async (client) => {
    const { runtimeState } = await loadRuntimeState(client, user);
    const rawDestinationCityId = String(payload?.destinationCityId ?? "").trim().toLowerCase();
    const destinationCityId = normalizeCityId(rawDestinationCityId, "");
    if (!destinationCityId || !isValidCityId(destinationCityId)) {
      throw new HttpError(400, "Travel destination unavailable.", "TRAVEL_DESTINATION_INVALID");
    }

    const current = cloneTravelState(runtimeState);
    if (current.status === "in_transit") {
      throw new HttpError(409, "You are already in transit.", "TRAVEL_ALREADY_ACTIVE");
    }

    const originCityId = normalizeCityId(current.currentCityId, DEFAULT_CITY_ID);

    if (originCityId === destinationCityId) {
      throw new HttpError(400, "You are already in that city.", "TRAVEL_ALREADY_THERE");
    }

    const route = getRouteDefinition(originCityId, destinationCityId);
    if (!route) {
      throw new HttpError(400, "No safe caravan route is available for that destination.", "TRAVEL_ROUTE_INVALID");
    }

    const now = Date.now();
    const encounter = applyTravelEncounterResult(
      runtimeState,
      resolveTravelEncounterForRoute(runtimeState, route, now),
      now,
    );

    if (encounter?.outcome === "turned_back") {
      const nextTravel = {
        status: "idle",
        originCityId,
        destinationCityId: null,
        routeType: route.routeType,
        mode: "caravan",
        departureAt: null,
        arrivalAt: null,
        durationMs: null,
        currentCityId: originCityId,
        arrivalNotice: null,
        encounterNotice: encounter,
      };
      syncTravelOntoPlayer(runtimeState, nextTravel);
      const playerState = await upsertPlayerRuntimeState(client, user.internalId, runtimeState);
      return { playerState, travel: nextTravel };
    }

    const durationMs = route.durationMs + (encounter?.delayMs ?? 0);
    const nextTravel = {
      status: "in_transit",
      originCityId,
      destinationCityId,
      routeType: route.routeType,
      mode: "caravan",
      departureAt: now,
      arrivalAt: now + durationMs,
      durationMs,
      currentCityId: originCityId,
      arrivalNotice: null,
      encounterNotice: encounter,
    };

    syncTravelOntoPlayer(runtimeState, nextTravel);
    const playerState = await upsertPlayerRuntimeState(client, user.internalId, runtimeState);
    return { playerState, travel: nextTravel };
  });
}

export async function cancelTravelForUser(user) {
  return withTransaction(async (client) => {
    const { runtimeState } = await loadRuntimeState(client, user);
    const current = cloneTravelState(runtimeState);
    if (current.status !== "in_transit" || !current.originCityId || !current.destinationCityId) {
      throw new HttpError(409, "No caravan journey is active.", "TRAVEL_NOT_ACTIVE");
    }

    const now = Date.now();
    const elapsedMs = Math.max(
      30 * 1000,
      Math.min(current.durationMs ?? 30 * 1000, now - (current.departureAt ?? now)),
    );

    const reversed = {
      status: "in_transit",
      originCityId: current.destinationCityId,
      destinationCityId: current.originCityId,
      routeType: current.routeType ?? "road",
      mode: current.mode ?? "caravan",
      departureAt: now,
      arrivalAt: now + elapsedMs,
      durationMs: elapsedMs,
      currentCityId: current.currentCityId ?? current.originCityId,
      arrivalNotice: null,
      encounterNotice: current.encounterNotice ?? null,
    };

    syncTravelOntoPlayer(runtimeState, reversed);
    const playerState = await upsertPlayerRuntimeState(client, user.internalId, runtimeState);
    return { playerState, travel: reversed };
  });
}
