export type TitleBonusCategory =
  | "travel_speed"
  | "education_speed"
  | "max_hp"
  | "inventory_efficiency"
  | "civic_reputation_gain"
  | "recovery_speed"
  | "job_efficiency"
  | "raid_reward_quality"
  | "comfort_cap"
  | "special";

export type TitleUnlockMetric =
  | "travels_completed"
  | "books_read"
  | "defensive_attacks_received"
  | "recovery_items_used"
  | "job_days_worked"
  | "raid_attendances"
  | "inventory_movements"
  | "civic_reputation"
  | "special_assignment";

export interface TitleBonus {
  category: TitleBonusCategory;
  value: number;
  unit: "percent" | "flat" | "special";
  description: string;
}

export interface TitleRequirement {
  metric: TitleUnlockMetric;
  threshold: number;
  description: string;
}

export interface PlayerTitleDefinition {
  id: string;
  familyId: string;
  name: string;
  rank: number;
  unique?: boolean;
  adminOnly?: boolean;
  npcOnly?: boolean;
  flavor: string;
  requirement: TitleRequirement;
  bonuses: TitleBonus[];
}

export interface TitleProgressState {
  titleId: string;
  unlocked: boolean;
  unlockedAt?: string;
}

export interface PlayerTitleStats {
  travelsCompleted: number;
  booksRead: number;
  defensiveAttacksReceived: number;
  recoveryItemsUsed: number;
  jobDaysWorked: number;
  raidAttendances: number;
  inventoryMovements: number;
  civicReputation: number;
  specialAssignments?: string[];
}

export const PLAYER_TITLE_DEFINITIONS: PlayerTitleDefinition[] = [
  {
    id: "wayfarer_i",
    familyId: "wayfarer",
    name: "Wayfarer",
    rank: 1,
    flavor: "You have worn the road enough times that distance starts to fear you.",
    requirement: {
      metric: "travels_completed",
      threshold: 500,
      description: "Complete 500 journeys.",
    },
    bonuses: [
      {
        category: "travel_speed",
        value: 3,
        unit: "percent",
        description: "+3% travel speed",
      },
    ],
  },
  {
    id: "wayfarer_ii",
    familyId: "wayfarer",
    name: "Farstrider",
    rank: 2,
    flavor: "Roads stop being obstacles and start becoming habits.",
    requirement: {
      metric: "travels_completed",
      threshold: 1000,
      description: "Complete 1,000 journeys.",
    },
    bonuses: [
      {
        category: "travel_speed",
        value: 5,
        unit: "percent",
        description: "+5% travel speed",
      },
    ],
  },
  {
    id: "bookbound_i",
    familyId: "bookbound",
    name: "Bookbound",
    rank: 1,
    flavor: "Your life is now measured in pages, margins, and bad posture.",
    requirement: {
      metric: "books_read",
      threshold: 25,
      description: "Read 25 books.",
    },
    bonuses: [
      {
        category: "education_speed",
        value: 3,
        unit: "percent",
        description: "+3% education speed",
      },
    ],
  },
  {
    id: "bookbound_ii",
    familyId: "bookbound",
    name: "Lorebound",
    rank: 2,
    flavor: "You stopped reading books and started devouring them.",
    requirement: {
      metric: "books_read",
      threshold: 50,
      description: "Read 50 books.",
    },
    bonuses: [
      {
        category: "education_speed",
        value: 5,
        unit: "percent",
        description: "+5% education speed",
      },
    ],
  },
  {
    id: "steadfast_i",
    familyId: "steadfast",
    name: "Steadfast",
    rank: 1,
    flavor: "The world has hit you often enough that your body filed a complaint and adapted.",
    requirement: {
      metric: "defensive_attacks_received",
      threshold: 5000,
      description: "Receive 5,000 qualifying attacks.",
    },
    bonuses: [
      {
        category: "max_hp",
        value: 100,
        unit: "flat",
        description: "+100 maximum HP",
      },
    ],
  },
  {
    id: "steadfast_ii",
    familyId: "steadfast",
    name: "Unyielding",
    rank: 2,
    flavor: "At this point, stubbornness has become a medical condition.",
    requirement: {
      metric: "defensive_attacks_received",
      threshold: 10000,
      description: "Receive 10,000 qualifying attacks.",
    },
    bonuses: [
      {
        category: "max_hp",
        value: 250,
        unit: "flat",
        description: "+250 maximum HP",
      },
    ],
  },
  {
    id: "field_medic_i",
    familyId: "field_medic",
    name: "Field Medic",
    rank: 1,
    flavor: "You have consumed enough healing supplies to become a walking cautionary tale.",
    requirement: {
      metric: "recovery_items_used",
      threshold: 100,
      description: "Use 100 potions or HP recovery items.",
    },
    bonuses: [
      {
        category: "recovery_speed",
        value: 2,
        unit: "percent",
        description: "+2% recovery speed",
      },
    ],
  },
  {
    id: "tradesman_i",
    familyId: "tradesman",
    name: "Tradesman",
    rank: 1,
    flavor: "Turns out showing up repeatedly is a skill. Annoying, but true.",
    requirement: {
      metric: "job_days_worked",
      threshold: 100,
      description: "Work 100 civic job days.",
    },
    bonuses: [
      {
        category: "job_efficiency",
        value: 3,
        unit: "percent",
        description: "+3% civic job efficiency",
      },
    ],
  },
  {
    id: "dungeon_blooded_i",
    familyId: "dungeon_blooded",
    name: "Dungeon-Blooded",
    rank: 1,
    flavor: "You are far too comfortable in places designed to kill people.",
    requirement: {
      metric: "raid_attendances",
      threshold: 100,
      description: "Attend 100 raids or dungeon runs.",
    },
    bonuses: [
      {
        category: "raid_reward_quality",
        value: 2,
        unit: "percent",
        description: "+2% raid reward quality",
      },
    ],
  },
  {
    id: "quartermaster_i",
    familyId: "quartermaster",
    name: "Quartermaster",
    rank: 1,
    flavor: "You know where everything is, even when nobody else deserves that information.",
    requirement: {
      metric: "inventory_movements",
      threshold: 2500,
      description: "Complete 2,500 inventory or storage item movements.",
    },
    bonuses: [
      {
        category: "inventory_efficiency",
        value: 3,
        unit: "percent",
        description: "+3% inventory capacity efficiency",
      },
    ],
  },
  {
    id: "well_regarded_i",
    familyId: "well_regarded",
    name: "Well-Regarded",
    rank: 1,
    flavor: "Citizens tolerate you with unusual enthusiasm. Suspicious, really.",
    requirement: {
      metric: "civic_reputation",
      threshold: 500,
      description: "Reach 500 civic reputation.",
    },
    bonuses: [
      {
        category: "civic_reputation_gain",
        value: 3,
        unit: "percent",
        description: "+3% civic reputation gain",
      },
    ],
  },
  {
    id: "the_absolute",
    familyId: "the_absolute",
    name: "The Absolute",
    rank: 1,
    unique: true,
    adminOnly: true,
    npcOnly: true,
    flavor: "A title that should not exist for normal characters, which is exactly why it does.",
    requirement: {
      metric: "special_assignment",
      threshold: 1,
      description: "Special assignment only. Not available through normal play.",
    },
    bonuses: [
      {
        category: "max_hp",
        value: 5000,
        unit: "flat",
        description: "+5000 maximum HP",
      },
      {
        category: "special",
        value: 1000,
        unit: "flat",
        description: "+1000 Energy",
      },
      {
        category: "special",
        value: 500,
        unit: "flat",
        description: "+500 Stamina",
      },
      {
        category: "comfort_cap",
        value: 5000,
        unit: "flat",
        description: "+5000 Comfort",
      },
      {
        category: "education_speed",
        value: 100,
        unit: "percent",
        description: "100% education time reduction",
      },
    ],
  },
];

export const TITLE_FAMILY_ORDER = [
  "wayfarer",
  "bookbound",
  "steadfast",
  "field_medic",
  "tradesman",
  "dungeon_blooded",
  "quartermaster",
  "well_regarded",
  "the_absolute",
] as const;
