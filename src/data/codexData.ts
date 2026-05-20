import { academyDefinitions } from "./academyData";
import { getCityHubContent } from "./cityHubData";
import { getCityAcademyDetail } from "./cityLoopData";
import { educationCategories } from "./educationData";
import { worldCities, worldRegions, worldRoutes, worldRumorLinks, macroRegions, regionNodes, type WorldCityId, type WorldRoute, type WorldRumorLink } from "./worldMapData";

export type CodexSectionId = "atlas" | "archives" | "discoveries" | "records" | "manuals" | "bestiary";

export type CodexEntry = {
  id: string;
  section: CodexSectionId;
  title: string;
  kicker: string;
  summary: string;
  status?: "discovered" | "rumored" | "locked" | "unknown" | "open";
  tags: string[];
  body: string[];
  related?: Array<{ label: string; to: string }>;
};

export const codexSections: Array<{ id: CodexSectionId; label: string; summary: string }> = [
  { id: "atlas", label: "Atlas", summary: "Cities, regions, hidden sites, routes, and macro geography." },
  { id: "archives", label: "Archives", summary: "Institutions, academies, civic bodies, and historical records." },
  { id: "discoveries", label: "Discoveries", summary: "Rumors, travel findings, route notes, and field reports." },
  { id: "records", label: "Records", summary: "Civic ledgers, city papers, contracts, and public registry notes." },
  { id: "manuals", label: "Manuals", summary: "Education, skills, crafting, trade, combat, and systems references." },
  { id: "bestiary", label: "Bestiary", summary: "Known threat families, arena opponents, and encounter notes." },
];

function sentence(value: string, fallback = "No archive note recorded.") {
  const trimmed = String(value || "").trim();
  if (!trimmed) return fallback;
  const [first] = trimmed.split(/(?<=[.!?])\s+/);
  return first || trimmed;
}

export function getCodexEntryRoute(entryId: string) {
  return `/codex?entry=${encodeURIComponent(entryId)}`;
}

export function getCodexEntryIdForCity(cityId: WorldCityId | string | null | undefined) {
  return `atlas-city-${cityId || "nexis"}`;
}

export function getCodexEntryIdForRegion(regionId: string | null | undefined) {
  return `atlas-region-${regionId || "unknown"}`;
}

export function getCodexEntryIdForLegacyAcademy(academyId: string | null | undefined) {
  return `archive-academy-${academyId || "index"}`;
}

const cityEntries: CodexEntry[] = worldCities.map((city) => {
  const hub = getCityHubContent(city.id);
  const academy = getCityAcademyDetail(city.id);
  return {
    id: getCodexEntryIdForCity(city.id),
    section: "atlas",
    title: city.name,
    kicker: city.subtitle,
    summary: sentence(city.summary),
    status: "discovered",
    tags: ["City", hub.identity, city.accessRule, city.travelFeel],
    body: [
      city.summary,
      hub.overview,
      hub.localIdentity,
      `Market identity: ${hub.market.summary} Imports include ${hub.market.imports.join(", ")}; exports include ${hub.market.exports.join(", ")}.`,
      `Academy presence: ${academy.theme} Entry requirements: ${academy.entryRequirements.join("; ")}.`,
      `Property and local services: ${hub.propertyFlavor}`,
      ...city.notes,
    ],
    related: [
      { label: "Open City", to: "/city" },
      { label: "Travel Routes", to: "/travel" },
      { label: "City Board", to: "/city-board" },
    ],
  };
});

const regionEntries: CodexEntry[] = worldRegions.map((region) => ({
  id: getCodexEntryIdForRegion(region.id),
  section: "atlas",
  title: region.name,
  kicker: `${region.kind} region`,
  summary: sentence(region.summary),
  status: region.status === "fully_wired" || region.status === "preserved_core" ? "discovered" : region.status === "rumored" ? "rumored" : "locked",
  tags: ["Region", region.kind, region.status, ...region.travelModes.map((mode) => `${mode} route`)],
  body: [
    region.summary,
    `Travel modes: ${region.travelModes.join(", ")}. Faction identities: ${region.factionIdentity.join(", ") || "none recorded"}.`,
    ...region.notes,
  ],
  related: [{ label: "Atlas Overview", to: "/world-map" }, { label: "Travel", to: "/travel" }],
}));

const macroRegionEntries: CodexEntry[] = macroRegions.map((region) => ({
  id: getCodexEntryIdForRegion(region.id),
  section: "atlas",
  title: region.name,
  kicker: region.role,
  summary: sentence(region.identity),
  status: region.status === "charted_locked" ? "locked" : "rumored",
  tags: ["Macro Region", region.status, ...region.resources.slice(0, 3)],
  body: [
    region.identity,
    `Resources: ${region.resources.join(", ")}.`,
    `Factions: ${region.factions.join(", ")}.`,
    `Academy concepts: ${region.academyConcepts.join(", ")}.`,
    `Integration tags: ${region.integrationTags.join(", ")}.`,
  ],
  related: [{ label: "Atlas Overview", to: "/world-map" }],
}));

function routeTitle(route: WorldRoute | WorldRumorLink) {
  return "travelLabel" in route ? route.travelLabel : route.label;
}

const routeEntries: CodexEntry[] = [...worldRoutes, ...worldRumorLinks].map((route) => ({
  id: `discovery-route-${route.id}`,
  section: "discoveries",
  title: routeTitle(route),
  kicker: `${route.type} route`,
  summary: sentence("summary" in route ? route.summary : route.rule),
  status: "status" in route && route.status === "fully_wired" ? "discovered" : "rumored",
  tags: ["Route", route.type, "status" in route ? route.status : "open"],
  body: [
    "summary" in route ? route.summary : route.rule,
    "requirements" in route && route.requirements?.length ? `Requirements: ${route.requirements.map((item) => item.label).join(", ")}.` : "No additional route requirement recorded.",
    "discovery" in route && route.discovery ? `Discovery: ${route.discovery.state}. ${route.discovery.unlockHint}` : "No discovery note recorded yet.",
  ],
  related: [{ label: "Travel", to: "/travel" }, { label: "World Map", to: "/world-map" }],
}));

const hiddenSiteEntries: CodexEntry[] = regionNodes.map((node) => ({
  id: `discovery-site-${node.id}`,
  section: "discoveries",
  title: node.name,
  kicker: node.role,
  summary: sentence(node.discoveryHooks[0] ?? node.role),
  status: node.visibility === "visible" ? "discovered" : node.visibility === "rumored" ? "rumored" : node.visibility === "locked" ? "locked" : "unknown",
  tags: ["Strategic Site", node.visibility, ...node.resources.slice(0, 3)],
  body: [
    node.role,
    `Resources: ${node.resources.join(", ") || "none recorded"}.`,
    `Factions: ${node.factions.join(", ") || "none recorded"}.`,
    `Mission types: ${node.missionTypes.join(", ") || "none recorded"}.`,
    ...node.discoveryHooks,
  ],
  related: [{ label: "World Map", to: "/world-map" }],
}));


const expandedHiddenSiteEntries: CodexEntry[] = [
  {
    id: "discovery-site-central_ruined_watchtower",
    section: "discoveries",
    title: "Ruined Watchtower",
    kicker: "Hidden route site",
    summary: "Old civic towers can become rumor markers, travel warnings, and small expedition hooks.",
    status: "rumored",
    tags: ["Hidden Site", "Watch", "Routes"],
    body: ["Watchtowers on the old civic roads were built for signal crews, tax riders, and border patrols. A discovered tower can expose safer route notes, bounties, and salvageable civic gear.", "World Geography improves route interpretation; Historical Awareness improves tower records and older military context."],
    related: [{ label: "World Map", to: "/world-map" }, { label: "Travel", to: "/travel" }],
  },
  {
    id: "discovery-site-north_shrine_grove",
    section: "discoveries",
    title: "Shrine Grove",
    kicker: "Silverbough-aligned field site",
    summary: "Shrine groves feed ward notices, healing commissions, and quiet relic rumors.",
    status: "rumored",
    tags: ["Hidden Site", "Shrine", "Wards"],
    body: ["A grove discovery may unlock board notices for shrine supplies, ward disturbances, or healing errands. Silverbough academies read these reports more seriously than the average clerk, which is rude but efficient.", "Historical Awareness and Applied Knowledge improve interpretation of shrine marks and relic-adjacent traces."],
    related: [{ label: "City Board", to: "/city-board" }, { label: "Codex Atlas", to: "/codex" }],
  },
  {
    id: "discovery-site-west_smuggler_cache",
    section: "discoveries",
    title: "Smuggler Cache",
    kicker: "Covert supply marker",
    summary: "Caches can reveal under-market leads, Shadow play, and Blackharbor-flavored opportunities.",
    status: "rumored",
    tags: ["Hidden Site", "Shadow", "Contraband"],
    body: ["Smuggler caches are not polite supply depots. They can create underworld notices, special board whispers, or covert contract leads when Street Survival and Shadow play are available.", "Street Survival improves cache handling. Shadow is spent on live under-market actions and recovers over time."],
    related: [{ label: "Black Market", to: "/black-market" }, { label: "City Board", to: "/city-board" }],
  },
  {
    id: "discovery-site-south_collapsed_archive",
    section: "archives",
    title: "Collapsed Archive",
    kicker: "Lost institutional record",
    summary: "Archive sites feed civic records, relic clues, and historical discovery bonuses.",
    status: "rumored",
    tags: ["Hidden Site", "Archive", "History"],
    body: ["Collapsed archives are the sort of place where a practical citizen finds sealed ledgers, broken catalogues, and the occasional legal problem with dust on it.", "Historical Awareness improves lore outcomes; Civic Fundamentals can turn archive finds into lawful city-board work."],
    related: [{ label: "Education", to: "/education" }, { label: "World Map", to: "/world-map" }],
  },
  {
    id: "discovery-site-east_forge_wreck",
    section: "discoveries",
    title: "Forge Wreck",
    kicker: "Industrial ruin",
    summary: "Forge wrecks support material shortages, salvage notices, and Ironhall contract hooks.",
    status: "rumored",
    tags: ["Hidden Site", "Forge", "Materials"],
    body: ["A forge wreck can seed material leads, repair contracts, and city demand notices. Ironhall will pretend this is normal industrial paperwork, which is exactly how you know it is important.", "Applied Knowledge and Craftsmanship tracks improve practical interpretation of machinery and salvage."],
    related: [{ label: "Crafting", to: "/crafting" }, { label: "Market", to: "/market" }],
  },
  {
    id: "discovery-site-central_battlefield_remnant",
    section: "discoveries",
    title: "Battlefield Remnant",
    kicker: "Old violence, new work",
    summary: "Battlefield remnants can create bounty leads, arena flavor, and combat material drops.",
    status: "rumored",
    tags: ["Hidden Site", "Combat", "Bounties"],
    body: ["Old battlefields rarely stay quiet. They feed bounty rumors, weapon salvage, and the occasional warning that someone should have filed years ago.", "Combat Training and Historical Awareness help separate useful evidence from dramatic mud."],
    related: [{ label: "Arena", to: "/arena" }, { label: "City Board", to: "/city-board" }],
  },
  {
    id: "discovery-site-south_sealed_court_outpost",
    section: "archives",
    title: "Sealed Court Outpost",
    kicker: "Highcourt legal remnant",
    summary: "Sealed court sites support writs, legal errands, and prestige discoveries.",
    status: "rumored",
    tags: ["Hidden Site", "Law", "Prestige"],
    body: ["Court outposts preserve seals, writ cases, and civic authority in the most inconvenient places possible. Discoveries here can unlock legal notices and prestige-flavored opportunities.", "Civic Fundamentals and Law & Governance tracks improve how much of the paperwork survives you."],
    related: [{ label: "Highcourt Board", to: "/city-board" }, { label: "Profile", to: "/profile" }],
  },
  {
    id: "discovery-site-west_abandoned_caravan_depot",
    section: "discoveries",
    title: "Abandoned Caravan Depot",
    kicker: "Travel logistics site",
    summary: "Depot finds support cargo warnings, route notices, and marketplace supply hints.",
    status: "rumored",
    tags: ["Hidden Site", "Travel", "Cargo"],
    body: ["Caravan depots link travel, contracts, cargo, and economy loops. A good find can reveal where goods are wanted before the market says it loudly.", "World Geography improves route quality; Practical Arithmetic helps convert the clue into profit."],
    related: [{ label: "Travel", to: "/travel" }, { label: "Market", to: "/market" }],
  },
  {
    id: "discovery-site-north_arcane_survey_point",
    section: "discoveries",
    title: "Arcane Survey Point",
    kicker: "Mapped anomaly",
    summary: "Survey points feed arcane discoveries, ward failures, and academy-relevant notes.",
    status: "rumored",
    tags: ["Hidden Site", "Arcane", "Academy"],
    body: ["Survey points are where arcane measurements became official enough to be alarming. They can unlock ward notices, Codex records, and academy-adjacent hooks.", "Arcane Studies and Historical Awareness improve the quality of survey interpretation."],
    related: [{ label: "Academies", to: "/academies" }, { label: "World Map", to: "/world-map" }],
  },
];

const academyEntries: CodexEntry[] = academyDefinitions.map((academy) => ({
  id: getCodexEntryIdForLegacyAcademy(academy.id),
  section: "archives",
  title: academy.name,
  kicker: academy.roleIdentity,
  summary: sentence(academy.description),
  status: "open",
  tags: ["Academy", academy.region, academy.academyType, `${academy.totalRanks} ranks`],
  body: [
    academy.description,
    `Location: ${academy.locationName}. Theme: ${academy.theme}.`,
    `Activation rules: ${academy.activationRules.join(" ")}`,
    `Rank ladder: ${academy.ranks.map((rank) => `Rank ${rank.rank} - ${rank.title}`).join("; ")}.`,
  ],
  related: [{ label: "Academies", to: "/academies" }, { label: "Education", to: "/education" }],
}));

const manualEntries: CodexEntry[] = [
  {
    id: "manual-education",
    section: "manuals",
    title: "Education Manual",
    kicker: "Account progression spine",
    summary: "Education is broad account learning; Academy Study is separate city-bound specialization.",
    status: "open",
    tags: ["Education", "Hard gates", "Timed study"],
    body: [
      "Education courses run on the server and may progress at the same time as one active Academy Study.",
      `Categories currently wired: ${educationCategories.map((category) => category.name).join(", ")}.`,
      "Important gates include Practical Arithmetic for commerce, World Geography for travel discovery, Civic Fundamentals for civic systems, Street Survival for shadow routes, and Historical Awareness for relic/ruin interpretation.",
    ],
    related: [{ label: "Education", to: "/education" }],
  },
  {
    id: "manual-skills",
    section: "manuals",
    title: "Skills Manual",
    kicker: "Practice, mastery, evolution",
    summary: "Skills are purchased or unlocked, learned over time, then mastered by valid use.",
    status: "open",
    tags: ["Skills", "Mastery", "Combat"],
    body: [
      "Valid uses come from real gameplay contexts such as combat, travel encounters, duels, arena fights, and resolved contract actions.",
      "Mastery tiers are based on cumulative total activations. Evolution forms do not reset mastery count.",
      "Education and academies can unlock access to specific families, variants, and practice paths.",
    ],
    related: [{ label: "Skills", to: "/skills" }, { label: "Arena", to: "/arena" }],
  },
  {
    id: "manual-crafting",
    section: "manuals",
    title: "Crafting Manual",
    kicker: "Recipes, salvage, repair",
    summary: "Crafting is city-bound and recipe-gated; materials loop through salvage, markets, and contracts.",
    status: "open",
    tags: ["Crafting", "Items", "Markets"],
    body: [
      "Recipes can depend on city availability, academy unlocks, education requirements, city standing, and carried materials.",
      "Salvage and repair keep equipment and materials cycling instead of turning inventory into a museum basement.",
      "City benches matter: Blackharbor leans maritime, Silverbough leans alchemy and wards, Ironhall leans smithing, Highcourt leans legal prestige, and Nexis City keeps starter utility work accessible.",
    ],
    related: [{ label: "Crafting", to: "/crafting" }, { label: "Inventory", to: "/inventory" }, { label: "Market", to: "/market" }],
  },

  {
    id: "manual-shadow",
    section: "manuals",
    title: "Shadow Manual",
    kicker: "Covert resource",
    summary: "Shadow is the separate resource for under-market and covert play.",
    status: "open",
    tags: ["Shadow", "Street Survival", "Black Market"],
    body: [
      "Shadow recovers over time and is spent on under-market buying, fencing, smuggling leads, and future covert actions.",
      "Street Survival improves Shadow capacity and reveals safer routes through shady systems. Blackharbor remains the strongest under-market city, but not the only place where whispers matter.",
    ],
    related: [{ label: "Black Market", to: "/black-market" }, { label: "Skills", to: "/skills" }],
  },
  {
    id: "manual-marketplace",
    section: "manuals",
    title: "Marketplace Manual",
    kicker: "Citizen listings",
    summary: "The marketplace supports fixed-price listings for eligible carried items.",
    status: "open",
    tags: ["Marketplace", "Trade", "City Demand"],
    body: [
      "Players can post fixed-price listings, browse active lots, buy from other citizens, and cancel their own listings.",
      "City demand, crafting outputs, contract materials, and travel discoveries are designed to point toward goods worth moving or listing.",
    ],
    related: [{ label: "Market", to: "/market" }, { label: "Crafting", to: "/crafting" }],
  },
  {
    id: "manual-city-contracts",
    section: "manuals",
    title: "City Contract Manual",
    kicker: "Local work and standing",
    summary: "City contracts feed gold, items, experience, and local standing.",
    status: "open",
    tags: ["Contracts", "City Standing", "Civic Board"],
    body: [
      "Contracts are bound to local city identity and can require presence, travel-and-return, combat checks, or education gates.",
      "City standing unlocks better boards, services, city specials, academy stages, and market options.",
      "The City page handles local contract action. The City Board prints the public-facing civic notice version.",
    ],
    related: [{ label: "City", to: "/city#contracts" }, { label: "City Board", to: "/city-board" }],
  },
];

const recordEntries: CodexEntry[] = [
  {
    id: "record-city-board",
    section: "records",
    title: "City Board Record",
    kicker: "Public notices and civic paper",
    summary: "The City Board is a newspaper-style civic bulletin, not a contract admin screen.",
    status: "open",
    tags: ["City Board", "Newspaper", "Civic"],
    body: [
      "Front Page entries highlight the lead local posting. Civic Appointments, Opportunities, Bounties, Public Notices, and Classifieds each own one editorial lane.",
      "Entries should not duplicate across sections. The same system may be referenced in multiple ways only when it prints distinct public notices.",
    ],
    related: [{ label: "City Board", to: "/city-board" }],
  },
  {
    id: "record-presence",
    section: "records",
    title: "City Presence Record",
    kicker: "Controlled public occupancy",
    summary: "City People lists show controlled public presence, not private account data.",
    status: "open",
    tags: ["People", "Presence", "Privacy"],
    body: [
      "City occupancy supports future social, job, guild, consortium, duel, and event logic.",
      "Public lists should stay compact, paginated, and filtered. Obvious staff/test/canary noise should not dominate normal player-facing lists.",
    ],
    related: [{ label: "City People", to: "/city#people" }],
  },
];

const bestiaryEntries: CodexEntry[] = [
  {
    id: "bestiary-field-threats",
    section: "bestiary",
    title: "Field Threat Families",
    kicker: "Encounter index",
    summary: "Known combat threats are grouped by role until individual enemy dossiers earn their own records.",
    status: "rumored",
    tags: ["Bandits", "Corsairs", "Beasts", "Relic guardians", "Arena"],
    body: [
      "Bandits and raiders pressure road travel and low-tier contracts. Pirates and corsairs concentrate around Blackharbor routes. Beasts and wild threats emerge during field travel. Relic guardians belong to ruin and relic discovery chains. City enforcers and sparring opponents live mainly in arena or controlled civic contexts.",
      "The Bestiary is intentionally compact for now: combat lives on Arena, Travel, contracts, and duels; long threat notes live here as they become meaningful.",
    ],
    related: [{ label: "Arena", to: "/arena" }, { label: "Travel", to: "/travel" }],
  },
];

export const codexEntries: CodexEntry[] = [
  ...cityEntries,
  ...regionEntries,
  ...macroRegionEntries,
  ...routeEntries,
  ...hiddenSiteEntries,
  ...expandedHiddenSiteEntries,
  ...academyEntries,
  ...manualEntries,
  ...recordEntries,
  ...bestiaryEntries,
];

export function getCodexEntry(entryId: string | null | undefined) {
  if (!entryId) return codexEntries[0];
  return codexEntries.find((entry) => entry.id === entryId) ?? codexEntries[0];
}

export function getCodexEntriesBySection(sectionId: CodexSectionId) {
  return codexEntries.filter((entry) => entry.section === sectionId);
}
