import { type WorldCityId } from "./worldMapData";

export type CityServiceStatus = "open" | "locked" | "unavailable";

export type CityService = {
  label: string;
  route?: string;
  status: CityServiceStatus;
  lockReason?: string;
  summary: string;
};

export type CityHubContent = {
  cityId: WorldCityId;
  displayName: string;
  identity: string;
  overview: string;
  localIdentity: string;
  propertyFlavor: string;
  peopleIntro: string;
  market: {
    name: string;
    summary: string;
    imports: string[];
    exports: string[];
    featuredGoods: string[];
  };
  academy: {
    name: string;
    focus: string;
    status: CityServiceStatus;
    lockReason?: string;
    unlockCourse?: string;
  };
  special: {
    name: string;
    summary: string;
    status: CityServiceStatus;
    lockReason?: string;
  };
  services: {
    market: CityService;
    people: CityService;
    blackMarket: CityService;
    citySpecial: CityService;
    academy: CityService;
    travel: CityService;
    consortium: CityService;
    guild: CityService;
  };
  lockedContent: Array<{ label: string; reason: string; unlockPath: string }>;
};

const CITY_HUBS: Record<WorldCityId, CityHubContent> = {
  nexis: {
    cityId: "nexis",
    displayName: "Nexis City",
    identity: "Starter capital / civic baseline / safe hub",
    overview: "The central civic hub where baseline services, starter jobs, legal trade, housing, and organization systems stay fully available.",
    localIdentity: "Civic paperwork, public boards, academy fundamentals, and safe starter routes define the capital.",
    propertyFlavor: "Baseline apartments, civic leases, and organization plot filings are normalized here.",
    peopleIntro: "Citizens currently registered in Nexis City appear here with public profile links only.",
    market: {
      name: "Civic Market Hall",
      summary: "Legal starter goods, travel basics, and general-purpose supplies.",
      imports: ["basic tools", "rations", "paperwork supplies"],
      exports: ["permits", "civic contracts", "starter equipment"],
      featuredGoods: ["Rations", "Rope", "Courier Satchel", "Vial of Ink"],
    },
    academy: {
      name: "Nexis Civic Academy",
      focus: "General studies, civic administration, watch procedure, and legal fundamentals.",
      status: "open",
    },
    special: {
      name: "City Board Bureau",
      summary: "Registry packets, dispatch vouchers, public work, and civic services remain centered here.",
      status: "open",
    },
    services: {
      market: { label: "Nexis City Market", route: "/market", status: "open", summary: "Legal capital market." },
      people: { label: "People", route: "/city#people", status: "open", summary: "Current public presence in the city." },
      blackMarket: { label: "Black Market", route: "/black-market", status: "locked", summary: "Underworld access is gated.", lockReason: "Requires Street Survival and 4 Nexis City standing." },
      citySpecial: { label: "City Special", route: "/city#special", status: "open", summary: "City Board Bureau." },
      academy: { label: "Academy", route: "/city#academy", status: "open", summary: "Civic Academy presence." },
      travel: { label: "Travel", route: "/travel", status: "open", summary: "Capital travel gate." },
      consortium: { label: "Consortium", route: "/consortiums", status: "open", summary: "Company management." },
      guild: { label: "Guild", route: "/guilds", status: "open", summary: "Guild management." },
    },
    lockedContent: [
      { label: "Black Market", reason: "Underworld trade requires Street Survival and local standing outside Blackharbor.", unlockPath: "Street Survival + 4 local standing" },
    ],
  },
  west: {
    cityId: "west",
    displayName: "Blackharbor",
    identity: "Port / maritime trade / smuggling pressure",
    overview: "A salt-stained port hub where legal cargo, private escorts, and quiet smuggling pressure sit uncomfortably close together.",
    localIdentity: "Dockside brokers import potions and reagents while harbor guilds argue about escorts, tariffs, and missing manifests.",
    propertyFlavor: "Warehouses, dock offices, tide-cellars, and protected counting rooms matter more than comfort here.",
    peopleIntro: "Dockhands, smugglers, escorts, and visiting citizens currently in Blackharbor are listed with controlled public details.",
    market: {
      name: "Dock Market",
      summary: "Maritime supplies, potion imports, cargo gear, and under-the-table rumors.",
      imports: ["healing potions", "salt glass", "foreign spices", "sealed cargo"],
      exports: ["escort contracts", "ship fittings", "contraband rumors"],
      featuredGoods: ["Medicinal Herb", "Travel Cloak", "Lockpick Set", "Courier Satchel"],
    },
    academy: {
      name: "Maritime Ledger Academy",
      focus: "Maritime commerce, covert routing, corsair law, and cargo risk reading.",
      status: "locked",
      lockReason: "Requires World Geography to read sea lanes without becoming expensive driftwood.",
      unlockCourse: "World Geography",
    },
    special: {
      name: "Harbor Exchange",
      summary: "Potion import lots and cargo broker introductions give Blackharbor a direct port-service loop.",
      status: "open",
    },
    services: {
      market: { label: "Blackharbor Market", route: "/market", status: "open", summary: "Dock market and potion imports." },
      people: { label: "People", route: "/city#people", status: "open", summary: "Public city presence." },
      blackMarket: { label: "Black Market", route: "/black-market", status: "open", summary: "Blackharbor underdock access." },
      citySpecial: { label: "City Special", route: "/city#special", status: "open", summary: "Harbor Exchange." },
      academy: { label: "Academy", route: "/city#academy", status: "locked", summary: "Maritime Ledger Academy.", lockReason: "Requires World Geography." },
      travel: { label: "Travel", route: "/travel", status: "open", summary: "Sea and road departures." },
      consortium: { label: "Consortium", route: "/consortiums", status: "open", summary: "Cargo companies and ledgers." },
      guild: { label: "Guild", route: "/guilds", status: "open", summary: "Guild board." },
    },
    lockedContent: [
      { label: "Corsair Academy Detail", reason: "Sea-lane instruction is unsafe without route literacy.", unlockPath: "Complete World Geography" },
    ],
  },
  north: {
    cityId: "north",
    displayName: "Silverbough",
    identity: "Arcane / herbal / relic / healing city",
    overview: "A northern enclave of warded boughs, herb courts, relic catalogues, and healer-scholar circles.",
    localIdentity: "The city is academy-heavy: its market, social life, and special services bend toward herbs, relics, and restorative study.",
    propertyFlavor: "Residences favor quiet study cells, herb lofts, and warded recovery rooms.",
    peopleIntro: "Visiting scholars, healers, relic runners, and citizens currently in Silverbough are listed here without private data.",
    market: {
      name: "Herbal Relic Market",
      summary: "Herbs, alchemy components, relic papers, and healing tools dominate the stalls.",
      imports: ["rare roots", "moonwater", "relic rubbings"],
      exports: ["medicinal herbs", "enchanted parchment", "healing services"],
      featuredGoods: ["Wild Herb", "Medicinal Herb", "Herbalist Gloves", "Enchanted Parchment"],
    },
    academy: {
      name: "Silverbough Arcane Conservatory",
      focus: "Healing theory, relic handling, ward literacy, and arcane field ethics.",
      status: "locked",
      lockReason: "Requires World Geography before northern ward routes open safely.",
      unlockCourse: "World Geography",
    },
    special: {
      name: "Conservatory Petition Desk",
      summary: "Shrine petitions and relic appraisal tokens turn Silverbough standing into practical supplies.",
      status: "open",
    },
    services: {
      market: { label: "Silverbough Market", route: "/market", status: "open", summary: "Herbs, relics, and healing tools." },
      people: { label: "People", route: "/city#people", status: "open", summary: "Public city presence." },
      blackMarket: { label: "Black Market", status: "locked", summary: "No open under-market.", lockReason: "Silverbough seals illicit relic trade behind World Geography and trusted local standing." },
      citySpecial: { label: "City Special", route: "/city#special", status: "open", summary: "Conservatory petitions." },
      academy: { label: "Academy", route: "/city#academy", status: "locked", summary: "Arcane Conservatory.", lockReason: "Requires World Geography." },
      travel: { label: "Travel", route: "/travel", status: "open", summary: "Northern routes." },
      consortium: { label: "Consortium", route: "/consortiums", status: "open", summary: "Scholarly suppliers." },
      guild: { label: "Guild", route: "/guilds", status: "open", summary: "Guild board." },
    },
    lockedContent: [
      { label: "Relic Field Permits", reason: "Relic work requires safe-route literacy and academy sponsorship.", unlockPath: "World Geography -> Historical Awareness" },
    ],
  },
  east: {
    cityId: "east",
    displayName: "Ironhall",
    identity: "Forge / labor / crafting / material city",
    overview: "A furnace-bright industrial city of forge contracts, material yards, labor halls, and enginewright prototypes.",
    localIdentity: "Ironhall runs on ore, contracts, tools, armor fittings, and people who consider sparks a weather pattern.",
    propertyFlavor: "Workshops, rented benches, material lockers, and reinforced rooms matter here.",
    peopleIntro: "Smiths, labor crews, contractors, and citizens currently in Ironhall are shown with public profile details only.",
    market: {
      name: "Forge Market",
      summary: "Tools, ore, armor materials, and contract supplies sit front and center.",
      imports: ["coal", "raw ore", "timber braces"],
      exports: ["iron fittings", "tools", "armor blanks"],
      featuredGoods: ["Iron Ore", "Smithing Hammer", "Miners Pick", "Wood Axe"],
    },
    academy: {
      name: "Ironhall Enginewright School",
      focus: "Forge discipline, war-school fundamentals, materials, and industrial planning.",
      status: "locked",
      lockReason: "Requires Practical Arithmetic for material orders and forge math.",
      unlockCourse: "Practical Arithmetic",
    },
    special: {
      name: "Contract Forge",
      summary: "Material requisitions and forge commission slots convert Ironhall access into real workshop stock.",
      status: "open",
    },
    services: {
      market: { label: "Ironhall Market", route: "/market", status: "open", summary: "Forge tools and materials." },
      people: { label: "People", route: "/city#people", status: "open", summary: "Public city presence." },
      blackMarket: { label: "Black Market", status: "locked", summary: "No open under-market.", lockReason: "Industrial backchannels require Practical Arithmetic, Street Survival, and trusted local standing." },
      citySpecial: { label: "City Special", route: "/city#special", status: "open", summary: "Contract Forge." },
      academy: { label: "Academy", route: "/city#academy", status: "locked", summary: "Enginewright School.", lockReason: "Requires Practical Arithmetic." },
      travel: { label: "Travel", route: "/travel", status: "open", summary: "Forge-road departures." },
      consortium: { label: "Consortium", route: "/consortiums", status: "open", summary: "Industrial companies." },
      guild: { label: "Guild", route: "/guilds", status: "open", summary: "Guild board." },
    },
    lockedContent: [
      { label: "Enginewright Workshop", reason: "Forge planning requires arithmetic and material ledgers.", unlockPath: "Complete Practical Arithmetic" },
    ],
  },
  south: {
    cityId: "south",
    displayName: "Highcourt",
    identity: "Law / diplomacy / prestige / permits city",
    overview: "A polished seat of courts, permits, diplomacy, prestige titles, and consortium-facing legal theatre.",
    localIdentity: "Highcourt rewards etiquette, filings, legal knowledge, and the ability to survive a meeting without insulting a clerk.",
    propertyFlavor: "Residences are status signals: leased suites, embassy rooms, and permit-bound offices.",
    peopleIntro: "Envoys, petitioners, legal clerks, and citizens currently in Highcourt appear here with controlled public details.",
    market: {
      name: "Permit Arcade",
      summary: "Legal services, seal kits, paperwork supplies, titles, and diplomatic introductions.",
      imports: ["fine ink", "official seals", "court attire"],
      exports: ["permits", "titles", "legal filings"],
      featuredGoods: ["Vial of Ink", "Forged Seal Kit", "Courier Satchel", "Forged Document"],
    },
    academy: {
      name: "Highcourt Rhetoric and Statecraft Lyceum",
      focus: "Civic law, rhetoric, diplomacy, permit procedure, and prestige administration.",
      status: "locked",
      lockReason: "Requires Civic Fundamentals before court-facing study opens.",
      unlockCourse: "Civic Fundamentals",
    },
    special: {
      name: "Permit Court",
      summary: "Legal seal packets and noble introductions turn Highcourt standing into useful permit-facing goods.",
      status: "open",
    },
    services: {
      market: { label: "Highcourt Market", route: "/market", status: "open", summary: "Permits and prestige goods." },
      people: { label: "People", route: "/city#people", status: "open", summary: "Public city presence." },
      blackMarket: { label: "Black Market", status: "locked", summary: "No public under-market.", lockReason: "Highcourt covert influence requires Civic Fundamentals and trusted local standing." },
      citySpecial: { label: "City Special", route: "/city#special", status: "open", summary: "Permit Court." },
      academy: { label: "Academy", route: "/city#academy", status: "locked", summary: "Rhetoric and Statecraft Lyceum.", lockReason: "Requires Civic Fundamentals." },
      travel: { label: "Travel", route: "/travel", status: "open", summary: "Diplomatic routes." },
      consortium: { label: "Consortium", route: "/consortiums", status: "open", summary: "Legal companies and filings." },
      guild: { label: "Guild", route: "/guilds", status: "open", summary: "Guild board." },
    },
    lockedContent: [
      { label: "Prestige Permit Desk", reason: "Court procedure is locked until civic foundations are complete.", unlockPath: "Complete Civic Fundamentals" },
    ],
  },
};

export function getCityHubContent(cityId: WorldCityId | string | null | undefined): CityHubContent {
  const key = (cityId && cityId in CITY_HUBS ? cityId : "nexis") as WorldCityId;
  return CITY_HUBS[key];
}

export function getCityServiceLinks(cityId: WorldCityId | string | null | undefined) {
  const hub = getCityHubContent(cityId);
  return Object.values(hub.services).filter((service) => service.status === "open" && service.route);
}
