export const DEFAULT_CITY_ID = "nexis";

export const CITY_DEFINITIONS = {
  nexis: {
    id: "nexis",
    name: "Nexis City",
    publicName: "Nexis City",
    role: "starter capital / civic baseline / safe hub",
    peopleLabel: "citizens",
  },
  west: {
    id: "west",
    name: "Blackharbor",
    publicName: "Blackharbor",
    role: "port / maritime trade / smuggling pressure",
    peopleLabel: "dockside visitors",
  },
  north: {
    id: "north",
    name: "Silverbough",
    publicName: "Silverbough",
    role: "arcane / herbal / relic / healing city",
    peopleLabel: "scholars and healers",
  },
  east: {
    id: "east",
    name: "Ironhall",
    publicName: "Ironhall",
    role: "forge / labor / crafting / material city",
    peopleLabel: "smiths and contractors",
  },
  south: {
    id: "south",
    name: "Highcourt",
    publicName: "Highcourt",
    role: "law / diplomacy / prestige / permits city",
    peopleLabel: "envoys and petitioners",
  },
};

const CITY_ALIASES = {
  blackharbor: "west",
  blackharbor_shadow_port: "west",
  silverbough: "north",
  silverbough_arcane_enclave: "north",
  ironhall: "east",
  ironhall_forge_city: "east",
  akai_tetsu_war_dojo: "east",
  highcourt: "south",
  spiritwood_sacred_isle: "south",
};

export function normalizeCityId(value, fallback = DEFAULT_CITY_ID) {
  const raw = String(value ?? "").trim().toLowerCase();
  if (CITY_DEFINITIONS[raw]) return raw;
  return CITY_ALIASES[raw] ?? fallback;
}

export function isValidCityId(cityId) {
  return Boolean(CITY_DEFINITIONS[normalizeCityId(cityId, "")]);
}

export function getCityDefinition(cityId) {
  return CITY_DEFINITIONS[normalizeCityId(cityId)];
}

export function getCityName(cityId) {
  return getCityDefinition(cityId)?.name ?? "Unknown";
}

export function getCityOccupancyCandidates(cityId) {
  const normalized = normalizeCityId(cityId);
  return [
    normalized,
    ...Object.entries(CITY_ALIASES)
      .filter(([, target]) => target === normalized)
      .map(([alias]) => alias),
  ];
}
