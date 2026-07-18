import { withTransaction } from "../db/pool.js";
import { HttpError } from "../lib/errors.js";
import { buildMutableRuntimeState } from "../lib/runtimePlayerState.js";
import { createDefaultPlayerState, findPlayerStateByUserInternalId, upsertPlayerRuntimeState } from "../repositories/playerStateRepository.js";
import { findUserByPublicId } from "../repositories/usersRepository.js";
import { orderInternalIds } from "../lib/lockOrdering.js";
import { PVP_CORE_VERSION, PVP_MODES, PVP_NOTORIETY_TIERS, PVP_SAFETY_RULES, PVP_SEASON_TEMPLATE, getNotorietyTier } from "../data/pvpData.js";
import { addPlayerRecord } from "./playerRecordsService.js";

function asRecord(value) { return value && typeof value === "object" && !Array.isArray(value) ? value : {}; }
function asArray(value) { return Array.isArray(value) ? value : []; }
function asNumber(value, fallback = 0) { const numeric = Number(value); return Number.isFinite(numeric) ? numeric : fallback; }
function asWholeNumber(value, fallback = 0) { return Math.max(0, Math.floor(asNumber(value, fallback))); }
function asBoolean(value) { return value === true; }
function displayName(user) { return `${user.firstName ?? ""} ${user.lastName ?? ""}`.trim() || user.username || `P${user.publicId}`; }

async function loadRuntimeState(client, user, { forUpdate = false } = {}) {
  await createDefaultPlayerState(client, user.internalId);
  const playerState = await findPlayerStateByUserInternalId(client, user.internalId, { forUpdate });
  if (!playerState) throw new HttpError(404, "Player state unavailable.", "PLAYER_STATE_NOT_FOUND");
  return { playerState, runtimeState: buildMutableRuntimeState(user, playerState) };
}

function normalizeSafety(existing = {}) {
  return {
    sparringOptIn: asBoolean(existing.sparringOptIn),
    rankedOptIn: asBoolean(existing.rankedOptIn),
    bountyEligible: asBoolean(existing.bountyEligible),
    caravanRiskOptIn: asBoolean(existing.caravanRiskOptIn),
  };
}

export function ensurePvpProfile(runtimeState) {
  const player = asRecord(runtimeState.player);
  const existing = asRecord(player.pvpProfile);
  const notorietyScore = asWholeNumber(asRecord(existing.notoriety).score, 0);
  player.pvpProfile = {
    version: PVP_CORE_VERSION,
    safety: normalizeSafety(asRecord(existing.safety)),
    notoriety: {
      score: notorietyScore,
      tier: getNotorietyTier(notorietyScore),
    },
    ranked: {
      rating: Math.max(700, asWholeNumber(asRecord(existing.ranked).rating, PVP_SEASON_TEMPLATE.defaultRating)),
      wins: asWholeNumber(asRecord(existing.ranked).wins, 0),
      losses: asWholeNumber(asRecord(existing.ranked).losses, 0),
      seasonPoints: asWholeNumber(asRecord(existing.ranked).seasonPoints, 0),
    },
    bountyWrits: {
      issued: asArray(asRecord(existing.bountyWrits).issued).filter(Boolean).slice(0, 50),
      activeAgainstMe: asArray(asRecord(existing.bountyWrits).activeAgainstMe).filter(Boolean).slice(0, 50),
      completed: asArray(asRecord(existing.bountyWrits).completed).filter(Boolean).slice(0, 50),
    },
    arenaSeason: {
      ...PVP_SEASON_TEMPLATE,
      ...asRecord(existing.arenaSeason),
    },
    rivalries: asArray(existing.rivalries).filter(Boolean).slice(0, 20),
    lastUpdatedAt: typeof existing.lastUpdatedAt === "number" ? existing.lastUpdatedAt : null,
  };
  runtimeState.player = player;
  return player.pvpProfile;
}

function pvpBountyWritsEnabled() {
  return process.env.NEXIS_ENABLE_PVP_BOUNTIES === "true";
}

function serializePvpHub(runtimeState) {
  const pvp = ensurePvpProfile(runtimeState);
  return {
    pvp,
    catalog: {
      modes: PVP_MODES,
      safetyRules: PVP_SAFETY_RULES,
      season: PVP_SEASON_TEMPLATE,
      notorietyTiers: PVP_NOTORIETY_TIERS,
      availability: {
        bountyWritsEnabled: pvpBountyWritsEnabled(),
        note: pvpBountyWritsEnabled() ? "Bounty writs are enabled." : "Bounty writs are inactive until live operations enables them.",
      },
    },
  };
}

export async function getPvpHubForUser(user) {
  return withTransaction(async (client) => {
    const { playerState, runtimeState } = await loadRuntimeState(client, user);
    return { playerState, ...serializePvpHub(runtimeState) };
  });
}

export async function updatePvpSafetyForUser(user, payload = {}) {
  return withTransaction(async (client) => {
    const { runtimeState } = await loadRuntimeState(client, user, { forUpdate: true });
    const pvp = ensurePvpProfile(runtimeState);
    // Read exactly the 4 named safety fields from the client payload - never
    // spread the payload itself into an object. An omitted field keeps its
    // existing value (partial update); anything else the client sends is
    // never looked at, so this can't be widened into mass assignment later
    // just by someone touching normalizeSafety(). (Ticket 5 hardening.)
    const incomingSafety = asRecord(payload.safety ?? payload);
    pvp.safety = normalizeSafety({
      sparringOptIn: incomingSafety.sparringOptIn ?? pvp.safety.sparringOptIn,
      rankedOptIn: incomingSafety.rankedOptIn ?? pvp.safety.rankedOptIn,
      bountyEligible: incomingSafety.bountyEligible ?? pvp.safety.bountyEligible,
      caravanRiskOptIn: incomingSafety.caravanRiskOptIn ?? pvp.safety.caravanRiskOptIn,
    });
    pvp.lastUpdatedAt = Date.now();
    addPlayerRecord(runtimeState, {
      category: "combat",
      source: "pvp_safety",
      summary: "PvP safety preferences updated.",
      route: "/arena",
      detail: { safety: pvp.safety },
    });
    await upsertPlayerRuntimeState(client, user.internalId, runtimeState);
    const playerState = await findPlayerStateByUserInternalId(client, user.internalId);
    return { playerState, ...serializePvpHub(runtimeState), message: "PvP safety preferences updated." };
  });
}

export async function issueBountyWritForUser(user, payload = {}) {
  if (!pvpBountyWritsEnabled()) {
    throw new HttpError(423, "Bounty writs are not live yet. Arena duels remain the active player combat route.", "PVP_BOUNTIES_NOT_LIVE");
  }
  return withTransaction(async (client) => {
    const targetPublicId = Math.floor(asNumber(payload.targetPublicId, 0));
    const escrowGold = asWholeNumber(payload.gold, 0);
    const reason = typeof payload.reason === "string" && payload.reason.trim() ? payload.reason.trim().slice(0, 160) : "Bounty writ filed.";
    if (!targetPublicId) throw new HttpError(400, "Target public ID is required.", "BOUNTY_TARGET_REQUIRED");
    if (targetPublicId === user.publicId) throw new HttpError(400, "You cannot place a bounty on yourself.", "BOUNTY_SELF_TARGET");
    if (escrowGold < 100) throw new HttpError(400, "Bounty writs require at least 100 gold in escrow.", "BOUNTY_ESCROW_TOO_LOW");

    const targetUser = await findUserByPublicId(client, targetPublicId);
    if (!targetUser) throw new HttpError(404, "Target player not found.", "BOUNTY_TARGET_NOT_FOUND");

    // Ticket A: canonical lock order (lowest internal ID first), matching
    // duelService.js/marketplaceService.js/itemService.js -- two players
    // filing bounty writs against each other simultaneously must not be
    // able to lock in reversed order, which would deadlock.
    const [firstId] = orderInternalIds(user.internalId, targetUser.internalId);
    const [firstUser, secondUser] = firstId === user.internalId ? [user, targetUser] : [targetUser, user];
    const { runtimeState: firstRuntime } = await loadRuntimeState(client, firstUser, { forUpdate: true });
    const { runtimeState: secondRuntime } = await loadRuntimeState(client, secondUser, { forUpdate: true });
    const issuerRuntime = firstUser.internalId === user.internalId ? firstRuntime : secondRuntime;
    const targetRuntime = firstUser.internalId === user.internalId ? secondRuntime : firstRuntime;
    const issuerPvp = ensurePvpProfile(issuerRuntime);
    const targetPvp = ensurePvpProfile(targetRuntime);
    const targetTier = getNotorietyTier(asWholeNumber(targetPvp.notoriety.score, 0));
    if (!targetPvp.safety.bountyEligible && targetTier.minScore < 30) {
      throw new HttpError(409, "Target is protected from bounty writs. They must opt in or become wanted first.", "BOUNTY_TARGET_PROTECTED");
    }

    const issuerPlayer = asRecord(issuerRuntime.player);
    const currentGold = asWholeNumber(issuerPlayer.gold, 0);
    if (currentGold < escrowGold) throw new HttpError(409, "Not enough gold for bounty escrow.", "BOUNTY_ESCROW_INSUFFICIENT_FUNDS");
    issuerPlayer.gold = currentGold - escrowGold;

    const now = Date.now();
    const writ = {
      id: `bounty_${user.publicId}_${targetUser.publicId}_${now}`,
      status: "active",
      issuer: { publicId: user.publicId, name: displayName(user) },
      target: { publicId: targetUser.publicId, name: displayName(targetUser) },
      gold: escrowGold,
      reason,
      createdAt: now,
    };
    issuerPvp.bountyWrits.issued = [writ, ...issuerPvp.bountyWrits.issued].slice(0, 50);
    targetPvp.bountyWrits.activeAgainstMe = [writ, ...targetPvp.bountyWrits.activeAgainstMe].slice(0, 50);
    issuerPvp.lastUpdatedAt = now;
    targetPvp.lastUpdatedAt = now;
    issuerRuntime.player = issuerPlayer;

    addPlayerRecord(issuerRuntime, { category: "combat", source: "bounty_writ", summary: `Bounty writ filed against ${displayName(targetUser)}.`, route: "/arena", detail: { writId: writ.id, gold: escrowGold } });
    addPlayerRecord(targetRuntime, { category: "combat", source: "bounty_writ", summary: `${displayName(user)} filed a bounty writ against you.`, route: "/arena", detail: { writId: writ.id, gold: escrowGold } });

    await upsertPlayerRuntimeState(client, user.internalId, issuerRuntime);
    await upsertPlayerRuntimeState(client, targetUser.internalId, targetRuntime);
    const playerState = await findPlayerStateByUserInternalId(client, user.internalId);
    return { playerState, ...serializePvpHub(issuerRuntime), writ, message: "Bounty writ posted." };
  });
}
