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
  "Education and future unlock systems will determine entry requirements later.",
  "Travel is not wired yet, so locations are currently design-locked but not mechanically enforced.",
];

export const academyDefinitions: AcademyDefinition[] = [
  {
    id: "southern",
    name: "Verdant Ancestral Circle",
    shortName: "Southern Academy",
    theme: "Healing, spirit arts, druidism, life and death",
    roleIdentity: "Healer / reviver / resurrection specialist",
    region: "South",
    locationName: "The Sacred Grove of Thalorin",
    academyType: "switch-based",
    totalRanks: 8,
    durationPerRankDays: 5,
    totalDurationDays: 40,
    activationRules: [
      "Can only be active if selected as the currently active academy.",
      "Switching to it requires travel to The Sacred Grove of Thalorin, gold cost, and 30-day cooldown.",
      "Revive and resurrection abilities are exclusive to this academy path.",
      "Ranks 7 and 8 require at least rank 1 of the Northern Academy to access mana use.",
    ],
    description:
      "The Southern Academy begins with practical herbal care and rises into full spiritual authority over healing, revival, and restoration.",
    ranks: [
      {
        rank: 1,
        title: "Herbal Remedies",
        durationDays: 5,
        rewardMode: "unlock",
        description:
          "Unlocks herb gathering and creation of herbal healing remedies that can also be sold to other players.",
        notes: ["No special requirement to use the crafted remedies, only to create them."],
      },
      {
        rank: 2,
        title: "Field Healing",
        durationDays: 5,
        rewardMode: "active",
        description:
          "Allows herbs found during travel, quests, jobs, or adventures to be used immediately for emergency treatment instead of being stored.",
        notes: [
          "Designed as active survival support during live content.",
          "Implementation should avoid absolute immunity to hospitalization.",
        ],
      },
      {
        rank: 3,
        title: "Vital Channeling",
        durationDays: 5,
        rewardMode: "passive",
        description:
          "Channels world life-force, granting a 5% bonus to healing-oriented spells, skills, and restorative effects.",
      },
      {
        rank: 4,
        title: "Spirit Binding",
        durationDays: 5,
        rewardMode: "mixed",
        description:
          "Forms a bond with a nature spirit companion that passively assists favorable outcomes in combat, healing, or item discovery.",
        notes: [
          "Initial suggested outcome bonus is 1%.",
          "Spirit potency can later scale through separate companion progression.",
        ],
      },
      {
        rank: 5,
        title: "Life Transfer",
        durationDays: 5,
        rewardMode: "active",
        description:
          "Sacrifices up to 50% of the user's current life to heal another player for double the sacrificed amount.",
        notes: ["24-hour cooldown.", "Healing equals life sacrificed × 2."],
      },
      {
        rank: 6,
        title: "Ancestral Restoration",
        durationDays: 5,
        rewardMode: "active",
        description:
          "Restores the user's life to full once every 24 hours through ancestral spiritual recovery.",
      },
      {
        rank: 7,
        title: "Revival Rite",
        durationDays: 5,
        rewardMode: "active",
        description: "Raises a hospitalized player to 1 life using spirit ritual power.",
        dependencies: ["Northern Academy rank 1: Arcane Fundamentals"],
        notes: [
          "15-minute cooldown.",
          "Consumes 50 energy and 50 mana.",
          "Cost reductions may exist later, but should never hit zero.",
        ],
      },
      {
        rank: 8,
        title: "Resurrection Doctrine",
        durationDays: 5,
        rewardMode: "active",
        description:
          "A higher mastery form of revival that restores a hospitalized target to full life.",
        dependencies: ["Northern Academy rank 1: Arcane Fundamentals"],
        notes: ["5-minute cooldown.", "Consumes 25 energy and 25 mana."],
      },
    ],
  },
  {
    id: "eastern",
    name: "Akai Tetsu War Dojo",
    shortName: "Eastern Academy",
    theme: "Combat mastery, katana discipline, battlefield tactics",
    roleIdentity: "Warrior / duelist / tactician",
    region: "East",
    locationName: "Akai Tetsu Citadel",
    academyType: "switch-based",
    totalRanks: 8,
    durationPerRankDays: 5,
    totalDurationDays: 40,
    activationRules: [
      "Can only be active if selected as the currently active academy.",
      "Switching to it requires travel to Akai Tetsu Citadel, gold cost, and 30-day cooldown.",
    ],
    description:
      "The Eastern Academy transforms disciplined combat study into battlefield superiority through precision, awareness, and doctrine.",
    ranks: [
      { rank: 1, title: "Combat Fundamentals", durationDays: 5, rewardMode: "passive", description: "Passive increase to all battle stats by 1%." },
      { rank: 2, title: "Blade Discipline", durationDays: 5, rewardMode: "passive", description: "Passive increase of damage with all bladed weapons by 5%." },
      { rank: 3, title: "Tactical Footwork", durationDays: 5, rewardMode: "passive", description: "Passive increase in accuracy and dodge by 5%." },
      { rank: 4, title: "Reaction Training", durationDays: 5, rewardMode: "passive", description: "Passive increase in accuracy and dodge by a further 5%, and increases awareness by 5." },
      { rank: 5, title: "Precision Technique", durationDays: 5, rewardMode: "passive", description: "Passive increase in accuracy by 5%." },
      { rank: 6, title: "Battlefield Awareness", durationDays: 5, rewardMode: "passive", description: "Passive increase in awareness by 15." },
      { rank: 7, title: "Weapon Mastery", durationDays: 5, rewardMode: "passive", description: "Passive damage increase with all weapons by 5%." },
      { rank: 8, title: "War Doctrine", durationDays: 5, rewardMode: "mixed", description: "Major capstone that grants +5% all battle stats, +5 awareness, and +10% dodge.", notes: ["Intended as the signature Eastern mastery payoff."] },
    ],
  },
  {
    id: "northern",
    name: "Silverbough Arcane Conservatory",
    shortName: "Northern Academy",
    theme: "Magic, enchanting, enhancement, arcane crafting",
    roleIdentity: "Mage-smith / enchanter / magical artisan",
    region: "North",
    locationName: "Silverbough Enclave",
    academyType: "switch-based",
    totalRanks: 8,
    durationPerRankDays: 5,
    totalDurationDays: 40,
    activationRules: [
      "Can only be active if selected as the currently active academy.",
      "Switching to it requires travel to Silverbough Enclave, gold cost, and 30-day cooldown.",
      "Northern rank 1 unlocks the mana bar and becomes a dependency for high-end Southern spiritual rites.",
    ],
    description:
      "The Northern Academy governs magical literacy, mana control, enchanting, artifact binding, and high-end relic creation.",
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
    name: "The Iron Writ & Veiled Ledger",
    shortName: "Western Academy",
    theme: "Law, order, bounty hunting, shadow networks, underworld contracts",
    roleIdentity: "Lawful enforcer or shadow broker",
    region: "West",
    locationName: "The Brass Court of Nexis West",
    academyType: "switch-based",
    totalRanks: 8,
    durationPerRankDays: 5,
    totalDurationDays: 40,
    activationRules: [
      "Can only be active if selected as the currently active academy.",
      "Switching to it requires travel to The Brass Court of Nexis West, gold cost, and 30-day cooldown.",
      "Branch selection occurs at rank 3 and should be treated as a committed path decision.",
    ],
    description:
      "The Western Academy governs both lawful power structures and the criminal intelligence world, splitting into Order or Shadow after a shared foundation.",
    ranks: [
      { rank: 1, title: "Civic Law and Shadow Codes", durationDays: 5, rewardMode: "passive", branch: null, description: "Knowledge of legal and criminal systems, granting +1% working stats and +1% battle stats." },
      { rank: 2, title: "Authority and Networks", durationDays: 5, rewardMode: "passive", branch: null, description: "Knowledge of how authority and shadow networks function in the West, granting +2% working stats and +2% battle stats." },
      { rank: 3, title: "Branch Selection", durationDays: 5, rewardMode: "branch", branch: null, description: "Locks the user's internal Western branch as either Order or Shadow and grants +3% working stats and +3% battle stats.", notes: ["Branch should be considered a committed progression decision."] },
      { rank: 4, title: "Enforcement Protocols", durationDays: 5, rewardMode: "mixed", branch: "order", description: "Order branch: +1% battle stats and +5% success chance on Order-aligned jobs and tasks." },
      { rank: 5, title: "Criminal Tracking", durationDays: 5, rewardMode: "unlock", branch: "order", description: "Order branch: unlocks the Tracking skill, allowing the user to locate a target even across cities.", notes: ["Recommended to resolve to region or city awareness unless exact precision is intended later."] },
      { rank: 6, title: "Arrest Authority", durationDays: 5, rewardMode: "active", branch: "order", description: "Order branch: unlocks the Arrest skill, allowing capture and delivery of bounty targets to authorities for extra rewards." },
      { rank: 7, title: "High Value Pursuit", durationDays: 5, rewardMode: "unlock", branch: "order", description: "Order branch: grants access to high value bounty targets with significantly higher reward potential." },
      { rank: 8, title: "Judicial Dominion", durationDays: 5, rewardMode: "passive", branch: "order", description: "Order branch capstone: +10% better chance of tracking and arresting targets." },
      { rank: 4, title: "Street Survival", durationDays: 5, rewardMode: "mixed", branch: "shadow", description: "Shadow branch: +1% battle stats and +5% success chance on Shadow-aligned jobs and tasks." },
      { rank: 5, title: "Black Network Access", durationDays: 5, rewardMode: "unlock", branch: "shadow", description: "Shadow branch: unlocks Black Market access in any city, including illicit goods, contracts, and jobs." },
      { rank: 6, title: "Covert Operations", durationDays: 5, rewardMode: "unlock", branch: "shadow", description: "Shadow branch: unlocks covert tasks such as spying, infiltration, theft, and assassination work." },
      { rank: 7, title: "Contract Execution", durationDays: 5, rewardMode: "unlock", branch: "shadow", description: "Shadow branch: unlocks higher value covert contracts with greatly increased rewards." },
      { rank: 8, title: "Shadow Dominion", durationDays: 5, rewardMode: "passive", branch: "shadow", description: "Shadow branch capstone: +10% better chance of completing covert tasks successfully." },
    ],
  },
  {
    id: "nexis_professions",
    name: "Guildhall of Civil Professions",
    shortName: "Nexis Academy",
    theme: "Merchant, trade, crafts, knowledge, medicine, alchemy",
    roleIdentity: "Profession specialist / economic backbone / utility mastery",
    region: "Nexis City",
    locationName: "The Grand Guildhall of Nexis",
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
      "The Nexis City profession school governs blacksmithing, artifice, historical knowledge, physician practice, alchemy, and future normal professions that support the economy and broader world systems.",
    ranks: [
      { rank: 1, title: "Blacksmith", durationDays: 5, rewardMode: "unlock", description: "Unlocks physical weapon and armor crafting as a profession path.", notes: ["Forged equipment can later be enhanced through Northern magic systems."] },
      { rank: 2, title: "Artificer", durationDays: 5, rewardMode: "unlock", description: "Unlocks utility item and crafted device creation.", notes: ["Artificed items can later be enhanced or infused through Northern systems."] },
      { rank: 3, title: "Historian", durationDays: 5, rewardMode: "unlock", description: "Unlocks historical and archival expertise that can later reveal forbidden tomes of skills, spells, and crafting methods." },
      { rank: 4, title: "Physician", durationDays: 5, rewardMode: "mixed", description: "Unlocks physician training, allowing passive life and mana recovery support and the ability to use potion systems later.", notes: ["This does not replace Southern revive/resurrection identity."] },
      { rank: 5, title: "Alchemist", durationDays: 5, rewardMode: "unlock", description: "Unlocks potion and concoction crafting.", notes: ["Cross-academy knowledge later expands this into healing, mana, combat, stealth, and poison recipes."] },
      { rank: 6, title: "Merchant Ledgercraft", durationDays: 5, rewardMode: "tbd", description: "Reserved profession slot for advanced mercantile record-keeping, commercial efficiencies, and trade optimization." },
      { rank: 7, title: "Master Quartermaster", durationDays: 5, rewardMode: "tbd", description: "Reserved profession slot for logistics, supply management, and inventory optimization systems." },
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
