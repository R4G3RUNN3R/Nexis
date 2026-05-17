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

export const TRAVEL_ROUTES = [
  {
    from: "nexis",
    to: "north",
    routeType: "road",
    durationMs: 12 * 60 * 1000,
    danger: 0.35,
    encounterTags: ["northern_road", "warded_woods"],
  },
  {
    from: "nexis",
    to: "east",
    routeType: "road",
    durationMs: 14 * 60 * 1000,
    danger: 0.42,
    encounterTags: ["forge_road", "material_convoys"],
  },
  {
    from: "nexis",
    to: "west",
    routeType: "sea",
    durationMs: 18 * 60 * 1000,
    danger: 0.55,
    encounterTags: ["sea_lane", "smuggling_pressure"],
  },
  {
    from: "nexis",
    to: "south",
    routeType: "mixed",
    durationMs: 16 * 60 * 1000,
    danger: 0.28,
    encounterTags: ["court_road", "permit_checks"],
  },
  {
    from: "west",
    to: "south",
    routeType: "sea",
    durationMs: 16 * 60 * 1000,
    danger: 0.45,
    encounterTags: ["legal_cargo_lane", "privateer_waters"],
  },
  {
    from: "north",
    to: "east",
    routeType: "road",
    durationMs: 14 * 60 * 1000,
    danger: 0.38,
    encounterTags: ["highland_forge_road", "relic_material_trade"],
  },
  {
    from: "east",
    to: "south",
    routeType: "road",
    durationMs: 15 * 60 * 1000,
    danger: 0.32,
    encounterTags: ["industrial_court_road", "permit_caravans"],
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
