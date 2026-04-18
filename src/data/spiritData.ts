// ─────────────────────────────────────────────────────────────────────────────
// spiritData.ts
// Nexis Browser RPG — Spirit binding system data
// Unlocked via Southern Academy Rank 4 (Spirit Binding)
// ─────────────────────────────────────────────────────────────────────────────

export type SpiritElement = "fire" | "wind" | "water" | "earth";
export type SpiritTier = "low" | "medium" | "high";

export type SpiritBonus = {
  stat: string;
  description: string;
  valueAtCap: number; // percentage
};

export type Spirit = {
  id: string;
  element: SpiritElement;
  tier: SpiritTier;
  name: string;
  description: string;
  capPercent: number; // 3 for low, 5 for medium, 10 for high
  bonuses: SpiritBonus[];
  combatDamageBonus: number; // always 0.01 (1% of player damage)
  switchCooldownHours: 12;
  color: string; // CSS color for UI
  icon: string; // emoji or symbol
};

// ─────────────────────────────────────────────────────────────────────────────
// FIRE spirits — attack damage bonus + 1% combat damage
// ─────────────────────────────────────────────────────────────────────────────

const emberWisp: Spirit = {
  id: "fire_low",
  element: "fire",
  tier: "low",
  name: "Ember Wisp",
  description:
    "A faint cinder-spirit that flickers at the edge of battle, amplifying the heat of every strike. Grows stronger as the bond deepens.",
  capPercent: 3,
  bonuses: [
    {
      stat: "attackDamage",
      description: "+% to all attack damage",
      valueAtCap: 3,
    },
  ],
  combatDamageBonus: 0.01,
  switchCooldownHours: 12,
  color: "#e85d04",
  icon: "🔥",
};

const flameSprite: Spirit = {
  id: "fire_medium",
  element: "fire",
  tier: "medium",
  name: "Flame Sprite",
  description:
    "A dancing fire-sprite born from the heart of a forge. It wraps itself around the wielder's weapon, searing enemies on contact.",
  capPercent: 5,
  bonuses: [
    {
      stat: "attackDamage",
      description: "+% to all attack damage",
      valueAtCap: 5,
    },
  ],
  combatDamageBonus: 0.01,
  switchCooldownHours: 12,
  color: "#e85d04",
  icon: "🔥",
};

const infernoAncient: Spirit = {
  id: "fire_high",
  element: "fire",
  tier: "high",
  name: "Inferno Ancient",
  description:
    "A primordial fire titan whose essence has burned since the first age. Its bond transforms the bearer into a living weapon of destruction.",
  capPercent: 10,
  bonuses: [
    {
      stat: "attackDamage",
      description: "+% to all attack damage",
      valueAtCap: 10,
    },
  ],
  combatDamageBonus: 0.01,
  switchCooldownHours: 12,
  color: "#e85d04",
  icon: "🔥",
};

// ─────────────────────────────────────────────────────────────────────────────
// WIND spirits — evasion/dodge bonus
// ─────────────────────────────────────────────────────────────────────────────

const driftBreeze: Spirit = {
  id: "wind_low",
  element: "wind",
  tier: "low",
  name: "Drift Breeze",
  description:
    "A gentle zephyr-spirit that slips around the bearer, making them slightly harder to strike in battle.",
  capPercent: 3,
  bonuses: [
    {
      stat: "evasion",
      description: "+% to all evasion, avoidance, and dodge",
      valueAtCap: 3,
    },
  ],
  combatDamageBonus: 0.01,
  switchCooldownHours: 12,
  color: "#a3cfef",
  icon: "💨",
};

const galeRunner: Spirit = {
  id: "wind_medium",
  element: "wind",
  tier: "medium",
  name: "Gale Runner",
  description:
    "A swift wind-spirit that once raced storm clouds across the open sky. It gifts its bearer fleet-footed instincts and uncanny reflexes.",
  capPercent: 5,
  bonuses: [
    {
      stat: "evasion",
      description: "+% to all evasion, avoidance, and dodge",
      valueAtCap: 5,
    },
  ],
  combatDamageBonus: 0.01,
  switchCooldownHours: 12,
  color: "#a3cfef",
  icon: "💨",
};

const tempestSovereign: Spirit = {
  id: "wind_high",
  element: "wind",
  tier: "high",
  name: "Tempest Sovereign",
  description:
    "An ancient storm-lord bound to this world in the form of living wind. Those it chooses move like the eye of a hurricane — untouchable, ever-shifting.",
  capPercent: 10,
  bonuses: [
    {
      stat: "evasion",
      description: "+% to all evasion, avoidance, and dodge",
      valueAtCap: 10,
    },
  ],
  combatDamageBonus: 0.01,
  switchCooldownHours: 12,
  color: "#a3cfef",
  icon: "💨",
};

// ─────────────────────────────────────────────────────────────────────────────
// WATER spirits — magic/spell/skill effectiveness bonus
// ─────────────────────────────────────────────────────────────────────────────

const rippleFae: Spirit = {
  id: "water_low",
  element: "water",
  tier: "low",
  name: "Ripple Fae",
  description:
    "A minor water-spirit from a forest spring. Its presence sharpens the resonance of spells and skills, amplifying their effect.",
  capPercent: 3,
  bonuses: [
    {
      stat: "magicEffectiveness",
      description: "+% to all magic, spell, and skill effectiveness",
      valueAtCap: 3,
    },
  ],
  combatDamageBonus: 0.01,
  switchCooldownHours: 12,
  color: "#4cc9f0",
  icon: "💧",
};

const tidalSage: Spirit = {
  id: "water_medium",
  element: "water",
  tier: "medium",
  name: "Tidal Sage",
  description:
    "A thoughtful ocean-spirit steeped in the rhythms of the sea. It channels arcane currents through the bearer, magnifying every cast.",
  capPercent: 5,
  bonuses: [
    {
      stat: "magicEffectiveness",
      description: "+% to all magic, spell, and skill effectiveness",
      valueAtCap: 5,
    },
  ],
  combatDamageBonus: 0.01,
  switchCooldownHours: 12,
  color: "#4cc9f0",
  icon: "💧",
};

const abyssalOracle: Spirit = {
  id: "water_high",
  element: "water",
  tier: "high",
  name: "Abyssal Oracle",
  description:
    "A deep-sea leviathan intelligence, impossibly ancient. Its bond grants mastery over every magical art, turning spells and skills into overwhelming force.",
  capPercent: 10,
  bonuses: [
    {
      stat: "magicEffectiveness",
      description: "+% to all magic, spell, and skill effectiveness",
      valueAtCap: 10,
    },
  ],
  combatDamageBonus: 0.01,
  switchCooldownHours: 12,
  color: "#4cc9f0",
  icon: "💧",
};

// ─────────────────────────────────────────────────────────────────────────────
// EARTH spirits — defense bonus + crafting skill bonus
// ─────────────────────────────────────────────────────────────────────────────

const mossCrawler: Spirit = {
  id: "earth_low",
  element: "earth",
  tier: "low",
  name: "Moss Crawler",
  description:
    "A sluggish earth-spirit found beneath ancient stones. Its slow, steady nature reinforces the bearer's defenses and lends patience to their craft.",
  capPercent: 3,
  bonuses: [
    {
      stat: "defense",
      description: "+% to all defense",
      valueAtCap: 3,
    },
    {
      stat: "craftingSuccess",
      description: "+% to all crafting skill success rates",
      valueAtCap: 3,
    },
  ],
  combatDamageBonus: 0.01,
  switchCooldownHours: 12,
  color: "#6a994e",
  icon: "🪨",
};

const graniteGuardian: Spirit = {
  id: "earth_medium",
  element: "earth",
  tier: "medium",
  name: "Granite Guardian",
  description:
    "A mountain-born spirit formed from centuries of geological pressure. It fortifies the bearer like living stone and steadies their hands at the forge.",
  capPercent: 5,
  bonuses: [
    {
      stat: "defense",
      description: "+% to all defense",
      valueAtCap: 5,
    },
    {
      stat: "craftingSuccess",
      description: "+% to all crafting skill success rates",
      valueAtCap: 5,
    },
  ],
  combatDamageBonus: 0.01,
  switchCooldownHours: 12,
  color: "#6a994e",
  icon: "🪨",
};

const ironEarthbound: Spirit = {
  id: "earth_high",
  element: "earth",
  tier: "high",
  name: "Iron Earthbound",
  description:
    "A primordial earth-colossus, unbroken since the world's first shaping. Its bond makes the bearer nearly immovable and raises their crafting to near-legendary precision.",
  capPercent: 10,
  bonuses: [
    {
      stat: "defense",
      description: "+% to all defense",
      valueAtCap: 10,
    },
    {
      stat: "craftingSuccess",
      description: "+% to all crafting skill success rates",
      valueAtCap: 10,
    },
  ],
  combatDamageBonus: 0.01,
  switchCooldownHours: 12,
  color: "#6a994e",
  icon: "🪨",
};

// ─────────────────────────────────────────────────────────────────────────────
// Aggregated exports
// ─────────────────────────────────────────────────────────────────────────────

export const allSpirits: Spirit[] = [
  emberWisp,
  flameSprite,
  infernoAncient,
  driftBreeze,
  galeRunner,
  tempestSovereign,
  rippleFae,
  tidalSage,
  abyssalOracle,
  mossCrawler,
  graniteGuardian,
  ironEarthbound,
];

export const spiritsByElement: Record<SpiritElement, Spirit[]> = {
  fire: [emberWisp, flameSprite, infernoAncient],
  wind: [driftBreeze, galeRunner, tempestSovereign],
  water: [rippleFae, tidalSage, abyssalOracle],
  earth: [mossCrawler, graniteGuardian, ironEarthbound],
};

/** 12-hour switch cooldown in milliseconds */
export const spiritSwitchCooldownMs = 12 * 60 * 60 * 1000;

/** Cap percentages keyed by tier */
export const spiritTierCaps: Record<SpiritTier, number> = {
  low: 3,
  medium: 5,
  high: 10,
};

/**
 * Look up a specific spirit by element and tier.
 */
export function getSpiritByElementAndTier(
  element: SpiritElement,
  tier: SpiritTier
): Spirit | undefined {
  return spiritsByElement[element].find((s) => s.tier === tier);
}

// ─── Spirit Bond Evolution ───────────────────────────────────────────────────
// Bond grows over real time while the spirit is the active bound spirit.
// Each element retains its own bond % independently when the player switches.
// Switching spirits has a 12-hour cooldown.
//
// Tier thresholds and time-to-max (using 30-day months):
//   Wisp  phase: 0% → 3%  over  3 months  → ~0.001389% / hr
//   Spirit phase: 3% → 5%  over  6 months  → ~0.000463% / hr  (slows — spirit tests commitment)
//   Elder  phase: 5% → 10% over 12 months  → ~0.000579% / hr  (matures, deepens)
//
// Total to max one spirit: 21 months of active bonding.
// Maxing all four spirits simultaneously is impossible — switching resets active timer.

export const spiritBondTiers = {
  wisp:   { minBond: 0,  maxBond: 3,  monthsToMax: 3,  hourlyGrowth: 3  / (3  * 30 * 24) },
  spirit: { minBond: 3,  maxBond: 5,  monthsToMax: 6,  hourlyGrowth: 2  / (6  * 30 * 24) },
  elder:  { minBond: 5,  maxBond: 10, monthsToMax: 12, hourlyGrowth: 5  / (12 * 30 * 24) },
} as const;

export type SpiritEvolutionTier = keyof typeof spiritBondTiers;

/** Returns the current evolution tier name based on bond % */
export function getSpiritEvolutionTier(bondPercent: number): SpiritEvolutionTier {
  if (bondPercent >= 5) return "elder";
  if (bondPercent >= 3) return "spirit";
  return "wisp";
}

/** Returns the hourly bond growth rate for the given bond % */
export function getSpiritGrowthRate(bondPercent: number): number {
  const tier = getSpiritEvolutionTier(bondPercent);
  return spiritBondTiers[tier].hourlyGrowth;
}

/** Returns the display name for a spirit at a given bond level
 *  e.g. Fire at 6% → "Cinder Elder"
 */
export const spiritTierNames: Record<SpiritElement, Record<SpiritEvolutionTier, string>> = {
  fire:  { wisp: "Ember Wisp",   spirit: "Flame Spirit",   elder: "Cinder Elder"  },
  wind:  { wisp: "Breeze Wisp",  spirit: "Gale Spirit",    elder: "Storm Elder"   },
  water: { wisp: "Ripple Wisp",  spirit: "Current Spirit", elder: "Tide Elder"    },
  earth: { wisp: "Pebble Wisp",  spirit: "Stone Spirit",   elder: "Root Elder"    },
};

export function getSpiritDisplayName(element: SpiritElement, bondPercent: number): string {
  const tier = getSpiritEvolutionTier(bondPercent);
  return spiritTierNames[element][tier];
}
