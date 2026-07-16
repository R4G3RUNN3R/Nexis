export const EXCURSION_GRID = {
  columns: 16,
  rows: 10,
  boxTravelMs: 25 * 60 * 1000,
  localMinimumTravelMs: 15 * 60 * 1000,
  exploreMs: 60 * 60 * 1000,
};

export const CITY_EXCURSION_ORIGINS = {
  nexis: { x: 7, y: 5, label: "Nexis City box" },
  west: { x: 2, y: 3, label: "Blackharbor box" },
  north: { x: 7, y: 1, label: "Silverbough box" },
  east: { x: 11, y: 4, label: "Ironhall box" },
  south: { x: 8, y: 5, label: "Highcourt box" },
};

const GRADE_PROFILE = {
  epic: { recipeFragmentChance: 0.18, recipeDirectChance: 0.03, fragmentTarget: 3 },
  legendary: { recipeFragmentChance: 0.08, recipeDirectChance: 0.008, fragmentTarget: 5 },
  mythic: { recipeFragmentChance: 0.035, recipeDirectChance: 0.002, fragmentTarget: 8 },
};

export const EXCURSION_REWARD_CHANCES = {
  materialChance: 0.72,
  knowledgeChance: 0.28,
  skillFragmentChance: 0.09,
  magicFragmentChance: 0.07,
  absoluteFragmentChance: 0.03,
  itemPieceChance: 0.02,
  rareItemChance: 0.001,
  trainingBookChance: 0.012,
  ...GRADE_PROFILE,
};

function loc(input) {
  const grade = input.recipeGrade ?? "epic";
  return {
    id: input.id,
    name: input.name,
    type: input.type,
    regionId: input.regionId,
    box: input.box,
    xPercent: input.xPercent,
    yPercent: input.yPercent,
    riskBand: input.riskBand,
    summary: input.summary,
    rewardFocus: input.rewardFocus ?? [],
    recipeGrade: grade,
    recipeId: input.recipeId ?? null,
    recipeFragmentTarget: input.recipeFragmentTarget ?? GRADE_PROFILE[grade]?.fragmentTarget ?? 3,
    materialDrops: input.materialDrops ?? [],
    rareItems: input.rareItems ?? [],
    itemPieces: input.itemPieces ?? [],
    skillFragments: input.skillFragments ?? [],
    magicFragments: input.magicFragments ?? [],
    trainingBooks: input.trainingBooks ?? [],
    absoluteFragment: Boolean(input.absoluteFragment),
    requiredCourses: input.requiredCourses ?? [],
    tags: input.tags ?? [],
    cityAffinity: input.cityAffinity ?? [],
    goldRange: input.goldRange ?? [18, 80],
    knowledgeRange: input.knowledgeRange ?? [1, 3],
  };
}

export const EXCURSION_LOCATIONS = [
  loc({ id: "central_ruined_watchtower_grid", name: "Old Watchtower Steps", type: "Ruined Watchtower", regionId: "central_crown", box: { x: 6, y: 4 }, xPercent: 39.8, yPercent: 40.8, riskBand: "Low", summary: "A broken civic tower overlooking old road stones and half-buried watch marks.", rewardFocus: ["recipe", "materials", "training"], recipeId: "epic-watchglass-plate", recipeGrade: "epic", materialDrops: [{ itemId: "registry_brass", quantity: 1 }, { itemId: "watchglass_shard", quantity: 1 }, { itemId: "clean_linen", quantity: 1 }], itemPieces: [{ itemId: "watchglass_aegis_piece", quantity: 1 }], skillFragments: [{ family: "slashing", itemId: "skill_manual_fragment", quantity: 1 }], trainingBooks: [{ itemId: "watch_drill_book", quantity: 1 }], cityAffinity: ["nexis"], tags: ["civic", "ruin", "watch"] }),
  loc({ id: "central_battlefield_grid", name: "Bannerfall Remnant", type: "Old Battlefield", regionId: "central_crown", box: { x: 8, y: 6 }, xPercent: 52.5, yPercent: 61.2, riskBand: "Moderate", summary: "Old banner pins and damaged cuirass plates mark a forgotten route fight.", rewardFocus: ["rare item piece", "training", "Absolute fragment"], recipeId: "legendary-concordant-pattern", recipeGrade: "legendary", materialDrops: [{ itemId: "concordant_shard", quantity: 1 }, { itemId: "scrap_metal", quantity: 2 }], rareItems: [{ itemId: "concordant_pattern_plate", quantity: 1 }], itemPieces: [{ itemId: "concordant_aegis_fragment", quantity: 1 }], skillFragments: [{ family: "protection", itemId: "skill_manual_fragment", quantity: 1 }], absoluteFragment: true, requiredCourses: ["historical-awareness"], cityAffinity: ["nexis", "east"], tags: ["battlefield", "history"] }),
  loc({ id: "west_tide_cache_grid", name: "Tide-Locked Cache", type: "Smuggler Cache", regionId: "western_coast", box: { x: 2, y: 3 }, xPercent: 16.1, yPercent: 31.1, riskBand: "Moderate", summary: "A salt-stained cache cut into the coast below Blackharbor broker routes.", rewardFocus: ["recipe", "materials", "skill fragments"], recipeId: "epic-saltsteel-binding", recipeGrade: "epic", materialDrops: [{ itemId: "saltsteel_flake", quantity: 1 }, { itemId: "black_salt", quantity: 1 }, { itemId: "cargo_seals", quantity: 1 }], itemPieces: [{ itemId: "corsair_relic_piece", quantity: 1 }], skillFragments: [{ family: "covert", itemId: "skill_manual_fragment", quantity: 1 }], trainingBooks: [{ itemId: "dockside_training_book", quantity: 1 }], requiredCourses: ["street-survival"], cityAffinity: ["west"], tags: ["covert", "smuggler", "cache"] }),
  loc({ id: "west_wreck_reef_grid", name: "Blackwake Wreck Reef", type: "Wreck", regionId: "western_coast", box: { x: 3, y: 5 }, xPercent: 21.8, yPercent: 52.5, riskBand: "High", summary: "A reef of broken hulls where cargo hooks and old knives still surface.", rewardFocus: ["materials", "rare item piece", "magic fragments"], recipeId: "legendary-blackwake-keelmark", recipeGrade: "legendary", materialDrops: [{ itemId: "saltsteel_flake", quantity: 1 }, { itemId: "foreign_token", quantity: 1 }], rareItems: [{ itemId: "blackwake_knife", quantity: 1 }], itemPieces: [{ itemId: "blackwake_edge_piece", quantity: 1 }], magicFragments: [{ family: "tidebinding", itemId: "spell_text_fragment", quantity: 1 }], requiredCourses: ["world-geography"], cityAffinity: ["west"], tags: ["wreck", "maritime"] }),
  loc({ id: "north_shrine_grove_grid", name: "Moonroot Shrine Ring", type: "Shrine Grove", regionId: "northern_bough", box: { x: 7, y: 2 }, xPercent: 44.9, yPercent: 20.8, riskBand: "Moderate", summary: "A quiet grove whose stones hold ward soot and careful herbal offerings.", rewardFocus: ["recipe", "materials", "magic fragments"], recipeId: "epic-moonward-core", recipeGrade: "epic", materialDrops: [{ itemId: "moon_resin", quantity: 1 }, { itemId: "wardglass_splinter", quantity: 1 }, { itemId: "silverleaf", quantity: 1 }], magicFragments: [{ family: "warding", itemId: "spell_text_fragment", quantity: 1 }], trainingBooks: [{ itemId: "grove_field_book", quantity: 1 }], requiredCourses: ["world-geography"], cityAffinity: ["north"], tags: ["shrine", "ward", "herb"] }),
  loc({ id: "north_survey_spire_grid", name: "Argent Survey Spire", type: "Arcane Survey Point", regionId: "northern_bough", box: { x: 8, y: 1 }, xPercent: 52.3, yPercent: 12.5, riskBand: "High", summary: "Old survey pins hum around a broken highland spire and a cold ring of light.", rewardFocus: ["legendary recipe", "magic fragments", "Absolute fragment"], recipeId: "legendary-argent-spire-focus", recipeGrade: "legendary", materialDrops: [{ itemId: "wardglass_splinter", quantity: 1 }, { itemId: "aether_thread", quantity: 1 }, { itemId: "arcane_ink", quantity: 1 }], rareItems: [{ itemId: "relicglass_rod", quantity: 1 }], itemPieces: [{ itemId: "argent_focus_piece", quantity: 1 }], magicFragments: [{ family: "argent", itemId: "spell_text_fragment", quantity: 1 }], absoluteFragment: true, requiredCourses: ["historical-awareness"], cityAffinity: ["north"], tags: ["arcane", "survey", "relic"] }),
  loc({ id: "east_forge_wreck_grid", name: "Furnace Road Wreck", type: "Forge Wreck", regionId: "eastern_forges", box: { x: 11, y: 4 }, xPercent: 68.2, yPercent: 42.4, riskBand: "Moderate", summary: "A half-buried forge cart and rivet trail beside an industrial road bend.", rewardFocus: ["recipe", "materials", "training"], recipeId: "epic-furnace-thread", recipeGrade: "epic", materialDrops: [{ itemId: "furnace_thread", quantity: 1 }, { itemId: "brass_gearplate", quantity: 1 }, { itemId: "iron_rivets", quantity: 1 }], itemPieces: [{ itemId: "bulwark_rivet_piece", quantity: 1 }], skillFragments: [{ family: "bludgeoning", itemId: "skill_manual_fragment", quantity: 1 }], trainingBooks: [{ itemId: "forge_training_book", quantity: 1 }], cityAffinity: ["east"], tags: ["forge", "wreck", "industrial"] }),
  loc({ id: "east_ash_causeway_grid", name: "Ash Engine Causeway", type: "Machine Incident", regionId: "eastern_forges", box: { x: 12, y: 5 }, xPercent: 76.4, yPercent: 50.8, riskBand: "High", summary: "A causeway lined with failed engine housings and heat-split armor plates.", rewardFocus: ["legendary recipe", "rare item piece", "materials"], recipeId: "legendary-anvilheart-frame", recipeGrade: "legendary", materialDrops: [{ itemId: "furnace_thread", quantity: 1 }, { itemId: "concordant_shard", quantity: 1 }, { itemId: "steel_ingot", quantity: 1 }], rareItems: [{ itemId: "chainbreaker_maul", quantity: 1 }], itemPieces: [{ itemId: "anvilheart_frame_piece", quantity: 1 }], skillFragments: [{ family: "heavy-arms", itemId: "skill_manual_fragment", quantity: 1 }], requiredCourses: ["applied-knowledge"], cityAffinity: ["east"], tags: ["engine", "forge", "elite"] }),
  loc({ id: "south_archive_sink_grid", name: "Sunken Petition Archive", type: "Collapsed Archive", regionId: "southern_court", box: { x: 9, y: 6 }, xPercent: 58.2, yPercent: 60.5, riskBand: "Moderate", summary: "A collapsed record chamber under permit roads and sealed court stone.", rewardFocus: ["recipe", "knowledge", "Absolute fragment"], recipeId: "epic-oathglass-seal", recipeGrade: "epic", materialDrops: [{ itemId: "oathglass_splinter", quantity: 1 }, { itemId: "court_parchment", quantity: 1 }, { itemId: "wax_seal", quantity: 1 }], skillFragments: [{ family: "civic", itemId: "skill_manual_fragment", quantity: 1 }], trainingBooks: [{ itemId: "court_training_book", quantity: 1 }], absoluteFragment: true, requiredCourses: ["civic-fundamentals"], cityAffinity: ["south"], tags: ["archive", "court", "law"] }),
  loc({ id: "south_sealed_outpost_grid", name: "Oathbound Outpost", type: "Sealed Court Outpost", regionId: "southern_court", box: { x: 10, y: 4 }, xPercent: 62.5, yPercent: 41.5, riskBand: "High", summary: "A sealed outpost whose old locks still answer only to formal writs.", rewardFocus: ["legendary recipe", "magic fragments", "rare item piece"], recipeId: "legendary-bastion-writwork", recipeGrade: "legendary", materialDrops: [{ itemId: "oathglass_splinter", quantity: 1 }, { itemId: "absolute_ink", quantity: 1 }, { itemId: "court_token", quantity: 1 }], rareItems: [{ itemId: "edict_blade", quantity: 1 }], itemPieces: [{ itemId: "bastion_writ_piece", quantity: 1 }], magicFragments: [{ family: "binding", itemId: "spell_text_fragment", quantity: 1 }], requiredCourses: ["historical-awareness"], cityAffinity: ["south"], tags: ["court", "sealed", "outpost"] }),
  loc({ id: "southern_black_marsh_grid", name: "Black Marsh Causeway", type: "Swamp Causeway", regionId: "southern_marsh", box: { x: 8, y: 8 }, xPercent: 50.4, yPercent: 79.1, riskBand: "Extreme", summary: "A drowned road where dark water hides old cargo, bones, and usable poisons.", rewardFocus: ["mythic recipe", "magic fragments", "rare item"], recipeId: "mythic-absolute-script-binding", recipeGrade: "mythic", materialDrops: [{ itemId: "absolute_ink", quantity: 1 }, { itemId: "toxic_plant", quantity: 1 }, { itemId: "black_salt", quantity: 1 }], rareItems: [{ itemId: "absolute_script_leaf", quantity: 1 }], itemPieces: [{ itemId: "absolute_relic_shard", quantity: 1 }], magicFragments: [{ family: "shadowbinding", itemId: "spell_text_fragment", quantity: 1 }], absoluteFragment: true, requiredCourses: ["historical-awareness", "street-survival"], cityAffinity: ["south", "west"], tags: ["mythic", "absolute", "marsh"] }),
  loc({ id: "red_sand_obelisk_grid", name: "Red Sand Obelisk", type: "Desert Obelisk", regionId: "red_sand_wastes", box: { x: 5, y: 6 }, xPercent: 31.2, yPercent: 62.7, riskBand: "High", summary: "A red-stone marker in the southern wastes with old survey grooves across its base.", rewardFocus: ["recipe", "knowledge", "training"], recipeId: "legendary-redsand-tempering", recipeGrade: "legendary", materialDrops: [{ itemId: "sunmetal_grit", quantity: 1 }, { itemId: "rare_materials", quantity: 1 }], itemPieces: [{ itemId: "redsand_edge_piece", quantity: 1 }], skillFragments: [{ family: "slashing", itemId: "skill_manual_fragment", quantity: 1 }], trainingBooks: [{ itemId: "waste_survival_book", quantity: 1 }], requiredCourses: ["world-geography"], cityAffinity: ["nexis", "south"], tags: ["desert", "obelisk", "tempering"] }),
  loc({ id: "eastern_blue_isles_grid", name: "Blue Isle Signal Cairn", type: "Island Signal", regionId: "eastern_isles", box: { x: 14, y: 7 }, xPercent: 86.8, yPercent: 70.4, riskBand: "High", summary: "A lonely signal cairn above bright water and reefs used by old couriers.", rewardFocus: ["magic fragments", "materials", "rare item piece"], recipeId: "epic-blueglass-navigation", recipeGrade: "epic", materialDrops: [{ itemId: "blueglass_splinter", quantity: 1 }, { itemId: "aether_thread", quantity: 1 }], itemPieces: [{ itemId: "blueglass_lens_piece", quantity: 1 }], magicFragments: [{ family: "navigation", itemId: "spell_text_fragment", quantity: 1 }], trainingBooks: [{ itemId: "route_training_book", quantity: 1 }], requiredCourses: ["world-geography"], cityAffinity: ["east", "south"], tags: ["island", "signal", "navigation"] }),
  loc({ id: "north_glacier_gate_grid", name: "Glacier Gate Cairns", type: "Frozen Pass", regionId: "northern_bough", box: { x: 10, y: 1 }, xPercent: 63.8, yPercent: 9.5, riskBand: "Extreme", summary: "A cold pass where stacked cairns point toward warded snowfields and older roads.", rewardFocus: ["legendary recipe", "magic fragments", "materials"], recipeId: "legendary-frostward-laminate", recipeGrade: "legendary", materialDrops: [{ itemId: "cold_iron_scale", quantity: 1 }, { itemId: "wardglass_splinter", quantity: 1 }], rareItems: [{ itemId: "concordant_circlet", quantity: 1 }], itemPieces: [{ itemId: "frostward_scale_piece", quantity: 1 }], magicFragments: [{ family: "frostward", itemId: "spell_text_fragment", quantity: 1 }], requiredCourses: ["historical-awareness"], cityAffinity: ["north"], tags: ["cold", "pass", "ward"] }),
  loc({ id: "western_crow_lanterns_grid", name: "Crow Lantern Strand", type: "Coastal Markers", regionId: "western_coast", box: { x: 1, y: 4 }, xPercent: 8.7, yPercent: 44.2, riskBand: "Low", summary: "Old lantern stakes stand along the strand, each marked with dock codes and tide cuts.", rewardFocus: ["materials", "training", "recipe"], recipeId: "epic-crowlantern-smoke", recipeGrade: "epic", materialDrops: [{ itemId: "black_salt", quantity: 1 }, { itemId: "empty_vials", quantity: 1 }], skillFragments: [{ family: "covert", itemId: "skill_manual_fragment", quantity: 1 }], trainingBooks: [{ itemId: "dockside_training_book", quantity: 1 }], requiredCourses: ["street-survival"], cityAffinity: ["west"], tags: ["coast", "covert", "lantern"] }),
  loc({ id: "central_archive_door_grid", name: "Unfiled Archive Door", type: "Hidden Archive", regionId: "central_crown", box: { x: 7, y: 4 }, xPercent: 46.3, yPercent: 39.2, riskBand: "Low", summary: "A sealed civic door omitted from ordinary registry maps.", rewardFocus: ["knowledge", "recipe", "Absolute fragment"], recipeId: "epic-registry-glass-index", recipeGrade: "epic", materialDrops: [{ itemId: "registry_brass", quantity: 1 }, { itemId: "ledger_page", quantity: 1 }, { itemId: "absolute_ink", quantity: 1 }], skillFragments: [{ family: "civic", itemId: "skill_manual_fragment", quantity: 1 }], absoluteFragment: true, requiredCourses: ["basic-literacy"], cityAffinity: ["nexis"], tags: ["archive", "civic", "absolute"] }),
];

export function getGradeProfile(grade) {
  return GRADE_PROFILE[grade] ?? GRADE_PROFILE.epic;
}

export function getExcursionLocation(locationId) {
  return EXCURSION_LOCATIONS.find((location) => location.id === locationId) ?? null;
}

export function getCityExcursionOrigin(cityId) {
  return CITY_EXCURSION_ORIGINS[cityId] ?? CITY_EXCURSION_ORIGINS.nexis;
}

export function calculateGridDistance(originBox, targetBox) {
  const dx = Math.abs(Number(targetBox?.x ?? 0) - Number(originBox?.x ?? 0));
  const dy = Math.abs(Number(targetBox?.y ?? 0) - Number(originBox?.y ?? 0));
  return Math.max(0, Math.floor(dx + dy));
}

export function calculateExcursionTiming({ originBox, targetBox }) {
  const distanceBoxes = calculateGridDistance(originBox, targetBox);
  const outboundMs = Math.max(EXCURSION_GRID.localMinimumTravelMs, distanceBoxes * EXCURSION_GRID.boxTravelMs);
  const exploreMs = EXCURSION_GRID.exploreMs;
  const returnMs = outboundMs;
  return { distanceBoxes, outboundMs, exploreMs, returnMs, totalMs: outboundMs + exploreMs + returnMs };
}

export function formatExcursionMs(ms) {
  const minutes = Math.max(0, Math.round(Number(ms || 0) / 60000));
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  if (hours && mins) return `${hours}h ${mins}m`;
  if (hours) return `${hours}h`;
  return `${mins}m`;
}
