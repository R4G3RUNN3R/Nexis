import crypto from "node:crypto";
import { withTransaction } from "../db/pool.js";
import { HttpError } from "../lib/errors.js";
import {
  decrementOrganizationBaseStorageItem,
  findOrganizationBaseByOrganizationInternalIdForUpdate,
  listActiveOrganizationBases,
  recordOrganizationBaseEvent,
  updateOrganizationBaseFinancials,
} from "../repositories/organizationBaseRepository.js";
import {
  findOrganizationByInternalId,
  insertOrganizationLog,
  updateOrganizationDetails,
} from "../repositories/organizationRepository.js";
import { getMainBuildingPlanForOrgType } from "./organizationBaseOwnershipService.js";
import {
  CONSTRUCTION_LABOR_SOURCES,
  listEligiblePlayerBuilders,
  releasePlayerBuilderAssignment,
  reservePlayerBuilderAssignment,
  resolveConstructionQualityOutcome,
  resolveLaborAssignment,
} from "./organizationBaseLaborService.js";

const MATERIAL_KEYS = ["timber", "stone", "iron"];

const asRecord = (value) => (value && typeof value === "object" && !Array.isArray(value) ? value : {});
const asInt = (value, fallback = 0) => {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return fallback;
  return Math.max(0, Math.floor(numeric));
};

function addOneUtcMonthPreservingAnchor(timestamp) {
  const current = new Date(timestamp);
  const anchor = current.getUTCDate();
  current.setUTCMonth(current.getUTCMonth() + 1);
  if (current.getUTCDate() < anchor) {
    current.setUTCDate(0);
  }
  return current.getTime();
}

function ensureMember(organization, userInternalId) {
  const member = organization.members.find((entry) => entry.userInternalId === userInternalId);
  if (!member) {
    throw new HttpError(403, "You are not part of this organization.", "ORG_MEMBERSHIP_REQUIRED");
  }
  return member;
}

function ensureTreasuryPermission(organization, member) {
  const role = organization.roles.find((entry) => entry.roleKey === member.roleKey);
  if (!role || !Array.isArray(role.permissions) || !role.permissions.includes("manage_treasury")) {
    throw new HttpError(403, "Treasury authority required for this construction action.", "ORG_BASE_CONSTRUCTION_TREASURY_PERMISSION_REQUIRED");
  }
}

function ensureLeader(organization, member) {
  const leaderRoleKey = organization.type === "guild" ? "guildmaster" : "director";
  if (member.roleKey !== leaderRoleKey) {
    throw new HttpError(403, "Only organization leadership can cancel active construction.", "ORG_BASE_CONSTRUCTION_LEADER_REQUIRED");
  }
}

function ensurePlotOnly(base) {
  const metadata = asRecord(base?.metadata);
  const construction = asRecord(metadata.construction);
  if (metadata.targetType !== "plot_purchase" && construction.buildingState !== "plot_only") {
    throw new HttpError(409, "Main building construction requires an owned unbuilt plot.", "ORG_BASE_PLOT_REQUIRED");
  }
}

function normalizeMaterialInput(payload) {
  const raw = asRecord(payload?.materials);
  const normalized = {};
  for (const key of MATERIAL_KEYS) {
    normalized[key] = asInt(raw[key], 0);
  }
  return normalized;
}

function buildBasePatch(base, patch) {
  const has = (key) => Object.prototype.hasOwnProperty.call(patch, key);
  return {
    periodDueGold: has("periodDueGold") ? patch.periodDueGold : asInt(base.periodDueGold),
    periodPaidGold: has("periodPaidGold") ? patch.periodPaidGold : asInt(base.periodPaidGold),
    periodStartedAt: has("periodStartedAt") ? patch.periodStartedAt : new Date(base.periodStartedAt),
    nextReviewAt: has("nextReviewAt") ? patch.nextReviewAt : new Date(base.nextReviewAt),
    status: has("status") ? patch.status : base.status,
    confiscatedAt: has("confiscatedAt") ? patch.confiscatedAt : (base.confiscatedAt ? new Date(base.confiscatedAt) : null),
    buybackUntil: has("buybackUntil") ? patch.buybackUntil : (base.buybackUntil ? new Date(base.buybackUntil) : null),
    debtGoldAtConfiscation: has("debtGoldAtConfiscation") ? patch.debtGoldAtConfiscation : base.debtGoldAtConfiscation,
    leaderInternalId: has("leaderInternalId") ? patch.leaderInternalId : base.leaderInternalId,
    metadata: has("metadata") ? patch.metadata : asRecord(base.metadata),
  };
}

async function lockOrganization(client, organizationInternalId) {
  const lock = await client.query(
    "SELECT internal_id FROM organizations WHERE internal_id = $1 FOR UPDATE",
    [organizationInternalId],
  );
  if (!lock.rows.length) {
    throw new HttpError(404, "Organization record unavailable.", "ORG_NOT_FOUND");
  }
}

async function setOrgGold(client, organization, nextGold) {
  const treasury = asRecord(organization.treasury);
  return updateOrganizationDetails(client, organization.internalId, {
    treasury: {
      ...treasury,
      gold: asInt(nextGold),
    },
  });
}

async function updateBaseForCompletedMainBuilding(client, base, next) {
  await client.query(
    `
      UPDATE organization_bases
      SET
        property_key = $2,
        monthly_upkeep_gold = $3,
        period_due_gold = $4,
        period_paid_gold = $5,
        period_started_at = $6,
        next_review_at = $7,
        status = $8,
        metadata = $9::jsonb,
        updated_at = NOW()
      WHERE id = $1
    `,
    [
      base.id,
      next.propertyKey,
      asInt(next.monthlyUpkeepGold),
      asInt(next.periodDueGold),
      asInt(next.periodPaidGold),
      new Date(next.periodStartedAt),
      new Date(next.nextReviewAt),
      next.status,
      JSON.stringify(next.metadata ?? {}),
    ],
  );

  return findOrganizationBaseByOrganizationInternalIdForUpdate(client, base.organizationInternalId);
}

function getActiveMainBuildJob(base) {
  const metadata = asRecord(base?.metadata);
  const construction = asRecord(metadata.construction);
  const activeJob = asRecord(construction.activeJob);
  if (construction.buildingState !== "main_building_under_construction") return null;
  if (activeJob.status !== "active") return null;
  return {
    construction,
    activeJob,
  };
}

function normalizeRequestedLaborSource(payload) {
  const laborSource = String(payload?.laborSource ?? "").trim();
  if (!laborSource) return null;
  if (laborSource !== CONSTRUCTION_LABOR_SOURCES.PLAYER_POOL_SOURCE && laborSource !== CONSTRUCTION_LABOR_SOURCES.NPC_SOURCE) {
    throw new HttpError(400, "Unknown labor source selection.", "ORG_BASE_MAIN_BUILD_LABOR_SOURCE_INVALID");
  }
  return laborSource;
}

function calculateMaterialCredit(mainBuilding, suppliedMaterials) {
  const req = asRecord(mainBuilding.materialRequirements);
  const creditPerUnit = asRecord(mainBuilding.materialCreditPerUnit);
  const consumed = {};
  let creditGold = 0;

  for (const key of MATERIAL_KEYS) {
    const required = asInt(req[key], 0);
    const supplied = asInt(suppliedMaterials[key], 0);
    const used = Math.min(required, supplied);
    consumed[key] = used;
    creditGold += used * asInt(creditPerUnit[key], 0);
  }

  return {
    consumed,
    creditGold: asInt(creditGold),
  };
}

export async function startOrganizationMainBuildForUser(user, organizationInternalId, payload = {}) {
  return withTransaction(async (client) => {
    await lockOrganization(client, organizationInternalId);

    const organization = await findOrganizationByInternalId(client, organizationInternalId);
    if (!organization) {
      throw new HttpError(404, "Organization record unavailable.", "ORG_NOT_FOUND");
    }

    const member = ensureMember(organization, user.internalId);
    ensureTreasuryPermission(organization, member);

    if (payload?.rushBuild === true || payload?.rush === true) {
      throw new HttpError(400, "Rush-build is disabled.", "ORG_BASE_RUSH_DISABLED");
    }

    const base = await findOrganizationBaseByOrganizationInternalIdForUpdate(client, organization.internalId);
    if (!base) {
      throw new HttpError(404, "Organization base record unavailable.", "ORG_BASE_NOT_FOUND");
    }
    if (base.status !== "active") {
      throw new HttpError(409, "Main building construction requires an active organization plot.", "ORG_BASE_STATUS_INVALID");
    }

    ensurePlotOnly(base);
    if (getActiveMainBuildJob(base)) {
      throw new HttpError(409, "Only one active construction job is allowed per organization.", "ORG_BASE_MAIN_BUILD_ALREADY_ACTIVE");
    }

    const buildingKey = String(payload?.buildingKey ?? "").trim();
    const mainBuilding = getMainBuildingPlanForOrgType(organization.type, buildingKey);
    if (!mainBuilding) {
      throw new HttpError(400, "Main building option is invalid for this organization type.", "ORG_BASE_MAIN_BUILD_INVALID");
    }

    const suppliedMaterials = normalizeMaterialInput(payload);
    const { consumed, creditGold } = calculateMaterialCredit(mainBuilding, suppliedMaterials);

    const requestedLaborSource = normalizeRequestedLaborSource(payload);
    const playerBuilderProfiles = await listEligiblePlayerBuilders(client);
    const { selected: laborAssignment, comparison: laborComparison } = resolveLaborAssignment(
      mainBuilding,
      playerBuilderProfiles,
      requestedLaborSource,
    );

    if (requestedLaborSource === CONSTRUCTION_LABOR_SOURCES.PLAYER_POOL_SOURCE && laborAssignment.source !== CONSTRUCTION_LABOR_SOURCES.PLAYER_POOL_SOURCE) {
      throw new HttpError(409, "No eligible player builders are currently available for assignment.", "ORG_BASE_MAIN_BUILD_PLAYER_BUILDER_UNAVAILABLE");
    }

    const startedAt = Date.now();
    const durationHours = Math.max(1, asInt(laborAssignment.estimatedTimeHours, asInt(mainBuilding.durationHours, 24)));
    const completesAt = startedAt + durationHours * 60 * 60 * 1000;
    const jobId = `mainbuild_${crypto.randomUUID()}`;

    if (laborAssignment.source === CONSTRUCTION_LABOR_SOURCES.PLAYER_POOL_SOURCE && laborAssignment.assignedBuilderInternalId) {
      await reservePlayerBuilderAssignment(client, {
        builderInternalId: laborAssignment.assignedBuilderInternalId,
        assignmentToken: laborAssignment.assignmentToken ?? `player:${laborAssignment.assignedBuilderInternalId}`,
        organizationInternalId: organization.internalId,
        jobId,
        jobType: "main_building",
        expiresAt: completesAt,
        assignedByInternalId: user.internalId,
      });
    }

    for (const key of MATERIAL_KEYS) {
      const amount = asInt(consumed[key], 0);
      if (amount <= 0) continue;
      const decremented = await decrementOrganizationBaseStorageItem(client, organization.internalId, key, amount);
      if (!decremented) {
        throw new HttpError(400, `Insufficient ${key} in organization-controlled storage.`, "ORG_BASE_MATERIALS_INSUFFICIENT");
      }
    }

    const baseGoldCost = asInt(mainBuilding.baseGoldCost);
    const laborCostGold = asInt(laborAssignment.wageCostGold, asInt(mainBuilding.laborCostGold));
    const subtotalGold = baseGoldCost + laborCostGold;
    const effectiveGoldCost = Math.max(laborCostGold, subtotalGold - creditGold);

    const treasury = asRecord(organization.treasury);
    const treasuryGold = asInt(treasury.gold);
    if (treasuryGold < effectiveGoldCost) {
      throw new HttpError(
        400,
        `Treasury needs ${effectiveGoldCost - treasuryGold} more gold to start this construction contract.`,
        "ORG_BASE_MAIN_BUILD_FUNDS_REQUIRED",
      );
    }

    const nextGold = treasuryGold - effectiveGoldCost;
    const updatedOrganization = await setOrgGold(client, organization, nextGold);

    const metadata = asRecord(base.metadata);
    const construction = asRecord(metadata.construction);
    const history = Array.isArray(construction.history) ? construction.history : [];

    const activeJob = {
      jobId,
      jobType: "main_building",
      status: "active",
      startedAt,
      completesAt,
      durationHours,
      noRefundOnCancel: true,
      labor: {
        source: laborAssignment.source,
        sourceLabel: laborAssignment.sourceLabel,
        wageGold: laborCostGold,
        professionLevel: asInt(laborAssignment.professionLevel, 1),
        ratingReputation: asInt(laborAssignment.ratingReputation, 0),
        estimatedQualityScore: asInt(laborAssignment.estimatedQualityScore, 0),
        estimatedQualityTier: laborAssignment.estimatedQualityTier ?? "standard",
        assignedBuilderInternalId: laborAssignment.assignedBuilderInternalId ?? null,
        assignmentToken: laborAssignment.assignmentToken ?? null,
      },
      prepaid: {
        baseGoldCost,
        laborCostGold,
        subtotalGold,
        materialCreditGold: Math.min(creditGold, subtotalGold - laborCostGold),
        effectiveGoldCost,
        materialsConsumed: consumed,
      },
      quality: {
        tier: "standard_pending",
        estimateTier: laborAssignment.estimatedQualityTier ?? "standard",
        estimateScore: asInt(laborAssignment.estimatedQualityScore, 0),
        final: null,
      },
    };

    const nextConstruction = {
      ...construction,
      buildingState: "main_building_under_construction",
      mainBuildingKey: mainBuilding.key,
      mainBuildingName: mainBuilding.displayName,
      mainBuildingTier: asInt(mainBuilding.tier, 1),
      roomUpgradesLocked: true,
      activeJob,
      history,
      lastStartedAt: startedAt,
    };

    const updatedBase = await updateOrganizationBaseFinancials(
      client,
      base.id,
      buildBasePatch(base, {
        periodDueGold: 0,
        periodPaidGold: 0,
        metadata: {
          ...metadata,
          passiveBenefitsActive: false,
          construction: nextConstruction,
        },
      }),
    );

    await insertOrganizationLog(client, organization.internalId, {
      actorInternalId: user.internalId,
      actorPublicId: user.publicId,
      actionType: "organization_main_build_started",
      summary: {
        buildingKey: mainBuilding.key,
        buildingName: mainBuilding.displayName,
        durationHours,
        completesAt,
        effectiveGoldCost,
        baseGoldCost,
        laborCostGold,
        materialCreditGold: Math.min(creditGold, subtotalGold - laborCostGold),
        materialsConsumed: consumed,
        laborSource: laborAssignment.source,
      },
    });

    await insertOrganizationLog(client, organization.internalId, {
      actorInternalId: user.internalId,
      actorPublicId: user.publicId,
      actionType: "organization_builder_assigned",
      summary: {
        jobId: activeJob.jobId,
        laborSource: laborAssignment.source,
        professionLevel: asInt(laborAssignment.professionLevel, 1),
        ratingReputation: asInt(laborAssignment.ratingReputation, 0),
        wageGold: laborCostGold,
      },
    });

    await recordOrganizationBaseEvent(client, {
      organizationInternalId: organization.internalId,
      baseId: base.id,
      actorInternalId: user.internalId,
      eventType: "builder_assigned",
      summary: {
        jobId: activeJob.jobId,
        laborSource: laborAssignment.source,
        professionLevel: asInt(laborAssignment.professionLevel, 1),
        ratingReputation: asInt(laborAssignment.ratingReputation, 0),
        wageGold: laborCostGold,
      },
    });

    await recordOrganizationBaseEvent(client, {
      organizationInternalId: organization.internalId,
      baseId: base.id,
      actorInternalId: user.internalId,
      eventType: "main_build_started",
      summary: {
        buildingKey: mainBuilding.key,
        buildingName: mainBuilding.displayName,
        durationHours,
        startedAt,
        completesAt,
        prepaidGold: effectiveGoldCost,
        laborSource: laborAssignment.source,
        professionLevel: asInt(laborAssignment.professionLevel, 1),
        ratingReputation: asInt(laborAssignment.ratingReputation, 0),
        materialsConsumed: consumed,
      },
    });

    return {
      organization: {
        ...updatedOrganization,
        treasury: {
          ...asRecord(updatedOrganization?.treasury),
          gold: nextGold,
        },
      },
      base: updatedBase,
      construction: {
        state: "main_building_under_construction",
        activeJob,
        laborComparison,
      },
    };
  });
}

export async function cancelOrganizationMainBuildForUser(user, organizationInternalId, payload = {}) {
  return withTransaction(async (client) => {
    await lockOrganization(client, organizationInternalId);

    const organization = await findOrganizationByInternalId(client, organizationInternalId);
    if (!organization) {
      throw new HttpError(404, "Organization record unavailable.", "ORG_NOT_FOUND");
    }

    const member = ensureMember(organization, user.internalId);
    ensureLeader(organization, member);

    const base = await findOrganizationBaseByOrganizationInternalIdForUpdate(client, organization.internalId);
    if (!base) {
      throw new HttpError(404, "Organization base record unavailable.", "ORG_BASE_NOT_FOUND");
    }

    const active = getActiveMainBuildJob(base);
    if (!active) {
      throw new HttpError(409, "No active main-building construction exists to cancel.", "ORG_BASE_MAIN_BUILD_NOT_ACTIVE");
    }

    const metadata = asRecord(base.metadata);
    const construction = asRecord(metadata.construction);
    const history = Array.isArray(construction.history) ? [...construction.history] : [];
    const cancelledAt = Date.now();
    const cancelReason = String(payload?.reason ?? "Leadership cancelled contract.").trim() || "Leadership cancelled contract.";

    const activeLabor = asRecord(asRecord(active.activeJob).labor);
    const builderReleased = await releasePlayerBuilderAssignment(client, {
      builderInternalId: activeLabor.assignedBuilderInternalId,
      assignmentToken: activeLabor.assignmentToken ?? null,
      reason: "main_build_cancelled",
      releasedByInternalId: user.internalId,
      releasedAt: cancelledAt,
    });

    history.push({
      type: "main_build_cancelled",
      cancelledAt,
      cancelledByPublicId: user.publicId,
      jobId: active.activeJob.jobId,
      prepaid: active.activeJob.prepaid,
      reason: cancelReason,
    });

    const nextConstruction = {
      ...construction,
      buildingState: "plot_only",
      mainBuildingKey: null,
      mainBuildingName: null,
      mainBuildingTier: null,
      activeJob: null,
      roomUpgradesLocked: false,
      history,
      lastCancelledAt: cancelledAt,
    };

    const updatedBase = await updateOrganizationBaseFinancials(
      client,
      base.id,
      buildBasePatch(base, {
        periodDueGold: 0,
        periodPaidGold: 0,
        metadata: {
          ...metadata,
          passiveBenefitsActive: false,
          construction: nextConstruction,
        },
      }),
    );

    await insertOrganizationLog(client, organization.internalId, {
      actorInternalId: user.internalId,
      actorPublicId: user.publicId,
      actionType: "organization_main_build_cancelled",
      summary: {
        jobId: active.activeJob.jobId,
        buildingKey: construction.mainBuildingKey ?? null,
        prepaidGoldLost: asInt(asRecord(active.activeJob.prepaid).effectiveGoldCost),
        reason: cancelReason,
        noRefund: true,
      },
    });

    await recordOrganizationBaseEvent(client, {
      organizationInternalId: organization.internalId,
      baseId: base.id,
      actorInternalId: user.internalId,
      eventType: "main_build_cancelled",
      summary: {
        jobId: active.activeJob.jobId,
        buildingKey: construction.mainBuildingKey ?? null,
        prepaidGoldLost: asInt(asRecord(active.activeJob.prepaid).effectiveGoldCost),
        reason: cancelReason,
        cancelledAt,
      },
    });

    if (activeLabor.assignedBuilderInternalId) {
      await recordOrganizationBaseEvent(client, {
        organizationInternalId: organization.internalId,
        baseId: base.id,
        actorInternalId: user.internalId,
        eventType: "builder_reservation_released",
        summary: {
          reason: "main_build_cancelled",
          jobId: active.activeJob.jobId,
          jobType: active.activeJob.jobType ?? "main_building",
          builderReleased,
        },
      });
    }

    return {
      base: updatedBase,
      cancelled: {
        jobId: active.activeJob.jobId,
        prepaidGoldLost: asInt(asRecord(active.activeJob.prepaid).effectiveGoldCost),
        noRefund: true,
      },
    };
  });
}

export async function runOrganizationMainBuildCompletionSweep({ nowTs, actorInternalId = null, client }) {
  const now = asInt(nowTs, Date.now());
  const activeBases = await listActiveOrganizationBases(client);
  const completed = [];

  for (const baseCandidate of activeBases) {
    const lockedBase = await findOrganizationBaseByOrganizationInternalIdForUpdate(client, baseCandidate.organizationInternalId);
    if (!lockedBase || lockedBase.id !== baseCandidate.id || lockedBase.status !== "active") continue;

    const active = getActiveMainBuildJob(lockedBase);
    if (!active) continue;

    const completesAt = asInt(active.activeJob.completesAt, 0);
    if (completesAt <= 0 || completesAt > now) continue;

    const organization = await findOrganizationByInternalId(client, lockedBase.organizationInternalId);
    if (!organization) continue;

    const buildingKey = String(active.construction.mainBuildingKey ?? "").trim();
    const mainBuilding = getMainBuildingPlanForOrgType(organization.type, buildingKey);
    if (!mainBuilding) {
      await recordOrganizationBaseEvent(client, {
        organizationInternalId: lockedBase.organizationInternalId,
        baseId: lockedBase.id,
        actorInternalId,
        eventType: "main_build_completion_failed",
        summary: {
          reason: "missing_building_definition",
          buildingKey,
        },
      });
      continue;
    }

    const completionAt = now;
    const reviewAnchorDayUtc = new Date(completionAt).getUTCDate();
    const nextReviewAt = addOneUtcMonthPreservingAnchor(completionAt);

    const metadata = asRecord(lockedBase.metadata);
    const construction = asRecord(metadata.construction);
    const history = Array.isArray(construction.history) ? [...construction.history] : [];

    const qualityOutcome = await resolveConstructionQualityOutcome(client, mainBuilding, active.activeJob);

    history.push({
      type: "main_build_completed",
      completedAt: completionAt,
      jobId: active.activeJob.jobId,
      buildingKey: mainBuilding.key,
      buildingName: mainBuilding.displayName,
      qualityTier: qualityOutcome.tier,
      qualityScore: qualityOutcome.score,
    });

    const nextConstruction = {
      ...construction,
      buildingState: "main_building_complete",
      mainBuildingKey: mainBuilding.key,
      mainBuildingName: mainBuilding.displayName,
      mainBuildingTier: asInt(mainBuilding.tier, 1),
      activeJob: null,
      roomUpgradesLocked: false,
      completedAt: completionAt,
      quality: {
        ...asRecord(asRecord(active.activeJob).quality),
        final: qualityOutcome,
      },
      history,
    };

    const baseMonthlyUpkeepGold = asInt(mainBuilding.monthlyUpkeepGold, 0);
    const monthlyUpkeepGold = Math.max(0, Math.round(baseMonthlyUpkeepGold * Number(qualityOutcome.modifiers?.upkeepMultiplier ?? 1)));
    const dailyUpkeepGold = monthlyUpkeepGold > 0 ? Math.max(1, Math.ceil(monthlyUpkeepGold / 30)) : 0;

    const updatedBase = await updateBaseForCompletedMainBuilding(client, lockedBase, {
      propertyKey: mainBuilding.key,
      monthlyUpkeepGold,
      periodDueGold: 0,
      periodPaidGold: 0,
      periodStartedAt: completionAt,
      nextReviewAt,
      status: "active",
      metadata: {
        ...metadata,
        targetType: "built_main_building",
        passiveBenefitsActive: true,
        reviewAnchorDayUtc,
        acquisitionCostGold: asInt(metadata.acquisitionCostGold, 0),
        construction: nextConstruction,
        buildQuality: qualityOutcome,
        qualityModifiers: {
          ...asRecord(metadata.qualityModifiers),
          upkeepMultiplier: Number(qualityOutcome.modifiers?.upkeepMultiplier ?? 1),
          operationalMultiplier: Number(qualityOutcome.modifiers?.operationalMultiplier ?? 1),
        },
        dailyUpkeepGold,
        lastAccruedAt: completionAt,
        accruedDaysInPeriod: 0,
      },
    });

    await insertOrganizationLog(client, organization.internalId, {
      actorInternalId,
      actorPublicId: null,
      actionType: "organization_main_build_completed",
      summary: {
        buildingKey: mainBuilding.key,
        buildingName: mainBuilding.displayName,
        completionAt,
        monthlyUpkeepGold,
        nextReviewAt,
        qualityTier: qualityOutcome.tier,
        qualityScore: qualityOutcome.score,
      },
    });

    await recordOrganizationBaseEvent(client, {
      organizationInternalId: organization.internalId,
      baseId: lockedBase.id,
      actorInternalId,
      eventType: "main_build_completed",
      summary: {
        buildingKey: mainBuilding.key,
        buildingName: mainBuilding.displayName,
        completionAt,
        monthlyUpkeepGold,
        nextReviewAt,
        qualityTier: qualityOutcome.tier,
        qualityScore: qualityOutcome.score,
      },
    });

    const activeLabor = asRecord(asRecord(active.activeJob).labor);
    const builderReleased = await releasePlayerBuilderAssignment(client, {
      builderInternalId: activeLabor.assignedBuilderInternalId,
      assignmentToken: activeLabor.assignmentToken ?? null,
      reason: "main_build_completed",
      releasedByInternalId: actorInternalId,
      releasedAt: completionAt,
    });

    if (activeLabor.assignedBuilderInternalId) {
      await recordOrganizationBaseEvent(client, {
        organizationInternalId: organization.internalId,
        baseId: lockedBase.id,
        actorInternalId,
        eventType: "builder_reservation_released",
        summary: {
          reason: "main_build_completed",
          jobId: active.activeJob.jobId,
          jobType: active.activeJob.jobType ?? "main_building",
          builderReleased,
        },
      });
    }

    completed.push({
      baseId: lockedBase.id,
      organizationInternalId: organization.internalId,
      buildingKey: mainBuilding.key,
      monthlyUpkeepGold,
      nextReviewAt,
      completedAt: completionAt,
      propertyKeyAfter: updatedBase?.propertyKey ?? mainBuilding.key,
    });
  }

  return {
    completedCount: completed.length,
    completed,
  };
}
