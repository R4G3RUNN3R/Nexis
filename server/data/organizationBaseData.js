const ACQUISITION_MODES = {
  BUILDING_PURCHASE: "building_purchase",
  PLOT_CONSTRUCTION: "plot_construction",
};

export const PROPERTY_OFFICE_MIN_LEVEL = 15;
export const PROPERTY_OFFICE_NPC_SELLBACK_RETURN_FRACTION = 0.65;

const ELIGIBLE_BUILDINGS = [
  {
    key: "nexis_guildhall_keep",
    displayName: "Nexis Guildhall Keep",
    cityId: "nexis",
    allowedOrganizationTypes: ["guild"],
    acquisitionCostGold: 220000,
    monthlyUpkeepGold: 18000,
  },
  {
    key: "blackharbor_guild_drydock_hq",
    displayName: "Blackharbor Drydock Headquarters",
    cityId: "blackharbor",
    allowedOrganizationTypes: ["guild", "consortium"],
    acquisitionCostGold: 265000,
    monthlyUpkeepGold: 22000,
  },
  {
    key: "nexis_commerce_exchange_hall",
    displayName: "Nexis Commerce Exchange Hall",
    cityId: "nexis",
    allowedOrganizationTypes: ["consortium"],
    acquisitionCostGold: 240000,
    monthlyUpkeepGold: 21000,
  },
  {
    key: "akai_logistics_yard_hq",
    displayName: "Akai Logistics Yard Headquarters",
    cityId: "akai_tetsu",
    allowedOrganizationTypes: ["consortium"],
    acquisitionCostGold: 255000,
    monthlyUpkeepGold: 21500,
  },
];

const ELIGIBLE_PLOTS = [
  {
    key: "nexis_citadel_plot_s",
    displayName: "Nexis Citadel Plot S",
    cityId: "nexis",
    size: "small",
    roomCapacity: 2,
    allowedOrganizationTypes: ["guild", "consortium"],
    plotCostGold: 90000,
  },
  {
    key: "blackharbor_quayside_plot_m",
    displayName: "Blackharbor Quayside Plot M",
    cityId: "blackharbor",
    size: "medium",
    roomCapacity: 4,
    allowedOrganizationTypes: ["guild", "consortium"],
    plotCostGold: 130000,
  },
  {
    key: "silverbough_ridge_plot_l",
    displayName: "Silverbough Ridge Plot L",
    cityId: "silverbough",
    size: "large",
    roomCapacity: 6,
    allowedOrganizationTypes: ["guild", "consortium"],
    plotCostGold: 170000,
  },
];

const ELIGIBLE_CONSTRUCTIONS = {
  nexis_citadel_hq: {
    key: "nexis_citadel_hq",
    displayName: "Nexis Citadel Headquarters",
    allowedOrganizationTypes: ["guild"],
    constructionCostGold: 110000,
    monthlyUpkeepGold: 19000,
  },
  nexis_ledger_house_hq: {
    key: "nexis_ledger_house_hq",
    displayName: "Nexis Ledger House Headquarters",
    allowedOrganizationTypes: ["consortium"],
    constructionCostGold: 105000,
    monthlyUpkeepGold: 18500,
  },
  blackharbor_watchfort_hq: {
    key: "blackharbor_watchfort_hq",
    displayName: "Blackharbor Watchfort Headquarters",
    allowedOrganizationTypes: ["guild"],
    constructionCostGold: 115000,
    monthlyUpkeepGold: 20000,
  },
  blackharbor_trade_yard_hq: {
    key: "blackharbor_trade_yard_hq",
    displayName: "Blackharbor Trade Yard Headquarters",
    allowedOrganizationTypes: ["consortium"],
    constructionCostGold: 110000,
    monthlyUpkeepGold: 19500,
  },
  silverbough_war_college_hq: {
    key: "silverbough_war_college_hq",
    displayName: "Silverbough War College Headquarters",
    allowedOrganizationTypes: ["guild"],
    constructionCostGold: 120000,
    monthlyUpkeepGold: 21000,
  },
};

const MAIN_BUILDING_V1 = {
  guild: [
    {
      key: "guild_chapter_house",
      displayName: "Chapter House",
      tier: 1,
      durationHours: 18,
      baseGoldCost: 75000,
      laborCostGold: 9000,
      monthlyUpkeepGold: 9000,
      materialRequirements: { timber: 90, stone: 55, iron: 25 },
      materialCreditPerUnit: { timber: 110, stone: 150, iron: 220 },
      complexity: 1.0,
    },
    {
      key: "guild_hall",
      displayName: "Guild Hall",
      tier: 2,
      durationHours: 30,
      baseGoldCost: 120000,
      laborCostGold: 14000,
      monthlyUpkeepGold: 13000,
      materialRequirements: { timber: 145, stone: 95, iron: 45 },
      materialCreditPerUnit: { timber: 120, stone: 165, iron: 245 },
      complexity: 1.15,
    },
    {
      key: "guild_great_hall",
      displayName: "Great Hall",
      tier: 3,
      durationHours: 44,
      baseGoldCost: 180000,
      laborCostGold: 21000,
      monthlyUpkeepGold: 18000,
      materialRequirements: { timber: 220, stone: 150, iron: 75 },
      materialCreditPerUnit: { timber: 125, stone: 175, iron: 260 },
      complexity: 1.3,
    },
  ],
  consortium: [
    {
      key: "consortium_trade_office",
      displayName: "Trade Office",
      tier: 1,
      durationHours: 20,
      baseGoldCost: 82000,
      laborCostGold: 9800,
      monthlyUpkeepGold: 9500,
      materialRequirements: { timber: 80, stone: 60, iron: 35 },
      materialCreditPerUnit: { timber: 110, stone: 145, iron: 230 },
      complexity: 1.0,
    },
    {
      key: "consortium_exchange_house",
      displayName: "Exchange House",
      tier: 2,
      durationHours: 34,
      baseGoldCost: 132000,
      laborCostGold: 15500,
      monthlyUpkeepGold: 14000,
      materialRequirements: { timber: 135, stone: 105, iron: 60 },
      materialCreditPerUnit: { timber: 120, stone: 160, iron: 250 },
      complexity: 1.16,
    },
    {
      key: "consortium_mercantile_hall",
      displayName: "Mercantile Hall",
      tier: 3,
      durationHours: 48,
      baseGoldCost: 192000,
      laborCostGold: 23000,
      monthlyUpkeepGold: 19000,
      materialRequirements: { timber: 200, stone: 165, iron: 95 },
      materialCreditPerUnit: { timber: 125, stone: 175, iron: 270 },
      complexity: 1.33,
    },
  ],
};

const ROOM_UPGRADES_V1 = [
  {
    key: "office",
    displayName: "Office",
    durationHours: 10,
    baseGoldCost: 22000,
    laborCostGold: 4200,
    monthlyUpkeepGold: 1200,
    removalCostGold: 6000,
    complexity: 0.95,
    materialRequirements: { timber: 35, stone: 18, iron: 10 },
    materialCreditPerUnit: { timber: 100, stone: 145, iron: 210 },
  },
  {
    key: "storage_room",
    displayName: "Storage Room",
    durationHours: 12,
    baseGoldCost: 26000,
    laborCostGold: 4600,
    monthlyUpkeepGold: 1400,
    removalCostGold: 7000,
    complexity: 1.0,
    materialRequirements: { timber: 40, stone: 22, iron: 14 },
    materialCreditPerUnit: { timber: 105, stone: 150, iron: 215 },
  },
  {
    key: "contract_board",
    displayName: "Contract Board",
    durationHours: 9,
    baseGoldCost: 20000,
    laborCostGold: 3900,
    monthlyUpkeepGold: 1100,
    removalCostGold: 5600,
    complexity: 0.92,
    materialRequirements: { timber: 28, stone: 16, iron: 12 },
    materialCreditPerUnit: { timber: 100, stone: 145, iron: 210 },
  },
  {
    key: "barracks_security_room",
    displayName: "Barracks / Security Room",
    durationHours: 14,
    baseGoldCost: 32000,
    laborCostGold: 5800,
    monthlyUpkeepGold: 1900,
    removalCostGold: 9000,
    complexity: 1.08,
    materialRequirements: { timber: 48, stone: 30, iron: 20 },
    materialCreditPerUnit: { timber: 110, stone: 160, iron: 225 },
  },
  {
    key: "vault",
    displayName: "Vault",
    durationHours: 16,
    baseGoldCost: 38000,
    laborCostGold: 6400,
    monthlyUpkeepGold: 2400,
    removalCostGold: 10500,
    complexity: 1.15,
    materialRequirements: { timber: 30, stone: 38, iron: 28 },
    materialCreditPerUnit: { timber: 110, stone: 165, iron: 235 },
  },
  {
    key: "archive",
    displayName: "Archive",
    durationHours: 11,
    baseGoldCost: 24000,
    laborCostGold: 4300,
    monthlyUpkeepGold: 1300,
    removalCostGold: 6200,
    complexity: 0.98,
    materialRequirements: { timber: 36, stone: 20, iron: 10 },
    materialCreditPerUnit: { timber: 100, stone: 150, iron: 210 },
  },
];

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function includesType(entry, organizationType) {
  return Array.isArray(entry.allowedOrganizationTypes)
    ? entry.allowedOrganizationTypes.includes(organizationType)
    : false;
}

function normalizePlotEntry(entry) {
  return {
    ...clone(entry),
    requirements: {
      minimumLevel: PROPERTY_OFFICE_MIN_LEVEL,
    },
  };
}

export function listEligibleBuildingTargets(organizationType) {
  return ELIGIBLE_BUILDINGS.filter((entry) => includesType(entry, organizationType)).map(clone);
}

export function listEligiblePlotTargets(organizationType) {
  return ELIGIBLE_PLOTS
    .filter((entry) => includesType(entry, organizationType))
    .map(normalizePlotEntry);
}

export function getEligibleBuildingTarget(buildingKey) {
  return ELIGIBLE_BUILDINGS.find((entry) => entry.key === String(buildingKey ?? "").trim()) ?? null;
}

export function getEligiblePlotTarget(plotKey) {
  const found = ELIGIBLE_PLOTS.find((entry) => entry.key === String(plotKey ?? "").trim()) ?? null;
  return found ? normalizePlotEntry(found) : null;
}

export function getEligibleConstruction(buildingKey) {
  return ELIGIBLE_CONSTRUCTIONS[String(buildingKey ?? "").trim()] ?? null;
}

export function listMainBuildingV1Options(organizationType) {
  const list = MAIN_BUILDING_V1[organizationType] ?? [];
  return clone(list);
}

export function getMainBuildingV1Option(organizationType, buildingKey) {
  const list = MAIN_BUILDING_V1[organizationType] ?? [];
  const key = String(buildingKey ?? "").trim();
  return list.find((entry) => entry.key === key) ?? null;
}


export function listRoomUpgradeV1Options(_organizationType) {
  return clone(ROOM_UPGRADES_V1);
}

export function getRoomUpgradeV1Option(_organizationType, roomKey) {
  const key = String(roomKey ?? "").trim();
  return ROOM_UPGRADES_V1.find((entry) => entry.key === key) ?? null;
}

export function getAcquisitionModes() {
  return { ...ACQUISITION_MODES };
}

export function isValidOrganizationTypeForTarget(target, organizationType) {
  return includesType(target, organizationType);
}
