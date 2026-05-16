export const DEFAULT_CITY_ID = "nexis";

export const TRAVEL_CITIES = {
  nexis: { id: "nexis", name: "Nexis City" },
  north: { id: "north", name: "Silverbough Arcane Enclave" },
  east: { id: "east", name: "Akai Tetsu War Dojo" },
  west: { id: "west", name: "Blackharbor Shadow Port" },
  south: { id: "south", name: "Spiritwood Sacred Isle" },
};

export const TRAVEL_ROUTES = [
  { from: "nexis", to: "north", routeType: "road", durationMs: 12 * 60 * 1000 },
  { from: "nexis", to: "east", routeType: "road", durationMs: 12 * 60 * 1000 },
  { from: "nexis", to: "west", routeType: "sea", durationMs: 18 * 60 * 1000 },
  { from: "nexis", to: "south", routeType: "mixed", durationMs: 22 * 60 * 1000 },
  { from: "east", to: "south", routeType: "sea", durationMs: 18 * 60 * 1000 },
];

export function getCityName(cityId) {
  return TRAVEL_CITIES[cityId]?.name ?? "Unknown";
}

export function isValidCityId(cityId) {
  return Boolean(TRAVEL_CITIES[cityId]);
}

export function getRouteDefinition(originCityId, destinationCityId) {
  return (
    TRAVEL_ROUTES.find(
      (entry) =>
        (entry.from === originCityId && entry.to === destinationCityId) ||
        (entry.from === destinationCityId && entry.to === originCityId),
    ) ?? null
  );
}
