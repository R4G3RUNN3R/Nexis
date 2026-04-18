export type WorldCityId = "nexis" | "north" | "east" | "west" | "south";

export type WorldCity = {
  id: WorldCityId;
  name: string;
  subtitle: string;
  region: "center" | "north" | "east" | "west" | "south";
  academy?: string;
  accessRule: string;
  xPercent: number;
  yPercent: number;
  travelFeel: string;
  summary: string;
  notes: string[];
};

export type WorldRegion = {
  id: string;
  name: string;
  kind: "forest" | "mountain" | "swamp" | "wastes" | "volcanic" | "ruins" | "plains";
  summary: string;
  notes: string[];
};

export type WorldRoute = {
  id: string;
  from: WorldCityId;
  to: WorldCityId;
  type: "road" | "sea" | "mixed";
  travelLabel: string;
  rule: string;
};

export const worldMapTitle = "The Lands of Nexis";

export const worldCities: WorldCity[] = [
  {
    id: "nexis",
    name: "Nexis City",
    subtitle: "Capital City",
    region: "center",
    xPercent: 49.2,
    yPercent: 38.7,
    accessRule: "Always accessible",
    travelFeel: "Central hub and anchor point for all major routes.",
    summary:
      "The political, commercial, and social center of the world. This is the default hub for players and the seat of the merchant-focused Nexis Academy.",
    notes: [
      "Main city and starting hub.",
      "Contains the Guildhall of Civil Professions.",
      "Connects all major regions through road, coast, and sea routes.",
    ],
  },
  {
    id: "north",
    name: "Silverbough Arcane Enclave",
    subtitle: "Northern Elven Arcane City",
    region: "north",
    academy: "Silverbough Arcane Conservatory",
    xPercent: 50.8,
    yPercent: 15.2,
    accessRule: "Long northern overland route",
    travelFeel: "Far northern ascent through forest and mountain approaches.",
    summary:
      "The northern elven academy-city of arcane study, surrounded by mountain lines, forest belts, and hidden magical territory.",
    notes: [
      "Northern academy destination.",
      "Large mountain and forest separation justifies longer land travel.",
      "Supports magical ruins, hidden shrines, elite encounters, and ancient relic content.",
    ],
  },
  {
    id: "east",
    name: "Akai Tetsu War Dojo",
    subtitle: "Eastern Martial Territory",
    region: "east",
    academy: "Akai Tetsu War Dojo",
    xPercent: 88.4,
    yPercent: 30.5,
    accessRule: "Long eastern route by land or controlled coastal passage",
    travelFeel: "A long-distance eastern journey meant to feel far from the capital.",
    summary:
      "The eastern academy territory focused on combat discipline, weapon mastery, and tactical excellence.",
    notes: [
      "Eastern academy destination.",
      "Should feel distinctly far from Nexis City.",
      "Supports warbands, training grounds, dueling culture, and battlefield quests.",
    ],
  },
  {
    id: "west",
    name: "Blackharbor Shadow Port",
    subtitle: "Western Port Territory",
    region: "west",
    academy: "The Iron Writ & Veiled Ledger",
    xPercent: 14.4,
    yPercent: 30.8,
    accessRule: "Ship required",
    travelFeel: "Western sea crossing with strong port and underworld identity.",
    summary:
      "A western harbor-city of law, bounty control, shadow networks, contraband movement, and harsh coastal power.",
    notes: [
      "Western academy destination.",
      "Ship access should be mandatory once travel rules are live.",
      "Supports piracy, black market routes, bounty work, and port disputes.",
    ],
  },
  {
    id: "south",
    name: "Spiritwood Sacred Isle",
    subtitle: "Southern Sacred Territory",
    region: "south",
    academy: "Verdant Ancestral Circle",
    xPercent: 69.5,
    yPercent: 79.8,
    accessRule: "Ship required, then inland sacred access",
    travelFeel: "Hardest standard route, deliberately more remote and demanding.",
    summary:
      "A southern sacred island and spirit-bound region tied to healing, druidic power, and ancestral rites.",
    notes: [
      "Southern academy destination.",
      "Ship access is mandatory and the route should feel more difficult than the western crossing.",
      "Supports herbs, rites, spirits, survival content, and sacred trial quests.",
    ],
  },
];

export const worldRegions: WorldRegion[] = [
  {
    id: "aethelgard_forest",
    name: "Aethelgard Forest",
    kind: "forest",
    summary: "A dense magical woodland north-east of the capital.",
    notes: [
      "Good for magical creatures, hidden paths, and elven side content.",
      "Can later host herb gathering, fae events, and stealth quests.",
    ],
  },
  {
    id: "obsidian_peak",
    name: "Obsidian Peak",
    kind: "volcanic",
    summary: "A violent volcanic landmark east of Nexis City.",
    notes: [
      "High-danger zone.",
      "Strong candidate for fire enemies, rare ore, and late-game dungeons.",
    ],
  },
  {
    id: "weeping_mire",
    name: "Weeping Mire",
    kind: "swamp",
    summary: "A poisonous and haunted swamp south of the capital.",
    notes: [
      "Ideal for alchemy herbs, poison creatures, and occult questlines.",
      "The Tower of the Hag naturally belongs here as a dungeon or boss site.",
    ],
  },
  {
    id: "red_sand_wastes",
    name: "Red Sand Wastes",
    kind: "wastes",
    summary: "A harsh southern-southwestern barren region for survival content.",
    notes: [
      "Excellent for endurance-based travel events.",
      "Supports ruins, lost caravans, and desert-style encounters.",
    ],
  },
  {
    id: "sunken_plains",
    name: "Sunken Plains",
    kind: "plains",
    summary: "A broken lowland near the western-central approach.",
    notes: [
      "Useful for ruins, hidden vaults, and shifting event zones.",
      "Can host bandits, lost encampments, and supply-route conflicts.",
    ],
  },
];

export const worldRoutes: WorldRoute[] = [
  {
    id: "route_nexis_north",
    from: "nexis",
    to: "north",
    type: "road",
    travelLabel: "Northern overland ascent",
    rule: "Long land route through foothills, forest approaches, and mountain passes.",
  },
  {
    id: "route_nexis_east",
    from: "nexis",
    to: "east",
    type: "road",
    travelLabel: "Eastern war road",
    rule: "Long overland route intended to feel far from the capital.",
  },
  {
    id: "route_nexis_west",
    from: "nexis",
    to: "west",
    type: "sea",
    travelLabel: "Western sea crossing",
    rule: "Requires ship travel once route rules are live.",
  },
  {
    id: "route_nexis_south",
    from: "nexis",
    to: "south",
    type: "mixed",
    travelLabel: "Southern sacred approach",
    rule: "Requires ship travel, then restricted inland access through sacred territory.",
  },
  {
    id: "route_east_south",
    from: "east",
    to: "south",
    type: "sea",
    travelLabel: "South-eastern sea route",
    rule: "Alternative sea route between the martial east and sacred south.",
  },
];
