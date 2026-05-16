// ─────────────────────────────────────────────────────────────────────────────
// Nexis — Property Data
// Nexis housing progression: 7 tiers, each with upgrade slots.
// Properties raise your max Comfort cap and unlock facility upgrades.
// ─────────────────────────────────────────────────────────────────────────────

import { isAbsoluteOwner, isAdministrator } from "../lib/adminAccess";

export type PropertyUpgrade = {
  id: string;
  name: string;
  description: string;
  cost: number;
  comfortBonus: number;       // additional comfort on top of base
  effects: string[];          // displayed as bullet list
};

export type PropertyAccess = "public" | "admin" | "absolute_owner";
export type PropertyAcquisition = "purchase" | "assignment";

export type PropertyTier = {
  id: string;
  name: string;
  price: number;              // gold cost to purchase (0 = free/default)
  baseComfort: number;        // comfort cap with no upgrades
  maxComfort: number;         // comfort cap with all upgrades
  upkeepPerDay: number;       // daily gold upkeep cost (0 = none)
  summary: string;
  flavour: string;            // longer description shown in detail panel
  icon: string;               // emoji icon
  upgradeSlots: number;       // how many upgrades can be installed
  upgrades: PropertyUpgrade[];
  access?: PropertyAccess;
  acquisition?: PropertyAcquisition;
  unique?: boolean;
};

export type PropertyViewer = {
  publicId: number | null | undefined;
};

export const propertyTiers: PropertyTier[] = [
  {
    id: "shack",
    name: "Shack",
    price: 0,
    baseComfort: 100,
    maxComfort: 100,
    upkeepPerDay: 0,
    summary: "Rough shelter. Keeps the rain off — barely.",
    flavour:
      "A single crooked room with a straw pallet, a cracked window, and a bucket for when it leaks. It is free. That is all it has going for it.",
    icon: "🪵",
    upgradeSlots: 0,
    upgrades: [],
  },
  {
    id: "cottage",
    name: "Cottage",
    price: 4_000,
    baseComfort: 250,
    maxComfort: 400,
    upkeepPerDay: 25,
    summary: "A humble home for a person trying to look respectable.",
    flavour:
      "Whitewashed walls, a proper bed, and a hearth that actually draws. Small, but yours. You can install basic furnishings to push the comfort ceiling higher.",
    icon: "🏡",
    upgradeSlots: 2,
    upgrades: [
      {
        id: "cottage-hearth",
        name: "Stone Hearth",
        description: "A proper stone fireplace that keeps the cottage warm through winter.",
        cost: 800,
        comfortBonus: 60,
        effects: ["+20 max comfort", "Passive warmth — removes cold penalties"],
      },
      {
        id: "cottage-garden",
        name: "Garden Plot",
        description: "A small vegetable garden. Modest, but it feeds you.",
        cost: 600,
        comfortBonus: 90,
        effects: ["+30 max comfort", "Produces herbs used in Alchemy profession"],
      },
    ],
  },
  {
    id: "townhouse",
    name: "Townhouse",
    price: 18_000,
    baseComfort: 500,
    maxComfort: 800,
    upkeepPerDay: 80,
    summary: "A sturdier urban residence with room to breathe.",
    flavour:
      "Three floors, a study, and a larder that stays stocked. The neighbours are close but the walls are thick. Respectable address within the city walls.",
    icon: "🏘️",
    upgradeSlots: 3,
    upgrades: [
      {
        id: "townhouse-study",
        name: "Furnished Study",
        description: "Bookshelves, a writing desk, and decent candlelight.",
        cost: 2_500,
        comfortBonus: 80,
        effects: ["+30 max comfort", "+5% Education speed while studying at home"],
      },
      {
        id: "townhouse-cellar",
        name: "Storage Cellar",
        description: "A dry underground cellar for goods and coin.",
        cost: 3_200,
        comfortBonus: 80,
        effects: ["+20 max comfort", "+50 item storage capacity"],
      },
      {
        id: "townhouse-guest",
        name: "Guest Room",
        description: "A furnished spare room for allies or contacts.",
        cost: 2_000,
        comfortBonus: 140,
        effects: ["+30 max comfort", "Unlocks the ability to host guild members"],
      },
    ],
  },
  {
    id: "merchant-house",
    name: "Merchant House",
    price: 65_000,
    baseComfort: 800,
    maxComfort: 1_400,
    upkeepPerDay: 200,
    summary: "A proper city residence with status and storage.",
    flavour:
      "Wide street-facing windows, a vaulted storeroom, and enough rooms to impress a guild master. Owning this signals you are no longer a beginner.",
    icon: "🏗️",
    upgradeSlots: 4,
    upgrades: [
      {
        id: "mhouse-vault",
        name: "Vault Room",
        description: "Reinforced room with iron-banded door. Safer gold storage.",
        cost: 8_000,
        comfortBonus: 80,
        effects: ["+20 max comfort", "Vault holds up to 500,000 gold safely"],
      },
      {
        id: "mhouse-workshop",
        name: "Craftsman Workshop",
        description: "A proper workbench with tools for skilled profession work.",
        cost: 12_000,
        comfortBonus: 120,
        effects: ["+30 max comfort", "+10% Profession XP when crafting at home"],
      },
      {
        id: "mhouse-garden",
        name: "Walled Garden",
        description: "A private courtyard garden for relaxation and herbs.",
        cost: 6_000,
        comfortBonus: 200,
        effects: ["+50 max comfort", "Produces rare herbs for Alchemy profession"],
      },
      {
        id: "mhouse-staff",
        name: "Live-in Staff",
        description: "A cook and a steward who maintain the property.",
        cost: 10_000,
        comfortBonus: 200,
        effects: ["+50 max comfort", "+3 comfort regeneration per hour"],
      },
    ],
  },
  {
    id: "manor",
    name: "Manor",
    price: 250_000,
    baseComfort: 1_400,
    maxComfort: 2_400,
    upkeepPerDay: 600,
    summary: "Country prestige, guest space, and real comfort.",
    flavour:
      "Rolling grounds, a stable block, servants' quarters, and a hall large enough to host the guild. People know your name when you live here.",
    icon: "🏛️",
    upgradeSlots: 5,
    upgrades: [
      {
        id: "manor-stable",
        name: "Stables",
        description: "Stabled horses — reduces travel time.",
        cost: 20_000,
        comfortBonus: 120,
        effects: ["+30 max comfort", "Travel time reduced by 10%"],
      },
      {
        id: "manor-training",
        name: "Training Ground",
        description: "An outdoor yard for daily combat and endurance drills.",
        cost: 35_000,
        comfortBonus: 120,
        effects: ["+30 max comfort", "+5% battle stat gains from training"],
      },
      {
        id: "manor-library",
        name: "Private Library",
        description: "Thousands of volumes from across the five cities.",
        cost: 28_000,
        comfortBonus: 200,
        effects: ["+40 max comfort", "+8% Education speed while studying at home"],
      },
      {
        id: "manor-infirmary",
        name: "Manor Infirmary",
        description: "A proper medical room with trained attendant.",
        cost: 40_000,
        comfortBonus: 280,
        effects: ["+50 max comfort", "Hospital time reduced by 15%"],
      },
      {
        id: "manor-vault",
        name: "Reinforced Vault",
        description: "Bank-grade vault room within the manor walls.",
        cost: 30_000,
        comfortBonus: 280,
        effects: ["+50 max comfort", "Vault holds up to 2,000,000 gold safely"],
      },
    ],
  },
  {
    id: "keep",
    name: "Keep",
    price: 900_000,
    baseComfort: 2_200,
    maxComfort: 3_600,
    upkeepPerDay: 1_800,
    summary: "Defensible, imposing, suitable for serious influence.",
    flavour:
      "Stone walls three feet thick, a gatehouse, a great hall, and a tower you can see from the city. You are not just wealthy — you are a force.",
    icon: "🏰",
    upgradeSlots: 6,
    upgrades: [
      {
        id: "keep-dungeon",
        name: "Dungeon Cells",
        description: "Holding cells beneath the keep for captured targets.",
        cost: 80_000,
        comfortBonus: 0,
        effects: ["Custody capacity for capture-oriented systems", "Intimidation passive — feared by lower-level players"],
      },
      {
        id: "keep-armory",
        name: "Armory",
        description: "Full weapon and armour storage and maintenance.",
        cost: 70_000,
        comfortBonus: 250,
        effects: ["+50 max comfort", "Weapons degrade 20% slower"],
      },
      {
        id: "keep-gatehouse",
        name: "Reinforced Gatehouse",
        description: "Fortified entry with archers' slits.",
        cost: 60_000,
        comfortBonus: 150,
        effects: ["+30 max comfort", "Defensive bonus vs. raid attempts"],
      },
      {
        id: "keep-chapel",
        name: "Private Chapel",
        description: "A vaulted chapel for quiet reflection and spiritual benefit.",
        cost: 55_000,
        comfortBonus: 350,
        effects: ["+70 max comfort", "+5% spirit binding speed"],
      },
      {
        id: "keep-bathhouse",
        name: "Bathhouse",
        description: "Hot spring–fed baths within the keep walls.",
        cost: 65_000,
        comfortBonus: 400,
        effects: ["+80 max comfort", "+5 comfort regen per hour"],
      },
      {
        id: "keep-observatory",
        name: "Observatory",
        description: "A tower-top observatory for star-reading and intelligence work.",
        cost: 90_000,
        comfortBonus: 250,
        effects: ["+20 max comfort", "+10% Intelligence working stat gains"],
      },
    ],
  },
  {
    id: "castle",
    name: "Castle",
    price: 3_500_000,
    baseComfort: 3_200,
    maxComfort: 5_000,
    upkeepPerDay: 6_000,
    summary: "Seat of power, prestige, and influence. The final tier.",
    flavour:
      "You do not simply own this castle — you command it. Towers, outer walls, a drawbridge, great hall, throne room. Kings have lived in lesser structures. This is the pinnacle of what wealth can build in Nexis.",
    icon: "👑",
    upgradeSlots: 8,
    upgrades: [
      {
        id: "castle-throne",
        name: "Throne Room",
        description: "A lavish throne room for receiving dignitaries and guild masters.",
        cost: 250_000,
        comfortBonus: 400,
        effects: ["+100 max comfort", "Guild bonuses — passive aura for guild members"],
      },
      {
        id: "castle-drawbridge",
        name: "Drawbridge & Moat",
        description: "The ultimate defensive addition. Almost impregnable.",
        cost: 300_000,
        comfortBonus: 150,
        effects: ["+50 max comfort", "Major defensive bonus vs. sieges"],
      },
      {
        id: "castle-treasury",
        name: "Royal Treasury",
        description: "A vast underground vault beneath the castle.",
        cost: 400_000,
        comfortBonus: 150,
        effects: ["+50 max comfort", "Store up to 50,000,000 gold safely"],
      },
      {
        id: "castle-barracks",
        name: "Castle Barracks",
        description: "Permanent garrison of NPC guards.",
        cost: 350_000,
        comfortBonus: 200,
        effects: ["+50 max comfort", "Guards defend property against attacks"],
      },
      {
        id: "castle-garden",
        name: "Royal Gardens",
        description: "Sweeping sculpted gardens visible from the city.",
        cost: 180_000,
        comfortBonus: 500,
        effects: ["+150 max comfort", "Produces rare crafting ingredients"],
      },
      {
        id: "castle-alchemylab",
        name: "Alchemy Laboratory",
        description: "Fully-equipped laboratory for advanced potion and reagent work.",
        cost: 280_000,
        comfortBonus: 0,
        effects: ["Unlocks Grandmaster Alchemy tier", "+20% Profession XP in Alchemy"],
      },
      {
        id: "castle-archive",
        name: "Grand Archive",
        description: "The most complete library in Nexis outside the academies.",
        cost: 220_000,
        comfortBonus: 0,
        effects: ["+15% Education speed", "Unlocks restricted tomes for advanced education"],
      },
      {
        id: "castle-portal",
        name: "Waystone Chamber",
        description: "An enchanted chamber with a permanent waystone.",
        cost: 500_000,
        comfortBonus: 0,
        effects: ["Instant travel to any city once per day", "No travel time cost"],
      },
    ],
  },
  {
    id: "shadow-guardian",
    name: "Shadow Guardian Airship",
    price: 0,
    baseComfort: 75_000,
    maxComfort: 100_000,
    upkeepPerDay: 0,
    summary: "Administrator command carrier. Subtlety was not invited.",
    flavour:
      "A fortress-airship with district-scale decks, sealed gardens, command galleries, and enough hull to make common sense file a formal complaint. Reserved for administrator identities trusted with Shadow Guardian command authority.",
    icon: "SG",
    upgradeSlots: 8,
    access: "admin",
    acquisition: "assignment",
    upgrades: [
      {
        id: "shadow-guardian-command-spire",
        name: "Command Spire",
        description: "A towered bridge deck with full tactical projection and fleet-link systems.",
        cost: 0,
        comfortBonus: 3_500,
        effects: ["+3,500 max comfort", "Full fleet coordination deck"],
      },
      {
        id: "shadow-guardian-drill-decks",
        name: "Drill Decks",
        description: "Dedicated combat decks for training under absurdly expensive supervision.",
        cost: 0,
        comfortBonus: 3_000,
        effects: ["+3,000 max comfort", "+7% battle stat gains from training"],
      },
      {
        id: "shadow-guardian-infirmary",
        name: "Guardian Infirmary",
        description: "A full surgical and recovery bay with med-automata and warded rooms.",
        cost: 0,
        comfortBonus: 3_000,
        effects: ["+3,000 max comfort", "Hospital recovery support"],
      },
      {
        id: "shadow-guardian-archive",
        name: "Black Archive",
        description: "A classified archive containing command logs, histories, and restricted studies.",
        cost: 0,
        comfortBonus: 2_500,
        effects: ["+2,500 max comfort", "Advanced education access"],
      },
      {
        id: "shadow-guardian-waygate",
        name: "Waygate Chamber",
        description: "A stabilized travel chamber keyed to command routes and protected anchors.",
        cost: 0,
        comfortBonus: 3_500,
        effects: ["+3,500 max comfort", "Priority travel routing"],
      },
      {
        id: "shadow-guardian-vault",
        name: "Shadow Vault",
        description: "An armored treasury deck designed for items nobody should misplace.",
        cost: 0,
        comfortBonus: 3_000,
        effects: ["+3,000 max comfort", "Massive secure storage"],
      },
      {
        id: "shadow-guardian-gardens",
        name: "Void Gardens",
        description: "Suspended interior gardens because apparently even warships need scenery.",
        cost: 0,
        comfortBonus: 3_000,
        effects: ["+3,000 max comfort", "Major comfort stabilization"],
      },
      {
        id: "shadow-guardian-quarters",
        name: "Command Suites",
        description: "Private quarters for command staff, dignitaries, and the terminally important.",
        cost: 0,
        comfortBonus: 3_500,
        effects: ["+3,500 max comfort", "High-capacity executive housing"],
      },
    ],
  },
  {
    id: "shadow-guardian-prime",
    name: "Shadow Guardian Prime",
    price: 0,
    baseComfort: 100_000,
    maxComfort: 140_000,
    upkeepPerDay: 0,
    summary: "Hennet's one-of-one worldbreaker flagship. Modesty died on launch.",
    flavour:
      "A worldbreaker-class airship the size of a small city, carrying private academies, command citadels, sealed vault districts, and enough sovereign infrastructure to embarrass smaller nations. This flagship is reserved exclusively for Hennet Uthellien.",
    icon: "SGP",
    upgradeSlots: 10,
    access: "absolute_owner",
    acquisition: "assignment",
    unique: true,
    upgrades: [
      {
        id: "shadow-guardian-prime-citadel",
        name: "Prime Command Citadel",
        description: "The central command core from which the entire vessel is governed.",
        cost: 0,
        comfortBonus: 4_000,
        effects: ["+4,000 max comfort", "Supreme command authority"],
      },
      {
        id: "shadow-guardian-prime-warfoundry",
        name: "Warfoundry Deck",
        description: "A brutal training and fabrication complex for battle refinement at impossible scale.",
        cost: 0,
        comfortBonus: 4_000,
        effects: ["+4,000 max comfort", "+12% battle stat gains from training"],
      },
      {
        id: "shadow-guardian-prime-archive",
        name: "Eclipse Archive",
        description: "A classified archive-citadel with research stacks, sealed reliquaries, and command records.",
        cost: 0,
        comfortBonus: 4_000,
        effects: ["+4,000 max comfort", "Elite education and intelligence support"],
      },
      {
        id: "shadow-guardian-prime-infirmary",
        name: "Prime Resurrection Wing",
        description: "A full command-grade medical and recovery district.",
        cost: 0,
        comfortBonus: 4_000,
        effects: ["+4,000 max comfort", "Best-in-class medical recovery"],
      },
      {
        id: "shadow-guardian-prime-gardens",
        name: "Skyglass Gardens",
        description: "A floating interior biome because Hennet apparently wanted a private climate.",
        cost: 0,
        comfortBonus: 4_000,
        effects: ["+4,000 max comfort", "Major comfort regeneration support"],
      },
      {
        id: "shadow-guardian-prime-vault",
        name: "Prime Treasury District",
        description: "Not a vault room. A vault district. Entirely different level of problem.",
        cost: 0,
        comfortBonus: 4_000,
        effects: ["+4,000 max comfort", "Extreme secure storage"],
      },
      {
        id: "shadow-guardian-prime-waygate",
        name: "Sovereign Waygate",
        description: "A sovereign waygate chamber linked to protected command routes.",
        cost: 0,
        comfortBonus: 4_000,
        effects: ["+4,000 max comfort", "Top-priority travel capability"],
      },
      {
        id: "shadow-guardian-prime-quarters",
        name: "Absolute Suites",
        description: "Private residential decks designed for people who do not hear the word no often enough.",
        cost: 0,
        comfortBonus: 4_000,
        effects: ["+4,000 max comfort", "Expanded command residence capacity"],
      },
      {
        id: "shadow-guardian-prime-observatory",
        name: "Worldglass Observatory",
        description: "A strategic observatory with reality-calibrated long-range instruments.",
        cost: 0,
        comfortBonus: 4_000,
        effects: ["+4,000 max comfort", "Superior intelligence and oversight"],
      },
      {
        id: "shadow-guardian-prime-aegis",
        name: "Aegis Halo",
        description: "Defensive ward lattice spanning the entire flagship hull.",
        cost: 0,
        comfortBonus: 4_000,
        effects: ["+4,000 max comfort", "Worldbreaker-grade defensive shielding"],
      },
    ],
  },
];

export function formatGold(value: number): string {
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M gold`;
  if (value >= 1_000) return `${(value / 1_000).toFixed(1)}k gold`;
  return `${value} gold`;
}

export function getPropertyById(id: string): PropertyTier | undefined {
  return propertyTiers.find((p) => p.id === id);
}

export function getPropertyComfortCap(propertyId: string, installedUpgradeIds: string[]): number {
  const property = getPropertyById(propertyId) ?? propertyTiers[0];
  const installed = new Set(installedUpgradeIds);
  const comfortFromUpgrades = property.upgrades.reduce(
    (sum, upgrade) => sum + (installed.has(upgrade.id) ? upgrade.comfortBonus : 0),
    0,
  );
  return property.baseComfort + comfortFromUpgrades;
}

export function getPropertyBattleTrainingMultiplier(propertyId: string, installedUpgradeIds: string[]): number {
  const installed = new Set(installedUpgradeIds);
  let multiplier = 1;

  if (propertyId === "manor" && installed.has("manor-training")) {
    multiplier *= 1.05;
  }

  if (propertyId === "shadow-guardian" && installed.has("shadow-guardian-drill-decks")) {
    multiplier *= 1.07;
  }

  if (propertyId === "shadow-guardian-prime" && installed.has("shadow-guardian-prime-warfoundry")) {
    multiplier *= 1.12;
  }

  return multiplier;
}

export function getPropertyTravelTimeMultiplier(propertyId: string, installedUpgradeIds: string[]) {
  const installed = new Set(installedUpgradeIds);
  let multiplier = 1;

  if (propertyId === "manor" && installed.has("manor-stable")) {
    multiplier *= 0.9;
  }

  if (propertyId === "shadow-guardian") {
    multiplier *= 0.2;
  }

  if (propertyId === "shadow-guardian-prime") {
    multiplier *= 0.1;
  }

  return Math.max(0.1, multiplier);
}

export function canAccessPropertyTier(tier: PropertyTier, viewer: PropertyViewer) {
  const access = tier.access ?? "public";

  if (access === "public") return true;
  if (access === "absolute_owner") return isAbsoluteOwner(viewer.publicId);
  if (access === "admin") return isAdministrator(viewer.publicId);
  return false;
}

export function getPropertyAccessLabel(tier: PropertyTier) {
  const access = tier.access ?? "public";

  if (access === "absolute_owner") return "Hennet exclusive";
  if (access === "admin") return "Administrator exclusive";
  return null;
}

// Legacy compat
export function formatPropertyPrice(value: number): string {
  return formatGold(value);
}
