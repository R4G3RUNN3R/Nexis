export type WikiEntry = {
  id: string;
  category: string;
  title: string;
  summary: string;
  routes?: Array<{ label: string; to: string }>;
  rules?: string[];
  related?: string[];
};

export type WikiSection = {
  id: string;
  label: string;
  summary: string;
  entries: WikiEntry[];
};

export const wikiSections: WikiSection[] = [
  {
    id: "start",
    label: "Getting Started",
    summary: "Core account flow, command shell, and first useful actions.",
    entries: [
      {
        id: "command-shell",
        category: "Getting Started",
        title: "Command Shell",
        summary: "Nexis is built around a dense command surface: top links for primary travel, a left rail for systems, and compact status panels for resources and records.",
        routes: [{ label: "Home", to: "/home" }, { label: "City", to: "/city" }],
        rules: ["Home is the personal command center.", "City is local action.", "Travel owns movement.", "Codex stores long-form archives.", "Wiki explains how systems work."],
      },
      {
        id: "public-id",
        category: "Getting Started",
        title: "Public ID",
        summary: "Every citizen has a public ID used for profiles, duels, admin lookup, and social systems.",
        routes: [{ label: "Profile", to: "/profile" }],
        rules: ["Public IDs are safe to share.", "Private login details are never shown in public game surfaces.", "Player search can use names or public IDs."],
      },
      {
        id: "readiness-loop",
        category: "Getting Started",
        title: "Daily Readiness Loop",
        summary: "Check Home, claim notices, choose education or academy study, review City Board, then spend energy on adventure, combat, contracts, travel, or organization work.",
        routes: [{ label: "Home", to: "/home" }, { label: "City Board", to: "/city-board" }],
        rules: ["Unread progression events remain visible until acknowledged.", "Daily streak and offline return notices should be compact and actionable.", "Readiness panels should never replace the actual action pages."],
      },
    ],
  },
  {
    id: "character",
    label: "Character",
    summary: "Resources, identity, titles, records, and permanent account history.",
    entries: [
      {
        id: "resources",
        category: "Character",
        title: "Resources",
        summary: "Energy fuels real fights and many active systems, Health is survivability, Stamina supports strenuous actions, Comfort comes from property, and Shadow powers covert play.",
        routes: [{ label: "Home", to: "/home" }, { label: "Hospital", to: "/hospital" }],
        rules: ["Real fights cost energy when combat begins.", "Shadow is separate from energy and belongs to shady or covert actions.", "Low resource blocks should explain what is missing."],
      },
      {
        id: "level-life",
        category: "Character",
        title: "Levels and Life",
        summary: "Levels increase survivability, milestone access, prestige, and rare manual eligibility. They do not directly increase battle or working stats.",
        routes: [{ label: "Achievements", to: "/achievements" }],
        rules: ["Max Life follows 100 + (level - 1) * 50.", "Level-up fully heals to the new max Life.", "Training, education, academy, gear, and use remain the sources of power growth."],
      },
      {
        id: "records",
        category: "Character",
        title: "Records and Chronicle",
        summary: "Account records preserve major progression events. Personal DMOS one-shots write to the player Chronicle, while group one-shots write to organization legacy records.",
        routes: [{ label: "Codex", to: "/codex" }, { label: "One-Shots", to: "/one-shots" }],
        rules: ["Player records are always available to their owner.", "Shareable records should be opt-in.", "Organization legacy belongs to the Guild or Consortium, not to individual player history."],
      },
      {
        id: "titles-badges",
        category: "Character",
        title: "Titles, Badges, and Prestige",
        summary: "Titles and distinctions show earned identity from education, discoveries, combat, city standing, organizations, and major events.",
        routes: [{ label: "Profile", to: "/profile" }, { label: "Achievements", to: "/achievements" }],
        rules: ["Equipped title appears on Home, profile, and compact identity chips.", "Prestige should be earned, visible, and compact.", "Special founder or staff boosts must stay role-bound and explicit."],
      },
    ],
  },
  {
    id: "progression",
    label: "Progression",
    summary: "Education, academy study, achievements, legacy points, and skill growth.",
    entries: [
      {
        id: "education",
        category: "Progression",
        title: "Education",
        summary: "Education is a server-authoritative timed course system for broad account progression, hard gates, and passive unlocks.",
        routes: [{ label: "Education", to: "/education" }],
        rules: ["One education course can run at the same time as one academy study.", "Courses show duration, cost, prerequisites, unlocks, and bonuses.", "Gates must say what is locked, why, and what course unlocks it."],
      },
      {
        id: "academy",
        category: "Progression",
        title: "Academy Study",
        summary: "Academy study is city-bound specialized progression, separate from Education, and can pause or block when city rules require it.",
        routes: [{ label: "Academies", to: "/academies" }, { label: "Education", to: "/education" }],
        rules: ["Academy state must not overwrite Education state.", "City association matters.", "Stage progress and pause reasons should be visible."],
      },
      {
        id: "skills",
        category: "Progression",
        title: "Skills",
        summary: "Skills move from locked, to acquired, to learning, to learned, then improve by use through mastery and evolution.",
        routes: [{ label: "Skills", to: "/skills" }],
        rules: ["Rare skills are not granted for free by level.", "Manual eligibility unlocks by level band, but books must still be found or bought.", "Cumulative uses should not reset on evolution."],
      },
      {
        id: "achievements-legacy",
        category: "Progression",
        title: "Achievements and Legacy",
        summary: "Honors and medals award points once. Points are spent permanently in the Legacy tree for utility, combat, weapon, economy, and world passives.",
        routes: [{ label: "Legacy", to: "/achievements" }],
        rules: ["Everything starts at 0 unless earned.", "Legacy spending is permanent.", "Working-stat gain merits do not belong in the merit tree."],
      },
    ],
  },
  {
    id: "realm",
    label: "Realm",
    summary: "City, Travel, World Map, City Board, Codex, and discovery ownership.",
    entries: [
      {
        id: "city",
        category: "Realm",
        title: "City",
        summary: "City is the local hub: overview, services, people, local contracts, academy access, and district directory.",
        routes: [{ label: "City", to: "/city" }],
        rules: ["City should answer what you can do here now.", "People lists stay compact and privacy-safe.", "Long city lore belongs in Codex."],
      },
      {
        id: "travel",
        category: "Realm",
        title: "Travel",
        summary: "Travel owns routes, destinations, departure, travel time, risk, cargo relevance, and encounter relevance.",
        routes: [{ label: "Travel", to: "/travel" }],
        rules: ["World Map does not start travel.", "Route gates should explain requirements.", "World Geography improves efficient travel and discovery."],
      },
      {
        id: "world-map",
        category: "Realm",
        title: "World Map",
        summary: "World Map is a compact discovery atlas showing discovered, rumored, locked, and unknown places without departure controls.",
        routes: [{ label: "World Map", to: "/world-map" }, { label: "Codex", to: "/codex" }],
        rules: ["No travel CTAs live here.", "Short taglines only.", "Read Entry links move deep lore to Codex."],
      },
      {
        id: "city-board",
        category: "Realm",
        title: "City Board",
        summary: "City Board is a newspaper-style civic bulletin: masthead, front page, civic appointments, opportunities, bounties, notices, and classifieds.",
        routes: [{ label: "City Board", to: "/city-board" }],
        rules: ["Each posting belongs to one editorial slot.", "Board entries should vary by city and live state.", "Blurbs stay short and actionable."],
      },
      {
        id: "codex",
        category: "Realm",
        title: "Codex",
        summary: "Codex is the archive for atlas entries, discoveries, records, manuals, history, lore, and long-form reference material.",
        routes: [{ label: "Codex", to: "/codex" }],
        rules: ["Action pages should not carry encyclopedia slabs.", "Discovery-linked entries unlock through play.", "Manuals and records can be referenced from here."],
      },
    ],
  },
  {
    id: "combat-pvp",
    label: "Combat and PvP",
    summary: "Arena, duels, bounty writs, damage types, armor reduction, and future PvP modes.",
    entries: [
      {
        id: "combat-basics",
        category: "Combat and PvP",
        title: "Combat Basics",
        summary: "Weapons use damage, accuracy, slot, handedness, and damage type. Armor uses typed reduction, weight class, slot, and set membership.",
        routes: [{ label: "Arena", to: "/arena" }, { label: "Inventory", to: "/inventory" }],
        rules: ["Supported core damage types are Slashing, Piercing, Bludgeoning, and Magical.", "Combat logs should show damage type and reduction clearly.", "Real fights spend energy when combat begins."],
      },
      {
        id: "duels",
        category: "Combat and PvP",
        title: "Duels",
        summary: "Duels are same-city player challenges with visible feedback, energy cost on accepted combat, and clear decline behavior.",
        routes: [{ label: "Arena", to: "/arena" }],
        rules: ["Blank, invalid, self, not found, or ineligible targets must produce visible errors.", "Declined invites spend no energy.", "Resolved duels write combat history."],
      },
      {
        id: "pvp-scaffold",
        category: "Combat and PvP",
        title: "PvP Modes",
        summary: "The PvP scaffold supports sparring duels, ranked duels, bounty writs, guild rivalries, caravan interception, and arena seasons.",
        routes: [{ label: "Arena", to: "/arena" }, { label: "Guilds", to: "/guilds" }, { label: "Consortiums", to: "/consortiums" }],
        rules: ["PvP starts protected by default.", "Bounties need a valid target state.", "Danger-route PvP belongs to Travel and consortium logistics."],
      },
      {
        id: "notoriety",
        category: "Combat and PvP",
        title: "Notoriety",
        summary: "Notoriety tracks criminal or hostile attention and supports tiers such as Clean, Noticed, Wanted, Outlaw, and Infamous.",
        rules: ["Clean players stay protected by default.", "Wanted and worse can become valid bounty targets.", "Notoriety should create consequences and opportunities, not random punishment."],
      },
    ],
  },
  {
    id: "items-economy",
    label: "Items and Economy",
    summary: "Inventory, crafting, salvage, player market, item sources, and trade loops.",
    entries: [
      {
        id: "inventory",
        category: "Items and Economy",
        title: "Inventory",
        summary: "Inventory is dense and list-first. Equipped or worn rows are highlighted, and row expansion shows stats, source, set, value, and actions.",
        routes: [{ label: "Inventory", to: "/inventory" }],
        rules: ["Plus equips or wears.", "Minus unequips or removes.", "Tick uses.", "Paper plane sends.", "Market lists.", "Trash destroys with confirmation."],
      },
      {
        id: "sets-wardrobe",
        category: "Items and Economy",
        title: "Armor Sets and Wardrobe",
        summary: "Combat armor and visual clothing are separate. Sets provide themed bonuses, while wardrobe items control appearance or prestige identity.",
        routes: [{ label: "Inventory", to: "/inventory" }, { label: "Profile", to: "/profile" }],
        rules: ["Specialist sets beat universal sets for their favored damage types.", "Concordant Aegis is broad but not the best specialist defense.", "Visual clothing should not masquerade as combat armor."],
      },
      {
        id: "crafting-salvage",
        category: "Items and Economy",
        title: "Crafting and Salvage",
        summary: "Crafting turns materials into usable goods. Salvage breaks items into sensible outputs and should never produce the same item unless explicitly surfaced.",
        routes: [{ label: "Crafting", to: "/crafting" }, { label: "Salvage Yard", to: "/salvage-yard" }],
        rules: ["Recipes show outputs and requirements.", "Empty states should feel intentional.", "Source paths should make item acquisition understandable."],
      },
      {
        id: "player-market",
        category: "Items and Economy",
        title: "Player Market",
        summary: "The player market is for fixed-price listings, browsing, buying, own listing history, and price clarity between players.",
        routes: [{ label: "Market", to: "/market" }, { label: "Inventory", to: "/inventory" }],
        rules: ["Inventory listing must handle quantity and price.", "Listed quantities must not feel desynced from owned inventory.", "City demand hints should guide value without becoming a stock simulator."],
      },
    ],
  },
  {
    id: "organizations",
    label: "Organizations",
    summary: "Guilds, Consortiums, assistance loops, and group one-shots.",
    entries: [
      {
        id: "guilds",
        category: "Organizations",
        title: "Guilds",
        summary: "Guilds are factions and operations hubs for combat, expeditions, rivalry, armory, base upgrades, prestige, and assistance work.",
        routes: [{ label: "Guilds", to: "/guilds" }],
        rules: ["Guilds are not companies.", "First view should show who you are, what you gain, what is active, and what to do next.", "Operations should feel like adventures and field work."],
      },
      {
        id: "consortiums",
        category: "Organizations",
        title: "Consortiums",
        summary: "Consortiums are player companies for logistics, treasury, routes, staff, finance, assets, and advancement.",
        routes: [{ label: "Consortiums", to: "/consortiums" }],
        rules: ["Consortiums are not guilds.", "Company type, rank, passives, hazard, and next steps should be visible.", "Treasury and route outcomes should matter."],
      },
      {
        id: "assistance-loops",
        category: "Organizations",
        title: "Guild <-> Consortium Assistance",
        summary: "Guilds can assist consortiums in dangerous work such as convoy defense, ruin escort, bounty clearing, ward suppression, and high-risk delivery protection.",
        routes: [{ label: "Guilds", to: "/guilds" }, { label: "Consortiums", to: "/consortiums" }],
        rules: ["Guilds gain reputation, treasury rewards, operation history, prestige, and possibly city standing.", "Consortiums gain safer routes, advancement, hazard reduction, output stability, and contract progress.", "Roles stay distinct."],
      },
      {
        id: "organization-one-shots",
        category: "Organizations",
        title: "Organization One-Shots",
        summary: "Guilds and Consortiums can run fixed-choice group one-shots inspired by the Nexis DMOS boundary, but rewards and records belong to the organization.",
        routes: [{ label: "Guilds", to: "/guilds" }, { label: "Consortiums", to: "/consortiums" }],
        rules: ["At least five members must sign up and commit one Nexis one-shot token each before resolution.", "Donators choose whether to spend tokens on personal, Guild, or Consortium one-shots.", "Guild one-shots are dungeon and monster-fighting operations with weapons and armor weighted rewards.", "Consortium one-shots are trade, espionage, and rival sabotage operations with high-value sellable reward goods.", "Rewards pay directly to organization treasury and progression/reputation ledgers.", "Each committed token has a 0.01% refund chance when the run resolves.", "Legacy records are written to Guild or Consortium history, not to player Chronicle.", "Completed organization one-shots cannot be completed again."],
      },
    ],
  },
  {
    id: "adventure-discovery",
    label: "Adventure and Discovery",
    summary: "Expeditions, hidden sites, travel discoveries, city events, and world progression.",
    entries: [
      {
        id: "adventures",
        category: "Adventure and Discovery",
        title: "Adventures and Expeditions",
        summary: "Adventure covers local contracts, field expeditions, hidden-site runs, elite hunts, convoy defense, and relic recovery.",
        routes: [{ label: "Adventure", to: "/adventure" }],
        rules: ["Entries show risk, city or region, threat type, preparation, rewards, and start CTA.", "Locked missions must explain why.", "Gear preparation should matter without forcing one correct item."],
      },
      {
        id: "hidden-sites",
        category: "Adventure and Discovery",
        title: "Hidden Sites",
        summary: "Hidden sites progress from Unknown to Rumored to Discovered to Explored and can create Codex entries, Board notices, contracts, or loot hooks.",
        routes: [{ label: "World Map", to: "/world-map" }, { label: "Codex", to: "/codex" }],
        rules: ["Sites attach to regions, routes, or cities.", "World Geography and Historical Awareness improve discovery value.", "Long discovery writing belongs in Codex."],
      },
      {
        id: "city-diaries",
        category: "Adventure and Discovery",
        title: "City Diaries",
        summary: "City diaries provide Easy, Standard, Dangerous, and Elite checklists for each launch city, with compact progress and identity rewards.",
        routes: [{ label: "World Map", to: "/world-map" }, { label: "City", to: "/city" }],
        rules: ["Nexis City, Blackharbor, Silverbough, Ironhall, and Highcourt each have their own diary identity.", "Diary progress should connect to discoveries, one-shots, contracts, and organization work.", "Rewards should be earned, not prefilled."],
      },
      {
        id: "world-events",
        category: "Adventure and Discovery",
        title: "World Events",
        summary: "World events make cities feel reactive through threats, shortages, legal emergencies, ward disturbances, and elite notices.",
        routes: [{ label: "City Board", to: "/city-board" }, { label: "Adventure", to: "/adventure" }],
        rules: ["Events surface compactly through Board, City, Adventure, Guild, or Consortium context.", "They should affect opportunities or recommendations, not become unreadable simulations.", "Rewards can include gear, materials, gold, records, or organization progress."],
      },
    ],
  },
  {
    id: "one-shots",
    label: "DMOS and One-Shots",
    summary: "Nexis-native one-shots, Patron access, rewards, and campaign records.",
    entries: [
      {
        id: "nexis-one-shots",
        category: "DMOS and One-Shots",
        title: "Nexis One-Shots",
        summary: "Nexis one-shots use the DMOS engine boundary while staying inside Nexis rules: embedded character state, fixed choices, fixed outcomes, validated rewards, and permanent Chronicle records.",
        routes: [{ label: "One-Shots", to: "/one-shots" }],
        rules: ["Standalone DMOS remains separate.", "Completed player campaigns cannot be repeated.", "Rewards may include XP, gold, items, titles, or records based on campaign rules."],
      },
      {
        id: "patron-tokens",
        category: "DMOS and One-Shots",
        title: "Patron Tokens and Founder Packs",
        summary: "Donation rewards can grant bound Patron one-shot access, sealed tradable tokens, and sellable reward items without making pay-only power unavoidable.",
        routes: [{ label: "One-Shots", to: "/one-shots" }],
        rules: ["Monthly Patron access should be bound by default.", "Tradable sealed tokens are acceptable if their economy is explicit.", "Unique rewards should avoid duplicate drops when uniqueness matters."],
      },
      {
        id: "campaign-records",
        category: "DMOS and One-Shots",
        title: "Campaign Records",
        summary: "Each completed player one-shot stores a short permanent summary of the choices and outcome so the player can look back or share it later if allowed.",
        routes: [{ label: "One-Shots", to: "/one-shots" }, { label: "Codex", to: "/codex" }],
        rules: ["Player campaign records belong to player Chronicle.", "Organization group one-shot records belong to organization legacy.", "Sharing should be optional."],
      },
    ],
  },
  {
    id: "admin",
    label: "Admin and Safety",
    summary: "Role-gated staff tools, visibility rules, and system boundaries.",
    entries: [
      {
        id: "admin-dossier",
        category: "Admin and Safety",
        title: "Admin Dossier",
        summary: "Staff dossier views are for authorized inspection and correction of player state, inventory, equipped items, skills, education, academy, contracts, travel, organizations, and records.",
        routes: [{ label: "Admin", to: "/admin" }],
        rules: ["Frontend gating is not enough; backend role checks are authoritative.", "Admin actions require reasons and audit entries where practical.", "Normal players must not see staff-only controls."],
      },
      {
        id: "privacy",
        category: "Admin and Safety",
        title: "Privacy and Public Surfaces",
        summary: "Public pages show identity, title, profile details, organization membership, and records only where safe and intentional.",
        routes: [{ label: "Profile", to: "/profile" }, { label: "City", to: "/city" }],
        rules: ["Uploaded avatars replace initials where available.", "Test, canary, and admin junk should be suppressed from normal presence views.", "Backend permissions decide what can be seen or changed."],
      },
    ],
  },
];

export const allWikiEntries = wikiSections.flatMap((section) => section.entries);
