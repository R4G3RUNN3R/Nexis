import {
  FIRST_PLAYER_NUMERIC_ID,
  PLAYER_PUBLIC_ID_PREFIX,
  PUBLIC_ID_DIGITS,
} from "../config/env.js";
import { HttpError } from "../lib/errors.js";
import {
  allocateNextPublicNumericId,
  reservePublicNumericId,
} from "../repositories/publicIdAllocatorRepository.js";

// A public ID display like "P1234567" only reads cleanly with up to
// PUBLIC_ID_DIGITS digits — padStart doesn't truncate, so anything above
// this would silently break the display format. Also doubles as the
// migration-path range ceiling.
const MAX_PLAYER_NUMERIC_ID = 10 ** PUBLIC_ID_DIGITS - 1;

export function formatPlayerPublicId(numericId) {
  return `${PLAYER_PUBLIC_ID_PREFIX}${String(numericId).padStart(PUBLIC_ID_DIGITS, "0")}`;
}

export async function allocatePlayerPublicId(client) {
  return allocateNextPublicNumericId(client, "player", FIRST_PLAYER_NUMERIC_ID);
}

export function isValidMigratedPublicId(value) {
  return (
    Number.isSafeInteger(value) &&
    value >= FIRST_PLAYER_NUMERIC_ID &&
    value <= MAX_PLAYER_NUMERIC_ID
  );
}

export function assertValidMigratedPublicId(value) {
  if (!isValidMigratedPublicId(value)) {
    throw new HttpError(
      400,
      `Migrated public ID must be a safe integer between ${FIRST_PLAYER_NUMERIC_ID} and ${MAX_PLAYER_NUMERIC_ID}.`,
      "INVALID_MIGRATED_PUBLIC_ID",
    );
  }
}

// Internal-only. Not wired to any public route — see createMigratedPlayerAccount
// in authService.js for the only (non-HTTP-reachable) caller. Strict
// safe-integer + range validation here is defense in depth: even a future
// misused internal caller cannot corrupt the allocator with an unsafe or
// out-of-format value.
export async function reserveMigratedPlayerPublicId(client, desiredNumericId) {
  assertValidMigratedPublicId(desiredNumericId);
  return reservePublicNumericId(client, "player", desiredNumericId, FIRST_PLAYER_NUMERIC_ID);
}
