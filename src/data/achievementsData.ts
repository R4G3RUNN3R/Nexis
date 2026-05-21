export type AchievementKind = "honor" | "medal";

export type AchievementCategory =
  | "Attacking / Combat"
  | "Weapons"
  | "Education"
  | "Travel"
  | "Exploration / Discoveries"
  | "Economy / Market"
  | "Items / Crafting"
  | "Guild / Consortium"
  | "Contracts / Quests / Adventures"
  | "Commitment / Time"
  | "Miscellaneous";

export type Achievement = {
  id: string;
  kind: AchievementKind;
  category: AchievementCategory;
  name: string;
  description: string;
  progress: number;
  target: number;
  completedOn?: string;
  rewardPoints: number;
};

const definitions = [
  {
    "id": "acct-001",
    "kind": "honor",
    "category": "Commitment / Time",
    "name": "First Footing",
    "description": "Register a Nexis citizen profile.",
    "target": 1,
    "rewardPoints": 1
  },
  {
    "id": "time-001",
    "kind": "medal",
    "category": "Commitment / Time",
    "name": "Seven Day Citizen",
    "description": "Keep a Nexis account for seven days.",
    "target": 7,
    "rewardPoints": 1
  },
  {
    "id": "time-002",
    "kind": "medal",
    "category": "Commitment / Time",
    "name": "Thirty Day Citizen",
    "description": "Keep a Nexis account for thirty days.",
    "target": 30,
    "rewardPoints": 1
  },
  {
    "id": "edu-001",
    "kind": "honor",
    "category": "Education",
    "name": "First Lesson",
    "description": "Start an education course.",
    "target": 1,
    "rewardPoints": 1
  },
  {
    "id": "edu-002",
    "kind": "honor",
    "category": "Education",
    "name": "Course Complete",
    "description": "Complete one education course.",
    "target": 1,
    "rewardPoints": 1
  },
  {
    "id": "edu-003",
    "kind": "medal",
    "category": "Education",
    "name": "Foundation Scholar",
    "description": "Complete five education courses.",
    "target": 5,
    "rewardPoints": 1
  },
  {
    "id": "edu-004",
    "kind": "medal",
    "category": "Education",
    "name": "Faculty Regular",
    "description": "Complete fifteen education courses.",
    "target": 15,
    "rewardPoints": 1
  },
  {
    "id": "trv-001",
    "kind": "honor",
    "category": "Travel",
    "name": "Road Dust",
    "description": "Begin travel to another city.",
    "target": 1,
    "rewardPoints": 1
  },
  {
    "id": "trv-002",
    "kind": "medal",
    "category": "Travel",
    "name": "Route Regular",
    "description": "Resolve ten journeys or travel arrivals.",
    "target": 10,
    "rewardPoints": 1
  },
  {
    "id": "exp-001",
    "kind": "honor",
    "category": "Exploration / Discoveries",
    "name": "Marked the Map",
    "description": "Record one travel discovery or hidden-site lead.",
    "target": 1,
    "rewardPoints": 1
  },
  {
    "id": "exp-002",
    "kind": "medal",
    "category": "Exploration / Discoveries",
    "name": "Hidden Site Finder",
    "description": "Discover or explore three hidden sites.",
    "target": 3,
    "rewardPoints": 1
  },
  {
    "id": "eco-001",
    "kind": "honor",
    "category": "Economy / Market",
    "name": "Purse Keeper",
    "description": "Hold at least 1,000 gold.",
    "target": 1000,
    "rewardPoints": 1
  },
  {
    "id": "eco-002",
    "kind": "honor",
    "category": "Economy / Market",
    "name": "Market Caller",
    "description": "Create one player-market listing.",
    "target": 1,
    "rewardPoints": 1
  },
  {
    "id": "eco-003",
    "kind": "medal",
    "category": "Economy / Market",
    "name": "Trade Hand",
    "description": "Complete five marketplace buys or sales.",
    "target": 5,
    "rewardPoints": 1
  },
  {
    "id": "itm-001",
    "kind": "honor",
    "category": "Items / Crafting",
    "name": "First Make",
    "description": "Craft one item.",
    "target": 1,
    "rewardPoints": 1
  },
  {
    "id": "itm-002",
    "kind": "honor",
    "category": "Items / Crafting",
    "name": "Useful Wreckage",
    "description": "Salvage one item.",
    "target": 1,
    "rewardPoints": 1
  },
  {
    "id": "itm-003",
    "kind": "medal",
    "category": "Items / Crafting",
    "name": "Bench Regular",
    "description": "Craft ten items.",
    "target": 10,
    "rewardPoints": 1
  },
  {
    "id": "cmb-001",
    "kind": "honor",
    "category": "Attacking / Combat",
    "name": "First Bout",
    "description": "Resolve one combat encounter.",
    "target": 1,
    "rewardPoints": 1
  },
  {
    "id": "cmb-002",
    "kind": "medal",
    "category": "Attacking / Combat",
    "name": "Ten Hard Lessons",
    "description": "Resolve ten combat encounters.",
    "target": 10,
    "rewardPoints": 1
  },
  {
    "id": "wpn-001",
    "kind": "honor",
    "category": "Weapons",
    "name": "Armed Properly",
    "description": "Equip a weapon or resolve a weapon-based combat action.",
    "target": 1,
    "rewardPoints": 1
  },
  {
    "id": "wpn-002",
    "kind": "medal",
    "category": "Weapons",
    "name": "Typed Threat",
    "description": "Resolve twenty weapon activations in real fights.",
    "target": 20,
    "rewardPoints": 1
  },
  {
    "id": "adv-001",
    "kind": "honor",
    "category": "Contracts / Quests / Adventures",
    "name": "Posted Work",
    "description": "Complete one contract or adventure.",
    "target": 1,
    "rewardPoints": 1
  },
  {
    "id": "adv-002",
    "kind": "medal",
    "category": "Contracts / Quests / Adventures",
    "name": "Expedition Habit",
    "description": "Complete five adventures or expeditions.",
    "target": 5,
    "rewardPoints": 1
  },
  {
    "id": "adv-003",
    "kind": "honor",
    "category": "Contracts / Quests / Adventures",
    "name": "Elite Notice",
    "description": "Win one elite hunt.",
    "target": 1,
    "rewardPoints": 1
  },
  {
    "id": "org-001",
    "kind": "honor",
    "category": "Guild / Consortium",
    "name": "Organized",
    "description": "Join or lead a guild or consortium.",
    "target": 1,
    "rewardPoints": 1
  },
  {
    "id": "org-002",
    "kind": "medal",
    "category": "Guild / Consortium",
    "name": "Assistance Ledger",
    "description": "Resolve three guild or consortium assistance actions.",
    "target": 3,
    "rewardPoints": 1
  },
  {
    "id": "skl-001",
    "kind": "honor",
    "category": "Miscellaneous",
    "name": "Practiced Hand",
    "description": "Unlock a real gameplay skill.",
    "target": 1,
    "rewardPoints": 1
  },
  {
    "id": "skl-002",
    "kind": "honor",
    "category": "Miscellaneous",
    "name": "Evolution, Not Decoration",
    "description": "Evolve a skill through use.",
    "target": 1,
    "rewardPoints": 1
  }
] as const;

export const achievements: Achievement[] = definitions.map((achievement) => ({
  ...achievement,
  progress: 0,
}));

export const achievementCategories: AchievementCategory[] = [
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
] as AchievementCategory[];
