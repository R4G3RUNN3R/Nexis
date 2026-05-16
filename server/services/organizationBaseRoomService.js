import crypto from "node:crypto";
import { withTransaction } from "../db/pool.js";
import { HttpError } from "../lib/errors.js";
import {
  decrementOrganizationBaseStorageItem,
  findOrganizationBaseByOrganizationInternalIdForUpdate,
  listActiveOrganizationBases,
  recordOrganizationBaseEvent,
} from "../repositories/organizationBaseRepository.js";
import {
  findOrganizationByInternalId,
  insertOrganizationLog,
  updateOrganizationDetails,
} from "../repositories/organizationRepository.js";
import { getRoomUpgradeV1Option } from "../data/organizationBaseData.js";
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
    throw new HttpError(403, "Treasury authority required for this room action.", "ORG_BASE_ROOM_TREASURY_PERMISSION_REQUIRED");
  }
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

function buildBasePatch(base, patch) {
  const has = (key) => Object.prototype.hasOwnProperty.call(patch, key);
  return {
    monthlyUpkeepGold: has("monthlyUpkeepGold") ? patch.monthlyUpkeepGold : asInt(base.monthlyUpkeepGold),
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

async function updateOrganizationBaseRecord(client, base, patch) {
  const next = buildBasePatch(base, patch);
  await client.query(
    `
      UPDATE organization_bases
      SET
        monthly_upkeep_gold = $2,
        period_due_gold = $3,
        period_paid_gold = $4,
        period_started_at = $5,
        next_review_at = $6,
        status = $7,
        confiscated_at = $8,
        buyback_until = $9,
        debt_gold_at_confiscation = $10,
        leader_internal_id = $11,
        metadata = $12::jsonb,
        updated_at = NOW()
      WHERE id = $1
    `,
    [
      base.id,
      asInt(next.monthlyUpkeepGold),
      asInt(next.periodDueGold),
      asInt(next.periodPaidGold),
      new Date(next.periodStartedAt),
      new Date(next.nextReviewAt),
      next.status,
      next.confiscatedAt ?? null,
      next.buybackUntil ?? null,
      next.debtGoldAtConfiscation == null ? null : asInt(next.debtGoldAtConfiscation),
      next.leaderInternalId ?? null,
      JSON.stringify(next.metadata ?? {}),
    ],
  );

  return findOrganizationBaseByOrganizationInternalIdForUpdate(client, base.organizationInternalId);
}

function normalizeMaterialInput(payload) {
  const raw = asRecord(payload?.materials);
  const normalized = {};
  for (const key of MATERIAL_KEYS) {
    normalized[key] = asInt(raw[key], 0);
  }
  return normalized;
}

function normalizeRequestedLaborSource(payload) {
  const laborSource = String(payload?.laborSource ?? "").trim();
  if (!laborSource) return null;
  if (laborSource !== CONSTRUCTION_LABOR_SOURCES.PLAYER_POOL_SOURCE && laborSource !== CONSTRUCTION_LABOR_SOURCES.NPC_SOURCE) {
    throw new HttpError(400, "Unknown labor source selection.", "ORG_BASE_ROOM_LABOR_SOURCE_INVALID");
  }
  return laborSource;
}

function calculateMaterialCredit(roomPlan, suppliedMaterials) {
  const req = asRecord(roomPlan.materialRequirements);
  const creditPerUnit = asRecord(roomPlan.materialCreditPerUnit);
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

function setOrgGold(organization, nextGold) {
  const treasury = asRecord(organization.treasury);
  return {
    ...organization,
    treasury: {
      ...treasury,
      gold: asInt(nextGold),
    },
  };
}

function readConstruction(base) {
  const metadata = asRecord(base.metadata);
  return asRecord(metadata.construction);
}

function listRooms(construction) {
  return Array.isArray(construction.rooms) ? [...construction.rooms].map((entry) => asRecord(entry)) : [];
}

function getActiveJob(construction) {
  const active = asRecord(construction.activeJob);
  if (active.status !== "active") return null;
  return active;
}

async function recordBuilderReleaseEvent(client, {
  organizationInternalId,
  baseId,
  actorInternalId = null,
  activeJob,
  reason,
  builderReleased,
}) {
  const labor = asRecord(asRecord(activeJob).labor);
  if (!labor.assignedBuilderInternalId) return;

  await recordOrganizationBaseEvent(client, {
    organizationInternalId,
    baseId,
    actorInternalId,
    eventType: "builder_reservation_released",
    summary: {
      reason,
      jobId: activeJob.jobId ?? null,
      jobType: activeJob.jobType ?? null,
      builderReleased,
    },
  });
}

function countInstalledRooms(rooms) {
  return rooms.filter((entry) => entry.status === "complete").length;
}

function ensureMainBuildingComplete(base) {
  const construction = readConstruction(base);
  const state = construction.buildingState;
  if (state === "main_building_under_construction") {
    throw new HttpError(
      409,
      "Room upgrades are locked while the main building is under construction.",
      "ORG_BASE_ROOM_MAIN_BUILD_IN_PROGRESS",
    );
  }
  if (state !== "main_building_complete" && state !== "room_upgrade_under_construction") {
    throw new HttpError(
      409,
      "Room upgrades require a completed main building.",
      "ORG_BASE_ROOM_MAIN_BUILD_REQUIRED",
    );
  }
  return construction;
}

function ensureNoActiveConstruction(construction) {
  const active = getActiveJob(construction);
  if (active) {
    throw new HttpError(
      409,
      "Only one active construction job is allowed per organization.",
      "ORG_BASE_ROOM_ACTIVE_JOB_EXISTS",
    );
  }
}

function getRoomCapacity(base, construction) {
  const metadata = asRecord(base.metadata);
  return Math.max(0, asInt(construction.roomCapacity ?? metadata.roomCapacity, 0));
}

function findInstalledRoom(rooms, roomKey) {
  return rooms.find((entry) => entry.roomKey === roomKey && entry.status === "complete") ?? null;
}

function buildRoomPlanForQuality(roomPlan) {
  return {
    ...roomPlan,
    complexity: Number(roomPlan.complexity ?? 1),
    materialRequirements: asRecord(roomPlan.materialRequirements),
    materialCreditPerUnit: asRecord(roomPlan.materialCreditPerUnit),
  };
}

export async function startOrganizationRoomBuildForUser(user, organizationInternalId, payload = {}) {
  return withTransaction(async (client) => {
    await lockOrganization(client, organizationInternalId);

    const organization = await findOrganizationByInternalId(client, organizationInternalId);
    if (!organization) throw new HttpError(404, "Organization record unavailable.", "ORG_NOT_FOUND");

    const member = ensureMember(organization, user.internalId);
    ensureTreasuryPermission(organization, member);

    const base = await findOrganizationBaseByOrganizationInternalIdForUpdate(client, organization.internalId);
    if (!base) throw new HttpError(404, "Organization base record unavailable.", "ORG_BASE_NOT_FOUND");
    if (base.status !== "active") {
      throw new HttpError(409, "Room upgrades require an active base.", "ORG_BASE_STATUS_INVALID");
    }

    const construction = ensureMainBuildingComplete(base);
    ensureNoActiveConstruction(construction);

    const roomKey = String(payload?.roomKey ?? "").trim();
    const roomPlan = getRoomUpgradeV1Option(organization.type, roomKey);
    if (!roomPlan) {
      throw new HttpError(400, "Room option is invalid for this organization type.", "ORG_BASE_ROOM_INVALID");
    }

    const rooms = listRooms(construction);
    if (findInstalledRoom(rooms, roomPlan.key)) {
      throw new HttpError(409, "This room is already installed.", "ORG_BASE_ROOM_ALREADY_INSTALLED");
    }

    const roomCapacity = getRoomCapacity(base, construction);
    const roomsUsed = countInstalledRooms(rooms);
    if (roomsUsed >= roomCapacity) {
      throw new HttpError(409, "Room capacity is full for this plot size.", "ORG_BASE_ROOM_CAPACITY_REACHED");
    }

    const suppliedMaterials = normalizeMaterialInput(payload);
    const { consumed, creditGold } = calculateMaterialCredit(roomPlan, suppliedMaterials);

    const requestedLaborSource = normalizeRequestedLaborSource(payload);
    const playerBuilderProfiles = await listEligiblePlayerBuilders(client);
    const { selected: laborAssignment, comparison: laborComparison } = resolveLaborAssignment(
      roomPlan,
      playerBuilderProfiles,
      requestedLaborSource,
    );

    if (requestedLaborSource === CONSTRUCTION_LABOR_SOURCES.PLAYER_POOL_SOURCE && laborAssignment.source !== CONSTRUCTION_LABOR_SOURCES.PLAYER_POOL_SOURCE) {
      throw new HttpError(409, "No eligible player builders are currently available for assignment.", "ORG_BASE_ROOM_PLAYER_BUILDER_UNAVAILABLE");
    }

    for (const key of MATERIAL_KEYS) {
      const amount = asInt(consumed[key], 0);
      if (amount <= 0) continue;
      const decremented = await decrementOrganizationBaseStorageItem(client, organization.internalId, key, amount);
      if (!decremented) {
        throw new HttpError(400, `Insufficient ${key} in organization-controlled storage.`, "ORG_BASE_MATERIALS_INSUFFICIENT");
      }
    }

    const baseGoldCost = asInt(roomPlan.baseGoldCost);
    const laborCostGold = asInt(laborAssignment.wageCostGold, asInt(roomPlan.laborCostGold));
    const subtotalGold = baseGoldCost + laborCostGold;
    const effectiveGoldCost = Math.max(laborCostGold, subtotalGold - creditGold);

    const treasury = asRecord(organization.treasury);
    const treasuryGold = asInt(treasury.gold);
    if (treasuryGold < effectiveGoldCost) {
      throw new HttpError(
        400,
        `Treasury needs ${effectiveGoldCost - treasuryGold} more gold to start this room contract.`,
        "ORG_BASE_ROOM_FUNDS_REQUIRED",
      );
    }

    const startedAt = Date.now();
    const durationHours = Math.max(1, asInt(laborAssignment.estimatedTimeHours, asInt(roomPlan.durationHours, 8)));
    const completesAt = startedAt + durationHours * 60 * 60 * 1000;
    const jobId = `room_${crypto.randomUUID()}`;

    if (laborAssignment.source === CONSTRUCTION_LABOR_SOURCES.PLAYER_POOL_SOURCE && laborAssignment.assignedBuilderInternalId) {
      await reservePlayerBuilderAssignment(client, {
        builderInternalId: laborAssignment.assignedBuilderInternalId,
        assignmentToken: laborAssignment.assignmentToken ?? `player:${laborAssignment.assignedBuilderInternalId}`,
        organizationInternalId: organization.internalId,
        jobId,
        jobType: "room_upgrade",
        expiresAt: completesAt,
        assignedByInternalId: user.internalId,
      });
    }

    const nextGold = treasuryGold - effectiveGoldCost;
    const updatedOrganization = await updateOrganizationDetails(client, organization.internalId, {
      treasury: {
        ...treasury,
        gold: nextGold,
      },
    });

    const history = Array.isArray(construction.history) ? [...construction.history] : [];

    const activeJob = {
      jobId,
      jobType: "room_upgrade",
      roomKey: roomPlan.key,
      roomName: roomPlan.displayName,
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

    history.push({
      type: "room_build_started",
      roomKey: roomPlan.key,
      roomName: roomPlan.displayName,
      roomId: activeJob.jobId,
      startedAt,
      completesAt,
    });

    const nextConstruction = {
      ...construction,
      buildingState: "room_upgrade_under_construction",
      roomUpgradesLocked: true,
      activeJob,
      history,
      lastRoomStartedAt: startedAt,
    };

    const updatedBase = await updateOrganizationBaseRecord(client, base, {
      metadata: {
        ...asRecord(base.metadata),
        construction: nextConstruction,
      },
    });

    await insertOrganizationLog(client, organization.internalId, {
      actorInternalId: user.internalId,
      actorPublicId: user.publicId,
      actionType: "organization_room_build_started",
      summary: {
        roomKey: roomPlan.key,
        roomName: roomPlan.displayName,
        durationHours,
        completesAt,
        effectiveGoldCost,
        baseGoldCost,
        laborCostGold,
        materialsConsumed: consumed,
      },
    });

    await recordOrganizationBaseEvent(client, {
      organizationInternalId: organization.internalId,
      baseId: base.id,
      actorInternalId: user.internalId,
      eventType: "room_build_started",
      summary: {
        roomKey: roomPlan.key,
        roomName: roomPlan.displayName,
        roomId: activeJob.jobId,
        durationHours,
        completesAt,
        prepaidGold: effectiveGoldCost,
        laborSource: laborAssignment.source,
        materialsConsumed: consumed,
      },
    });

    return {
      organization: setOrgGold(updatedOrganization ?? organization, nextGold),
      base: updatedBase,
      construction: {
        state: "room_upgrade_under_construction",
        activeJob,
        laborComparison,
      },
    };
  });
}

export async function cancelOrganizationRoomBuildForUser(user, organizationInternalId, payload = {}) {
  return withTransaction(async (client) => {
    await lockOrganization(client, organizationInternalId);

    const organization = await findOrganizationByInternalId(client, organizationInternalId);
    if (!organization) throw new HttpError(404, "Organization record unavailable.", "ORG_NOT_FOUND");

    const member = ensureMember(organization, user.internalId);
    ensureTreasuryPermission(organization, member);

    const base = await findOrganizationBaseByOrganizationInternalIdForUpdate(client, organization.internalId);
    if (!base) throw new HttpError(404, "Organization base record unavailable.", "ORG_BASE_NOT_FOUND");
    if (base.status !== "active") {
      throw new HttpError(409, "Room cancellation requires an active base.", "ORG_BASE_STATUS_INVALID");
    }

    const construction = ensureMainBuildingComplete(base);
    const activeJob = getActiveJob(construction);
    if (!activeJob || activeJob.jobType !== "room_upgrade") {
      throw new HttpError(409, "No active room construction exists to cancel.", "ORG_BASE_ROOM_BUILD_NOT_ACTIVE");
    }

    const cancelledAt = Date.now();
    const cancelReason = String(payload?.reason ?? "Treasury cancelled room construction.").trim() || "Treasury cancelled room construction.";
    const activeLabor = asRecord(activeJob.labor);
    const builderReleased = await releasePlayerBuilderAssignment(client, {
      builderInternalId: activeLabor.assignedBuilderInternalId,
      assignmentToken: activeLabor.assignmentToken ?? null,
      reason: "room_build_cancelled",
      releasedByInternalId: user.internalId,
      releasedAt: cancelledAt,
    });

    const history = Array.isArray(construction.history) ? [...construction.history] : [];
    history.push({
      type: "room_build_cancelled",
      roomKey: activeJob.roomKey ?? null,
      roomName: activeJob.roomName ?? null,
      roomId: activeJob.jobId ?? null,
      cancelledAt,
      cancelledByPublicId: user.publicId,
      prepaid: activeJob.prepaid ?? null,
      reason: cancelReason,
      noRefund: true,
    });

    const metadata = asRecord(base.metadata);
    const nextConstruction = {
      ...construction,
      buildingState: "main_building_complete",
      roomUpgradesLocked: false,
      activeJob: null,
      history,
      lastRoomCancelledAt: cancelledAt,
    };

    const updatedBase = await updateOrganizationBaseRecord(client, base, {
      metadata: {
        ...metadata,
        construction: nextConstruction,
      },
    });

    const prepaidGoldLost = asInt(asRecord(activeJob.prepaid).effectiveGoldCost);

    await insertOrganizationLog(client, organization.internalId, {
      actorInternalId: user.internalId,
      actorPublicId: user.publicId,
      actionType: "organization_room_build_cancelled",
      summary: {
        roomKey: activeJob.roomKey ?? null,
        roomName: activeJob.roomName ?? null,
        jobId: activeJob.jobId ?? null,
        prepaidGoldLost,
        reason: cancelReason,
        noRefund: true,
      },
    });

    await recordOrganizationBaseEvent(client, {
      organizationInternalId: organization.internalId,
      baseId: base.id,
      actorInternalId: user.internalId,
      eventType: "room_build_cancelled",
      summary: {
        roomKey: activeJob.roomKey ?? null,
        roomName: activeJob.roomName ?? null,
        jobId: activeJob.jobId ?? null,
        prepaidGoldLost,
        reason: cancelReason,
        cancelledAt,
      },
    });

    await recordBuilderReleaseEvent(client, {
      organizationInternalId: organization.internalId,
      baseId: base.id,
      actorInternalId: user.internalId,
      activeJob,
      reason: "room_build_cancelled",
      builderReleased,
    });

    return {
      base: updatedBase,
      cancelled: {
        jobId: activeJob.jobId ?? null,
        roomKey: activeJob.roomKey ?? null,
        prepaidGoldLost,
        noRefund: true,
      },
    };
  });
}

export async function removeOrganizationBaseRoomForUser(user, organizationInternalId, payload = {}) {
  return withTransaction(async (client) => {
    await lockOrganization(client, organizationInternalId);

    const organization = await findOrganizationByInternalId(client, organizationInternalId);
    if (!organization) throw new HttpError(404, "Organization record unavailable.", "ORG_NOT_FOUND");

    const member = ensureMember(organization, user.internalId);
    ensureTreasuryPermission(organization, member);

    const base = await findOrganizationBaseByOrganizationInternalIdForUpdate(client, organization.internalId);
    if (!base) throw new HttpError(404, "Organization base record unavailable.", "ORG_BASE_NOT_FOUND");
    if (base.status !== "active") {
      throw new HttpError(409, "Room removal requires an active base.", "ORG_BASE_STATUS_INVALID");
    }

    const construction = ensureMainBuildingComplete(base);
    ensureNoActiveConstruction(construction);

    const roomKey = String(payload?.roomKey ?? "").trim();
    if (!roomKey) {
      throw new HttpError(400, "Room key is required.", "ORG_BASE_ROOM_KEY_REQUIRED");
    }

    const roomPlan = getRoomUpgradeV1Option(organization.type, roomKey);
    if (!roomPlan) {
      throw new HttpError(400, "Room option is invalid for this organization type.", "ORG_BASE_ROOM_INVALID");
    }

    const rooms = listRooms(construction);
    const roomIndex = rooms.findIndex((entry) => entry.roomKey === roomKey && entry.status === "complete");
    if (roomIndex < 0) {
      throw new HttpError(404, "Installed room not found for removal.", "ORG_BASE_ROOM_NOT_FOUND");
    }

    const treasury = asRecord(organization.treasury);
    const treasuryGold = asInt(treasury.gold);
    const removalCostGold = asInt(roomPlan.removalCostGold, 0);
    if (treasuryGold < removalCostGold) {
      throw new HttpError(
        400,
        `Treasury needs ${removalCostGold - treasuryGold} more gold to remove this room.`,
        "ORG_BASE_ROOM_REMOVE_FUNDS_REQUIRED",
      );
    }

    const removedAt = Date.now();
    const room = rooms[roomIndex];
    rooms[roomIndex] = {
      ...room,
      status: "removed",
      removedAt,
      removedByPublicId: user.publicId,
      removalCostGold,
      noRefund: true,
    };

    const roomsUsed = countInstalledRooms(rooms);
    const history = Array.isArray(construction.history) ? [...construction.history] : [];
    history.push({
      type: "room_removed",
      roomKey,
      roomName: room.roomName ?? roomPlan.displayName,
      roomId: room.roomId ?? null,
      removedAt,
      removalCostGold,
      noRefund: true,
    });

    const monthlyUpkeepGold = Math.max(0, asInt(base.monthlyUpkeepGold) - asInt(room.monthlyUpkeepGold, asInt(roomPlan.monthlyUpkeepGold, 0)));
    const metadata = asRecord(base.metadata);
    const nextConstruction = {
      ...construction,
      rooms,
      roomsUsed,
      history,
      roomUpgradesLocked: false,
      activeJob: null,
      buildingState: "main_building_complete",
    };

    const nextGold = treasuryGold - removalCostGold;
    const updatedOrganization = await updateOrganizationDetails(client, organization.internalId, {
      treasury: {
        ...treasury,
        gold: nextGold,
      },
    });

    const updatedBase = await updateOrganizationBaseRecord(client, base, {
      monthlyUpkeepGold,
      metadata: {
        ...metadata,
        dailyUpkeepGold: monthlyUpkeepGold > 0 ? Math.max(1, Math.ceil(monthlyUpkeepGold / 30)) : 0,
        construction: nextConstruction,
      },
    });

    await insertOrganizationLog(client, organization.internalId, {
      actorInternalId: user.internalId,
      actorPublicId: user.publicId,
      actionType: "organization_room_removed",
      summary: {
        roomKey,
        roomName: room.roomName ?? roomPlan.displayName,
        removalCostGold,
        noRefund: true,
        monthlyUpkeepGold,
      },
    });

    await recordOrganizationBaseEvent(client, {
      organizationInternalId: organization.internalId,
      baseId: base.id,
      actorInternalId: user.internalId,
      eventType: "room_removed",
      summary: {
        roomKey,
        roomName: room.roomName ?? roomPlan.displayName,
        removalCostGold,
        noRefund: true,
        removedAt,
      },
    });

    return {
      organization: setOrgGold(updatedOrganization ?? organization, nextGold),
      base: updatedBase,
      removed: {
        roomKey,
        removalCostGold,
        noRefund: true,
      },
    };
  });
}

export async function runOrganizationRoomBuildCompletionSweep({ nowTs, actorInternalId = null, client }) {
  const now = asInt(nowTs, Date.now());
  const activeBases = await listActiveOrganizationBases(client);
  const completed = [];

  for (const baseCandidate of activeBases) {
    const lockedBase = await findOrganizationBaseByOrganizationInternalIdForUpdate(client, baseCandidate.organizationInternalId);
    if (!lockedBase || lockedBase.id !== baseCandidate.id || lockedBase.status !== "active") continue;

    const construction = readConstruction(lockedBase);
    if (construction.buildingState !== "room_upgrade_under_construction") continue;

    const activeJob = getActiveJob(construction);
    if (!activeJob || activeJob.jobType !== "room_upgrade") continue;

    const completesAt = asInt(activeJob.completesAt, 0);
    if (completesAt <= 0 || completesAt > now) continue;

    const organization = await findOrganizationByInternalId(client, lockedBase.organizationInternalId);
    if (!organization) continue;

    const roomKey = String(activeJob.roomKey ?? "").trim();
    const roomPlan = getRoomUpgradeV1Option(organization.type, roomKey);
    if (!roomPlan) {
      const builderReleased = await releasePlayerBuilderAssignment(client, {
        builderInternalId: asRecord(asRecord(activeJob).labor).assignedBuilderInternalId,
        assignmentToken: asRecord(asRecord(activeJob).labor).assignmentToken ?? null,
        reason: "room_build_completion_failed_missing_definition",
        releasedByInternalId: actorInternalId,
        releasedAt: now,
      });
      await recordOrganizationBaseEvent(client, {
        organizationInternalId: lockedBase.organizationInternalId,
        baseId: lockedBase.id,
        actorInternalId,
        eventType: "room_build_completion_failed",
        summary: {
          reason: "missing_room_definition",
          roomKey,
          jobId: activeJob.jobId,
        },
      });
      await recordBuilderReleaseEvent(client, {
        organizationInternalId: lockedBase.organizationInternalId,
        baseId: lockedBase.id,
        actorInternalId,
        activeJob,
        reason: "room_build_completion_failed_missing_definition",
        builderReleased,
      });
      continue;
    }

    const rooms = listRooms(construction);
    const roomCapacity = getRoomCapacity(lockedBase, construction);
    const roomsUsed = countInstalledRooms(rooms);
    if (roomsUsed >= roomCapacity) {
      const builderReleased = await releasePlayerBuilderAssignment(client, {
        builderInternalId: asRecord(asRecord(activeJob).labor).assignedBuilderInternalId,
        assignmentToken: asRecord(asRecord(activeJob).labor).assignmentToken ?? null,
        reason: "room_build_completion_failed_capacity",
        releasedByInternalId: actorInternalId,
        releasedAt: now,
      });
      await recordOrganizationBaseEvent(client, {
        organizationInternalId: lockedBase.organizationInternalId,
        baseId: lockedBase.id,
        actorInternalId,
        eventType: "room_build_completion_failed",
        summary: {
          reason: "capacity_reached_during_completion",
          roomKey,
          jobId: activeJob.jobId,
        },
      });
      await recordBuilderReleaseEvent(client, {
        organizationInternalId: lockedBase.organizationInternalId,
        baseId: lockedBase.id,
        actorInternalId,
        activeJob,
        reason: "room_build_completion_failed_capacity",
        builderReleased,
      });
      continue;
    }

    const qualityOutcome = await resolveConstructionQualityOutcome(client, buildRoomPlanForQuality(roomPlan), activeJob);
    const completedAt = now;

    const roomUpkeepBase = asInt(roomPlan.monthlyUpkeepGold, 0);
    const roomUpkeepGold = Math.max(0, Math.round(roomUpkeepBase * Number(qualityOutcome.modifiers?.upkeepMultiplier ?? 1)));

    rooms.push({
      roomId: `room_${crypto.randomUUID()}`,
      roomKey: roomPlan.key,
      roomName: roomPlan.displayName,
      status: "complete",
      startedAt: asInt(activeJob.startedAt, completedAt),
      completedAt,
      monthlyUpkeepGold: roomUpkeepGold,
      qualityTier: qualityOutcome.tier,
      qualityScore: qualityOutcome.score,
      qualityModifiers: qualityOutcome.modifiers,
      laborSource: asRecord(activeJob.labor).source ?? null,
    });

    const nextRoomsUsed = countInstalledRooms(rooms);
    const history = Array.isArray(construction.history) ? [...construction.history] : [];
    history.push({
      type: "room_build_completed",
      roomKey: roomPlan.key,
      roomName: roomPlan.displayName,
      roomUpkeepGold,
      qualityTier: qualityOutcome.tier,
      qualityScore: qualityOutcome.score,
      completedAt,
      jobId: activeJob.jobId,
    });

    const monthlyUpkeepGold = Math.max(0, asInt(lockedBase.monthlyUpkeepGold) + roomUpkeepGold);

    const metadata = asRecord(lockedBase.metadata);
    const nextConstruction = {
      ...construction,
      buildingState: "main_building_complete",
      roomUpgradesLocked: false,
      activeJob: null,
      rooms,
      roomsUsed: nextRoomsUsed,
      lastRoomCompletedAt: completedAt,
      history,
    };

    const updatedBase = await updateOrganizationBaseRecord(client, lockedBase, {
      monthlyUpkeepGold,
      metadata: {
        ...metadata,
        construction: nextConstruction,
        dailyUpkeepGold: monthlyUpkeepGold > 0 ? Math.max(1, Math.ceil(monthlyUpkeepGold / 30)) : 0,
      },
    });

    await insertOrganizationLog(client, organization.internalId, {
      actorInternalId,
      actorPublicId: null,
      actionType: "organization_room_build_completed",
      summary: {
        roomKey: roomPlan.key,
        roomName: roomPlan.displayName,
        roomUpkeepGold,
        monthlyUpkeepGold,
        qualityTier: qualityOutcome.tier,
        qualityScore: qualityOutcome.score,
        completedAt,
      },
    });

    await recordOrganizationBaseEvent(client, {
      organizationInternalId: organization.internalId,
      baseId: lockedBase.id,
      actorInternalId,
      eventType: "room_build_completed",
      summary: {
        roomKey: roomPlan.key,
        roomName: roomPlan.displayName,
        roomUpkeepGold,
        monthlyUpkeepGold,
        qualityTier: qualityOutcome.tier,
        qualityScore: qualityOutcome.score,
        completedAt,
      },
    });

    const builderReleased = await releasePlayerBuilderAssignment(client, {
      builderInternalId: asRecord(asRecord(activeJob).labor).assignedBuilderInternalId,
      assignmentToken: asRecord(asRecord(activeJob).labor).assignmentToken ?? null,
      reason: "room_build_completed",
      releasedByInternalId: actorInternalId,
      releasedAt: completedAt,
    });

    await recordBuilderReleaseEvent(client, {
      organizationInternalId: organization.internalId,
      baseId: lockedBase.id,
      actorInternalId,
      activeJob,
      reason: "room_build_completed",
      builderReleased,
    });

    completed.push({
      baseId: lockedBase.id,
      organizationInternalId: organization.internalId,
      roomKey: roomPlan.key,
      roomUpkeepGold,
      monthlyUpkeepGold,
      roomsUsed: nextRoomsUsed,
      roomCapacity,
      completedAt,
      qualityTier: qualityOutcome.tier,
    });
  }

  return {
    completedCount: completed.length,
    completed,
  };
}
