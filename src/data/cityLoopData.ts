import { type WorldCityId } from "./worldMapData";

export type CityLocalContract = {
  id: string;
  title: string;
  type: string;
  summary: string;
  reward: string;
  requirement: string;
  route: string;
  risk: "low" | "moderate" | "high";
};

export type CityAcademyDetail = {
  theme: string;
  entryRequirements: string[];
  progressionSupports: string[];
  lockReason: string;
};

export type CityBlackMarketDetail = {
  name: string;
  summary: string;
  notices: Array<{ title: string; detail: string; requirement: string }>;
};

const CITY_LOCAL_CONTRACTS: Record<WorldCityId, CityLocalContract[]> = {
  nexis: [
    {
      id: "nexis-registry-errands",
      title: "Registry Errand Circuit",
      type: "Civic errand",
      summary: "Carry stamped forms between the Registry, market clerks, and the watch desk before the ink dries or someone important starts sighing.",
      reward: "Gold, civic job points, small working-stat gains",
      requirement: "Open to new citizens; Civic Fundamentals improves follow-up access",
      route: "/civic-jobs",
      risk: "low",
    },
    {
      id: "nexis-permit-runner",
      title: "Permit Runner Shift",
      type: "Permit work",
      summary: "Verify simple trade permits and deliver corrections to vendors trying very hard to call mistakes a tradition.",
      reward: "Gold, permit standing, market familiarity",
      requirement: "General Studies recommended",
      route: "/city-board",
      risk: "low",
    },
    {
      id: "nexis-watch-messenger",
      title: "Watch Messenger Route",
      type: "Messenger work",
      summary: "Run short notices between watch posts, court clerks, and civic dispatchers without losing the seal packet.",
      reward: "Gold, travel confidence, civic contacts",
      requirement: "No gear required; stamina required for active jobs",
      route: "/travel",
      risk: "moderate",
    },
  ],
  west: [
    {
      id: "blackharbor-cargo-tally",
      title: "Cargo Tally at Low Tide",
      type: "Dock contract",
      summary: "Count crates, check seals, and flag suspicious potion imports before the harbor accountants pretend everything matches.",
      reward: "Gold, chance at rations or tonic stock",
      requirement: "World Geography improves cargo-route reads",
      route: "/market",
      risk: "moderate",
    },
    {
      id: "blackharbor-escort-watch",
      title: "Pier Escort Watch",
      type: "Escort contract",
      summary: "Stand guard while brokers move foreign goods from dock to counting room through streets full of interested strangers.",
      reward: "Gold, travel encounter readiness, underdock contacts",
      requirement: "Battle stats help; Street Survival unlocks better reads",
      route: "/travel",
      risk: "high",
    },
    {
      id: "blackharbor-quiet-manifest",
      title: "Quiet Manifest Recovery",
      type: "Smuggling pressure",
      summary: "Recover a missing cargo slip without asking why everyone involved knows exactly which slip it is.",
      reward: "Gold, black-market pressure, rare import rumors",
      requirement: "Street Survival recommended; access is safest with World Geography",
      route: "/black-market",
      risk: "high",
    },
  ],
  north: [
    {
      id: "silverbough-herb-circle",
      title: "Herb Circle Supply Run",
      type: "Healing supply",
      summary: "Gather and sort field herbs for healers who can identify bad work from across a room.",
      reward: "Herbs, gold, healing-circle standing",
      requirement: "Beginner Adventurer friendly; herbal tools improve yield",
      route: "/adventure",
      risk: "low",
    },
    {
      id: "silverbough-relic-rubbing",
      title: "Relic Rubbing Intake",
      type: "Relic cataloguing",
      summary: "Deliver temple rubbings to conservatory archivists and keep them flat, dry, and unhelpfully mysterious.",
      reward: "Gold, relic notes, education hooks",
      requirement: "Historical Awareness unlocks deeper relic work",
      route: "/education",
      risk: "moderate",
    },
    {
      id: "silverbough-ward-lantern",
      title: "Ward Lantern Walk",
      type: "Ward patrol",
      summary: "Check lantern wards along the northern path and report which lights flicker like they know something.",
      reward: "Gold, ward familiarity, route discovery flavor",
      requirement: "World Geography required for advanced routes",
      route: "/travel",
      risk: "moderate",
    },
  ],
  east: [
    {
      id: "ironhall-ore-yard",
      title: "Ore Yard Haul",
      type: "Material haul",
      summary: "Move ore, coal, and rivets between yard scales and forge benches without inventing new workplace injuries.",
      reward: "Gold, material familiarity, ore stock leads",
      requirement: "Manual Labor helps; tools improve job access",
      route: "/market",
      risk: "moderate",
    },
    {
      id: "ironhall-forge-order",
      title: "Forge Order Rush",
      type: "Craft contract",
      summary: "Run order slips between smiths, armor fitters, and component lockers before the whole shop starts shouting in chorus.",
      reward: "Gold, working-stat pressure, forge contacts",
      requirement: "Practical Arithmetic unlocks better ledger work",
      route: "/civic-jobs",
      risk: "low",
    },
    {
      id: "ironhall-bridge-brace",
      title: "Bridge Brace Repair",
      type: "Repair crew",
      summary: "Help inspect road braces on the forge route where every loose bolt has ambitions.",
      reward: "Gold, route safety flavor, low-tier materials",
      requirement: "Endurance and Strength improve outcomes",
      route: "/travel",
      risk: "moderate",
    },
  ],
  south: [
    {
      id: "highcourt-seal-filing",
      title: "Seal Filing Queue",
      type: "Legal filing",
      summary: "File permit seals, log petition references, and learn why Highcourt considers patience a civic weapon.",
      reward: "Gold, permit standing, court familiarity",
      requirement: "Civic Fundamentals unlocks better filings",
      route: "/civic-jobs",
      risk: "low",
    },
    {
      id: "highcourt-archive-delivery",
      title: "Archive Delivery in Triplicate",
      type: "Archive delivery",
      summary: "Carry court archives between offices while ensuring every duplicate reaches exactly the clerk who already suspects you.",
      reward: "Gold, education hooks, reputation flavor",
      requirement: "General Studies recommended",
      route: "/education",
      risk: "low",
    },
    {
      id: "highcourt-diplomatic-escort",
      title: "Diplomatic Escort Note",
      type: "Prestige errand",
      summary: "Escort a minor envoy across the permit district, which is mostly walking slowly near expensive arguments.",
      reward: "Gold, diplomacy pressure, prestige-market leads",
      requirement: "Rhetoric or Civic Law will deepen this later",
      route: "/city-board",
      risk: "moderate",
    },
  ],
};

const CITY_ACADEMY_DETAILS: Record<WorldCityId, CityAcademyDetail> = {
  nexis: {
    theme: "Civic administration, watch procedure, public law, and city operations.",
    entryRequirements: ["Open to all citizens", "General Studies improves comprehension", "Civic Fundamentals unlocks deeper city work"],
    progressionSupports: ["Civic Jobs", "permits", "city board work", "organization administration"],
    lockReason: "Open in the starter capital.",
  },
  west: {
    theme: "Maritime routing, covert manifests, corsair law, and cargo-risk judgment.",
    entryRequirements: ["Complete World Geography", "Street Survival recommended", "Travel to Blackharbor"],
    progressionSupports: ["sea routes", "cargo contracts", "black-market reads", "consortium logistics"],
    lockReason: "Locked until World Geography teaches safe route reading.",
  },
  north: {
    theme: "Arcane field ethics, healing theory, ward literacy, and relic handling.",
    entryRequirements: ["Complete World Geography", "Historical Awareness recommended", "Travel to Silverbough"],
    progressionSupports: ["healing jobs", "relic contracts", "ward patrols", "discovery events"],
    lockReason: "Locked until northern travel literacy is established.",
  },
  east: {
    theme: "Forge discipline, war-school basics, enginewright ledgers, and material planning.",
    entryRequirements: ["Complete Practical Arithmetic", "Manual Labor helps", "Travel to Ironhall"],
    progressionSupports: ["forge contracts", "material markets", "repair work", "industrial consortium loops"],
    lockReason: "Locked until Practical Arithmetic supports safe material orders.",
  },
  south: {
    theme: "Rhetoric, civic law, statecraft, diplomacy, and prestige administration.",
    entryRequirements: ["Complete Civic Fundamentals", "General Studies recommended", "Travel to Highcourt"],
    progressionSupports: ["legal filings", "prestige markets", "permits", "diplomatic errands"],
    lockReason: "Locked until civic foundations are complete.",
  },
};

const CITY_BLACK_MARKET_DETAILS: Record<WorldCityId, CityBlackMarketDetail> = {
  nexis: {
    name: "Nexis Backroom Rumors",
    summary: "The capital has underworld pressure, but the player-facing route is intentionally gated behind shady education.",
    notices: [
      { title: "Unmarked stall whispers", detail: "Starter underworld leads remain locked until Street Survival paths open.", requirement: "Street Survival -> black market access" },
    ],
  },
  west: {
    name: "Blackharbor Underdock Brokers",
    summary: "Potion imports, sealed cargo, and quiet manifests make Blackharbor the first useful under-market surface.",
    notices: [
      { title: "Potion import lots", detail: "Brokers watch healing tonic and restorative cargo moving through legal stalls.", requirement: "Open in Blackharbor" },
      { title: "Quiet manifest recovery", detail: "Smuggling pressure can point players toward future covert contracts.", requirement: "Street Survival improves outcomes" },
      { title: "Foreign goods rumor board", detail: "Rare cargo leads hint at future escort and consortium jobs.", requirement: "World Geography improves reads" },
    ],
  },
  north: {
    name: "Sealed Relic Rumors",
    summary: "Silverbough suppresses illegal relic trade; contacts exist, but access is gated by discovery and academy sponsorship.",
    notices: [
      { title: "Relic sale refused", detail: "Open trade is blocked until route discovery and relic ethics are learned.", requirement: "World Geography -> Historical Awareness" },
    ],
  },
  east: {
    name: "Industrial Sabotage Whispers",
    summary: "Ironhall keeps illegal channels quiet; future covert work will focus on parts, plans, and sabotage pressure.",
    notices: [
      { title: "Locked parts ledger", detail: "Industrial covert jobs are not open until the player has the right education hooks.", requirement: "Practical Arithmetic + Street Survival later" },
    ],
  },
  south: {
    name: "Highcourt Quiet Influence",
    summary: "Highcourt's under-market is influence rather than alley trade, and it remains gated behind legal and intrigue literacy.",
    notices: [
      { title: "Permit favors unavailable", detail: "Covert court favors need civic law, rhetoric, and future intrigue systems.", requirement: "Civic Fundamentals -> statecraft routes" },
    ],
  },
};

function normalizeCityId(cityId: WorldCityId | string | null | undefined): WorldCityId {
  return cityId === "north" || cityId === "east" || cityId === "west" || cityId === "south" || cityId === "nexis"
    ? cityId
    : "nexis";
}

export function getCityLocalContracts(cityId: WorldCityId | string | null | undefined) {
  return CITY_LOCAL_CONTRACTS[normalizeCityId(cityId)];
}

export function getCityAcademyDetail(cityId: WorldCityId | string | null | undefined) {
  return CITY_ACADEMY_DETAILS[normalizeCityId(cityId)];
}

export function getCityBlackMarketDetail(cityId: WorldCityId | string | null | undefined) {
  return CITY_BLACK_MARKET_DETAILS[normalizeCityId(cityId)];
}
