import { worldCities, type WorldCityId } from "../data/worldMapData";

export type TravelEncounterNotice = {
  happened?: boolean;
  outcome: "avoided" | "victory" | "costly_victory" | "turned_back" | string;
  title: string;
  summary: string;
  hasWorldGeography?: boolean;
  encounterChance?: number;
  routeDanger?: number;
  delayMs?: number;
  reward?: {
    gold?: number;
    experience?: number;
    item?: { itemId: string; label: string; quantity?: number } | null;
    items?: Array<{ itemId: string; label: string; quantity?: number }>;
    discovery?: string | null;
    throttled?: boolean;
  } | null;
  penalties?: Record<string, number> | null;
  resolvedAt?: number;
};

export type PersistedTravelState = {
  status: "idle" | "in_transit";
  currentCityId: WorldCityId;
  originCityId: WorldCityId;
  destinationCityId: WorldCityId | null;
  routeType: "road" | "sea" | "mixed";
  mode: "caravan" | "personal_wagon";
  departureAt: number | null;
  arrivalAt: number | null;
  durationMs: number | null;
  arrivalNotice: {
    destinationCityId: WorldCityId | null;
    destinationName: string | null;
    arrivedAt: number | null;
  } | null;
  encounterNotice: TravelEncounterNotice | null;
};

const DEFAULT_STATE: PersistedTravelState = {
  status: "idle",
  currentCityId: "nexis",
  originCityId: "nexis",
  destinationCityId: null,
  routeType: "road",
  mode: "caravan",
  departureAt: null,
  arrivalAt: null,
  durationMs: null,
  arrivalNotice: null,
  encounterNotice: null,
};

function asRecord(value: unknown): Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function asCityId(value: unknown, fallback: WorldCityId = "nexis"): WorldCityId {
  return worldCities.some((city) => city.id === value) ? (value as WorldCityId) : fallback;
}

function readArrivalNotice(
  value: unknown,
  fallbackCityId: WorldCityId,
): PersistedTravelState["arrivalNotice"] {
  const record = asRecord(value);
  if (!Object.keys(record).length) return null;

  return {
    destinationCityId: record.destinationCityId
      ? asCityId(record.destinationCityId, fallbackCityId)
      : null,
    destinationName: typeof record.destinationName === "string" ? record.destinationName : null,
    arrivedAt: typeof record.arrivedAt === "number" ? record.arrivedAt : null,
  };
}

function readEncounterNotice(value: unknown): TravelEncounterNotice | null {
  const record = asRecord(value);
  if (!Object.keys(record).length) return null;
  return {
    happened: typeof record.happened === "boolean" ? record.happened : undefined,
    outcome: typeof record.outcome === "string" ? record.outcome : "avoided",
    title: typeof record.title === "string" ? record.title : "Travel Encounter",
    summary: typeof record.summary === "string" ? record.summary : "The route produced a travel encounter.",
    hasWorldGeography: typeof record.hasWorldGeography === "boolean" ? record.hasWorldGeography : undefined,
    encounterChance: typeof record.encounterChance === "number" ? record.encounterChance : undefined,
    routeDanger: typeof record.routeDanger === "number" ? record.routeDanger : undefined,
    delayMs: typeof record.delayMs === "number" ? record.delayMs : undefined,
    reward: Object.keys(asRecord(record.reward)).length ? (asRecord(record.reward) as TravelEncounterNotice["reward"]) : null,
    penalties: Object.keys(asRecord(record.penalties)).length ? asRecord(record.penalties) as Record<string, number> : null,
    resolvedAt: typeof record.resolvedAt === "number" ? record.resolvedAt : undefined,
  };
}

export function readTravelStateFromPlayer(player: { current?: { travel?: unknown; currentCityId?: unknown } } | null | undefined): PersistedTravelState {
  const record = asRecord(player?.current?.travel);
  const currentCityId = asCityId(record.currentCityId ?? player?.current?.currentCityId, "nexis");
  return {
    status: record.status === "in_transit" ? "in_transit" : "idle",
    currentCityId,
    originCityId: asCityId(record.originCityId, currentCityId),
    destinationCityId: record.destinationCityId ? asCityId(record.destinationCityId, currentCityId) : null,
    routeType:
      record.routeType === "sea" || record.routeType === "mixed" ? record.routeType : "road",
    mode: record.mode === "personal_wagon" ? "personal_wagon" : "caravan",
    departureAt: typeof record.departureAt === "number" ? record.departureAt : null,
    arrivalAt: typeof record.arrivalAt === "number" ? record.arrivalAt : null,
    durationMs: typeof record.durationMs === "number" ? record.durationMs : null,
    arrivalNotice: readArrivalNotice(record.arrivalNotice, currentCityId),
    encounterNotice: readEncounterNotice(record.encounterNotice),
  };
}

export function getTravelProgress(state: PersistedTravelState, now = Date.now()) {
  if (
    state.status !== "in_transit" ||
    !state.destinationCityId ||
    !state.departureAt ||
    !state.arrivalAt ||
    !state.durationMs
  ) {
    return {
      active: false,
      percent: 0,
      remainingMs: 0,
      elapsedMs: 0,
    };
  }

  const elapsedMs = Math.max(0, now - state.departureAt);
  const remainingMs = Math.max(0, state.arrivalAt - now);
  const percent = Math.max(0, Math.min(100, Math.round((elapsedMs / state.durationMs) * 100)));

  return {
    active: true,
    percent,
    remainingMs,
    elapsedMs,
  };
}

export function formatTravelDuration(ms: number) {
  const totalMinutes = Math.max(0, Math.ceil(ms / 60000));
  const days = Math.floor(totalMinutes / (60 * 24));
  const hours = Math.floor((totalMinutes % (60 * 24)) / 60);
  const minutes = totalMinutes % 60;
  if (days > 0) return `${days}d ${hours}h`;
  if (hours > 0) return `${hours}h ${minutes}m`;
  return `${minutes}m`;
}

export function getCityName(cityId: WorldCityId | null) {
  if (!cityId) return "Unknown";
  return worldCities.find((city) => city.id === cityId)?.name ?? "Unknown";
}

export function defaultTravelState() {
  return { ...DEFAULT_STATE };
}
