export type AcademyId =
  | "southern"
  | "eastern"
  | "northern"
  | "western"
  | "nexis_professions";

export type RewardMode = "passive" | "active" | "mixed" | "unlock" | "branch" | "tbd";
export type WesternBranch = "order" | "shadow" | null;

export type AcademyRankDefinition = {
  rank: number;
  title: string;
  durationDays: number;
  description: string;
  rewardMode: RewardMode;
  branch?: WesternBranch;
  notes?: string[];
  dependencies?: string[];
};

export type AcademyDefinition = {
  id: AcademyId;
  name: string;
  shortName: string;
  theme: string;
  roleIdentity: string;
  region: string;
  locationName: string;
  academyType: "switch-based" | "always-active-professions";
  totalRanks: number;
  durationPerRankDays: number;
  totalDurationDays: number;
  activationRules: string[];
  description: string;
  ranks: AcademyRankDefinition[];
};

export const academySystemRules: string[] = [
  "All standard academies have 8 ranks.",
  "Each rank takes 5 days.",
  "Each standard academy takes 40 total days to complete.",
  "A player can learn all academies over time.",
  "Only one standard academy can be active at a time.",
  "Switching active academy requires travel to that academy's location.",
  "Switching active academy requires a significant gold cost.",
  "Switching active academy requires a real 30-day cooldown from the previous switch timestamp.",
  "Rank rewards can be passive, active, mixed, unlock, branch, or TBD.",
  "Education and regional unlocks determine entry requirements as academy access expands.",
  "Academy locations are visible now; switching rules unlock as travel and regional requirements are met.",
];

export const academyDefinitions: AcademyDefinition[] = [
  {
    id: "southern",
    name: "Highcourt Rhetoric and Statecraft Lyceum",
    shortName: "Highcourt Academy",
    theme: "Rhetoric, civic law, diplomacy, prestige, permits",
    roleIdentity: "Envoy / legal advocate / statecraft specialist",
    region: "South",
    locationName: "Highcourt",
    academyType: "switch-based",
    totalRanks: 8,
    durationPerRankDays: 5,
    totalDurationDays: 40,
    activationRules: [
      "Can only be active if selected as the currently active academy.",
      "Switching to it requires travel to Highcourt, gold cost, and 30-day cooldown.",
      "Court-facing influence, permits, and civic leverage are exclusive to this academy path.",
      "Advanced court permissions require civic foundations and later regional reputation hooks.",
    ],
    description:
      "Highcourt study begins with civic etiquette and rises into rhetoric, permit control, diplomacy, and prestige administration.",
    ranks: [
      {
        rank: 1,
        title: "Civic Etiquette",
        durationDays: 5,
        rewardMode: "unlock",
        description:
          "Unlocks formal petition literacy, permit filing basics, and court-facing introduction hooks.",
        notes: ["The first rank teaches access language before deeper legal leverage opens."],
      },
      {
        rank: 2,
        title: "Field Mediation",
        durationDays: 5,
        rewardMode: "active",
        description:
          "Allows city and travel conflicts to be framed through negotiation, permits, and temporary settlements.",
        notes: [
          "Designed as civic survival support during future city events.",
          "Implementation should avoid immunity to consequences.",
        ],
      },
      {
        rank: 3,
        title: "Legal Reasoning",
        durationDays: 5,
        rewardMode: "passive",
        description:
          "Strengthens legal and civic tasks through better argument structure and procedural awareness.",
      },
      {
        rank: 4,
        title: "Patron Protocol",
        durationDays: 5,
        rewardMode: "mixed",
        description:
          "Builds relationships with patrons and clerks that can support favorable outcomes in court-facing systems.",
        notes: [
          "Initial suggested outcome bonus is 1%.",
          "Patron influence can later scale through separate reputation progression.",
        ],
      },
      {
        rank: 5,
        title: "Permit Transfer",
        durationDays: 5,
        rewardMode: "active",
        description:
          "Uses stored civic standing to help another player or organization bypass basic filing friction.",
        notes: ["24-hour cooldown.", "Healing equals life sacrificed × 2."],
      },
      {
        rank: 6,
        title: "Prestige Restoration",
        durationDays: 5,
        rewardMode: "active",
        description:
          "Restores damaged public standing once per long cooldown through formal apology, testimony, and filings.",
      },
      {
        rank: 7,
        title: "Emergency Writ",
        durationDays: 5,
        rewardMode: "active",
        description: "Issues emergency legal cover for a blocked civic or consortium action when requirements are nearly met.",
        dependencies: ["Nexis Civic Academy rank 1: Civic Fundamentals"],
        notes: [
          "15-minute cooldown.",
          "Consumes civic standing and a filing fee.",
          "Cost reductions may exist later, but should never hit zero.",
        ],
      },
      {
        rank: 8,
        title: "Statecraft Doctrine",
        durationDays: 5,
        rewardMode: "active",
        description:
          "A higher mastery form of diplomacy that turns permits, prestige, and testimony into major civic leverage.",
        dependencies: ["Nexis Civic Academy rank 1: Civic Fundamentals"],
        notes: ["5-minute cooldown.", "Consumes civic standing and a significant filing fee."],
      },
    ],
  },
  {
    id: "eastern",
    name: "Ironhall Enginewright School",
    shortName: "Eastern Academy",
    theme: "Forge discipline, war-school fundamentals, materials, industrial planning",
    roleIdentity: "Smith / guard-captain / enginewright",
    region: "East",
    locationName: "Ironhall Forge-City",
    academyType: "switch-based",
    totalRanks: 8,
    durationPerRankDays: 5,
    totalDurationDays: 40,
    activationRules: [
      "Can only be active if selected as the currently active academy.",
      "Switching to it requires travel to Ironhall, gold cost, and 30-day cooldown.",
    ],
    description:
      "Ironhall transforms forge discipline, material planning, and war-school fundamentals into practical industrial advantage.",
    ranks: [
      { rank: 1, title: "Combat Fundamentals", durationDays: 5, rewardMode: "passive", description: "Passive increase to all battle stats by 1%." },
      { rank: 2, title: "Forge Discipline", durationDays: 5, rewardMode: "passive", description: "Passive increase to tool, blade, and crafted-equipment effectiveness by 5%." },
      { rank: 3, title: "Workshop Footwork", durationDays: 5, rewardMode: "passive", description: "Passive increase in accuracy and dodge by 5%." },
      { rank: 4, title: "Line Training", durationDays: 5, rewardMode: "passive", description: "Passive increase in accuracy and dodge by a further 5%, and increases awareness by 5." },
      { rank: 5, title: "Precision Forging", durationDays: 5, rewardMode: "passive", description: "Passive increase in accuracy by 5%." },
      { rank: 6, title: "Yard Awareness", durationDays: 5, rewardMode: "passive", description: "Passive increase in awareness by 15." },
      { rank: 7, title: "Material Mastery", durationDays: 5, rewardMode: "passive", description: "Passive damage increase with all weapons by 5%." },
      { rank: 8, title: "Enginewright Doctrine", durationDays: 5, rewardMode: "mixed", description: "Major capstone that grants +5% all battle stats, +5 awareness, and +10% dodge.", notes: ["Intended as the signature Ironhall mastery payoff."] },
    ],
  },
  {
    id: "northern",
    name: "Silverbough Arcane Conservatory",
    shortName: "Northern Academy",
    theme: "Arcane healing, relic handling, ward literacy, herbal scholarship",
    roleIdentity: "Healer-scholar / relic handler / ward specialist",
    region: "North",
    locationName: "Silverbough",
    academyType: "switch-based",
    totalRanks: 8,
    durationPerRankDays: 5,
    totalDurationDays: 40,
    activationRules: [
      "Can only be active if selected as the currently active academy.",
      "Switching to it requires travel to Silverbough, gold cost, and 30-day cooldown.",
      "Northern rank 1 unlocks the mana bar and becomes a dependency for high-end Southern spiritual rites.",
    ],
    description:
      "Silverbough governs magical literacy, healing theory, ward craft, relic handling, and arcane field ethics.",
    ranks: [
      { rank: 1, title: "Arcane Fundamentals", durationDays: 5, rewardMode: "unlock", description: "Unlocks magical spellcasting and the Mana Bar at 50 / 50.", notes: ["Mana is used for magic, enhancement, creation, and identification systems."] },
      { rank: 2, title: "Mana Control", durationDays: 5, rewardMode: "passive", description: "Improves mana efficiency by 10% and increases mana pool by 20, raising it to 70 / 70." },
      { rank: 3, title: "Rune Theory", durationDays: 5, rewardMode: "unlock", description: "Allows understanding and crafting of simple runes used for item enhancement.", notes: ["Base crafting cost: 50 mana."] },
      { rank: 4, title: "Enhancement Craft", durationDays: 5, rewardMode: "unlock", description: "Allows more complex magical enhancements and advanced gear enchantments.", notes: ["Base crafting cost: 50 mana."] },
      { rank: 5, title: "Enchantment Weaving", durationDays: 5, rewardMode: "passive", description: "Reduces mana usage for enchantment and enhancement crafting actions by 50%." },
      { rank: 6, title: "Artifact Binding", durationDays: 5, rewardMode: "active", description: "Allows binding an artifact to self or another player.", notes: ["Binding costs 50 mana plus a rare material such as a diamond.", "Success chance improves with user level."] },
      { rank: 7, title: "Relic Infusion", durationDays: 5, rewardMode: "active", description: "Allows binding a relic to self or another player.", notes: ["Binding costs 50 mana plus a rare material such as a diamond.", "Success chance improves with user level."] },
      { rank: 8, title: "Masterwork Creation", durationDays: 5, rewardMode: "mixed", description: "Allows creation attempts for Artifact-tier and Relic-tier items.", notes: ["Outcome depends on level, crafting skill, mana pool, mastery, and materials.", "Rarer materials increase success chance and quality ceiling."] },
    ],
  },
  {
    id: "western",
    name: "Blackharbor Maritime Ledger Academy",
    shortName: "Blackharbor Academy",
    theme: "Maritime commerce, covert routing, cargo law, corsair pressure",
    roleIdentity: "Harbor broker / corsair fixer / cargo-route reader",
    region: "West",
    locationName: "Blackharbor",
    academyType: "switch-based",
    totalRanks: 8,
    durationPerRankDays: 5,
    totalDurationDays: 40,
    activationRules: [
      "Can only be active if selected as the currently active academy.",
      "Switching to it requires travel to Blackharbor, gold cost, and 30-day cooldown.",
      "Branch selection occurs at rank 3 and should be treated as a committed path decision.",
    ],
    description:
      "Blackharbor study governs cargo law, underdock intelligence, escort risk, and covert trade pressure, splitting into Order or Shadow after a shared foundation.",
    ranks: [
      { rank: 1, title: "Civic Law and Shadow Codes", durationDays: 5, rewardMode: "passive", branch: null, description: "Knowledge of legal and criminal systems, granting +1% working stats and +1% battle stats." },
      { rank: 2, title: "Authority and Networks", durationDays: 5, rewardMode: "passive", branch: null, description: "Knowledge of how authority and shadow networks function in the West, granting +2% working stats and +2% battle stats." },
      { rank: 3, title: "Branch Selection", durationDays: 5, rewardMode: "branch", branch: null, description: "Locks the user's internal Western branch as either Order or Shadow and grants +3% working stats and +3% battle stats.", notes: ["Branch should be considered a committed progression decision."] },
      { rank: 4, title: "Enforcement Protocols", durationDays: 5, rewardMode: "mixed", branch: "order", description: "Order branch: +1% battle stats and +5% success chance on Order-aligned jobs and tasks." },
      { rank: 5, title: "Criminal Tracking", durationDays: 5, rewardMode: "unlock", branch: "order", description: "Order branch: unlocks the Tracking skill, allowing the user to locate a target even across cities.", notes: ["Recommended to resolve to region or city awareness unless exact precision is intended later."] },
      { rank: 6, title: "Arrest Authority", durationDays: 5, rewardMode: "active", branch: "order", description: "Order branch: unlocks the Arrest skill, allowing capture and delivery of bounty targets to authorities for extra rewards." },
      { rank: 7, title: "High Value Pursuit", durationDays: 5, rewardMode: "unlock", branch: "order", description: "Order branch: grants access to high value bounty targets with significantly higher reward potential." },
      { rank: 8, title: "Judicial Dominion", durationDays: 5, rewardMode: "passive", branch: "order", description: "Order branch capstone: +10% better chance of tracking and arresting targets." },
      { rank: 4, title: "Shadowcraft Initiation", durationDays: 5, rewardMode: "mixed", branch: "shadow", description: "Shadow branch: academy-bound Shadowcraft progression begins here, unlocking higher-tier covert options and +5% success chance on shadow-aligned tasks." },
      { rank: 5, title: "Black Network Access", durationDays: 5, rewardMode: "unlock", branch: "shadow", description: "Shadow branch: unlocks Black Market access in any city, including illicit goods, contracts, and jobs." },
      { rank: 6, title: "Covert Operations", durationDays: 5, rewardMode: "unlock", branch: "shadow", description: "Shadow branch: unlocks covert tasks such as spying, infiltration, theft, and assassination work." },
      { rank: 7, title: "Contract Execution", durationDays: 5, rewardMode: "unlock", branch: "shadow", description: "Shadow branch: unlocks higher value covert contracts with greatly increased rewards." },
      { rank: 8, title: "Shadow Dominion", durationDays: 5, rewardMode: "passive", branch: "shadow", description: "Shadow branch capstone: +10% better chance of completing covert tasks successfully." },
    ],
  },
  {
    id: "nexis_professions",
    name: "Nexis Civic Academy",
    shortName: "Nexis Academy",
    theme: "Merchant, trade, crafts, knowledge, medicine, alchemy",
    roleIdentity: "Profession specialist / economic backbone / utility mastery",
    region: "Nexis City",
    locationName: "Nexis City",
    academyType: "always-active-professions",
    totalRanks: 8,
    durationPerRankDays: 5,
    totalDurationDays: 40,
    activationRules: [
      "Profession branches are always active once learned.",
      "They are not part of the one-active-academy switching system.",
      "They are intended to create long-term player interdependence and trade demand.",
      "Cross-academy synergy can later deepen recipes and specialist outcomes without forcing every player to become a crafter.",
    ],
    description:
      "The Nexis City profession school governs blacksmithing, artifice, historical knowledge, physician practice, alchemy, plus Business Studies and Adventuring/Survival studies that feed consortium and guild performance.",
    ranks: [
      { rank: 1, title: "Blacksmith", durationDays: 5, rewardMode: "unlock", description: "Unlocks physical weapon and armor crafting as a profession path.", notes: ["Forged equipment can later be enhanced through Northern magic systems."] },
      { rank: 2, title: "Artificer", durationDays: 5, rewardMode: "unlock", description: "Unlocks utility item and crafted device creation.", notes: ["Artificed items can later be enhanced or infused through Northern systems."] },
      { rank: 3, title: "Historian", durationDays: 5, rewardMode: "unlock", description: "Unlocks historical and archival expertise that can later reveal forbidden tomes of skills, spells, and crafting methods." },
      { rank: 4, title: "Physician", durationDays: 5, rewardMode: "mixed", description: "Unlocks physician training, allowing passive life and mana recovery support and the ability to use potion systems later.", notes: ["This does not replace Southern revive/resurrection identity."] },
      { rank: 5, title: "Alchemist", durationDays: 5, rewardMode: "unlock", description: "Unlocks potion and concoction crafting.", notes: ["Cross-academy knowledge later expands this into healing, mana, combat, stealth, and poison recipes."] },
      { rank: 6, title: "Business Studies", durationDays: 5, rewardMode: "mixed", description: "Consortium-facing studies in accounting, throughput, and operational planning that improve company yield, treasury discipline, and route efficiency." },
      { rank: 7, title: "Adventuring & Survival Studies", durationDays: 5, rewardMode: "mixed", description: "Guild-facing studies in expedition readiness, field survival doctrine, and coordinated operations that slightly improve guild performance." },
      { rank: 8, title: "Grandmaster of Civil Trades", durationDays: 5, rewardMode: "mixed", description: "Reserved capstone for advanced profession synergy and high-end civil profession authority." },
    ],
  },
];

export const academyLookup: Record<AcademyId, AcademyDefinition> = academyDefinitions.reduce(
  (acc, academy) => {
    acc[academy.id] = academy;
    return acc;
  },
  {} as Record<AcademyId, AcademyDefinition>
);
