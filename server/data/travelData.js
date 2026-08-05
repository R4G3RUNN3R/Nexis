import {
  CITY_DEFINITIONS,
  DEFAULT_CITY_ID,
  getCityDefinition,
  getCityName,
  isValidCityId,
  normalizeCityId,
} from "./cityData.js";

export { DEFAULT_CITY_ID, getCityDefinition, getCityName, isValidCityId, normalizeCityId };

export const TRAVEL_CITIES = Object.fromEntries(
  Object.entries(CITY_DEFINITIONS).map(([id, city]) => [id, { id, name: city.name, role: city.role }]),
);

// ─── Route durations: distance-derived, Torn-style base travel times ───
//
// Base durationMs for every route is derived from each city's relative
// position on the world map (xPercent/yPercent from src/data/worldMapData.ts
// `worldCities`, duplicated here as plain constants since this is backend
// code and can't import the frontend TS module). Distance is plain Euclidean
// distance in that percentage-space - it doesn't need to be a real-world
// unit, only consistent relative scale across all 10 city pairs so that
// closer cities produce shorter routes than distant ones.
//
// City positions (keep in sync with src/data/worldMapData.ts worldCities):
//   nexis: (45.6, 49.2)   north: (43.8, 8.9)   east: (60.2, 34.9)
//   west:  (13.4, 24.2)   south: (50.3, 47.8)
//
// Computed distances (sorted, shortest to longest):
//   nexis-south   4.90    east-south   16.26    nexis-east   20.44
//   north-east   30.74    north-west   34.03    north-south  39.44
//   nexis-north  40.34    nexis-west   40.77    west-south   43.80
//   west-east    48.01
//
// Those distances are mapped linearly onto a base-duration range of
// 55 minutes (closest pair, nexis-south) to 225 minutes (farthest pair,
// west-east), then rounded to the nearest 5 minutes. This intentionally
// replaces the old flat 12-18 minute baseline with a much larger,
// Torn-style spread: short/close routes land around 45-75 minutes,
// mid-distance routes land around 90-150 minutes, and long or sea/mixed
// routes land in the 2-4 hour range. Transport tier speed modifiers
// (server/data/transportData.js) apply on top of these base values.
export const TRAVEL_ROUTES = [
  {
    from: "nexis",
    to: "north",
    routeType: "road",
    durationMs: 195 * 60 * 1000, // distance 40.34 - long overland ascent
    danger: 0.35,
    encounterTags: ["northern_road", "warded_woods"],
  },
  {
    from: "nexis",
    to: "east",
    routeType: "road",
    durationMs: 115 * 60 * 1000, // distance 20.44 - medium forge road
    danger: 0.42,
    encounterTags: ["forge_road", "material_convoys"],
  },
  {
    from: "nexis",
    to: "west",
    routeType: "sea",
    durationMs: 195 * 60 * 1000, // distance 40.77 - long sea crossing
    danger: 0.55,
    encounterTags: ["sea_lane", "smuggling_pressure"],
  },
  {
    from: "nexis",
    to: "south",
    routeType: "mixed",
    durationMs: 55 * 60 * 1000, // distance 4.90 - shortest pair on the map
    danger: 0.28,
    encounterTags: ["court_road", "permit_checks"],
  },
  {
    from: "west",
    to: "south",
    routeType: "sea",
    durationMs: 210 * 60 * 1000, // distance 43.80 - long sea lane
    danger: 0.45,
    encounterTags: ["legal_cargo_lane", "privateer_waters"],
  },
  {
    from: "north",
    to: "east",
    routeType: "road",
    durationMs: 155 * 60 * 1000, // distance 30.74 - long overland forge trek
    danger: 0.38,
    encounterTags: ["highland_forge_road", "relic_material_trade"],
  },
  {
    from: "east",
    to: "south",
    routeType: "road",
    durationMs: 100 * 60 * 1000, // distance 16.26 - medium permit road
    danger: 0.32,
    encounterTags: ["industrial_court_road", "permit_caravans"],
  },
  // ─── New direct point-to-point routes (route-mesh completion) ───
  // Unlike TORN, players can travel directly between any two cities without
  // being forced back through Nexis City first. These 3 routes complete the
  // mesh so every one of the 10 possible city pairs has a direct route.
  {
    from: "north",
    to: "south",
    routeType: "road",
    durationMs: 190 * 60 * 1000, // distance 39.44 - long inland road
    danger: 0.34,
    encounterTags: ["northern_road", "permit_checks"],
  },
  {
    from: "north",
    to: "west",
    routeType: "sea",
    durationMs: 170 * 60 * 1000, // distance 34.03 - long sea lane (west requires ship access)
    danger: 0.47,
    encounterTags: ["sea_lane", "warded_woods"],
  },
  {
    from: "west",
    to: "east",
    routeType: "mixed",
    durationMs: 225 * 60 * 1000, // distance 48.01 - longest pair on the map
    danger: 0.5,
    encounterTags: ["material_convoys", "forge_road"],
  },
];

export function getRouteDefinition(originCityId, destinationCityId) {
  const origin = normalizeCityId(originCityId, "");
  const destination = normalizeCityId(destinationCityId, "");
  if (!origin || !destination) return null;

  const route = TRAVEL_ROUTES.find(
    (entry) =>
      (entry.from === origin && entry.to === destination) ||
      (entry.from === destination && entry.to === origin),
  );

  return route ? { ...route, originCityId: origin, destinationCityId: destination } : null;
}
