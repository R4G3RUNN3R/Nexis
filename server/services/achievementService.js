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
  getLegacyPerk,
  getLegacyRankCost,
} from "../data/legacyAchievementsData.js";

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
  const discoveredNodes = [
    ...asArray(world.discoveredNodes),
    ...asArray(discovery.discoveredNodes),
    ...asArray(map.discoveredNodes),
  ].filter((nodeId) => typeof nodeId === "string");
  return new Set(discoveredNodes).size;
}

function evaluateAchievementProgress(definition, runtimeState, user) {
  const player = asRecord(runtimeState.player);
  const education = asRecord(runtimeState.education);
  const civicEmployment = asRecord(runtimeState.civicEmployment);
  const travel = asRecord(runtimeState.travel);
  const completedCourses = getCompletedCourses(education);

  switch (definition.metric) {
    case "account_registered":
      return user?.internalId ? 1 : 0;
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
    case "gold_held":
      return asWholeNumber(player.gold ?? player.currencies?.gold, 0);
    case "civic_job_joined":
      return typeof civicEmployment.activeTrackId === "string" || Object.keys(asRecord(civicEmployment.trackProgress)).length > 0 ? 1 : 0;
    case "civic_shifts_worked":
      return countCivicShifts(civicEmployment);
    case "organization_joined":
      return hasOrganizationState(runtimeState) ? 1 : 0;
    case "world_nodes_discovered":
      return countDiscoveredWorldNodes(runtimeState);
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
    const rawProgress = evaluateAchievementProgress(achievement, runtimeState, user);
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
    achievements: serializeAchievements(legacy),
    legacyPoints: legacy.points,
    perkRanks: legacy.perks.ranks,
    newlyAwarded: newlyAwarded.map((achievement) => ({
      id: achievement.id,
      name: achievement.name,
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
    legacy.points = normalizeLegacyPoints(legacy);
    runtimeState.legacy = legacy;
    await upsertPlayerRuntimeState(client, user.internalId, runtimeState);
    return serializeAchievementState(runtimeState);
  });
}
