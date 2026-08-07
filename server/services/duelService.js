import { withTransaction } from "../db/pool.js";
import { HttpError } from "../lib/errors.js";
import { buildMutableRuntimeState } from "../lib/runtimePlayerState.js";
import {
  createDefaultPlayerState,
  findPlayerStateByUserInternalId,
  upsertPlayerRuntimeState,
} from "../repositories/playerStateRepository.js";
import { findUserByPublicId } from "../repositories/usersRepository.js";
import { assertCanStartRealFight, getCombatXpAward, grantCombatXp, resolveCombat, spendCombatEnergy } from "./combatService.js";
import { orderInternalIds } from "../lib/lockOrdering.js";

function asRecord(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : {};
}

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function asNumber(value, fallback = 0) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : fallback;
}

function displayName(user) {
  return `${user.firstName ?? ""} ${user.lastName ?? ""}`.trim() || user.username || `P${user.publicId}`;
}

function currentCityId(runtimeState) {
  const travel = asRecord(runtimeState.travel);
  const current = asRecord(runtimeState.player?.current);
  return typeof travel.currentCityId === "string" ? travel.currentCityId : typeof current.currentCityId === "string" ? current.currentCityId : "nexis";
}

function ensureDuelState(runtimeState) {
  const player = asRecord(runtimeState.player);
  const existing = asRecord(player.duels);
  player.duels = {
    incoming: { ...asRecord(existing.incoming) },
    outgoing: { ...asRecord(existing.outgoing) },
    history: asArray(existing.history),
  };
  runtimeState.player = player;
  return player.duels;
}

async function loadRuntimeState(client, user, { forUpdate = false } = {}) {
  await createDefaultPlayerState(client, user.internalId);
  const playerState = await findPlayerStateByUserInternalId(client, user.internalId, { forUpdate });
  if (!playerState) throw new HttpError(404, "Player state unavailable.", "PLAYER_STATE_NOT_FOUND");
  return { playerState, runtimeState: buildMutableRuntimeState(user, playerState) };
}

function serializeDuelState(runtimeState) {
  const state = ensureDuelState(runtimeState);
  return {
    incoming: Object.values(state.incoming).sort((a, b) => asNumber(b.createdAt, 0) - asNumber(a.createdAt, 0)),
    outgoing: Object.values(state.outgoing).sort((a, b) => asNumber(b.createdAt, 0) - asNumber(a.createdAt, 0)),
    history: asArray(state.history).slice(0, 20),
  };
}

// resolveCombat's result.player / result.opponentState carry real health and
// maxHealth numbers - correct for NPC fights (a monster's HP bar is meant to
// be visible), but in a duel "opponent" is a real player. Without this,
// dueling someone reveals their true maxHealth stat to both participants,
// both immediately and every time either later views their duel history
// (the same result object is what gets persisted). "player"/"opponentState"
// are fixed challenger/target roles from resolveCombat's own perspective,
// not "self/other" from a given viewer's perspective, so which side gets
// redacted depends on who is about to see this copy of the result.
function redactOpponentHealth(result, { hidePlayerSide, hideOpponentSide }) {
  if (!result) return result;
  return {
    ...result,
    player: hidePlayerSide ? { health: null, maxHealth: null } : result.player,
    opponentState: hideOpponentSide ? { health: null, maxHealth: null } : result.opponentState,
  };
}

function buildPlayerOpponent(user, runtimeState) {
  const player = asRecord(runtimeState.player);
  // Prefer the title-boosted views, matching combatService.js's
  // buildPlayerCombatant() - otherwise the defending side of a duel loses
  // their equipped stat title's bonus entirely (only the challenger's own
  // side went through combatService.js and got it correctly).
  const stats = asRecord(player.effectiveStats ?? player.stats);
  const battle = asRecord(player.effectiveBattleStats ?? player.battleStats);
  const maxHealth = Math.max(30, asNumber(stats.maxHealth, 100));
  return {
    id: `player_${user.publicId}`,
    name: displayName(user),
    level: Math.max(1, Math.floor(asNumber(player.level, 1))),
    health: maxHealth,
    battleStats: {
      strength: Math.max(1, asNumber(battle.strength, 10)),
      defense: Math.max(1, asNumber(battle.defense, 10)),
      speed: Math.max(1, asNumber(battle.speed, 10)),
      dexterity: Math.max(1, asNumber(battle.dexterity, 10)),
    },
    reward: {},
  };
}

export async function getDuelsForUser(user) {
  return withTransaction(async (client) => {
    const { playerState, runtimeState } = await loadRuntimeState(client, user);
    return { playerState, duels: serializeDuelState(runtimeState) };
  });
}

export async function challengeDuelForUser(user, payload) {
  return withTransaction(async (client) => {
    const targetPublicId = Math.floor(asNumber(payload?.targetPublicId, 0));
    if (!targetPublicId) throw new HttpError(400, "Target public ID is required.", "DUEL_TARGET_REQUIRED");
    if (targetPublicId === user.publicId) throw new HttpError(400, "You cannot challenge yourself.", "DUEL_SELF_TARGET");
    const targetUser = await findUserByPublicId(client, targetPublicId);
    if (!targetUser) throw new HttpError(404, "Target player not found.", "DUEL_TARGET_NOT_FOUND");

    // Ticket A: canonical lock order (not always challenger-then-target) -
    // two reciprocal challenges fired at the same moment (A challenges B,
    // B challenges A) would otherwise each lock themselves first and then
    // want the other, a textbook deadlock.
    const [firstId, secondId] = orderInternalIds(user.internalId, targetUser.internalId);
    const firstUser = firstId === user.internalId ? user : targetUser;
    const secondUser = firstId === user.internalId ? targetUser : user;
    const { runtimeState: firstState } = await loadRuntimeState(client, firstUser, { forUpdate: true });
    const { runtimeState: secondState } = await loadRuntimeState(client, secondUser, { forUpdate: true });
    const challengerRuntime = firstId === user.internalId ? firstState : secondState;
    const targetRuntime = firstId === user.internalId ? secondState : firstState;
    const challengerCity = currentCityId(challengerRuntime);
    const targetCity = currentCityId(targetRuntime);
    if (challengerCity !== targetCity) throw new HttpError(409, "Duels are currently same-city only.", "DUEL_CITY_MISMATCH");

    const now = Date.now();
    const duelId = `duel_${user.publicId}_${targetUser.publicId}_${now}`;
    const challenge = {
      id: duelId,
      status: "pending",
      cityId: challengerCity,
      challenger: { publicId: user.publicId, name: displayName(user) },
      target: { publicId: targetUser.publicId, name: displayName(targetUser) },
      createdAt: now,
    };
    ensureDuelState(challengerRuntime).outgoing[duelId] = challenge;
    ensureDuelState(targetRuntime).incoming[duelId] = challenge;
    await upsertPlayerRuntimeState(client, user.internalId, challengerRuntime);
    await upsertPlayerRuntimeState(client, targetUser.internalId, targetRuntime);
    const playerState = await findPlayerStateByUserInternalId(client, user.internalId);
    return { playerState, duels: serializeDuelState(challengerRuntime), message: `Duel challenge sent to ${displayName(targetUser)}.` };
  });
}

export async function respondToDuelForUser(user, duelId, payload) {
  return withTransaction(async (client) => {
    const action = payload?.action === "decline" ? "decline" : "accept";

    // Ticket A: respondToDuelForUser previously read the target's row
    // (unlocked), found the challenger's identity, then read the
    // challenger's row (also unlocked, always target-then-challenger) -
    // two concurrent accepts of the same challenge could both pass the
    // "challenge.id exists" check before either committed, both resolve
    // combat, both write, with only the timing of pglite/Postgres
    // scheduling deciding which of two different fight outcomes survived
    // (see pvp-fairness-canary.mjs's own re-assessment: its "at most one
    // succeeds" pass was a scheduling artifact, not a code-enforced
    // guarantee). Fixed with a preliminary unlocked peek to discover the
    // challenger's identity (needed before we know what to lock), then
    // both rows locked in canonical order, then a re-check that the
    // challenge still exists in the freshly-locked (not the stale
    // preliminary) target state before doing anything else - a second,
    // truly concurrent accept blocks on the lock, then on waking sees the
    // challenge already gone and 404s correctly instead of racing ahead
    // with stale data.
    const preliminary = await findPlayerStateByUserInternalId(client, user.internalId);
    if (!preliminary) throw new HttpError(404, "Player state unavailable.", "PLAYER_STATE_NOT_FOUND");
    const preliminaryDuels = asRecord(asRecord(buildMutableRuntimeState(user, preliminary).player).duels);
    const preliminaryChallenge = asRecord((preliminaryDuels.incoming ?? {})[duelId]);
    if (!preliminaryChallenge.id) throw new HttpError(404, "Duel challenge not found.", "DUEL_NOT_FOUND");
    const challengerPublicId = Math.floor(asNumber(preliminaryChallenge.challenger?.publicId, 0));
    const challengerUser = await findUserByPublicId(client, challengerPublicId);
    if (!challengerUser) throw new HttpError(404, "Challenger not found.", "DUEL_CHALLENGER_NOT_FOUND");

    const [firstId, secondId] = orderInternalIds(user.internalId, challengerUser.internalId);
    const firstUser = firstId === user.internalId ? user : challengerUser;
    const secondUser = firstId === user.internalId ? challengerUser : user;
    const { runtimeState: firstState } = await loadRuntimeState(client, firstUser, { forUpdate: true });
    const { runtimeState: secondState } = await loadRuntimeState(client, secondUser, { forUpdate: true });
    const targetRuntime = firstId === user.internalId ? firstState : secondState;
    const challengerRuntime = firstId === user.internalId ? secondState : firstState;

    const targetDuels = ensureDuelState(targetRuntime);
    const challenge = asRecord(targetDuels.incoming[duelId]);
    if (!challenge.id) throw new HttpError(404, "Duel challenge not found.", "DUEL_NOT_FOUND");
    const challengerDuels = ensureDuelState(challengerRuntime);
    const now = Date.now();

    if (action !== "decline") {
      if (currentCityId(challengerRuntime) !== currentCityId(targetRuntime)) throw new HttpError(409, "Both players must still be in the same city to duel.", "DUEL_CITY_MISMATCH");
      assertCanStartRealFight(challengerRuntime, "duel");
      assertCanStartRealFight(targetRuntime, "duel");
    }

    delete targetDuels.incoming[duelId];
    delete challengerDuels.outgoing[duelId];

    if (action === "decline") {
      const history = { ...challenge, status: "declined", resolvedAt: now };
      targetDuels.history = [history, ...asArray(targetDuels.history)].slice(0, 20);
      challengerDuels.history = [history, ...asArray(challengerDuels.history)].slice(0, 20);
      await upsertPlayerRuntimeState(client, user.internalId, targetRuntime);
      await upsertPlayerRuntimeState(client, challengerUser.internalId, challengerRuntime);
      const playerState = await findPlayerStateByUserInternalId(client, user.internalId);
      return { playerState, duels: serializeDuelState(targetRuntime), message: "Duel challenge declined." };
    }

    const challengerHealth = asNumber(challengerRuntime.player?.stats?.health, 100);
    const targetHealth = asNumber(targetRuntime.player?.stats?.health, 100);
    const opponent = buildPlayerOpponent(user, targetRuntime);
    const challengerEnergy = spendCombatEnergy(challengerRuntime, "duel", now);
    const targetEnergy = spendCombatEnergy(targetRuntime, "duel", now);
    const baseResult = resolveCombat(challengerRuntime, opponent, { context: "duel", now, playerName: displayName(challengerUser), energyAlreadySpent: challengerEnergy });
    challengerRuntime.player.stats = { ...asRecord(challengerRuntime.player.stats), health: challengerHealth };
    targetRuntime.player.stats = { ...asRecord(targetRuntime.player.stats), health: targetHealth };
    const challengerWon = baseResult.winner === "player";
    const targetCombatXpGained = grantCombatXp(targetRuntime, getCombatXpAward("duel", challengerWon ? "opponent" : "player", opponent), "duel", now);
    const result = {
      ...baseResult,
      participants: {
        challenger: { publicId: challengerUser.publicId, energySpent: challengerEnergy.energySpent, combatXpGained: baseResult.combatXpGained },
        target: { publicId: user.publicId, energySpent: targetEnergy.energySpent, combatXpGained: targetCombatXpGained },
      },
    };
    const winner = challengerWon ? challenge.challenger : challenge.target;
    const loser = challengerWon ? challenge.target : challenge.challenger;
    // result.player is always the challenger's health/maxHealth and
    // result.opponentState is always the target's, regardless of who ends
    // up viewing this history entry later - each side must only ever see
    // their own numbers, never the other real player's.
    const challengerViewResult = redactOpponentHealth(result, { hidePlayerSide: false, hideOpponentSide: true });
    const targetViewResult = redactOpponentHealth(result, { hidePlayerSide: true, hideOpponentSide: false });
    const challengerHistoryEntry = { ...challenge, status: "resolved", acceptedAt: now, resolvedAt: now, winner, loser, result: challengerViewResult };
    const targetHistoryEntry = { ...challenge, status: "resolved", acceptedAt: now, resolvedAt: now, winner, loser, result: targetViewResult };
    challengerDuels.history = [challengerHistoryEntry, ...asArray(challengerDuels.history)].slice(0, 20);
    targetDuels.history = [targetHistoryEntry, ...asArray(targetDuels.history)].slice(0, 20);

    for (const [runtimeState, didWin] of [[challengerRuntime, challengerWon], [targetRuntime, !challengerWon]]) {
      const player = asRecord(runtimeState.player);
      player.counters = {
        ...asRecord(player.counters),
        duelsResolved: Math.max(0, Math.floor(asNumber(player.counters?.duelsResolved, 0))) + 1,
        duelWins: Math.max(0, Math.floor(asNumber(player.counters?.duelWins, 0))) + (didWin ? 1 : 0),
        duelLosses: Math.max(0, Math.floor(asNumber(player.counters?.duelLosses, 0))) + (didWin ? 0 : 1),
        firstDuelAt: player.counters?.firstDuelAt ?? now,
        firstDuelWinAt: didWin ? player.counters?.firstDuelWinAt ?? now : player.counters?.firstDuelWinAt,
      };
      runtimeState.player = player;
      const legacy = asRecord(runtimeState.legacy);
      const visibleEntries = asArray(legacy.visibleEntries);
      legacy.visibleEntries = [
        { id: `duel_${duelId}_${player.publicId}`, title: didWin ? "Duel Victory" : "Duel Defeat", summary: didWin ? `Won a consensual duel in ${challenge.cityId}.` : `Completed a consensual duel in ${challenge.cityId}.`, kind: "duel", awardedAt: now },
        ...visibleEntries,
      ].slice(0, 50);
      runtimeState.legacy = legacy;
    }

    await upsertPlayerRuntimeState(client, challengerUser.internalId, challengerRuntime);
    await upsertPlayerRuntimeState(client, user.internalId, targetRuntime);
    const playerState = await findPlayerStateByUserInternalId(client, user.internalId);
    // user is whoever called this function to accept - the target - so
    // they get the target-viewpoint result (their own health visible, the
    // challenger's redacted). The challenger only ever sees their own
    // viewpoint later via their own duel history.
    return { playerState, duels: serializeDuelState(targetRuntime), result: targetViewResult, message: `${winner.name} won the duel.` };
  });
}
