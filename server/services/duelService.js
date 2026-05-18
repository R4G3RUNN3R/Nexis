import { withTransaction } from "../db/pool.js";
import { HttpError } from "../lib/errors.js";
import { buildMutableRuntimeState } from "../lib/runtimePlayerState.js";
import {
  createDefaultPlayerState,
  findPlayerStateByUserInternalId,
  upsertPlayerRuntimeState,
} from "../repositories/playerStateRepository.js";
import { findUserByPublicId } from "../repositories/usersRepository.js";
import { resolveCombat } from "./combatService.js";

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

async function loadRuntimeState(client, user) {
  await createDefaultPlayerState(client, user.internalId);
  const playerState = await findPlayerStateByUserInternalId(client, user.internalId);
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

function buildPlayerOpponent(user, runtimeState) {
  const player = asRecord(runtimeState.player);
  const stats = asRecord(player.stats);
  const battle = asRecord(player.battleStats);
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

    const { runtimeState: challengerRuntime } = await loadRuntimeState(client, user);
    const { runtimeState: targetRuntime } = await loadRuntimeState(client, targetUser);
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
    const { runtimeState: targetRuntime } = await loadRuntimeState(client, user);
    const targetDuels = ensureDuelState(targetRuntime);
    const challenge = asRecord(targetDuels.incoming[duelId]);
    if (!challenge.id) throw new HttpError(404, "Duel challenge not found.", "DUEL_NOT_FOUND");
    const challengerPublicId = Math.floor(asNumber(challenge.challenger?.publicId, 0));
    const challengerUser = await findUserByPublicId(client, challengerPublicId);
    if (!challengerUser) throw new HttpError(404, "Challenger not found.", "DUEL_CHALLENGER_NOT_FOUND");
    const { runtimeState: challengerRuntime } = await loadRuntimeState(client, challengerUser);
    const challengerDuels = ensureDuelState(challengerRuntime);
    const now = Date.now();

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

    if (currentCityId(challengerRuntime) !== currentCityId(targetRuntime)) throw new HttpError(409, "Both players must still be in the same city to duel.", "DUEL_CITY_MISMATCH");
    const challengerHealth = asNumber(challengerRuntime.player?.stats?.health, 100);
    const targetHealth = asNumber(targetRuntime.player?.stats?.health, 100);
    const opponent = buildPlayerOpponent(user, targetRuntime);
    const result = resolveCombat(challengerRuntime, opponent, { context: "duel", now, playerName: displayName(challengerUser) });
    challengerRuntime.player.stats = { ...asRecord(challengerRuntime.player.stats), health: challengerHealth };
    targetRuntime.player.stats = { ...asRecord(targetRuntime.player.stats), health: targetHealth };
    const challengerWon = result.winner === "player";
    const winner = challengerWon ? challenge.challenger : challenge.target;
    const loser = challengerWon ? challenge.target : challenge.challenger;
    const history = {
      ...challenge,
      status: "resolved",
      acceptedAt: now,
      resolvedAt: now,
      winner,
      loser,
      result,
    };
    challengerDuels.history = [history, ...asArray(challengerDuels.history)].slice(0, 20);
    targetDuels.history = [history, ...asArray(targetDuels.history)].slice(0, 20);

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
    return { playerState, duels: serializeDuelState(targetRuntime), result, message: `${winner.name} won the duel.` };
  });
}
