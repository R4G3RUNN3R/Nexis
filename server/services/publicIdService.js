import {
  FIRST_PLAYER_NUMERIC_ID,
  PLAYER_PUBLIC_ID_PREFIX,
  PUBLIC_ID_DIGITS,
} from "../config/env.js";
import {
  allocateNextPublicNumericId,
  reservePublicNumericId,
} from "../repositories/publicIdAllocatorRepository.js";

export function formatPlayerPublicId(numericId) {
  return `${PLAYER_PUBLIC_ID_PREFIX}${String(numericId).padStart(PUBLIC_ID_DIGITS, "0")}`;
}

export async function allocatePlayerPublicId(client) {
  return allocateNextPublicNumericId(client, "player", FIRST_PLAYER_NUMERIC_ID);
}

export async function reserveMigratedPlayerPublicId(client, desiredNumericId) {
  if (!Number.isInteger(desiredNumericId) || desiredNumericId < FIRST_PLAYER_NUMERIC_ID) {
    return allocatePlayerPublicId(client);
  }

  return reservePublicNumericId(client, "player", desiredNumericId, FIRST_PLAYER_NUMERIC_ID);
}
