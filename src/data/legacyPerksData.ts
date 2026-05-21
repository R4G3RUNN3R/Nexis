export type LegacyPerkCategory =
  | "Core Utility"
  | "Battle Stat Passives"
  | "Combat Utility"
  | "Economy / World"
  | "Weapon Masteries";

export type LegacyPerk = {
  id: string;
  category: LegacyPerkCategory;
  name: string;
  maxRank: number;
  baseEffect: number;
  effectUnit: "%" | "points" | "flat" | "multiplier";
  description: string;
  effectSummary: string;
  icon: string;
};

export const legacyPerks: LegacyPerk[] = [
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
] as LegacyPerk[];

export const legacyPerkCategories: LegacyPerkCategory[] = [
  "Core Utility",
  "Battle Stat Passives",
  "Combat Utility",
  "Economy / World",
  "Weapon Masteries"
] as LegacyPerkCategory[];

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
  if (effectUnit === "%") return String(total) + "%";
  if (effectUnit === "points") return String(total) + " points";
  if (effectUnit === "multiplier") return (1 + total).toFixed(2) + "x";
  return String(total);
}
