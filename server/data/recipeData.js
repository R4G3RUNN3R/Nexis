function req(itemId, quantity = 1) {
  return { itemId, quantity };
}

function out(itemId, quantity = 1) {
  return { itemId, quantity };
}

function recipe(input) {
  return {
    id: input.id,
    family: input.family,
    cityId: input.cityId,
    title: input.title,
    summary: input.summary,
    inputs: input.inputs ?? [],
    outputs: input.outputs ?? [],
    goldCost: input.goldCost ?? 0,
    minimumStanding: input.minimumStanding ?? 0,
    requiredCourses: input.requiredCourses ?? [],
    requiredAcademyUnlocks: input.requiredAcademyUnlocks ?? [],
    unlockHint: input.unlockHint ?? null,
  };
}

export const CRAFTING_RECIPES = [
  recipe({ id: "nexis-field-bandage", family: "Utility / field gear", cityId: "nexis", title: "Field Bandage Wrap", summary: "Turn starter cloth and herbs into a clean field bandage.", inputs: [req("wild_herb", 1), req("rough_wood", 1)], outputs: [out("field_bandage", 2)], goldCost: 4 }),
  recipe({ id: "nexis-civic-packet", family: "Legal / civic", cityId: "nexis", title: "Civic Notice Packet", summary: "Bind ink, wax, and ledger pages into a usable sealed notice.", inputs: [req("vial_of_ink", 1), req("wax_seal", 1), req("ledger_page", 1)], outputs: [out("sealed_notice", 1)], goldCost: 8 }),
  recipe({ id: "nexis-courier-kit", family: "Utility / field gear", cityId: "nexis", title: "Courier Utility Kit", summary: "Prepare a courier satchel with rope and light for field errands.", inputs: [req("courier_satchel", 1), req("rope_kit", 1), req("lantern", 1)], outputs: [out("travel_rig", 1)], goldCost: 18, minimumStanding: 1 }),

  recipe({ id: "blackharbor-rope-kit", family: "Utility / field gear", cityId: "west", title: "Dock Rope Kit", summary: "Twist scrap fiber and cargo seal tags into a dock-ready rope kit.", inputs: [req("rough_wood", 1), req("cargo_seals", 1)], outputs: [out("rope_kit", 1)], goldCost: 6 }),
  recipe({ id: "blackharbor-smoke-pellets", family: "Alchemy", cityId: "west", title: "Smoke Pellet Batch", summary: "Pack coal dust and empty vials into a quick escape trick.", inputs: [req("coal", 1), req("empty_vials", 1)], outputs: [out("smoke_pellet", 2)], goldCost: 12, requiredCourses: ["street-survival"], unlockHint: "Street Survival teaches safe covert handling." }),
  recipe({ id: "blackharbor-contraband-satchel", family: "Utility / field gear", cityId: "west", title: "Contraband Satchel Lining", summary: "Convert a courier satchel into a quieter cargo bag.", inputs: [req("courier_satchel", 1), req("shadow_manifest", 1), req("cargo_seals", 1)], outputs: [out("contraband_satchel", 1)], goldCost: 35, minimumStanding: 2, requiredCourses: ["street-survival"], requiredAcademyUnlocks: ["academy_blackharbor_nightwake_primer"], unlockHint: "Nightwake Lodge primer unlocks safer satchel lining." }),

  recipe({ id: "silverbough-healing-tonic", family: "Alchemy", cityId: "north", title: "Healing Tonic Distillation", summary: "Distill herbs and vials into a reliable healing tonic.", inputs: [req("wild_herb", 2), req("empty_vials", 1)], outputs: [out("healing_tonic", 2)], goldCost: 10 }),
  recipe({ id: "silverbough-restorative-elixir", family: "Alchemy", cityId: "north", title: "Restorative Elixir", summary: "Blend medicinal herbs and healing root into stronger recovery stock.", inputs: [req("medicinal_herb", 2), req("healing_root", 1), req("empty_vials", 1)], outputs: [out("restorative_elixir", 1)], goldCost: 24, minimumStanding: 2, requiredCourses: ["world-geography"] }),
  recipe({ id: "silverbough-ward-charm", family: "Arcane scribing / wards", cityId: "north", title: "Ward Charm Binding", summary: "Bind a ward shard with ink into a portable protective charm.", inputs: [req("ward_shard", 1), req("arcane_ink", 1), req("shrine_token", 1)], outputs: [out("ward_charm", 1)], goldCost: 36, minimumStanding: 2, requiredCourses: ["world-geography"], requiredAcademyUnlocks: ["academy_silverbough_argent_primer"], unlockHint: "Argent Bough ward study unlocks reliable binding." }),

  recipe({ id: "ironhall-repair-kit", family: "Smithing", cityId: "east", title: "Field Repair Kit", summary: "Assemble rivets, coal, and scrap metal into a maintenance kit.", inputs: [req("iron_rivets", 2), req("coal", 1), req("scrap_metal", 1)], outputs: [out("field_repair_kit", 1)], goldCost: 10 }),
  recipe({ id: "ironhall-steel-brace", family: "Smithing", cityId: "east", title: "Steel Brace Assembly", summary: "Convert refined metal and rivets into bracework for equipment and contracts.", inputs: [req("steel_ingot", 1), req("iron_rivets", 2)], outputs: [out("steel_brace", 1)], goldCost: 18, requiredCourses: ["practical-arithmetic"] }),
  recipe({ id: "ironhall-tower-shield", family: "Smithing", cityId: "east", title: "Watch Tower Shield Refit", summary: "Refit metal and braces into a defensive offhand shield.", inputs: [req("iron_ingot", 1), req("steel_brace", 1), req("iron_rivets", 2)], outputs: [out("tower_shield", 1)], goldCost: 45, minimumStanding: 2, requiredAcademyUnlocks: ["academy_ironhall_foundry_primer"] }),

  recipe({ id: "highcourt-legal-seal-kit", family: "Legal / civic", cityId: "south", title: "Legal Seal Kit", summary: "Prepare seals and ink into a court-ready packet.", inputs: [req("wax_seal", 2), req("vial_of_ink", 1)], outputs: [out("legal_seal_kit", 1)], goldCost: 14 }),
  recipe({ id: "highcourt-writ-case", family: "Legal / civic", cityId: "south", title: "Writ Case Assembly", summary: "Bind notices, seals, and prestige papers into a formal writ case.", inputs: [req("sealed_notice", 1), req("wax_seal", 1), req("prestige_goods", 1)], outputs: [out("writ_case", 1)], goldCost: 35, minimumStanding: 2, requiredCourses: ["civic-fundamentals"] }),
  recipe({ id: "highcourt-court-signet", family: "Legal / civic", cityId: "south", title: "Court Signet Setting", summary: "Set a court token into a prestige signet ring.", inputs: [req("court_token", 1), req("prestige_goods", 1), req("wax_seal", 1)], outputs: [out("court_signet_ring", 1)], goldCost: 55, minimumStanding: 4, requiredCourses: ["civic-fundamentals"], requiredAcademyUnlocks: ["academy_highcourt_civic_law_primer"] }),
];

export function getRecipeDefinitions() {
  return CRAFTING_RECIPES;
}

export function getRecipeDefinition(recipeId) {
  return CRAFTING_RECIPES.find((recipeEntry) => recipeEntry.id === recipeId) ?? null;
}
