import { withTransaction } from "../db/pool.js";
import { HttpError } from "../lib/errors.js";
import { buildMutableRuntimeState } from "../lib/runtimePlayerState.js";
import {
  createDefaultPlayerState,
  findPlayerStateByUserInternalId,
  upsertPlayerRuntimeState,
} from "../repositories/playerStateRepository.js";
import {
  LEGACY_ACHIEVEMENT_CATEGORIES,
  LEGACY_ACHIEVEMENTS,
  LEGACY_PERK_CATEGORIES,
  LEGACY_PERKS,
  getLegacyPerk,
  getLegacyRankCost,
} from "../data/legacyAchievementsData.js";
import { addPlayerRecord, queueProgressionEvent } from "./playerRecordsService.js";

function asRecord(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : {};
}

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function asWholeNumber(value, fallback = 0) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return fallback;
  return Math.max(0, Math.floor(numeric));
}

function normalizeRank(value, maxRank) {
  return Math.max(0, Math.min(maxRank, asWholeNumber(value, 0)));
}

function normalizeAwards(value) {
  const awards = asRecord(value);
  return {
    titles: asArray(awards.titles),
    artifacts: asArray(awards.artifacts),
    residences: asArray(awards.residences),
  };
}

function normalizeMonthly(value) {
  const monthly = asRecord(value);
  return {
    monthKey: typeof monthly.monthKey === "string" ? monthly.monthKey : null,
    eligible: Boolean(monthly.eligible),
    claimed: Boolean(monthly.claimed),
    resolved: Boolean(monthly.resolved),
    generatedAt: typeof monthly.generatedAt === "number" ? monthly.generatedAt : null,
  };
}

function normalizeLegacyState(runtimeState) {
  const current = asRecord(runtimeState.legacy);
  const currentAchievements = asRecord(current.achievements);
  const awarded = Object.fromEntries(
    Object.entries(asRecord(currentAchievements.awarded))
      .filter(([achievementId]) => LEGACY_ACHIEVEMENTS.some((achievement) => achievement.id === achievementId))
      .map(([achievementId, value]) => {
        const record = asRecord(value);
        return [
          achievementId,
          {
            id: achievementId,
            awardedAt: typeof record.awardedAt === "number" ? record.awardedAt : Date.now(),
            rewardPoints: asWholeNumber(record.rewardPoints, 1),
          },
        ];
      }),
  );

  const progress = Object.fromEntries(
    Object.entries(asRecord(currentAchievements.progress))
      .filter(([achievementId]) => LEGACY_ACHIEVEMENTS.some((achievement) => achievement.id === achievementId))
      .map(([achievementId, value]) => [achievementId, asWholeNumber(value, 0)]),
  );

  const ranks = Object.fromEntries(
    Object.entries(asRecord(asRecord(current.perks).ranks))
      .map(([perkId, value]) => {
        const perk = getLegacyPerk(perkId);
        return perk ? [perkId, normalizeRank(value, perk.maxRank)] : null;
      })
      .filter(Boolean),
  );

  return {
    donorTier: typeof current.donorTier === "string" ? current.donorTier : "tier_0",
    hiddenTags: asArray(current.hiddenTags).filter((entry) => typeof entry === "string"),
    visibleEntries: asArray(current.visibleEntries),
    chronicleHistory: asArray(current.chronicleHistory),
    monthly: normalizeMonthly(current.monthly),
    activeRun: current.activeRun && typeof current.activeRun === "object" ? current.activeRun : null,
    awards: normalizeAwards(current.awards),
    achievements: {
      awarded,
      progress,
    },
    perks: {
      ranks,
    },
    points: normalizeLegacyPoints({ achievements: { awarded }, perks: { ranks } }),
  };
}

function getCompletedCourses(education) {
  const record = asRecord(education);
  const completedCourses = asArray(record.completedCourses).filter((courseId) => typeof courseId === "string");
  const legacyCompleted = asArray(record.completedCourseIds).filter((courseId) => typeof courseId === "string");
  return Array.from(new Set([...completedCourses, ...legacyCompleted]));
}

function countCivicShifts(civicEmployment) {
  const trackProgress = asRecord(asRecord(civicEmployment).trackProgress);
  return Object.values(trackProgress).reduce((sum, value) => {
    return sum + asWholeNumber(asRecord(value).shiftsWorked, 0);
  }, 0);
}

function hasOrganizationState(runtimeState) {
  const guild = asRecord(runtimeState.guild);
  const consortium = asRecord(runtimeState.consortium);
  return Boolean(
    guild.organizationInternalId ||
      guild.organizationPublicId ||
      guild.myOrganization ||
      consortium.organizationInternalId ||
      consortium.organizationPublicId ||
      consortium.myOrganization,
  );
}

function countDiscoveredWorldNodes(runtimeState) {
  const world = asRecord(runtimeState.world);
  const discovery = asRecord(runtimeState.discovery);
  const map = asRecord(runtimeState.map);
  const playerDiscovery = asRecord(asRecord(runtimeState.player).worldDiscovery);
  const education = asRecord(runtimeState.education);
  const discoveredNodes = [
    ...asArray(world.discoveredNodes),
    ...asArray(discovery.discoveredNodes),
    ...asArray(map.discoveredNodes),
    ...asArray(playerDiscovery.discoveredNodes),
  ].filter((nodeId) => typeof nodeId === "string");
  const discoveryRecords = [
    ...asArray(playerDiscovery.discoveries),
    ...asArray(education.discoveries),
  ].map((entry) => asRecord(entry).id ?? asRecord(entry).siteId ?? asRecord(entry).title).filter(Boolean);
  return new Set([...discoveredNodes, ...discoveryRecords]).size;
}

function countHiddenSites(runtimeState) {
  const hiddenSites = asRecord(asRecord(asRecord(runtimeState.player).worldDiscovery).hiddenSites);
  return Object.values(hiddenSites).filter((entry) => ["discovered", "explored"].includes(String(asRecord(entry).status ?? ""))).length;
}

function sumRecordNumbers(record) {
  return Object.values(asRecord(record)).reduce((sum, value) => sum + asWholeNumber(value, 0), 0);
}

function countCrafted(runtimeState) {
  const counters = asRecord(asRecord(runtimeState.player).counters);
  const crafting = asRecord(asRecord(runtimeState.player).crafting);
  return Math.max(asWholeNumber(counters.itemsCrafted, 0), sumRecordNumbers(crafting.craftedCounts));
}

function countSalvaged(runtimeState) {
  const counters = asRecord(asRecord(runtimeState.player).counters);
  const crafting = asRecord(asRecord(runtimeState.player).crafting);
  return Math.max(asWholeNumber(counters.itemsSalvaged, 0), sumRecordNumbers(crafting.salvagedCounts));
}

function daysPlayedForUser(user, now) {
  const createdAt = asWholeNumber(user?.createdAt, 0);
  if (!createdAt) return 0;
  return Math.max(0, Math.floor((now - createdAt) / (24 * 60 * 60 * 1000)));
}

function evaluateAchievementProgress(definition, runtimeState, user, now = Date.now()) {
  const player = asRecord(runtimeState.player);
  const education = asRecord(runtimeState.education);
  const civicEmployment = asRecord(runtimeState.civicEmployment);
  const travel = asRecord(runtimeState.travel);
  const completedCourses = getCompletedCourses(education);

  const counters = asRecord(player.counters);

  switch (definition.metric) {
    case "account_registered":
      return user?.internalId ? 1 : 0;
    case "days_played":
      return daysPlayedForUser(user, now);
    case "education_started":
      return completedCourses.length || asRecord(education.activeCourse).courseId ? 1 : 0;
    case "education_completed":
      return completedCourses.length;
    case "travel_started":
      return travel.status === "in_transit" ||
        (typeof travel.currentCityId === "string" && travel.currentCityId !== "nexis") ||
        typeof travel.destinationCityId === "string"
        ? 1
        : 0;
    case "travel_resolved":
      return asWholeNumber(counters.travelArrivals, 0);
    case "gold_held":
      return asWholeNumber(player.gold ?? player.currencies?.gold, 0);
    case "civic_job_joined":
      return typeof civicEmployment.activeTrackId === "string" || Object.keys(asRecord(civicEmployment.trackProgress)).length > 0 ? 1 : 0;
    case "civic_shifts_worked":
      return countCivicShifts(civicEmployment);
    case "organization_joined":
      return hasOrganizationState(runtimeState) ? 1 : 0;
    case "world_nodes_discovered":
    case "discoveries_found":
      return countDiscoveredWorldNodes(runtimeState);
    case "hidden_sites_found":
      return countHiddenSites(runtimeState);
    case "marketplace_listings_created":
      return asWholeNumber(counters.marketplaceListingsCreated, 0);
    case "marketplace_trades":
      return asWholeNumber(counters.marketplacePurchases, 0) + asWholeNumber(counters.marketplaceSales, 0);
    case "items_crafted":
      return countCrafted(runtimeState);
    case "items_salvaged":
      return countSalvaged(runtimeState);
    case "adventures_completed":
      return asWholeNumber(counters.adventuresCompleted, 0) + asWholeNumber(counters.contractsCompleted, 0);
    case "elite_hunts_won":
      return asWholeNumber(counters.eliteHuntsWon, 0);
    case "weapon_actions":
      return asWholeNumber(counters.weaponActions, 0);
    case "organization_assistance":
      return asWholeNumber(counters.organizationAssistanceResolved, 0);
    case "skills_unlocked":
      return asWholeNumber(counters.skillsUnlocked, asArray(player.skills?.unlocked).length);
    case "skill_evolutions":
      return asWholeNumber(counters.skillEvolutions, Object.keys(asRecord(player.skills?.evolved)).length);
    case "combat_resolved":
      return asWholeNumber(counters.combatWins, 0) + asWholeNumber(counters.combatLosses, 0) + asWholeNumber(counters.duelsResolved, 0);
    case "duels_resolved":
      return asWholeNumber(counters.duelsResolved, 0);
    case "academy_stages_completed":
      return asWholeNumber(counters.academyStagesCompleted, 0);
    default:
      return 0;
  }
}

function insertVisibleEntry(legacy, achievement, awardedAt) {
  const visibleEntries = asArray(legacy.visibleEntries);
  const alreadyVisible = visibleEntries.some((entry) => asRecord(entry).achievementId === achievement.id);
  if (alreadyVisible) return;

  legacy.visibleEntries = [
    {
      id: `achievement_${achievement.id}_${awardedAt}`,
      achievementId: achievement.id,
      title: achievement.chronicleTitle ?? achievement.name,
      summary: achievement.chronicleSummary ?? achievement.description,
      kind: "achievement",
      awardedAt,
    },
    ...visibleEntries,
  ].slice(0, 50);
}

function evaluateAchievements(runtimeState, user, now = Date.now()) {
  const legacy = normalizeLegacyState(runtimeState);
  const newlyAwarded = [];

  for (const achievement of LEGACY_ACHIEVEMENTS) {
    const rawProgress = evaluateAchievementProgress(achievement, runtimeState, user, now);
    const progress = Math.max(0, Math.floor(Number(rawProgress) || 0));
    legacy.achievements.progress[achievement.id] = progress;

    if (progress >= achievement.target && !legacy.achievements.awarded[achievement.id]) {
      legacy.achievements.awarded[achievement.id] = {
        id: achievement.id,
        awardedAt: now,
        rewardPoints: achievement.rewardPoints,
      };
      newlyAwarded.push(achievement);
      insertVisibleEntry(legacy, achievement, now);
      addPlayerRecord(runtimeState, {
        id: `record_achievement_${achievement.id}`,
        category: "progression",
        summary: `${achievement.kind === "medal" ? "Medal" : "Honor"} earned: ${achievement.name}.`,
        detail: { achievementId: achievement.id, kind: achievement.kind, category: achievement.category, rewardPoints: achievement.rewardPoints },
        source: "legacy-achievements",
        route: "/achievements",
        timestamp: now,
      });
      queueProgressionEvent(runtimeState, {
        id: `achievement_${achievement.id}_${now}`,
        type: "achievement",
        title: `${achievement.kind === "medal" ? "Medal" : "Honor"} earned`,
        summary: `${achievement.name}: +${achievement.rewardPoints} Legacy Point`,
        detail: { achievementId: achievement.id, kind: achievement.kind, category: achievement.category, rewardPoints: achievement.rewardPoints },
        route: "/achievements",
        createdAt: now,
      });
    }
  }

  legacy.points = normalizeLegacyPoints(legacy);
  runtimeState.legacy = legacy;
  return { legacy, newlyAwarded };
}

function normalizeLegacyPoints(legacy) {
  const awarded = asRecord(asRecord(legacy.achievements).awarded);
  const ranks = asRecord(asRecord(legacy.perks).ranks);
  const totalEarned = Object.entries(awarded).reduce((sum, [achievementId, award]) => {
    const definition = LEGACY_ACHIEVEMENTS.find((entry) => entry.id === achievementId);
    return sum + asWholeNumber(asRecord(award).rewardPoints, definition?.rewardPoints ?? 0);
  }, 0);
  const totalSpent = Object.entries(ranks).reduce((sum, [perkId, rank]) => {
    const perk = getLegacyPerk(perkId);
    const safeRank = perk ? normalizeRank(rank, perk.maxRank) : 0;
    let cost = 0;
    for (let nextRank = 1; nextRank <= safeRank; nextRank += 1) {
      cost += getLegacyRankCost(nextRank);
    }
    return sum + cost;
  }, 0);

  return {
    totalEarned,
    totalSpent,
    available: Math.max(0, totalEarned - totalSpent),
  };
}

function serializeAchievements(legacy) {
  return LEGACY_ACHIEVEMENTS.map((achievement) => {
    const award = asRecord(legacy.achievements.awarded[achievement.id]);
    const progress = asWholeNumber(legacy.achievements.progress[achievement.id], 0);
    return {
      id: achievement.id,
      kind: achievement.kind ?? "honor",
      category: achievement.category,
      name: achievement.name,
      description: achievement.description,
      progress,
      target: achievement.target,
      completed: Boolean(award.awardedAt),
      completedOn: award.awardedAt ? new Date(award.awardedAt).toISOString().slice(0, 10) : undefined,
      rewardPoints: achievement.rewardPoints,
    };
  });
}

function serializeAchievementState(runtimeState, newlyAwarded = []) {
  const legacy = normalizeLegacyState(runtimeState);
  return {
    achievementCategories: LEGACY_ACHIEVEMENT_CATEGORIES,
    achievementKinds: ["honor", "medal"],
    achievements: serializeAchievements(legacy),
    legacyPerkCategories: LEGACY_PERK_CATEGORIES,
    legacyPerks: LEGACY_PERKS,
    legacyPoints: legacy.points,
    perkRanks: legacy.perks.ranks,
    newlyAwarded: newlyAwarded.map((achievement) => ({
      id: achievement.id,
      name: achievement.name,
      kind: achievement.kind ?? "honor",
      category: achievement.category,
      rewardPoints: achievement.rewardPoints,
    })),
    legacy,
  };
}

async function loadRuntimeState(client, user) {
  await createDefaultPlayerState(client, user.internalId);
  const playerState = await findPlayerStateByUserInternalId(client, user.internalId);
  if (!playerState) {
    throw new HttpError(404, "Player state unavailable.", "PLAYER_STATE_NOT_FOUND");
  }
  return {
    playerState,
    runtimeState: buildMutableRuntimeState(user, playerState),
  };
}

export function evaluateLegacyAchievementsForRuntime(runtimeState, user, now = Date.now()) {
  return evaluateAchievements(runtimeState, user, now);
}

export function getLegacyPerkRank(runtimeState, perkId) {
  const perk = getLegacyPerk(perkId);
  if (!perk) return 0;
  return normalizeRank(asRecord(asRecord(normalizeLegacyState(runtimeState).perks).ranks)[perkId], perk.maxRank);
}

export function getLegacyPerkEffect(runtimeState, perkId) {
  const perk = getLegacyPerk(perkId);
  if (!perk) return 0;
  const baseEffect = Number(perk.baseEffect);
  return getLegacyPerkRank(runtimeState, perkId) * (Number.isFinite(baseEffect) ? baseEffect : 0);
}

export async function getAchievementStateForUser(user) {
  return withTransaction(async (client) => {
    const { runtimeState } = await loadRuntimeState(client, user);
    const { newlyAwarded } = evaluateAchievements(runtimeState, user);
    await upsertPlayerRuntimeState(client, user.internalId, runtimeState);
    return serializeAchievementState(runtimeState, newlyAwarded);
  });
}

export async function spendLegacyPerkRankForUser(user, payload) {
  const perkId = String(payload?.perkId ?? "").trim();
  const perk = getLegacyPerk(perkId);
  if (!perk) {
    throw new HttpError(400, "Legacy perk unavailable.", "LEGACY_PERK_INVALID");
  }

  return withTransaction(async (client) => {
    const { runtimeState } = await loadRuntimeState(client, user);
    evaluateAchievements(runtimeState, user);
    const legacy = normalizeLegacyState(runtimeState);
    const currentRank = normalizeRank(legacy.perks.ranks[perk.id], perk.maxRank);
    if (currentRank >= perk.maxRank) {
      throw new HttpError(409, "That Legacy perk is already maxed out.", "LEGACY_PERK_MAXED");
    }

    const nextRank = currentRank + 1;
    const nextRankCost = getLegacyRankCost(nextRank);
    const points = normalizeLegacyPoints(legacy);
    if (points.available < nextRankCost) {
      throw new HttpError(409, "Not enough Legacy Points for that rank.", "LEGACY_POINTS_INSUFFICIENT");
    }

    legacy.perks.ranks = {
      ...legacy.perks.ranks,
      [perk.id]: nextRank,
    };
    addPlayerRecord(runtimeState, {
      category: "progression",
      summary: `Legacy rank purchased: ${perk.name ?? perk.id} rank ${nextRank}.`,
      detail: { perkId: perk.id, nextRank, spent: nextRankCost },
      source: "legacy-perks",
      route: "/achievements",
      timestamp: Date.now(),
    });
    legacy.points = normalizeLegacyPoints(legacy);
    runtimeState.legacy = legacy;
    await upsertPlayerRuntimeState(client, user.internalId, runtimeState);
    return serializeAchievementState(runtimeState);
  });
}
