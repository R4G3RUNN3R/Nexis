import { worldCities, type WorldCityId } from "../data/worldMapData";

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
