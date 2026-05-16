export type HellenicSubregion = {
  id: string;
  name: string;
  role: string;
  resources: string[];
  factions: string[];
  missionTypes: string[];
  academyConcepts: string[];
  marketIdentity: string;
  travelIdentity: string;
  educationLinks: string[];
  discoveryHooks: string[];
};

export const hellenicRegionalPack = {
  id: "hellenic_sphere",
  name: "Hellenic Sphere",
  blocIdentity:
    "A scholarly, martial, maritime, and sacred regional bloc built around rival city-states, island sanctuaries, temple ruins, and contested sea lanes.",
  macroRegionRole:
    "A mid-distance expansion bloc for education gates, trade convoys, military contracts, academy rivalries, and discovery-led ruins.",
  exports: ["olive oil", "wine", "marble", "bronze arms", "scholarly manuscripts", "ceremonial goods"],
  imports: ["grain", "timber", "iron ore", "horses", "rare dyes", "northern glass"],
  regionalResources: ["marble", "olive groves", "vineyards", "silver seams", "sacred relic fragments", "ship timber"],
  factions: [
    "Scholarly polis councils",
    "Martial brotherhoods",
    "Maritime merchant houses",
    "Oracle keepers",
    "Temple restoration orders",
    "Pirate strait captains",
  ],
  missionTypes: [
    "escort a philosopher-envoy",
    "recover a temple inscription",
    "protect a convoy through pirate straits",
    "train with a hoplite phalanx",
    "mediate city-state rival claims",
    "map an oracle mountain pass",
  ],
  academyConcepts: [
    "Rhetoric and civic debate",
    "Phalanx discipline",
    "Maritime logistics",
    "Temple archaeology",
    "Oracle interpretation",
    "Leadership and conquest doctrine",
  ],
  integrations: {
    education: ["Applied Knowledge", "General Studies", "Warfare & Fieldcraft", "Commerce & Logistics"],
    travel: ["regional route requirements", "discovery checks", "locked sea lanes"],
    jobs: ["civic mediation", "escort duty", "ruin recovery", "port inspections"],
    economy: ["marble contracts", "wine and oil export lanes", "grain import pressure"],
    discovery: ["temple ruins", "oracle passes", "island sanctuaries"],
  },
} as const;

export const hellenicSubregions: HellenicSubregion[] = [
  {
    id: "athenaeum_polis",
    name: "Athenaeum Polis",
    role: "Athens-type scholarly polis",
    resources: ["manuscripts", "silver", "olive oil"],
    factions: ["Assembly Speakers", "Academy Circles", "Archivist Families"],
    missionTypes: ["debate brief", "archive recovery", "permit arbitration"],
    academyConcepts: ["rhetoric", "logic", "civic law"],
    marketIdentity: "High-value manuscripts and civic permits.",
    travelIdentity: "Unlocked by applied ledgers and route surveying.",
    educationLinks: ["basic-literacy", "applied-ledgers", "field-investigation"],
    discoveryHooks: ["sealed lecture hall", "lost civic decree"],
  },
  {
    id: "laconian_marches",
    name: "Laconian Marches",
    role: "Sparta-type martial state",
    resources: ["bronze arms", "trained escorts", "hardened leather"],
    factions: ["Drill Houses", "Veteran Messes", "Border Wardens"],
    missionTypes: ["phalanx drill", "border patrol", "discipline trial"],
    academyConcepts: ["formation discipline", "endurance command", "war law"],
    marketIdentity: "Reliable arms, armor, and escort contracts.",
    travelIdentity: "Overland route with combat-readiness requirements.",
    educationLinks: ["drill-square-basics", "march-survival", "battlefield-reading"],
    discoveryHooks: ["old shield wall", "abandoned training ground"],
  },
  {
    id: "korinthos_isthmus",
    name: "Korinthos Isthmus",
    role: "Corinth-type maritime trade hub",
    resources: ["ship timber", "dyed cloth", "wine", "tar"],
    factions: ["Dock Syndics", "Pilot Guilds", "Toll Clerks"],
    missionTypes: ["convoy pricing", "dock inspection", "cargo mediation"],
    academyConcepts: ["maritime logistics", "trade arbitration", "route finance"],
    marketIdentity: "Regional exchange point for exports and import pressure.",
    travelIdentity: "Sea-lane hinge between core routes and island sanctuaries.",
    educationLinks: ["route-surveying", "caravan-operations", "institutional-logistics"],
    discoveryHooks: ["sunken toll marker", "old sea wall"],
  },
  {
    id: "theban_brotherhoods",
    name: "Theban Brotherhoods",
    role: "Thebes-type heavy infantry and brotherhood stronghold",
    resources: ["heavy shields", "field grain", "command instructors"],
    factions: ["Sacred Companies", "Field Captains", "Oath-Keepers"],
    missionTypes: ["oath escort", "brotherhood trial", "line defense"],
    academyConcepts: ["unit cohesion", "heavy infantry", "loyalty doctrine"],
    marketIdentity: "Heavy defensive gear and command-training contracts.",
    travelIdentity: "Requires local trust or martial credentials.",
    educationLinks: ["weapon-conditioning", "battlefield-reading", "applied-mastery"],
    discoveryHooks: ["sealed oath stone", "fallen standard"],
  },
  {
    id: "makedon_highlands",
    name: "Makedon Highlands",
    role: "Macedon-type leadership and conquest kingdom",
    resources: ["horses", "timber", "iron ore", "command retinues"],
    factions: ["Royal Companions", "Highland Houses", "Siege Engineers"],
    missionTypes: ["retinue logistics", "royal survey", "siege supply"],
    academyConcepts: ["leadership", "campaign logistics", "conquest administration"],
    marketIdentity: "Horses, timber, and highland military supply.",
    travelIdentity: "Mountain route with weather and authority gates.",
    educationLinks: ["permit-procedure", "institutional-logistics", "march-survival"],
    discoveryHooks: ["old royal road", "storm shrine"],
  },
  {
    id: "cycladic_sanctuaries",
    name: "Cycladic Sanctuaries",
    role: "Island sanctuaries and temple harbors",
    resources: ["ceremonial goods", "rare dyes", "relic fragments"],
    factions: ["Temple Keepers", "Pilgrim Brokers", "Island Wardens"],
    missionTypes: ["pilgrim escort", "temple restoration", "relic authentication"],
    academyConcepts: ["ritual logistics", "relic ethics", "sanctuary law"],
    marketIdentity: "Ceremonial goods, relic authentication, and pilgrimage supplies.",
    travelIdentity: "Ship routes with discovery and reputation gates.",
    educationLinks: ["historical-awareness", "field-investigation", "restorative-practice"],
    discoveryHooks: ["sealed altar", "oracle shell archive"],
  },
  {
    id: "pirate_straits",
    name: "Pirate Straits",
    role: "Contested pirate sea lanes",
    resources: ["contraband", "salvage", "stolen cargo"],
    factions: ["Strait Captains", "False Pilots", "Blackharbor Brokers"],
    missionTypes: ["escort convoy", "recover stolen cargo", "identify false flags"],
    academyConcepts: ["escort planning", "risk reading", "illicit trade awareness"],
    marketIdentity: "High-risk salvage and contraband pressure.",
    travelIdentity: "Locked until route requirements and escort coverage are met.",
    educationLinks: ["illicit-trade-awareness", "route-surveying", "institutional-logistics"],
    discoveryHooks: ["wreck field", "hidden cove ledger"],
  },
  {
    id: "oracle_mountains",
    name: "Oracle Mountains",
    role: "Mountain oracle territories and temple ruins",
    resources: ["oracle tablets", "marble", "herbs", "relic fragments"],
    factions: ["Oracle Houses", "Mountain Guides", "Ruin Wardens"],
    missionTypes: ["guide negotiation", "oracle pass survey", "tablet recovery"],
    academyConcepts: ["interpretation", "mountain survival", "ancient law"],
    marketIdentity: "Rare tablets, herbs, and temple restoration materials.",
    travelIdentity: "Fog-of-war region unlocked through geography and investigation.",
    educationLinks: ["world-geography", "historical-awareness", "field-investigation"],
    discoveryHooks: ["oracle pass", "buried amphitheater"],
  },
];
