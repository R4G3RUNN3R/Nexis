import { withTransaction } from "../db/pool.js";
import { HttpError } from "../lib/errors.js";
import {
  createOrganizationBase,
  deleteOrganizationBaseById,
  findOrganizationBaseByOrganizationInternalId,
  findOpenAuctionByBaseId,
  listOrganizationBaseEvents,
  listOrganizationBaseStorage,
  recordOrganizationBaseEvent,
} from "../repositories/organizationBaseRepository.js";
import {
  findOrganizationByInternalId,
  findOrganizationByPublicId,
  insertOrganizationLog,
  updateOrganizationDetails,
} from "../repositories/organizationRepository.js";
import { findPlayerStateByUserInternalId } from "../repositories/playerStateRepository.js";
import {
  buildLaborComparisonForMainBuilding,
  getConstructionEligibleCivicTrackIds,
  listEligiblePlayerBuilders,
  summarizeBuilderAvailability,
} from "./organizationBaseLaborService.js";
import {
  PROPERTY_OFFICE_MIN_LEVEL,
  PROPERTY_OFFICE_NPC_SELLBACK_RETURN_FRACTION,
  getAcquisitionModes,
  getEligibleBuildingTarget,
  getEligiblePlotTarget,
  getMainBuildingV1Option,
  isValidOrganizationTypeForTarget,
  listEligibleBuildingTargets,
  listEligiblePlotTargets,
  listMainBuildingV1Options,
  listRoomUpgradeV1Options,
} from "../data/organizationBaseData.js";
import { computeOrganizationBaseEffects } from "./organizationBaseEffectService.js";

const asRecord = (value) => (value && typeof value === "object" && !Array.isArray(value) ? value : {});
const asInt = (value, fallback = 0) => {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return fallback;
  return Math.max(0, Math.floor(numeric));
};
const DAY_MS = 24 * 60 * 60 * 1000;
const REVIEW_THRESHOLD_FRACTION = 1 / 3;
const REVIEW_WARNING_WINDOW_DAYS = 7;

function addOneUtcMonthPreservingAnchor(timestamp) {
  const current = new Date(timestamp);
  const anchor = current.getUTCDate();
  current.setUTCMonth(current.getUTCMonth() + 1);
  if (current.getUTCDate() < anchor) {
    current.setUTCDate(0);
  }
  return current.getTime();
}

function normalizeOrgPublicId(value) {
  const raw = String(value ?? "").trim();
  const match = raw.match(/^[GC]?(\d+)$/i);
  if (!match) {
    throw new HttpError(400, "Organization public ID is invalid.", "ORG_PUBLIC_ID_INVALID");
  }
  return Number(match[1]);
}

function ensureMember(organization, userInternalId) {
  const member = organization.members.find((entry) => entry.userInternalId === userInternalId);
  if (!member) {
    throw new HttpError(403, "You are not part of this organization.", "ORG_MEMBERSHIP_REQUIRED");
  }
  return member;
}

function ensurePermission(organization, member, permission) {
  const role = organization.roles.find((entry) => entry.roleKey === member.roleKey);
  if (!role || !Array.isArray(role.permissions) || !role.permissions.includes(permission)) {
    throw new HttpError(403, "You do not have permission for this action.", "ORG_PERMISSION_DENIED");
  }
}

function getLeaderMember(organization) {
  const leaderRoleKey = organization.type === "guild" ? "guildmaster" : "director";
  return (
    organization.members.find((entry) => entry.roleKey === leaderRoleKey)
    ?? organization.members[0]
    ?? null
  );
}



function isPlotOnlyBase(base) {
  const metadata = asRecord(base?.metadata);
  const construction = asRecord(metadata.construction);
  return metadata.targetType === "plot_purchase" || construction.buildingState === "plot_only";
}

async function getUserLevel(client, userInternalId) {
  const playerState = await findPlayerStateByUserInternalId(client, userInternalId);
  return Math.max(1, asInt(playerState?.level, 1));
}

function ensurePropertyOfficeLevel(level) {
  if (level < PROPERTY_OFFICE_MIN_LEVEL) {
    throw new HttpError(
      403,
      `Property Office plot contracts unlock at level ${PROPERTY_OFFICE_MIN_LEVEL}.`,
      "PROPERTY_OFFICE_LEVEL_REQUIRED",
    );
  }
}

async function getBuilderAvailability(client) {
  const playerProfiles = await listEligiblePlayerBuilders(client);
  return {
    playerProfiles,
    counts: summarizeBuilderAvailability(playerProfiles),
  };
}

function sanitizeLaborComparisonForCatalog(comparison) {
  const options = Array.isArray(comparison?.options)
    ? comparison.options.map((entry) => ({
      source: entry.source,
      sourceLabel: entry.sourceLabel,
      availableCount: asInt(entry.availableCount, 0),
      estimatedTimeHours: entry.estimatedTimeHours == null ? null : asInt(entry.estimatedTimeHours, 0),
      estimatedQualityScore: entry.estimatedQualityScore == null ? null : asInt(entry.estimatedQualityScore, 0),
      estimatedQualityTier: typeof entry.estimatedQualityTier === "string" ? entry.estimatedQualityTier : "standard",
      wageCostGold: entry.wageCostGold == null ? null : asInt(entry.wageCostGold, 0),
      professionLevel: entry.professionLevel == null ? null : asInt(entry.professionLevel, 0),
      ratingReputation: entry.ratingReputation == null ? null : asInt(entry.ratingReputation, 0),
      unavailableReason: typeof entry.unavailableReason === "string" ? entry.unavailableReason : undefined,
    }))
    : [];

  return {
    options,
    recommendedSource: typeof comparison?.recommendedSource === "string" ? comparison.recommendedSource : "npc_contractor",
  };
}

function buildMainBuildingCatalogWithLabor(mainBuildingOptions, playerProfiles) {
  return mainBuildingOptions.map((entry) => {
    const comparison = buildLaborComparisonForMainBuilding(entry, playerProfiles);
    return {
      ...entry,
      laborComparison: sanitizeLaborComparisonForCatalog(comparison),
    };
  });
}

function buildRoomCatalogWithLabor(roomOptions, playerProfiles) {
  return roomOptions.map((entry) => {
    const comparison = buildLaborComparisonForMainBuilding(entry, playerProfiles);
    return {
      ...entry,
      laborComparison: sanitizeLaborComparisonForCatalog(comparison),
    };
  });
}

function buildOwnershipShape(base, events = [], storage = [], auction = null, organizationType = null) {
  if (!base) return null;
  const plotOnly = isPlotOnlyBase(base);
  const periodDueGold = asInt(base.periodDueGold);
  const periodPaidGold = asInt(base.periodPaidGold);
  const outstandingGold = Math.max(0, periodDueGold - periodPaidGold);
  const minimumRequiredGold = plotOnly ? 0 : Math.ceil(periodDueGold * REVIEW_THRESHOLD_FRACTION);
  const shortfallToThresholdGold = plotOnly ? 0 : Math.max(0, minimumRequiredGold - periodPaidGold);
  const nowTs = Date.now();
  const msUntilReview = Math.max(0, asInt(base.nextReviewAt) - nowTs);
  const daysUntilReview = Number((msUntilReview / DAY_MS).toFixed(1));
  const isReviewWindowOpen = plotOnly ? false : msUntilReview <= (REVIEW_WARNING_WINDOW_DAYS * DAY_MS);
  const isUnderThreshold = plotOnly ? false : periodPaidGold < minimumRequiredGold;

  return {
    baseId: base.id,
    organizationInternalId: base.organizationInternalId,
    ownershipMode: base.ownershipMode,
    propertyKey: base.propertyKey,
    status: base.status,
    monthlyUpkeepGold: base.monthlyUpkeepGold,
    periodDueGold,
    periodPaidGold,
    outstandingGold,
    review: {
      minimumRequiredGold,
      shortfallToThresholdGold,
      isUnderThreshold,
      msUntilReview,
      daysUntilReview,
      warningWindowDays: REVIEW_WARNING_WINDOW_DAYS,
      isReviewWindowOpen,
    },
    reviewAnchorDayUtc: asInt(asRecord(base.metadata).reviewAnchorDayUtc, new Date(base.periodStartedAt).getUTCDate()),
    acquiredAt: asInt(asRecord(base.metadata).acquiredAt, base.createdAt),
    cityId: asRecord(base.metadata).cityId ?? null,
    displayName: asRecord(base.metadata).displayName ?? base.propertyKey,
    acquisitionCostGold: asInt(asRecord(base.metadata).acquisitionCostGold),
    periodStartedAt: base.periodStartedAt,
    nextReviewAt: base.nextReviewAt,
    buybackUntil: base.buybackUntil,
    debtGoldAtConfiscation: base.debtGoldAtConfiscation,
    leaderInternalId: base.leaderInternalId,
    passiveBenefitsActive: asRecord(base.metadata).passiveBenefitsActive !== false && base.status === "active",
    buyback: base.status === "confiscated"
      ? {
          principalDebtGold: asInt(base.debtGoldAtConfiscation),
          interestPct: 5,
          totalDueGold: Math.ceil(asInt(base.debtGoldAtConfiscation) * 1.05),
          buybackUntil: base.buybackUntil,
        }
      : null,
    auction: auction ? {
      auctionId: auction.id,
      opensAt: auction.opensAt,
      closesAt: auction.closesAt,
      openingBidGold: asInt(auction.openingBidGold),
      currentBidGold: asInt(auction.currentBidGold),
      debtGoldAtConfiscation: asInt(auction.debtGoldAtConfiscation),
      bidderOrganizationInternalId: asRecord(auction.metadata).currentBidderOrganizationInternalId ?? null,
      bidderOrganizationPublicId: asInt(asRecord(auction.metadata).currentBidderOrganizationPublicId, 0) || null,
      bidderPublicId: asInt(asRecord(auction.metadata).currentBidderPublicId, 0) || null,
    } : null,
    construction: asRecord(base.metadata).construction ?? null,
    buildingState: asRecord(asRecord(base.metadata).construction).buildingState ?? null,
    plotSize: asRecord(base.metadata).plotSize ?? asRecord(asRecord(base.metadata).construction).plotSize ?? null,
    roomCapacity: asInt(asRecord(base.metadata).roomCapacity ?? asRecord(asRecord(base.metadata).construction).roomCapacity, 0),
    roomsUsed: asInt(asRecord(asRecord(base.metadata).construction).roomsUsed, 0),
    rooms: Array.isArray(asRecord(asRecord(base.metadata).construction).rooms)
      ? asRecord(asRecord(base.metadata).construction).rooms
      : [],
    buildQuality: asRecord(base.metadata).buildQuality ?? asRecord(asRecord(asRecord(base.metadata).construction).quality).final ?? null,
    qualityModifiers: asRecord(base.metadata).qualityModifiers ?? null,
    mechanicalEffects: computeOrganizationBaseEffects(base, organizationType ?? asRecord(base.metadata).organizationTypeHint ?? "guild"),
    events,
    storage,
  };
}

function resolveAcquisitionPlan(organizationType, payload) {
  const modes = getAcquisitionModes();
  const mode = String(payload?.mode ?? "").trim();

  if (mode === modes.BUILDING_PURCHASE) {
    const buildingKey = String(payload?.buildingKey ?? "").trim();
    const building = getEligibleBuildingTarget(buildingKey);
    if (!building) {
      throw new HttpError(400, "Building is not eligible for organization base acquisition.", "ORG_BASE_BUILDING_INELIGIBLE");
    }
    if (!isValidOrganizationTypeForTarget(building, organizationType)) {
      throw new HttpError(400, "That building is not eligible for this organization type.", "ORG_BASE_TYPE_INELIGIBLE");
    }

    return {
      mode,
      propertyKey: building.key,
      displayName: building.displayName,
      cityId: building.cityId,
      monthlyUpkeepGold: asInt(building.monthlyUpkeepGold),
      acquisitionCostGold: asInt(building.acquisitionCostGold),
      metadata: {
        targetType: "building",
        buildingKey: building.key,
      },
    };
  }

  if (mode === modes.PLOT_CONSTRUCTION) {
    const plotKey = String(payload?.plotKey ?? "").trim();
    const plot = getEligiblePlotTarget(plotKey);

    if (!plot) {
      throw new HttpError(400, "Plot is not eligible for organization acquisition.", "ORG_BASE_PLOT_INELIGIBLE");
    }
    if (!isValidOrganizationTypeForTarget(plot, organizationType)) {
      throw new HttpError(400, "This plot is not eligible for this organization type.", "ORG_BASE_TYPE_INELIGIBLE");
    }

    return {
      mode,
      propertyKey: plot.key,
      displayName: plot.displayName,
      cityId: plot.cityId,
      monthlyUpkeepGold: 0,
      acquisitionCostGold: asInt(plot.plotCostGold),
      metadata: {
        targetType: "plot_purchase",
        plotKey: plot.key,
        plotDisplayName: plot.displayName,
        plotSize: String(plot.size ?? "medium"),
        roomCapacity: asInt(plot.roomCapacity, 4),
        passiveBenefitsActive: false,
        construction: {
          buildingState: "plot_only",
          plotKey: plot.key,
          plotSize: String(plot.size ?? "medium"),
          roomCapacity: asInt(plot.roomCapacity, 4),
          roomsUsed: 0,
          roomUpgradesLocked: false,
          mainBuildingKey: null,
          mainBuildingName: null,
          rooms: [],
          activeJob: null,
        },
      },
    };
  }

  throw new HttpError(400, "Acquisition mode is invalid.", "ORG_BASE_MODE_INVALID");
}

async function getCatalog(client, organizationType) {
  const builderAvailability = await getBuilderAvailability(client);
  const mainBuildingOptions = listMainBuildingV1Options(organizationType);
  const roomOptions = listRoomUpgradeV1Options(organizationType);
  const constructionEligibleTracks = getConstructionEligibleCivicTrackIds();

  return {
    modes: getAcquisitionModes(),
    eligibleBuildings: listEligibleBuildingTargets(organizationType),
    eligiblePlots: listEligiblePlotTargets(organizationType),
    mainBuildingOptions: buildMainBuildingCatalogWithLabor(mainBuildingOptions, builderAvailability.playerProfiles),
    roomOptions: buildRoomCatalogWithLabor(roomOptions, builderAvailability.playerProfiles),
    propertyOffice: {
      plotPurchaseMinLevel: PROPERTY_OFFICE_MIN_LEVEL,
      npcSellbackReturnPct: Math.round(PROPERTY_OFFICE_NPC_SELLBACK_RETURN_FRACTION * 100),
      builderAvailability: builderAvailability.counts,
      constructionEligibleTracks,
      hireVisibilityPolicy: {
        aggregateOnly: true,
        exposesRawBuilderIdentity: false,
      },
    },
  };
}

function withUpdatedTreasury(organization, nextGold) {
  const treasury = {
    ...asRecord(organization.treasury),
    gold: asInt(nextGold),
  };
  return { ...organization, treasury };
}

export async function getOrganizationBaseOwnershipForUser(user, organizationInternalId) {
  return withTransaction(async (client) => {
    const organization = await findOrganizationByInternalId(client, organizationInternalId);
    if (!organization) {
      throw new HttpError(404, "Organization record unavailable.", "ORG_NOT_FOUND");
    }

    ensureMember(organization, user.internalId);

    const base = await findOrganizationBaseByOrganizationInternalId(client, organization.internalId);
    const auction = base?.status === "auction"
      ? await findOpenAuctionByBaseId(client, base.id)
      : null;
    const events = base ? await listOrganizationBaseEvents(client, organization.internalId, 20) : [];
    const storage = base ? await listOrganizationBaseStorage(client, organization.internalId) : [];

    return {
      organizationPublicId: organization.publicId,
      organizationType: organization.type,
      catalog: await getCatalog(client, organization.type),
      base: buildOwnershipShape(base, events, storage, auction, organization.type),
    };
  });
}

export async function acquireOrganizationBaseForUser(user, organizationInternalId, payload) {
  return withTransaction(async (client) => {
    const orgLock = await client.query(
      `SELECT internal_id FROM organizations WHERE internal_id = $1 FOR UPDATE`,
      [organizationInternalId],
    );
    if (!orgLock.rows.length) {
      throw new HttpError(404, "Organization record unavailable.", "ORG_NOT_FOUND");
    }

    const organization = await findOrganizationByInternalId(client, organizationInternalId);
    if (!organization) {
      throw new HttpError(404, "Organization record unavailable.", "ORG_NOT_FOUND");
    }

    const member = ensureMember(organization, user.internalId);
    ensurePermission(organization, member, "manage_treasury");

    const existing = await findOrganizationBaseByOrganizationInternalId(client, organization.internalId);
    if (existing) {
      throw new HttpError(409, "This organization already owns a base.", "ORG_BASE_ALREADY_OWNED");
    }

    const plan = resolveAcquisitionPlan(organization.type, payload);
    if (plan.mode === getAcquisitionModes().PLOT_CONSTRUCTION) {
      const actorLevel = await getUserLevel(client, user.internalId);
      ensurePropertyOfficeLevel(actorLevel);
    }

    const treasury = asRecord(organization.treasury);
    const treasuryGold = asInt(treasury.gold);
    if (treasuryGold < plan.acquisitionCostGold) {
      throw new HttpError(
        400,
        `Treasury needs ${plan.acquisitionCostGold - treasuryGold} more gold for this acquisition.`,
        "ORG_BASE_FUNDS_REQUIRED",
      );
    }

    const acquiredAt = Date.now();
    const reviewAnchorDayUtc = new Date(acquiredAt).getUTCDate();
    const nextReviewAt = addOneUtcMonthPreservingAnchor(acquiredAt);
    const leader = getLeaderMember(organization);

    const nextGold = treasuryGold - plan.acquisitionCostGold;
    const updatedOrganization = await updateOrganizationDetails(client, organization.internalId, {
      treasury: {
        ...treasury,
        gold: nextGold,
      },
      statusText: "Base acquired",
    });

    let base;
    try {
      base = await createOrganizationBase(client, {
        organizationInternalId: organization.internalId,
        ownershipMode: plan.mode,
        propertyKey: plan.propertyKey,
        status: "active",
        monthlyUpkeepGold: plan.monthlyUpkeepGold,
        periodDueGold: plan.monthlyUpkeepGold,
        periodPaidGold: 0,
        periodStartedAt: new Date(acquiredAt),
        nextReviewAt: new Date(nextReviewAt),
        leaderInternalId: leader?.userInternalId ?? organization.founderInternalId,
        metadata: {
          ...plan.metadata,
          cityId: plan.cityId,
          displayName: plan.displayName,
          acquiredAt,
          acquisitionCostGold: plan.acquisitionCostGold,
          reviewAnchorDayUtc,
          acquiredByPublicId: user.publicId,
        },
      });
    } catch (error) {
      if (error && (error.code === "23505" || String(error.message ?? "").includes("unique"))) {
        throw new HttpError(409, "This organization already owns a base.", "ORG_BASE_ALREADY_OWNED");
      }
      throw error;
    }

    await insertOrganizationLog(client, organization.internalId, {
      actorInternalId: user.internalId,
      actorPublicId: user.publicId,
      actionType: "organization_base_acquired",
      summary: {
        mode: plan.mode,
        propertyKey: plan.propertyKey,
        cityId: plan.cityId,
        acquisitionCostGold: plan.acquisitionCostGold,
        monthlyUpkeepGold: plan.monthlyUpkeepGold,
        reviewAnchorDayUtc,
        nextReviewAt,
      },
    });

    await recordOrganizationBaseEvent(client, {
      organizationInternalId: organization.internalId,
      baseId: base.id,
      actorInternalId: user.internalId,
      eventType: "base_acquired",
      summary: {
        mode: plan.mode,
        propertyKey: plan.propertyKey,
        displayName: plan.displayName,
        cityId: plan.cityId,
        acquisitionCostGold: plan.acquisitionCostGold,
        monthlyUpkeepGold: plan.monthlyUpkeepGold,
        reviewAnchorDayUtc,
        nextReviewAt,
      },
    });

    const events = await listOrganizationBaseEvents(client, organization.internalId, 20);

    return {
      organization: withUpdatedTreasury(updatedOrganization ?? organization, nextGold),
      base: buildOwnershipShape(base, events, [], null, organization.type),
    };
  });
}


export async function sellbackOrganizationPlotForUser(user, organizationInternalId) {
  return withTransaction(async (client) => {
    const orgLock = await client.query(
      `SELECT internal_id FROM organizations WHERE internal_id = $1 FOR UPDATE`,
      [organizationInternalId],
    );
    if (!orgLock.rows.length) {
      throw new HttpError(404, "Organization record unavailable.", "ORG_NOT_FOUND");
    }

    const organization = await findOrganizationByInternalId(client, organizationInternalId);
    if (!organization) {
      throw new HttpError(404, "Organization record unavailable.", "ORG_NOT_FOUND");
    }

    const member = ensureMember(organization, user.internalId);
    ensurePermission(organization, member, "manage_treasury");

    const base = await findOrganizationBaseByOrganizationInternalId(client, organization.internalId);
    if (!base) {
      throw new HttpError(404, "No organization plot/base ownership exists.", "ORG_BASE_NOT_FOUND");
    }

    if (!isPlotOnlyBase(base)) {
      throw new HttpError(409, "Only unbuilt plots can be sold back in this phase.", "ORG_BASE_SELLBACK_NOT_PLOT_ONLY");
    }

    if (base.status !== "active") {
      throw new HttpError(409, "Only active plot ownership can be sold back.", "ORG_BASE_SELLBACK_STATUS_INVALID");
    }

    const metadata = asRecord(base.metadata);
    const acquisitionCostGold = asInt(metadata.acquisitionCostGold);
    const sellbackGold = Math.max(0, Math.floor(acquisitionCostGold * PROPERTY_OFFICE_NPC_SELLBACK_RETURN_FRACTION));

    const treasury = asRecord(organization.treasury);
    const treasuryGold = asInt(treasury.gold);
    const nextGold = treasuryGold + sellbackGold;

    const updatedOrganization = await updateOrganizationDetails(client, organization.internalId, {
      treasury: {
        ...treasury,
        gold: nextGold,
      },
      statusText: "Plot sold back to Property Office",
    });

    await insertOrganizationLog(client, organization.internalId, {
      actorInternalId: user.internalId,
      actorPublicId: user.publicId,
      actionType: "organization_plot_soldback",
      summary: {
        ownershipMode: base.ownershipMode,
        propertyKey: base.propertyKey,
        plotKey: metadata.plotKey ?? null,
        cityId: metadata.cityId ?? null,
        acquisitionCostGold,
        sellbackGold,
        npcSellbackReturnPct: Math.round(PROPERTY_OFFICE_NPC_SELLBACK_RETURN_FRACTION * 100),
      },
    });

    await recordOrganizationBaseEvent(client, {
      organizationInternalId: organization.internalId,
      baseId: base.id,
      actorInternalId: user.internalId,
      eventType: "plot_soldback_npc",
      summary: {
        propertyKey: base.propertyKey,
        plotKey: metadata.plotKey ?? null,
        cityId: metadata.cityId ?? null,
        acquisitionCostGold,
        sellbackGold,
        npcSellbackReturnPct: Math.round(PROPERTY_OFFICE_NPC_SELLBACK_RETURN_FRACTION * 100),
      },
    });

    await deleteOrganizationBaseById(client, base.id);

    return {
      organization: withUpdatedTreasury(updatedOrganization ?? organization, nextGold),
      sellback: {
        soldTo: "npc_property_office",
        propertyKey: base.propertyKey,
        acquisitionCostGold,
        sellbackGold,
        npcSellbackReturnPct: Math.round(PROPERTY_OFFICE_NPC_SELLBACK_RETURN_FRACTION * 100),
      },
      base: null,
    };
  });
}


export function getMainBuildingPlanForOrgType(organizationType, buildingKey) {
  return getMainBuildingV1Option(organizationType, buildingKey);
}

export async function getOrganizationBaseOwnershipByPublicIdForAdmin(organizationPublicId) {
  return withTransaction(async (client) => {
    const numericPublicId = normalizeOrgPublicId(organizationPublicId);
    const organization = await findOrganizationByPublicId(client, numericPublicId);
    if (!organization) {
      throw new HttpError(404, "Organization record unavailable.", "ORG_NOT_FOUND");
    }

    const base = await findOrganizationBaseByOrganizationInternalId(client, organization.internalId);
    const events = base ? await listOrganizationBaseEvents(client, organization.internalId, 50) : [];
    const storage = base ? await listOrganizationBaseStorage(client, organization.internalId) : [];

    return {
      organization: {
        internalId: organization.internalId,
        publicId: organization.publicId,
        type: organization.type,
        name: organization.name,
      },
      base: buildOwnershipShape(base, events, storage, null, organization.type),
      catalog: await getCatalog(client, organization.type),
    };
  });
}
