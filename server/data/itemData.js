export const EQUIPMENT_SLOTS = [
  "weapon",
  "offhand",
  "armor",
  "helmet",
  "gloves",
  "boots",
  "accessory1",
  "accessory2",
  "focus",
  "trinket",
];

export const RARITY_FRAMES = {
  common: "plain-iron",
  uncommon: "brass-trim",
  rare: "blue-steel",
  epic: "violet-arc",
  legacy: "gold-writ",
};

const CITY_PALETTES = {
  nexis: ["#d6d0bd", "#5f6f82", "#b5894a"],
  blackharbor: ["#1d4d5c", "#0c1a24", "#d18d49"],
  silverbough: ["#6aa981", "#e5d9ff", "#3f5f52"],
  ironhall: ["#8b3930", "#2c3033", "#d3a64f"],
  highcourt: ["#f1d889", "#6b274b", "#f7f1dc"],
  neutral: ["#8c9aa6", "#2f3b45", "#e5dfcf"],
};

function titleFromId(id) {
  return String(id)
    .split(/[ _-]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function asRecord(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : {};
}

function iconDefaults(id, category, rarity, cityBias) {
  const palette = CITY_PALETTES[cityBias] ?? CITY_PALETTES.neutral;
  const silhouette = category === "Equipment"
    ? "gear-profile"
    : category === "Consumable"
      ? "stoppered-vial"
      : category === "Tool"
        ? "handled-tool"
        : category === "Academy"
          ? "academy-token"
          : category === "Trade Good"
            ? "bound-crate"
            : "small-ledger-object";
  return {
    iconKey: `${id}_icon`,
    iconBrief: `${titleFromId(id)} as a readable ${category.toLowerCase()} icon with strong silhouette and Nexis UI contrast.`,
    iconPalette: palette,
    iconSilhouette: silhouette,
    iconRarityFrame: RARITY_FRAMES[rarity] ?? RARITY_FRAMES.common,
  };
}

function defineItem(input) {
  const rarity = input.rarity ?? "common";
  const category = input.category ?? "Material";
  const cityBias = input.cityBias ?? input.sourceCity ?? "neutral";
  const icon = iconDefaults(input.id, category, rarity, cityBias);
  return {
    id: input.id,
    displayName: input.displayName ?? titleFromId(input.id),
    category,
    subtype: input.subtype ?? category,
    rarity,
    equipSlot: input.equipSlot ?? null,
    allowedSlots: input.allowedSlots ?? null,
    stackLimit: input.stackLimit ?? (category === "Equipment" ? 1 : 99),
    valueBuy: input.valueBuy ?? 20,
    valueSell: input.valueSell ?? Math.max(1, Math.floor((input.valueBuy ?? 20) * 0.5)),
    cityBias,
    sourceCity: input.sourceCity ?? cityBias,
    legalMarketAvailability: input.legalMarketAvailability ?? [],
    blackMarketAvailability: input.blackMarketAvailability ?? [],
    statModifiers: input.statModifiers ?? {},
    combatModifiers: input.combatModifiers ?? {},
    useEffects: input.useEffects ?? [],
    passiveEffects: input.passiveEffects ?? {},
    requirements: input.requirements ?? {},
    lockReasonText: input.lockReasonText ?? null,
    shortDescription: input.shortDescription ?? `A ${category.toLowerCase()} used in Nexis progression.`,
    flavorText: input.flavorText ?? "Stamped, tracked, and less mysterious than the paperwork claims.",
    sourceTags: input.sourceTags ?? [],
    academyTags: input.academyTags ?? [],
    ...icon,
    ...(input.iconBrief ? { iconBrief: input.iconBrief } : {}),
    ...(input.iconPalette ? { iconPalette: input.iconPalette } : {}),
    ...(input.iconSilhouette ? { iconSilhouette: input.iconSilhouette } : {}),
    ...(input.lootWeight ? { lootWeight: input.lootWeight } : {}),
    ...(input.dropFamilies ? { dropFamilies: input.dropFamilies } : {}),
  };
}

const CORE_ITEMS = [
  defineItem({ id: "quick_knife", displayName: "Quick Knife", category: "Equipment", subtype: "Light Blade", equipSlot: "weapon", rarity: "common", valueBuy: 95, valueSell: 42, cityBias: "nexis", legalMarketAvailability: ["nexis"], statModifiers: { battleStats: { dexterity: 2, speed: 1 } }, combatModifiers: { accuracyBonus: 3, critBonus: 2 }, shortDescription: "A fast starter blade for rogue and light melee styles.", flavorText: "Small enough for a civic pocket, sharp enough to make the pocket nervous.", sourceTags: ["starter", "rogue", "melee"] }),
  defineItem({ id: "hunter_shortbow", displayName: "Hunter Shortbow", category: "Equipment", subtype: "Ranged Weapon", equipSlot: "weapon", rarity: "common", valueBuy: 120, valueSell: 54, cityBias: "nexis", legalMarketAvailability: ["nexis", "silverbough"], statModifiers: { battleStats: { dexterity: 2, speed: 1 } }, combatModifiers: { accuracyBonus: 5 }, shortDescription: "A compact bow that supports ranged openers and travel fights.", flavorText: "Plain wood, honest string, and very little patience for excuses.", sourceTags: ["starter", "ranged"] }),
  defineItem({ id: "spark_focus", displayName: "Spark Focus", category: "Equipment", subtype: "Arcane Focus", equipSlot: "focus", rarity: "uncommon", valueBuy: 210, valueSell: 95, cityBias: "ironhall", legalMarketAvailability: ["ironhall", "silverbough"], statModifiers: { workingStats: { intelligence: 2 }, battleStats: { dexterity: 1 } }, combatModifiers: { damageMultiplier: 0.05, critBonus: 2 }, shortDescription: "A basic focus for arcane and enginewright techniques.", flavorText: "It hums only when held correctly, which is very rude of it.", sourceTags: ["arcane", "enginewright"] }),
  defineItem({ id: "iron_warhammer", displayName: "Ironhall Warhammer", category: "Equipment", subtype: "Heavy Weapon", equipSlot: "weapon", rarity: "uncommon", valueBuy: 240, valueSell: 112, cityBias: "ironhall", legalMarketAvailability: ["ironhall"], statModifiers: { battleStats: { strength: 4, defense: 1 }, workingStats: { manualLabor: 1 } }, combatModifiers: { damageMultiplier: 0.1, accuracyBonus: -2 }, shortDescription: "Heavy melee pressure for forge and war-school builds.", flavorText: "Ironhall does subtle too. This is not that.", sourceTags: ["heavy", "forge"] }),
  defineItem({ id: "tower_shield", displayName: "Watch Tower Shield", category: "Equipment", subtype: "Shield", equipSlot: "offhand", rarity: "uncommon", valueBuy: 190, valueSell: 86, cityBias: "nexis", legalMarketAvailability: ["nexis", "highcourt"], statModifiers: { battleStats: { defense: 4 }, stats: { maxHealth: 8 } }, combatModifiers: { mitigationBonus: 0.04, initiativeBonus: -1 }, shortDescription: "A defensive offhand for watch and civic guard lines.", flavorText: "Mostly shield. Slightly mobile wall. Officially not a door.", sourceTags: ["defense", "watch"] }),
  defineItem({ id: "brigandine_plate", displayName: "Brigandine Plate", category: "Equipment", subtype: "Armor", equipSlot: "armor", rarity: "uncommon", valueBuy: 260, valueSell: 120, cityBias: "ironhall", legalMarketAvailability: ["ironhall", "highcourt"], statModifiers: { battleStats: { defense: 5, strength: 1 }, stats: { maxHealth: 12 } }, combatModifiers: { mitigationBonus: 0.05, evadeBonus: -2 }, shortDescription: "Reliable armor for difficult contracts and arena pressure.", flavorText: "Every rivet is a tiny argument against being stabbed.", sourceTags: ["armor", "forge"] }),
  defineItem({ id: "shadow_cloak", displayName: "Shadow Dock Cloak", category: "Equipment", subtype: "Cloak", equipSlot: "armor", rarity: "uncommon", valueBuy: 230, valueSell: 105, cityBias: "blackharbor", legalMarketAvailability: [], blackMarketAvailability: ["blackharbor"], statModifiers: { battleStats: { dexterity: 3, speed: 2 } }, combatModifiers: { evadeBonus: 4, critBonus: 2 }, requirements: { courses: ["street-survival"] }, lockReasonText: "Requires Street Survival to buy and use safely.", shortDescription: "Covert armor for shadow and under-market routes.", flavorText: "It is not invisible. It is just excellent at helping people look elsewhere.", sourceTags: ["covert", "black-market"] }),
  defineItem({ id: "field_medic_coat", displayName: "Field Medic Coat", category: "Equipment", subtype: "Support Armor", equipSlot: "armor", rarity: "uncommon", valueBuy: 215, valueSell: 98, cityBias: "silverbough", legalMarketAvailability: ["silverbough"], statModifiers: { workingStats: { endurance: 2, intelligence: 1 }, stats: { maxHealth: 6 } }, combatModifiers: { mitigationBonus: 0.02 }, passiveEffects: { healingBonus: 0.08 }, shortDescription: "Support gear that improves survivability and field care.", flavorText: "Pockets for bandages, salves, and the exact look that stops panic.", sourceTags: ["healing", "support"] }),
  defineItem({ id: "court_signet_ring", displayName: "Court Signet Ring", category: "Equipment", subtype: "Accessory", allowedSlots: ["accessory1", "accessory2"], rarity: "uncommon", valueBuy: 180, valueSell: 82, cityBias: "highcourt", legalMarketAvailability: ["highcourt"], statModifiers: { workingStats: { intelligence: 1, endurance: 1 } }, passiveEffects: { sellBonusPercent: 1 }, shortDescription: "A prestige accessory that helps with legal and market dealings.", flavorText: "The ring opens doors, provided the door respects rings. Many do. Silly doors.", sourceTags: ["prestige", "legal"] }),
  defineItem({ id: "enginewright_goggles", displayName: "Enginewright Goggles", category: "Equipment", subtype: "Helmet", equipSlot: "helmet", rarity: "uncommon", valueBuy: 185, valueSell: 84, cityBias: "ironhall", legalMarketAvailability: ["ironhall"], statModifiers: { workingStats: { intelligence: 2, manualLabor: 1 } }, combatModifiers: { accuracyBonus: 2 }, shortDescription: "Workshop eye gear for enginewright and craft-heavy paths.", flavorText: "They protect your eyes from sparks and your pride from guessing.", sourceTags: ["enginewright", "craft"] }),
  defineItem({ id: "corsair_boots", displayName: "Corsair Deck Boots", category: "Equipment", subtype: "Boots", equipSlot: "boots", rarity: "uncommon", valueBuy: 175, valueSell: 80, cityBias: "blackharbor", legalMarketAvailability: ["blackharbor"], statModifiers: { battleStats: { speed: 3, dexterity: 1 } }, combatModifiers: { initiativeBonus: 2, evadeBonus: 2 }, shortDescription: "Fast boots for maritime escorts and deck fights.", flavorText: "Salt-stiff leather with soles that trust wet planks more than most people do.", sourceTags: ["maritime", "ranged"] }),
  defineItem({ id: "grove_focus", displayName: "Grove Focus", category: "Equipment", subtype: "Arcane Focus", equipSlot: "focus", rarity: "uncommon", valueBuy: 220, valueSell: 101, cityBias: "silverbough", legalMarketAvailability: ["silverbough"], statModifiers: { workingStats: { intelligence: 2, endurance: 1 } }, combatModifiers: { damageMultiplier: 0.04, accuracyBonus: 2 }, passiveEffects: { healingBonus: 0.05 }, shortDescription: "A Silverbough focus for healing and ward-aware casting.", flavorText: "Warm in the hand, cool to the fever, judgmental about sloppy wardwork.", sourceTags: ["arcane", "healing"] }),

  defineItem({ id: "healing_tonic", displayName: "Healing Tonic", category: "Consumable", subtype: "Healing", rarity: "common", valueBuy: 42, valueSell: 18, cityBias: "silverbough", legalMarketAvailability: ["nexis", "blackharbor", "silverbough"], useEffects: [{ type: "restore_health", amount: 32, context: "out_of_combat" }], shortDescription: "Restores 32 health outside combat.", flavorText: "Bitter enough to prove someone cared about it working.", sourceTags: ["healing", "tonic"] }),
  defineItem({ id: "field_bandage", displayName: "Field Bandage", category: "Consumable", subtype: "Healing", rarity: "common", valueBuy: 24, valueSell: 10, cityBias: "nexis", legalMarketAvailability: ["nexis", "silverbough", "ironhall"], useEffects: [{ type: "restore_health", amount: 18, context: "out_of_combat" }], shortDescription: "Restores 18 health outside combat.", flavorText: "A clean wrap and a small miracle of not making things worse.", sourceTags: ["healing", "starter"] }),
  defineItem({ id: "restorative_elixir", displayName: "Restorative Elixir", category: "Consumable", subtype: "Restorative", rarity: "uncommon", valueBuy: 86, valueSell: 38, cityBias: "silverbough", legalMarketAvailability: ["silverbough"], useEffects: [{ type: "restore_health", amount: 45, context: "out_of_combat" }, { type: "restore_stamina", amount: 2, context: "out_of_combat" }], shortDescription: "Restores health and a small amount of stamina.", flavorText: "Looks serene. Tastes like an argument with a garden.", sourceTags: ["healing", "stamina"] }),
  defineItem({ id: "focus_draught", displayName: "Focus Draught", category: "Consumable", subtype: "Focus", rarity: "common", valueBuy: 55, valueSell: 24, cityBias: "silverbough", legalMarketAvailability: ["silverbough", "highcourt"], useEffects: [{ type: "restore_energy", amount: 18, context: "out_of_combat" }], shortDescription: "Restores 18 energy outside combat.", flavorText: "Keeps your thoughts from wandering into the furniture.", sourceTags: ["focus", "study"] }),
  defineItem({ id: "rations", displayName: "Travel Rations", category: "Consumable", subtype: "Travel Aid", rarity: "common", valueBuy: 18, valueSell: 8, cityBias: "nexis", legalMarketAvailability: ["nexis", "blackharbor", "ironhall"], useEffects: [{ type: "restore_energy", amount: 10, context: "out_of_combat" }], shortDescription: "Simple food that restores a little energy.", flavorText: "Food in the legal sense. Comfort in a more negotiable sense.", sourceTags: ["travel", "starter"] }),
  defineItem({ id: "smoke_pellet", displayName: "Smoke Pellet", category: "Consumable", subtype: "Combat Trick", rarity: "common", valueBuy: 48, valueSell: 21, cityBias: "blackharbor", legalMarketAvailability: [], blackMarketAvailability: ["blackharbor"], useEffects: [{ type: "combat_buff", effect: "evadeBonus", amount: 5, context: "pre_combat", uses: 1 }], requirements: { courses: ["street-survival"] }, lockReasonText: "Requires Street Survival to use without coughing impressively.", shortDescription: "Primes a one-fight evade bonus.", flavorText: "A tiny cloud of plausible deniability.", sourceTags: ["covert", "combat"] }),
  defineItem({ id: "ward_salts", displayName: "Ward Salts", category: "Consumable", subtype: "Combat Ward", rarity: "common", valueBuy: 52, valueSell: 23, cityBias: "silverbough", legalMarketAvailability: ["silverbough"], useEffects: [{ type: "combat_buff", effect: "mitigationBonus", amount: 0.04, context: "pre_combat", uses: 1 }], shortDescription: "Primes a one-fight mitigation bonus.", flavorText: "Sprinkle carefully. Nobody respects a lopsided ward circle.", sourceTags: ["ward", "combat"] }),
  defineItem({ id: "poison_vial", displayName: "Low Poison Vial", category: "Consumable", subtype: "Combat Oil", rarity: "uncommon", valueBuy: 72, valueSell: 32, cityBias: "blackharbor", legalMarketAvailability: [], blackMarketAvailability: ["blackharbor"], useEffects: [{ type: "combat_buff", effect: "critBonus", amount: 6, context: "pre_combat", uses: 1 }], requirements: { courses: ["street-survival"] }, lockReasonText: "Requires Street Survival and a better excuse than curiosity.", shortDescription: "Primes a one-fight critical chance bonus.", flavorText: "Labeled low poison, which is somehow not comforting.", sourceTags: ["covert", "combat"] }),
  defineItem({ id: "lantern", displayName: "Travel Lantern", category: "Tool", subtype: "Travel Tool", rarity: "common", valueBuy: 35, valueSell: 15, cityBias: "nexis", legalMarketAvailability: ["nexis", "ironhall"], passiveEffects: { travelClarity: 1 }, shortDescription: "A travel aid for contracts, roadwork, and dark routes.", flavorText: "A useful object until someone calls it atmospheric.", sourceTags: ["travel", "tool"] }),
  defineItem({ id: "rope_kit", displayName: "Rope Kit", category: "Tool", subtype: "Travel Tool", rarity: "common", valueBuy: 34, valueSell: 15, cityBias: "blackharbor", legalMarketAvailability: ["blackharbor", "ironhall"], passiveEffects: { travelClarity: 1 }, shortDescription: "Basic rope, hooks, and knots for awkward places.", flavorText: "For climbing, hauling, tying, and pretending this was planned.", sourceTags: ["travel", "maritime"] }),
  defineItem({ id: "lockpick_set", displayName: "Lockpick Set", category: "Tool", subtype: "Covert Tool", rarity: "uncommon", valueBuy: 88, valueSell: 39, cityBias: "blackharbor", legalMarketAvailability: [], blackMarketAvailability: ["blackharbor"], requirements: { courses: ["street-survival"] }, lockReasonText: "Requires Street Survival to carry without making officials twitch.", shortDescription: "A covert tool for shadow contracts and under-market routes.", flavorText: "For locks, not laws. The distinction keeps lawyers warm.", sourceTags: ["covert", "tool"] }),
  defineItem({ id: "herbalist_gloves", displayName: "Herbalist Gloves", category: "Tool", subtype: "Profession Tool", rarity: "common", valueBuy: 58, valueSell: 25, cityBias: "silverbough", legalMarketAvailability: ["silverbough"], statModifiers: { workingStats: { endurance: 1 } }, shortDescription: "A profession tool for herb and healing activities.", flavorText: "Stops thorns, stains, and at least three kinds of poor decisions.", sourceTags: ["herb", "profession"] }),
  defineItem({ id: "miners_pick", displayName: "Miner's Pick", category: "Tool", subtype: "Profession Tool", rarity: "common", valueBuy: 62, valueSell: 27, cityBias: "ironhall", legalMarketAvailability: ["ironhall"], statModifiers: { workingStats: { manualLabor: 1 } }, shortDescription: "A profession tool for ore, quarry, and material work.", flavorText: "It makes stone negotiate. Slowly.", sourceTags: ["mining", "profession"] }),
  defineItem({ id: "wood_axe", displayName: "Wood Axe", category: "Tool", subtype: "Profession Tool", rarity: "common", valueBuy: 56, valueSell: 25, cityBias: "nexis", legalMarketAvailability: ["nexis", "ironhall"], statModifiers: { workingStats: { manualLabor: 1 } }, shortDescription: "A utility tool for starter labor and gathering work.", flavorText: "Honest, blunt, and only occasionally symbolic.", sourceTags: ["labor", "profession"] }),
  defineItem({ id: "cargo_seals", displayName: "Cargo Seals", category: "Trade Good", subtype: "Maritime Paper", rarity: "common", valueBuy: 64, valueSell: 30, cityBias: "blackharbor", legalMarketAvailability: ["blackharbor", "highcourt"], shortDescription: "Trade paperwork used for cargo and escort contracts.", flavorText: "A small seal that makes a large crate suddenly official.", sourceTags: ["trade", "maritime"] }),
  defineItem({ id: "forged_permit", displayName: "Forged Permit", category: "Black Market", subtype: "Document", rarity: "uncommon", valueBuy: 128, valueSell: 58, cityBias: "blackharbor", legalMarketAvailability: [], blackMarketAvailability: ["blackharbor", "highcourt"], requirements: { courses: ["street-survival"] }, lockReasonText: "Requires Street Survival. Also a straight face.", shortDescription: "A shady document for under-market and court-adjacent routes.", flavorText: "The seal is convincing. The conscience is sold separately.", sourceTags: ["black-market", "document"] }),
  defineItem({ id: "shrine_token", displayName: "Shrine Token", category: "Trade Good", subtype: "Sanctuary Token", rarity: "common", valueBuy: 46, valueSell: 21, cityBias: "silverbough", legalMarketAvailability: ["silverbough"], shortDescription: "A petition token used around Silverbough sanctuaries.", flavorText: "Small, polished, and more patient than most petitioners.", sourceTags: ["shrine", "silverbough"] }),
  defineItem({ id: "arcane_ink", displayName: "Arcane Ink", category: "Material", subtype: "Reagent", rarity: "uncommon", valueBuy: 78, valueSell: 36, cityBias: "silverbough", legalMarketAvailability: ["silverbough", "highcourt"], shortDescription: "A reagent for ward notes, academy study, and scrollwork.", flavorText: "It dries when understood. Unfortunately, it has standards.", sourceTags: ["arcane", "reagent"] }),
  defineItem({ id: "forge_tongs", displayName: "Forge Tongs", category: "Tool", subtype: "Forge Tool", rarity: "common", valueBuy: 66, valueSell: 29, cityBias: "ironhall", legalMarketAvailability: ["ironhall"], statModifiers: { workingStats: { manualLabor: 1 } }, shortDescription: "A forge tool for material handling and workshop contracts.", flavorText: "Designed for hot metal and cooler judgment.", sourceTags: ["forge", "tool"] }),
  defineItem({ id: "oath_sigil", displayName: "Oath Sigil", category: "Equipment", subtype: "Accessory", allowedSlots: ["accessory1", "accessory2", "trinket"], rarity: "uncommon", valueBuy: 150, valueSell: 68, cityBias: "highcourt", legalMarketAvailability: ["highcourt"], statModifiers: { workingStats: { endurance: 1, intelligence: 1 }, battleStats: { defense: 1 } }, shortDescription: "A legal-prestige charm for civic and defensive paths.", flavorText: "A promise rendered in metal, so everyone can pretend promises are simple.", sourceTags: ["legal", "prestige"] }),

  defineItem({ id: "wild_herb", displayName: "Wild Herb", category: "Material", subtype: "Herb", rarity: "common", valueBuy: 16, valueSell: 8, cityBias: "silverbough", legalMarketAvailability: ["silverbough"], shortDescription: "Common herb stock for tonics and field work.", flavorText: "Useful, green, and probably not judging you.", sourceTags: ["herb", "silverbough"], dropFamilies: ["beast"] }),
  defineItem({ id: "medicinal_herb", displayName: "Medicinal Herb", category: "Material", subtype: "Herb", rarity: "common", valueBuy: 28, valueSell: 13, cityBias: "silverbough", legalMarketAvailability: ["silverbough"], shortDescription: "A stronger herb for salves and clinic supply.", flavorText: "Smells clean enough to make the room behave.", sourceTags: ["herb", "healing"] }),
  defineItem({ id: "rare_herb", displayName: "Rare Herb", category: "Material", subtype: "Herb", rarity: "uncommon", valueBuy: 74, valueSell: 35, cityBias: "silverbough", legalMarketAvailability: ["silverbough"], shortDescription: "Valuable herb stock for advanced healing work.", flavorText: "Rare because it grows in inconvenient places. Naturally.", sourceTags: ["herb", "rare"] }),
  defineItem({ id: "healing_root", displayName: "Healing Root", category: "Material", subtype: "Root", rarity: "uncommon", valueBuy: 68, valueSell: 32, cityBias: "silverbough", legalMarketAvailability: ["silverbough"], shortDescription: "A root valued by hospices and traveling medics.", flavorText: "Ugly as a boot, twice as useful.", sourceTags: ["healing", "root"] }),
  defineItem({ id: "coal", displayName: "Coal", category: "Material", subtype: "Fuel", rarity: "common", valueBuy: 18, valueSell: 9, cityBias: "ironhall", legalMarketAvailability: ["ironhall"], shortDescription: "Fuel for forge orders and industrial contracts.", flavorText: "The beginning of heat, soot, and paperwork about heat and soot.", sourceTags: ["forge", "fuel"] }),
  defineItem({ id: "iron_ore", displayName: "Iron Ore", category: "Material", subtype: "Ore", rarity: "common", valueBuy: 32, valueSell: 15, cityBias: "ironhall", legalMarketAvailability: ["ironhall"], shortDescription: "Raw ore for Ironhall material loops.", flavorText: "A rock with ambition and a union problem.", sourceTags: ["ore", "ironhall"] }),
  defineItem({ id: "iron_ingot", displayName: "Iron Ingot", category: "Material", subtype: "Ingot", rarity: "common", valueBuy: 52, valueSell: 25, cityBias: "ironhall", legalMarketAvailability: ["ironhall"], shortDescription: "Refined iron used in repairs, tools, and gear.", flavorText: "Honest metal. Heavy, blunt, and refreshingly direct.", sourceTags: ["ingot", "forge"] }),
  defineItem({ id: "steel_ingot", displayName: "Steel Ingot", category: "Material", subtype: "Ingot", rarity: "uncommon", valueBuy: 90, valueSell: 43, cityBias: "ironhall", legalMarketAvailability: ["ironhall"], shortDescription: "Higher-grade metal for better forge work.", flavorText: "Iron after it has had standards imposed on it.", sourceTags: ["ingot", "forge"] }),
  defineItem({ id: "steel_brace", displayName: "Steel Brace", category: "Material", subtype: "Component", rarity: "common", valueBuy: 64, valueSell: 31, cityBias: "ironhall", legalMarketAvailability: ["ironhall", "nexis"], shortDescription: "Industrial bracework for repairs and contracts.", flavorText: "A practical answer to the question, what if this falls over?", sourceTags: ["component", "forge"] }),
  defineItem({ id: "iron_rivets", displayName: "Iron Rivets", category: "Material", subtype: "Component", rarity: "common", valueBuy: 24, valueSell: 12, cityBias: "ironhall", legalMarketAvailability: ["ironhall"], shortDescription: "Small forge parts for sturdy work.", flavorText: "Tiny metal punctuation for things that must stay together.", sourceTags: ["component", "forge"] }),
  defineItem({ id: "vial_of_ink", displayName: "Vial of Ink", category: "Trade Good", subtype: "Office Supply", rarity: "common", valueBuy: 20, valueSell: 10, cityBias: "nexis", legalMarketAvailability: ["nexis", "highcourt"], shortDescription: "Ink for ledgers, forms, and academy notes.", flavorText: "Every empire begins by deciding someone should write this down.", sourceTags: ["civic", "office"] }),
  defineItem({ id: "wax_seal", displayName: "Wax Seal", category: "Trade Good", subtype: "Office Supply", rarity: "common", valueBuy: 26, valueSell: 12, cityBias: "highcourt", legalMarketAvailability: ["nexis", "highcourt"], shortDescription: "A seal used in permits, writs, and cargo certification.", flavorText: "Soft wax, hard consequences.", sourceTags: ["legal", "office"] }),
  defineItem({ id: "sealed_notice", displayName: "Sealed Notice", category: "Trade Good", subtype: "Document", rarity: "common", valueBuy: 38, valueSell: 18, cityBias: "nexis", legalMarketAvailability: ["nexis", "highcourt"], shortDescription: "Official notice stock for couriers and legal offices.", flavorText: "Nobody likes receiving one. That is how you know it works.", sourceTags: ["document", "civic"] }),
  defineItem({ id: "ledger_page", displayName: "Ledger Page", category: "Trade Good", subtype: "Document", rarity: "common", valueBuy: 22, valueSell: 11, cityBias: "nexis", legalMarketAvailability: ["nexis", "highcourt"], shortDescription: "A clean ledger sheet for contract and accounting work.", flavorText: "Blank enough to be optimistic. Briefly.", sourceTags: ["ledger", "civic"] }),
  defineItem({ id: "foreign_token", displayName: "Foreign Token", category: "Trade Good", subtype: "Import", rarity: "uncommon", valueBuy: 70, valueSell: 34, cityBias: "blackharbor", legalMarketAvailability: ["blackharbor", "highcourt"], shortDescription: "Imported small currency and keepsake trade stock.", flavorText: "A coin from elsewhere. Elsewhere has excellent marketing.", sourceTags: ["import", "maritime"] }),
  defineItem({ id: "relic_note", displayName: "Relic Note", category: "Trade Good", subtype: "Relic Paper", rarity: "uncommon", valueBuy: 82, valueSell: 39, cityBias: "silverbough", legalMarketAvailability: ["silverbough", "highcourt"], shortDescription: "A catalog note linked to relic appraisal routes.", flavorText: "Written by someone who used the word probably with confidence.", sourceTags: ["relic", "academy"] }),
  defineItem({ id: "ward_shard", displayName: "Ward Shard", category: "Material", subtype: "Relic Fragment", rarity: "uncommon", valueBuy: 96, valueSell: 46, cityBias: "silverbough", legalMarketAvailability: ["silverbough"], shortDescription: "A fractured ward component used in arcane study.", flavorText: "Still humming. Ideally not at you.", sourceTags: ["ward", "relic"], dropFamilies: ["relic_guardian"] }),
  defineItem({ id: "court_token", displayName: "Court Token", category: "Trade Good", subtype: "Prestige", rarity: "common", valueBuy: 58, valueSell: 28, cityBias: "highcourt", legalMarketAvailability: ["highcourt"], shortDescription: "A formal token used for introductions and petitions.", flavorText: "Proof that someone, somewhere, promised to tolerate your arrival.", sourceTags: ["prestige", "legal"] }),
  defineItem({ id: "prestige_goods", displayName: "Prestige Goods", category: "Trade Good", subtype: "Luxury", rarity: "uncommon", valueBuy: 118, valueSell: 57, cityBias: "highcourt", legalMarketAvailability: ["highcourt"], shortDescription: "Luxury trade stock prized by court-facing buyers.", flavorText: "Useful only because everyone agreed it should be.", sourceTags: ["luxury", "highcourt"] }),
  defineItem({ id: "courier_satchel", displayName: "Courier Satchel", category: "Tool", subtype: "Civic Tool", rarity: "common", valueBuy: 48, valueSell: 22, cityBias: "nexis", legalMarketAvailability: ["nexis"], shortDescription: "A basic bag for dispatch, permit, and contract deliveries.", flavorText: "It holds letters, snacks, and the growing suspicion that routes are personal.", sourceTags: ["civic", "tool"] }),
  defineItem({ id: "shovel", displayName: "Work Shovel", category: "Tool", subtype: "Labor Tool", rarity: "common", valueBuy: 30, valueSell: 14, cityBias: "nexis", legalMarketAvailability: ["nexis", "ironhall"], statModifiers: { workingStats: { manualLabor: 1 } }, shortDescription: "A basic labor tool for early jobs and city work.", flavorText: "The oldest solution to the world being in the wrong place.", sourceTags: ["labor", "starter"] }),
  defineItem({ id: "forged_seal_kit", displayName: "Forged Seal Kit", category: "Black Market", subtype: "Forgery Kit", rarity: "uncommon", valueBuy: 160, valueSell: 74, cityBias: "blackharbor", blackMarketAvailability: ["blackharbor", "highcourt"], requirements: { courses: ["street-survival"] }, lockReasonText: "Requires Street Survival and under-market access.", shortDescription: "A covert kit for counterfeit seals and risky paperwork.", flavorText: "Half craft, half crime, all consequences.", sourceTags: ["black-market", "forgery"] }),
  defineItem({ id: "forged_document", displayName: "Forged Document", category: "Black Market", subtype: "Document", rarity: "uncommon", valueBuy: 140, valueSell: 65, cityBias: "blackharbor", blackMarketAvailability: ["blackharbor", "highcourt"], requirements: { courses: ["street-survival"] }, lockReasonText: "Requires Street Survival to fence safely.", shortDescription: "Risky paperwork bought and sold through under-market buyers.", flavorText: "Every line is technically ink. That is where the innocence ends.", sourceTags: ["black-market", "document"] }),
  defineItem({ id: "ancient_fragment", displayName: "Ancient Fragment", category: "Material", subtype: "Relic Fragment", rarity: "rare", valueBuy: 190, valueSell: 90, cityBias: "silverbough", legalMarketAvailability: ["silverbough"], shortDescription: "A valuable relic fragment for academy and market routes.", flavorText: "Older than the argument about who owns it. Barely.", sourceTags: ["relic", "rare"], dropFamilies: ["relic_guardian"] }),
  defineItem({ id: "gear_cogs", displayName: "Gear Cogs", category: "Material", subtype: "Mechanical Part", rarity: "common", valueBuy: 44, valueSell: 21, cityBias: "ironhall", legalMarketAvailability: ["ironhall"], shortDescription: "Mechanical parts for enginewright and workshop work.", flavorText: "Small teeth for machines that already have too many opinions.", sourceTags: ["enginewright", "component"] }),
  defineItem({ id: "tempered_steel", displayName: "Tempered Steel", category: "Material", subtype: "Refined Material", rarity: "uncommon", valueBuy: 112, valueSell: 54, cityBias: "ironhall", legalMarketAvailability: ["ironhall"], shortDescription: "Refined steel for higher-value forge goods.", flavorText: "Steel after heat, timing, and someone yelling not yet.", sourceTags: ["forge", "rare"] }),
  defineItem({ id: "stolen_coin", displayName: "Stolen Coin", category: "Loot", subtype: "Coin", rarity: "common", valueBuy: 12, valueSell: 6, cityBias: "blackharbor", blackMarketAvailability: ["blackharbor"], shortDescription: "Small illicit coinage taken from road threats.", flavorText: "Money with a previous owner and absolutely no manners.", sourceTags: ["loot", "bandit"], dropFamilies: ["bandit", "pirate"] }),
  defineItem({ id: "raider_token", displayName: "Raider Token", category: "Loot", subtype: "Trophy", rarity: "common", valueBuy: 28, valueSell: 13, cityBias: "neutral", legalMarketAvailability: ["nexis", "ironhall"], shortDescription: "Proof of a cleared raider threat.", flavorText: "A little token saying someone made poor career choices.", sourceTags: ["loot", "raider"], dropFamilies: ["bandit"] }),
  defineItem({ id: "salt_glass_shard", displayName: "Salt-Glass Shard", category: "Loot", subtype: "Maritime Relic", rarity: "uncommon", valueBuy: 74, valueSell: 35, cityBias: "blackharbor", legalMarketAvailability: ["blackharbor", "silverbough"], shortDescription: "A maritime shard prized by strange collectors.", flavorText: "Sea-smooth, sharp-edged, and smug about both.", sourceTags: ["loot", "pirate"], dropFamilies: ["pirate"] }),
  defineItem({ id: "wild_fang", displayName: "Wild Fang", category: "Loot", subtype: "Beast Trophy", rarity: "common", valueBuy: 24, valueSell: 12, cityBias: "silverbough", legalMarketAvailability: ["silverbough"], shortDescription: "A trophy from wild route threats.", flavorText: "A bite mark made portable.", sourceTags: ["loot", "beast"], dropFamilies: ["beast"] }),
  defineItem({ id: "relic_core_splinter", displayName: "Relic Core Splinter", category: "Loot", subtype: "Arcane Fragment", rarity: "rare", valueBuy: 220, valueSell: 105, cityBias: "silverbough", legalMarketAvailability: ["silverbough"], shortDescription: "A rare splinter from a relic guardian core.", flavorText: "It remembers being part of something larger. Dramatic, but useful.", sourceTags: ["loot", "relic"], dropFamilies: ["relic_guardian"] }),
  defineItem({ id: "arena_mark", displayName: "Arena Mark", category: "Loot", subtype: "Arena Token", rarity: "common", valueBuy: 36, valueSell: 17, cityBias: "nexis", legalMarketAvailability: ["nexis"], shortDescription: "A sparring token awarded for controlled arena bouts.", flavorText: "A polite little marker that says the bruises were scheduled.", sourceTags: ["loot", "arena"], dropFamilies: ["city_enforcer", "arena"] }),
];

const ACADEMY_PAIRS = {
  "nexis-hall-of-letters": ["registrar_seal", "annotated_ledger"],
  "nexis-watchhouse-ordered-steel": ["ordered_steel_baton", "oath_guard_insignia"],
  "nexis-chamber-public-ledger": ["charter_medallion", "contract_weights"],
  "blackharbor-tidewright-institute": ["tide_compass", "cargo_tally_slate"],
  "blackharbor-nightwake-lodge": ["smuggler_veil", "shadow_manifest"],
  "blackharbor-corsairs-discipline-yard": ["boarding_hook", "salt_fighting_cord"],
  "silverbough-argent-bough-lyceum": ["sigil_prism", "ley_thread_coil"],
  "silverbough-verdant-hospice": ["restorative_satchel", "grove_salve_kit"],
  "silverbough-house-quiet-leaves": ["moonleaf_focus", "quiet_branch_talisman"],
  "ironhall-foundry-collegium": ["calibrated_hammer", "measure_chain"],
  "ironhall-red-anvil-war-school": ["furnace_crest", "shockplate_vambrace"],
  "ironhall-enginewright-hall": ["gearscript_module", "spark_spindle"],
  "highcourt-orators-academy": ["silver_tongue_token", "rhetoric_codex"],
  "highcourt-college-of-civic-law": ["magistrate_seal", "clausebinder_folio"],
  "highcourt-sunspire-institute-statecraft": ["state_sigil", "sunmarked_briefcase"],
};

const ACADEMY_ITEM_META = {
  registrar_seal: ["Registrar Seal", "nexis", "Civic Seal", "Marks the holder as trained in registry handling.", "A stamp that turns uncertainty into an appointment."],
  annotated_ledger: ["Annotated Ledger", "nexis", "Study Manual", "A Hall of Letters manual for dispatch and permit study.", "Margins packed with warnings from clerks who have seen things."],
  ordered_steel_baton: ["Ordered Steel Baton", "nexis", "Watch Weapon", "A disciplined watch weapon for defensive combat paths.", "Short, official, and allergic to nonsense."],
  oath_guard_insignia: ["Oath Guard Insignia", "nexis", "Insignia", "A watchhouse badge that reinforces defensive discipline.", "A little metal reminder that standing firm is also work."],
  charter_medallion: ["Charter Medallion", "nexis", "Ledger Charm", "A public-ledger token for contract and charter fluency.", "Heavy enough to prove the city takes accounting personally."],
  contract_weights: ["Contract Weights", "nexis", "Ledger Tool", "Weighted markers used for contract audits and pricing drills.", "For numbers that keep trying to drift into fraud."],
  tide_compass: ["Tide Compass", "blackharbor", "Maritime Tool", "A Tidewright compass for safer route and cargo work.", "Points north, unless the tide has a more profitable suggestion."],
  cargo_tally_slate: ["Cargo Tally Slate", "blackharbor", "Maritime Ledger", "A slate for tracking cargo hands, crates, and excuses.", "Chalk marks survive rain better than most dock promises."],
  smuggler_veil: ["Smuggler's Veil", "blackharbor", "Covert Gear", "A Nightwake veil for shadow movement and under-market work.", "A polite curtain between you and obvious questions."],
  shadow_manifest: ["Shadow Manifest", "blackharbor", "Covert Document", "A covert training manifest for dockside infiltration.", "Every name is probably false. Admirably consistent."],
  boarding_hook: ["Boarding Hook", "blackharbor", "Corsair Tool", "A hook for deck movement, escort pressure, and cargo fights.", "It asks one question: closer or overboard?"],
  salt_fighting_cord: ["Salt-Cured Fighting Cord", "blackharbor", "Corsair Gear", "A cord used for grip, binding, and disciplined deck drills.", "Salt stiff, knotted tight, and not remotely decorative."],
  sigil_prism: ["Sigil Prism", "silverbough", "Arcane Focus", "A Lyceum prism for cleaner ward and fire-channel work.", "The light inside behaves better than most students."],
  ley_thread_coil: ["Ley-Thread Coil", "silverbough", "Arcane Reagent", "A coil used to trace ward routes and relic fields.", "Thread that remembers where power has been walking."],
  restorative_satchel: ["Restorative Satchel", "silverbough", "Medic Kit", "A Verdant Hospice kit for field healing and triage.", "Organized by urgency, because panic has terrible handwriting."],
  grove_salve_kit: ["Grove Salve Kit", "silverbough", "Healing Kit", "A salve kit for Silverbough recovery work.", "Smells like rain, leaves, and people pretending they followed instructions."],
  moonleaf_focus: ["Moonleaf Focus", "silverbough", "Mystic Focus", "A Quiet Leaves focus for stealthy ward movement.", "A pale charm that prefers moonlight and plausible silence."],
  quiet_branch_talisman: ["Quiet Branch Talisman", "silverbough", "Mystic Charm", "A talisman for subtle movement and grove discipline.", "It does not hide you. It teaches your boots manners."],
  calibrated_hammer: ["Calibrated Hammer", "ironhall", "Forge Tool", "A Foundry Collegium hammer for precise material work.", "Still a hammer. Just smug about being measured."],
  measure_chain: ["Measure Chain", "ironhall", "Forge Tool", "A measuring chain for material ledgers and bracework.", "Counts twice so the foreman only shouts once."],
  furnace_crest: ["Furnace Crest", "ironhall", "War School Insignia", "A Red Anvil crest for heavy combat discipline.", "Worn by people who consider impact a sentence structure."],
  shockplate_vambrace: ["Shockplate Vambrace", "ironhall", "Heavy Armor", "A plated vambrace for hard blocks and heavy strikes.", "It turns bad timing into a louder lesson."],
  gearscript_module: ["Gearscript Module", "ironhall", "Enginewright Module", "A module used for enginewright study and spark work.", "The script is tiny. The consequences are not."],
  spark_spindle: ["Spark Spindle", "ironhall", "Engine Focus", "An enginewright spindle for current control.", "A small machine that makes lightning look employed."],
  silver_tongue_token: ["Silver Tongue Token", "highcourt", "Rhetoric Token", "An Orator token for argument, influence, and court pressure.", "Not a bribe. A reminder that presentation has a budget."],
  rhetoric_codex: ["Rhetoric Codex", "highcourt", "Study Codex", "A codex of formal pressure and chamber argument.", "All the polite ways to win a room without raising your voice."],
  magistrate_seal: ["Magistrate Seal", "highcourt", "Legal Seal", "A civic-law seal used in petitions and legal study.", "Small seal, large pause in every conversation."],
  clausebinder_folio: ["Clausebinder Folio", "highcourt", "Legal Folio", "A folio for binding clauses, filings, and practical law drills.", "The pages rustle like they are billing by the hour."],
  state_sigil: ["State Sigil", "highcourt", "Statecraft Token", "A Sunspire sigil for statecraft and leadership routes.", "A symbol for making the room believe the plan was always obvious."],
  sunmarked_briefcase: ["Sunmarked Briefcase", "highcourt", "Diplomatic Kit", "A statecraft case for briefings, permits, and delicate papers.", "Carries documents, leverage, and lunch if you are brave."],
};

function academyItem(id, academyId) {
  const [displayName, cityBias, subtype, shortDescription, flavorText] = ACADEMY_ITEM_META[id];
  const equipmentById = {
    ordered_steel_baton: { equipSlot: "weapon", statModifiers: { battleStats: { defense: 1, strength: 1 } }, combatModifiers: { mitigationBonus: 0.02 } },
    smuggler_veil: { equipSlot: "helmet", statModifiers: { battleStats: { dexterity: 2, speed: 1 } }, combatModifiers: { evadeBonus: 3 } },
    boarding_hook: { equipSlot: "weapon", statModifiers: { battleStats: { strength: 2, speed: 1 } }, combatModifiers: { accuracyBonus: 2 } },
    sigil_prism: { equipSlot: "focus", statModifiers: { workingStats: { intelligence: 2 } }, combatModifiers: { damageMultiplier: 0.04 } },
    moonleaf_focus: { equipSlot: "focus", statModifiers: { battleStats: { dexterity: 1 }, workingStats: { intelligence: 1 } }, combatModifiers: { evadeBonus: 2 } },
    calibrated_hammer: { equipSlot: "weapon", statModifiers: { battleStats: { strength: 2 }, workingStats: { manualLabor: 1 } }, combatModifiers: { damageMultiplier: 0.04 } },
    shockplate_vambrace: { equipSlot: "gloves", statModifiers: { battleStats: { defense: 2, strength: 1 } }, combatModifiers: { mitigationBonus: 0.03 } },
    spark_spindle: { equipSlot: "focus", statModifiers: { workingStats: { intelligence: 1 }, battleStats: { dexterity: 1 } }, combatModifiers: { critBonus: 2 } },
  };
  const accessoryIds = new Set(["registrar_seal", "oath_guard_insignia", "charter_medallion", "tide_compass", "furnace_crest", "silver_tongue_token", "magistrate_seal", "state_sigil"]);
  const equipment = equipmentById[id] ?? (accessoryIds.has(id) ? { allowedSlots: ["accessory1", "accessory2", "trinket"], statModifiers: { workingStats: { intelligence: 1 } } } : {});
  const category = equipment.equipSlot || equipment.allowedSlots ? "Equipment" : "Academy";
  return defineItem({
    id,
    displayName,
    category,
    subtype,
    rarity: category === "Equipment" ? "uncommon" : "common",
    valueBuy: category === "Equipment" ? 160 : 76,
    valueSell: category === "Equipment" ? 74 : 34,
    cityBias,
    sourceCity: cityBias,
    legalMarketAvailability: [],
    blackMarketAvailability: id.includes("shadow") || id.includes("smuggler") ? ["blackharbor"] : [],
    academyTags: [academyId],
    sourceTags: ["academy", academyId, cityBias],
    shortDescription,
    flavorText,
    ...equipment,
  });
}

const ACADEMY_ITEMS = Object.entries(ACADEMY_PAIRS).flatMap(([academyId, itemIds]) => itemIds.map((itemId) => academyItem(itemId, academyId)));

const EXTRA_ITEMS = [
  defineItem({ id: "contraband_satchel", displayName: "Contraband Satchel", category: "Black Market", subtype: "Smuggler Tool", rarity: "uncommon", valueBuy: 145, valueSell: 66, cityBias: "blackharbor", blackMarketAvailability: ["blackharbor"], requirements: { courses: ["street-survival"] }, lockReasonText: "Requires Street Survival and under-market access.", shortDescription: "A smuggler bag for discreet cargo and risky routes.", flavorText: "Looks ordinary, which is the whole expensive point.", sourceTags: ["black-market", "smuggling", "tool"] }),
  defineItem({ id: "watch_baton", displayName: "Watch Baton", category: "Equipment", subtype: "Civic Weapon", equipSlot: "weapon", rarity: "common", valueBuy: 82, valueSell: 38, cityBias: "nexis", legalMarketAvailability: ["nexis"], statModifiers: { battleStats: { defense: 1, strength: 1 } }, combatModifiers: { mitigationBonus: 0.01 }, shortDescription: "A starter civic weapon for controlled defensive fighting.", flavorText: "Not glamorous. Very persuasive in cramped streets.", sourceTags: ["watch", "starter", "melee"] }),
];

const RAW_ITEMS = [...CORE_ITEMS, ...ACADEMY_ITEMS, ...EXTRA_ITEMS];
const CATALOGUE_MAP = new Map(RAW_ITEMS.map((item) => [item.id, item]));

export const ACADEMY_ITEM_REWARDS = Object.fromEntries(Object.entries(ACADEMY_PAIRS).map(([academyId, itemIds]) => [academyId, itemIds]));
export const ITEM_CATALOGUE = Object.fromEntries(CATALOGUE_MAP.entries());

function fallbackItem(itemId) {
  const displayName = titleFromId(itemId);
  return defineItem({
    id: itemId,
    displayName,
    category: "Material",
    subtype: "Uncatalogued",
    rarity: "common",
    valueBuy: 20,
    valueSell: 10,
    shortDescription: `${displayName} is tracked by inventory but has not received authored item metadata yet.`,
    flavorText: "A ledger entry waiting for its proper place in the world.",
    sourceTags: ["legacy-catalogue"],
  });
}

export function getItemDefinition(itemId) {
  if (typeof itemId !== "string" || !itemId.trim()) return null;
  return CATALOGUE_MAP.get(itemId) ?? fallbackItem(itemId);
}

export function getItemDefinitions() {
  return Array.from(CATALOGUE_MAP.values());
}

export function getItemDisplayName(itemId) {
  return getItemDefinition(itemId)?.displayName ?? titleFromId(itemId);
}

export function getAllowedEquipSlots(item) {
  const definition = typeof item === "string" ? getItemDefinition(item) : item;
  if (!definition) return [];
  if (Array.isArray(definition.allowedSlots)) return definition.allowedSlots.filter((slot) => EQUIPMENT_SLOTS.includes(slot));
  if (definition.equipSlot && EQUIPMENT_SLOTS.includes(definition.equipSlot)) return [definition.equipSlot];
  return [];
}

export function isEquippable(itemId) {
  return getAllowedEquipSlots(itemId).length > 0;
}

export function isUsable(itemId) {
  return asArray(getItemDefinition(itemId)?.useEffects).length > 0;
}

export function summarizeItemEffects(item) {
  const definition = typeof item === "string" ? getItemDefinition(item) : item;
  if (!definition) return [];
  const effects = [];
  const statGroups = asRecord(definition.statModifiers);
  for (const [group, values] of Object.entries(statGroups)) {
    for (const [key, value] of Object.entries(asRecord(values))) effects.push(`${key} ${Number(value) >= 0 ? "+" : ""}${value} (${group})`);
  }
  for (const [key, value] of Object.entries(asRecord(definition.combatModifiers))) effects.push(`${key} ${Number(value) >= 0 ? "+" : ""}${value}`);
  for (const effect of asArray(definition.useEffects)) {
    if (effect.type === "restore_health") effects.push(`Restore ${effect.amount} health`);
    else if (effect.type === "restore_stamina") effects.push(`Restore ${effect.amount} stamina`);
    else if (effect.type === "restore_energy") effects.push(`Restore ${effect.amount} energy`);
    else if (effect.type === "combat_buff") effects.push(`Next fight: ${effect.effect} +${effect.amount}`);
  }
  return effects;
}

export function getItemSummary(itemId) {
  const item = getItemDefinition(itemId);
  if (!item) return null;
  return {
    id: item.id,
    displayName: item.displayName,
    category: item.category,
    subtype: item.subtype,
    rarity: item.rarity,
    equipSlot: item.equipSlot,
    allowedSlots: getAllowedEquipSlots(item),
    stackLimit: item.stackLimit,
    valueBuy: item.valueBuy,
    valueSell: item.valueSell,
    cityBias: item.cityBias,
    sourceCity: item.sourceCity,
    statModifiers: item.statModifiers,
    combatModifiers: item.combatModifiers,
    useEffects: item.useEffects,
    requirements: item.requirements,
    lockReasonText: item.lockReasonText,
    shortDescription: item.shortDescription,
    flavorText: item.flavorText,
    sourceTags: item.sourceTags,
    academyTags: item.academyTags,
    iconKey: item.iconKey,
    iconBrief: item.iconBrief,
    iconPalette: item.iconPalette,
    iconSilhouette: item.iconSilhouette,
    iconRarityFrame: item.iconRarityFrame,
    effectSummary: summarizeItemEffects(item),
  };
}

export function getIconManifest() {
  return getItemDefinitions().map((item) => ({
    itemId: item.id,
    iconKey: item.iconKey,
    iconBrief: item.iconBrief,
    iconPalette: item.iconPalette,
    iconSilhouette: item.iconSilhouette,
    iconRarityFrame: item.iconRarityFrame,
  }));
}
