import { HttpError } from "../lib/errors.js";

function isUniqueViolation(error) {
  return Boolean(error && (error.code === "23505" || String(error.message ?? "").includes("unique")));
}

// Ticket A: records a periodic entitlement consumption. Relies entirely on
// the player_entitlement_consumptions unique constraints
// (user_internal_id, entitlement_key, period_key) and (session_id) - this
// function does not itself decide whether the caller is "allowed" to
// consume the entitlement (that's the caller's business-rule check, done
// under the player row lock); it is the database-enforced backstop that
// makes "at most once per period" true even under genuine concurrent
// requests, retries, or multiple tabs.
//
// Returns { created: true, row } on a fresh consumption, or
// { created: false, row } if a row with this exact sessionId already
// exists (idempotent replay - the caller should treat this as "already
// done, here is what happened" rather than an error). Throws
// ENTITLEMENT_ALREADY_CONSUMED (409) if the (user, entitlement, period)
// pair is already consumed under a *different* sessionId - a genuine
// conflicting reuse, not a safe replay.
export async function recordEntitlementConsumption(client, { userInternalId, entitlementKey, periodKey, sessionId, metadata = {} }) {
  const existingBySession = await client.query(
    `SELECT id, user_internal_id, entitlement_key, period_key, session_id, consumed_at, metadata
       FROM player_entitlement_consumptions WHERE session_id = $1`,
    [sessionId],
  );
  if (existingBySession.rows[0]) {
    return { created: false, row: mapRow(existingBySession.rows[0]) };
  }

  try {
    const result = await client.query(
      `INSERT INTO player_entitlement_consumptions (user_internal_id, entitlement_key, period_key, session_id, metadata)
         VALUES ($1, $2, $3, $4, $5::jsonb)
         RETURNING id, user_internal_id, entitlement_key, period_key, session_id, consumed_at, metadata`,
      [userInternalId, entitlementKey, periodKey, sessionId, JSON.stringify(metadata)],
    );
    return { created: true, row: mapRow(result.rows[0]) };
  } catch (error) {
    if (isUniqueViolation(error)) {
      throw new HttpError(409, "This entitlement has already been used for the current period.", "ENTITLEMENT_ALREADY_CONSUMED");
    }
    throw error;
  }
}

export async function findEntitlementConsumption(client, { userInternalId, entitlementKey, periodKey }) {
  const result = await client.query(
    `SELECT id, user_internal_id, entitlement_key, period_key, session_id, consumed_at, metadata
       FROM player_entitlement_consumptions
       WHERE user_internal_id = $1 AND entitlement_key = $2 AND period_key = $3`,
    [userInternalId, entitlementKey, periodKey],
  );
  return result.rows[0] ? mapRow(result.rows[0]) : null;
}

function mapRow(row) {
  return {
    id: Number(row.id),
    userInternalId: row.user_internal_id,
    entitlementKey: row.entitlement_key,
    periodKey: row.period_key,
    sessionId: row.session_id,
    consumedAt: row.consumed_at ? new Date(row.consumed_at).getTime() : null,
    metadata: row.metadata ?? {},
  };
}
