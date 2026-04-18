import { withTransaction } from "../db/pool.js";
import {
  createDefaultPlayerState,
  upsertPlayerRuntimeState,
} from "../repositories/playerStateRepository.js";
import { HttpError } from "../lib/errors.js";

function asRecord(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : null;
}

export async function syncRuntimeState(userInternalId, runtimeState) {
  const payload = asRecord(runtimeState);
  if (!payload) {
    throw new HttpError(400, "Runtime state payload is required.", "RUNTIME_STATE_REQUIRED");
  }

  return withTransaction(async (client) => {
    await createDefaultPlayerState(client, userInternalId);
    return upsertPlayerRuntimeState(client, userInternalId, payload);
  });
}
