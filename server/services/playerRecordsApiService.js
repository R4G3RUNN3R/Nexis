import { withTransaction } from "../db/pool.js";
import { HttpError } from "../lib/errors.js";
import { buildMutableRuntimeState } from "../lib/runtimePlayerState.js";
import { createDefaultPlayerState, findPlayerStateByUserInternalId, upsertPlayerRuntimeState } from "../repositories/playerStateRepository.js";
import { acknowledgeProgressionEvent, getPlayerRecords, serializeRecordSummary } from "./playerRecordsService.js";
import { normalizeProgressionState, serializeProgression } from "./progressionService.js";

async function loadRuntime(client, user) {
  await createDefaultPlayerState(client, user.internalId);
  const playerState = await findPlayerStateByUserInternalId(client, user.internalId);
  if (!playerState) throw new HttpError(404, "Player state unavailable.", "PLAYER_STATE_NOT_FOUND");
  return buildMutableRuntimeState(user, playerState);
}

export async function getRecordsForUser(user, { category = null, limit = 120 } = {}) {
  return withTransaction(async (client) => {
    const runtimeState = await loadRuntime(client, user);
    normalizeProgressionState(runtimeState);
    const playerState = await upsertPlayerRuntimeState(client, user.internalId, runtimeState);
    return { playerState, records: getPlayerRecords(runtimeState, { category, limit }), summary: serializeRecordSummary(runtimeState), progression: serializeProgression(runtimeState) };
  });
}

export async function acknowledgeProgressionForUser(user, eventId) {
  return withTransaction(async (client) => {
    const runtimeState = await loadRuntime(client, user);
    const acknowledged = acknowledgeProgressionEvent(runtimeState, eventId || "all");
    if (!acknowledged) throw new HttpError(404, "Progression event not found.", "PROGRESSION_EVENT_NOT_FOUND");
    const playerState = await upsertPlayerRuntimeState(client, user.internalId, runtimeState);
    return { playerState, acknowledged, summary: serializeRecordSummary(runtimeState), progression: serializeProgression(runtimeState) };
  });
}
