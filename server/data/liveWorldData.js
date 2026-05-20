export const LIVE_WORLD_DAY_MS = 86400000;
export const SHADOW_RESOURCE = { id: "shadow", label: "Shadow", baseMax: 10, regenMs: 720000, starterCurrent: 6, description: "A dedicated covert resource for under-market, smuggling, theft, and shadow-route pressure." };
export const DAILY_STREAK_BEHAVIOR = "Grace period: one missed daily reset preserves the streak; missing two or more resets starts the streak again.";
export const CITY_DEMAND_PROFILES = {
  nexis: { tags: ["baseline", "civic", "starter", "general"], headline: "Baseline civic buyers want general supplies, paperwork stock, and starter gear.", shortages: ["sealed notices", "courier tools", "basic rations"] },
  west: { tags: ["imported", "contraband", "maritime", "potion"], headline: "Blackharbor pays attention to imports, maritime gear, covert tools, and potion cargo.", shortages: ["cargo seals", "import tonics", "quiet manifests"] },
  north: { tags: ["herbal", "arcane", "relic", "healing"], headline: "Silverbough buyers value herbs, reagents, ward stock, relic notes, and healer supplies.", shortages: ["ward salts", "medicinal herbs", "relic fragments"] },
  east: { tags: ["industrial", "forge", "materials", "tools"], headline: "Ironhall demand leans toward ore, coal, ingots, tools, braces, and machine components.", shortages: ["coal", "iron ore", "steel braces"] },
  south: { tags: ["legal", "prestige", "luxury", "permit"], headline: "Highcourt pays for legal stock, prestige goods, seals, writs, and diplomatic supplies.", shortages: ["wax seals", "court tokens", "prestige goods"] },
};
export const CITY_RHYTHMS = {
  nexis: [
    { id: "nexis_permit_surge", title: "Today in Nexis City", summary: "Permit counters report heavy filing traffic; civic runners are being waved through early.", tags: ["civic", "contracts"] },
    { id: "nexis_archive_index", title: "Archive Desk Notice", summary: "The registry has misfiled a batch of old route notes and wants literate hands near the stacks.", tags: ["archives", "education"] },
    { id: "nexis_watch_roster", title: "Watchhouse Roster", summary: "Ordered Steel instructors are pairing new watch recruits with low-risk patrol errands.", tags: ["watch", "arena"] },
  ],
  west: [
    { id: "west_tide_window", title: "New in Blackharbor", summary: "A fair tide window has brokers rushing import lots through the dock ledgers before dusk.", tags: ["maritime", "market"] },
    { id: "west_customs_pressure", title: "Customs Whisper", summary: "Dock inspectors are awake today. Under-market hands are choosing their doors carefully.", tags: ["shadow", "black_market"] },
    { id: "west_escort_call", title: "Escort Call", summary: "Cargo captains are hiring deck guards for short sea-lane pressure around the harbor mouth.", tags: ["combat", "contracts"] },
  ],
  north: [
    { id: "north_ward_flicker", title: "Ward Report in Silverbough", summary: "Outer ward lanterns flickered overnight; healers ask travelers to report strange lights.", tags: ["ward", "discovery"] },
    { id: "north_herb_commission", title: "Hospice Commission", summary: "The Verdant Hospice is buying common herbs at a steadier rate than usual.", tags: ["herbal", "market"] },
    { id: "north_relic_whisper", title: "Quiet Relic Note", summary: "Lyceum scribes logged a relic trace near a northern route marker and are watching for repeat sightings.", tags: ["relic", "codex"] },
  ],
  east: [
    { id: "east_foundry_queue", title: "Ironhall Foundry Bulletin", summary: "Foundry queues are long; spare coal, rivets, and bracework are moving quickly.", tags: ["forge", "market"] },
    { id: "east_machine_incident", title: "Workshop Incident", summary: "An engine bench threw sparks across a public lane. Repair hands and calm witnesses are wanted.", tags: ["event", "contracts"] },
    { id: "east_haul_shortage", title: "Haul Shortage", summary: "Material convoys are short on reliable guards and loaders along the forge road.", tags: ["travel", "materials"] },
  ],
  south: [
    { id: "south_petition_queue", title: "Highcourt Clerk Notice", summary: "Petition chambers are backed up; sealed notices and polite couriers have sudden value.", tags: ["legal", "market"] },
    { id: "south_envoy_arrivals", title: "Envoy Arrivals", summary: "Diplomatic parties entered the lower court today, lifting demand for refined introductions.", tags: ["prestige", "social"] },
    { id: "south_archive_writ", title: "Court Archive Writ", summary: "A sealed court outpost record is being cross-checked against modern travel permits.", tags: ["history", "codex"] },
  ],
};
export const CITY_THREAT_EVENTS = {
  nexis: [
    { id: "nexis_civic_disturbance", title: "Civic Disturbance", severity: "low", summary: "A permit-line argument drew watch attention; civic jobs may ask for extra runners.", affects: ["civic jobs", "contracts"] },
    { id: "nexis_raider_warnings", title: "Outer Road Raider Warnings", severity: "moderate", summary: "Watch scouts report light raider movement beyond the capital road lamps.", affects: ["travel", "bounties"] },
  ],
  west: [
    { id: "west_pirate_pressure", title: "Pirate Pressure", severity: "high", summary: "Corsair lookouts report predatory sails outside the harbor lanes.", affects: ["travel", "bounties", "imports"] },
    { id: "west_contraband_crackdown", title: "Contraband Crackdown", severity: "moderate", summary: "Customs raids are pushing underdock prices and Shadow costs upward.", affects: ["black market", "shadow"] },
  ],
  north: [
    { id: "north_ward_instability", title: "Ward Instability", severity: "moderate", summary: "Outer wards are unstable enough for relic traces and route warnings to matter.", affects: ["discovery", "healing"] },
    { id: "north_healing_demand", title: "Healing Demand", severity: "low", summary: "A minor fever scare has hospice buyers seeking clean herbs and field bandages.", affects: ["market", "contracts"] },
  ],
  east: [
    { id: "east_forge_incident", title: "Forge Incident", severity: "moderate", summary: "A foundry lift failed; repair contracts and material requisitions are posted early.", affects: ["forge", "contracts"] },
    { id: "east_tunnel_raiders", title: "Tunnel Raider Activity", severity: "high", summary: "Tunnel raiders are probing material convoys outside Ironhall.", affects: ["bounties", "travel"] },
  ],
  south: [
    { id: "south_legal_emergency", title: "Legal Emergency", severity: "moderate", summary: "The court needs sealed courier work after a petition chamber scheduling failure.", affects: ["legal", "contracts"] },
    { id: "south_champion_notice", title: "Court Champion Notice", severity: "high", summary: "An elite enforcer is accepting controlled challenges through formal channels.", affects: ["arena", "prestige"] },
  ],
};
export const WORLD_BOSS_EVENTS = {
  nexis: { id: "tunnel_raider_captain", name: "Tunnel Raider Captain", cityId: "nexis", status: "watchlisted", participationPath: "/arena", rewardLabel: "arena marks, gold, civic distinction", summary: "A raider captain is being tracked through controlled watch notices." },
  west: { id: "shadow_coast_corsair_chief", name: "Shadow Coast Corsair Chief", cityId: "west", status: "available", participationPath: "/arena", rewardLabel: "cargo seals, gold, corsair distinction", summary: "Blackharbor has posted a controlled spar bounty against a corsair chief proxy." },
  north: { id: "ward_broken_grove_guardian", name: "Ward-Broken Grove Guardian", cityId: "north", status: "rumored", participationPath: "/world-map", rewardLabel: "ward shards, relic notes, explorer badge", summary: "Ward-break reports point toward a guardian trace in the northern bough." },
  east: { id: "furnace_beast", name: "Furnace Beast", cityId: "east", status: "available", participationPath: "/arena", rewardLabel: "tempered steel, combat XP, forge distinction", summary: "Ironhall is staging a controlled furnace-beast drill around a sealed training rig." },
  south: { id: "court_champion_elite", name: "Court Champion Elite", cityId: "south", status: "petition", participationPath: "/arena", rewardLabel: "prestige goods, title progress, court badge", summary: "Highcourt's champion circle is accepting formal challengers with adequate manners." },
};
export const HIDDEN_SITE_DEFINITIONS = [
  { id: "central_ruined_watchtower", name: "Ruined Watchtower", family: "ruined watchtower", regionId: "central_crown", cityIds: ["nexis"], routeTags: ["central_road"], requiredCourses: ["world-geography"], summary: "A broken civic tower on an old watch route.", codexEntryId: "discovery-site-central_ruined_watchtower", boardTitle: "Old watchtower sighting filed" },
  { id: "north_shrine_grove", name: "Shrine Grove", family: "shrine grove", regionId: "northern_bough", cityIds: ["north"], routeTags: ["warded_woods", "northern_road"], requiredCourses: ["world-geography"], summary: "A quiet shrine ring hidden just off a warded path.", codexEntryId: "discovery-site-north_shrine_grove", boardTitle: "Shrine grove rumor reaches hospice desk" },
  { id: "west_smuggler_cache", name: "Smuggler Cache", family: "smuggler cache", regionId: "western_coast", cityIds: ["west"], routeTags: ["sea_lane", "smuggling_pressure"], requiredCourses: ["street-survival"], summary: "A tide-hidden cargo hollow used by very selective dock hands.", codexEntryId: "discovery-site-west_smuggler_cache", boardTitle: "Unmarked cache rumor circles the docks" },
  { id: "south_collapsed_archive", name: "Collapsed Archive", family: "collapsed archive", regionId: "southern_court", cityIds: ["south"], routeTags: ["court_road", "permit_checks"], requiredCourses: ["historical-awareness"], summary: "A court archive fragment buried under newer permit roads.", codexEntryId: "discovery-site-south_collapsed_archive", boardTitle: "Archive collapse note enters the public register" },
  { id: "east_forge_wreck", name: "Forge Wreck", family: "forge wreck", regionId: "eastern_forges", cityIds: ["east"], routeTags: ["forge_road", "material_convoys"], requiredCourses: ["world-geography"], summary: "A failed convoy rig and half-buried forge cart off the industrial road.", codexEntryId: "discovery-site-east_forge_wreck", boardTitle: "Forge wreck location traded at the yard" },
  { id: "central_battlefield_remnant", name: "Battlefield Remnant", family: "battlefield remnant", regionId: "central_crown", cityIds: ["nexis", "east"], routeTags: ["raider_pressure", "forge_road"], requiredCourses: ["historical-awareness"], summary: "Old banners and broken tokens mark a forgotten road fight.", codexEntryId: "discovery-site-central_battlefield_remnant", boardTitle: "Battlefield remnant sparks archive interest" },
  { id: "south_sealed_court_outpost", name: "Sealed Court Outpost", family: "sealed court outpost", regionId: "southern_court", cityIds: ["south"], routeTags: ["legal_cargo_lane", "permit_caravans"], requiredCourses: ["civic-fundamentals"], summary: "A sealed outpost whose locks care deeply about proper writs.", codexEntryId: "discovery-site-south_sealed_court_outpost", boardTitle: "Sealed outpost filing opens quietly" },
  { id: "west_abandoned_caravan_depot", name: "Abandoned Caravan Depot", family: "abandoned caravan depot", regionId: "western_coast", cityIds: ["west", "nexis"], routeTags: ["sea_lane", "cargo"], requiredCourses: ["world-geography"], summary: "An unused depot where cargo tallies and road dust still linger.", codexEntryId: "discovery-site-west_abandoned_caravan_depot", boardTitle: "Abandoned depot rumor makes the classifieds" },
  { id: "north_arcane_survey_point", name: "Arcane Survey Point", family: "arcane survey point", regionId: "northern_bough", cityIds: ["north"], routeTags: ["relic_material_trade", "warded_woods"], requiredCourses: ["historical-awareness"], summary: "A measured ley point where the old survey pins still hum.", codexEntryId: "discovery-site-north_arcane_survey_point", boardTitle: "Survey point hum noted by Lyceum scribes" },
];
export const DISCOVERY_EVENT_POOL = [
  { id: "ruin_marker", family: "ruins", rarity: "uncommon", tags: ["ruin", "history"], requiredCourses: ["historical-awareness"], siteIds: ["central_ruined_watchtower", "south_collapsed_archive"], rewards: [{ itemId: "relic_note", quantity: 1 }], summary: "A ruin marker matches a partial archive note." },
  { id: "shrine_petition_trace", family: "shrines", rarity: "common", tags: ["shrine", "healing"], requiredCourses: ["world-geography"], siteIds: ["north_shrine_grove"], rewards: [{ itemId: "shrine_token", quantity: 1 }], summary: "A shrine path marker points toward a quiet grove." },
  { id: "road_cache", family: "caches", rarity: "common", tags: ["cache", "travel"], requiredCourses: ["world-geography"], siteIds: ["west_abandoned_caravan_depot"], rewards: [{ itemId: "rations", quantity: 1 }], summary: "A practical roadside cache contains usable supplies and a route note." },
  { id: "wreck_spark", family: "wrecks", rarity: "common", tags: ["forge", "wreck"], requiredCourses: ["world-geography"], siteIds: ["east_forge_wreck"], rewards: [{ itemId: "iron_rivets", quantity: 1 }], summary: "A forge-road wreck yields salvageable fittings." },
  { id: "hidden_path_marker", family: "hidden paths", rarity: "common", tags: ["route", "shortcut"], requiredCourses: ["world-geography"], siteIds: ["central_ruined_watchtower", "north_shrine_grove"], rewards: [], summary: "A hidden path marker clarifies a safer route angle." },
  { id: "rumor_find", family: "rumor finds", rarity: "common", tags: ["rumor"], requiredCourses: [], siteIds: ["west_smuggler_cache", "south_sealed_court_outpost"], rewards: [], summary: "A rumor sounds useful enough to write down before it gets expensive." },
  { id: "patrol_checkpoint", family: "patrol checkpoints", rarity: "common", tags: ["patrol", "civic"], requiredCourses: ["civic-fundamentals"], siteIds: ["south_sealed_court_outpost"], rewards: [{ itemId: "sealed_notice", quantity: 1 }], summary: "A patrol checkpoint log points to a sealed civic route." },
  { id: "suspicious_caravan", family: "suspicious caravans", rarity: "uncommon", tags: ["shadow", "smuggling"], requiredCourses: ["street-survival"], siteIds: ["west_smuggler_cache"], rewards: [{ itemId: "stolen_coin", quantity: 1 }], summary: "A suspicious caravan leaves a trail only street-trained eyes should follow." },
  { id: "old_battlefield", family: "old battlefields", rarity: "uncommon", tags: ["battlefield", "history"], requiredCourses: ["historical-awareness"], siteIds: ["central_battlefield_remnant"], rewards: [{ itemId: "raider_token", quantity: 1 }], summary: "An old battlefield remnant explains a modern road warning." },
  { id: "relic_trace", family: "relic traces", rarity: "rare", tags: ["relic", "arcane"], requiredCourses: ["historical-awareness"], siteIds: ["north_arcane_survey_point"], rewards: [{ itemId: "ward_shard", quantity: 1 }], summary: "A relic trace hums under the road dust." },
  { id: "strange_weather", family: "strange weather", rarity: "uncommon", tags: ["omen", "weather"], requiredCourses: ["applied-knowledge"], siteIds: ["north_arcane_survey_point", "east_forge_wreck"], rewards: [], summary: "Weather bends strangely around an old survey line." },
  { id: "institutional_survey", family: "institutional survey notes", rarity: "common", tags: ["survey", "academy"], requiredCourses: ["applied-knowledge"], siteIds: ["north_arcane_survey_point", "south_collapsed_archive"], rewards: [{ itemId: "ledger_page", quantity: 1 }], summary: "An institutional survey note can be filed for later contract leads." },
  { id: "smuggler_trace", family: "smuggler traces", rarity: "uncommon", tags: ["smuggling", "shadow"], requiredCourses: ["street-survival"], siteIds: ["west_smuggler_cache"], rewards: [{ itemId: "foreign_token", quantity: 1 }], summary: "Smuggler traces point away from the official dock records." },
  { id: "ward_disturbance", family: "ward disturbances", rarity: "uncommon", tags: ["ward", "arcane"], requiredCourses: ["historical-awareness"], siteIds: ["north_shrine_grove", "north_arcane_survey_point"], rewards: [{ itemId: "arcane_ink", quantity: 1 }], summary: "A ward disturbance leaves enough pattern to enter the Codex." },
  { id: "abandoned_camp", family: "abandoned camps", rarity: "common", tags: ["camp", "survival"], requiredCourses: ["field-survival"], siteIds: ["west_abandoned_caravan_depot", "central_ruined_watchtower"], rewards: [{ itemId: "field_bandage", quantity: 1 }], summary: "An abandoned camp has supplies, footprints, and one very bad kettle." },
];
export const PRESTIGE_TITLE_DEFINITIONS = [
  { id: "citizen", label: "Citizen", source: "registry", summary: "Registered citizen of Nexis." },
  { id: "lettered-citizen", label: "Lettered Citizen", source: "education", summary: "Completed Basic Literacy." },
  { id: "ledger-hand", label: "Ledger Hand", source: "education", summary: "Completed Practical Arithmetic." },
  { id: "wayfinder", label: "Wayfinder", source: "education", summary: "Completed World Geography." },
  { id: "streetwise", label: "Streetwise", source: "shadow", summary: "Completed Street Survival." },
  { id: "field-scholar", label: "Field Scholar", source: "history", summary: "Completed Historical Awareness." },
  { id: "academy-graduate", label: "Academy Graduate", source: "academy", summary: "Completed at least one city academy." },
  { id: "city-fixture", label: "City Fixture", source: "standing", summary: "Reached City Fixture standing in a city." },
  { id: "route-finder", label: "Route Finder", source: "discovery", summary: "Found multiple hidden site leads." },
  { id: "duelist", label: "Duelist", source: "arena", summary: "Recorded duel activity." },
  { id: "under-market-hand", label: "Under-Market Hand", source: "shadow", summary: "Used Shadow for covert city work." },
];
export const PRESTIGE_BADGE_DEFINITIONS = [
  { id: "education-mark", label: "Education Mark", kind: "education", summary: "Has completed formal education milestones." },
  { id: "academy-mark", label: "Academy Mark", kind: "academy", summary: "Has progressed through city academy study." },
  { id: "explorer-mark", label: "Explorer Mark", kind: "discovery", summary: "Has discovered hidden sites or route notes." },
  { id: "standing-mark", label: "City Standing Mark", kind: "city", summary: "Has earned notable local standing." },
  { id: "event-mark", label: "Event Participant", kind: "event", summary: "Has responded to city or world event notices." },
  { id: "shadow-mark", label: "Shadow Mark", kind: "shadow", summary: "Has taken part in covert under-market actions." },
];
