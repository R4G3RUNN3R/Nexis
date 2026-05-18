import { withTransaction } from "../db/pool.js";
import { HttpError } from "../lib/errors.js";
import { getArenaNpcOpponents, getNpcOpponent } from "../data/combatData.js";
import { buildMutableRuntimeState } from "../lib/runtimePlayerState.js";
import {
  createDefaultPlayerState,
  findPlayerStateByUserInternalId,
  upsertPlayerRuntimeState,
} from "../repositories/playerStateRepository.js";
import { resolveNpcCombatWithRewards } from "./combatService.js";

function asRecord(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : {};
}

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

async function loadRuntimeState(client, user) {
  await createDefaultPlayerState(client, user.internalId);
  const playerState = await findPlayerStateByUserInternalId(client, user.internalId);
  if (!playerState) throw new HttpError(404, "Player state unavailable.", "PLAYER_STATE_NOT_FOUND");
  return { playerState, runtimeState: buildMutableRuntimeState(user, playerState) };
}

function serializeArena(runtimeState) {
  const arena = asRecord(runtimeState.player?.arenaCombat);
  return {
    opponents: getArenaNpcOpponents().map((opponent) => ({
      id: opponent.id,
      name: opponent.name,
      tier: opponent.tier,
      summary: opponent.summary,
      level: opponent.level,
      reward: opponent.reward ?? {},
    })),
    history: asArray(arena.history).slice(0, 12),
    lastResult: arena.lastResult ?? null,
  };
}

export async function getArenaCombatForUser(user) {
  return withTransaction(async (client) => {
    const { playerState, runtimeState } = await loadRuntimeState(client, user);
    return { playerState, arena: serializeArena(runtimeState) };
  });
}

export async function sparArenaOpponentForUser(user, opponentId) {
  return withTransaction(async (client) => {
    const { runtimeState } = await loadRuntimeState(client, user);
    const opponent = getNpcOpponent(opponentId);
    if (!opponent) throw new HttpError(404, "Arena opponent unavailable.", "ARENA_OPPONENT_NOT_FOUND");
    const now = Date.now();
    const result = resolveNpcCombatWithRewards(runtimeState, opponent.id, { context: "arena", now, playerName: `${user.firstName}`.trim() || "You" });
    const player = asRecord(runtimeState.player);
    const arena = asRecord(player.arenaCombat);
    const summary = {
      id: `arena_${opponent.id}_${now}`,
      opponentId: opponent.id,
      opponentName: opponent.name,
      outcome: result.outcome,
      winner: result.winner,
      reward: result.reward,
      skillEvents: result.skillEvents,
      resolvedAt: now,
    };
    player.arenaCombat = {
      ...arena,
      lastResult: result,
      history: [summary, ...asArray(arena.history)].slice(0, 20),
    };
    runtimeState.player = player;
    const playerState = await upsertPlayerRuntimeState(client, user.internalId, runtimeState);
    const nextRuntimeState = buildMutableRuntimeState(user, playerState);
    return { playerState, arena: serializeArena(nextRuntimeState), result, message: result.winner === "player" ? `You defeated ${opponent.name}.` : `${opponent.name} won the spar.` };
  });
}
