import crypto from "node:crypto";
import { HttpError } from "../lib/errors.js";

const BUILDER_TRACK_ID = "builders_guild";
const NPC_ALWAYS_AVAILABLE = 12;

const PLAYER_POOL_SOURCE = "player_pool";
const NPC_SOURCE = "npc_contractor";

const MATERIAL_KEYS = ["timber", "stone", "iron"];

function asInt(value, fallback = 0) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return fallback;
  return Math.max(0, Math.floor(numeric));
}

function asRecord(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : {};
}

function asText(value, fallback = "") {
  const text = String(value ?? "").trim();
  return text || fallback;
}

function appendReservationHistory(builderTrack, event) {
  const history = Array.isArray(builderTrack.reservationHistory)
    ? builderTrack.reservationHistory.filter((entry) => entry && typeof entry === "object" && !Array.isArray(entry))
    : [];
  return [...history, event].slice(-25);
}

function buildReservationEvent(eventType, assignment, extra = {}) {
  const previous = asRecord(assignment);
  return {
    eventType,
    assignmentToken: asText(previous.assignmentToken, null),
    organizationInternalId: asText(previous.organizationInternalId, null),
    jobId: asText(previous.jobId, null),
    jobType: asText(previous.jobType, null),
    assignedAt: asInt(previous.assignedAt, 0) || null,
    expiresAt: asInt(previous.expiresAt, 0) || null,
    ...extra,
  };
}

function withReservationEvent(builderTrack, event) {
  return {
    ...builderTrack,
    lastReservationEvent: event,
    reservationHistory: appendReservationHistory(builderTrack, event),
  };
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function qualityBand(score) {
  const safe = asInt(score, 0);
  if (safe >= 86) return "exceptional";
  if (safe >= 70) return "fine";
  if (safe >= 48) return "standard";
  return "poor";
}

function computePlayerRating(workingTotal, professionLevel, shiftsWorked) {
  const derived = 42 + (professionLevel * 6) + Math.min(24, Math.floor(shiftsWorked / 10)) + Math.floor(workingTotal / 24);
  return clamp(derived, 35, 98);
}

function computePlayerSpeedFactor(workingTotal, professionLevel) {
  const skillFactor = 1 + (workingTotal / 420) + (professionLevel * 0.07);
  return clamp(skillFactor, 1.05, 2.35);
}

function computePlayerQualityEstimate(workingTotal, professionLevel, ratingReputation) {
  const score = 44 + (workingTotal * 0.12) + (professionLevel * 3.8) + (ratingReputation * 0.16);
  return clamp(Math.round(score), 40, 96);
}

function computeNpcQualityEstimate(materialPressure = 1) {
  const boundedMaterial = clamp(Number(materialPressure) || 1, 0.5, 1.5);
  const center = 58 + Math.round((boundedMaterial - 1) * 6);
  return clamp(center, 46, 74);
}

function toProfile(row) {
  const manualLabor = asInt(row.manual_labor, 0);
  const intelligence = asInt(row.intelligence, 0);
  const endurance = asInt(row.endurance, 0);
  const professionLevel = clamp(asInt(row.profession_level, 1), 1, 7);
  const shiftsWorked = asInt(row.shifts_worked, 0);
  const workingTotal = manualLabor + intelligence + endurance;
  const ratingReputation = computePlayerRating(workingTotal, professionLevel, shiftsWorked);
  const speedFactor = computePlayerSpeedFactor(workingTotal, professionLevel);
  const qualityEstimate = computePlayerQualityEstimate(workingTotal, professionLevel, ratingReputation);

  return {
    userInternalId: row.user_internal_id,
    publicId: asInt(row.public_id, 0),
    professionLevel,
    shiftsWorked,
    workingStats: { manualLabor, intelligence, endurance },
    workingTotal,
    ratingReputation,
    speedFactor,
    qualityEstimate,
  };
}

function seededRoll(seed) {
  const hex = crypto.createHash("sha256").update(seed).digest("hex").slice(0, 8);
  const int = Number.parseInt(hex, 16);
  if (!Number.isFinite(int)) return 0.5;
  return (int % 10000) / 10000;
}

function materialCoverage(mainBuilding, activeJob) {
  const requirements = asRecord(mainBuilding?.materialRequirements);
  const consumed = asRecord(asRecord(activeJob?.prepaid).materialsConsumed);

  let weightedDemand = 0;
  let weightedCoverage = 0;
  let lowestCoverage = 1;

  for (const key of MATERIAL_KEYS) {
    const required = asInt(requirements[key], 0);
    if (required <= 0) continue;
    const used = Math.min(required, asInt(consumed[key], 0));
    const ratio = clamp(used / required, 0, 1);
    weightedDemand += required;
    weightedCoverage += ratio * required;
    lowestCoverage = Math.min(lowestCoverage, ratio);
  }

  const avgCoverage = weightedDemand > 0 ? weightedCoverage / weightedDemand : 1;
  const materialQualityScore = clamp(Math.round(34 + (avgCoverage * 46) + (lowestCoverage * 12)), 18, 95);

  return {
    avgCoverage,
    lowestCoverage,
    materialQualityScore,
  };
}

function contributionScoreFromWorking(profile) {
  const stats = asRecord(profile?.workingStats);
  const manualLabor = asInt(stats.manualLabor, 0);
  const intelligence = asInt(stats.intelligence, 0);
  const endurance = asInt(stats.endurance, 0);
  const professionLevel = clamp(asInt(profile?.professionLevel, 1), 1, 7);
  const ratingReputation = clamp(asInt(profile?.ratingReputation, 50), 1, 100);

  const workingScore =
    30
    + (manualLabor * 0.17)
    + (intelligence * 0.09)
    + (endurance * 0.13)
    + (professionLevel * 3.7)
    + (ratingReputation * 0.11);

  return clamp(Math.round(workingScore), 20, 98);
}

async function getBuilderProfileByUserInternalId(client, userInternalId) {
  if (!userInternalId) return null;

  const result = await client.query(
    `
      SELECT
        ps.user_internal_id,
        u.public_id,
        COALESCE((ps.working_stats ->> 'manualLabor')::int, 0) AS manual_labor,
        COALESCE((ps.working_stats ->> 'intelligence')::int, 0) AS intelligence,
        COALESCE((ps.working_stats ->> 'endurance')::int, 0) AS endurance,
        COALESCE((ps.civic_state->'trackProgress'->'${BUILDER_TRACK_ID}'->>'rank')::int, 1) AS profession_level,
        COALESCE((ps.civic_state->'trackProgress'->'${BUILDER_TRACK_ID}'->>'shiftsWorked')::int, 0) AS shifts_worked
      FROM player_state ps
      JOIN users u ON u.internal_id = ps.user_internal_id
      WHERE ps.user_internal_id = $1
      LIMIT 1
    `,
    [userInternalId],
  );

  const row = result.rows[0];
  return row ? toProfile(row) : null;
}

function makeNpcContributor(seed, role, weight, baselineScore, materialQualityScore, professionLevelBase = 2) {
  const roll = seededRoll(seed);
  let score = baselineScore;

  if (materialQualityScore < 40 && roll < 0.12) {
    score = clamp(Math.round(35 + (materialQualityScore * 0.2)), 24, 46);
  } else if (roll < 0.08) {
    score = clamp(Math.round(baselineScore + 10 + (seededRoll(`${seed}:boost`) * 8)), 64, 82);
  } else {
    score = clamp(Math.round(baselineScore - 3 + (seededRoll(`${seed}:std`) * 8)), 48, 69);
  }

  const professionLevel = clamp(asInt(professionLevelBase, 2) + (roll > 0.92 ? 1 : 0), 1, 5);

  return {
    contributorType: "npc",
    role,
    weight,
    qualityScore: score,
    professionLevel,
    workingStats: {
      manualLabor: 46 + Math.round(seededRoll(`${seed}:m`) * 20),
      intelligence: 34 + Math.round(seededRoll(`${seed}:i`) * 14),
      endurance: 44 + Math.round(seededRoll(`${seed}:e`) * 20),
    },
    ratingReputation: 50 + Math.round(seededRoll(`${seed}:r`) * 20),
  };
}

async function buildContributionPool(client, mainBuilding, activeJob, material) {
  const labor = asRecord(activeJob?.labor);
  const jobId = String(activeJob?.jobId ?? "quality_unknown_job");

  if (labor.source === PLAYER_POOL_SOURCE && labor.assignedBuilderInternalId) {
    const profile = await getBuilderProfileByUserInternalId(client, labor.assignedBuilderInternalId);
    const fallbackProfile = {
      professionLevel: asInt(labor.professionLevel, 1),
      ratingReputation: asInt(labor.ratingReputation, 55),
      workingStats: {
        manualLabor: 55,
        intelligence: 42,
        endurance: 58,
      },
    };

    const primaryProfile = profile ?? fallbackProfile;
    const primaryScore = contributionScoreFromWorking(primaryProfile);

    const supportA = makeNpcContributor(`${jobId}:support_a`, "site_support", 0.18, 56, material.materialQualityScore, 2);
    const supportB = makeNpcContributor(`${jobId}:support_b`, "materials_support", 0.14, 54, material.materialQualityScore, 2);

    return [
      {
        contributorType: "player",
        role: "lead_builder",
        weight: 0.68,
        qualityScore: primaryScore,
        professionLevel: asInt(primaryProfile.professionLevel, 1),
        workingStats: asRecord(primaryProfile.workingStats),
        ratingReputation: asInt(primaryProfile.ratingReputation, 50),
        userInternalId: labor.assignedBuilderInternalId,
      },
      supportA,
      supportB,
    ];
  }

  const baselineScore = asInt(labor.estimatedQualityScore, 58);
  return [
    makeNpcContributor(`${jobId}:npc_lead`, "npc_lead_builder", 0.48, baselineScore, material.materialQualityScore, asInt(labor.professionLevel, 2)),
    makeNpcContributor(`${jobId}:npc_frame`, "npc_frame_crew", 0.32, baselineScore - 1, material.materialQualityScore, 2),
    makeNpcContributor(`${jobId}:npc_finish`, "npc_finish_crew", 0.20, baselineScore - 2, material.materialQualityScore, 2),
  ];
}

function weightedAverageContribution(contributions) {
  const safe = Array.isArray(contributions) ? contributions : [];
  let weighted = 0;
  let weightTotal = 0;

  for (const entry of safe) {
    const w = Number(entry.weight);
    const score = Number(entry.qualityScore);
    if (!Number.isFinite(w) || !Number.isFinite(score) || w <= 0) continue;
    weighted += w * score;
    weightTotal += w;
  }

  if (weightTotal <= 0) return 0;
  return weighted / weightTotal;
}

function getQualityModifiersForTier(tier) {
  switch (tier) {
    case "exceptional":
      return { operationalMultiplier: 1.06, upkeepMultiplier: 0.92 };
    case "fine":
      return { operationalMultiplier: 1.03, upkeepMultiplier: 0.97 };
    case "standard":
      return { operationalMultiplier: 1.0, upkeepMultiplier: 1.0 };
    default:
      return { operationalMultiplier: 0.96, upkeepMultiplier: 1.06 };
  }
}

function applyNpcDistributionGuard(finalScore, materialQualityScore, seed) {
  const roll = seededRoll(`${seed}:npc_guard`);
  if (materialQualityScore < 40 && roll < 0.18) {
    return clamp(Math.min(finalScore, 46), 24, 46);
  }
  if (roll < 0.07) {
    return clamp(finalScore + 5, 48, 82);
  }
  return clamp(finalScore, 48, 70);
}

export async function resolveConstructionQualityOutcome(client, mainBuilding, activeJob) {
  const complexity = Number(mainBuilding?.complexity ?? 1);
  const safeComplexity = Number.isFinite(complexity) ? clamp(complexity, 0.9, 1.5) : 1;

  const material = materialCoverage(mainBuilding, activeJob);
  const contributions = await buildContributionPool(client, mainBuilding, activeJob, material);
  const contributionAverage = weightedAverageContribution(contributions);
  const professionAverage = weightedAverageContribution(
    contributions.map((entry) => ({
      weight: entry.weight,
      qualityScore: clamp((asInt(entry.professionLevel, 1) / 7) * 100, 12, 100),
    })),
  );

  const complexityModifier = Math.round((1.05 - safeComplexity) * 11);

  let finalScore = Math.round(
    (contributionAverage * 0.63)
    + (professionAverage * 0.14)
    + (material.materialQualityScore * 0.23)
    + complexityModifier,
  );

  const source = String(asRecord(activeJob?.labor).source ?? NPC_SOURCE);
  const seed = String(activeJob?.jobId ?? "quality_job_seed");

  if (source === NPC_SOURCE) {
    finalScore = applyNpcDistributionGuard(finalScore, material.materialQualityScore, seed);
  } else {
    finalScore = clamp(finalScore, 28, 96);
  }

  const tier = qualityBand(finalScore);
  const modifiers = getQualityModifiersForTier(tier);

  return {
    tier,
    score: finalScore,
    modifiers,
    breakdown: {
      contributionAverage: Math.round(contributionAverage),
      professionAverage: Math.round(professionAverage),
      materialQualityScore: material.materialQualityScore,
      materialCoverage: Number(material.avgCoverage.toFixed(3)),
      weakestMaterialCoverage: Number(material.lowestCoverage.toFixed(3)),
      complexity: Number(safeComplexity.toFixed(2)),
      complexityModifier,
      source,
    },
    contributions: contributions.map((entry) => ({
      contributorType: entry.contributorType,
      role: entry.role,
      weight: Number(Number(entry.weight).toFixed(2)),
      qualityScore: asInt(entry.qualityScore, 0),
      professionLevel: asInt(entry.professionLevel, 1),
      ratingReputation: asInt(entry.ratingReputation, 0),
      workingStats: asRecord(entry.workingStats),
    })),
  };
}

export function getConstructionEligibleCivicTrackIds() {
  return [BUILDER_TRACK_ID];
}

export function getNpcBuilderBaseline() {
  return {
    availableCount: NPC_ALWAYS_AVAILABLE,
    professionLevel: 2,
    ratingReputation: 55,
    speedMultiplier: 1.7,
    qualityEstimate: computeNpcQualityEstimate(1),
  };
}

export async function listEligiblePlayerBuilders(client) {
  await runStaleBuilderReservationSweep(client);

  const result = await client.query(
    `
      SELECT
        ps.user_internal_id,
        u.public_id,
        COALESCE((ps.working_stats ->> 'manualLabor')::int, 0) AS manual_labor,
        COALESCE((ps.working_stats ->> 'intelligence')::int, 0) AS intelligence,
        COALESCE((ps.working_stats ->> 'endurance')::int, 0) AS endurance,
        COALESCE((ps.civic_state->'trackProgress'->'${BUILDER_TRACK_ID}'->>'rank')::int, 1) AS profession_level,
        COALESCE((ps.civic_state->'trackProgress'->'${BUILDER_TRACK_ID}'->>'shiftsWorked')::int, 0) AS shifts_worked
      FROM player_state ps
      JOIN users u ON u.internal_id = ps.user_internal_id
      WHERE COALESCE(ps.civic_state->>'activeTrackId', '') = '${BUILDER_TRACK_ID}'
        AND COALESCE(ps.player_snapshot->'condition'->>'type', '') NOT IN ('hospitalized', 'jailed')
        AND COALESCE((ps.civic_state->'trackProgress'->'${BUILDER_TRACK_ID}'->'activeAssignment'->>'expiresAt')::bigint, 0) <= (EXTRACT(EPOCH FROM NOW()) * 1000)::bigint
      ORDER BY profession_level DESC, shifts_worked DESC, manual_labor DESC, endurance DESC, intelligence DESC
      LIMIT 250
    `,
  );

  return result.rows.map(toProfile);
}

export function summarizeBuilderAvailability(playerProfiles) {
  return {
    playerBuilders: playerProfiles.length,
    npcBuilders: NPC_ALWAYS_AVAILABLE,
    totalAvailable: playerProfiles.length + NPC_ALWAYS_AVAILABLE,
  };
}


export async function reservePlayerBuilderAssignment(client, {
  builderInternalId,
  assignmentToken,
  organizationInternalId,
  jobId,
  jobType,
  expiresAt,
  assignedByInternalId = null,
}) {
  const builderId = String(builderInternalId ?? '').trim();
  if (!builderId) {
    throw new HttpError(400, 'Builder assignment requires a valid builder internal ID.', 'ORG_BASE_BUILDER_ID_REQUIRED');
  }

  const token = String(assignmentToken ?? '').trim();
  if (!token) {
    throw new HttpError(400, 'Builder assignment requires an assignment token.', 'ORG_BASE_BUILDER_ASSIGNMENT_TOKEN_REQUIRED');
  }

  const expires = asInt(expiresAt, 0);
  const nowTs = Date.now();
  if (expires <= nowTs) {
    throw new HttpError(400, 'Builder assignment expiry is invalid.', 'ORG_BASE_BUILDER_ASSIGNMENT_EXPIRES_INVALID');
  }

  const result = await client.query(
    `
      SELECT civic_state, player_snapshot
      FROM player_state
      WHERE user_internal_id = $1
      LIMIT 1
      FOR UPDATE
    `,
    [builderId],
  );

  if (!result.rows.length) {
    throw new HttpError(409, 'Selected builder is unavailable.', 'ORG_BASE_BUILDER_UNAVAILABLE');
  }

  const row = result.rows[0];
  const civicState = asRecord(row.civic_state);
  const activeTrackId = String(civicState.activeTrackId ?? '').trim();
  if (activeTrackId !== BUILDER_TRACK_ID) {
    throw new HttpError(409, 'Selected builder is not on active builder duty.', 'ORG_BASE_BUILDER_NOT_ON_TRACK');
  }

  const conditionType = String(asRecord(asRecord(row.player_snapshot).condition).type ?? '').trim();
  if (conditionType === 'hospitalized' || conditionType === 'jailed') {
    throw new HttpError(409, 'Selected builder is currently unavailable.', 'ORG_BASE_BUILDER_CONDITION_BLOCKED');
  }

  const trackProgress = asRecord(civicState.trackProgress);
  const builderTrack = asRecord(trackProgress[BUILDER_TRACK_ID]);
  const currentAssignment = asRecord(builderTrack.activeAssignment);
  const currentToken = String(currentAssignment.assignmentToken ?? '').trim();
  const currentExpiresAt = asInt(currentAssignment.expiresAt, 0);
  if (currentToken && currentExpiresAt > nowTs) {
    throw new HttpError(409, 'Selected builder is already committed to another active construction job.', 'ORG_BASE_BUILDER_ALREADY_ASSIGNED');
  }

  const nextAssignment = {
    assignmentToken: token,
    organizationInternalId: String(organizationInternalId ?? '').trim() || null,
    jobId: String(jobId ?? '').trim() || null,
    jobType: String(jobType ?? '').trim() || null,
    assignedAt: nowTs,
    expiresAt: expires,
    assignedByInternalId: String(assignedByInternalId ?? '').trim() || null,
  };

  const reserveEvent = buildReservationEvent("reserved", nextAssignment, {
    assignedAt: nowTs,
    expiresAt: expires,
    assignedByInternalId: String(assignedByInternalId ?? '').trim() || null,
    recordedAt: nowTs,
  });

  const nextCivicState = {
    ...civicState,
    trackProgress: {
      ...trackProgress,
      [BUILDER_TRACK_ID]: withReservationEvent({
        ...builderTrack,
        activeAssignment: nextAssignment,
      }, reserveEvent),
    },
  };

  await client.query(
    `
      UPDATE player_state
      SET civic_state = $2::jsonb,
          updated_at = NOW()
      WHERE user_internal_id = $1
    `,
    [builderId, JSON.stringify(nextCivicState)],
  );

  return nextAssignment;
}

export async function releasePlayerBuilderAssignment(client, {
  builderInternalId,
  assignmentToken = null,
  reason = "released",
  releasedByInternalId = null,
  releasedAt = Date.now(),
  force = false,
}) {
  const builderId = String(builderInternalId ?? '').trim();
  if (!builderId) return false;

  const result = await client.query(
    `
      SELECT civic_state
      FROM player_state
      WHERE user_internal_id = $1
      LIMIT 1
      FOR UPDATE
    `,
    [builderId],
  );

  if (!result.rows.length) return false;

  const civicState = asRecord(result.rows[0].civic_state);
  const trackProgress = asRecord(civicState.trackProgress);
  const builderTrack = asRecord(trackProgress[BUILDER_TRACK_ID]);
  const currentAssignment = asRecord(builderTrack.activeAssignment);
  const currentToken = String(currentAssignment.assignmentToken ?? '').trim();
  if (!currentToken) return false;

  const requestedToken = String(assignmentToken ?? '').trim();
  const currentExpiresAt = asInt(currentAssignment.expiresAt, 0);
  const nowTs = Date.now();
  if (requestedToken && requestedToken !== currentToken && currentExpiresAt > nowTs && !force) {
    return false;
  }

  const releaseEvent = buildReservationEvent("released", currentAssignment, {
    reason: asText(reason, "released"),
    releasedAt: asInt(releasedAt, nowTs),
    releasedByInternalId: String(releasedByInternalId ?? '').trim() || null,
    recordedAt: nowTs,
  });

  const nextTrack = withReservationEvent(builderTrack, releaseEvent);
  delete nextTrack.activeAssignment;

  const nextCivicState = {
    ...civicState,
    trackProgress: {
      ...trackProgress,
      [BUILDER_TRACK_ID]: nextTrack,
    },
  };

  await client.query(
    `
      UPDATE player_state
      SET civic_state = $2::jsonb,
          updated_at = NOW()
      WHERE user_internal_id = $1
    `,
    [builderId, JSON.stringify(nextCivicState)],
  );

  return true;
}

export async function runStaleBuilderReservationSweep(client, {
  nowTs = Date.now(),
  reason = "stale_expired_assignment",
  releasedByInternalId = null,
} = {}) {
  const now = asInt(nowTs, Date.now());
  const releaseReason = asText(reason, "stale_expired_assignment");

  const result = await client.query(
    `
      SELECT user_internal_id, civic_state
      FROM player_state
      WHERE COALESCE(civic_state->>'activeTrackId', '') = '${BUILDER_TRACK_ID}'
        AND COALESCE((civic_state->'trackProgress'->'${BUILDER_TRACK_ID}'->'activeAssignment'->>'expiresAt')::bigint, 0) > 0
        AND COALESCE((civic_state->'trackProgress'->'${BUILDER_TRACK_ID}'->'activeAssignment'->>'expiresAt')::bigint, 0) <= $1
      FOR UPDATE
    `,
    [now],
  );

  const released = [];

  for (const row of result.rows) {
    const civicState = asRecord(row.civic_state);
    const trackProgress = asRecord(civicState.trackProgress);
    const builderTrack = asRecord(trackProgress[BUILDER_TRACK_ID]);
    const currentAssignment = asRecord(builderTrack.activeAssignment);
    const currentToken = asText(currentAssignment.assignmentToken, "");
    const expiresAt = asInt(currentAssignment.expiresAt, 0);
    if (!currentToken || expiresAt <= 0 || expiresAt > now) continue;

    const releaseEvent = buildReservationEvent("released", currentAssignment, {
      reason: releaseReason,
      releasedAt: now,
      releasedByInternalId: String(releasedByInternalId ?? '').trim() || null,
      recordedAt: now,
    });

    const nextTrack = withReservationEvent(builderTrack, releaseEvent);
    delete nextTrack.activeAssignment;

    const nextCivicState = {
      ...civicState,
      trackProgress: {
        ...trackProgress,
        [BUILDER_TRACK_ID]: nextTrack,
      },
    };

    await client.query(
      `
        UPDATE player_state
        SET civic_state = $2::jsonb,
            updated_at = NOW()
        WHERE user_internal_id = $1
      `,
      [row.user_internal_id, JSON.stringify(nextCivicState)],
    );

    released.push({
      builderInternalId: row.user_internal_id,
      assignmentToken: currentToken,
      organizationInternalId: asText(currentAssignment.organizationInternalId, null),
      jobId: asText(currentAssignment.jobId, null),
      jobType: asText(currentAssignment.jobType, null),
      expiresAt,
      reason: releaseReason,
      releasedAt: now,
    });
  }

  return {
    releasedCount: released.length,
    released,
  };
}

function pickPreferredPlayerBuilder(playerProfiles) {
  if (!Array.isArray(playerProfiles) || !playerProfiles.length) return null;
  return [...playerProfiles].sort((a, b) => {
    if (b.speedFactor !== a.speedFactor) return b.speedFactor - a.speedFactor;
    if (b.qualityEstimate !== a.qualityEstimate) return b.qualityEstimate - a.qualityEstimate;
    return b.workingTotal - a.workingTotal;
  })[0];
}

function estimatePlayerLabor(mainBuilding, profile) {
  const baseDuration = Math.max(1, asInt(mainBuilding.durationHours, 24));
  const adjustedDuration = Math.max(1, Math.ceil(baseDuration / profile.speedFactor));
  const baseLaborCost = asInt(mainBuilding.laborCostGold, 0);
  const wageMultiplier = clamp(1.05 + (profile.professionLevel * 0.04), 1.08, 1.38);
  const wageCostGold = Math.max(1, Math.ceil(baseLaborCost * wageMultiplier));

  return {
    source: PLAYER_POOL_SOURCE,
    sourceLabel: "Player Builder Pool",
    availableCount: 1,
    estimatedTimeHours: adjustedDuration,
    estimatedQualityScore: profile.qualityEstimate,
    estimatedQualityTier: qualityBand(profile.qualityEstimate),
    wageCostGold,
    professionLevel: profile.professionLevel,
    ratingReputation: profile.ratingReputation,
    assignedBuilderInternalId: profile.userInternalId,
    assignmentToken: `player:${profile.userInternalId}`,
    speedMultiplier: Number((baseDuration / adjustedDuration).toFixed(2)),
    usesNpcFallback: false,
  };
}

function estimateNpcLabor(mainBuilding) {
  const baseDuration = Math.max(1, asInt(mainBuilding.durationHours, 24));
  const baseline = getNpcBuilderBaseline();
  const adjustedDuration = Math.max(baseDuration + 1, Math.ceil(baseDuration * baseline.speedMultiplier));
  const baseLaborCost = asInt(mainBuilding.laborCostGold, 0);
  const wageCostGold = Math.max(1, Math.ceil(baseLaborCost * 0.85));

  return {
    source: NPC_SOURCE,
    sourceLabel: "NPC Contractor",
    availableCount: baseline.availableCount,
    estimatedTimeHours: adjustedDuration,
    estimatedQualityScore: baseline.qualityEstimate,
    estimatedQualityTier: qualityBand(baseline.qualityEstimate),
    wageCostGold,
    professionLevel: baseline.professionLevel,
    ratingReputation: baseline.ratingReputation,
    assignedBuilderInternalId: null,
    assignmentToken: "npc:contractor",
    speedMultiplier: Number((adjustedDuration / baseDuration).toFixed(2)),
    usesNpcFallback: true,
  };
}

export function buildLaborComparisonForMainBuilding(mainBuilding, playerProfiles) {
  const preferred = pickPreferredPlayerBuilder(playerProfiles);
  const npcEstimate = estimateNpcLabor(mainBuilding);

  const options = [];
  if (preferred) {
    options.push(estimatePlayerLabor(mainBuilding, preferred));
  } else {
    options.push({
      source: PLAYER_POOL_SOURCE,
      sourceLabel: "Player Builder Pool",
      availableCount: 0,
      estimatedTimeHours: null,
      estimatedQualityScore: null,
      estimatedQualityTier: "unavailable",
      wageCostGold: null,
      professionLevel: null,
      ratingReputation: null,
      assignedBuilderInternalId: null,
      assignmentToken: null,
      speedMultiplier: null,
      unavailableReason: "No eligible player builders are currently on active construction civic duty.",
      usesNpcFallback: false,
    });
  }
  options.push(npcEstimate);

  return {
    options,
    recommendedSource: preferred ? PLAYER_POOL_SOURCE : NPC_SOURCE,
  };
}

export function resolveLaborAssignment(mainBuilding, playerProfiles, preferredSource) {
  const comparison = buildLaborComparisonForMainBuilding(mainBuilding, playerProfiles);
  const requested = String(preferredSource || "").trim();
  const preferred = requested || comparison.recommendedSource;

  let selected = comparison.options.find((entry) => entry.source === preferred);
  if (!selected || selected.estimatedTimeHours == null || selected.wageCostGold == null) {
    selected = comparison.options.find((entry) => entry.source === NPC_SOURCE);
  }

  return {
    selected,
    comparison,
  };
}

export const CONSTRUCTION_LABOR_SOURCES = {
  PLAYER_POOL_SOURCE,
  NPC_SOURCE,
};
