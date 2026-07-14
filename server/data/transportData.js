// Transport tiers for the travel system.
//
// Source of truth for this feature is docs/roadmaps/nexis-travel-vehicles-and-trade-roadmap.md.
// That roadmap describes a much larger eventual system (craftable vehicles, upgrade slots,
// skill-discounted crafting/upgrading, a Transportation vendor, persistent stable ownership).
// This file implements Phase 1 (taxonomy) and enough of Phase 2 (starter catalog) to support
// Phase 3 (travel integration): tiers are rented per-journey for gold rather than owned assets,
// since no stable/vehicle-ownership system exists yet anywhere in the codebase (checked for
// "stable", "vehicle", "mount" — nothing). Persistent ownership, crafting, and upgrade slots are
// intentionally deferred; see the roadmap's Phase 2/5 for that follow-on work.

export const DEFAULT_TRANSPORT_TIER_ID = "caravan";

export const TRANSPORT_TIERS = [
  {
    id: "foot",
    name: "On Foot",
    category: "baseline",
    subtype: "Unassisted Travel",
    terrainType: "land",
    travelSpeedModifier: 1.35,
    cargoCapacity: 10,
    passengerCapacity: 1,
    dangerModifier: 0.06,
    goldCost: 0,
    summary: "No animal, no cart, no cover. Slow and exposed, but always available.",
  },
  {
    id: "donkey",
    name: "Donkey",
    category: "animal",
    subtype: "Personal Travel Animal",
    terrainType: "land",
    travelSpeedModifier: 1.05,
    cargoCapacity: 50,
    passengerCapacity: 1,
    dangerModifier: 0,
    goldCost: 35,
    summary: "A stable early pack animal. Modest cargo, honest pace, low fuss.",
  },
  {
    id: "riding_horse",
    name: "Riding Horse",
    category: "animal",
    subtype: "Personal Travel Animal",
    terrainType: "land",
    travelSpeedModifier: 0.72,
    cargoCapacity: 30,
    passengerCapacity: 1,
    dangerModifier: -0.05,
    goldCost: 110,
    summary: "Fast and evasive on the road, but built for a rider, not a hold full of freight.",
  },
  {
    id: "cart",
    name: "Cart",
    category: "vehicle",
    subtype: "Light Vehicle",
    terrainType: "land",
    travelSpeedModifier: 0.95,
    cargoCapacity: 150,
    passengerCapacity: 1,
    dangerModifier: 0.02,
    goldCost: 80,
    summary: "Basic hauling for local trade loops. Slower and more visible than an animal alone.",
  },
  {
    id: "caravan",
    name: "Caravan",
    category: "vehicle",
    subtype: "Hired Caravan",
    terrainType: "land",
    travelSpeedModifier: 1,
    cargoCapacity: 110,
    passengerCapacity: 2,
    dangerModifier: 0,
    goldCost: 55,
    default: true,
    summary: "The standard hired caravan run. Balanced pace, balanced risk, no ownership required.",
  },
  {
    id: "wagon",
    name: "Wagon",
    category: "vehicle",
    subtype: "Heavy Vehicle",
    terrainType: "land",
    travelSpeedModifier: 0.9,
    cargoCapacity: 350,
    passengerCapacity: 2,
    dangerModifier: -0.03,
    goldCost: 220,
    summary: "The overland trade backbone. Slower to arrange, but built to move real freight safely.",
  },
  {
    id: "ship",
    name: "Ship",
    category: "vehicle",
    subtype: "Water Transport",
    terrainType: "water",
    travelSpeedModifier: 0.6,
    landSpeedPenalty: 1.4,
    cargoCapacity: 600,
    passengerCapacity: 4,
    dangerModifier: -0.04,
    landDangerPenalty: 0.05,
    goldCost: 380,
    summary: "Regional and intercity water trade. Best on sea and mixed lanes, awkward dragged overland.",
  },
];

export function listTransportTiers() {
  return TRANSPORT_TIERS.map((tier) => ({ ...tier }));
}

export function getTransportTier(tierId) {
  const id = typeof tierId === "string" ? tierId.trim().toLowerCase() : "";
  if (!id) return null;
  const tier = TRANSPORT_TIERS.find((entry) => entry.id === id);
  return tier ? { ...tier } : null;
}

export function getDefaultTransportTier() {
  return getTransportTier(DEFAULT_TRANSPORT_TIER_ID) ?? { ...TRANSPORT_TIERS[0] };
}

// Ships are fast on water and clumsy dragged over pure road routes; every other tier's
// speed modifier is flat regardless of route type (Phase 3 keeps this simple on purpose).
export function resolveTransportSpeedModifier(tier, routeType) {
  if (!tier) return 1;
  if (tier.id === "ship") {
    return routeType === "sea" || routeType === "mixed" ? tier.travelSpeedModifier : tier.landSpeedPenalty ?? tier.travelSpeedModifier;
  }
  return typeof tier.travelSpeedModifier === "number" ? tier.travelSpeedModifier : 1;
}

export function resolveTransportDangerModifier(tier, routeType) {
  if (!tier) return 0;
  let modifier = typeof tier.dangerModifier === "number" ? tier.dangerModifier : 0;
  if (tier.id === "ship" && routeType === "road") {
    modifier += tier.landDangerPenalty ?? 0;
  }
  return modifier;
}

// Hired NPC escort. The roadmap only sketches "escort systems" as a later-phase idea
// (no multiplayer/party escort concept exists anywhere in the codebase), so this is a
// simple gold-for-safety hire rather than an invented party system.
export const ESCORT_OPTION = {
  id: "hired_guard",
  name: "Hired Guard Escort",
  summary: "Pay a route-savvy guard to ride along, cutting encounter risk and softening whatever gets through.",
  baseGoldCost: 60,
  dangerGoldFactor: 200,
  capacityGoldFactor: 0.15,
  dangerReduction: 0.12,
  penaltyMitigation: 0.4,
  delayMitigation: 0.4,
  cargoLossMitigation: 0.4,
};

export function calculateEscortCost(routeDanger, tier) {
  const danger = Math.max(0, Math.min(1, Number(routeDanger) || 0));
  const capacity = Math.max(0, Number(tier?.cargoCapacity) || 0);
  return Math.round(
    ESCORT_OPTION.baseGoldCost + danger * ESCORT_OPTION.dangerGoldFactor + capacity * ESCORT_OPTION.capacityGoldFactor,
  );
}
