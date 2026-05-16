const ROUTE_TEMPLATES = [
  {
    key: "local_caravan_run",
    displayName: "Local Caravan Run",
    summary: "Move guarded everyday cargo between Nexis markets and nearby districts.",
    routeType: "caravan",
    lane: "local",
    riskLevel: "low",
    upfrontCostGold: 500,
    durationHours: 12,
    rewardRange: { minGold: 1500, maxGold: 5000 },
    dangerTags: ["bandits", "weather"],
    dangerProfile: "Short road work with routine disruption risk and modest escort demand.",
    recommendedWorkers: 1,
    recommendedWorkingScore: 36,
    recommendedBattleScore: 24,
    escortEligible: true,
  },
  {
    key: "regional_caravan_run",
    displayName: "Regional Caravan Run",
    summary: "Push higher-value freight through longer overland lanes with multiple choke points.",
    routeType: "caravan",
    lane: "regional",
    riskLevel: "medium",
    upfrontCostGold: 1200,
    durationHours: 24,
    rewardRange: { minGold: 4000, maxGold: 9000 },
    dangerTags: ["bandits", "monsters", "weather", "sabotage"],
    dangerProfile: "Longer roads increase exposure to raids, breakdowns, and hostile interference.",
    recommendedWorkers: 2,
    recommendedWorkingScore: 60,
    recommendedBattleScore: 42,
    escortEligible: true,
  },
  {
    key: "sea_cargo_shipment",
    displayName: "Sea Cargo Shipment",
    summary: "Launch a maritime freight job that trades road risk for open-water threat and port timing.",
    routeType: "ship",
    lane: "sea",
    riskLevel: "high",
    upfrontCostGold: 2200,
    durationHours: 36,
    rewardRange: { minGold: 6000, maxGold: 14000 },
    dangerTags: ["pirates", "weather", "sabotage"],
    dangerProfile: "Sea lanes promise better margins, but pirates and storms are not known for polite negotiations.",
    recommendedWorkers: 2,
    recommendedWorkingScore: 72,
    recommendedBattleScore: 54,
    escortEligible: true,
  },
  {
    key: "hazardous_frontier_delivery",
    displayName: "Hazardous Frontier Delivery",
    summary: "Take sensitive freight into unstable territory where monsters and ambushes are part of the invoice.",
    routeType: "caravan",
    lane: "frontier",
    riskLevel: "severe",
    upfrontCostGold: 1800,
    durationHours: 30,
    rewardRange: { minGold: 7000, maxGold: 16000 },
    dangerTags: ["bandits", "monsters", "weather", "sabotage"],
    dangerProfile: "A frontier run with high reward promise and the sort of danger profile that keeps quartermasters awake.",
    recommendedWorkers: 3,
    recommendedWorkingScore: 84,
    recommendedBattleScore: 72,
    escortEligible: true,
  },
];

const ESCORT_MODES = [
  {
    key: "none",
    displayName: "No Escort",
    summary: "Run the lane uncovered and accept the full route pressure.",
  },
  {
    key: "internal_team",
    displayName: "Internal Cover",
    summary: "Use assigned consortium staff as rough escort coverage.",
  },
  {
    key: "guild_contract",
    displayName: "Guild Contract",
    summary: "Attach a real guild as the escort placeholder for future contracted protection.",
  },
];

export function listConsortiumLogisticsTemplates() {
  return ROUTE_TEMPLATES.map((template) => ({
    ...template,
    rewardRange: { ...template.rewardRange },
    dangerTags: [...template.dangerTags],
  }));
}

export function getConsortiumLogisticsTemplate(templateKey) {
  return listConsortiumLogisticsTemplates().find((template) => template.key === String(templateKey ?? "")) ?? null;
}

export function listConsortiumEscortModes() {
  return ESCORT_MODES.map((mode) => ({ ...mode }));
}
