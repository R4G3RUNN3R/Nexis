export const NPC_OPPONENTS = {
  training_squire: {
    id: "training_squire",
    name: "Training Squire",
    tier: 1,
    summary: "A careful sparring partner for early arena testing.",
    level: 1,
    health: 70,
    battleStats: { strength: 8, defense: 8, speed: 8, dexterity: 8 },
    reward: { gold: 18, experience: 16, skillXp: 12 },
  },
  road_cutpurse: {
    id: "road_cutpurse",
    name: "Road Cutpurse",
    tier: 1,
    summary: "A quick opportunist who tests route awareness more than courage.",
    level: 1,
    health: 68,
    battleStats: { strength: 9, defense: 7, speed: 12, dexterity: 12 },
    reward: { gold: 24, experience: 20, skillXp: 12, item: { itemId: "rations", label: "Rations" } },
  },
  dock_bruiser: {
    id: "dock_bruiser",
    name: "Dock Bruiser",
    tier: 2,
    summary: "A Blackharbor heavy who believes manifests are best discussed with elbows.",
    level: 2,
    health: 92,
    battleStats: { strength: 14, defense: 12, speed: 9, dexterity: 9 },
    reward: { gold: 34, experience: 28, skillXp: 14, item: { itemId: "rope", label: "Rope" } },
  },
  ward_stray: {
    id: "ward_stray",
    name: "Ward-Struck Stray",
    tier: 2,
    summary: "A panicked Silverbough road threat wrapped in bad light and worse instincts.",
    level: 2,
    health: 86,
    battleStats: { strength: 11, defense: 10, speed: 13, dexterity: 12 },
    reward: { gold: 28, experience: 30, skillXp: 14, item: { itemId: "wild_herb", label: "Wild Herb" } },
  },
  forge_rowdy: {
    id: "forge_rowdy",
    name: "Forge Rowdy",
    tier: 2,
    summary: "An Ironhall brawler with a workman's stance and a very avoidable attitude.",
    level: 2,
    health: 96,
    battleStats: { strength: 15, defense: 14, speed: 8, dexterity: 8 },
    reward: { gold: 32, experience: 28, skillXp: 14, item: { itemId: "coal", label: "Coal" } },
  },
  court_challenger: {
    id: "court_challenger",
    name: "Court Challenger",
    tier: 2,
    summary: "A Highcourt sparring opponent with excellent posture and tolerable manners.",
    level: 2,
    health: 88,
    battleStats: { strength: 10, defense: 12, speed: 13, dexterity: 14 },
    reward: { gold: 38, experience: 30, skillXp: 14, item: { itemId: "wax_seal", label: "Wax Seal" } },
  },
  arena_veteran: {
    id: "arena_veteran",
    name: "Arena Veteran",
    tier: 3,
    summary: "A disciplined sparring opponent who politely exposes bad builds.",
    level: 4,
    health: 126,
    battleStats: { strength: 18, defense: 17, speed: 16, dexterity: 16 },
    reward: { gold: 55, experience: 44, skillXp: 18 },
  },
};

export const ARENA_NPC_OPPONENTS = [
  "training_squire",
  "road_cutpurse",
  "dock_bruiser",
  "ward_stray",
  "forge_rowdy",
  "court_challenger",
  "arena_veteran",
];

export const TRAVEL_OPPONENT_BY_TAG = [
  { tags: ["sea_lane", "smuggling_pressure", "privateer_waters"], opponentId: "dock_bruiser" },
  { tags: ["warded_woods", "relic_material_trade", "northern_road"], opponentId: "ward_stray" },
  { tags: ["forge_road", "material_convoys", "highland_forge_road", "industrial_court_road"], opponentId: "forge_rowdy" },
  { tags: ["court_road", "permit_checks", "permit_caravans", "legal_cargo_lane"], opponentId: "court_challenger" },
];

export function getNpcOpponent(opponentId) {
  return NPC_OPPONENTS[opponentId] ?? NPC_OPPONENTS.training_squire;
}

export function getArenaNpcOpponents() {
  return ARENA_NPC_OPPONENTS.map((opponentId) => NPC_OPPONENTS[opponentId]).filter(Boolean);
}

export function getTravelOpponentForRoute(route) {
  const tags = Array.isArray(route?.encounterTags) ? route.encounterTags : [];
  const match = TRAVEL_OPPONENT_BY_TAG.find((entry) => entry.tags.some((tag) => tags.includes(tag)));
  return getNpcOpponent(match?.opponentId ?? "road_cutpurse");
}
