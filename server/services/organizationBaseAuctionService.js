import { withTransaction } from "../db/pool.js";
import { HttpError } from "../lib/errors.js";
import {
  createOrganizationBaseAuction,
  findOrganizationBaseAuctionByIdForUpdate,
  findOrganizationBaseByIdForUpdate,
  findOrganizationBaseByOrganizationInternalId,
  findOpenAuctionByBaseId,
  listClosableOrganizationBaseAuctions,
  listExpiredOrganizationBaseBuybacks,
  listOpenOrganizationBaseAuctions,
  markOrganizationBaseAuctionState,
  recordOrganizationBaseEvent,
  transferOrganizationBaseOwnership,
  updateOrganizationBaseAuctionBid,
  updateOrganizationBaseFinancials,
} from "../repositories/organizationBaseRepository.js";
import {
  findOrganizationByInternalId,
  insertOrganizationLog,
  updateOrganizationDetails,
} from "../repositories/organizationRepository.js";

const DAY_MS = 24 * 60 * 60 * 1000;
const AUCTION_DURATION_DAYS = 3;
const AUCTION_EXTENSION_HOURS_NO_BIDS = 24;

const asInt = (value, fallback = 0) => {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return fallback;
  return Math.max(0, Math.floor(numeric));
};

const asRecord = (value) => (value && typeof value === "object" && !Array.isArray(value) ? value : {});

function getOrgGold(organization) {
  return asInt(asRecord(organization?.treasury).gold);
}

function getReviewAnchorDay(base) {
  const metadata = asRecord(base.metadata);
  const anchor = asInt(metadata.reviewAnchorDayUtc, 0);
  if (anchor >= 1 && anchor <= 31) return anchor;
  return new Date(base.periodStartedAt).getUTCDate();
}

function computeNextReviewFromNow(nowTs, reviewAnchorDayUtc) {
  const now = new Date(nowTs);
  const year = now.getUTCFullYear();
  const month = now.getUTCMonth();
  const hours = now.getUTCHours();
  const minutes = now.getUTCMinutes();
  const seconds = now.getUTCSeconds();
  const millis = now.getUTCMilliseconds();

  const daysThisMonth = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
  const currentMonthDay = Math.min(Math.max(1, reviewAnchorDayUtc), daysThisMonth);
  const currentCandidate = Date.UTC(year, month, currentMonthDay, hours, minutes, seconds, millis);
  if (currentCandidate > nowTs) {
    return currentCandidate;
  }

  const nextMonthIndex = month + 1;
  const nextYear = year + Math.floor(nextMonthIndex / 12);
  const targetMonth = nextMonthIndex % 12;
  const daysInTargetMonth = new Date(Date.UTC(nextYear, targetMonth + 1, 0)).getUTCDate();
  const day = Math.min(Math.max(1, reviewAnchorDayUtc), daysInTargetMonth);
  return Date.UTC(nextYear, targetMonth, day, hours, minutes, seconds, millis);
}

function getLeaderInternalId(organization) {
  const leaderRoleKey = organization.type === "guild" ? "guildmaster" : "director";
  return (
    organization.members.find((entry) => entry.roleKey === leaderRoleKey)?.userInternalId
    ?? organization.founderInternalId
    ?? null
  );
}

function ensureMemberAndPermission(organization, userInternalId, permission) {
  const member = organization.members.find((entry) => entry.userInternalId === userInternalId);
  if (!member) {
    throw new HttpError(403, "You are not part of this organization.", "ORG_MEMBERSHIP_REQUIRED");
  }

  const role = organization.roles.find((entry) => entry.roleKey === member.roleKey);
  if (!role || !Array.isArray(role.permissions) || !role.permissions.includes(permission)) {
    throw new HttpError(403, "Treasury authority required for auction bidding.", "ORG_AUCTION_PERMISSION_REQUIRED");
  }

  return member;
}

async function lockOrganizationRow(client, organizationInternalId) {
  const lock = await client.query(
    "SELECT internal_id FROM organizations WHERE internal_id = $1 FOR UPDATE",
    [organizationInternalId],
  );
  if (!lock.rows.length) {
    throw new HttpError(404, "Organization record unavailable.", "ORG_NOT_FOUND");
  }
}

async function setOrgGold(client, organization, nextGold) {
  return updateOrganizationDetails(client, organization.internalId, {
    treasury: {
      ...asRecord(organization.treasury),
      gold: asInt(nextGold),
    },
  });
}

function getOpeningBidFromBase(base) {
  const debt = asInt(base.debtGoldAtConfiscation);
  if (debt > 0) return debt;
  const outstanding = Math.max(0, asInt(base.periodDueGold) - asInt(base.periodPaidGold));
  return Math.max(1, outstanding);
}

function getAuctionBidderOrgInternalId(auction) {
  return String(asRecord(auction.metadata).currentBidderOrganizationInternalId ?? "").trim() || null;
}

function getAuctionBidderPublicId(auction) {
  const raw = asRecord(auction.metadata).currentBidderPublicId;
  if (raw == null) return null;
  const numeric = Number(raw);
  return Number.isFinite(numeric) ? numeric : null;
}

async function openAuctionForExpiredBase(client, base, nowTs, actorInternalId = null) {
  if (base.status !== "confiscated") return null;
  if (!base.buybackUntil || base.buybackUntil > nowTs) return null;

  const existingOpenAuction = await findOpenAuctionByBaseId(client, base.id);
  if (existingOpenAuction) {
    if (base.status !== "auction") {
      const metadata = {
        ...asRecord(base.metadata),
        statusNote: "auction_open",
        buybackClosedAt: nowTs,
      };
      await updateOrganizationBaseFinancials(client, base.id, {
        periodDueGold: asInt(base.periodDueGold),
        periodPaidGold: asInt(base.periodPaidGold),
        periodStartedAt: new Date(base.periodStartedAt),
        nextReviewAt: new Date(base.nextReviewAt),
        status: "auction",
        confiscatedAt: base.confiscatedAt ? new Date(base.confiscatedAt) : null,
        buybackUntil: null,
        debtGoldAtConfiscation: asInt(base.debtGoldAtConfiscation),
        leaderInternalId: base.leaderInternalId,
        metadata,
      });
    }
    return null;
  }

  const openingBidGold = getOpeningBidFromBase(base);
  const closesAt = nowTs + AUCTION_DURATION_DAYS * DAY_MS;

  const baseMetadata = {
    ...asRecord(base.metadata),
    statusNote: "auction_open",
    buybackClosedAt: nowTs,
    buybackClosedReason: "window_expired",
    auctionOpenedAt: nowTs,
    auctionClosesAt: closesAt,
    auctionOpeningBidGold: openingBidGold,
    passiveBenefitsActive: false,
  };

  await updateOrganizationBaseFinancials(client, base.id, {
    periodDueGold: asInt(base.periodDueGold),
    periodPaidGold: asInt(base.periodPaidGold),
    periodStartedAt: new Date(base.periodStartedAt),
    nextReviewAt: new Date(base.nextReviewAt),
    status: "auction",
    confiscatedAt: base.confiscatedAt ? new Date(base.confiscatedAt) : null,
    buybackUntil: null,
    debtGoldAtConfiscation: asInt(base.debtGoldAtConfiscation),
    leaderInternalId: base.leaderInternalId,
    metadata: baseMetadata,
  });

  const auction = await createOrganizationBaseAuction(client, {
    baseId: base.id,
    organizationInternalId: base.organizationInternalId,
    opensAt: new Date(nowTs),
    closesAt: new Date(closesAt),
    openingBidGold,
    currentBidGold: openingBidGold,
    currentBidderInternalId: null,
    debtGoldAtConfiscation: asInt(base.debtGoldAtConfiscation),
    metadata: {
      openedFromConfiscationAt: nowTs,
      originatingOrganizationInternalId: base.organizationInternalId,
      buybackExpiredAt: base.buybackUntil,
    },
  });

  await recordOrganizationBaseEvent(client, {
    organizationInternalId: base.organizationInternalId,
    baseId: base.id,
    actorInternalId,
    eventType: "base_auction_opened",
    summary: {
      auctionId: auction.id,
      openingBidGold,
      opensAt: auction.opensAt,
      closesAt: auction.closesAt,
      buybackExpiredAt: base.buybackUntil,
    },
  });

  await insertOrganizationLog(client, base.organizationInternalId, {
    actorInternalId: actorInternalId ?? null,
    actorPublicId: null,
    actionType: "organization_base_auction_opened",
    summary: {
      auctionId: auction.id,
      openingBidGold,
      closesAt: auction.closesAt,
      buybackExpiredAt: base.buybackUntil,
    },
  });

  return {
    baseId: base.id,
    organizationInternalId: base.organizationInternalId,
    auctionId: auction.id,
    openingBidGold,
    closesAt: auction.closesAt,
  };
}

async function settleClosedAuction(client, auction, nowTs, actorInternalId = null) {
  const lockedAuction = await findOrganizationBaseAuctionByIdForUpdate(client, auction.id);
  if (!lockedAuction || lockedAuction.status !== "open") return null;
  if (lockedAuction.closesAt > nowTs) return null;

  const base = await findOrganizationBaseByIdForUpdate(client, lockedAuction.baseId);
  if (!base) {
    await markOrganizationBaseAuctionState(client, lockedAuction.id, "cancelled", {
      ...asRecord(lockedAuction.metadata),
      cancelledAt: nowTs,
      cancellationReason: "base_missing",
    });
    return { auctionId: lockedAuction.id, outcome: "cancelled_base_missing" };
  }

  const bidderOrganizationInternalId = getAuctionBidderOrgInternalId(lockedAuction);
  if (!bidderOrganizationInternalId) {
    const nextClose = nowTs + AUCTION_EXTENSION_HOURS_NO_BIDS * 60 * 60 * 1000;
    const metadata = asRecord(lockedAuction.metadata);
    await updateOrganizationBaseAuctionBid(client, lockedAuction.id, {
      closesAt: new Date(nextClose),
      metadata: {
        ...metadata,
        noBidExtensions: asInt(metadata.noBidExtensions) + 1,
        lastNoBidExtensionAt: nowTs,
        nextClose,
      },
    });

    await recordOrganizationBaseEvent(client, {
      organizationInternalId: base.organizationInternalId,
      baseId: base.id,
      actorInternalId,
      eventType: "base_auction_extended_no_bids",
      summary: {
        auctionId: lockedAuction.id,
        nextClose,
      },
    });

    return {
      auctionId: lockedAuction.id,
      outcome: "extended_no_bids",
      nextClose,
    };
  }

  await lockOrganizationRow(client, bidderOrganizationInternalId);
  const winnerOrganization = await findOrganizationByInternalId(client, bidderOrganizationInternalId);
  if (!winnerOrganization) {
    await markOrganizationBaseAuctionState(client, lockedAuction.id, "cancelled", {
      ...asRecord(lockedAuction.metadata),
      cancelledAt: nowTs,
      cancellationReason: "winner_org_missing",
    });
    return { auctionId: lockedAuction.id, outcome: "cancelled_winner_missing" };
  }

  const winnerExistingBase = await findOrganizationBaseByOrganizationInternalId(client, winnerOrganization.internalId);
  if (winnerExistingBase) {
    await markOrganizationBaseAuctionState(client, lockedAuction.id, "cancelled", {
      ...asRecord(lockedAuction.metadata),
      cancelledAt: nowTs,
      cancellationReason: "winner_org_already_has_base",
      winnerOrganizationInternalId: winnerOrganization.internalId,
    });

    await recordOrganizationBaseEvent(client, {
      organizationInternalId: base.organizationInternalId,
      baseId: base.id,
      actorInternalId,
      eventType: "base_auction_cancelled_winner_ineligible",
      summary: {
        auctionId: lockedAuction.id,
        winnerOrganizationInternalId: winnerOrganization.internalId,
      },
    });

    return { auctionId: lockedAuction.id, outcome: "cancelled_winner_ineligible" };
  }

  const reviewAnchorDayUtc = new Date(nowTs).getUTCDate() || getReviewAnchorDay(base);
  const nextReviewAt = computeNextReviewFromNow(nowTs, reviewAnchorDayUtc);
  const leaderInternalId = getLeaderInternalId(winnerOrganization);

  const transferred = await transferOrganizationBaseOwnership(
    client,
    base.id,
    winnerOrganization.internalId,
    {
      status: "active",
      periodDueGold: asInt(base.monthlyUpkeepGold),
      periodPaidGold: 0,
      periodStartedAt: new Date(nowTs),
      nextReviewAt: new Date(nextReviewAt),
      confiscatedAt: null,
      buybackUntil: null,
      debtGoldAtConfiscation: null,
      leaderInternalId,
      metadata: {
        ...asRecord(base.metadata),
        passiveBenefitsActive: true,
        reviewAnchorDayUtc,
        acquiredAt: nowTs,
        acquisitionCostGold: asInt(lockedAuction.currentBidGold),
        acquiredByAuction: true,
        auctionWonAt: nowTs,
        auctionId: lockedAuction.id,
        previousOrganizationInternalId: base.organizationInternalId,
        acquiredByBidderOrganizationInternalId: winnerOrganization.internalId,
      },
    },
  );

  await markOrganizationBaseAuctionState(client, lockedAuction.id, "settled", {
    ...asRecord(lockedAuction.metadata),
    settledAt: nowTs,
    winnerOrganizationInternalId: winnerOrganization.internalId,
    winnerOrganizationPublicId: winnerOrganization.publicId,
    winnerBidderInternalId: lockedAuction.currentBidderInternalId,
    winnerBidderPublicId: getAuctionBidderPublicId(lockedAuction),
    winningBidGold: asInt(lockedAuction.currentBidGold),
    baseTransferredToOrganizationInternalId: winnerOrganization.internalId,
  });

  await recordOrganizationBaseEvent(client, {
    organizationInternalId: base.organizationInternalId,
    baseId: base.id,
    actorInternalId,
    eventType: "base_auction_settled_transferred",
    summary: {
      auctionId: lockedAuction.id,
      previousOrganizationInternalId: base.organizationInternalId,
      winnerOrganizationInternalId: winnerOrganization.internalId,
      winnerOrganizationPublicId: winnerOrganization.publicId,
      winningBidGold: asInt(lockedAuction.currentBidGold),
      settledAt: nowTs,
    },
  });

  await insertOrganizationLog(client, base.organizationInternalId, {
    actorInternalId: actorInternalId ?? null,
    actorPublicId: null,
    actionType: "organization_base_auction_settled_outgoing",
    summary: {
      auctionId: lockedAuction.id,
      winnerOrganizationInternalId: winnerOrganization.internalId,
      winnerOrganizationPublicId: winnerOrganization.publicId,
      winningBidGold: asInt(lockedAuction.currentBidGold),
      settledAt: nowTs,
    },
  });

  await insertOrganizationLog(client, winnerOrganization.internalId, {
    actorInternalId: lockedAuction.currentBidderInternalId,
    actorPublicId: getAuctionBidderPublicId(lockedAuction),
    actionType: "organization_base_auction_settled_incoming",
    summary: {
      auctionId: lockedAuction.id,
      previousOrganizationInternalId: base.organizationInternalId,
      winningBidGold: asInt(lockedAuction.currentBidGold),
      settledAt: nowTs,
      nextReviewAt,
    },
  });

  return {
    auctionId: lockedAuction.id,
    baseId: base.id,
    previousOrganizationInternalId: base.organizationInternalId,
    winnerOrganizationInternalId: winnerOrganization.internalId,
    winnerOrganizationPublicId: winnerOrganization.publicId,
    winningBidGold: asInt(lockedAuction.currentBidGold),
    transferredBaseId: transferred.id,
    outcome: "settled",
  };
}

export async function runOrganizationBaseAuctionLifecycleSweep({ nowTs, actorInternalId = null, client }) {
  const normalizedNow = Number.isFinite(Number(nowTs)) ? Math.floor(Number(nowTs)) : Date.now();

  const expiredBuybacks = await listExpiredOrganizationBaseBuybacks(client, new Date(normalizedNow));
  const openedAuctions = [];

  for (const baseRow of expiredBuybacks) {
    const lockedBase = await findOrganizationBaseByIdForUpdate(client, baseRow.id);
    if (!lockedBase) continue;
    const opened = await openAuctionForExpiredBase(client, lockedBase, normalizedNow, actorInternalId);
    if (opened) openedAuctions.push(opened);
  }

  const closableAuctions = await listClosableOrganizationBaseAuctions(client, new Date(normalizedNow));
  const settledAuctions = [];
  for (const auction of closableAuctions) {
    const settled = await settleClosedAuction(client, auction, normalizedNow, actorInternalId);
    if (settled) settledAuctions.push(settled);
  }

  return {
    now: normalizedNow,
    expiredBuybackCount: expiredBuybacks.length,
    openedAuctionCount: openedAuctions.length,
    closableAuctionCount: closableAuctions.length,
    settledAuctionCount: settledAuctions.filter((entry) => entry.outcome === "settled").length,
    openedAuctions,
    settledAuctions,
  };
}

export async function listOrganizationBaseAuctionsForUser(user, { organizationType = null } = {}) {
  return withTransaction(async (client) => {
    const auctions = await listOpenOrganizationBaseAuctions(client, {
      organizationType: organizationType ? String(organizationType).trim().toLowerCase() : undefined,
    });

    return {
      auctions: auctions.map((entry) => ({
        ...entry,
        bidderOrganizationInternalId: getAuctionBidderOrgInternalId(entry),
      })),
    };
  });
}

export async function placeOrganizationBaseAuctionBidForUser(user, bidderOrganizationInternalId, auctionId, payload = {}) {
  return withTransaction(async (client) => {
    const orgInternalId = String(bidderOrganizationInternalId ?? "").trim();
    if (!orgInternalId) {
      throw new HttpError(400, "Bidder organization ID is required.", "ORG_AUCTION_BID_ORG_REQUIRED");
    }

    await lockOrganizationRow(client, orgInternalId);
    const bidderOrganization = await findOrganizationByInternalId(client, orgInternalId);
    if (!bidderOrganization) {
      throw new HttpError(404, "Bidder organization not found.", "ORG_AUCTION_BID_ORG_NOT_FOUND");
    }

    ensureMemberAndPermission(bidderOrganization, user.internalId, "manage_treasury");

    const existingBase = await findOrganizationBaseByOrganizationInternalId(client, bidderOrganization.internalId);
    if (existingBase) {
      throw new HttpError(409, "Organizations that already own a base cannot bid in base auctions.", "ORG_AUCTION_BIDDER_ALREADY_HAS_BASE");
    }

    const auctionInternalId = asInt(auctionId);
    if (auctionInternalId <= 0) {
      throw new HttpError(400, "Auction ID is invalid.", "ORG_AUCTION_ID_INVALID");
    }

    const auction = await findOrganizationBaseAuctionByIdForUpdate(client, auctionInternalId);
    if (!auction) {
      throw new HttpError(404, "Auction not found.", "ORG_AUCTION_NOT_FOUND");
    }
    if (auction.status !== "open") {
      throw new HttpError(409, "Auction is not open for bidding.", "ORG_AUCTION_NOT_OPEN");
    }

    const nowTs = Date.now();
    if (auction.opensAt > nowTs) {
      throw new HttpError(409, "Auction has not opened yet.", "ORG_AUCTION_NOT_OPEN_YET");
    }
    if (auction.closesAt <= nowTs) {
      throw new HttpError(409, "Auction is closing; please refresh and try again.", "ORG_AUCTION_CLOSING");
    }

    const base = await findOrganizationBaseByIdForUpdate(client, auction.baseId);
    if (!base) {
      throw new HttpError(404, "Auctioned base record unavailable.", "ORG_AUCTION_BASE_NOT_FOUND");
    }
    if (base.status !== "auction") {
      throw new HttpError(409, "Auction is no longer attached to an active auction base state.", "ORG_AUCTION_BASE_NOT_IN_AUCTION");
    }

    if (auction.organizationInternalId === bidderOrganization.internalId) {
      throw new HttpError(403, "Original owner organization cannot reclaim via auction bids.", "ORG_AUCTION_RECLAIM_NOT_ALLOWED");
    }

    const sellerOrganization = await findOrganizationByInternalId(client, auction.organizationInternalId);
    if (!sellerOrganization) {
      throw new HttpError(409, "Auction seller organization is unavailable.", "ORG_AUCTION_SELLER_MISSING");
    }
    if (sellerOrganization.type !== bidderOrganization.type) {
      throw new HttpError(409, "Only organizations of the same type can bid on this auction.", "ORG_AUCTION_ORG_TYPE_MISMATCH");
    }

    const requestedBid = asInt(payload.bidGold);
    const hasBidder = Boolean(auction.currentBidderInternalId);
    const minBid = hasBidder
      ? asInt(auction.currentBidGold) + 1
      : Math.max(asInt(auction.openingBidGold), asInt(auction.currentBidGold));

    if (requestedBid < minBid) {
      throw new HttpError(400, `Bid must be at least ${minBid} gold.`, "ORG_AUCTION_BID_TOO_LOW");
    }

    const previousBidderOrgInternalId = getAuctionBidderOrgInternalId(auction);
    const previousBid = asInt(auction.currentBidGold);

    const bidderGoldBefore = getOrgGold(bidderOrganization);
    if (bidderGoldBefore < requestedBid) {
      throw new HttpError(400, `Treasury needs ${requestedBid - bidderGoldBefore} more gold for this bid.`, "ORG_AUCTION_BID_FUNDS_REQUIRED");
    }

    const bidderAfterSpend = await setOrgGold(client, bidderOrganization, bidderGoldBefore - requestedBid);

    let refundedOrganization = null;
    if (previousBidderOrgInternalId) {
      await lockOrganizationRow(client, previousBidderOrgInternalId);
      const previousBidderOrganization = await findOrganizationByInternalId(client, previousBidderOrgInternalId);
      if (previousBidderOrganization) {
        const previousGold = getOrgGold(previousBidderOrganization);
        refundedOrganization = await setOrgGold(client, previousBidderOrganization, previousGold + previousBid);

        await insertOrganizationLog(client, previousBidderOrganization.internalId, {
          actorInternalId: user.internalId,
          actorPublicId: user.publicId,
          actionType: "organization_base_auction_bid_refunded",
          summary: {
            auctionId: auction.id,
            refundedGold: previousBid,
            replacedByOrganizationInternalId: bidderOrganization.internalId,
            replacedByOrganizationPublicId: bidderAfterSpend?.publicId ?? bidderOrganization.publicId,
          },
        });
      }
    }

    const nextAuction = await updateOrganizationBaseAuctionBid(client, auction.id, {
      currentBidGold: requestedBid,
      currentBidderInternalId: user.internalId,
      metadata: {
        ...asRecord(auction.metadata),
        currentBidderOrganizationInternalId: bidderOrganization.internalId,
        currentBidderOrganizationPublicId: bidderOrganization.publicId,
        currentBidderPublicId: user.publicId,
        lastBidAt: nowTs,
      },
    });

    await recordOrganizationBaseEvent(client, {
      organizationInternalId: base.organizationInternalId,
      baseId: base.id,
      actorInternalId: user.internalId,
      eventType: "base_auction_bid_placed",
      summary: {
        auctionId: auction.id,
        bidderOrganizationInternalId: bidderOrganization.internalId,
        bidderOrganizationPublicId: bidderOrganization.publicId,
        bidderUserPublicId: user.publicId,
        bidGold: requestedBid,
        previousBidGold: previousBid,
        previousBidderOrganizationInternalId: previousBidderOrgInternalId,
      },
    });

    await insertOrganizationLog(client, bidderOrganization.internalId, {
      actorInternalId: user.internalId,
      actorPublicId: user.publicId,
      actionType: "organization_base_auction_bid_placed",
      summary: {
        auctionId: auction.id,
        bidGold: requestedBid,
        previousBidGold: previousBid,
      },
    });

    return {
      auction: {
        ...nextAuction,
        bidderOrganizationInternalId: bidderOrganization.internalId,
      },
      bidderTreasury: {
        gold: getOrgGold(bidderAfterSpend ?? bidderOrganization),
      },
      refund: previousBidderOrgInternalId
        ? {
            organizationInternalId: previousBidderOrgInternalId,
            amountGold: previousBid,
            applied: Boolean(refundedOrganization),
          }
        : null,
    };
  });
}
