import { HIDDEN_SITE_DEFINITIONS } from "./liveWorldData.js";

export const ADVENTURE_CATEGORIES = [
  { id: "local_contract", label: "Local Contract", summary: "Short city work with modest risk and clear local rewards." },
  { id: "field_expedition", label: "Field Expedition", summary: "Field runs where preparation, supplies, and route threats matter." },
  { id: "hidden_site_run", label: "Hidden Site Run", summary: "Bounded runs unlocked by rumors, discoveries, or atlas progress." },
  { id: "elite_hunt", label: "Elite Hunt", summary: "Harder named fights with better loot and stronger preparation hints." },
  { id: "convoy_defense", label: "Convoy Defense", summary: "Escort work linked to trade routes, consortium freight, and city threats." },
  { id: "relic_recovery", label: "Relic Recovery", summary: "Recovery work tied to hidden sites, academies, and Codex discoveries." },
];

const CITY_STYLE = {
  nexis: { name: "Nexis City", tags: ["civic", "watch", "registry"], source: "Nexis civic desks" },
  west: { name: "Blackharbor", tags: ["maritime", "covert", "cargo"], source: "Blackharbor dock brokers" },
  north: { name: "Silverbough", tags: ["ward", "healing", "relic"], source: "Silverbough ward desks" },
  east: { name: "Ironhall", tags: ["forge", "industrial", "convoy"], source: "Ironhall foundry boards" },
  south: { name: "Highcourt", tags: ["legal", "prestige", "court"], source: "Highcourt public register" },
};

function foe(id, name, level, health, stats, damageType, summary) {
  return { id, name, level, health, battleStats: stats, summary, damageType };
}

export const ADVENTURE_DEFINITIONS = [
  {
    id: "nexis_watch_route_defense",
    cityId: "nexis",
    category: "convoy_defense",
    title: "Watch Route Defense",
    summary: "Hold a short civic route against raiders testing the watch lamps.",
    riskBand: "Moderate",
    threatType: "Slashing raiders",
    recommendedPrep: ["Nexis Watch armor", "Slashing reduction", "Field Bandage"],
    rewardCategory: "watch gear and civic materials",
    sourceLabel: "City Board watch notice",
    acquisition: ["City Board", "Convoy Defense", "Nexis City contracts"],
    opponent: foe("watch_route_raider", "Watch Route Raider", 3, 118, { strength: 16, defense: 12, speed: 12, dexterity: 13 }, "Slashing", "A road raider with a chopping blade and enough nerve to test civic lamps."),
    reward: { gold: 72, experience: 58, items: [{ itemId: "watch_vambraces", quantity: 1 }] },
    extraDrops: [{ itemId: "field_bandage", quantity: 1 }, { itemId: "sealed_notice", quantity: 1 }],
    gearHint: "Slashing protection reduces the worst of the raider's edge pressure.",
  },
  {
    id: "nexis_registry_recovery",
    cityId: "nexis",
    category: "local_contract",
    title: "Registry Recovery",
    summary: "Recover stolen registry tags from a tunnel crew before they reach the lower roads.",
    riskBand: "Low",
    threatType: "Piercing ambush",
    recommendedPrep: ["Piercing reduction", "Quick Knife or short blade", "Minor Healing Draught"],
    rewardCategory: "starter civic weapons and registry goods",
    sourceLabel: "Registry desk",
    acquisition: ["Local Contract", "City Board", "Nexis City"],
    opponent: foe("registry_tunnel_thief", "Registry Tunnel Thief", 2, 92, { strength: 11, defense: 9, speed: 14, dexterity: 15 }, "Piercing", "A quick tunnel thief who favors short thrusts and fast exits."),
    reward: { gold: 52, experience: 42, items: [{ itemId: "market_dagger", quantity: 1 }] },
    extraDrops: [{ itemId: "wax_seal", quantity: 1 }],
    gearHint: "Accurate light weapons help against evasive tunnel crews.",
  },
  {
    id: "west_cargo_retrieval",
    cityId: "west",
    category: "field_expedition",
    title: "Cargo Retrieval at Low Tide",
    summary: "Recover marked cargo before dock crews and smugglers argue it into several inventories.",
    riskBand: "Moderate",
    threatType: "Piercing and poison pressure",
    recommendedPrep: ["Corsair armor", "Bitter Antidote", "Piercing reduction"],
    rewardCategory: "cargo seals and maritime loot",
    sourceLabel: "Dock broker notice",
    acquisition: ["Blackharbor board", "Field Expedition", "Player Market"],
    opponent: foe("low_tide_knifeman", "Low-Tide Knifeman", 3, 112, { strength: 14, defense: 10, speed: 15, dexterity: 16 }, "Piercing", "A dock knife fighter using tide clutter and quick angles."),
    reward: { gold: 86, experience: 64, items: [{ itemId: "cargo_seals", quantity: 2 }] },
    extraDrops: [{ itemId: "dock_shiv", quantity: 1 }, { itemId: "rope_kit", quantity: 1 }],
    gearHint: "Piercing and poison protection both pay off around treated cargo and dock blades.",
  },
  {
    id: "west_corsair_cache",
    cityId: "west",
    category: "hidden_site_run",
    title: "Corsair Cache Sweep",
    summary: "Open a tide-hidden cache and clear the guard before the harbor takes its cut.",
    riskBand: "High",
    threatType: "Poisoned piercing",
    recommendedPrep: ["Blackharbor Corsair set", "Bitter Antidote", "Smoke Pellet"],
    rewardCategory: "corsair set pieces and covert goods",
    sourceLabel: "Smuggler cache rumor",
    hiddenSiteId: "west_smuggler_cache",
    acquisition: ["Hidden Site Discovery", "Black Market", "Elite Drop"],
    opponent: foe("cache_corsair_guard", "Cache Corsair Guard", 4, 138, { strength: 16, defense: 13, speed: 17, dexterity: 17 }, "Piercing", "A cache guard trained to end arguments before cargo gets counted."),
    reward: { gold: 118, experience: 88, items: [{ itemId: "saltcoat", quantity: 1 }] },
    extraDrops: [{ itemId: "contraband_satchel", quantity: 1 }, { itemId: "blackwake_knife", quantity: 1 }],
    gearHint: "The cache favors light armor with piercing and poison coverage.",
  },
  {
    id: "north_shrine_defense",
    cityId: "north",
    category: "field_expedition",
    title: "Shrine Defense",
    summary: "Hold a shrine path while ward-struck beasts test the outer stones.",
    riskBand: "Moderate",
    threatType: "Magical and poison pressure",
    recommendedPrep: ["Silverbough Warden armor", "Ward Chalk", "Healing draught"],
    rewardCategory: "herbs, wards, and warden gear",
    sourceLabel: "Hospice commission",
    acquisition: ["Field Expedition", "Silverbough contracts", "Crafting"],
    opponent: foe("ward_struck_stag", "Ward-Struck Stag", 3, 124, { strength: 15, defense: 12, speed: 16, dexterity: 12 }, "Magical", "A panicked stag carrying broken wardlight in its antlers."),
    reward: { gold: 76, experience: 68, items: [{ itemId: "ward_chalk", quantity: 1 }] },
    extraDrops: [{ itemId: "medicinal_herb", quantity: 2 }, { itemId: "warden_hood", quantity: 1 }],
    gearHint: "Magical reduction and ward consumables keep shrine fights under control.",
  },
  {
    id: "north_relic_grove_incursion",
    cityId: "north",
    category: "relic_recovery",
    title: "Relic Grove Incursion",
    summary: "Recover a relic trace from a grove where the wardline has become possessive.",
    riskBand: "High",
    threatType: "Magical bursts",
    recommendedPrep: ["Magical reduction", "Willow Ward Staff", "Major Healing Draught"],
    rewardCategory: "relic notes and magical foci",
    sourceLabel: "Lyceum relic notice",
    hiddenSiteId: "north_arcane_survey_point",
    acquisition: ["Relic Recovery", "Hidden Site Run", "Academy archives"],
    opponent: foe("grove_relic_warden", "Grove Relic Warden", 5, 158, { strength: 15, defense: 18, speed: 13, dexterity: 15 }, "Magical", "A warded relic keeper that answers trespass with disciplined light."),
    reward: { gold: 132, experience: 102, items: [{ itemId: "relicglass_rod", quantity: 1 }] },
    extraDrops: [{ itemId: "ward_shard", quantity: 1 }, { itemId: "grove_mantle", quantity: 1 }],
    gearHint: "Magical protection and healing support are more useful than raw damage here.",
  },
  {
    id: "east_forge_salvage",
    cityId: "east",
    category: "hidden_site_run",
    title: "Forge Wreck Salvage",
    summary: "Clear a wrecked forge cart and recover parts before the road closes again.",
    riskBand: "Moderate",
    threatType: "Bludgeoning impact",
    recommendedPrep: ["Ironhall Bulwark armor", "Bludgeoning reduction", "Ironhide Tonic"],
    rewardCategory: "bulwark pieces and forge materials",
    sourceLabel: "Salvage Yard posting",
    hiddenSiteId: "east_forge_wreck",
    acquisition: ["Hidden Site Discovery", "Salvage", "Ironhall board"],
    opponent: foe("wreck_hammer_guard", "Wreck Hammer Guard", 4, 148, { strength: 19, defense: 17, speed: 9, dexterity: 10 }, "Bludgeoning", "A hammer guard left behind with simple orders and simpler mercy."),
    reward: { gold: 104, experience: 86, items: [{ itemId: "hammergrip_gauntlets", quantity: 1 }] },
    extraDrops: [{ itemId: "scrap_metal", quantity: 3 }, { itemId: "iron_ore", quantity: 2 }],
    gearHint: "Bludgeoning reduction is the difference between a dent and a hospital form.",
  },
  {
    id: "east_furnace_beast_response",
    cityId: "east",
    category: "elite_hunt",
    title: "Furnace Beast Response",
    summary: "Put down a furnace-beast drill rig before it turns training into wreckage.",
    riskBand: "Elite",
    threatType: "Bludgeoning and fire",
    recommendedPrep: ["Ironhall Bulwark set", "Ironhide Tonic", "Heavy weapon"],
    rewardCategory: "rare forge armor and elite materials",
    sourceLabel: "Foundry emergency notice",
    acquisition: ["Elite Hunt", "World Event", "Guild operation"],
    opponent: foe("furnace_beast_rig", "Furnace Beast Rig", 6, 196, { strength: 24, defense: 20, speed: 9, dexterity: 11 }, "Bludgeoning", "A controlled furnace rig that is currently expressing strong opinions."),
    reward: { gold: 186, experience: 142, items: [{ itemId: "forgeplate_cuirass", quantity: 1 }] },
    extraDrops: [{ itemId: "chainbreaker_maul", quantity: 1 }, { itemId: "coal", quantity: 4 }],
    gearHint: "Heavy bludgeoning protection and strong healing give this hunt a margin.",
  },
  {
    id: "south_legal_courier_protection",
    cityId: "south",
    category: "convoy_defense",
    title: "Legal Courier Protection",
    summary: "Escort sealed courier cases through a route where polite threats carry sharp points.",
    riskBand: "Moderate",
    threatType: "Piercing duelist pressure",
    recommendedPrep: ["Highcourt Bastion armor", "Piercing reduction", "Accurate blade"],
    rewardCategory: "legal goods and court attire",
    sourceLabel: "Court courier desk",
    acquisition: ["Convoy Defense", "Highcourt board", "City Contract"],
    opponent: foe("petition_route_duelist", "Petition Route Duelist", 4, 132, { strength: 14, defense: 14, speed: 17, dexterity: 18 }, "Piercing", "A formal duelist making a very unofficial point."),
    reward: { gold: 112, experience: 84, items: [{ itemId: "wax_seal", quantity: 2 }] },
    extraDrops: [{ itemId: "court_visor", quantity: 1 }, { itemId: "bailiffs_longsword", quantity: 1 }],
    gearHint: "Piercing reduction and accuracy matter against court duelists.",
  },
  {
    id: "south_sealed_outpost_run",
    cityId: "south",
    category: "hidden_site_run",
    title: "Sealed Court Outpost",
    summary: "Open a sealed outpost and survive the old court guard still following writ protocol.",
    riskBand: "High",
    threatType: "Piercing and magical pressure",
    recommendedPrep: ["Highcourt Bastion set", "Ward Chalk", "Edict Blade"],
    rewardCategory: "bastion pieces and court records",
    sourceLabel: "Sealed outpost filing",
    hiddenSiteId: "south_sealed_court_outpost",
    acquisition: ["Hidden Site Discovery", "Relic Recovery", "Highcourt archive"],
    opponent: foe("sealed_outpost_guard", "Sealed Outpost Guard", 5, 164, { strength: 17, defense: 18, speed: 14, dexterity: 17 }, "Magical", "An old court guard animated by seals that still care about procedure."),
    reward: { gold: 148, experience: 116, items: [{ itemId: "bastion_coat", quantity: 1 }] },
    extraDrops: [{ itemId: "edict_blade", quantity: 1 }, { itemId: "sealed_notice", quantity: 2 }],
    gearHint: "Hybrid piercing and magical protection is ideal for sealed court remnants.",
  },
  {
    id: "cross_city_concordant_trace",
    cityId: "nexis",
    category: "relic_recovery",
    title: "Concordant Trace",
    summary: "Follow a rare cross-city trace that can surface Concordant Aegis fragments.",
    riskBand: "Elite",
    threatType: "Mixed damage",
    recommendedPrep: ["Balanced armor", "Major Healing Draught", "Best accurate weapon"],
    rewardCategory: "legendary all-round gear fragments",
    sourceLabel: "Archive and atlas convergence",
    requiredLevel: 5,
    acquisition: ["Hidden Site Discovery", "Elite Hunt", "Codex records"],
    opponent: foe("concordant_echo", "Concordant Echo", 7, 214, { strength: 22, defense: 22, speed: 15, dexterity: 16 }, "Magical", "A composite echo testing whether the bearer understands balance."),
    reward: { gold: 230, experience: 180, items: [{ itemId: "concordant_grips", quantity: 1 }] },
    extraDrops: [{ itemId: "concordant_blade", quantity: 1 }],
    gearHint: "No specialist set covers everything here; balanced mitigation and consumables matter.",
  },
];

export function getAdventureCategory(categoryId) {
  return ADVENTURE_CATEGORIES.find((entry) => entry.id === categoryId) ?? null;
}

export function getAdventureDefinition(adventureId) {
  return ADVENTURE_DEFINITIONS.find((entry) => entry.id === adventureId) ?? null;
}

export function getAdventureDefinitions() {
  return ADVENTURE_DEFINITIONS.slice();
}

export function getAdventureCityStyle(cityId) {
  return CITY_STYLE[cityId] ?? CITY_STYLE.nexis;
}

export function getAdventuresForCity(cityId) {
  return ADVENTURE_DEFINITIONS.filter((entry) => entry.cityId === cityId || (entry.cityId === "nexis" && entry.id === "cross_city_concordant_trace"));
}

export function getAdventureBoardNotices(cityId) {
  return getAdventuresForCity(cityId).slice(0, 4).map((entry) => ({
    id: entry.id,
    title: entry.title,
    summary: `${entry.riskBand} ${getAdventureCategory(entry.category)?.label ?? "expedition"}: ${entry.threatType}. ${entry.rewardCategory}.`,
    route: "/adventure",
    actionLabel: "Open adventure",
    rewardLabel: entry.rewardCategory,
    requirementLabel: entry.recommendedPrep.slice(0, 2).join(" | "),
    source: "adventure",
  }));
}

export function getHiddenSiteForAdventure(adventure) {
  if (!adventure?.hiddenSiteId) return null;
  return HIDDEN_SITE_DEFINITIONS.find((site) => site.id === adventure.hiddenSiteId) ?? null;
}
