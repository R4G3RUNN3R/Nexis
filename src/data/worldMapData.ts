import { hellenicRegionalPack, hellenicSubregions } from "./hellenicRegionalPack";

export type WorldCityId = "nexis" | "north" | "east" | "west" | "south";

export type WorldCity = {
  id: WorldCityId;
  name: string;
  subtitle: string;
  region: "core" | "north" | "east" | "west" | "south";
  academy?: string;
  accessRule: string;
  xPercent: number;
  yPercent: number;
  travelFeel: string;
  summary: string;
  notes: string[];
  continuity: "preserved_core";
  anchorRole: "capital_core" | "northern_academy" | "eastern_academy" | "western_shadow_port" | "southern_sacred_academy";
};

export type WorldRegionStatus = "preserved_core" | "fully_wired" | "scaffolded" | "deferred";

export type WorldRegion = {
  id: string;
  name: string;
  kind:
    | "forest"
    | "mountain"
    | "swamp"
    | "wastes"
    | "volcanic"
    | "ruins"
    | "plains"
    | "desert"
    | "archipelago"
    | "sea"
    | "tundra";
  status: WorldRegionStatus;
  summary: string;
  xPercent: number;
  yPercent: number;
  travelModes: Array<"caravan" | "ship">;
  factionIdentity: string[];
  notes: string[];
};

export type WorldRoute = {
  id: string;
  from: WorldCityId;
  to: WorldCityId;
  type: "road" | "sea" | "mixed";
  travelLabel: string;
  rule: string;
  status: "fully_wired";
};

export type WorldScaffoldLink = {
  id: string;
  fromNodeId: string;
  toNodeId: string;
  type: "road" | "sea" | "mixed";
  status: Exclude<WorldRegionStatus, "preserved_core">;
  label: string;
  summary: string;
  requirements?: RouteRequirement[];
  discovery?: {
    state: "known" | "rumored" | "hidden";
    unlockHint: string;
  };
};

export type RouteRequirement = {
  kind: "education" | "item" | "reputation" | "escort" | "discovery";
  key: string;
  label: string;
  metByDefault?: boolean;
};

export type MacroRegion = {
  id: string;
  name: string;
  status: WorldRegionStatus;
  role: string;
  identity: string;
  subregionIds: string[];
  resources: string[];
  factions: string[];
  academyConcepts: string[];
  integrationTags: string[];
};

export type RegionNode = {
  id: string;
  macroRegionId: string;
  name: string;
  role: string;
  visibility: "visible" | "rumored" | "locked" | "hidden";
  resources: string[];
  factions: string[];
  missionTypes: string[];
  routeRequirements: RouteRequirement[];
  discoveryHooks: string[];
};

export type TravelRoute = {
  id: string;
  fromNodeId: string;
  toNodeId: string;
  type: "road" | "sea" | "mixed";
  status: "open" | "locked" | "rumored";
  label: string;
  requirements: RouteRequirement[];
};

export const worldMapTitle = "The Lands of Nexis - Expanded World";

export const worldMapCanonicalSources = [
  "Original Nexis core world map (continuity anchors)",
  "Expanded world map image (macro geography and seas)",
  "Nexis Game Master Plan PDF (expansion priorities and progression order)",
] as const;

export const worldCoreAnchors = [
  "Nexis City",
  "Blackharbor Shadow Port",
  "Silverbough Arcane Enclave",
  "Akai Tetsu War Dojo",
  "Spiritwood Sacred Isle",
  "Red Sand Wastes",
] as const;

export const macroRegions: MacroRegion[] = [
  {
    id: hellenicRegionalPack.id,
    name: hellenicRegionalPack.name,
    status: "scaffolded",
    role: hellenicRegionalPack.macroRegionRole,
    identity: hellenicRegionalPack.blocIdentity,
    subregionIds: hellenicSubregions.map((subregion) => subregion.id),
    resources: [...hellenicRegionalPack.regionalResources],
    factions: [...hellenicRegionalPack.factions],
    academyConcepts: [...hellenicRegionalPack.academyConcepts],
    integrationTags: [
      ...hellenicRegionalPack.integrations.education,
      ...hellenicRegionalPack.integrations.travel,
      ...hellenicRegionalPack.integrations.economy,
    ],
  },
];

export const regionNodes: RegionNode[] = hellenicSubregions.map((subregion, index) => ({
  id: subregion.id,
  macroRegionId: hellenicRegionalPack.id,
  name: subregion.name,
  role: subregion.role,
  visibility: index < 3 ? "rumored" : "locked",
  resources: subregion.resources,
  factions: subregion.factions,
  missionTypes: subregion.missionTypes,
  routeRequirements: subregion.educationLinks.map((courseId) => ({
    kind: "education",
    key: courseId,
    label: courseId.replace(/-/g, " "),
  })),
  discoveryHooks: subregion.discoveryHooks,
}));

export const travelRoutes: TravelRoute[] = [
  {
    id: "route_core_hellenic_sphere",
    fromNodeId: "nexis",
    toNodeId: "hellenic_sphere",
    type: "sea",
    status: "locked",
    label: "Hellenic embassy sea lane",
    requirements: [
      { kind: "education", key: "world-geography", label: "World Geography" },
      { kind: "education", key: "route-surveying", label: "Route Surveying" },
    ],
  },
  {
    id: "route_blackharbor_pirate_straits",
    fromNodeId: "west",
    toNodeId: "pirate_straits",
    type: "sea",
    status: "locked",
    label: "Blackharbor to Pirate Straits",
    requirements: [
      { kind: "education", key: "illicit-trade-awareness", label: "Illicit Trade Awareness" },
      { kind: "escort", key: "escort_coverage", label: "Escort coverage" },
    ],
  },
];

export const worldCities: WorldCity[] = [
  {
    id: "nexis",
    name: "Nexis City",
    subtitle: "Core Heartland Capital",
    region: "core",
    xPercent: 45.6,
    yPercent: 49.2,
    accessRule: "Always accessible",
    travelFeel: "Core political and commercial heartland hub.",
    summary:
      "Nexis City remains the canonical core city. The wider world now expands around it instead of replacing it.",
    notes: [
      "Main city and starting hub.",
      "Keeps existing academy and progression anchors intact.",
      "Serves as the integration point for future caravan and ship expansion.",
    ],
    continuity: "preserved_core",
    anchorRole: "capital_core",
  },
  {
    id: "north",
    name: "Silverbough Arcane Enclave",
    subtitle: "Northern Elven Arcane Belt",
    region: "north",
    academy: "Silverbough Arcane Conservatory",
    xPercent: 43.8,
    yPercent: 8.9,
    accessRule: "Long northern overland route",
    travelFeel: "A northern ascent into elven highlands and mountain wards.",
    summary:
      "The northern elven anchor remains fixed in the highland arcane belt and now fronts a broader northern frontier.",
    notes: [
      "Preserved academy destination.",
      "Primary anchor for northern elf territory.",
      "Feeds future highland magic, barbarian-border, and relic systems.",
    ],
    continuity: "preserved_core",
    anchorRole: "northern_academy",
  },
  {
    id: "east",
    name: "Akai Tetsu War Dojo",
    subtitle: "Eastern Martial Zone",
    region: "east",
    academy: "Akai Tetsu War Dojo",
    xPercent: 60.2,
    yPercent: 34.9,
    accessRule: "Long eastern route by land or controlled coastal passage",
    travelFeel: "A distant martial coastline that now opens toward larger eastern sea lanes.",
    summary:
      "Akai Tetsu remains the eastern martial anchor across water from the core, now tied into future archipelago and convoy networks.",
    notes: [
      "Preserved academy destination.",
      "Supports future eastern warbands and escort contracts.",
      "Maintains separation from core heartland through maritime geometry.",
    ],
    continuity: "preserved_core",
    anchorRole: "eastern_academy",
  },
  {
    id: "west",
    name: "Blackharbor Shadow Port",
    subtitle: "Western Maritime Pivot",
    region: "west",
    academy: "The Iron Writ & Veiled Ledger",
    xPercent: 13.4,
    yPercent: 24.2,
    accessRule: "Ship required",
    travelFeel: "Western sea crossing into shadow trade and hard port politics.",
    summary:
      "Blackharbor remains the western shadow-port anchor and is now explicitly the maritime hinge toward pirate waters and southern danger lanes.",
    notes: [
      "Preserved western academy destination.",
      "Major pivot for pirate-isle and ruined-lands sea scaffolding.",
      "Supports future smuggling, escorts, and naval contract loops.",
    ],
    continuity: "preserved_core",
    anchorRole: "western_shadow_port",
  },
  {
    id: "south",
    name: "Spiritwood Sacred Isle",
    subtitle: "Spiritual Grove / Sacred Isle",
    region: "south",
    academy: "Verdant Ancestral Circle",
    xPercent: 50.3,
    yPercent: 47.8,
    accessRule: "Ship required, then inland sacred access",
    travelFeel: "A sacred maritime approach from the core into spirit-bound territory.",
    summary:
      "Spiritwood remains the southeastern sacred island anchor near the core heartland, preserving academy continuity while opening southern expansion paths.",
    notes: [
      "Preserved southern academy destination.",
      "Canonical Spiritual Grove / Sacred Isle placement retained.",
      "Bridges core progression to Myrine and deeper southern hazards.",
    ],
    continuity: "preserved_core",
    anchorRole: "southern_sacred_academy",
  },
];

export const worldRegions: WorldRegion[] = [
  {
    id: "nexis_heartland_core",
    name: "Nexis Heartland",
    kind: "plains",
    status: "preserved_core",
    xPercent: 45.4,
    yPercent: 50.4,
    travelModes: ["caravan", "ship"],
    factionIdentity: ["civic_powers", "merchant_houses", "academy_routes"],
    summary: "The original political and cultural core around Nexis City.",
    notes: [
      "Continuity anchor from the original map.",
      "Keeps existing city progression intact.",
    ],
  },
  {
    id: "blackharbor_shadow_coast",
    name: "Blackharbor Shadow Coast",
    kind: "sea",
    status: "preserved_core",
    xPercent: 14.0,
    yPercent: 25.2,
    travelModes: ["ship"],
    factionIdentity: ["shadow_port", "privateers", "smugglers"],
    summary: "Western maritime sphere centered on Blackharbor.",
    notes: [
      "Core continuity zone.",
      "Now explicitly adjacent to pirate-route scaffolding.",
    ],
  },
  {
    id: "silverbough_northern_arcane_belt",
    name: "Silverbough Northern Arcane Belt",
    kind: "mountain",
    status: "preserved_core",
    xPercent: 44.0,
    yPercent: 10.2,
    travelModes: ["caravan"],
    factionIdentity: ["northern_elves", "arcane_scholars"],
    summary: "Northern highland and arcane mountain belt tied to Silverbough.",
    notes: [
      "Preserves northern elven territory placement.",
      "Supports future magical corridor encounters.",
    ],
  },
  {
    id: "akai_martial_channel",
    name: "Akai Martial Channel",
    kind: "sea",
    status: "fully_wired",
    xPercent: 60.8,
    yPercent: 35.8,
    travelModes: ["ship", "caravan"],
    factionIdentity: ["martial_orders", "escort_clans"],
    summary: "Eastern martial sea and shore routes around the Akai Tetsu zone.",
    notes: [
      "Anchors escort and warband route scaffolding.",
    ],
  },
  {
    id: "spiritwood_sacred_isles",
    name: "Spiritwood Sacred Isles",
    kind: "archipelago",
    status: "preserved_core",
    xPercent: 50.8,
    yPercent: 48.7,
    travelModes: ["ship", "caravan"],
    factionIdentity: ["spirit_keepers", "healing_orders"],
    summary: "Sacred island chain around Spiritwood and the Spiritual Grove.",
    notes: [
      "Core sacred-isle continuity retained.",
      "Gateway toward Myrine waters and southern hazards.",
    ],
  },
  {
    id: "red_sand_wastes",
    name: "Red Sand Wastes",
    kind: "desert",
    status: "preserved_core",
    xPercent: 31.0,
    yPercent: 59.4,
    travelModes: ["caravan"],
    factionIdentity: ["waste_survivors", "caravan_raiders"],
    summary: "Existing desert/wastes belt south-west of the core.",
    notes: [
      "Preserves prior desert logic from the original map.",
      "Links into dune and oasis expansion scaffolding.",
    ],
  },
  {
    id: "barbarian_frontier_northeast",
    name: "Barbarian Frontier",
    kind: "tundra",
    status: "scaffolded",
    xPercent: 72.4,
    yPercent: 15.4,
    travelModes: ["caravan", "ship"],
    factionIdentity: ["barbarian_tribes", "frontier_warlords"],
    summary: "North-eastern tribal frontier beyond the core northern belts.",
    notes: [
      "Region scaffold only in this pass.",
      "Future tribal systems and campaign arcs deferred.",
    ],
  },
  {
    id: "myrine_archipelago",
    name: "Myrine Archipelago",
    kind: "archipelago",
    status: "scaffolded",
    xPercent: 74.8,
    yPercent: 78.0,
    travelModes: ["ship"],
    factionIdentity: ["island_leagues", "maritime_city_states"],
    summary: "South-eastern island league zone for long-form maritime expansion.",
    notes: [
      "Uses canonical name Myrine Archipelago.",
      "Port/city-state mechanics intentionally deferred.",
    ],
  },
  {
    id: "hellenic_sphere",
    name: "Hellenic Sphere",
    kind: "archipelago",
    status: "scaffolded",
    xPercent: 67.2,
    yPercent: 68.8,
    travelModes: ["ship", "caravan"],
    factionIdentity: ["scholarly_poleis", "martial_states", "maritime_houses", "oracle_orders"],
    summary: hellenicRegionalPack.blocIdentity,
    notes: [
      "Regional bloc scaffold for city-state politics, academy concepts, trade identity, and discovery-gated ruins.",
      "Linked to Applied Knowledge, Warfare, Commerce, and route-surveying education gates.",
    ],
  },
  {
    id: "ruined_lands_south",
    name: "Ruined Lands",
    kind: "ruins",
    status: "scaffolded",
    xPercent: 47.8,
    yPercent: 90.5,
    travelModes: ["caravan", "ship"],
    factionIdentity: ["ruin_scavengers", "ancient_threats"],
    summary: "Southern ruin belt beneath the core world.",
    notes: [
      "Hazards and deep ruin logic deferred.",
      "Positioned to connect both pirate and Myrine sea networks.",
    ],
  },
  {
    id: "pirate_isles_southwest",
    name: "Pirate Isles",
    kind: "archipelago",
    status: "scaffolded",
    xPercent: 9.0,
    yPercent: 84.0,
    travelModes: ["ship"],
    factionIdentity: ["pirate_fleets", "corsair_clans"],
    summary: "South-western pirate archipelago tied to Blackharbor's maritime sphere.",
    notes: [
      "Placed below and adjacent to the western maritime zone.",
      "Pirate system loops intentionally deferred.",
    ],
  },
  {
    id: "dune_kingdom_belt",
    name: "Dune Kingdom Belt",
    kind: "desert",
    status: "scaffolded",
    xPercent: 33.0,
    yPercent: 73.2,
    travelModes: ["caravan"],
    factionIdentity: ["dune_kingdoms", "nomad_clans"],
    summary: "Expanded desert civilization belt beyond the existing wastes.",
    notes: [
      "Caravan civ scaffold only.",
      "Political/economic systems deferred.",
    ],
  },
  {
    id: "oasis_city_chain",
    name: "Oasis City Chain",
    kind: "plains",
    status: "scaffolded",
    xPercent: 37.4,
    yPercent: 79.2,
    travelModes: ["caravan"],
    factionIdentity: ["oasis_cities", "trade_caravans"],
    summary: "String of oasis city hubs for future desert trade progression.",
    notes: [
      "Encodes oasis-city identity without full implementation.",
    ],
  },
  {
    id: "wild_creature_corridors",
    name: "Wild Creature Corridors",
    kind: "forest",
    status: "scaffolded",
    xPercent: 51.4,
    yPercent: 54.4,
    travelModes: ["caravan", "ship"],
    factionIdentity: ["magical_creatures", "strange_entities"],
    summary: "Inter-regional wilderness pressure where magical and strange creatures move between civilized belts.",
    notes: [
      "Deliberately spread between regions instead of isolated to one corner.",
      "Encounter table implementation deferred.",
    ],
  },
];

export const worldRoutes: WorldRoute[] = [
  {
    id: "route_nexis_north",
    from: "nexis",
    to: "north",
    type: "road",
    status: "fully_wired",
    travelLabel: "Northern overland ascent",
    rule: "Long land route through foothills, forest approaches, and mountain passes.",
  },
  {
    id: "route_nexis_east",
    from: "nexis",
    to: "east",
    type: "road",
    status: "fully_wired",
    travelLabel: "Eastern war road",
    rule: "Long overland route intended to feel far from the capital.",
  },
  {
    id: "route_nexis_west",
    from: "nexis",
    to: "west",
    type: "sea",
    status: "fully_wired",
    travelLabel: "Western sea crossing",
    rule: "Requires ship travel once route rules are live.",
  },
  {
    id: "route_nexis_south",
    from: "nexis",
    to: "south",
    type: "mixed",
    status: "fully_wired",
    travelLabel: "Southern sacred approach",
    rule: "Requires ship travel, then restricted inland access through sacred territory.",
  },
  {
    id: "route_east_south",
    from: "east",
    to: "south",
    type: "sea",
    status: "fully_wired",
    travelLabel: "South-eastern sea route",
    rule: "Alternative sea route between the martial east and sacred south.",
  },
];

export const worldScaffoldLinks: WorldScaffoldLink[] = [
  {
    id: "scaffold_west_pirate",
    fromNodeId: "west",
    toNodeId: "pirate_isles_southwest",
    type: "sea",
    status: "scaffolded",
    label: "Corsair lanes",
    summary: "Future pirate contract and interception waters tied to Blackharbor.",
  },
  {
    id: "scaffold_west_ruined",
    fromNodeId: "west",
    toNodeId: "ruined_lands_south",
    type: "sea",
    status: "scaffolded",
    label: "Ashwater passage",
    summary: "Dangerous western-southern route skirting ruin belts.",
  },
  {
    id: "scaffold_south_myrine",
    fromNodeId: "south",
    toNodeId: "myrine_archipelago",
    type: "sea",
    status: "scaffolded",
    label: "Sacred-to-Myrine sea lane",
    summary: "Future island league exchange and mission corridor.",
  },
  {
    id: "scaffold_core_hellenic",
    fromNodeId: "nexis",
    toNodeId: "hellenic_sphere",
    type: "sea",
    status: "scaffolded",
    label: "Hellenic embassy sea lane",
    summary: "Discovery-gated regional route toward scholarly poleis, martial states, sanctuaries, and pirate straits.",
    requirements: [
      { kind: "education", key: "world-geography", label: "World Geography" },
      { kind: "education", key: "route-surveying", label: "Route Surveying" },
    ],
    discovery: {
      state: "rumored",
      unlockHint: "Complete World Geography and Route Surveying to reveal detailed Hellenic lanes.",
    },
  },
  {
    id: "scaffold_myrine_hellenic",
    fromNodeId: "myrine_archipelago",
    toNodeId: "hellenic_sphere",
    type: "sea",
    status: "scaffolded",
    label: "Island league exchange",
    summary: "Future maritime trade and academy-cultural exchange between Myrine and the Hellenic sphere.",
    requirements: [
      { kind: "education", key: "institutional-logistics", label: "Institutional Logistics" },
    ],
    discovery: {
      state: "hidden",
      unlockHint: "Regional discovery events will reveal this exchange lane.",
    },
  },
  {
    id: "scaffold_east_myrine",
    fromNodeId: "east",
    toNodeId: "myrine_archipelago",
    type: "sea",
    status: "scaffolded",
    label: "Eastern convoy circuit",
    summary: "Martial escort routes toward Myrine waters.",
  },
  {
    id: "scaffold_north_barbarian",
    fromNodeId: "north",
    toNodeId: "barbarian_frontier_northeast",
    type: "road",
    status: "scaffolded",
    label: "Highland frontier march",
    summary: "Northern pressure line into barbarian tribal territory.",
  },
  {
    id: "scaffold_nexis_dune",
    fromNodeId: "nexis",
    toNodeId: "dune_kingdom_belt",
    type: "road",
    status: "scaffolded",
    label: "Southern caravan trunk",
    summary: "Main caravan spine from core heartland toward desert civilization belts.",
  },
  {
    id: "scaffold_dune_oasis",
    fromNodeId: "dune_kingdom_belt",
    toNodeId: "oasis_city_chain",
    type: "road",
    status: "scaffolded",
    label: "Oasis trade chain",
    summary: "Desert merchant and nomad interaction corridor.",
  },
  {
    id: "scaffold_ruined_myrine",
    fromNodeId: "ruined_lands_south",
    toNodeId: "myrine_archipelago",
    type: "sea",
    status: "scaffolded",
    label: "Broken gulf crossing",
    summary: "Future high-risk sea route between ruins and island leagues.",
  },
  {
    id: "scaffold_pirate_ruined",
    fromNodeId: "pirate_isles_southwest",
    toNodeId: "ruined_lands_south",
    type: "sea",
    status: "scaffolded",
    label: "Raid corridor",
    summary: "Pirate pressure route toward southern ruin coastlines.",
  },
  {
    id: "scaffold_core_wilds",
    fromNodeId: "nexis_heartland_core",
    toNodeId: "wild_creature_corridors",
    type: "mixed",
    status: "scaffolded",
    label: "Wild pressure ring",
    summary: "Future roaming magical-creature pressure around civilized regions.",
  },
];
