export const EQUIPMENT_SLOTS = [
  "weapon",
  "offhand",
  "armor",
  "helmet",
  "gloves",
  "legs",
  "boots",
  "accessory1",
  "accessory2",
  "focus",
  "trinket",
];

export const VISUAL_EQUIPMENT_SLOTS = ["head", "chest", "hands", "legs", "feet", "outerwear", "accessory"];

export const DAMAGE_TYPES = ["Slashing", "Piercing", "Bludgeoning", "Magical", "Fire", "Cold", "Lightning", "Poison"];
export const ARMOR_REDUCTION_CAP = 45;
export const WEAPON_ACCURACY_BASELINE = 75;

export const RARITY_FRAMES = {
  common: "plain-iron",
  uncommon: "brass-trim",
  rare: "blue-steel",
  epic: "violet-arc",
  legendary: "gold-writ",
  legacy: "gold-writ",
};

export const ARMOR_SETS = {
  nexis_watch: { id: "nexis_watch", name: "Nexis Watch Set", city: "nexis", theme: "Civic guard armor for disciplined street defense.", profile: ["Slashing", "Piercing"], pieces: ["watch_helm", "watch_brigandine", "watch_vambraces", "watch_tassets", "watch_marching_boots"], bonuses: { 2: { label: "Watch Pair: Slashing and Piercing DR +2%", reductions: { Slashing: 2, Piercing: 2 } }, 3: { label: "Ordered Line: Slashing and Piercing DR +2%", reductions: { Slashing: 2, Piercing: 2 } }, 5: { label: "Full Watch Detail: Slashing and Piercing DR +3%", reductions: { Slashing: 3, Piercing: 3 } } } },
  blackharbor_corsair: { id: "blackharbor_corsair", name: "Blackharbor Corsair Set", city: "blackharbor", theme: "Maritime raider armor for deck fighting and toxin work.", profile: ["Piercing", "Poison"], pieces: ["corsair_bandana", "saltcoat", "deck_gloves", "bilge_trousers", "reef_boots"], bonuses: { 2: { label: "Deck Pair: Piercing and Poison DR +2%", reductions: { Piercing: 2, Poison: 2 } }, 3: { label: "Salt Line: Piercing and Poison DR +2%", reductions: { Piercing: 2, Poison: 2 } }, 5: { label: "Full Corsair Rig: Piercing and Poison DR +3%", reductions: { Piercing: 3, Poison: 3 } } } },
  silverbough_warden: { id: "silverbough_warden", name: "Silverbough Warden Set", city: "silverbough", theme: "Grove warding armor for arcane and venomous threats.", profile: ["Magical", "Poison"], pieces: ["warden_hood", "grove_mantle", "mosswrap_gloves", "briarweave_leggings", "rootstep_boots"], bonuses: { 2: { label: "Grove Pair: Magical and Poison DR +2%", reductions: { Magical: 2, Poison: 2 } }, 3: { label: "Rooted Guard: Magical and Poison DR +2%", reductions: { Magical: 2, Poison: 2 } }, 5: { label: "Full Warden Binding: Magical and Poison DR +3%", reductions: { Magical: 3, Poison: 3 } } } },
  ironhall_bulwark: { id: "ironhall_bulwark", name: "Ironhall Bulwark Set", city: "ironhall", theme: "Forge-bred heavy armor for hammer and axe pressure.", profile: ["Bludgeoning", "Slashing"], pieces: ["rivet_helm", "forgeplate_cuirass", "hammergrip_gauntlets", "anvil_greaves", "furnace_boots"], bonuses: { 2: { label: "Rivet Pair: Bludgeoning and Slashing DR +2%", reductions: { Bludgeoning: 2, Slashing: 2 } }, 3: { label: "Forge Line: Bludgeoning and Slashing DR +2%", reductions: { Bludgeoning: 2, Slashing: 2 } }, 5: { label: "Full Bulwark Harness: Bludgeoning and Slashing DR +3%", reductions: { Bludgeoning: 3, Slashing: 3 } } } },
  highcourt_bastion: { id: "highcourt_bastion", name: "Highcourt Bastion Set", city: "highcourt", theme: "Prestige armor for court guards and warded authority.", profile: ["Piercing", "Magical"], pieces: ["court_visor", "bastion_coat", "sealbound_gloves", "tribunal_legguards", "magistrate_boots"], bonuses: { 2: { label: "Court Pair: Piercing and Magical DR +2%", reductions: { Piercing: 2, Magical: 2 } }, 3: { label: "Sealed Detail: Piercing and Magical DR +2%", reductions: { Piercing: 2, Magical: 2 } }, 5: { label: "Full Bastion Attire: Piercing and Magical DR +3%", reductions: { Piercing: 3, Magical: 3 } } } },
  concordant_aegis: { id: "concordant_aegis", name: "Concordant Aegis Set", city: "neutral", theme: "Legendary all-round armor that favors coverage over specialization.", profile: DAMAGE_TYPES, pieces: ["concordant_circlet", "concordant_vestment", "concordant_grips", "concordant_legguards", "concordant_striders"], bonuses: { 2: { label: "Concordant Pair: all DR +1%", reductions: Object.fromEntries(DAMAGE_TYPES.map((type) => [type, 1])) }, 3: { label: "Balanced Ward: all DR +1%", reductions: Object.fromEntries(DAMAGE_TYPES.map((type) => [type, 1])) }, 5: { label: "Full Aegis Concord: all DR +2%", reductions: Object.fromEntries(DAMAGE_TYPES.map((type) => [type, 2])) } } },
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
    : category === "Clothing"
      ? "tailored-garment"
      : category === "Consumable"
        ? "stoppered-vial"
        : category === "Tool"
          ? "handled-tool"
          : category === "Academy"
            ? "academy-token"
            : category === "Trade Good"
              ? "bound-crate"
              : "small-ledger-object";
  return { iconKey: `${id}_icon`, iconBrief: `${titleFromId(id)} as a readable ${category.toLowerCase()} icon with strong silhouette and Nexis UI contrast.`, iconPalette: palette, iconSilhouette: silhouette, iconRarityFrame: RARITY_FRAMES[rarity] ?? RARITY_FRAMES.common };
}

function normalizeWeaponStats(input) {
  const stats = asRecord(input);
  if (!Object.keys(stats).length) return null;
  const damageRange = Array.isArray(stats.damageRange) ? stats.damageRange : [stats.damageMin, stats.damageMax];
  const damageMin = Math.max(0, Number(damageRange[0] ?? stats.damageMin ?? stats.baseDamage ?? 0));
  const damageMax = Math.max(damageMin, Number(damageRange[1] ?? stats.damageMax ?? stats.baseDamage ?? damageMin));
  const damageType = DAMAGE_TYPES.includes(stats.damageType) ? stats.damageType : "Slashing";
  return { damageMin, damageMax, damageType, accuracy: Math.max(1, Math.min(99, Number(stats.accuracy ?? WEAPON_ACCURACY_BASELINE))), handedness: stats.handedness ?? "oneHand", critBonus: Number(stats.critBonus ?? 0), speed: Number(stats.speed ?? 0), penetration: Number(stats.penetration ?? 0) };
}

function normalizeArmorStats(input) {
  const stats = asRecord(input);
  if (!Object.keys(stats).length) return null;
  const reductions = {};
  for (const [type, amount] of Object.entries(asRecord(stats.reductions))) {
    if (!DAMAGE_TYPES.includes(type)) continue;
    const numeric = Math.max(0, Math.min(ARMOR_REDUCTION_CAP, Number(amount) || 0));
    if (numeric) reductions[type] = numeric;
  }
  return { weightClass: stats.weightClass ?? "medium", reductions, setId: stats.setId ?? null };
}

function inferItemRole(input, category, weaponStats, armorStats) {
  if (input.itemRole) return input.itemRole;
  if (weaponStats) return "weapon";
  if (armorStats) return "armor";
  if (category === "Clothing") return "visual";
  if (category === "Consumable") return "consumable";
  if (category === "Trade Good") return "trade";
  if (category === "Material" || category === "Loot") return "material";
  return "utility";
}

function defineItem(input) {
  const rarity = input.rarity ?? "common";
  const category = input.category ?? "Material";
  const cityBias = input.cityBias ?? input.sourceCity ?? "neutral";
  const icon = iconDefaults(input.id, category, rarity, cityBias);
  const weaponStats = normalizeWeaponStats(input.weaponStats);
  const armorStats = normalizeArmorStats(input.armorStats);
  const itemRole = inferItemRole(input, category, weaponStats, armorStats);
  return { id: input.id, displayName: input.displayName ?? titleFromId(input.id), category, subtype: input.subtype ?? category, rarity, itemRole, equipSlot: input.equipSlot ?? null, allowedSlots: input.allowedSlots ?? null, visualSlot: input.visualSlot ?? null, allowedVisualSlots: input.allowedVisualSlots ?? null, visualOnly: Boolean(input.visualOnly ?? category === "Clothing"), stackLimit: input.stackLimit ?? (category === "Equipment" || category === "Clothing" ? 1 : 99), valueBuy: input.valueBuy ?? 20, valueSell: input.valueSell ?? Math.max(1, Math.floor((input.valueBuy ?? 20) * 0.5)), cityBias, sourceCity: input.sourceCity ?? cityBias, legalMarketAvailability: input.legalMarketAvailability ?? [], blackMarketAvailability: input.blackMarketAvailability ?? [], statModifiers: input.statModifiers ?? {}, combatModifiers: input.combatModifiers ?? {}, weaponStats, armorStats, setId: input.setId ?? armorStats?.setId ?? null, useEffects: input.useEffects ?? [], passiveEffects: input.passiveEffects ?? {}, requirements: input.requirements ?? {}, lockReasonText: input.lockReasonText ?? null, shortDescription: input.shortDescription ?? `A ${category.toLowerCase()} used in Nexis progression.`, flavorText: input.flavorText ?? "Registered in the Nexis ledger with standard source marks.", sourceTags: input.sourceTags ?? [], academyTags: input.academyTags ?? [], marketEligible: input.marketEligible ?? true, ...icon, ...(input.iconBrief ? { iconBrief: input.iconBrief } : {}), ...(input.iconPalette ? { iconPalette: input.iconPalette } : {}), ...(input.iconSilhouette ? { iconSilhouette: input.iconSilhouette } : {}), ...(input.lootWeight ? { lootWeight: input.lootWeight } : {}), ...(input.dropFamilies ? { dropFamilies: input.dropFamilies } : {}) };
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
  defineItem({ id: "scrap_metal", displayName: "Scrap Metal", category: "Material", subtype: "Salvage", rarity: "common", valueBuy: 16, valueSell: 7, cityBias: "ironhall", legalMarketAvailability: ["ironhall"], shortDescription: "Recovered metal used for repair kits and basic smithing.", flavorText: "Formerly something important. Now helpfully honest about being scrap.", sourceTags: ["salvage", "smithing"] }),
  defineItem({ id: "rough_wood", displayName: "Rough Wood", category: "Material", subtype: "Salvage", rarity: "common", valueBuy: 14, valueSell: 6, cityBias: "nexis", legalMarketAvailability: ["nexis", "blackharbor"], shortDescription: "Rough salvage timber for field gear and utility recipes.", flavorText: "Splintery, stubborn, and exactly as refined as the price suggests.", sourceTags: ["salvage", "utility"] }),
  defineItem({ id: "empty_vials", displayName: "Empty Vials", category: "Material", subtype: "Alchemy Vessel", rarity: "common", valueBuy: 18, valueSell: 8, cityBias: "silverbough", legalMarketAvailability: ["silverbough", "blackharbor"], shortDescription: "Clean vials used for tonics, oils, and ward salts.", flavorText: "Empty for now. Optimistic, really.", sourceTags: ["alchemy", "vial"] }),
  defineItem({ id: "field_repair_kit", displayName: "Field Repair Kit", category: "Tool", subtype: "Maintenance Kit", rarity: "common", valueBuy: 78, valueSell: 35, cityBias: "ironhall", legalMarketAvailability: ["ironhall"], shortDescription: "A compact kit used to maintain equipped gear for several hours.", flavorText: "Rivets, straps, oil, and the quiet threat of doing maintenance properly.", sourceTags: ["repair", "smithing", "tool"] }),
  defineItem({ id: "travel_rig", displayName: "Travel Rig", category: "Tool", subtype: "Travel Kit", rarity: "uncommon", valueBuy: 135, valueSell: 62, cityBias: "nexis", legalMarketAvailability: ["nexis"], passiveEffects: { travelClarity: 2 }, shortDescription: "A bundled satchel, rope, and light kit for route-heavy play.", flavorText: "For travelers who enjoy arriving with both plans and ankles intact.", sourceTags: ["travel", "utility", "crafted"] }),
  defineItem({ id: "ward_charm", displayName: "Ward Charm", category: "Equipment", subtype: "Ward Trinket", allowedSlots: ["accessory1", "accessory2", "trinket"], rarity: "uncommon", valueBuy: 190, valueSell: 86, cityBias: "silverbough", legalMarketAvailability: ["silverbough"], statModifiers: { workingStats: { intelligence: 1 }, battleStats: { defense: 1 } }, combatModifiers: { mitigationBonus: 0.02 }, shortDescription: "A crafted ward charm that slightly improves combat mitigation.", flavorText: "It hums when danger is nearby, which is useful and extremely annoying.", sourceTags: ["ward", "crafted", "arcane"] }),
  defineItem({ id: "legal_seal_kit", displayName: "Legal Seal Kit", category: "Tool", subtype: "Legal Kit", rarity: "common", valueBuy: 82, valueSell: 38, cityBias: "highcourt", legalMarketAvailability: ["highcourt"], passiveEffects: { civicPaperwork: 1 }, shortDescription: "A court-ready kit for filings, petitions, and civic contracts.", flavorText: "Everything needed to make paper look terrifyingly official.", sourceTags: ["legal", "crafted", "tool"] }),
  defineItem({ id: "writ_case", displayName: "Writ Case", category: "Equipment", subtype: "Prestige Case", allowedSlots: ["accessory1", "accessory2", "trinket"], rarity: "uncommon", valueBuy: 210, valueSell: 98, cityBias: "highcourt", legalMarketAvailability: ["highcourt"], statModifiers: { workingStats: { intelligence: 2, endurance: 1 } }, passiveEffects: { sellBonusPercent: 1 }, shortDescription: "A formal case that supports legal, civic, and trade presentation.", flavorText: "Carries documents with the confidence of a person who charges consultation fees.", sourceTags: ["legal", "prestige", "crafted"] }),
  defineItem({ id: "contraband_satchel", displayName: "Contraband Satchel", category: "Black Market", subtype: "Smuggler Tool", rarity: "uncommon", valueBuy: 145, valueSell: 66, cityBias: "blackharbor", blackMarketAvailability: ["blackharbor"], requirements: { courses: ["street-survival"] }, lockReasonText: "Requires Street Survival and under-market access.", shortDescription: "A smuggler bag for discreet cargo and risky routes.", flavorText: "Looks ordinary, which is the whole expensive point.", sourceTags: ["black-market", "smuggling", "tool"] }),
  defineItem({ id: "watch_baton", displayName: "Watch Baton", category: "Equipment", subtype: "Civic Weapon", equipSlot: "weapon", rarity: "common", valueBuy: 82, valueSell: 38, cityBias: "nexis", legalMarketAvailability: ["nexis"], statModifiers: { battleStats: { defense: 1, strength: 1 } }, combatModifiers: { mitigationBonus: 0.01 }, shortDescription: "A starter civic weapon for controlled defensive fighting.", flavorText: "Not glamorous. Very persuasive in cramped streets.", sourceTags: ["watch", "starter", "melee"] }),
];

const PASS_WEAPONS = [
  ["quick_knife", "Quick Knife", "common", "Light Blade", "weapon", "oneHand", "Slashing", 6, 10, 84, "nexis", 95, "A short civic blade built for quick, reliable street fighting.", "Balanced for fast draws in crowded lanes."],
  ["market_dagger", "Market Dagger", "common", "Dagger", "weapon", "oneHand", "Piercing", 6, 9, 86, "nexis", 88, "A compact dagger suited to close work and cautious travel.", "Stamped with a plain trader's mark."],
  ["watchmans_short_blade", "Watchman's Short Blade", "common", "Short Blade", "weapon", "oneHand", "Slashing", 8, 12, 80, "nexis", 116, "A civic sidearm made for steady guard drills and alley fights.", "Its edge is practical before it is pretty."],
  ["registry_mace", "Registry Mace", "common", "Mace", "weapon", "oneHand", "Bludgeoning", 8, 13, 77, "nexis", 118, "A blunt civic weapon favored by clerks who expect trouble.", "Heavy enough to end arguments without drawing blood first."],
  ["dock_shiv", "Dock Shiv", "common", "Knife", "weapon", "oneHand", "Piercing", 7, 11, 82, "blackharbor", 102, "A narrow dockside blade for quick thrusts and rough escorts.", "The grip is wrapped against rain and salt."],
  ["rivet_hatchet", "Rivet Hatchet", "common", "Hatchet", "weapon", "oneHand", "Slashing", 9, 14, 75, "ironhall", 122, "A compact forge hatchet that trades finesse for reliable bite.", "The head bears old hammer marks from honest work."],
  ["road_spear", "Road Spear", "common", "Spear", "weapon", "twoHand", "Piercing", 8, 13, 79, "nexis", 124, "A simple spear for caravan guards and cautious road fighters.", "Its ash haft is marked with route notches."],
  ["pilgrim_staff", "Pilgrim Staff", "common", "Staff", "weapon", "twoHand", "Bludgeoning", 7, 12, 81, "silverbough", 90, "A travel staff that doubles as a measured defensive weapon.", "Smooth from long walks and longer waits."],
  ["thorn_focus", "Thorn Focus", "common", "Arcane Focus", "focus", "focus", "Magical", 6, 11, 83, "silverbough", 132, "A small thorn-bound focus for controlled novice spellwork.", "The thorns curl inward around a clear bead."],
  ["clerks_baton", "Clerk's Baton", "common", "Baton", "weapon", "oneHand", "Bludgeoning", 5, 9, 88, "highcourt", 84, "A light baton made for accurate strikes and formal restraint.", "Polished wood, weighted core, no wasted flourish."],
  ["harbor_rapier", "Harbor Rapier", "uncommon", "Rapier", "weapon", "oneHand", "Piercing", 11, 17, 86, "blackharbor", 235, "A fast maritime blade for thrusting around rigging and rails.", "The guard is narrow enough for cramped decks."],
  ["corsair_saber", "Corsair Saber", "uncommon", "Saber", "weapon", "oneHand", "Slashing", 13, 19, 80, "blackharbor", 255, "A curved deck blade made for sweeping cuts in close quarters.", "Salt-darkened steel holds a clean edge."],
  ["willow_ward_staff", "Willow Ward Staff", "uncommon", "Ward Staff", "focus", "twoHand", "Magical", 11, 17, 84, "silverbough", 265, "A ward staff for steady arcane pressure and defensive casting.", "Willow grain runs beneath thin silver inlay."],
  ["groveglass_wand", "Groveglass Wand", "uncommon", "Wand", "focus", "oneHand", "Magical", 10, 16, 88, "silverbough", 245, "A precise wand for accurate magical strikes and ward practice.", "Green glass catches light even under cloud."],
  ["foundry_hammer", "Foundry Hammer", "uncommon", "Hammer", "weapon", "oneHand", "Bludgeoning", 14, 21, 74, "ironhall", 270, "A heavy foundry hammer for direct armor-breaking blows.", "The handle is wrapped in heat-darkened leather."],
  ["forge_pike", "Forge Pike", "uncommon", "Pike", "weapon", "twoHand", "Piercing", 13, 20, 78, "ironhall", 285, "A long pike for keeping brutal fights at working distance.", "Its socket is reinforced with black iron bands."],
  ["bailiffs_longsword", "Bailiff's Longsword", "uncommon", "Longsword", "weapon", "oneHand", "Slashing", 13, 19, 82, "highcourt", 270, "A balanced legal blade used by court officers and escorts.", "The fuller carries a small seal near the guard."],
  ["chainhook_axe", "Chainhook Axe", "uncommon", "Axe", "weapon", "twoHand", "Slashing", 15, 22, 73, "ironhall", 300, "A hooked axe for pulling guards open before the main cut lands.", "Built around leverage rather than elegance."],
  ["salthook_polearm", "Salthook Polearm", "rare", "Polearm", "weapon", "twoHand", "Piercing", 18, 27, 80, "blackharbor", 520, "A rare boarding polearm for reach, control, and deep thrusts.", "Its hook is worn bright from rail work."],
  ["relicglass_rod", "Relicglass Rod", "rare", "Arcane Rod", "focus", "oneHand", "Magical", 17, 26, 86, "silverbough", 545, "A refined rod that channels relic-laced force with steady accuracy.", "Tiny motes turn inside the glass core."],
  ["chainbreaker_maul", "Chainbreaker Maul", "rare", "Maul", "weapon", "twoHand", "Bludgeoning", 21, 31, 70, "ironhall", 560, "A brutal maul for crushing armor and stubborn defenses.", "Each face is scarred from controlled ruin."],
  ["edict_blade", "Edict Blade", "rare", "Court Blade", "weapon", "oneHand", "Slashing", 18, 26, 84, "highcourt", 550, "A formal rare blade for decisive cuts under court authority.", "A fine line of gold marks the spine."],
  ["blackwake_knife", "Blackwake Knife", "rare", "Knife", "weapon", "oneHand", "Piercing", 16, 24, 90, "blackharbor", 500, "A narrow rare knife for covert work and precise openings.", "Dark oil keeps the blade quiet in the sheath."],
  ["emberbind_scepter", "Emberbind Scepter", "rare", "Scepter", "focus", "oneHand", "Fire", 18, 27, 82, "ironhall", 575, "A rare scepter that binds forge heat into focused strikes.", "The head glows softly after hard use."],
  ["concordant_blade", "Concordant Blade", "legendary", "Concordant Weapon", "weapon", "oneHand", "Slashing", 24, 36, 88, "neutral", 2500, "A legendary blade balanced for strong damage without losing accuracy.", "Its edge carries faint marks from five city traditions."],
  ["concordant_staff", "Concordant Staff", "legendary", "Concordant Focus", "focus", "twoHand", "Magical", 22, 34, 86, "neutral", 2450, "A legendary staff built for controlled universal arcane pressure.", "Set rings from several schools bind the core in harmony."],
];

function passWeapon([id, displayName, rarity, subtype, slot, handedness, damageType, damageMin, damageMax, accuracy, cityBias, valueBuy, shortDescription, flavorText]) {
  const covert = id.includes("blackwake");
  return defineItem({ id, displayName, category: "Equipment", subtype, itemRole: "weapon", equipSlot: slot, rarity, valueBuy, valueSell: Math.max(1, Math.floor(valueBuy * 0.46)), cityBias, sourceCity: cityBias, legalMarketAvailability: rarity === "legendary" || covert ? [] : cityBias === "neutral" ? ["nexis", "highcourt"] : [cityBias], blackMarketAvailability: covert ? ["blackharbor"] : [], weaponStats: { damageMin, damageMax, accuracy, damageType, handedness }, shortDescription, flavorText, sourceTags: ["itemization", "weapon", cityBias, damageType.toLowerCase()] });
}

const PASS_ARMOR = [
  ["watch_helm", "Watch Helm", "nexis_watch", "helmet", "medium", { Slashing: 3, Piercing: 4 }, "uncommon", "nexis", 185, "A civic helm made to blunt cuts and stop glancing thrusts.", "Stamped beneath the rim with a watchhouse number."],
  ["watch_brigandine", "Watch Brigandine", "nexis_watch", "armor", "medium", { Slashing: 6, Piercing: 5 }, "uncommon", "nexis", 330, "Disciplined city armor built against blades and street weapons.", "Layered plates sit under plain civic cloth."],
  ["watch_vambraces", "Watch Vambraces", "nexis_watch", "gloves", "medium", { Slashing: 3, Piercing: 3 }, "uncommon", "nexis", 170, "Forearm guards for controlled parries and close arrests.", "The buckles are simple and easy to replace."],
  ["watch_tassets", "Watch Tassets", "nexis_watch", "legs", "medium", { Slashing: 4, Piercing: 3 }, "uncommon", "nexis", 205, "Hanging guards that protect the hips during close blade work.", "Cut short enough for patrol steps."],
  ["watch_marching_boots", "Watch Marching Boots", "nexis_watch", "boots", "medium", { Slashing: 2, Piercing: 3 }, "uncommon", "nexis", 160, "Hard-wearing boots reinforced for patrol and street fighting.", "The soles are made for stone roads."],
  ["corsair_bandana", "Corsair Bandana", "blackharbor_corsair", "helmet", "light", { Piercing: 3, Poison: 4 }, "uncommon", "blackharbor", 175, "A wrapped headpiece treated against spray and toxins.", "Salt marks stay in the cloth no matter how it is washed."],
  ["saltcoat", "Saltcoat", "blackharbor_corsair", "armor", "light", { Piercing: 6, Poison: 5 }, "uncommon", "blackharbor", 320, "A light maritime coat strengthened against points and poison.", "Its lining carries sealed pockets for bad weather and worse jobs."],
  ["deck_gloves", "Deck Gloves", "blackharbor_corsair", "gloves", "light", { Piercing: 3, Poison: 3 }, "uncommon", "blackharbor", 165, "Grip gloves for rope work, knife fights, and treated cargo.", "The palms are roughened with tarred thread."],
  ["bilge_trousers", "Bilge Trousers", "blackharbor_corsair", "legs", "light", { Piercing: 4, Poison: 3 }, "uncommon", "blackharbor", 195, "Reinforced trousers for dock work and hazardous bilges.", "The cuffs are narrow enough to stay clear of deck gear."],
  ["reef_boots", "Reef Boots", "blackharbor_corsair", "boots", "light", { Piercing: 3, Poison: 2 }, "uncommon", "blackharbor", 155, "Soft boots with treated soles for sharp docks and wet stone.", "They grip better than they look."],
  ["warden_hood", "Warden Hood", "silverbough_warden", "helmet", "light", { Magical: 4, Poison: 3 }, "uncommon", "silverbough", 190, "A hood woven to steady wards and resist toxic spoor.", "Pale thread marks the inner seam."],
  ["grove_mantle", "Grove Mantle", "silverbough_warden", "armor", "light", { Magical: 6, Poison: 5 }, "uncommon", "silverbough", 335, "A protective mantle for wardens facing spellwork and venom.", "The cloth smells faintly of rain-wet bark."],
  ["mosswrap_gloves", "Mosswrap Gloves", "silverbough_warden", "gloves", "light", { Magical: 3, Poison: 3 }, "uncommon", "silverbough", 170, "Soft gloves that steady ward gestures and shield against toxins.", "Moss fiber cushions the knuckles without bulk."],
  ["briarweave_leggings", "Briarweave Leggings", "silverbough_warden", "legs", "light", { Magical: 4, Poison: 3 }, "uncommon", "silverbough", 205, "Flexible leggings reinforced with briar-thread warding.", "The weave tightens under arcane pressure."],
  ["rootstep_boots", "Rootstep Boots", "silverbough_warden", "boots", "light", { Magical: 3, Poison: 2 }, "uncommon", "silverbough", 160, "Quiet boots for grove patrols and warded ground.", "Their soles are cut to leave a shallow print."],
  ["rivet_helm", "Rivet Helm", "ironhall_bulwark", "helmet", "heavy", { Bludgeoning: 4, Slashing: 3 }, "rare", "ironhall", 260, "A heavy helm shaped to survive hammer shock and cutting blows.", "Rivets crown the brow in a hard line."],
  ["forgeplate_cuirass", "Forgeplate Cuirass", "ironhall_bulwark", "armor", "heavy", { Bludgeoning: 7, Slashing: 6 }, "rare", "ironhall", 520, "Heavy forge armor designed to absorb brutal hammer and axe blows.", "Heat stains sit deep beneath the polish."],
  ["hammergrip_gauntlets", "Hammergrip Gauntlets", "ironhall_bulwark", "gloves", "heavy", { Bludgeoning: 4, Slashing: 3 }, "rare", "ironhall", 245, "Steel gauntlets built to hold through impact and edge pressure.", "The fingers close with deliberate weight."],
  ["anvil_greaves", "Anvil Greaves", "ironhall_bulwark", "legs", "heavy", { Bludgeoning: 5, Slashing: 4 }, "rare", "ironhall", 310, "Dense greaves that protect the legs from sweeping hits.", "Each plate overlaps like scaled iron."],
  ["furnace_boots", "Furnace Boots", "ironhall_bulwark", "boots", "heavy", { Bludgeoning: 3, Slashing: 3 }, "rare", "ironhall", 240, "Weighted boots made for forge floors and shield lines.", "The toes carry dark heat caps."],
  ["court_visor", "Court Visor", "highcourt_bastion", "helmet", "medium", { Piercing: 4, Magical: 3 }, "rare", "highcourt", 270, "A refined visor for stopping points and ward pressure.", "Its narrow sightline keeps the wearer composed."],
  ["bastion_coat", "Bastion Coat", "highcourt_bastion", "armor", "medium", { Piercing: 7, Magical: 5 }, "rare", "highcourt", 510, "A formal armored coat for court guards and diplomatic escorts.", "Hidden plates keep the silhouette civilized."],
  ["sealbound_gloves", "Sealbound Gloves", "highcourt_bastion", "gloves", "medium", { Piercing: 4, Magical: 3 }, "rare", "highcourt", 250, "Gloves lined with small seals for warded handwork and blade defense.", "Fine stitching hides narrow reinforcement bands."],
  ["tribunal_legguards", "Tribunal Legguards", "highcourt_bastion", "legs", "medium", { Piercing: 5, Magical: 3 }, "rare", "highcourt", 315, "Legguards made for formal protection without slowing court movement.", "The plates are lacquered in deep wine enamel."],
  ["magistrate_boots", "Magistrate Boots", "highcourt_bastion", "boots", "medium", { Piercing: 3, Magical: 3 }, "rare", "highcourt", 235, "Polished boots reinforced for court marches and sudden violence.", "They sound official on marble."],
  ["concordant_circlet", "Concordant Circlet", "concordant_aegis", "helmet", "light", { Slashing: 2, Piercing: 2, Bludgeoning: 2, Magical: 2, Fire: 2, Cold: 2, Lightning: 2, Poison: 2 }, "legendary", "neutral", 1250, "A legendary circlet that offers light protection against every known damage type.", "Five small marks meet above the brow."],
  ["concordant_vestment", "Concordant Vestment", "concordant_aegis", "armor", "medium", { Slashing: 3, Piercing: 3, Bludgeoning: 3, Magical: 3, Fire: 3, Cold: 3, Lightning: 3, Poison: 3 }, "legendary", "neutral", 2100, "A legendary vestment with balanced all-round defensive warding.", "Its inner lining changes tone under torchlight."],
  ["concordant_grips", "Concordant Grips", "concordant_aegis", "gloves", "medium", { Slashing: 2, Piercing: 2, Bludgeoning: 2, Magical: 2, Fire: 2, Cold: 2, Lightning: 2, Poison: 2 }, "legendary", "neutral", 1160, "Legendary grips that preserve hand protection without favoring one threat.", "The leather is marked with neat silver bands."],
  ["concordant_legguards", "Concordant Legguards", "concordant_aegis", "legs", "medium", { Slashing: 2, Piercing: 2, Bludgeoning: 2, Magical: 2, Fire: 2, Cold: 2, Lightning: 2, Poison: 2 }, "legendary", "neutral", 1280, "Legendary legguards built for steady coverage across mixed battlefields.", "The plates move with quiet precision."],
  ["concordant_striders", "Concordant Striders", "concordant_aegis", "boots", "medium", { Slashing: 2, Piercing: 2, Bludgeoning: 2, Magical: 2, Fire: 2, Cold: 2, Lightning: 2, Poison: 2 }, "legendary", "neutral", 1150, "Legendary boots that protect evenly without becoming heavy specialist armor.", "Their tread bears five interlocked lines."],
];

function passArmor([id, displayName, setId, slot, weightClass, reductions, rarity, cityBias, valueBuy, shortDescription, flavorText]) {
  return defineItem({ id, displayName, category: "Equipment", subtype: "Armor", itemRole: "armor", equipSlot: slot, rarity, valueBuy, valueSell: Math.max(1, Math.floor(valueBuy * 0.45)), cityBias, sourceCity: cityBias, legalMarketAvailability: rarity === "legendary" ? [] : [cityBias], armorStats: { weightClass, reductions, setId }, setId, shortDescription, flavorText, sourceTags: ["itemization", "armor", setId, cityBias] });
}

const PASS_CLOTHING = [
  ["plain_traveler_tunic", "Plain Traveler Tunic", "common", "chest", "A plain tunic for everyday travel and city errands.", "Sturdy stitching, neutral dye, easy repair."],
  ["dustroad_cloak", "Dustroad Cloak", "common", "outerwear", "A practical cloak for road dust, weather, and long waits.", "The hem is weighted against wind."],
  ["market_runner_coat", "Market Runner Coat", "common", "outerwear", "A short coat for couriers, runners, and busy market hands.", "Cut high enough to move through crowds."],
  ["soft_wool_hood", "Soft Wool Hood", "common", "head", "A warm hood worn by travelers and early-shift workers.", "Its wool is plain but tightly spun."],
  ["commoners_boots", "Commoner's Boots", "common", "feet", "Simple boots for city walking and ordinary field work.", "The soles are patched where they need it most."],
  ["leather_work_gloves", "Leather Work Gloves", "common", "hands", "Work gloves for hauling, handling, and light craft labor.", "Creases show where tools sit in the hand."],
  ["dockside_shawl", "Dockside Shawl", "common", "outerwear", "A weathered shawl suited to wet evenings and harbor streets.", "The weave carries a faint salt smell."],
  ["simple_scholar_robe", "Simple Scholar Robe", "common", "chest", "A plain robe worn by students, clerks, and junior archivists.", "The cuffs are ink-marked by habit."],
  ["ironhall_work_apron", "Ironhall Work Apron", "common", "chest", "A heavy work apron for forge floors and repair benches.", "Heat darkening marks the lower edge."],
  ["stitched_field_trousers", "Stitched Field Trousers", "common", "legs", "Hard-wearing trousers for travel, labor, and field errands.", "Reinforced seams keep them serviceable."],
  ["nexis_clerks_coat", "Nexis Clerk's Coat", "uncommon", "outerwear", "A civic coat worn by registry clerks and city runners.", "Grey-blue cloth marks official service without excess."],
  ["blackharbor_deck_coat", "Blackharbor Deck Coat", "uncommon", "outerwear", "A deck coat cut for wet rails, night watches, and cargo work.", "Its buttons are dark horn and brass."],
  ["silverbough_herbal_shawl", "Silverbough Herbal Shawl", "uncommon", "outerwear", "A green shawl favored by herbalists and shrine attendants.", "Dried leaf sachets are sewn into the inner fold."],
  ["ironhall_rivetwork_jacket", "Ironhall Rivetwork Jacket", "uncommon", "chest", "A practical jacket used by riveters, fitters, and foundry clerks.", "Metal buttons sit flush against thick cloth."],
  ["highcourt_velvet_mantle", "Highcourt Velvet Mantle", "uncommon", "outerwear", "A formal mantle for court visits and careful introductions.", "Deep velvet gives weight to quiet entrances."],
  ["lettered_citizen_sash", "Lettered Citizen Sash", "uncommon", "accessory", "A public sash marking civic standing and recognized service.", "The letters are embroidered in official thread."],
  ["magistrates_half_cape", "Magistrate's Half-Cape", "rare", "outerwear", "A formal half-cape for legal officers and prestigious petitioners.", "A narrow clasp bears the court seal."],
  ["grove_lecturer_robe", "Grove Lecturer Robe", "rare", "chest", "A lecturer's robe used in Silverbough academies and public lessons.", "Pale green panels mark the teaching line."],
  ["corsair_captains_scarf", "Corsair Captain's Scarf", "rare", "accessory", "A bold scarf worn by captains, pilots, and dock leaders.", "Saltwind has softened the cloth without fading it."],
  ["forgewarden_cloak", "Forgewarden Cloak", "rare", "outerwear", "A dark cloak worn by senior forge wardens and heavy crews.", "Its clasp is cast from tempered iron."],
  ["midnight_envoy_coat", "Midnight Envoy Coat", "rare", "outerwear", "A tailored coat for discreet envoys and late arrivals.", "Black-blue cloth hides travel dust well."],
  ["archive_keepers_mantle", "Archive Keeper's Mantle", "rare", "outerwear", "A reserved mantle worn by keepers of records and restricted stacks.", "Small brass tabs mark its inner pockets."],
  ["saltwind_cloak", "Saltwind Cloak", "rare", "outerwear", "A rare sea cloak that moves easily through rain and hard weather.", "The outer cloth beads water in silver lines."],
  ["emberloom_vest", "Emberloom Vest", "rare", "chest", "A fitted vest dyed in warm Ironhall ember tones.", "Fine red thread crosses beneath the collar."],
  ["tribunal_formalwear", "Tribunal Formalwear", "rare", "chest", "Formal court dress for hearings, appointments, and public vows.", "Every line is measured to look composed."],
];

function passClothing([id, displayName, rarity, visualSlot, shortDescription, flavorText]) {
  const cityBias = id.includes("blackharbor") || id.includes("salt") || id.includes("corsair") ? "blackharbor" : id.includes("silverbough") || id.includes("grove") ? "silverbough" : id.includes("ironhall") || id.includes("forge") || id.includes("ember") ? "ironhall" : id.includes("highcourt") || id.includes("tribunal") || id.includes("magistrate") ? "highcourt" : "nexis";
  const valueBuy = rarity === "rare" ? 260 : rarity === "uncommon" ? 145 : 58;
  return defineItem({ id, displayName, category: "Clothing", subtype: visualSlot === "accessory" ? "Accessory" : "Visual Gear", itemRole: "visual", rarity, visualSlot, visualOnly: true, valueBuy, valueSell: Math.max(1, Math.floor(valueBuy * 0.45)), cityBias, sourceCity: cityBias, legalMarketAvailability: [cityBias], shortDescription, flavorText, sourceTags: ["visual", "clothing", cityBias] });
}

const PASS_CONSUMABLES = [
  ["field_bandage", "Field Bandage", "common", 28, [{ type: "restore_health", amount: 18, context: "combat_or_field" }], "A clean bandage for small wounds during travel or combat.", "Packed tight to stay clean in a belt pouch."],
  ["minor_healing_draught", "Minor Healing Draught", "common", 52, [{ type: "restore_health", amount: 32, context: "combat_or_field" }], "A basic healing draught for light recovery and early fights.", "Clear glass shows the pale red brew inside."],
  ["major_healing_draught", "Major Healing Draught", "rare", 180, [{ type: "restore_health", amount: 82, context: "combat_or_field" }], "A stronger healing draught for serious wounds and hard encounters.", "The stopper is sealed with Silverbough wax."],
  ["focus_tea", "Focus Tea", "common", 60, [{ type: "restore_energy", amount: 16, context: "field" }], "A mild tea that restores focus and a small amount of energy.", "Bitter leaf and warm spice carry the effect."],
  ["stamina_salts", "Stamina Salts", "common", 64, [{ type: "restore_stamina", amount: 3, context: "field" }], "Sharp salts that restore stamina for travel and work.", "They wake the hands before the mind agrees."],
  ["smoke_pellet", "Smoke Pellet", "common", 48, [{ type: "combat_buff", effect: "evadeBonus", amount: 5, context: "combat", uses: 1 }], "A compact smoke pellet that improves evasion for one fight.", "Packed black powder breaks into a fast grey screen."],
  ["ward_chalk", "Ward Chalk", "common", 58, [{ type: "combat_buff", effect: "mitigationBonus", amount: 0.04, context: "combat", uses: 1 }], "Chalk for a quick ward mark that improves mitigation for one fight.", "White lines hold briefly under pressure."],
  ["bitter_antidote", "Bitter Antidote", "uncommon", 86, [{ type: "combat_buff", effect: "mitigationBonus", amount: 0.03, context: "combat", uses: 1 }], "A bitter antidote that steadies the body against toxins in a fight.", "The taste is harsh enough to prove the point."],
  ["quickstep_tonic", "Quickstep Tonic", "uncommon", 92, [{ type: "combat_buff", effect: "evadeBonus", amount: 7, context: "combat", uses: 1 }], "A tonic that improves footwork and evasion for one fight.", "A quick burn settles into the calves."],
  ["ironhide_tonic", "Ironhide Tonic", "uncommon", 96, [{ type: "combat_buff", effect: "mitigationBonus", amount: 0.06, context: "combat", uses: 1 }], "A dense tonic that improves mitigation for one fight.", "It leaves a mineral taste and steady nerves."],
];

function passConsumable([id, displayName, rarity, valueBuy, useEffects, shortDescription, flavorText]) {
  const cityBias = id.includes("ward") || id.includes("healing") || id.includes("antidote") ? "silverbough" : id.includes("smoke") ? "blackharbor" : id.includes("ironhide") ? "ironhall" : "nexis";
  return defineItem({ id, displayName, category: "Consumable", subtype: useEffects.some((effect) => effect.type === "restore_health") ? "Healing" : useEffects.some((effect) => effect.type === "restore_stamina") ? "Stamina" : "Combat Support", itemRole: "consumable", rarity, valueBuy, valueSell: Math.max(1, Math.floor(valueBuy * 0.45)), cityBias, sourceCity: cityBias, legalMarketAvailability: cityBias === "blackharbor" && id.includes("smoke") ? [] : [cityBias, "nexis"].filter((value, index, list) => list.indexOf(value) === index), blackMarketAvailability: id.includes("smoke") ? ["blackharbor"] : [], useEffects, shortDescription, flavorText, sourceTags: ["consumable", "support", cityBias] });
}

const ITEMIZATION_PASS_ITEMS = [
  ...PASS_WEAPONS.map(passWeapon),
  ...PASS_ARMOR.map(passArmor),
  ...PASS_CLOTHING.map(passClothing),
  ...PASS_CONSUMABLES.map(passConsumable),
];

const RAW_ITEMS = [...CORE_ITEMS, ...ACADEMY_ITEMS, ...EXTRA_ITEMS, ...ITEMIZATION_PASS_ITEMS];
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
    shortDescription: `${displayName} is tracked by inventory as a legacy item.`,
    flavorText: "Registered in the Nexis ledger with standard source marks.",
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

export function getAllowedVisualSlots(item) {
  const definition = typeof item === "string" ? getItemDefinition(item) : item;
  if (!definition) return [];
  if (Array.isArray(definition.allowedVisualSlots)) return definition.allowedVisualSlots.filter((slot) => VISUAL_EQUIPMENT_SLOTS.includes(slot));
  if (definition.visualSlot && VISUAL_EQUIPMENT_SLOTS.includes(definition.visualSlot)) return [definition.visualSlot];
  return [];
}

export function isEquippable(itemId) {
  return getAllowedEquipSlots(itemId).length > 0;
}

export function isWearable(itemId) {
  return getAllowedVisualSlots(itemId).length > 0;
}

export function isUsable(itemId) {
  return asArray(getItemDefinition(itemId)?.useEffects).length > 0;
}

function formatSlotName(slot) {
  return String(slot ?? "").replace(/[0-9]/g, " $&").replace(/[_-]+/g, " ").replace(/([a-z])([A-Z])/g, "$1 $2").replace(/\b\w/g, (letter) => letter.toUpperCase()).trim();
}

function formatReductions(reductions) {
  return Object.entries(asRecord(reductions)).filter(([, value]) => Number(value) > 0).map(([type, value]) => `${type} DR +${value}%`);
}

export function getArmorSetDefinition(setId) {
  return ARMOR_SETS[setId] ?? null;
}

export function getArmorSetSummaries() {
  return Object.values(ARMOR_SETS).map((set) => ({ id: set.id, name: set.name, city: set.city, theme: set.theme, profile: set.profile, pieces: set.pieces, bonuses: set.bonuses }));
}

export function calculateArmorSetBonuses(itemIds = []) {
  const counts = {};
  for (const itemId of asArray(itemIds)) {
    const item = getItemDefinition(itemId);
    const setId = item?.armorStats?.setId ?? item?.setId;
    if (!setId || !ARMOR_SETS[setId]) continue;
    counts[setId] = (counts[setId] ?? 0) + 1;
  }
  const reductions = {};
  const activeSets = [];
  for (const [setId, count] of Object.entries(counts)) {
    const set = ARMOR_SETS[setId];
    const activeBonuses = [];
    const nextThreshold = [2, 3, 5].find((threshold) => count < threshold) ?? null;
    for (const threshold of [2, 3, 5]) {
      const bonus = set.bonuses[threshold];
      if (!bonus || count < threshold) continue;
      activeBonuses.push({ threshold, label: bonus.label, reductions: bonus.reductions });
      for (const [type, amount] of Object.entries(asRecord(bonus.reductions))) reductions[type] = Math.min(ARMOR_REDUCTION_CAP, (reductions[type] ?? 0) + Number(amount || 0));
    }
    activeSets.push({ id: set.id, name: set.name, city: set.city, theme: set.theme, profile: set.profile, count, pieces: set.pieces, activeBonuses, nextBonus: nextThreshold ? { threshold: nextThreshold, label: set.bonuses[nextThreshold]?.label ?? null } : null });
  }
  return { reductions, activeSets };
}

export function summarizeItemEffects(item) {
  const definition = typeof item === "string" ? getItemDefinition(item) : item;
  if (!definition) return [];
  const effects = [];
  if (definition.weaponStats) {
    const weapon = definition.weaponStats;
    effects.push(`Damage ${weapon.damageMin}-${weapon.damageMax} ${weapon.damageType}`);
    effects.push(`Accuracy ${weapon.accuracy}%`);
    effects.push(`Handedness: ${formatSlotName(weapon.handedness)}`);
  }
  if (definition.armorStats) {
    effects.push(...formatReductions(definition.armorStats.reductions));
    if (definition.armorStats.weightClass) effects.push(`Weight: ${formatSlotName(definition.armorStats.weightClass)}`);
    const set = getArmorSetDefinition(definition.armorStats.setId);
    if (set) effects.push(`Set: ${set.name}`);
  }
  const visualSlots = getAllowedVisualSlots(definition);
  if (visualSlots.length) effects.push(`Wear: ${visualSlots.map(formatSlotName).join(" / ")}${definition.visualOnly ? " (visual)" : ""}`);
  const statGroups = asRecord(definition.statModifiers);
  for (const [group, values] of Object.entries(statGroups)) for (const [key, value] of Object.entries(asRecord(values))) effects.push(`${key} ${Number(value) >= 0 ? "+" : ""}${value} (${group})`);
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
  const armorSet = item.setId ? getArmorSetDefinition(item.setId) : null;
  return {
    id: item.id,
    displayName: item.displayName,
    category: item.category,
    subtype: item.subtype,
    rarity: item.rarity,
    itemRole: item.itemRole,
    equipSlot: item.equipSlot,
    allowedSlots: getAllowedEquipSlots(item),
    visualSlot: item.visualSlot,
    allowedVisualSlots: getAllowedVisualSlots(item),
    visualOnly: item.visualOnly,
    stackLimit: item.stackLimit,
    valueBuy: item.valueBuy,
    valueSell: item.valueSell,
    cityBias: item.cityBias,
    sourceCity: item.sourceCity,
    statModifiers: item.statModifiers,
    combatModifiers: item.combatModifiers,
    weaponStats: item.weaponStats,
    armorStats: item.armorStats,
    setId: item.setId,
    armorSet: armorSet ? { id: armorSet.id, name: armorSet.name, theme: armorSet.theme, profile: armorSet.profile, bonuses: armorSet.bonuses } : null,
    useEffects: item.useEffects,
    requirements: item.requirements,
    lockReasonText: item.lockReasonText,
    shortDescription: item.shortDescription,
    flavorText: item.flavorText,
    sourceTags: item.sourceTags,
    academyTags: item.academyTags,
    marketEligible: item.marketEligible,
    iconKey: item.iconKey,
    iconUrl: `/item-icons/${String(item.category).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "item"}.svg`,
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
    iconUrl: `/item-icons/${String(item.category).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "item"}.svg`,
    iconBrief: item.iconBrief,
    iconPalette: item.iconPalette,
    iconSilhouette: item.iconSilhouette,
    iconRarityFrame: item.iconRarityFrame,
  }));
}
