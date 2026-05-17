// ─────────────────────────────────────────────────────────────────────────────
// Nexis — Jobs Data
// Nexis crime system — medieval fantasy.
// ─────────────────────────────────────────────────────────────────────────────

export type JobOutcome = "success" | "fail" | "criticalFail";
export type ConsequenceType = "none" | "hospital" | "jail";

export type ItemDrop = {
  itemId: string;
  itemName: string;
  dropChance: number; // 0–1 probability
  minQty: number;
  maxQty: number;
};

export type RequiredItem = {
  itemId: string;
  quantity: number;
};

export type SubJob = {
  id: string;
  name: string;
  description: string;
  staminaCost: number;
  cooldownMs: number;
  baseGoldMin: number;
  baseGoldMax: number;
  xpPerSuccess: number;
  /** Fail chance at level 1 — decreases as level increases */
  baseFailChance: number;
  /** Crit-fail chance at level 1 — very low below level 10 */
  baseCritFailChance: number;
  critConsequence: ConsequenceType;
  critHospitalMinutes?: number;
  critJailMinutes?: number;
  critFlavorText: string;
  itemDrops: ItemDrop[];
  requiredItems?: RequiredItem[];
  primaryStat: "strength" | "dexterity" | "intelligence" | "endurance" | "charisma";
};

export type JobCategory = {
  id: string;
  name: string;
  icon: string;
  description: string;
  theme: string;
  isIllegal: boolean;
  subJobs: SubJob[];
};

// ─────────────────────────────────────────────────────────────────────────────
// Category 1 — Beginner Adventurer
// ─────────────────────────────────────────────────────────────────────────────

const beginnerAdventurer: JobCategory = {
  id: "beginner_adventurer",
  name: "Beginner Adventurer",
  icon: "🗡️",
  description:
    "Entry-level fieldwork for those just starting out. Low risk, modest coin, but the crafting materials you gather are invaluable to skilled Professions workers.",
  theme: "Gather, explore, survive",
  isIllegal: false,
  subJobs: [
    {
      id: "gather_herbs",
      name: "Gather Herbs",
      description:
        "Pick wild herbs from the fields and thickets surrounding the city walls. A steady hand and a keen eye separate the useful from the deadly.",
      staminaCost: 3,
      cooldownMs: 0,
      baseGoldMin: 5,
      baseGoldMax: 15,
      xpPerSuccess: 12,
      baseFailChance: 0.25,
      baseCritFailChance: 0.02,
      critConsequence: "hospital",
      critHospitalMinutes: 5,
      critFlavorText: "You ate a poisonous berry by mistake. Your vision blurs...",
      primaryStat: "intelligence",
      itemDrops: [
        { itemId: "wild_herb",       itemName: "Wild Herb",       dropChance: 0.40, minQty: 1, maxQty: 3 },
        { itemId: "medicinal_herb",  itemName: "Medicinal Herb",  dropChance: 0.15, minQty: 1, maxQty: 2 },
        { itemId: "healing_root",    itemName: "Healing Root",    dropChance: 0.05, minQty: 1, maxQty: 1 },
      ],
    },
    {
      id: "collect_firewood",
      name: "Collect Firewood",
      description:
        "Chop and bundle timber from the local forest. The woodcutters' guild pays fairly for good splits, and the city always needs fuel.",
      staminaCost: 4,
      cooldownMs: 0,
      baseGoldMin: 8,
      baseGoldMax: 20,
      xpPerSuccess: 16,
      baseFailChance: 0.20,
      baseCritFailChance: 0.03,
      critConsequence: "hospital",
      critHospitalMinutes: 10,
      critFlavorText: "A heavy branch swings back and cracks you across the skull.",
      requiredItems: [{ itemId: "wood_axe", quantity: 1 }],
      primaryStat: "strength",
      itemDrops: [
        { itemId: "rough_wood",  itemName: "Rough Wood",  dropChance: 0.35, minQty: 1, maxQty: 4 },
        { itemId: "hardwood",    itemName: "Hardwood",    dropChance: 0.10, minQty: 1, maxQty: 2 },
      ],
    },
    {
      id: "mine_ore",
      name: "Mine Ore",
      description:
        "Work the shallow shafts of the local mine, chipping iron and coal from the rock face. Hard labour with solid material rewards.",
      staminaCost: 5,
      cooldownMs: 0,
      baseGoldMin: 10,
      baseGoldMax: 25,
      xpPerSuccess: 20,
      baseFailChance: 0.25,
      baseCritFailChance: 0.04,
      critConsequence: "hospital",
      critHospitalMinutes: 15,
      critFlavorText: "The tunnel groans — a cave-in buries you up to the waist!",
      requiredItems: [{ itemId: "miners_pick", quantity: 1 }],
      primaryStat: "endurance",
      itemDrops: [
        { itemId: "iron_ore",    itemName: "Iron Ore",    dropChance: 0.30, minQty: 1, maxQty: 3 },
        { itemId: "coal",        itemName: "Coal",        dropChance: 0.15, minQty: 1, maxQty: 2 },
        { itemId: "scrap_metal", itemName: "Scrap Metal", dropChance: 0.20, minQty: 1, maxQty: 3 },
      ],
    },
    {
      id: "hunt_small_game",
      name: "Hunt Small Game",
      description:
        "Track rabbits, foxes, and pheasants in the woodland bordering Nexis. Pelts and sinew fetch a fair price at the market.",
      staminaCost: 4,
      cooldownMs: 0,
      baseGoldMin: 8,
      baseGoldMax: 18,
      xpPerSuccess: 14,
      baseFailChance: 0.30,
      baseCritFailChance: 0.02,
      critConsequence: "hospital",
      critHospitalMinutes: 5,
      critFlavorText: "The fox turns on you — its teeth sink deep into your hand.",
      requiredItems: [{ itemId: "hunters_bow", quantity: 1 }],
      primaryStat: "dexterity",
      itemDrops: [
        { itemId: "leather_strip", itemName: "Leather Strip", dropChance: 0.25, minQty: 1, maxQty: 3 },
        { itemId: "rope",          itemName: "Rope",          dropChance: 0.15, minQty: 1, maxQty: 2 },
      ],
    },
    {
      id: "search_for_treasure",
      name: "Search for Treasure",
      description:
        "Comb through crumbling ruins on the city outskirts for valuables. The richest finds feed the scholars and engineers who pay handsomely for old knowledge.",
      staminaCost: 6,
      cooldownMs: 0,
      baseGoldMin: 15,
      baseGoldMax: 40,
      xpPerSuccess: 25,
      baseFailChance: 0.35,
      baseCritFailChance: 0.05,
      critConsequence: "hospital",
      critHospitalMinutes: 10,
      critFlavorText: "The ruin floor collapses — you plunge into a hidden pit.",
      requiredItems: [
        { itemId: "lantern", quantity: 1 },
        { itemId: "rope", quantity: 1 },
      ],
      primaryStat: "intelligence",
      itemDrops: [
        { itemId: "common_tome",      itemName: "Common Tome",      dropChance: 0.10, minQty: 1, maxQty: 1 },
        { itemId: "lore_fragment",    itemName: "Lore Fragment",    dropChance: 0.08, minQty: 1, maxQty: 2 },
        { itemId: "iron_parts",       itemName: "Iron Parts",       dropChance: 0.12, minQty: 1, maxQty: 2 },
        { itemId: "empty_vials",      itemName: "Empty Vials",      dropChance: 0.15, minQty: 1, maxQty: 3 },
      ],
    },
  ],
};

// ─────────────────────────────────────────────────────────────────────────────
// Category 2 — Thievery
// ─────────────────────────────────────────────────────────────────────────────

const thievery: JobCategory = {
  id: "thievery",
  name: "Thievery",
  icon: "🗝️",
  description:
    "The art of taking what isn't yours. Higher risk, higher reward — but the city guards are always watching. Get caught and you'll be warming a cell.",
  theme: "Quick fingers, quiet feet",
  isIllegal: true,
  subJobs: [
    {
      id: "pickpocket",
      name: "Pickpocket",
      description:
        "Brush past a distracted merchant or festival-goer and relieve them of their coin purse. Speed and misdirection are everything.",
      staminaCost: 4,
      cooldownMs: 0,
      baseGoldMin: 15,
      baseGoldMax: 35,
      xpPerSuccess: 18,
      baseFailChance: 0.30,
      baseCritFailChance: 0.08,
      critConsequence: "jail",
      critJailMinutes: 15,
      critFlavorText: "A guard catches your wrist mid-lift. You're dragged to the cells.",
      primaryStat: "dexterity",
      itemDrops: [],
    },
    {
      id: "lockpick_chest",
      name: "Lockpick a Chest",
      description:
        "Crack the lock on a merchant's strongbox in the market district. Requires finesse — a trapped chest will alert the whole block.",
      staminaCost: 6,
      cooldownMs: 0,
      baseGoldMin: 25,
      baseGoldMax: 60,
      xpPerSuccess: 28,
      baseFailChance: 0.35,
      baseCritFailChance: 0.07,
      critConsequence: "jail",
      critJailMinutes: 20,
      critFlavorText: "The lock was rigged — an alarm bell rings out. Guards close in fast.",
      requiredItems: [{ itemId: "lockpick_set", quantity: 1 }],
      primaryStat: "dexterity",
      itemDrops: [
        { itemId: "gear_cogs", itemName: "Gear Cogs", dropChance: 0.10, minQty: 1, maxQty: 2 },
        { itemId: "springs",   itemName: "Springs",   dropChance: 0.08, minQty: 1, maxQty: 2 },
      ],
    },
    {
      id: "rob_a_stall",
      name: "Rob a Stall",
      description:
        "Grab goods from an unattended market stall while the owner is distracted. Timing is everything — move too slow and you're caught.",
      staminaCost: 5,
      cooldownMs: 0,
      baseGoldMin: 20,
      baseGoldMax: 45,
      xpPerSuccess: 22,
      baseFailChance: 0.30,
      baseCritFailChance: 0.10,
      critConsequence: "jail",
      critJailMinutes: 25,
      critFlavorText: "The stallkeeper returns early and bellows for the guard. You're surrounded.",
      primaryStat: "dexterity",
      itemDrops: [
        { itemId: "empty_vials", itemName: "Empty Vials", dropChance: 0.12, minQty: 1, maxQty: 3 },
        { itemId: "clean_linen", itemName: "Clean Linen", dropChance: 0.10, minQty: 1, maxQty: 2 },
      ],
    },
    {
      id: "forge_a_signet",
      name: "Forge a Signet",
      description:
        "Replicate a noble family's wax seal to authenticate forged documents. Requires a delicate hand and knowledge of heraldry.",
      staminaCost: 8,
      cooldownMs: 0,
      baseGoldMin: 40,
      baseGoldMax: 80,
      xpPerSuccess: 38,
      baseFailChance: 0.40,
      baseCritFailChance: 0.08,
      critConsequence: "jail",
      critJailMinutes: 30,
      critFlavorText: "A court scribe glances at your work and immediately recognises the forgery.",
      requiredItems: [
        { itemId: "forged_seal_kit", quantity: 1 },
        { itemId: "vial_of_ink", quantity: 1 },
      ],
      primaryStat: "intelligence",
      itemDrops: [
        { itemId: "enchanted_parchment", itemName: "Enchanted Parchment", dropChance: 0.05, minQty: 1, maxQty: 1 },
      ],
    },
  ],
};

// ─────────────────────────────────────────────────────────────────────────────
// Category 3 — Courier
// ─────────────────────────────────────────────────────────────────────────────

const courier: JobCategory = {
  id: "courier",
  name: "Courier",
  icon: "📜",
  description:
    "Swift and reliable delivery across Nexis and beyond. Most runs are legitimate — but bandits don't ask questions, and neither does the road.",
  theme: "Fast legs, steady nerves",
  isIllegal: false,
  subJobs: [
    {
      id: "deliver_a_letter",
      name: "Deliver a Letter",
      description:
        "Run an urgent message to an address across town. Simple work, honest pay — just watch your footing on the cobblestones.",
      staminaCost: 3,
      cooldownMs: 0,
      baseGoldMin: 10,
      baseGoldMax: 20,
      xpPerSuccess: 12,
      baseFailChance: 0.20,
      baseCritFailChance: 0.02,
      critConsequence: "hospital",
      critHospitalMinutes: 5,
      critFlavorText: "You trip on uneven cobblestones at a full sprint — nasty fall.",
      requiredItems: [{ itemId: "courier_satchel", quantity: 1 }],
      primaryStat: "endurance",
      itemDrops: [],
    },
    {
      id: "smuggle_herbs",
      name: "Smuggle Herbs",
      description:
        "Carry a package of restricted herbs through a checkpoint. The merchant assures you it's medicinal — the guards may disagree.",
      staminaCost: 5,
      cooldownMs: 0,
      baseGoldMin: 20,
      baseGoldMax: 40,
      xpPerSuccess: 22,
      baseFailChance: 0.30,
      baseCritFailChance: 0.06,
      critConsequence: "hospital",
      critHospitalMinutes: 10,
      critFlavorText: "Bandits on the road knew exactly what you were carrying. They didn't hold back.",
      requiredItems: [{ itemId: "courier_satchel", quantity: 1 }],
      primaryStat: "charisma",
      itemDrops: [
        { itemId: "alchemical_root", itemName: "Alchemical Root", dropChance: 0.08, minQty: 1, maxQty: 2 },
        { itemId: "toxic_plant",     itemName: "Toxic Plant",     dropChance: 0.05, minQty: 1, maxQty: 1 },
      ],
    },
    {
      id: "escort_cargo",
      name: "Escort Cargo",
      description:
        "Guard a merchant's shipment as it crosses from the dockside warehouse to the inner market. Heavier work, steadier coin.",
      staminaCost: 6,
      cooldownMs: 0,
      baseGoldMin: 25,
      baseGoldMax: 50,
      xpPerSuccess: 26,
      baseFailChance: 0.25,
      baseCritFailChance: 0.05,
      critConsequence: "hospital",
      critHospitalMinutes: 15,
      critFlavorText: "The cargo wagon hits a rut and overturns — you're pinned beneath a crate.",
      requiredItems: [{ itemId: "rope", quantity: 1 }],
      primaryStat: "strength",
      itemDrops: [
        { itemId: "iron_rivets",    itemName: "Iron Rivets",    dropChance: 0.10, minQty: 1, maxQty: 3 },
        { itemId: "refined_parts",  itemName: "Refined Parts",  dropChance: 0.05, minQty: 1, maxQty: 1 },
      ],
    },
    {
      id: "cross_border_run",
      name: "Cross-Border Run",
      description:
        "Deliver a sealed package to a contact waiting at the city outskirts. You're told not to ask what's inside.",
      staminaCost: 8,
      cooldownMs: 0,
      baseGoldMin: 35,
      baseGoldMax: 70,
      xpPerSuccess: 34,
      baseFailChance: 0.35,
      baseCritFailChance: 0.07,
      critConsequence: "hospital",
      critHospitalMinutes: 20,
      critFlavorText: "Border patrol stops you — your cover story doesn't hold. They rough you up before releasing you.",
      requiredItems: [
        { itemId: "courier_satchel", quantity: 1 },
        { itemId: "rations", quantity: 1 },
      ],
      primaryStat: "endurance",
      itemDrops: [
        { itemId: "old_manuscript",    itemName: "Old Manuscript",    dropChance: 0.05, minQty: 1, maxQty: 1 },
        { itemId: "sealed_chronicle",  itemName: "Sealed Chronicle",  dropChance: 0.03, minQty: 1, maxQty: 1 },
      ],
    },
  ],
};

// ─────────────────────────────────────────────────────────────────────────────
// Category 4 — Labor
// ─────────────────────────────────────────────────────────────────────────────

const labor: JobCategory = {
  id: "labor",
  name: "Labor",
  icon: "⚒️",
  description:
    "Honest muscle-work that keeps Nexis running. The safest jobs available — but even honest work has its hazards.",
  theme: "Sweat, stone, and timber",
  isIllegal: false,
  subJobs: [
    {
      id: "haul_stone",
      name: "Haul Stone",
      description:
        "Move heavy building blocks from the quarry carts to the construction site. Pure endurance — and good coin for it.",
      staminaCost: 5,
      cooldownMs: 0,
      baseGoldMin: 12,
      baseGoldMax: 25,
      xpPerSuccess: 18,
      baseFailChance: 0.15,
      baseCritFailChance: 0.03,
      critConsequence: "hospital",
      critHospitalMinutes: 10,
      critFlavorText: "A loose stone block slips from the cart and crushes your foot.",
      requiredItems: [{ itemId: "rope", quantity: 1 }],
      primaryStat: "strength",
      itemDrops: [
        { itemId: "iron_ore", itemName: "Iron Ore", dropChance: 0.10, minQty: 1, maxQty: 2 },
      ],
    },
    {
      id: "dig_a_trench",
      name: "Dig a Trench",
      description:
        "Excavation work for the city's drainage and foundation projects. Repetitive, but the foremen pay on time.",
      staminaCost: 4,
      cooldownMs: 0,
      baseGoldMin: 10,
      baseGoldMax: 22,
      xpPerSuccess: 16,
      baseFailChance: 0.15,
      baseCritFailChance: 0.02,
      critConsequence: "hospital",
      critHospitalMinutes: 5,
      critFlavorText: "Your shovel blade snaps and the handle cracks back across your face.",
      requiredItems: [{ itemId: "shovel", quantity: 1 }],
      primaryStat: "endurance",
      itemDrops: [
        { itemId: "scrap_metal", itemName: "Scrap Metal", dropChance: 0.12, minQty: 1, maxQty: 3 },
        { itemId: "iron_parts",  itemName: "Iron Parts",  dropChance: 0.08, minQty: 1, maxQty: 2 },
      ],
    },
    {
      id: "fell_timber",
      name: "Fell Timber",
      description:
        "Professional lumberjack work in the managed forest north of the city. Experience ensures the tree falls where you intend.",
      staminaCost: 5,
      cooldownMs: 0,
      baseGoldMin: 15,
      baseGoldMax: 30,
      xpPerSuccess: 20,
      baseFailChance: 0.20,
      baseCritFailChance: 0.04,
      critConsequence: "hospital",
      critHospitalMinutes: 15,
      critFlavorText: "The tree falls in completely the wrong direction — you barely dive clear. Barely.",
      requiredItems: [{ itemId: "wood_axe", quantity: 1 }],
      primaryStat: "strength",
      itemDrops: [
        { itemId: "rough_wood", itemName: "Rough Wood", dropChance: 0.25, minQty: 2, maxQty: 5 },
        { itemId: "hardwood",   itemName: "Hardwood",   dropChance: 0.12, minQty: 1, maxQty: 2 },
      ],
    },
    {
      id: "work_the_forge",
      name: "Work the Forge",
      description:
        "Assist the city blacksmith with bellows, quenching, and shaping. A hot, demanding environment that rewards endurance.",
      staminaCost: 6,
      cooldownMs: 0,
      baseGoldMin: 18,
      baseGoldMax: 35,
      xpPerSuccess: 24,
      baseFailChance: 0.20,
      baseCritFailChance: 0.03,
      critConsequence: "hospital",
      critHospitalMinutes: 10,
      critFlavorText: "A splash of molten metal catches your arm. The burns are deep.",
      requiredItems: [{ itemId: "smithing_hammer", quantity: 1 }],
      primaryStat: "endurance",
      itemDrops: [
        { itemId: "steel_ingot",    itemName: "Steel Ingot",    dropChance: 0.08, minQty: 1, maxQty: 2 },
        { itemId: "tempered_steel", itemName: "Tempered Steel", dropChance: 0.03, minQty: 1, maxQty: 1 },
        { itemId: "iron_rivets",    itemName: "Iron Rivets",    dropChance: 0.10, minQty: 1, maxQty: 3 },
      ],
    },
    {
      id: "tend_the_fields",
      name: "Tend the Fields",
      description:
        "Agricultural work on the farmland surrounding the city walls — sowing, weeding, and harvesting. Gentle on the body, generous with herbs.",
      staminaCost: 3,
      cooldownMs: 0,
      baseGoldMin: 8,
      baseGoldMax: 18,
      xpPerSuccess: 12,
      baseFailChance: 0.10,
      baseCritFailChance: 0.01,
      critConsequence: "hospital",
      critHospitalMinutes: 5,
      critFlavorText: "A disturbed bees' nest releases a furious swarm. You run — not fast enough.",
      requiredItems: [{ itemId: "herbalist_gloves", quantity: 1 }],
      primaryStat: "endurance",
      itemDrops: [
        { itemId: "wild_herb",      itemName: "Wild Herb",      dropChance: 0.30, minQty: 1, maxQty: 3 },
        { itemId: "medicinal_herb", itemName: "Medicinal Herb", dropChance: 0.10, minQty: 1, maxQty: 2 },
        { itemId: "rare_herb",      itemName: "Rare Herb",      dropChance: 0.02, minQty: 1, maxQty: 1 },
      ],
    },
  ],
};

// ─────────────────────────────────────────────────────────────────────────────
// Category 5 — Deception
// ─────────────────────────────────────────────────────────────────────────────

const deception: JobCategory = {
  id: "deception",
  name: "Deception",
  icon: "🎭",
  description:
    "Silver-tongued schemes and masterful cons. The highest potential returns in the jobs market — and the highest risk. One wrong word and it's all over.",
  theme: "Words are weapons",
  isIllegal: true,
  subJobs: [
    {
      id: "sell_fake_relics",
      name: "Sell Fake Relics",
      description:
        "Peddle cleverly crafted counterfeit antiquities to collectors and pilgrims. Confidence is your most important tool.",
      staminaCost: 5,
      cooldownMs: 0,
      baseGoldMin: 20,
      baseGoldMax: 45,
      xpPerSuccess: 22,
      baseFailChance: 0.35,
      baseCritFailChance: 0.08,
      critConsequence: "jail",
      critJailMinutes: 15,
      critFlavorText: "A well-traveled collector spots the fake immediately and calls for the watch.",
      primaryStat: "charisma",
      itemDrops: [],
    },
    {
      id: "forge_documents",
      name: "Forge Documents",
      description:
        "Create convincing copies of travel papers, merchant permits, or guild charters. The ink must be just right.",
      staminaCost: 7,
      cooldownMs: 0,
      baseGoldMin: 30,
      baseGoldMax: 60,
      xpPerSuccess: 32,
      baseFailChance: 0.35,
      baseCritFailChance: 0.07,
      critConsequence: "jail",
      critJailMinutes: 20,
      critFlavorText: "The ink chemistry doesn't match the official record. The clerk has seen this trick before.",
      requiredItems: [
        { itemId: "vial_of_ink", quantity: 1 },
        { itemId: "enchanted_parchment", quantity: 1 },
      ],
      primaryStat: "intelligence",
      itemDrops: [
        { itemId: "enchanted_parchment", itemName: "Enchanted Parchment", dropChance: 0.08, minQty: 1, maxQty: 1 },
      ],
    },
    {
      id: "impersonate_noble",
      name: "Impersonate a Noble",
      description:
        "Dress the part, speak the part, and gain access to areas restricted to the common folk. The reward is substantial — the risk is substantial.",
      staminaCost: 8,
      cooldownMs: 0,
      baseGoldMin: 40,
      baseGoldMax: 80,
      xpPerSuccess: 40,
      baseFailChance: 0.40,
      baseCritFailChance: 0.10,
      critConsequence: "jail",
      critJailMinutes: 30,
      critFlavorText: "The real Lord Aldric is dining in the next room. He recognises his own family crest.",
      requiredItems: [{ itemId: "travel_cloak", quantity: 1 }],
      primaryStat: "charisma",
      itemDrops: [
        { itemId: "magic_tome",       itemName: "Magic Tome",       dropChance: 0.03, minQty: 1, maxQty: 1 },
        { itemId: "alchemists_notes", itemName: "Alchemist's Notes", dropChance: 0.05, minQty: 1, maxQty: 1 },
      ],
    },
    {
      id: "run_a_con",
      name: "Run a Con",
      description:
        "Set up and execute a short confidence scheme from start to finish. Every detail must hold — one unguarded moment unravels everything.",
      staminaCost: 10,
      cooldownMs: 0,
      baseGoldMin: 50,
      baseGoldMax: 100,
      xpPerSuccess: 50,
      baseFailChance: 0.45,
      baseCritFailChance: 0.08,
      critConsequence: "jail",
      critJailMinutes: 25,
      critFlavorText: "Your mark had the guards waiting. They were tipped off from the start.",
      requiredItems: [{ itemId: "forged_document", quantity: 1 }],
      primaryStat: "charisma",
      itemDrops: [
        { itemId: "catalyst_powder",    itemName: "Catalyst Powder",    dropChance: 0.04, minQty: 1, maxQty: 1 },
        { itemId: "philosophers_salt",  itemName: "Philosopher's Salt", dropChance: 0.02, minQty: 1, maxQty: 1 },
      ],
    },
  ],
};

// ─────────────────────────────────────────────────────────────────────────────
// Exports
// ─────────────────────────────────────────────────────────────────────────────

function staminaCostForCategoryIndex(index: number) {
  return 2 + Math.floor(index / 2);
}

function normalizeCategory(category: JobCategory, index: number): JobCategory {
  const staminaCost = staminaCostForCategoryIndex(index);
  return {
    ...category,
    subJobs: category.subJobs.map((subJob) => ({
      ...subJob,
      staminaCost,
    })),
  };
}

export const jobCategories: JobCategory[] = [
  beginnerAdventurer,
  thievery,
  courier,
  labor,
  deception,
].map((category, index) => normalizeCategory(category, index));

/** Lookup a category by id */
export function getCategory(id: string): JobCategory | undefined {
  return jobCategories.find((c) => c.id === id);
}

/** Lookup a specific sub-job within a category */
export function getSubJob(categoryId: string, subJobId: string): SubJob | undefined {
  return getCategory(categoryId)?.subJobs.find((s) => s.id === subJobId);
}
