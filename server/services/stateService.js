import { withTransaction } from "../db/pool.js";
import {
  createDefaultPlayerState,
  findPlayerStateByUserInternalId,
  upsertPlayerRuntimeState,
} from "../repositories/playerStateRepository.js";
import { HttpError } from "../lib/errors.js";
import { findUserByInternalId } from "../repositories/usersRepository.js";
import { buildMutableRuntimeState } from "../lib/runtimePlayerState.js";

function asRecord(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : null;
}

function asWholeNumber(value, fallback = 0) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return fallback;
  return Math.max(0, Math.floor(numeric));
}

const RECOVERY_STAT_KEYS = [
  "energy",
  "maxEnergy",
  "stamina",
  "maxStamina",
  "health",
  "maxHealth",
  "comfort",
  "maxComfort",
];

function readBarRevision(playerRecord) {
  const counters = asRecord(playerRecord?.counters) ?? {};
  return asWholeNumber(counters.barRevision, 0);
}

function mergeRuntimeState(existingRuntime, payload) {
  const existingPlayer = asRecord(existingRuntime.player) ?? {};
  const payloadPlayer = asRecord(payload.player) ?? {};
  const existingCurrent = asRecord(existingPlayer.current) ?? {};
  const payloadCurrent = asRecord(payloadPlayer.current) ?? {};

  const existingRevision = readBarRevision(existingPlayer);
  const incomingRevision = readBarRevision(payloadPlayer);
  const preserveRecoveredBars = existingRevision > incomingRevision;

  const existingStats = asRecord(existingPlayer.stats) ?? {};
  const payloadStats = asRecord(payloadPlayer.stats) ?? {};
  const mergedStats = {
    ...existingStats,
    ...payloadStats,
  };

  if (preserveRecoveredBars) {
    for (const key of RECOVERY_STAT_KEYS) {
      if (Object.prototype.hasOwnProperty.call(existingStats, key)) {
        mergedStats[key] = existingStats[key];
      }
    }
  }

  const existingCounters = asRecord(existingPlayer.counters) ?? {};
  const payloadCounters = asRecord(payloadPlayer.counters) ?? {};
  const mergedCounters = {
    ...existingCounters,
    ...payloadCounters,
  };

  if (preserveRecoveredBars) {
    mergedCounters.barRevision = existingRevision;
  }

  return {
    ...existingRuntime,
    ...payload,
    player: {
      ...existingPlayer,
      ...payloadPlayer,
      current: {
        ...existingCurrent,
        ...payloadCurrent,
      },
      stats: mergedStats,
      counters: mergedCounters,
      inventory: existingPlayer.inventory ?? payloadPlayer.inventory ?? {},
      equipment: existingPlayer.equipment ?? payloadPlayer.equipment ?? {},
      itemBuffs: existingPlayer.itemBuffs ?? payloadPlayer.itemBuffs ?? {},
      portrait: existingPlayer.portrait ?? {},
    },
    // These are server-authoritative now. The browser can report state around
    // them, but it does not get to overwrite them.
    guild: existingRuntime.guild ?? {},
    consortium: existingRuntime.consortium ?? {},
    travel: existingRuntime.travel ?? {},
    civicEmployment: existingRuntime.civicEmployment ?? {},
    legacy: existingRuntime.legacy ?? {},
  };
}

export async function syncRuntimeState(userInternalId, runtimeState) {
  const payload = asRecord(runtimeState);
  if (!payload) {
    throw new HttpError(400, "Runtime state payload is required.", "RUNTIME_STATE_REQUIRED");
  }

  return withTransaction(async (client) => {
    await createDefaultPlayerState(client, userInternalId);
    const user = await findUserByInternalId(client, userInternalId);
    const existingPlayerState = await findPlayerStateByUserInternalId(client, userInternalId);
    const existingRuntime = user && existingPlayerState
      ? buildMutableRuntimeState(user, existingPlayerState)
      : {};
    const mergedPayload = mergeRuntimeState(existingRuntime, payload);
    return upsertPlayerRuntimeState(client, userInternalId, mergedPayload);
  });
}
