// "City Crisis" system data - the real, triggered, shared-state counterpart to
// two dormant flavor-only exports elsewhere in the codebase:
//   - worldProgressionData.js's WORLD_EVENT_TEMPLATES (per-player seen/completed
//     tracking that is never written anywhere - dead scaffold)
//   - liveWorldData.js's CITY_THREAT_EVENTS/WORLD_BOSS_EVENTS (a purely
//     deterministic day-of-month rotation, same value for every player in a
//     city on a given day, zero persistence - decorative flavor text)
// This file's templates deliberately reuse those two arrays' existing
// city<->theme pairings and antagonist names for continuity, but the
// CITY_CRISIS_TEMPLATES/city_events state here is the first version of any of
// this that actually triggers from real gameplay outcomes and has real effects
// (shops blocked, players "burned"). Never write to city_events from anywhere
// that also touches WORLD_EVENT_TEMPLATES/WORLD_BOSS_EVENTS state, and vice
// versa - they are intentionally separate systems.

export const CITY_CRISIS_TEMPLATES = [
  {
    id: "nexis-raider-muster",
    cityId: "nexis",
    label: "Tunnel Raider Muster",
    antagonist: "the Tunnel Raider Captain",
    summary: "A failed watch response let the Tunnel Raider Captain muster a full raiding party under the registry district.",
    blocksShops: true,
  },
  {
    id: "west-corsair-pressure",
    cityId: "west",
    label: "Corsair Pressure",
    antagonist: "the Shadow Coast Corsair Chief",
    summary: "The Shadow Coast Corsair Chief's fleet is running the piers, and dock crews have pulled their shutters.",
    blocksShops: true,
  },
  {
    id: "north-wardfall",
    cityId: "north",
    label: "Wardfall",
    antagonist: "a ward-drake loosed from the Grove Guardian's old bindings",
    summary: "The Ward-Broken Grove Guardian's bindings finally gave, and a ward-drake is loose over the grove paths.",
    blocksShops: true,
  },
  {
    id: "east-furnace-beast",
    cityId: "east",
    label: "Furnace Beast",
    antagonist: "the Furnace Beast",
    summary: "The Furnace Beast broke containment and is tearing through the foundry district.",
    blocksShops: true,
  },
  {
    id: "south-legal-emergency",
    cityId: "south",
    label: "Legal Emergency",
    antagonist: "the Court Champion Elite",
    summary: "The Court Champion Elite broke a formal binding and is running loose through the court district.",
    blocksShops: true,
  },
];

export function getCityCrisisTemplate(cityId) {
  return CITY_CRISIS_TEMPLATES.find((entry) => entry.cityId === cityId) ?? null;
}

// Duration by severity. Cooldown is a single flat constant regardless of
// severity - the simplest thing to reason about; total dead-air per city
// after a crisis is duration + CITY_EVENT_COOLDOWN_MS (9h moderate, 12h major).
export const CITY_EVENT_SEVERITY_PROFILES = {
  moderate: { durationMs: 3 * 60 * 60 * 1000 },
  major: { durationMs: 6 * 60 * 60 * 1000 },
};
export const CITY_EVENT_COOLDOWN_MS = 6 * 60 * 60 * 1000;

export function getSeverityProfile(severity) {
  return CITY_EVENT_SEVERITY_PROFILES[severity] ?? CITY_EVENT_SEVERITY_PROFILES.moderate;
}

// Only a true defeat (not a draw) on elite_hunt-tier solo content can trigger
// a crisis - routine local_contract losses never should. Flat chance/severity
// since a solo loss is proportionally smaller than a whole guild's failed
// operation (see GUILD_QUEST_TRIGGER_TIERS below).
export const ADVENTURE_ELITE_HUNT_TRIGGER = { chance: 0.35, severity: "moderate" };

// Checked top-down against a guild quest's powerFloor, first match wins.
// Anything below 180 (the three easiest GUILD_QUESTS templates) never
// triggers - those are entry-tier ops, not "the guild failed to tame a
// dragon." The hardest two templates (340+) get a higher chance/severity
// than the mid tier, since a whole guild failing its longest-planned
// (144-168h) operation is a materially bigger in-fiction event.
export const GUILD_QUEST_TRIGGER_TIERS = [
  { minPowerFloor: 340, chance: 0.7, severity: "major" },
  { minPowerFloor: 180, chance: 0.55, severity: "moderate" },
];

export function getGuildQuestTriggerTier(powerFloor) {
  const floor = Number(powerFloor) || 0;
  return GUILD_QUEST_TRIGGER_TIERS.find((tier) => floor >= tier.minPowerFloor) ?? null;
}

// "Burned": a one-time, guaranteed-visible flat hit (not an ongoing per-tick
// debuff - see server/services/cityEventService.js for why) plus a durable
// player.condition marker capped well under hospitalization's ceiling.
export const BURN_EFFECT = {
  healthPct: 0.2,
  energyFlat: 15,
  normalCapMs: 2 * 60 * 60 * 1000,
  absoluteCapMs: 6 * 60 * 60 * 1000,
};
