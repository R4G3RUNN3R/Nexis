// Cross-cutting reader for consortium star-tier passive perks.
//
// Other services (cityEconomyService.js, itemAdvancedService.js) need to know "is this player in a
// consortium, of what type, at what star tier" without paying for an organization DB lookup on every
// city-market purchase or crafting action. That snapshot is already cached on the player's own runtime
// state at runtimeState.consortium.membership (kept in sync by organizationService.js's
// syncMembershipSummary(), which runs on founding, application acceptance, daily CP claim, and reward
// redemption) -- the same pattern education passives already use via runtimeState.education. This module
// just reads that cached snapshot and turns it into the effect bundle from consortiumTypes.js.
import { getConsortiumPassiveEffectBundle, getScopedConsortiumEffectPct } from "../data/consortiumTypes.js";

function asRecord(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : {};
}

const NEUTRAL_MEMBERSHIP = { consortiumTypeKey: null, starRating: 0, organizationInternalId: null };

export function getConsortiumMembershipSnapshot(runtimeState) {
  const membership = asRecord(asRecord(runtimeState?.consortium).membership);
  if (typeof membership.consortiumTypeKey !== "string" || !membership.consortiumTypeKey) return NEUTRAL_MEMBERSHIP;
  return {
    consortiumTypeKey: membership.consortiumTypeKey,
    starRating: Number.isFinite(Number(membership.starRating)) ? Number(membership.starRating) : 0,
    organizationInternalId: typeof membership.organizationInternalId === "string" ? membership.organizationInternalId : null,
  };
}

// Real, computed-from-live-membership perk bundle for the player's own runtime state. Empty object if
// the player isn't in a consortium (or the type key on record no longer resolves to a definition).
export function getConsortiumPassiveEffectsForRuntime(runtimeState) {
  const snapshot = getConsortiumMembershipSnapshot(runtimeState);
  if (!snapshot.consortiumTypeKey) return {};
  return getConsortiumPassiveEffectBundle(snapshot.consortiumTypeKey, snapshot.starRating);
}

export function getConsortiumEffectPctForRuntime(runtimeState, effectKey, categoryOrTag = null) {
  const bundle = getConsortiumPassiveEffectsForRuntime(runtimeState);
  return getScopedConsortiumEffectPct(bundle, effectKey, categoryOrTag);
}

export { getScopedConsortiumEffectPct };
