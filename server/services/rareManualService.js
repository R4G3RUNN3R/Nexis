function asRecord(value) { return value && typeof value === "object" && !Array.isArray(value) ? value : {}; }
function asNumber(value, fallback = 0) { const numeric = Number(value); return Number.isFinite(numeric) ? numeric : fallback; }

export const RARE_MANUAL_BANDS = [
  { tier: 1, minLevel: 5, label: "Tier I", name: "rare primer manuals" },
  { tier: 2, minLevel: 10, label: "Tier II", name: "advanced rare manuals" },
  { tier: 3, minLevel: 15, label: "Tier III", name: "elite rare manuals" },
  { tier: 4, minLevel: 20, label: "Tier IV", name: "master rare manuals" },
  { tier: 5, minLevel: 25, label: "Legendary", name: "legendary manuals" },
];

export const RARE_MANUALS = [
  { id: "manual_ordered_steel_forms", tier: 1, cityId: "nexis", family: "Melee", title: "Ordered Steel Forms", source: "Nexis City watch archives", acquisition: ["academy archives", "city board civic notices", "marketplace"] },
  { id: "manual_blackharbor_blind_manifest", tier: 1, cityId: "west", family: "Rogue / Shadow", title: "Blind Manifest", source: "Blackharbor under-market", acquisition: ["black market", "smuggler caches", "board rumors"] },
  { id: "manual_silverbough_ley_salve", tier: 1, cityId: "north", family: "Support / Utility", title: "Ley-Salve Method", source: "Silverbough hospice shelves", acquisition: ["hidden shrines", "academy archives", "marketplace"] },
  { id: "manual_forge_line_breaker", tier: 2, cityId: "east", family: "Melee", title: "Forge-Line Breaker", source: "Ironhall war school", acquisition: ["forge wrecks", "elite drops", "academy archives"] },
  { id: "manual_corsair_storm_angle", tier: 2, cityId: "west", family: "Ranged", title: "Storm-Angle Corsair Drill", source: "Blackharbor corsair yards", acquisition: ["pirate elites", "black market", "expeditions"] },
  { id: "manual_quiet_court_pressure", tier: 2, cityId: "south", family: "Support / Utility", title: "Quiet Court Pressure", source: "Highcourt statecraft circles", acquisition: ["court brokerage", "academy archives", "marketplace"] },
  { id: "manual_argent_chain_current", tier: 3, cityId: "north", family: "Arcane", title: "Argent Chain Current", source: "Argent Bough Lyceum", acquisition: ["relic guardians", "hidden survey sites", "academy archives"] },
  { id: "manual_nightwake_phantom_tithe", tier: 3, cityId: "west", family: "Rogue / Shadow", title: "Phantom Tithe", source: "Nightwake Lodge", acquisition: ["black-route discoveries", "boss drops", "under-market whispers"] },
  { id: "manual_sunspire_command_writ", tier: 4, cityId: "south", family: "Support / Utility", title: "Sunspire Command Writ", source: "Sunspire Institute", acquisition: ["world events", "court bosses", "academy archives"] },
  { id: "manual_furnace_bastion", tier: 4, cityId: "east", family: "Melee", title: "Furnace Bastion", source: "Red Anvil War School", acquisition: ["Furnace Beast", "elite expeditions", "marketplace"] },
  { id: "manual_civic_sovereign_pattern", tier: 5, cityId: "nexis", family: "Support / Utility", title: "Civic Sovereign Pattern", source: "sealed Nexis archive", acquisition: ["world bosses", "sealed archives", "legendary market listings"] },
];

export function getRareManualEligibility(runtimeState) {
  const level = Math.max(1, Math.floor(asNumber(asRecord(runtimeState.player).level, 1)));
  const eligibleBands = RARE_MANUAL_BANDS.filter((band) => level >= band.minLevel);
  const highestTier = eligibleBands.reduce((max, band) => Math.max(max, band.tier), 0);
  const nextBand = RARE_MANUAL_BANDS.find((band) => level < band.minLevel) ?? null;
  return {
    level,
    highestEligibleTier: highestTier,
    eligibleBands,
    nextBand,
    rule: "Levels unlock eligibility only. Rare books and manuals must still be found, bought, looted, discovered, or traded.",
    manuals: RARE_MANUALS.map((manual) => ({
      ...manual,
      eligible: level >= (RARE_MANUAL_BANDS.find((band) => band.tier === manual.tier)?.minLevel ?? 999),
      lockReason: level >= (RARE_MANUAL_BANDS.find((band) => band.tier === manual.tier)?.minLevel ?? 999) ? null : `Reach level ${RARE_MANUAL_BANDS.find((band) => band.tier === manual.tier)?.minLevel ?? "?"} to become eligible for ${manual.title}.`,
    })),
  };
}

export function getRareManualUnlockSummary(level) {
  const exact = RARE_MANUAL_BANDS.filter((band) => Number(level) === band.minLevel);
  if (!exact.length) return [];
  return exact.map((band) => `${band.label} rare manual eligibility unlocked; books are still acquired through play.`);
}
