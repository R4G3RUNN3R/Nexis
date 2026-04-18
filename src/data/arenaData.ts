// ─────────────────────────────────────────────────────────────────────────────
// Nexis — Arena Data
// 4 progressive training tiers. Each must be maxed to unlock the next.
// All 4 battle stats trainable at every tier; each tier specialises in 1-2
// stats that receive a bonus gain multiplier.
// ─────────────────────────────────────────────────────────────────────────────

export type BattleStat = "strength" | "defense" | "speed" | "dexterity";

export type ArenaTier = {
  id: string;
  name: string;
  subtitle: string;
  description: string;
  flavour: string;
  energyCost: number;       // energy spent per training action
  totalToMax: number;       // total training sessions to fully max this tier
  specialtyStats: BattleStat[];   // these stats get bonus gains here
  bonusMultiplier: number;  // e.g. 1.5 = 50% more gain for specialty stats
  baseGainPerSession: number;     // base stat points per session (non-specialty)
  unlockRequirement: string | null;  // null = always open
};

export const arenaTiers: ArenaTier[] = [
  {
    id: "brawlers-pit",
    name: "Brawler's Pit",
    subtitle: "Tier I",
    description: "A rough outdoor ring where fighters learn the fundamentals of combat.",
    flavour:
      "Sawdust floor, rope barriers, and the smell of sweat. This is where every fighter starts. The technique is crude but the lessons are permanent.",
    energyCost: 1,
    totalToMax: 1_000,
    specialtyStats: ["strength", "defense"],
    bonusMultiplier: 1.5,
    baseGainPerSession: 1,
    unlockRequirement: null,
  },
  {
    id: "combat-yard",
    name: "Combat Yard",
    subtitle: "Tier II",
    description: "A structured training yard that focuses on speed and precision movement.",
    flavour:
      "Wooden posts, weighted bars, and drills designed to push your reaction time. Speed is survival. Dexterity is the difference between a glancing blow and a clean hit.",
    energyCost: 3,
    totalToMax: 3_000,
    specialtyStats: ["speed", "dexterity"],
    bonusMultiplier: 1.5,
    baseGainPerSession: 2,
    unlockRequirement: "brawlers-pit",
  },
  {
    id: "war-academy",
    name: "War Academy",
    subtitle: "Tier III",
    description: "A formal military training hall. Serious fighters only.",
    flavour:
      "Iron discipline, sparring with ranked opponents, and techniques passed down through city guard lineages. The War Academy doesn't tolerate amateurs. You'll either improve or leave with bruises.",
    energyCost: 5,
    totalToMax: 5_000,
    specialtyStats: ["defense", "strength"],
    bonusMultiplier: 1.6,
    baseGainPerSession: 3,
    unlockRequirement: "combat-yard",
  },
  {
    id: "champions-crucible",
    name: "Champion's Crucible",
    subtitle: "Tier IV",
    description: "The pinnacle of physical training in Nexis. Reserved for those who have proven themselves.",
    flavour:
      "Elite equipment, master-level coaches, and opponents who will genuinely try to hurt you. Every session here is worth weeks of ordinary training. All four stats improve — significantly.",
    energyCost: 10,
    totalToMax: 10_000,
    specialtyStats: ["strength", "defense", "speed", "dexterity"],
    bonusMultiplier: 2.0,
    baseGainPerSession: 5,
    unlockRequirement: "war-academy",
  },
];

export function getArenaTier(id: string): ArenaTier | undefined {
  return arenaTiers.find((t) => t.id === id);
}

/** Returns the index of the first tier not yet maxed, or -1 if all maxed */
export function getActiveTierIndex(sessions: Record<string, number>): number {
  for (let i = 0; i < arenaTiers.length; i++) {
    const tier = arenaTiers[i];
    if ((sessions[tier.id] ?? 0) < tier.totalToMax) return i;
  }
  return -1; // all maxed
}
