const STAR_TIERS = [1, 3, 5, 7, 10];

function reward({ starTier, rewardKey, displayName, mode, pointCost = null, effectSummary, poolKey = null }) {
  return {
    starTier,
    rewardKey,
    displayName,
    mode,
    pointCost,
    effectSummary,
    poolKey,
  };
}

export const CONSORTIUM_RANDOM_REWARD_POOLS = {
  mining: [
    { itemId: "iron_ore", quantity: 10, label: "Iron Ore Crate" },
    { itemId: "coal", quantity: 8, label: "Coal Stack" },
    { itemId: "silver_ore", quantity: 6, label: "Silver Ore Basket" },
    { itemId: "rare_gemstone", quantity: 2, label: "Gem Satchel" },
    { itemId: "iron_ingot", quantity: 4, label: "Refined Iron Ingot Bundle" },
  ],
  smithing: [
    { itemId: "tempered_blade", quantity: 1, label: "Tempered Blade" },
    { itemId: "brigandine_plate", quantity: 1, label: "Brigandine Plate" },
    { itemId: "tower_shield", quantity: 1, label: "Tower Shield" },
    { itemId: "smithing_hammer", quantity: 1, label: "Smithing Hammer" },
    { itemId: "iron_ingot", quantity: 6, label: "Forge Ingot Bundle" },
  ],
  alchemy: [
    { itemId: "healing_tonic", quantity: 2, label: "Healing Tonic Pack" },
    { itemId: "focus_draught", quantity: 2, label: "Focus Draught Pack" },
    { itemId: "antitoxin", quantity: 2, label: "Antitoxin Satchel" },
    { itemId: "fire_acid", quantity: 1, label: "Fire Acid Flask" },
    { itemId: "restorative_elixir", quantity: 1, label: "Restorative Elixir" },
  ],
  agriculture: [
    { itemId: "grain_bundle", quantity: 5, label: "Grain Bundle" },
    { itemId: "preserved_meat", quantity: 3, label: "Preserved Meat Crate" },
    { itemId: "livestock_goods", quantity: 3, label: "Livestock Goods Pack" },
    { itemId: "farming_supplies", quantity: 4, label: "Farming Supply Stack" },
    { itemId: "rations", quantity: 5, label: "Field Rations Box" },
  ],
  textile: [
    { itemId: "linen_roll", quantity: 3, label: "Linen Roll" },
    { itemId: "dyed_cloth", quantity: 3, label: "Dyed Cloth Bundle" },
    { itemId: "tailoring_materials", quantity: 4, label: "Tailoring Materials Pack" },
    { itemId: "field_uniform", quantity: 1, label: "Field Uniform" },
    { itemId: "travel_cloak", quantity: 1, label: "Travel Cloak" },
  ],
  luxury: [
    { itemId: "silver_jewelry", quantity: 1, label: "Silver Jewelry Piece" },
    { itemId: "gold_jewelry", quantity: 1, label: "Gold Jewelry Piece" },
    { itemId: "rare_materials", quantity: 2, label: "Rare Material Parcel" },
    { itemId: "prestige_goods", quantity: 1, label: "Prestige Good" },
    { itemId: "engraved_goblet", quantity: 1, label: "Engraved Goblet" },
  ],
};

const CONSORTIUM_TYPES = {
  merchant: {
    key: "merchant",
    displayName: "Merchant Consortium",
    creationCost: 250000,
    description: "Market leverage, contracts, pricing, and trade dominance.",
    rolesFlavor: ["director", "broker", "factor", "quartermaster", "clerk"],
    rewards: [
      reward({ starTier: 1, rewardKey: "price_pulse", displayName: "Price Pulse", mode: "active", pointCost: 2, effectSummary: "Reveal the best current legal vendor price for one item category or trade-good group." }),
      reward({ starTier: 3, rewardKey: "market_sense", displayName: "Market Sense", mode: "passive", effectSummary: "Small permanent improvement to legal sell prices and reduced vendor fee friction." }),
      reward({ starTier: 5, rewardKey: "contract_flip", displayName: "Contract Flip", mode: "active", pointCost: 18, effectSummary: "Boost payout on one eligible trade contract or listing batch." }),
      reward({ starTier: 7, rewardKey: "commercial_reach", displayName: "Commercial Reach", mode: "passive", effectSummary: "Increased trade reputation gain and improved contract availability." }),
      reward({ starTier: 10, rewardKey: "golden_window", displayName: "Golden Window", mode: "active", pointCost: 60, effectSummary: "Short-duration premium commerce window with stronger sale margin bonus." }),
    ],
  },
  logistics: {
    key: "logistics",
    displayName: "Logistics Consortium",
    creationCost: 325000,
    description: "Warehousing, route efficiency, freight handling, and storage discipline.",
    rolesFlavor: ["director", "dispatcher", "hauler", "quartermaster", "warehouse master"],
    rewards: [
      reward({ starTier: 1, rewardKey: "priority_load", displayName: "Priority Load", mode: "active", pointCost: 2, effectSummary: "Temporary cargo-capacity or shipment-capacity boost on the next transport action." }),
      reward({ starTier: 3, rewardKey: "warehouse_discipline", displayName: "Warehouse Discipline", mode: "passive", effectSummary: "Higher storage capacity and reduced stock loss/spoilage." }),
      reward({ starTier: 5, rewardKey: "route_familiarity", displayName: "Route Familiarity", mode: "passive", effectSummary: "Reduced travel inefficiency and improved cargo throughput." }),
      reward({ starTier: 7, rewardKey: "fast_dispatch", displayName: "Fast Dispatch", mode: "active", pointCost: 20, effectSummary: "Reduce the time of one travel or delivery action." }),
      reward({ starTier: 10, rewardKey: "secure_chain", displayName: "Secure Chain", mode: "active", pointCost: 65, effectSummary: "Protect one shipment against part of its loss/disruption/spoilage risk." }),
    ],
  },
  mining: {
    key: "mining",
    displayName: "Mining Consortium",
    creationCost: 450000,
    description: "Ore, gems, extraction, surveying, and refining.",
    rolesFlavor: ["director", "surveyor", "miner", "refiner", "pit foreman"],
    rewards: [
      reward({ starTier: 1, rewardKey: "survey_strike", displayName: "Survey Strike", mode: "active", pointCost: 3, effectSummary: "Improve the next resource node yield roll." }),
      reward({ starTier: 3, rewardKey: "deep_extraction", displayName: "Deep Extraction", mode: "passive", effectSummary: "Permanent bonus to raw extraction yield." }),
      reward({ starTier: 5, rewardKey: "rich_vein", displayName: "Rich Vein", mode: "active", pointCost: 18, effectSummary: "Improve the chance of rare or higher-quality ore/gem output on one extraction." }),
      reward({ starTier: 7, rewardKey: "master_refiners", displayName: "Master Refiners", mode: "passive", effectSummary: "Permanent bonus to refining efficiency and refined-material return." }),
      reward({ starTier: 10, rewardKey: "motherlode", displayName: "Motherlode", mode: "active", pointCost: 70, effectSummary: "Greatly enhance one major mining/refining operation.", poolKey: "mining" }),
    ],
  },
  smithing: {
    key: "smithing",
    displayName: "Smithing Consortium",
    creationCost: 400000,
    description: "Forged gear, weapons, armor, shields, tools, and industrial craftsmanship.",
    rolesFlavor: ["director", "smith", "armorer", "toolmaker", "forge master"],
    rewards: [
      reward({ starTier: 1, rewardKey: "tempered_batch", displayName: "Tempered Batch", mode: "active", pointCost: 3, effectSummary: "Improve quality on the next crafted weapon/armor/tool batch." }),
      reward({ starTier: 3, rewardKey: "industrial_rhythm", displayName: "Industrial Rhythm", mode: "passive", effectSummary: "Faster forging and industrial crafting time." }),
      reward({ starTier: 5, rewardKey: "forge_cache", displayName: "Forge Cache", mode: "active", pointCost: 20, effectSummary: "Grant a random forged reward from curated smithing pools.", poolKey: "smithing" }),
      reward({ starTier: 7, rewardKey: "masterwork_discipline", displayName: "Masterwork Discipline", mode: "passive", effectSummary: "Higher crafted gear quality and better enhancement success chance." }),
      reward({ starTier: 10, rewardKey: "masterwork_commission", displayName: "Masterwork Commission", mode: "active", pointCost: 75, effectSummary: "Strong chance of superior forged output on one major craft." }),
    ],
  },
  alchemy: {
    key: "alchemy",
    displayName: "Alchemy Consortium",
    creationCost: 375000,
    description: "Potions, reagents, compounds, tonics, draughts, and chemical craft.",
    rolesFlavor: ["director", "alchemist", "brewer", "herbalist", "laboratory master"],
    rewards: [
      reward({ starTier: 1, rewardKey: "stable_mixture", displayName: "Stable Mixture", mode: "active", pointCost: 2, effectSummary: "Improve success chance on one potion/elixir batch." }),
      reward({ starTier: 3, rewardKey: "reagent_cache", displayName: "Reagent Cache", mode: "active", pointCost: 12, effectSummary: "Grant a random alchemical reward from curated alchemy pools.", poolKey: "alchemy" }),
      reward({ starTier: 5, rewardKey: "preserved_reagents", displayName: "Preserved Reagents", mode: "passive", effectSummary: "Reduced reagent spoilage and better ingredient efficiency." }),
      reward({ starTier: 7, rewardKey: "potent_distillation", displayName: "Potent Distillation", mode: "active", pointCost: 26, effectSummary: "Increase potency/duration of one eligible alchemical batch." }),
      reward({ starTier: 10, rewardKey: "arcane_pharmacology", displayName: "Arcane Pharmacology", mode: "passive", effectSummary: "Permanent bonus to brew reliability and consumable effectiveness." }),
    ],
  },
  healing: {
    key: "healing",
    displayName: "Healing Consortium",
    creationCost: 450000,
    description: "Treatment, recovery, clinics, surgeons, and medical supply chains.",
    rolesFlavor: ["director", "physician", "apothecary", "surgeon", "matron"],
    rewards: [
      reward({ starTier: 1, rewardKey: "field_treatment", displayName: "Field Treatment", mode: "active", pointCost: 2, effectSummary: "Instant small health restoration or minor recovery reduction." }),
      reward({ starTier: 3, rewardKey: "clinical_precision", displayName: "Clinical Precision", mode: "passive", effectSummary: "Improved treatment effectiveness and reduced recovery friction." }),
      reward({ starTier: 5, rewardKey: "recovery_protocol", displayName: "Recovery Protocol", mode: "active", pointCost: 18, effectSummary: "Reduce one hospital/recovery timer." }),
      reward({ starTier: 7, rewardKey: "house_of_restoration", displayName: "House of Restoration", mode: "passive", effectSummary: "Permanent recovery speed bonus and stronger medical consumables." }),
      reward({ starTier: 10, rewardKey: "emergency_intervention", displayName: "Emergency Intervention", mode: "active", pointCost: 70, effectSummary: "Large one-time recovery support action within existing recovery rules." }),
    ],
  },
  intelligence: {
    key: "intelligence",
    displayName: "Intelligence Consortium",
    creationCost: 600000,
    description: "Rumors, dossiers, scouting, information brokerage, and target intelligence.",
    rolesFlavor: ["director", "analyst", "scout", "broker", "handler"],
    rewards: [
      reward({ starTier: 1, rewardKey: "rumor_pull", displayName: "Rumor Pull", mode: "active", pointCost: 3, effectSummary: "Reveal one useful rumor/intel lead." }),
      reward({ starTier: 3, rewardKey: "whisper_network", displayName: "Whisper Network", mode: "passive", effectSummary: "Improved rumor accuracy and faster intelligence refresh." }),
      reward({ starTier: 5, rewardKey: "dossier", displayName: "Dossier", mode: "active", pointCost: 18, effectSummary: "Surface better-quality info on a target, contract, route, or organization." }),
      reward({ starTier: 7, rewardKey: "eyes_everywhere", displayName: "Eyes Everywhere", mode: "passive", effectSummary: "Permanent scouting/intel quality bonus." }),
      reward({ starTier: 10, rewardKey: "network_leak", displayName: "Network Leak", mode: "active", pointCost: 80, effectSummary: "Reveal a higher-tier piece of economic/organizational information within safe design boundaries." }),
    ],
  },
  banking: {
    key: "banking",
    displayName: "Banking Consortium",
    creationCost: 850000,
    description: "Lending, treasury control, vaulting, and financial risk management.",
    rolesFlavor: ["director", "banker", "underwriter", "clerk", "treasurer"],
    rewards: [
      reward({ starTier: 1, rewardKey: "safe_transfer", displayName: "Safe Transfer", mode: "active", pointCost: 2, effectSummary: "Reduce risk or fees on one treasury/financial action." }),
      reward({ starTier: 3, rewardKey: "treasury_discipline", displayName: "Treasury Discipline", mode: "passive", effectSummary: "Reduced vault leakage/fees and improved treasury handling." }),
      reward({ starTier: 5, rewardKey: "credit_line", displayName: "Credit Line", mode: "active", pointCost: 22, effectSummary: "Temporary treasury support or one controlled finance boost." }),
      reward({ starTier: 7, rewardKey: "house_of_credit", displayName: "House of Credit", mode: "passive", effectSummary: "Improved financial efficiency and stronger treasury growth." }),
      reward({ starTier: 10, rewardKey: "investment_window", displayName: "Investment Window", mode: "active", pointCost: 85, effectSummary: "Boost return on one qualified economic action or contract payout." }),
    ],
  },
  agriculture: {
    key: "agriculture",
    displayName: "Agriculture Consortium",
    creationCost: 275000,
    description: "Crops, livestock, food preservation, and supply stability.",
    rolesFlavor: ["director", "grower", "breeder", "harvester", "storemaster"],
    rewards: [
      reward({ starTier: 1, rewardKey: "fertile_cycle", displayName: "Fertile Cycle", mode: "active", pointCost: 2, effectSummary: "Improve one crop/livestock yield action." }),
      reward({ starTier: 3, rewardKey: "preserved_harvest", displayName: "Preserved Harvest", mode: "passive", effectSummary: "Reduced food spoilage and better preservation efficiency." }),
      reward({ starTier: 5, rewardKey: "supply_crate", displayName: "Supply Crate", mode: "active", pointCost: 15, effectSummary: "Grant a random agriculture reward from curated pools.", poolKey: "agriculture" }),
      reward({ starTier: 7, rewardKey: "abundant_fields", displayName: "Abundant Fields", mode: "passive", effectSummary: "Permanent bonus to food/raw-agriculture yield." }),
      reward({ starTier: 10, rewardKey: "grand_harvest", displayName: "Grand Harvest", mode: "active", pointCost: 65, effectSummary: "Strong bonus to one large agricultural output action." }),
    ],
  },
  textile: {
    key: "textile",
    displayName: "Textile Consortium",
    creationCost: 300000,
    description: "Fabrics, tailoring, garments, uniforms, and specialist clothwork.",
    rolesFlavor: ["director", "weaver", "tailor", "dyer", "cutter"],
    rewards: [
      reward({ starTier: 1, rewardKey: "fine_thread", displayName: "Fine Thread", mode: "active", pointCost: 2, effectSummary: "Improve one fabric or tailoring batch." }),
      reward({ starTier: 3, rewardKey: "loom_discipline", displayName: "Loom Discipline", mode: "passive", effectSummary: "Faster weaving/spinning/tailoring output." }),
      reward({ starTier: 5, rewardKey: "cloth_cache", displayName: "Cloth Cache", mode: "active", pointCost: 16, effectSummary: "Grant a random textile reward from curated pools.", poolKey: "textile" }),
      reward({ starTier: 7, rewardKey: "master_tailoring", displayName: "Master Tailoring", mode: "passive", effectSummary: "Improved garment quality and specialist fabric output." }),
      reward({ starTier: 10, rewardKey: "signature_outfit", displayName: "Signature Outfit", mode: "active", pointCost: 70, effectSummary: "Greatly improve one premium clothing/uniform creation action." }),
    ],
  },
  shipwright: {
    key: "shipwright",
    displayName: "Shipwright Consortium",
    creationCost: 650000,
    description: "Vessel construction, hull integrity, sea logistics, and maritime efficiency.",
    rolesFlavor: ["director", "shipwright", "navigator", "carpenter", "dockmaster"],
    rewards: [
      reward({ starTier: 1, rewardKey: "dock_priority", displayName: "Dock Priority", mode: "active", pointCost: 3, effectSummary: "Improve one ship/travel preparation action." }),
      reward({ starTier: 3, rewardKey: "hull_discipline", displayName: "Hull Discipline", mode: "passive", effectSummary: "Improved vessel durability and maintenance efficiency." }),
      reward({ starTier: 5, rewardKey: "sea_route_familiarity", displayName: "Sea Route Familiarity", mode: "passive", effectSummary: "Improved maritime travel efficiency and cargo handling." }),
      reward({ starTier: 7, rewardKey: "drydock_surge", displayName: "Drydock Surge", mode: "active", pointCost: 28, effectSummary: "Accelerate one major vessel-related operation." }),
      reward({ starTier: 10, rewardKey: "flagship_run", displayName: "Flagship Run", mode: "active", pointCost: 90, effectSummary: "Strong short-duration maritime throughput bonus." }),
    ],
  },
  luxury: {
    key: "luxury",
    displayName: "Luxury Artisan Consortium",
    creationCost: 500000,
    description: "Jewelry, prestige goods, rare materials, and elite craftsmanship.",
    rolesFlavor: ["director", "jeweler", "artisan", "engraver", "curator"],
    rewards: [
      reward({ starTier: 1, rewardKey: "polished_finish", displayName: "Polished Finish", mode: "active", pointCost: 2, effectSummary: "Improve one prestige-crafting result." }),
      reward({ starTier: 3, rewardKey: "refined_taste", displayName: "Refined Taste", mode: "passive", effectSummary: "Improved luxury-item sale value." }),
      reward({ starTier: 5, rewardKey: "curated_cache", displayName: "Curated Cache", mode: "active", pointCost: 20, effectSummary: "Grant a random luxury reward from curated pools.", poolKey: "luxury" }),
      reward({ starTier: 7, rewardKey: "rare_handling", displayName: "Rare Handling", mode: "passive", effectSummary: "Better efficiency with rare materials and premium output quality." }),
      reward({ starTier: 10, rewardKey: "masterpiece_commission", displayName: "Masterpiece Commission", mode: "active", pointCost: 85, effectSummary: "Strong chance of superior prestige-crafted output on one major craft." }),
    ],
  },
};

const DIRECTOR_POSITION = { key: "director", displayName: "Director", slotCount: 1, statWeights: { manualLabor: 0.2, intelligence: 0.5, endurance: 0.3 }, metricImpact: { popularity: 8, efficiency: 8, environment: 6 }, cpModifier: 2 };

const POSITION_TEMPLATES = {
  merchant: [{ key: "broker", displayName: "Broker", slotCount: 2, statWeights: { manualLabor: 0.1, intelligence: 0.7, endurance: 0.2 }, metricImpact: { popularity: 14, efficiency: 8, environment: 3 }, cpModifier: 1 }, { key: "factor", displayName: "Factor", slotCount: 2, statWeights: { manualLabor: 0.15, intelligence: 0.55, endurance: 0.3 }, metricImpact: { popularity: 8, efficiency: 11, environment: 4 }, cpModifier: 1 }, { key: "quartermaster", displayName: "Quartermaster", slotCount: 1, statWeights: { manualLabor: 0.45, intelligence: 0.2, endurance: 0.35 }, metricImpact: { popularity: 3, efficiency: 12, environment: 7 }, cpModifier: 1 }, { key: "clerk", displayName: "Clerk", slotCount: 1, statWeights: { manualLabor: 0.15, intelligence: 0.75, endurance: 0.1 }, metricImpact: { popularity: 5, efficiency: 9, environment: 5 }, cpModifier: 0 }],
  logistics: [{ key: "dispatcher", displayName: "Dispatcher", slotCount: 2, statWeights: { manualLabor: 0.1, intelligence: 0.65, endurance: 0.25 }, metricImpact: { popularity: 8, efficiency: 13, environment: 3 }, cpModifier: 1 }, { key: "hauler", displayName: "Hauler", slotCount: 2, statWeights: { manualLabor: 0.45, intelligence: 0.1, endurance: 0.45 }, metricImpact: { popularity: 2, efficiency: 10, environment: 7 }, cpModifier: 1 }, { key: "quartermaster", displayName: "Quartermaster", slotCount: 1, statWeights: { manualLabor: 0.35, intelligence: 0.25, endurance: 0.4 }, metricImpact: { popularity: 3, efficiency: 11, environment: 8 }, cpModifier: 1 }, { key: "warehouse_master", displayName: "Warehouse Master", slotCount: 1, statWeights: { manualLabor: 0.35, intelligence: 0.35, endurance: 0.3 }, metricImpact: { popularity: 2, efficiency: 9, environment: 10 }, cpModifier: 1 }],
  mining: [{ key: "surveyor", displayName: "Surveyor", slotCount: 1, statWeights: { manualLabor: 0.1, intelligence: 0.7, endurance: 0.2 }, metricImpact: { popularity: 4, efficiency: 12, environment: 4 }, cpModifier: 1 }, { key: "miner", displayName: "Miner", slotCount: 2, statWeights: { manualLabor: 0.5, intelligence: 0.05, endurance: 0.45 }, metricImpact: { popularity: 1, efficiency: 10, environment: 6 }, cpModifier: 1 }, { key: "refiner", displayName: "Refiner", slotCount: 2, statWeights: { manualLabor: 0.3, intelligence: 0.4, endurance: 0.3 }, metricImpact: { popularity: 2, efficiency: 12, environment: 5 }, cpModifier: 1 }, { key: "pit_foreman", displayName: "Pit Foreman", slotCount: 1, statWeights: { manualLabor: 0.25, intelligence: 0.35, endurance: 0.4 }, metricImpact: { popularity: 2, efficiency: 9, environment: 10 }, cpModifier: 1 }],
  smithing: [{ key: "smith", displayName: "Smith", slotCount: 2, statWeights: { manualLabor: 0.45, intelligence: 0.15, endurance: 0.4 }, metricImpact: { popularity: 2, efficiency: 11, environment: 5 }, cpModifier: 1 }, { key: "armorer", displayName: "Armorer", slotCount: 2, statWeights: { manualLabor: 0.4, intelligence: 0.25, endurance: 0.35 }, metricImpact: { popularity: 4, efficiency: 10, environment: 5 }, cpModifier: 1 }, { key: "toolmaker", displayName: "Toolmaker", slotCount: 1, statWeights: { manualLabor: 0.35, intelligence: 0.4, endurance: 0.25 }, metricImpact: { popularity: 3, efficiency: 12, environment: 5 }, cpModifier: 1 }, { key: "forge_master", displayName: "Forge Master", slotCount: 1, statWeights: { manualLabor: 0.25, intelligence: 0.4, endurance: 0.35 }, metricImpact: { popularity: 3, efficiency: 10, environment: 9 }, cpModifier: 1 }],
  alchemy: [{ key: "alchemist", displayName: "Alchemist", slotCount: 2, statWeights: { manualLabor: 0.1, intelligence: 0.75, endurance: 0.15 }, metricImpact: { popularity: 5, efficiency: 12, environment: 4 }, cpModifier: 1 }, { key: "brewer", displayName: "Brewer", slotCount: 2, statWeights: { manualLabor: 0.2, intelligence: 0.55, endurance: 0.25 }, metricImpact: { popularity: 3, efficiency: 11, environment: 5 }, cpModifier: 1 }, { key: "herbalist", displayName: "Herbalist", slotCount: 1, statWeights: { manualLabor: 0.35, intelligence: 0.35, endurance: 0.3 }, metricImpact: { popularity: 3, efficiency: 8, environment: 10 }, cpModifier: 1 }, { key: "laboratory_master", displayName: "Laboratory Master", slotCount: 1, statWeights: { manualLabor: 0.1, intelligence: 0.65, endurance: 0.25 }, metricImpact: { popularity: 2, efficiency: 11, environment: 10 }, cpModifier: 1 }],
  healing: [{ key: "physician", displayName: "Physician", slotCount: 2, statWeights: { manualLabor: 0.1, intelligence: 0.7, endurance: 0.2 }, metricImpact: { popularity: 6, efficiency: 10, environment: 8 }, cpModifier: 1 }, { key: "apothecary", displayName: "Apothecary", slotCount: 1, statWeights: { manualLabor: 0.2, intelligence: 0.55, endurance: 0.25 }, metricImpact: { popularity: 3, efficiency: 9, environment: 9 }, cpModifier: 1 }, { key: "surgeon", displayName: "Surgeon", slotCount: 2, statWeights: { manualLabor: 0.2, intelligence: 0.6, endurance: 0.2 }, metricImpact: { popularity: 5, efficiency: 12, environment: 5 }, cpModifier: 1 }, { key: "matron", displayName: "Matron", slotCount: 1, statWeights: { manualLabor: 0.15, intelligence: 0.35, endurance: 0.5 }, metricImpact: { popularity: 2, efficiency: 7, environment: 12 }, cpModifier: 1 }],
  intelligence: [{ key: "analyst", displayName: "Analyst", slotCount: 2, statWeights: { manualLabor: 0.05, intelligence: 0.8, endurance: 0.15 }, metricImpact: { popularity: 5, efficiency: 13, environment: 3 }, cpModifier: 1 }, { key: "scout", displayName: "Scout", slotCount: 2, statWeights: { manualLabor: 0.2, intelligence: 0.35, endurance: 0.45 }, metricImpact: { popularity: 4, efficiency: 8, environment: 6 }, cpModifier: 1 }, { key: "broker", displayName: "Broker", slotCount: 1, statWeights: { manualLabor: 0.05, intelligence: 0.75, endurance: 0.2 }, metricImpact: { popularity: 11, efficiency: 7, environment: 4 }, cpModifier: 1 }, { key: "handler", displayName: "Handler", slotCount: 1, statWeights: { manualLabor: 0.1, intelligence: 0.55, endurance: 0.35 }, metricImpact: { popularity: 3, efficiency: 9, environment: 10 }, cpModifier: 1 }],
  banking: [{ key: "banker", displayName: "Banker", slotCount: 2, statWeights: { manualLabor: 0.05, intelligence: 0.8, endurance: 0.15 }, metricImpact: { popularity: 8, efficiency: 11, environment: 4 }, cpModifier: 1 }, { key: "underwriter", displayName: "Underwriter", slotCount: 1, statWeights: { manualLabor: 0.05, intelligence: 0.85, endurance: 0.1 }, metricImpact: { popularity: 3, efficiency: 13, environment: 4 }, cpModifier: 1 }, { key: "clerk", displayName: "Clerk", slotCount: 2, statWeights: { manualLabor: 0.1, intelligence: 0.7, endurance: 0.2 }, metricImpact: { popularity: 2, efficiency: 10, environment: 6 }, cpModifier: 0 }, { key: "treasurer", displayName: "Treasurer", slotCount: 1, statWeights: { manualLabor: 0.1, intelligence: 0.65, endurance: 0.25 }, metricImpact: { popularity: 2, efficiency: 9, environment: 11 }, cpModifier: 1 }],
  agriculture: [{ key: "grower", displayName: "Grower", slotCount: 2, statWeights: { manualLabor: 0.35, intelligence: 0.2, endurance: 0.45 }, metricImpact: { popularity: 3, efficiency: 9, environment: 10 }, cpModifier: 1 }, { key: "breeder", displayName: "Breeder", slotCount: 1, statWeights: { manualLabor: 0.25, intelligence: 0.25, endurance: 0.5 }, metricImpact: { popularity: 2, efficiency: 8, environment: 11 }, cpModifier: 1 }, { key: "harvester", displayName: "Harvester", slotCount: 2, statWeights: { manualLabor: 0.45, intelligence: 0.1, endurance: 0.45 }, metricImpact: { popularity: 1, efficiency: 10, environment: 7 }, cpModifier: 1 }, { key: "storemaster", displayName: "Storemaster", slotCount: 1, statWeights: { manualLabor: 0.2, intelligence: 0.45, endurance: 0.35 }, metricImpact: { popularity: 2, efficiency: 9, environment: 10 }, cpModifier: 1 }],
  textile: [{ key: "weaver", displayName: "Weaver", slotCount: 2, statWeights: { manualLabor: 0.35, intelligence: 0.25, endurance: 0.4 }, metricImpact: { popularity: 2, efficiency: 10, environment: 8 }, cpModifier: 1 }, { key: "tailor", displayName: "Tailor", slotCount: 2, statWeights: { manualLabor: 0.2, intelligence: 0.5, endurance: 0.3 }, metricImpact: { popularity: 6, efficiency: 9, environment: 6 }, cpModifier: 1 }, { key: "dyer", displayName: "Dyer", slotCount: 1, statWeights: { manualLabor: 0.25, intelligence: 0.45, endurance: 0.3 }, metricImpact: { popularity: 5, efficiency: 8, environment: 6 }, cpModifier: 1 }, { key: "cutter", displayName: "Cutter", slotCount: 1, statWeights: { manualLabor: 0.35, intelligence: 0.35, endurance: 0.3 }, metricImpact: { popularity: 3, efficiency: 11, environment: 5 }, cpModifier: 1 }],
  shipwright: [{ key: "shipwright", displayName: "Shipwright", slotCount: 2, statWeights: { manualLabor: 0.4, intelligence: 0.2, endurance: 0.4 }, metricImpact: { popularity: 2, efficiency: 10, environment: 7 }, cpModifier: 1 }, { key: "navigator", displayName: "Navigator", slotCount: 1, statWeights: { manualLabor: 0.05, intelligence: 0.75, endurance: 0.2 }, metricImpact: { popularity: 4, efficiency: 12, environment: 4 }, cpModifier: 1 }, { key: "carpenter", displayName: "Carpenter", slotCount: 2, statWeights: { manualLabor: 0.45, intelligence: 0.15, endurance: 0.4 }, metricImpact: { popularity: 1, efficiency: 9, environment: 8 }, cpModifier: 1 }, { key: "dockmaster", displayName: "Dockmaster", slotCount: 1, statWeights: { manualLabor: 0.2, intelligence: 0.45, endurance: 0.35 }, metricImpact: { popularity: 5, efficiency: 11, environment: 6 }, cpModifier: 1 }],
  luxury: [{ key: "jeweler", displayName: "Jeweler", slotCount: 2, statWeights: { manualLabor: 0.15, intelligence: 0.55, endurance: 0.3 }, metricImpact: { popularity: 9, efficiency: 8, environment: 4 }, cpModifier: 1 }, { key: "artisan", displayName: "Artisan", slotCount: 2, statWeights: { manualLabor: 0.25, intelligence: 0.45, endurance: 0.3 }, metricImpact: { popularity: 7, efficiency: 9, environment: 5 }, cpModifier: 1 }, { key: "engraver", displayName: "Engraver", slotCount: 1, statWeights: { manualLabor: 0.15, intelligence: 0.65, endurance: 0.2 }, metricImpact: { popularity: 8, efficiency: 7, environment: 4 }, cpModifier: 1 }, { key: "curator", displayName: "Curator", slotCount: 1, statWeights: { manualLabor: 0.05, intelligence: 0.7, endurance: 0.25 }, metricImpact: { popularity: 10, efficiency: 6, environment: 6 }, cpModifier: 1 }]
};

const DAILY_POINTS_BY_STARS = {
  1: 2,
  3: 4,
  5: 6,
  7: 9,
  10: 12,
};

function cloneDefinition(entry) {
  return {
    ...entry,
    directorPosition: { ...DIRECTOR_POSITION },
    positions: (POSITION_TEMPLATES[entry.key] ?? []).map((positionEntry) => ({ ...positionEntry, statWeights: { ...positionEntry.statWeights }, metricImpact: { ...positionEntry.metricImpact } })),
    rolesFlavor: [...entry.rolesFlavor],
    rewards: entry.rewards.map((rewardEntry) => ({ ...rewardEntry })),
  };
}

export function listConsortiumTypes() {
  return Object.values(CONSORTIUM_TYPES).map(cloneDefinition);
}

export function getConsortiumTypeDefinition(key) {
  const definition = CONSORTIUM_TYPES[String(key ?? "").trim().toLowerCase()];
  return definition ? cloneDefinition(definition) : null;
}

export function getRewardByKey(typeKey, rewardKey) {
  const definition = getConsortiumTypeDefinition(typeKey);
  if (!definition) return null;
  return definition.rewards.find((entry) => entry.rewardKey === rewardKey) ?? null;
}

export function getConsortiumPositionDefinition(typeKey, positionKey) {
  const definition = getConsortiumTypeDefinition(typeKey);
  if (!definition) return null;
  if (positionKey === "director") return definition.directorPosition;
  return definition.positions.find((entry) => entry.key === positionKey) ?? null;
}

export function listConsortiumPositions(typeKey) {
  const definition = getConsortiumTypeDefinition(typeKey);
  if (!definition) return [];
  return [definition.directorPosition, ...definition.positions];
}

export function deriveConsortiumStarsFromPerformance(score) {
  const numeric = Number(score ?? 0);
  if (numeric >= 80) return 10;
  if (numeric >= 60) return 7;
  if (numeric >= 40) return 5;
  if (numeric >= 20) return 3;
  return 1;
}

export function deriveConsortiumStarsFromRoster(memberCount) {
  if (memberCount >= 8) return 10;
  if (memberCount >= 5) return 7;
  if (memberCount >= 3) return 5;
  if (memberCount >= 1) return 3;
  return 1;
}

export function getDailyConsortiumPointsForStars(stars) {
  const numeric = Number(stars ?? 0);
  if (numeric >= 10) return DAILY_POINTS_BY_STARS[10];
  if (numeric >= 7) return DAILY_POINTS_BY_STARS[7];
  if (numeric >= 5) return DAILY_POINTS_BY_STARS[5];
  if (numeric >= 3) return DAILY_POINTS_BY_STARS[3];
  return DAILY_POINTS_BY_STARS[1];
}

export function getUnlockedPassives(typeKey, stars) {
  const definition = getConsortiumTypeDefinition(typeKey);
  if (!definition) return [];
  return definition.rewards.filter((entry) => entry.mode === "passive" && Number(stars ?? 0) >= entry.starTier);
}

export function getActiveRewards(typeKey, stars, points) {
  const definition = getConsortiumTypeDefinition(typeKey);
  if (!definition) return [];
  return definition.rewards
    .filter((entry) => entry.mode === "active")
    .map((entry) => ({
      ...entry,
      unlocked: Number(stars ?? 0) >= entry.starTier,
      canRedeem: Number(stars ?? 0) >= entry.starTier && Number(points ?? 0) >= Number(entry.pointCost ?? 0),
    }));
}

export function chooseRandomReward(poolKey, random = Math.random) {
  const pool = CONSORTIUM_RANDOM_REWARD_POOLS[String(poolKey ?? "")];
  if (!Array.isArray(pool) || pool.length === 0) return null;
  const index = Math.max(0, Math.min(pool.length - 1, Math.floor(random() * pool.length)));
  return { ...pool[index] };
}

export function getSupportedStarTiers() {
  return [...STAR_TIERS];
}

export { STAR_TIERS };
