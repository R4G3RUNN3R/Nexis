import { recordEntitlementConsumption, findEntitlementConsumption } from "../repositories/playerEntitlementRepository.js";

// Ticket A: server-calculated entitlement period, never client-supplied.
// Calendar-month granularity in UTC - "2026-07" - matches the "monthly"
// framing used throughout the one-shot/donor-entitlement briefs. Exported
// so callers (and tests) can compute the same key a caller-supplied
// timestamp would fall into without duplicating this logic.
export function getCurrentEntitlementPeriodKey(now = Date.now()) {
  const date = new Date(now);
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  return `${year}-${month}`;
}

// Consumes one entitlement slot for (user, entitlementKey, current period).
// Backed entirely by player_entitlement_consumptions' unique constraints -
// this function does not itself decide eligibility (donor tier, staff-test
// isolation, etc.); the caller must check that *before* calling this,
// under the same transaction/row lock as the rest of its mutation, and
// treat this call as the final, database-enforced "has this already been
// used" gate. sessionId must be a stable identifier generated once per
// completion attempt by the caller (not regenerated on retry) so a
// network retry of the exact same attempt replays safely instead of being
// treated as a second, conflicting use.
export async function consumeMonthlyEntitlement(client, user, { entitlementKey, sessionId, periodKey, metadata = {} }) {
  const resolvedPeriodKey = periodKey ?? getCurrentEntitlementPeriodKey();
  const { created, row } = await recordEntitlementConsumption(client, {
    userInternalId: user.internalId,
    entitlementKey,
    periodKey: resolvedPeriodKey,
    sessionId,
    metadata,
  });
  return { created, consumption: row, periodKey: resolvedPeriodKey };
}

export async function hasConsumedMonthlyEntitlement(client, user, { entitlementKey, periodKey }) {
  const resolvedPeriodKey = periodKey ?? getCurrentEntitlementPeriodKey();
  const existing = await findEntitlementConsumption(client, {
    userInternalId: user.internalId,
    entitlementKey,
    periodKey: resolvedPeriodKey,
  });
  return Boolean(existing);
}
