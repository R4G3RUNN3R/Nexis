export type LegacyPerkCategory =
  | "Utility"
  | "Battle Stats"
  | "Combat Utility"
  | "Economy & World"
  | "Weapon Masteries";

export type LegacyPerk = {
  id: string;
  category: LegacyPerkCategory;
  name: string;
  maxRank: number;
  baseEffect: number;
  effectUnit: "%" | "points" | "flat" | "multiplier";
  description: string;
  icon: string;
};

export const legacyPerks: LegacyPerk[] = [
  {
    id: "nerve-bar",
    category: "Utility",
    name: "Nerve Bar",
    maxRank: 10,
    baseEffect: 10,
    effectUnit: "points",
    description: "Increases maximum nerve bar.",
    icon: "✳",
  },
  {
    id: "critical-hit-rate",
    category: "Combat Utility",
    name: "Critical Hit Rate",
    maxRank: 10,
    baseEffect: 0.5,
    effectUnit: "%",
    description: "Increases critical hit rate.",
    icon: "◉",
  },
  {
    id: "life-points",
    category: "Utility",
    name: "Life Points",
    maxRank: 10,
    baseEffect: 5,
    effectUnit: "%",
    description: "Increases maximum life.",
    icon: "♥",
  },
  {
    id: "education-length",
    category: "Utility",
    name: "Education Length",
    maxRank: 10,
    baseEffect: 2,
    effectUnit: "%",
    description: "Decreases education course length.",
    icon: "✦",
  },
  {
    id: "awareness",
    category: "Utility",
    name: "Awareness",
    maxRank: 10,
    baseEffect: 4,
    effectUnit: "%",
    description: "Increases hidden item appearance and improves anti-stealth perception.",
    icon: "◐",
  },
  {
    id: "bank-interest",
    category: "Economy & World",
    name: "Bank Interest",
    maxRank: 10,
    baseEffect: 2,
    effectUnit: "%",
    description: "Increases bank interest returns.",
    icon: "¤",
  },
  {
    id: "masterful-looting",
    category: "Economy & World",
    name: "Masterful Looting",
    maxRank: 10,
    baseEffect: 2.5,
    effectUnit: "%",
    description: "Increases money and materials gained from muggings, encounters, and ruins.",
    icon: "⬢",
  },
  {
    id: "stealth",
    category: "Combat Utility",
    name: "Stealth",
    maxRank: 10,
    baseEffect: 0.12,
    effectUnit: "multiplier",
    description: "Increases stealth during outgoing attacks and covert actions.",
    icon: "◌",
  },
  {
    id: "hospitalizing",
    category: "Combat Utility",
    name: "Hospitalizing",
    maxRank: 10,
    baseEffect: 3,
    effectUnit: "%",
    description: "Increases time enemies remain hospitalized.",
    icon: "✚",
  },
  {
    id: "employee-effectiveness",
    category: "Utility",
    name: "Employee Effectiveness",
    maxRank: 10,
    baseEffect: 3,
    effectUnit: "%",
    description: "Increases consortium employee effectiveness.",
    icon: "⌂",
  },
  {
    id: "brawn",
    category: "Battle Stats",
    name: "Brawn",
    maxRank: 10,
    baseEffect: 3,
    effectUnit: "%",
    description: "Passive bonus to strength.",
    icon: "⚔",
  },
  {
    id: "protection",
    category: "Battle Stats",
    name: "Protection",
    maxRank: 10,
    baseEffect: 3,
    effectUnit: "%",
    description: "Passive bonus to defense.",
    icon: "🛡",
  },
  {
    id: "sharpness",
    category: "Battle Stats",
    name: "Sharpness",
    maxRank: 10,
    baseEffect: 3,
    effectUnit: "%",
    description: "Passive bonus to speed.",
    icon: "➤",
  },
  {
    id: "evasion",
    category: "Battle Stats",
    name: "Evasion",
    maxRank: 10,
    baseEffect: 3,
    effectUnit: "%",
    description: "Passive bonus to dexterity.",
    icon: "✧",
  },
  {
    id: "heavy-artillery-mastery",
    category: "Weapon Masteries",
    name: "Heavy Artillery Mastery",
    maxRank: 10,
    baseEffect: 1,
    effectUnit: "%",
    description: "Increases damage and accuracy with heavy artillery.",
    icon: "✹",
  },
  {
    id: "machine-gun-mastery",
    category: "Weapon Masteries",
    name: "Machine Gun Mastery",
    maxRank: 10,
    baseEffect: 1,
    effectUnit: "%",
    description: "Increases damage and accuracy with machine guns.",
    icon: "✹",
  },
  {
    id: "rifle-mastery",
    category: "Weapon Masteries",
    name: "Rifle Mastery",
    maxRank: 10,
    baseEffect: 1,
    effectUnit: "%",
    description: "Increases damage and accuracy with rifles.",
    icon: "✹",
  },
  {
    id: "smg-mastery",
    category: "Weapon Masteries",
    name: "SMG Mastery",
    maxRank: 10,
    baseEffect: 1,
    effectUnit: "%",
    description: "Increases damage and accuracy with SMGs.",
    icon: "✹",
  },
  {
    id: "shotgun-mastery",
    category: "Weapon Masteries",
    name: "Shotgun Mastery",
    maxRank: 10,
    baseEffect: 1,
    effectUnit: "%",
    description: "Increases damage and accuracy with shotguns.",
    icon: "✹",
  },
  {
    id: "pistol-mastery",
    category: "Weapon Masteries",
    name: "Pistol Mastery",
    maxRank: 10,
    baseEffect: 1,
    effectUnit: "%",
    description: "Increases damage and accuracy with pistols.",
    icon: "✹",
  },
  {
    id: "club-mastery",
    category: "Weapon Masteries",
    name: "Club Mastery",
    maxRank: 10,
    baseEffect: 1,
    effectUnit: "%",
    description: "Increases damage and accuracy with clubbing weapons.",
    icon: "✹",
  },
  {
    id: "piercing-mastery",
    category: "Weapon Masteries",
    name: "Piercing Mastery",
    maxRank: 10,
    baseEffect: 1,
    effectUnit: "%",
    description: "Increases damage and accuracy with piercing weapons.",
    icon: "✹",
  },
  {
    id: "slashing-mastery",
    category: "Weapon Masteries",
    name: "Slashing Mastery",
    maxRank: 10,
    baseEffect: 1,
    effectUnit: "%",
    description: "Increases damage and accuracy with slashing weapons.",
    icon: "✹",
  },
  {
    id: "mechanical-mastery",
    category: "Weapon Masteries",
    name: "Mechanical Mastery",
    maxRank: 10,
    baseEffect: 1,
    effectUnit: "%",
    description: "Increases damage and accuracy with mechanical weapons.",
    icon: "✹",
  },
  {
    id: "temporary-mastery",
    category: "Weapon Masteries",
    name: "Temporary Mastery",
    maxRank: 10,
    baseEffect: 1,
    effectUnit: "%",
    description: "Increases damage and accuracy with temporary weapons.",
    icon: "✹",
  },
];

export const legacyPerkCategories: LegacyPerkCategory[] = [
  "Utility",
  "Battle Stats",
  "Combat Utility",
  "Economy & World",
  "Weapon Masteries",
];

export function getCumulativeLegacyCost(rank: number) {
  return (rank * (rank + 1)) / 2;
}

export function getLegacyRankCost(nextRank: number) {
  return nextRank;
}

export function getPerkEffectText(
  baseEffect: number,
  effectUnit: "%" | "points" | "flat" | "multiplier",
  rank: number
) {
  const total = baseEffect * rank;

  if (effectUnit === "%") {
    return `${total}%`;
  }

  if (effectUnit === "points") {
    return `${total} points`;
  }

  if (effectUnit === "multiplier") {
    return `${(1 + total).toFixed(2)}x`;
  }

  return `${total}`;
}
