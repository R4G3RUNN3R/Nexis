import { withTransaction } from "../db/pool.js";
import { buildMutableRuntimeState } from "../lib/runtimePlayerState.js";
import {
  createDefaultPlayerState,
  findPlayerStateByUserInternalId,
  upsertPlayerRuntimeState,
} from "../repositories/playerStateRepository.js";
import {
  clearOrganizationBaseStorage,
  findOrganizationBaseByOrganizationInternalId,
  findOrganizationBaseByOrganizationInternalIdForUpdate,
  listActiveOrganizationBases,
  listOrganizationBaseStorage,
  recordOrganizationBaseEvent,
  recordOrganizationBasePayment,
  updateOrganizationBaseFinancials,
} from "../repositories/organizationBaseRepository.js";
import {
  findOrganizationByInternalId,
  insertOrganizationLog,
  updateOrganizationDetails,
} from "../repositories/organizationRepository.js";
import { findUserByInternalId } from "../repositories/usersRepository.js";
import { HttpError } from "../lib/errors.js";
import { runOrganizationBaseAuctionLifecycleSweep } from "./organizationBaseAuctionService.js";
import { runOrganizationMainBuildCompletionSweep } from "./organizationBaseConstructionService.js";
import { runStaleBuilderReservationSweep } from "./organizationBaseLaborService.js";
import { runOrganizationRoomBuildCompletionSweep } from "./organizationBaseRoomService.js";

const DAY_MS = 24 * 60 * 60 * 1000;
const REVIEW_MIN_SHARE = 1 / 3;
const BUYBACK_WINDOW_DAYS = 7;
const BUYBACK_INTEREST_PCT = 5;

const asInt = (value, fallback = 0) => {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return fallback;
  return Math.max(0, Math.floor(numeric));
};

const asRecord = (value) => (value && typeof value === "object" && !Array.isArray(value) ? value : {});

function startOfUtcDay(timestamp) {
  const date = new Date(timestamp);
  return Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate());
}

function elapsedUtcDays(fromTs, toTs) {
  if (toTs <= fromTs) return 0;
  const fromDay = startOfUtcDay(fromTs);
  const toDay = startOfUtcDay(toTs);
  const diff = Math.floor((toDay - fromDay) / DAY_MS);
  return Math.max(0, diff);
}

function addCalendarDaysUtc(timestamp, days) {
  const date = new Date(timestamp);
  date.setUTCDate(date.getUTCDate() + days);
  return date.getTime();
}

function getReviewAnchorDay(base) {
  const metadata = asRecord(base.metadata);
  const anchor = asInt(metadata.reviewAnchorDayUtc, 0);
  if (anchor >= 1 && anchor <= 31) return anchor;
  return new Date(base.periodStartedAt).getUTCDate();
}

function computeNextReviewFromAnchor(currentReviewTs, reviewAnchorDayUtc) {
  const current = new Date(currentReviewTs);
  const nextMonthIndex = current.getUTCMonth() + 1;
  const nextYear = current.getUTCFullYear() + Math.floor(nextMonthIndex / 12);
  const targetMonth = nextMonthIndex % 12;

  const daysInTargetMonth = new Date(Date.UTC(nextYear, targetMonth + 1, 0)).getUTCDate();
  const day = Math.min(Math.max(1, reviewAnchorDayUtc), daysInTargetMonth);

  return Date.UTC(
    nextYear,
    targetMonth,
    day,
    current.getUTCHours(),
    current.getUTCMinutes(),
    current.getUTCSeconds(),
    current.getUTCMilliseconds(),
  );
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

  return computeNextReviewFromAnchor(currentCandidate, reviewAnchorDayUtc);
}

function getDailyUpkeepGold(base) {
  const metadata = asRecord(base.metadata);
  const configured = asInt(metadata.dailyUpkeepGold, 0);
  if (configured > 0) return configured;
  const monthly = asInt(base.monthlyUpkeepGold, 0);
  if (monthly <= 0) return 0;
  return Math.max(1, Math.ceil(monthly / 30));
}

function getOrgGold(organization) {
  return asInt(asRecord(organization?.treasury).gold);
}

function getOutstandingGold(base) {
  return Math.max(0, asInt(base.periodDueGold) - asInt(base.periodPaidGold));
}

function getBuybackDebt(base) {
  const debt = asInt(base.debtGoldAtConfiscation);
  if (debt > 0) return debt;
  return getOutstandingGold(base);
}

function getBuybackTotalGold(base) {
  const debt = getBuybackDebt(base);
  return Math.ceil(debt * (1 + BUYBACK_INTEREST_PCT / 100));
}

function isPassiveBenefitsActive(base) {
  const metadata = asRecord(base.metadata);
  if (base.status !== "active") return false;
  return metadata.passiveBenefitsActive !== false;
}

async function lockOrganizationRowForUpdate(client, organizationInternalId) {
  const lock = await client.query(
    "SELECT internal_id FROM organizations WHERE internal_id = $1 FOR UPDATE",
    [organizationInternalId],
  );
  if (!lock.rows.length) {
    throw new HttpError(404, "Organization record unavailable.", "ORG_NOT_FOUND");
  }
}

async function loadLockedOrganization(client, organizationInternalId) {
  await lockOrganizationRowForUpdate(client, organizationInternalId);
  const organization = await findOrganizationByInternalId(client, organizationInternalId);
  if (!organization) {
    throw new HttpError(404, "Organization record unavailable.", "ORG_NOT_FOUND");
  }
  return organization;
}

async function setOrgGold(client, organization, nextGold) {
  return updateOrganizationDetails(client, organization.internalId, {
    treasury: {
      ...asRecord(organization.treasury),
      gold: asInt(nextGold),
    },
  });
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

function getLeaderInternalIdForConfiscation(base, organization) {
  const leaderByRole = organization.type === "guild"
    ? organization.members.find((entry) => entry.roleKey === "guildmaster")
    : organization.members.find((entry) => entry.roleKey === "director");

  return leaderByRole?.userInternalId
    ?? base.leaderInternalId
    ?? organization.founderInternalId
    ?? null;
}

async function moveStoredItemsToLeaderInventory(client, organizationInternalId, leaderInternalId) {
  const storage = await listOrganizationBaseStorage(client, organizationInternalId);
  if (!storage.length || !leaderInternalId) {
    return { movedItems: [], targetLeaderInternalId: leaderInternalId ?? null };
  }

  const leaderUser = await findUserByInternalId(client, leaderInternalId);
  if (!leaderUser) {
    return { movedItems: [], targetLeaderInternalId: leaderInternalId };
  }

  await createDefaultPlayerState(client, leaderUser.internalId);
  const leaderState = await findPlayerStateByUserInternalId(client, leaderUser.internalId);
  if (!leaderState) {
    return { movedItems: [], targetLeaderInternalId: leaderUser.internalId };
  }

  const runtime = buildMutableRuntimeState(leaderUser, leaderState);
  const nextInventory = { ...asRecord(runtime.player.inventory) };
  const movedItems = [];

  for (const entry of storage) {
    const quantity = asInt(entry.quantity);
    if (quantity <= 0) continue;
    nextInventory[entry.itemId] = asInt(nextInventory[entry.itemId]) + quantity;
    movedItems.push({ itemId: entry.itemId, quantity });
  }

  runtime.player.inventory = nextInventory;
  await upsertPlayerRuntimeState(client, leaderUser.internalId, runtime);
  await clearOrganizationBaseStorage(client, organizationInternalId);

  return {
    movedItems,
    targetLeaderInternalId: leaderUser.internalId,
  };
}

async function accrueBaseUpkeep(client, base, nowTs, actorInternalId = null) {
  if (base.status !== "active") {
    return { base, accruedGold: 0, accruedDays: 0, dailyUpkeepGold: getDailyUpkeepGold(base) };
  }

  const metadata = asRecord(base.metadata);
  const dailyUpkeepGold = getDailyUpkeepGold(base);
  const lastAccruedAt = asInt(metadata.lastAccruedAt, asInt(base.periodStartedAt));
  const accruedDays = elapsedUtcDays(lastAccruedAt, nowTs);

  if (accruedDays <= 0) {
    return { base, accruedGold: 0, accruedDays: 0, dailyUpkeepGold };
  }

  const accruedGold = accruedDays * dailyUpkeepGold;
  const nextDue = asInt(base.periodDueGold) + accruedGold;

  const updated = await updateOrganizationBaseFinancials(
    client,
    base.id,
    buildBasePatch(base, {
      periodDueGold: nextDue,
      metadata: {
        ...metadata,
        dailyUpkeepGold,
        lastAccruedAt: nowTs,
        accruedDaysInPeriod: asInt(metadata.accruedDaysInPeriod) + accruedDays,
      },
    }),
  );

  await recordOrganizationBaseEvent(client, {
    organizationInternalId: base.organizationInternalId,
    baseId: base.id,
    actorInternalId,
    eventType: "base_upkeep_accrued",
    summary: {
      accruedDays,
      dailyUpkeepGold,
      accruedGold,
      dueGoldAfter: nextDue,
      lastAccruedAt: nowTs,
    },
  });

  return { base: updated, accruedGold, accruedDays, dailyUpkeepGold };
}

async function settleDueReview(client, base, organization, nowTs, actorInternalId = null) {
  const reviewAnchorDayUtc = getReviewAnchorDay(base);
  const dueGold = asInt(base.periodDueGold);
  const alreadyPaid = asInt(base.periodPaidGold);
  const minRequired = Math.ceil(dueGold * REVIEW_MIN_SHARE);
  const outstanding = Math.max(0, dueGold - alreadyPaid);

  let updatedOrganization = organization;
  let autoPay = 0;

  if (outstanding > 0) {
    const currentGold = getOrgGold(updatedOrganization);
    autoPay = Math.min(outstanding, currentGold);
    if (autoPay > 0) {
      updatedOrganization = await setOrgGold(client, updatedOrganization, currentGold - autoPay);
      await recordOrganizationBasePayment(client, {
        baseId: base.id,
        organizationInternalId: base.organizationInternalId,
        source: "vault_autopay",
        amountGold: autoPay,
        summary: {
          reason: "monthly_review_autopay",
          dueGold,
          paidBefore: alreadyPaid,
          minRequired,
        },
      });
    }
  }

  const paidAfter = alreadyPaid + autoPay;
  if (paidAfter >= minRequired) {
    const nextReviewAt = computeNextReviewFromAnchor(base.nextReviewAt, reviewAnchorDayUtc);
    const rolled = await updateOrganizationBaseFinancials(
      client,
      base.id,
      buildBasePatch(base, {
        periodDueGold: 0,
        periodPaidGold: 0,
        periodStartedAt: new Date(nowTs),
        nextReviewAt: new Date(nextReviewAt),
        status: "active",
        confiscatedAt: null,
        buybackUntil: null,
        debtGoldAtConfiscation: null,
        metadata: {
          ...asRecord(base.metadata),
          reviewAnchorDayUtc,
          passiveBenefitsActive: true,
          dailyUpkeepGold: getDailyUpkeepGold(base),
          lastAccruedAt: nowTs,
          accruedDaysInPeriod: 0,
          lastReviewAt: nowTs,
          lastReviewResult: "passed",
          buyback: null,
        },
      }),
    );

    await recordOrganizationBaseEvent(client, {
      organizationInternalId: base.organizationInternalId,
      baseId: base.id,
      actorInternalId,
      eventType: "base_review_passed",
      summary: {
        dueGold,
        paidAfter,
        autoPay,
        minRequired,
        nextReviewAt,
      },
    });

    return {
      outcome: "review_passed",
      base: rolled,
      updatedOrganization,
      dueGold,
      paidAfter,
      autoPay,
      minRequired,
    };
  }

  const debt = Math.max(0, dueGold - paidAfter);
  const confiscatedAt = nowTs;
  const buybackUntil = addCalendarDaysUtc(confiscatedAt, BUYBACK_WINDOW_DAYS);
  const buybackTotalGold = Math.ceil(debt * (1 + BUYBACK_INTEREST_PCT / 100));
  const leaderInternalId = getLeaderInternalIdForConfiscation(base, organization);
  const transfer = await moveStoredItemsToLeaderInventory(client, base.organizationInternalId, leaderInternalId);

  const confiscated = await updateOrganizationBaseFinancials(
    client,
    base.id,
    buildBasePatch(base, {
      status: "confiscated",
      confiscatedAt: new Date(confiscatedAt),
      buybackUntil: new Date(buybackUntil),
      debtGoldAtConfiscation: debt,
      leaderInternalId,
      metadata: {
        ...asRecord(base.metadata),
        reviewAnchorDayUtc,
        passiveBenefitsActive: false,
        passiveBenefitsDisabledAt: confiscatedAt,
        dailyUpkeepGold: getDailyUpkeepGold(base),
        lastReviewAt: confiscatedAt,
        lastReviewResult: "confiscated",
        lastConfiscationDebt: debt,
        confiscationReason: "underpaid_monthly_review",
        buyback: {
          windowDays: BUYBACK_WINDOW_DAYS,
          interestPct: BUYBACK_INTEREST_PCT,
          principalDebtGold: debt,
          totalDueGold: buybackTotalGold,
          startsAt: confiscatedAt,
          endsAt: buybackUntil,
        },
      },
    }),
  );

  await recordOrganizationBaseEvent(client, {
    organizationInternalId: base.organizationInternalId,
    baseId: base.id,
    actorInternalId,
    eventType: "base_confiscated",
    summary: {
      dueGold,
      paidAfter,
      autoPay,
      minRequired,
      debtGold: debt,
      confiscatedAt,
      buybackUntil,
      buybackTotalGold,
      passiveBenefitsActive: false,
      transferredToLeaderInternalId: transfer.targetLeaderInternalId,
      movedItems: transfer.movedItems,
    },
  });

  await insertOrganizationLog(client, base.organizationInternalId, {
    actorInternalId: actorInternalId ?? null,
    actorPublicId: null,
    actionType: "organization_base_confiscated",
    summary: {
      debtGold: debt,
      buybackUntil,
      buybackTotalGold,
      passiveBenefitsActive: false,
      transferredToLeaderInternalId: transfer.targetLeaderInternalId,
      movedItemCount: transfer.movedItems.length,
    },
  });

  return {
    outcome: "confiscated",
    base: confiscated,
    updatedOrganization,
    dueGold,
    paidAfter,
    autoPay,
    minRequired,
    debtGold: debt,
    buybackUntil,
    buybackTotalGold,
    transferredToLeaderInternalId: transfer.targetLeaderInternalId,
    movedItems: transfer.movedItems,
  };
}

function ensureOrgMember(organization, userInternalId) {
  const member = organization.members.find((entry) => entry.userInternalId === userInternalId);
  if (!member) {
    throw new HttpError(403, "You are not part of this organization.", "ORG_MEMBERSHIP_REQUIRED");
  }
  return member;
}

function ensureLeaderRole(organization, member) {
  const requiredRoleKey = organization.type === "guild" ? "guildmaster" : "director";
  if (member.roleKey !== requiredRoleKey) {
    throw new HttpError(403, "Only organization leadership can manually pay base upkeep.", "ORG_BASE_PAYMENT_LEADER_REQUIRED");
  }
}

function ensureTreasuryPermission(organization, member) {
  const role = organization.roles.find((entry) => entry.roleKey === member.roleKey);
  if (!role || !Array.isArray(role.permissions) || !role.permissions.includes("manage_treasury")) {
    throw new HttpError(403, "Treasury authority required for this base action.", "ORG_BASE_TREASURY_PERMISSION_REQUIRED");
  }
}

export async function payOrganizationBaseUpkeepForUser(user, organizationInternalId, payload = {}) {
  return withTransaction(async (client) => {
    const organization = await loadLockedOrganization(client, organizationInternalId);

    const member = ensureOrgMember(organization, user.internalId);
    ensureLeaderRole(organization, member);

    const lockedBase = await findOrganizationBaseByOrganizationInternalIdForUpdate(client, organization.internalId);
    if (!lockedBase) {
      throw new HttpError(404, "Organization base record unavailable.", "ORG_BASE_NOT_FOUND");
    }
    if (lockedBase.status !== "active") {
      throw new HttpError(409, "Only active bases can receive manual upkeep payments.", "ORG_BASE_NOT_ACTIVE");
    }

    const nowTs = Date.now();
    const { base: accruedBase } = await accrueBaseUpkeep(client, lockedBase, nowTs, user.internalId);

    const outstanding = getOutstandingGold(accruedBase);
    if (outstanding <= 0) {
      throw new HttpError(409, "No outstanding upkeep debt exists for this period.", "ORG_BASE_NOTHING_DUE");
    }

    const requested = asInt(payload.amountGold);
    if (requested <= 0) {
      throw new HttpError(400, "Payment amount must be greater than zero.", "ORG_BASE_PAYMENT_INVALID");
    }

    const paymentAmount = Math.min(requested, outstanding);
    const orgGold = getOrgGold(organization);
    if (orgGold < paymentAmount) {
      throw new HttpError(400, `Treasury needs ${paymentAmount - orgGold} more gold for this payment.`, "ORG_BASE_PAYMENT_FUNDS_REQUIRED");
    }

    const updatedOrganization = await setOrgGold(client, organization, orgGold - paymentAmount);
    const nextPaid = asInt(accruedBase.periodPaidGold) + paymentAmount;

    const paidBase = await updateOrganizationBaseFinancials(
      client,
      accruedBase.id,
      buildBasePatch(accruedBase, {
        periodPaidGold: nextPaid,
        metadata: {
          ...asRecord(accruedBase.metadata),
          lastManualPaymentAt: nowTs,
          lastManualPaymentByPublicId: user.publicId,
        },
      }),
    );

    await recordOrganizationBasePayment(client, {
      baseId: paidBase.id,
      organizationInternalId: paidBase.organizationInternalId,
      source: "manual",
      amountGold: paymentAmount,
      summary: {
        requestedAmount: requested,
        appliedAmount: paymentAmount,
        dueGoldBefore: asInt(accruedBase.periodDueGold),
        paidGoldBefore: asInt(accruedBase.periodPaidGold),
        paidGoldAfter: nextPaid,
      },
    });

    await recordOrganizationBaseEvent(client, {
      organizationInternalId: paidBase.organizationInternalId,
      baseId: paidBase.id,
      actorInternalId: user.internalId,
      eventType: "base_upkeep_paid_manual",
      summary: {
        amountGold: paymentAmount,
        dueGold: asInt(paidBase.periodDueGold),
        paidGold: asInt(paidBase.periodPaidGold),
        outstandingGold: getOutstandingGold(paidBase),
      },
    });

    await insertOrganizationLog(client, organization.internalId, {
      actorInternalId: user.internalId,
      actorPublicId: user.publicId,
      actionType: "organization_base_upkeep_paid",
      summary: {
        amountGold: paymentAmount,
        dueGold: asInt(paidBase.periodDueGold),
        paidGold: asInt(paidBase.periodPaidGold),
      },
    });

    return {
      organization: {
        ...updatedOrganization,
        treasury: {
          ...asRecord(updatedOrganization.treasury),
          gold: getOrgGold(updatedOrganization),
        },
      },
      base: paidBase,
      ledger: {
        dueGold: asInt(paidBase.periodDueGold),
        paidGold: asInt(paidBase.periodPaidGold),
        outstandingGold: getOutstandingGold(paidBase),
      },
    };
  });
}

export async function buybackOrganizationBaseForUser(user, organizationInternalId) {
  return withTransaction(async (client) => {
    const organization = await loadLockedOrganization(client, organizationInternalId);

    const member = ensureOrgMember(organization, user.internalId);
    ensureTreasuryPermission(organization, member);

    const base = await findOrganizationBaseByOrganizationInternalIdForUpdate(client, organization.internalId);
    if (!base) {
      throw new HttpError(404, "Organization base record unavailable.", "ORG_BASE_NOT_FOUND");
    }
    if (base.status !== "confiscated") {
      throw new HttpError(409, "Only confiscated bases can be bought back.", "ORG_BASE_NOT_CONFISCATED");
    }

    const nowTs = Date.now();
    const buybackUntil = base.buybackUntil ? asInt(base.buybackUntil) : 0;
    if (!buybackUntil) {
      throw new HttpError(409, "Buyback window is not available for this base.", "ORG_BASE_BUYBACK_WINDOW_MISSING");
    }
    if (nowTs > buybackUntil) {
      throw new HttpError(409, "Buyback window has expired for this base.", "ORG_BASE_BUYBACK_WINDOW_EXPIRED");
    }

    const debtPrincipal = getBuybackDebt(base);
    const buybackTotal = getBuybackTotalGold(base);
    const orgGold = getOrgGold(organization);
    if (orgGold < buybackTotal) {
      throw new HttpError(400, `Treasury needs ${buybackTotal - orgGold} more gold for buyback.`, "ORG_BASE_BUYBACK_FUNDS_REQUIRED");
    }

    const reviewAnchorDayUtc = getReviewAnchorDay(base);
    const nextReviewAt = computeNextReviewFromNow(nowTs, reviewAnchorDayUtc);
    const updatedOrganization = await setOrgGold(client, organization, orgGold - buybackTotal);

    const restored = await updateOrganizationBaseFinancials(
      client,
      base.id,
      buildBasePatch(base, {
        status: "active",
        confiscatedAt: null,
        buybackUntil: null,
        debtGoldAtConfiscation: null,
        periodDueGold: 0,
        periodPaidGold: 0,
        periodStartedAt: new Date(nowTs),
        nextReviewAt: new Date(nextReviewAt),
        metadata: {
          ...asRecord(base.metadata),
          passiveBenefitsActive: true,
          passiveBenefitsRestoredAt: nowTs,
          dailyUpkeepGold: getDailyUpkeepGold(base),
          lastAccruedAt: nowTs,
          accruedDaysInPeriod: 0,
          lastBuybackAt: nowTs,
          buyback: {
            ...asRecord(asRecord(base.metadata).buyback),
            principalDebtGold: debtPrincipal,
            totalDueGold: buybackTotal,
            settledAt: nowTs,
            settledByPublicId: user.publicId,
          },
        },
      }),
    );

    await recordOrganizationBasePayment(client, {
      baseId: restored.id,
      organizationInternalId: restored.organizationInternalId,
      source: "buyback",
      amountGold: buybackTotal,
      summary: {
        principalDebtGold: debtPrincipal,
        interestPct: BUYBACK_INTEREST_PCT,
        totalPaidGold: buybackTotal,
        buybackUntil,
      },
    });

    await recordOrganizationBaseEvent(client, {
      organizationInternalId: restored.organizationInternalId,
      baseId: restored.id,
      actorInternalId: user.internalId,
      eventType: "base_buyback_completed",
      summary: {
        principalDebtGold: debtPrincipal,
        interestPct: BUYBACK_INTEREST_PCT,
        totalPaidGold: buybackTotal,
        previousBuybackUntil: buybackUntil,
        restoredAt: nowTs,
        nextReviewAt,
        passiveBenefitsActive: true,
      },
    });

    await insertOrganizationLog(client, organization.internalId, {
      actorInternalId: user.internalId,
      actorPublicId: user.publicId,
      actionType: "organization_base_buyback",
      summary: {
        principalDebtGold: debtPrincipal,
        interestPct: BUYBACK_INTEREST_PCT,
        totalPaidGold: buybackTotal,
        restoredAt: nowTs,
      },
    });

    return {
      organization: {
        ...updatedOrganization,
        treasury: {
          ...asRecord(updatedOrganization.treasury),
          gold: getOrgGold(updatedOrganization),
        },
      },
      base: restored,
      buyback: {
        principalDebtGold: debtPrincipal,
        interestPct: BUYBACK_INTEREST_PCT,
        totalPaidGold: buybackTotal,
        restoredAt: nowTs,
        nextReviewAt,
      },
    };
  });
}

export async function runOrganizationBaseLifecycleSweep({ now = Date.now(), actorInternalId = null } = {}) {
  const nowTs = Number.isFinite(Number(now)) ? Math.floor(Number(now)) : Date.now();

  return withTransaction(async (client) => {
    const construction = await runOrganizationMainBuildCompletionSweep({
      nowTs: nowTs,
      actorInternalId,
      client,
    });

    const roomConstruction = await runOrganizationRoomBuildCompletionSweep({
      nowTs: nowTs,
      actorInternalId,
      client,
    });

    const staleBuilderReservations = await runStaleBuilderReservationSweep(client, {
      nowTs,
      reason: "base_lifecycle_sweep_expired",
      releasedByInternalId: actorInternalId,
    });

    const activeBases = await listActiveOrganizationBases(client);

    const accrualResults = [];
    const reviewResults = [];

    for (const baseRow of activeBases) {
      await lockOrganizationRowForUpdate(client, baseRow.organizationInternalId);
      const organization = await findOrganizationByInternalId(client, baseRow.organizationInternalId);
      if (!organization) {
        await recordOrganizationBaseEvent(client, {
          organizationInternalId: baseRow.organizationInternalId,
          baseId: baseRow.id,
          actorInternalId,
          eventType: "base_cycle_skipped_org_missing",
          summary: { now: nowTs },
        });
        continue;
      }

      const lockedBase = await findOrganizationBaseByOrganizationInternalIdForUpdate(client, baseRow.organizationInternalId);
      if (!lockedBase || lockedBase.id !== baseRow.id || lockedBase.status !== "active") {
        continue;
      }

      const { base: accruedBase, accruedGold, accruedDays, dailyUpkeepGold } = await accrueBaseUpkeep(
        client,
        lockedBase,
        nowTs,
        actorInternalId,
      );

      if (accruedDays > 0) {
        accrualResults.push({
          baseId: accruedBase.id,
          organizationInternalId: accruedBase.organizationInternalId,
          accruedDays,
          dailyUpkeepGold,
          accruedGold,
          dueGoldAfter: asInt(accruedBase.periodDueGold),
        });
      }

      if (accruedBase.nextReviewAt <= nowTs) {
        const review = await settleDueReview(client, accruedBase, organization, nowTs, actorInternalId);
        reviewResults.push({
          baseId: accruedBase.id,
          organizationInternalId: accruedBase.organizationInternalId,
          ...review,
        });
      }
    }

    const auction = await runOrganizationBaseAuctionLifecycleSweep({
      nowTs,
      actorInternalId,
      client,
    });

    return {
      now: nowTs,
      activeBaseCount: activeBases.length,
      accruedCount: accrualResults.length,
      reviewCount: reviewResults.length,
      dueReviewCount: reviewResults.length,
      expiredBuybackCount: auction.expiredBuybackCount,
      openedAuctionCount: auction.openedAuctionCount,
      settledAuctionCount: auction.settledAuctionCount,
      completedMainBuildCount: construction.completedCount,
      completedRoomBuildCount: roomConstruction.completedCount,
      staleBuilderReservationCount: staleBuilderReservations.releasedCount,
      completedMainBuildResults: construction.completed,
      completedRoomBuildResults: roomConstruction.completed,
      staleBuilderReservations: staleBuilderReservations.released,
      accrualResults,
      reviewResults,
      auction,
      construction,
      roomConstruction,
    };
  });
}

export async function getOrganizationBaseSafetySnapshot(organizationInternalId) {
  return withTransaction(async (client) => {
    const base = await findOrganizationBaseByOrganizationInternalId(client, organizationInternalId);
    if (!base) return null;

    return {
      ...base,
      passiveBenefitsActive: isPassiveBenefitsActive(base),
      buybackTotalGold: base.status === "confiscated" ? getBuybackTotalGold(base) : 0,
      outstandingGold: getOutstandingGold(base),
    };
  });
}

export {
  BUYBACK_INTEREST_PCT,
  BUYBACK_WINDOW_DAYS,
  computeNextReviewFromAnchor,
  getDailyUpkeepGold,
  getReviewAnchorDay,
  isPassiveBenefitsActive,
};
