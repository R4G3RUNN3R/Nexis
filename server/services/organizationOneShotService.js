import { withTransaction } from "../db/pool.js";
import { HttpError } from "../lib/errors.js";
import { buildMutableRuntimeState } from "../lib/runtimePlayerState.js";
import { createDefaultPlayerState, findPlayerStateByUserInternalId, upsertPlayerRuntimeState } from "../repositories/playerStateRepository.js";
import { findUserByPublicId } from "../repositories/usersRepository.js";
import { findOrganizationByInternalId, findOrganizationByPublicId, insertOrganizationLog, lockOrganizationForUpdate, updateOrganizationDetails } from "../repositories/organizationRepository.js";
import { recordOneShotCompletion } from "../repositories/oneShotCompletionRepository.js";
import { orderInternalIds } from "../lib/lockOrdering.js";
import {
  ORGANIZATION_ONE_SHOT_MIN_SIGNUPS,
  ORGANIZATION_ONE_SHOT_TOKEN_COST,
  ORGANIZATION_ONE_SHOT_TOKEN_REFUND_CHANCE,
  getOrganizationOneShotCampaign,
  getOrganizationOneShotCampaigns,
} from "../data/organizationOneShotData.js";

function asRecord(value) { return value && typeof value === "object" && !Array.isArray(value) ? value : {}; }
function asArray(value) { return Array.isArray(value) ? value : []; }
function asNumber(value, fallback = 0) { const numeric = Number(value); return Number.isFinite(numeric) ? numeric : fallback; }
function asWholeNumber(value, fallback = 0) { return Math.max(0, Math.floor(asNumber(value, fallback))); }
function displayName(user) { return `${user.firstName ?? ""} ${user.lastName ?? ""}`.trim() || user.username || `P${user.publicId}`; }

function normalizeOrganizationId(value) {
  const raw = String(value ?? "").trim();
  if (!raw) return null;
  const publicMatch = /^[GC]?(\d+)$/i.exec(raw);
  if (publicMatch) return { publicId: Number(publicMatch[1]) };
  return { internalId: raw };
}

async function findOrganization(client, organizationId) {
  const normalized = normalizeOrganizationId(organizationId);
  if (!normalized) throw new HttpError(400, "Organization ID is required.", "ORGANIZATION_ID_REQUIRED");
  if (normalized.publicId) return findOrganizationByPublicId(client, normalized.publicId);
  return findOrganizationByInternalId(client, normalized.internalId);
}

// Ticket A: resolves the organization by public/internal ID (unlocked, just to
// discover the internal ID), then re-reads it under FOR UPDATE. Mirrors the
// preliminary-read-then-lock pattern used in duelService.js's
// respondToDuelForUser, since the caller only has a public-facing ID here.
async function lockOrganization(client, organizationId) {
  const preliminary = await findOrganization(client, organizationId);
  if (!preliminary) return null;
  return lockOrganizationForUpdate(client, preliminary.internalId);
}

async function loadRuntimeState(client, user, options = {}) {
  const { forUpdate = false } = options;
  await createDefaultPlayerState(client, user.internalId);
  const playerState = await findPlayerStateByUserInternalId(client, user.internalId, { forUpdate });
  if (!playerState) throw new HttpError(404, "Player state unavailable.", "PLAYER_STATE_NOT_FOUND");
  return { playerState, runtimeState: buildMutableRuntimeState(user, playerState) };
}

function findMembership(organization, user) {
  return asArray(organization?.members).find((member) => member.userInternalId === user.internalId || Number(member.publicId) === Number(user.publicId)) ?? null;
}

function assertMember(organization, user) {
  const membership = findMembership(organization, user);
  if (!membership) throw new HttpError(403, "You must belong to this organization to access its one-shot board.", "ORGANIZATION_MEMBER_REQUIRED");
  return membership;
}

function canManageOneShots(organization, membership) {
  const role = asArray(organization?.roles).find((entry) => entry.roleKey === membership.roleKey);
  const permissions = asArray(role?.permissions);
  return ["guildmaster", "officer", "director"].includes(String(membership.roleKey ?? ""))
    || permissions.includes("declare_operations")
    || permissions.includes("manage_contracts")
    || permissions.includes("manage_treasury")
    || permissions.includes("manage_members");
}

function normalizeOneShotTokenState(runtimeState) {
  const player = asRecord(runtimeState.player);
  const current = asRecord(player.dmosOneShots);
  const tokens = asRecord(current.tokens);
  player.dmosOneShots = {
    ...current,
    tokens: {
      patronBound: asWholeNumber(tokens.patronBound, 0),
      sealed: asWholeNumber(tokens.sealed, 0),
      lifetimeSpent: asWholeNumber(tokens.lifetimeSpent, 0),
    },
    organizationTokenLedger: asArray(current.organizationTokenLedger).filter((entry) => entry && typeof entry === "object").slice(0, 100),
  };
  runtimeState.player = player;
  return player.dmosOneShots;
}

export function consumeOrganizationOneShotToken(runtimeState, _user = {}, now = Date.now()) {
  const oneShots = normalizeOneShotTokenState(runtimeState);
  const tokens = oneShots.tokens;
  let source = null;
  if (tokens.patronBound > 0) {
    tokens.patronBound -= ORGANIZATION_ONE_SHOT_TOKEN_COST;
    source = "patron_bound";
  } else if (tokens.sealed > 0) {
    tokens.sealed -= ORGANIZATION_ONE_SHOT_TOKEN_COST;
    source = "sealed";
  }
  if (!source) {
    throw new HttpError(409, "No Nexis one-shot token available. Use a token for a personal, Guild, or Consortium one-shot.", "ORGANIZATION_ONE_SHOT_TOKEN_REQUIRED");
  }
  tokens.lifetimeSpent += ORGANIZATION_ONE_SHOT_TOKEN_COST;
  const tokenCommitment = {
    source,
    cost: ORGANIZATION_ONE_SHOT_TOKEN_COST,
    consumedAt: now,
    refundChance: ORGANIZATION_ONE_SHOT_TOKEN_REFUND_CHANCE,
    refundedAt: null,
  };
  oneShots.organizationTokenLedger = [{ type: "committed", ...tokenCommitment }, ...oneShots.organizationTokenLedger].slice(0, 100);
  return tokenCommitment;
}

export function refundOrganizationOneShotToken(runtimeState, tokenCommitment = {}, now = Date.now()) {
  const commitment = asRecord(tokenCommitment);
  if (commitment.refundedAt) return null;
  const oneShots = normalizeOneShotTokenState(runtimeState);
  const tokens = oneShots.tokens;
  if (commitment.source === "patron_bound") {
    tokens.patronBound += ORGANIZATION_ONE_SHOT_TOKEN_COST;
  } else if (commitment.source === "sealed") {
    tokens.sealed += ORGANIZATION_ONE_SHOT_TOKEN_COST;
  } else {
    return null;
  }
  const refund = { source: commitment.source, cost: ORGANIZATION_ONE_SHOT_TOKEN_COST, refundedAt: now };
  oneShots.organizationTokenLedger = [{ type: "refunded", ...refund }, ...oneShots.organizationTokenLedger].slice(0, 100);
  commitment.refundedAt = now;
  return refund;
}

export function shouldRefundOrganizationOneShotToken(randomFn = Math.random) {
  return Number(randomFn()) < ORGANIZATION_ONE_SHOT_TOKEN_REFUND_CHANCE;
}

function normalizeTokenCommitment(value) {
  const record = asRecord(value);
  const source = record.source === "patron_bound" || record.source === "sealed" ? record.source : null;
  if (!source) return null;
  return {
    source,
    cost: ORGANIZATION_ONE_SHOT_TOKEN_COST,
    consumedAt: typeof record.consumedAt === "number" ? record.consumedAt : null,
    refundChance: typeof record.refundChance === "number" ? record.refundChance : ORGANIZATION_ONE_SHOT_TOKEN_REFUND_CHANCE,
    refundedAt: typeof record.refundedAt === "number" ? record.refundedAt : null,
  };
}

function hasTokenCommitment(signup) {
  return Boolean(normalizeTokenCommitment(asRecord(signup).tokenCommitment));
}

export function normalizeOrganizationOneShotState(input = {}) {
  const current = asRecord(input);
  const campaigns = {};
  for (const [campaignId, campaignState] of Object.entries(asRecord(current.campaigns))) {
    const state = asRecord(campaignState);
    campaigns[campaignId] = {
      campaignId,
      status: state.status === "completed" ? "completed" : "recruiting",
      signups: asArray(state.signups).filter((entry) => entry && typeof entry === "object").map((entry) => {
        const publicId = asWholeNumber(entry.publicId, 0);
        return {
          userInternalId: typeof entry.userInternalId === "string" ? entry.userInternalId : null,
          publicId,
          displayName: typeof entry.displayName === "string" && entry.displayName.trim() ? entry.displayName.trim() : `P${publicId}`,
          roleKey: typeof entry.roleKey === "string" ? entry.roleKey : null,
          signedAt: typeof entry.signedAt === "number" ? entry.signedAt : null,
          tokenCommitment: normalizeTokenCommitment(entry.tokenCommitment),
        };
      }).filter((entry) => entry.publicId > 0),
      completedAt: typeof state.completedAt === "number" ? state.completedAt : null,
      completedByPublicId: asWholeNumber(state.completedByPublicId, 0) || null,
      reward: asRecord(state.reward),
    };
  }
  return {
    campaigns,
    completedCampaignIds: Array.from(new Set(asArray(current.completedCampaignIds).filter((entry) => typeof entry === "string"))),
    legacyRecords: asArray(current.legacyRecords).filter((entry) => entry && typeof entry === "object").slice(0, 100),
    lastUpdatedAt: typeof current.lastUpdatedAt === "number" ? current.lastUpdatedAt : null,
  };
}

export function canResolveOrganizationOneShot(campaignState, minimumSignups = ORGANIZATION_ONE_SHOT_MIN_SIGNUPS) {
  const state = asRecord(campaignState);
  if (state.status === "completed") return false;
  const committedSignupCount = asArray(state.signups).filter(hasTokenCommitment).length;
  return committedSignupCount >= Math.max(ORGANIZATION_ONE_SHOT_MIN_SIGNUPS, asWholeNumber(minimumSignups, ORGANIZATION_ONE_SHOT_MIN_SIGNUPS));
}

function ensureCampaignState(oneShotState, campaignId) {
  if (!oneShotState.campaigns[campaignId]) {
    oneShotState.campaigns[campaignId] = {
      campaignId,
      status: "recruiting",
      signups: [],
      completedAt: null,
      completedByPublicId: null,
      reward: {},
    };
  }
  return oneShotState.campaigns[campaignId];
}

function applyOneShotState(organization, state) {
  return { ...asRecord(organization.metadata), organizationOneShots: state };
}

function serializeRewardPreview(campaign) {
  const reward = asRecord(campaign.reward);
  const gold = asWholeNumber(reward.treasuryGold, 0).toLocaleString("en-US");
  const points = asWholeNumber(reward.progressionPoints, 0);
  const reputation = asWholeNumber(reward.reputation, 0);
  const items = asArray(reward.itemRewards).map((entry) => asRecord(entry).label).filter(Boolean).slice(0, 2).join(" + ");
  return `${gold} gold to treasury | +${points} progression | +${reputation} reputation${items ? ` | ${items}` : ""}`;
}

export function buildOrganizationOneShotBoardSnapshot({ organization, viewerPublicId }) {
  const oneShotState = normalizeOrganizationOneShotState(asRecord(asRecord(organization?.metadata).organizationOneShots));
  const campaigns = getOrganizationOneShotCampaigns(organization?.type).map((campaign) => {
    const state = ensureCampaignState(oneShotState, campaign.id);
    const completed = state.status === "completed" || oneShotState.completedCampaignIds.includes(campaign.id);
    const minimumSignups = Math.max(ORGANIZATION_ONE_SHOT_MIN_SIGNUPS, asWholeNumber(campaign.minimumSignups, ORGANIZATION_ONE_SHOT_MIN_SIGNUPS));
    const signups = asArray(state.signups);
    const tokenCommittedCount = signups.filter(hasTokenCommitment).length;
    return {
      ...campaign,
      status: completed ? "completed" : "recruiting",
      signupCount: signups.length,
      tokenCommittedCount,
      minimumSignups,
      tokenCost: ORGANIZATION_ONE_SHOT_TOKEN_COST,
      tokenRefundChance: ORGANIZATION_ONE_SHOT_TOKEN_REFUND_CHANCE,
      signups: signups.slice(0, 12),
      viewerSignedUp: signups.some((signup) => Number(signup.publicId) === Number(viewerPublicId)),
      canResolve: !completed && tokenCommittedCount >= minimumSignups,
      completedAt: state.completedAt,
      rewardTarget: `${organization?.type ?? "organization"}_legacy_and_treasury`,
      rewardPreview: serializeRewardPreview(campaign),
    };
  });
  return {
    organization: {
      internalId: organization?.internalId,
      publicId: organization?.publicId,
      type: organization?.type,
      name: organization?.name,
      treasury: organization?.treasury ?? {},
    },
    minimumSignups: ORGANIZATION_ONE_SHOT_MIN_SIGNUPS,
    tokenCost: ORGANIZATION_ONE_SHOT_TOKEN_COST,
    tokenRefundChance: ORGANIZATION_ONE_SHOT_TOKEN_REFUND_CHANCE,
    campaigns,
    legacyRecords: oneShotState.legacyRecords,
  };
}

export async function getOrganizationOneShotBoardForUser(user, organizationId) {
  return withTransaction(async (client) => {
    const organization = await findOrganization(client, organizationId);
    if (!organization) throw new HttpError(404, "Organization not found.", "ORGANIZATION_NOT_FOUND");
    assertMember(organization, user);
    return buildOrganizationOneShotBoardSnapshot({ organization, viewerPublicId: user.publicId });
  });
}

export async function signUpOrganizationOneShotForUser(user, organizationId, campaignId) {
  return withTransaction(async (client) => {
    // Ticket A: lock the organization row first (consistently org-then-player
    // across both signup and resolve), so two concurrent signups against the
    // same organization can never both read the same stale signup list.
    let organization = await lockOrganization(client, organizationId);
    if (!organization) throw new HttpError(404, "Organization not found.", "ORGANIZATION_NOT_FOUND");
    const membership = assertMember(organization, user);
    const campaign = getOrganizationOneShotCampaign(campaignId);
    if (!campaign || campaign.organizationType !== organization.type) throw new HttpError(404, "Organization one-shot not found for this organization type.", "ORGANIZATION_ONE_SHOT_NOT_FOUND");
    const state = normalizeOrganizationOneShotState(asRecord(asRecord(organization.metadata).organizationOneShots));
    const campaignState = ensureCampaignState(state, campaign.id);
    if (campaignState.status === "completed" || state.completedCampaignIds.includes(campaign.id)) throw new HttpError(409, "This organization one-shot has already been completed.", "ORGANIZATION_ONE_SHOT_ALREADY_COMPLETED");

    const existingSignup = campaignState.signups.find((signup) => Number(signup.publicId) === Number(user.publicId)) ?? null;
    let tokenWasCommitted = false;
    if (!existingSignup || !hasTokenCommitment(existingSignup)) {
      const { runtimeState } = await loadRuntimeState(client, user, { forUpdate: true });
      const now = Date.now();
      const tokenCommitment = consumeOrganizationOneShotToken(runtimeState, user, now);
      if (existingSignup) {
        existingSignup.tokenCommitment = tokenCommitment;
        existingSignup.signedAt = existingSignup.signedAt ?? now;
        existingSignup.roleKey = existingSignup.roleKey ?? membership.roleKey;
      } else {
        campaignState.signups.push({ userInternalId: user.internalId, publicId: user.publicId, displayName: displayName(user), roleKey: membership.roleKey, signedAt: now, tokenCommitment });
      }
      tokenWasCommitted = true;
      await upsertPlayerRuntimeState(client, user.internalId, runtimeState);
    }

    state.lastUpdatedAt = Date.now();
    organization = await updateOrganizationDetails(client, organization.internalId, { metadata: applyOneShotState(organization, state) });
    await insertOrganizationLog(client, organization.internalId, {
      actorInternalId: user.internalId,
      actorPublicId: user.publicId,
      actionType: "organization_one_shot_signup",
      summary: { campaignId: campaign.id, title: campaign.title, publicId: user.publicId, tokenCost: ORGANIZATION_ONE_SHOT_TOKEN_COST },
    });
    return { ...buildOrganizationOneShotBoardSnapshot({ organization, viewerPublicId: user.publicId }), message: tokenWasCommitted ? "Signup recorded and one token committed." : "Signup already recorded with token committed." };
  });
}

async function refundParticipantTokens(client, campaignState, now) {
  // Ticket A: decide which signups actually need a refund (and resolve each to its
  // participant user) BEFORE taking any row lock, then lock those participants in
  // canonical ascending-internalId order. Locking in signup order instead - as this
  // used to do - is a lock-order violation: a concurrent resolve of a different
  // campaign whose signups happen to be in the opposite order could deadlock against
  // this one, since both loops would be locking the same two accounts oppositely.
  const candidates = [];
  for (const signup of asArray(campaignState.signups)) {
    const tokenCommitment = normalizeTokenCommitment(signup.tokenCommitment);
    if (!tokenCommitment || tokenCommitment.refundedAt || !shouldRefundOrganizationOneShotToken()) continue;
    const participant = await findUserByPublicId(client, signup.publicId);
    if (!participant) continue;
    candidates.push({ signup, tokenCommitment, participant });
  }
  candidates.sort((a, b) => {
    const [first] = orderInternalIds(a.participant.internalId, b.participant.internalId);
    if (a.participant.internalId === b.participant.internalId) return 0;
    return first === a.participant.internalId ? -1 : 1;
  });

  const refunds = [];
  for (const { signup, tokenCommitment, participant } of candidates) {
    const { runtimeState } = await loadRuntimeState(client, participant, { forUpdate: true });
    const refund = refundOrganizationOneShotToken(runtimeState, tokenCommitment, now);
    if (!refund) continue;
    signup.tokenCommitment = { ...tokenCommitment, refundedAt: now };
    refunds.push({ publicId: signup.publicId, displayName: signup.displayName, source: refund.source, refundedAt: now });
    await upsertPlayerRuntimeState(client, participant.internalId, runtimeState);
  }
  return refunds;
}

export async function resolveOrganizationOneShotForUser(user, organizationId, campaignId) {
  return withTransaction(async (client) => {
    // Ticket A: lock the organization row before the "already completed"/
    // threshold checks, so two concurrent resolve attempts can't both read
    // an unlocked campaignState and both pay out the treasury reward.
    let organization = await lockOrganization(client, organizationId);
    if (!organization) throw new HttpError(404, "Organization not found.", "ORGANIZATION_NOT_FOUND");
    const membership = assertMember(organization, user);
    if (!canManageOneShots(organization, membership)) throw new HttpError(403, "Only organization leadership can resolve a group one-shot.", "ORGANIZATION_ONE_SHOT_LEADER_REQUIRED");
    const campaign = getOrganizationOneShotCampaign(campaignId);
    if (!campaign || campaign.organizationType !== organization.type) throw new HttpError(404, "Organization one-shot not found for this organization type.", "ORGANIZATION_ONE_SHOT_NOT_FOUND");
    const state = normalizeOrganizationOneShotState(asRecord(asRecord(organization.metadata).organizationOneShots));
    const campaignState = ensureCampaignState(state, campaign.id);
    if (campaignState.status === "completed" || state.completedCampaignIds.includes(campaign.id)) throw new HttpError(409, "This organization one-shot has already been completed.", "ORGANIZATION_ONE_SHOT_ALREADY_COMPLETED");
    const minimumSignups = Math.max(ORGANIZATION_ONE_SHOT_MIN_SIGNUPS, asWholeNumber(campaign.minimumSignups, ORGANIZATION_ONE_SHOT_MIN_SIGNUPS));
    if (!canResolveOrganizationOneShot(campaignState, minimumSignups)) {
      throw new HttpError(409, `At least ${minimumSignups} members must commit one token each before this group one-shot can resolve.`, "ORGANIZATION_ONE_SHOT_SIGNUPS_REQUIRED");
    }

    // Ticket A: DB-level idempotency backstop layered on top of the row
    // lock above. sessionId is a stable business key (org + campaign), not
    // a client-supplied value, so retried/duplicated resolve requests for
    // the same campaign fail safely via the unique constraint instead of
    // silently double-paying the treasury.
    await recordOneShotCompletion(client, {
      userInternalId: user.internalId,
      organizationInternalId: organization.internalId,
      campaignId: campaign.id,
      sessionId: `org_one_shot_${organization.internalId}_${campaign.id}`,
      outcomeKey: "resolved",
      metadata: { resolvedByPublicId: user.publicId },
    });

    const now = Date.now();
    const reward = asRecord(campaign.reward);
    const tokenRefunds = await refundParticipantTokens(client, campaignState, now);
    const currentTreasury = asRecord(organization.treasury);
    const treasuryGold = asWholeNumber(currentTreasury.gold, 0) + asWholeNumber(reward.treasuryGold, 0);
    campaignState.status = "completed";
    campaignState.completedAt = now;
    campaignState.completedByPublicId = user.publicId;
    campaignState.reward = reward;
    state.completedCampaignIds = Array.from(new Set([...state.completedCampaignIds, campaign.id]));
    const legacyRecord = {
      id: `org_one_shot_${campaign.id}_${now}`,
      timestamp: now,
      campaignId: campaign.id,
      title: campaign.title,
      theme: campaign.theme,
      category: campaign.category,
      summary: `${campaign.title} completed by ${campaignState.signups.length} members with ${campaignState.signups.filter(hasTokenCommitment).length} token commitments.`,
      reward: {
        treasuryGold: asWholeNumber(reward.treasuryGold, 0),
        progressionPoints: asWholeNumber(reward.progressionPoints, 0),
        reputation: asWholeNumber(reward.reputation, 0),
        renown: asWholeNumber(reward.renown, 0),
        itemRewards: asArray(reward.itemRewards),
        legacyLabel: reward.legacyLabel ?? null,
      },
      tokenCostPerParticipant: ORGANIZATION_ONE_SHOT_TOKEN_COST,
      tokenRefundChance: ORGANIZATION_ONE_SHOT_TOKEN_REFUND_CHANCE,
      tokenRefunds,
      participants: campaignState.signups.map((signup) => ({ publicId: signup.publicId, displayName: signup.displayName, tokenSource: signup.tokenCommitment?.source ?? null })),
      recordedByPublicId: user.publicId,
    };
    state.legacyRecords = [legacyRecord, ...state.legacyRecords].slice(0, 100);
    state.lastUpdatedAt = now;

    organization = await updateOrganizationDetails(client, organization.internalId, {
      treasury: { ...currentTreasury, gold: treasuryGold },
      metadata: applyOneShotState(organization, state),
    });
    await insertOrganizationLog(client, organization.internalId, {
      actorInternalId: user.internalId,
      actorPublicId: user.publicId,
      actionType: "organization_one_shot_completed",
      summary: legacyRecord,
    });
    return { ...buildOrganizationOneShotBoardSnapshot({ organization, viewerPublicId: user.publicId }), legacyRecord, message: "Organization one-shot completed and recorded to organization legacy." };
  });
}
