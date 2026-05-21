export const LEGACY_ACHIEVEMENT_CATEGORIES = [
  "Attacking / Combat",
  "Weapons",
  "Education",
  "Travel",
  "Exploration / Discoveries",
  "Economy / Market",
  "Items / Crafting",
  "Guild / Consortium",
  "Contracts / Quests / Adventures",
  "Commitment / Time",
  "Miscellaneous"
];

export const LEGACY_ACHIEVEMENT_KINDS = ["honor", "medal"];

export const LEGACY_ACHIEVEMENTS = [
  {
    "id": "acct-001",
    "kind": "honor",
    "category": "Commitment / Time",
    "name": "First Footing",
    "description": "Register a Nexis citizen profile.",
    "metric": "account_registered",
    "target": 1,
    "rewardPoints": 1,
    "chronicleTitle": "First Footing",
    "chronicleSummary": "Joined Nexis and created a permanent citizen record."
  },
  {
    "id": "time-001",
    "kind": "medal",
    "category": "Commitment / Time",
    "name": "Seven Day Citizen",
    "description": "Keep a Nexis account for seven days.",
    "metric": "days_played",
    "target": 7,
    "rewardPoints": 1,
    "chronicleTitle": "Seven Day Citizen",
    "chronicleSummary": "Kept a citizen record active for seven days."
  },
  {
    "id": "time-002",
    "kind": "medal",
    "category": "Commitment / Time",
    "name": "Thirty Day Citizen",
    "description": "Keep a Nexis account for thirty days.",
    "metric": "days_played",
    "target": 30,
    "rewardPoints": 1,
    "chronicleTitle": "Thirty Day Citizen",
    "chronicleSummary": "Stayed in the city ledgers long enough to become a familiar name."
  },
  {
    "id": "edu-001",
    "kind": "honor",
    "category": "Education",
    "name": "First Lesson",
    "description": "Start an education course.",
    "metric": "education_started",
    "target": 1,
    "rewardPoints": 1,
    "chronicleTitle": "First Lesson",
    "chronicleSummary": "Began formal study in the Nexis education system."
  },
  {
    "id": "edu-002",
    "kind": "honor",
    "category": "Education",
    "name": "Course Complete",
    "description": "Complete one education course.",
    "metric": "education_completed",
    "target": 1,
    "rewardPoints": 1,
    "chronicleTitle": "Course Complete",
    "chronicleSummary": "Completed a course and added its rewards to the record."
  },
  {
    "id": "edu-003",
    "kind": "medal",
    "category": "Education",
    "name": "Foundation Scholar",
    "description": "Complete five education courses.",
    "metric": "education_completed",
    "target": 5,
    "rewardPoints": 1,
    "chronicleTitle": "Foundation Scholar",
    "chronicleSummary": "Built a sturdy foundation of practical study."
  },
  {
    "id": "edu-004",
    "kind": "medal",
    "category": "Education",
    "name": "Faculty Regular",
    "description": "Complete fifteen education courses.",
    "metric": "education_completed",
    "target": 15,
    "rewardPoints": 1,
    "chronicleTitle": "Faculty Regular",
    "chronicleSummary": "Turned scattered lessons into a real education history."
  },
  {
    "id": "trv-001",
    "kind": "honor",
    "category": "Travel",
    "name": "Road Dust",
    "description": "Begin travel to another city.",
    "metric": "travel_started",
    "target": 1,
    "rewardPoints": 1,
    "chronicleTitle": "Road Dust",
    "chronicleSummary": "Stepped beyond the starting city and into the wider map."
  },
  {
    "id": "trv-002",
    "kind": "medal",
    "category": "Travel",
    "name": "Route Regular",
    "description": "Resolve ten journeys or travel arrivals.",
    "metric": "travel_resolved",
    "target": 10,
    "rewardPoints": 1,
    "chronicleTitle": "Route Regular",
    "chronicleSummary": "Made repeated movement part of the permanent record."
  },
  {
    "id": "exp-001",
    "kind": "honor",
    "category": "Exploration / Discoveries",
    "name": "Marked the Map",
    "description": "Record one travel discovery or hidden-site lead.",
    "metric": "discoveries_found",
    "target": 1,
    "rewardPoints": 1,
    "chronicleTitle": "Marked the Map",
    "chronicleSummary": "Added a discovery note to the personal atlas."
  },
  {
    "id": "exp-002",
    "kind": "medal",
    "category": "Exploration / Discoveries",
    "name": "Hidden Site Finder",
    "description": "Discover or explore three hidden sites.",
    "metric": "hidden_sites_found",
    "target": 3,
    "rewardPoints": 1,
    "chronicleTitle": "Hidden Site Finder",
    "chronicleSummary": "Turned rumors into places that can be named."
  },
  {
    "id": "eco-001",
    "kind": "honor",
    "category": "Economy / Market",
    "name": "Purse Keeper",
    "description": "Hold at least 1,000 gold.",
    "metric": "gold_held",
    "target": 1000,
    "rewardPoints": 1,
    "chronicleTitle": "Purse Keeper",
    "chronicleSummary": "Put together a first respectable purse of gold."
  },
  {
    "id": "eco-002",
    "kind": "honor",
    "category": "Economy / Market",
    "name": "Market Caller",
    "description": "Create one player-market listing.",
    "metric": "marketplace_listings_created",
    "target": 1,
    "rewardPoints": 1,
    "chronicleTitle": "Market Caller",
    "chronicleSummary": "Listed goods for other citizens through the player market."
  },
  {
    "id": "eco-003",
    "kind": "medal",
    "category": "Economy / Market",
    "name": "Trade Hand",
    "description": "Complete five marketplace buys or sales.",
    "metric": "marketplace_trades",
    "target": 5,
    "rewardPoints": 1,
    "chronicleTitle": "Trade Hand",
    "chronicleSummary": "Made the market ledger notice repeated trade activity."
  },
  {
    "id": "itm-001",
    "kind": "honor",
    "category": "Items / Crafting",
    "name": "First Make",
    "description": "Craft one item.",
    "metric": "items_crafted",
    "target": 1,
    "rewardPoints": 1,
    "chronicleTitle": "First Make",
    "chronicleSummary": "Made an item through the crafting bench instead of merely admiring materials."
  },
  {
    "id": "itm-002",
    "kind": "honor",
    "category": "Items / Crafting",
    "name": "Useful Wreckage",
    "description": "Salvage one item.",
    "metric": "items_salvaged",
    "target": 1,
    "rewardPoints": 1,
    "chronicleTitle": "Useful Wreckage",
    "chronicleSummary": "Recovered value from unwanted goods."
  },
  {
    "id": "itm-003",
    "kind": "medal",
    "category": "Items / Crafting",
    "name": "Bench Regular",
    "description": "Craft ten items.",
    "metric": "items_crafted",
    "target": 10,
    "rewardPoints": 1,
    "chronicleTitle": "Bench Regular",
    "chronicleSummary": "Turned recipes into a repeated working loop."
  },
  {
    "id": "cmb-001",
    "kind": "honor",
    "category": "Attacking / Combat",
    "name": "First Bout",
    "description": "Resolve one combat encounter.",
    "metric": "combat_resolved",
    "target": 1,
    "rewardPoints": 1,
    "chronicleTitle": "First Bout",
    "chronicleSummary": "Resolved a live combat encounter in Nexis."
  },
  {
    "id": "cmb-002",
    "kind": "medal",
    "category": "Attacking / Combat",
    "name": "Ten Hard Lessons",
    "description": "Resolve ten combat encounters.",
    "metric": "combat_resolved",
    "target": 10,
    "rewardPoints": 1,
    "chronicleTitle": "Ten Hard Lessons",
    "chronicleSummary": "Survived enough fights for the ledger to stop calling it a fluke."
  },
  {
    "id": "wpn-001",
    "kind": "honor",
    "category": "Weapons",
    "name": "Armed Properly",
    "description": "Equip a weapon or resolve a weapon-based combat action.",
    "metric": "weapon_actions",
    "target": 1,
    "rewardPoints": 1,
    "chronicleTitle": "Armed Properly",
    "chronicleSummary": "Made weapon choice part of the character record."
  },
  {
    "id": "wpn-002",
    "kind": "medal",
    "category": "Weapons",
    "name": "Typed Threat",
    "description": "Resolve twenty weapon activations in real fights.",
    "metric": "weapon_actions",
    "target": 20,
    "rewardPoints": 1,
    "chronicleTitle": "Typed Threat",
    "chronicleSummary": "Built a visible history of weapon use."
  },
  {
    "id": "adv-001",
    "kind": "honor",
    "category": "Contracts / Quests / Adventures",
    "name": "Posted Work",
    "description": "Complete one contract or adventure.",
    "metric": "adventures_completed",
    "target": 1,
    "rewardPoints": 1,
    "chronicleTitle": "Posted Work",
    "chronicleSummary": "Finished live work posted through the city systems."
  },
  {
    "id": "adv-002",
    "kind": "medal",
    "category": "Contracts / Quests / Adventures",
    "name": "Expedition Habit",
    "description": "Complete five adventures or expeditions.",
    "metric": "adventures_completed",
    "target": 5,
    "rewardPoints": 1,
    "chronicleTitle": "Expedition Habit",
    "chronicleSummary": "Made field work a regular habit."
  },
  {
    "id": "adv-003",
    "kind": "honor",
    "category": "Contracts / Quests / Adventures",
    "name": "Elite Notice",
    "description": "Win one elite hunt.",
    "metric": "elite_hunts_won",
    "target": 1,
    "rewardPoints": 1,
    "chronicleTitle": "Elite Notice",
    "chronicleSummary": "Defeated an elite threat tied to city notices or expeditions."
  },
  {
    "id": "org-001",
    "kind": "honor",
    "category": "Guild / Consortium",
    "name": "Organized",
    "description": "Join or lead a guild or consortium.",
    "metric": "organization_joined",
    "target": 1,
    "rewardPoints": 1,
    "chronicleTitle": "Organized",
    "chronicleSummary": "Became attached to a player organization."
  },
  {
    "id": "org-002",
    "kind": "medal",
    "category": "Guild / Consortium",
    "name": "Assistance Ledger",
    "description": "Resolve three guild or consortium assistance actions.",
    "metric": "organization_assistance",
    "target": 3,
    "rewardPoints": 1,
    "chronicleTitle": "Assistance Ledger",
    "chronicleSummary": "Helped the organization layer do something useful."
  },
  {
    "id": "skl-001",
    "kind": "honor",
    "category": "Miscellaneous",
    "name": "Practiced Hand",
    "description": "Unlock a real gameplay skill.",
    "metric": "skills_unlocked",
    "target": 1,
    "rewardPoints": 1,
    "chronicleTitle": "Practiced Hand",
    "chronicleSummary": "Unlocked a first practiced skill in Nexis."
  },
  {
    "id": "skl-002",
    "kind": "honor",
    "category": "Miscellaneous",
    "name": "Evolution, Not Decoration",
    "description": "Evolve a skill through use.",
    "metric": "skill_evolutions",
    "target": 1,
    "rewardPoints": 1,
    "chronicleTitle": "Evolution, Not Decoration",
    "chronicleSummary": "Evolved a skill through live use."
  }
];

export const LEGACY_PERK_CATEGORIES = [
  "Core Utility",
  "Battle Stat Passives",
  "Combat Utility",
  "Weapon Masteries",
  "Economy / World"
];

export const LEGACY_PERKS = [
  {
    "id": "education-length",
    "category": "Core Utility",
    "name": "Education Length",
    "maxRank": 10,
    "baseEffect": 2,
    "effectUnit": "%",
    "description": "Reduces education course length.",
    "effectSummary": "Study time -2% per rank.",
    "icon": "ED"
  },
  {
    "id": "awareness",
    "category": "Core Utility",
    "name": "Awareness",
    "maxRank": 10,
    "baseEffect": 3,
    "effectUnit": "%",
    "description": "Improves discovery reads and anti-stealth perception.",
    "effectSummary": "Discovery and perception +3% per rank.",
    "icon": "AW"
  },
  {
    "id": "travel-efficiency",
    "category": "Core Utility",
    "name": "Travel Efficiency",
    "maxRank": 10,
    "baseEffect": 1.5,
    "effectUnit": "%",
    "description": "Reduces caravan travel duration.",
    "effectSummary": "Travel duration -1.5% per rank.",
    "icon": "TR"
  },
  {
    "id": "recovery",
    "category": "Core Utility",
    "name": "Recovery",
    "maxRank": 10,
    "baseEffect": 2,
    "effectUnit": "%",
    "description": "Improves ordinary health and stamina recovery.",
    "effectSummary": "Recovery +2% per rank.",
    "icon": "RC"
  },
  {
    "id": "gold-handling",
    "category": "Core Utility",
    "name": "Gold Handling",
    "maxRank": 10,
    "baseEffect": 1,
    "effectUnit": "%",
    "description": "Improves routine gold handling and fee outcomes where supported.",
    "effectSummary": "Gold handling +1% per rank.",
    "icon": "GP"
  },
  {
    "id": "consortium-effectiveness",
    "category": "Core Utility",
    "name": "Consortium Effectiveness",
    "maxRank": 10,
    "baseEffect": 2,
    "effectUnit": "%",
    "description": "Improves company logistics checks where supported.",
    "effectSummary": "Consortium effectiveness +2% per rank.",
    "icon": "CO"
  },
  {
    "id": "brawn",
    "category": "Battle Stat Passives",
    "name": "Brawn",
    "maxRank": 10,
    "baseEffect": 1,
    "effectUnit": "%",
    "description": "Improves strength-based battle checks.",
    "effectSummary": "Strength effectiveness +1% per rank.",
    "icon": "BR"
  },
  {
    "id": "protection",
    "category": "Battle Stat Passives",
    "name": "Protection",
    "maxRank": 10,
    "baseEffect": 1,
    "effectUnit": "%",
    "description": "Improves defense-based battle checks.",
    "effectSummary": "Defense effectiveness +1% per rank.",
    "icon": "PR"
  },
  {
    "id": "sharpness",
    "category": "Battle Stat Passives",
    "name": "Sharpness",
    "maxRank": 10,
    "baseEffect": 1,
    "effectUnit": "%",
    "description": "Improves speed-based battle checks.",
    "effectSummary": "Speed effectiveness +1% per rank.",
    "icon": "SH"
  },
  {
    "id": "evasion",
    "category": "Battle Stat Passives",
    "name": "Evasion",
    "maxRank": 10,
    "baseEffect": 1,
    "effectUnit": "%",
    "description": "Improves dexterity-based battle checks.",
    "effectSummary": "Dexterity effectiveness +1% per rank.",
    "icon": "EV"
  },
  {
    "id": "arcane-force",
    "category": "Battle Stat Passives",
    "name": "Arcane Force",
    "maxRank": 10,
    "baseEffect": 1,
    "effectUnit": "%",
    "description": "Improves magical combat pressure where supported.",
    "effectSummary": "Magical pressure +1% per rank.",
    "icon": "AF"
  },
  {
    "id": "vital-reserve",
    "category": "Battle Stat Passives",
    "name": "Vital Reserve",
    "maxRank": 10,
    "baseEffect": 2,
    "effectUnit": "%",
    "description": "Improves maximum Life reserve.",
    "effectSummary": "Max Life +2% per rank.",
    "icon": "VR"
  },
  {
    "id": "critical-rate",
    "category": "Combat Utility",
    "name": "Critical Rate",
    "maxRank": 10,
    "baseEffect": 0.5,
    "effectUnit": "%",
    "description": "Improves critical chance in combat.",
    "effectSummary": "Critical chance +0.5% per rank.",
    "icon": "CR"
  },
  {
    "id": "stealth",
    "category": "Combat Utility",
    "name": "Stealth",
    "maxRank": 10,
    "baseEffect": 2,
    "effectUnit": "%",
    "description": "Improves covert approach checks.",
    "effectSummary": "Stealth +2% per rank.",
    "icon": "ST"
  },
  {
    "id": "perception",
    "category": "Combat Utility",
    "name": "Perception",
    "maxRank": 10,
    "baseEffect": 2,
    "effectUnit": "%",
    "description": "Improves anti-stealth and threat-reading checks.",
    "effectSummary": "Perception +2% per rank.",
    "icon": "PE"
  },
  {
    "id": "hospitalizing",
    "category": "Combat Utility",
    "name": "Hospitalizing",
    "maxRank": 10,
    "baseEffect": 2,
    "effectUnit": "%",
    "description": "Improves severe combat consequence pressure where supported.",
    "effectSummary": "Hospitalizing pressure +2% per rank.",
    "icon": "HO"
  },
  {
    "id": "slashing-mastery",
    "category": "Weapon Masteries",
    "name": "Slashing Mastery",
    "maxRank": 10,
    "baseEffect": 1,
    "effectUnit": "%",
    "description": "Improves slashing weapon damage and accuracy.",
    "effectSummary": "Slashing weapons +1% per rank.",
    "icon": "SL"
  },
  {
    "id": "piercing-mastery",
    "category": "Weapon Masteries",
    "name": "Piercing Mastery",
    "maxRank": 10,
    "baseEffect": 1,
    "effectUnit": "%",
    "description": "Improves piercing weapon damage and accuracy.",
    "effectSummary": "Piercing weapons +1% per rank.",
    "icon": "PI"
  },
  {
    "id": "bludgeoning-mastery",
    "category": "Weapon Masteries",
    "name": "Bludgeoning Mastery",
    "maxRank": 10,
    "baseEffect": 1,
    "effectUnit": "%",
    "description": "Improves bludgeoning weapon damage and accuracy.",
    "effectSummary": "Bludgeoning weapons +1% per rank.",
    "icon": "BL"
  },
  {
    "id": "magical-focus-mastery",
    "category": "Weapon Masteries",
    "name": "Magical Focus Mastery",
    "maxRank": 10,
    "baseEffect": 1,
    "effectUnit": "%",
    "description": "Improves wand, staff, focus, and magical weapon output.",
    "effectSummary": "Magical focus weapons +1% per rank.",
    "icon": "MF"
  },
  {
    "id": "polearm-mastery",
    "category": "Weapon Masteries",
    "name": "Polearm Mastery",
    "maxRank": 10,
    "baseEffect": 1,
    "effectUnit": "%",
    "description": "Improves spear and polearm handling.",
    "effectSummary": "Polearms +1% per rank.",
    "icon": "PO"
  },
  {
    "id": "light-blade-mastery",
    "category": "Weapon Masteries",
    "name": "Light Blade Mastery",
    "maxRank": 10,
    "baseEffect": 1,
    "effectUnit": "%",
    "description": "Improves knives, daggers, and light blades.",
    "effectSummary": "Light blades +1% per rank.",
    "icon": "LB"
  },
  {
    "id": "masterful-looting",
    "category": "Economy / World",
    "name": "Masterful Looting",
    "maxRank": 10,
    "baseEffect": 2,
    "effectUnit": "%",
    "description": "Improves loot and material yield checks where supported.",
    "effectSummary": "Loot quality +2% per rank.",
    "icon": "ML"
  },
  {
    "id": "black-market-instinct",
    "category": "Economy / World",
    "name": "Black Market Instinct",
    "maxRank": 10,
    "baseEffect": 2,
    "effectUnit": "%",
    "description": "Improves shady market and underworld opportunity reads.",
    "effectSummary": "Under-market reads +2% per rank.",
    "icon": "BM"
  },
  {
    "id": "relic-appraisal",
    "category": "Economy / World",
    "name": "Relic Appraisal",
    "maxRank": 10,
    "baseEffect": 2,
    "effectUnit": "%",
    "description": "Improves relic valuation and discovery interpretation.",
    "effectSummary": "Relic appraisal +2% per rank.",
    "icon": "RA"
  },
  {
    "id": "smugglers-hold",
    "category": "Economy / World",
    "name": "Smuggler's Hold",
    "maxRank": 10,
    "baseEffect": 1,
    "effectUnit": "%",
    "description": "Improves covert cargo handling where supported.",
    "effectSummary": "Covert cargo stability +1% per rank.",
    "icon": "SM"
  },
  {
    "id": "treasury-efficiency",
    "category": "Economy / World",
    "name": "Treasury Efficiency",
    "maxRank": 10,
    "baseEffect": 1,
    "effectUnit": "%",
    "description": "Improves treasury, fee, and logistics efficiency where supported.",
    "effectSummary": "Treasury efficiency +1% per rank.",
    "icon": "TE"
  }
];

export function getLegacyPerk(perkId) {
  return LEGACY_PERKS.find((perk) => perk.id === perkId) ?? null;
}

export function getLegacyRankCost(rank) {
  const numeric = Number(rank);
  if (!Number.isFinite(numeric)) return 0;
  return Math.max(0, Math.floor(numeric));
}
