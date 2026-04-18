import { worldCities, worldRoutes, type WorldCityId } from "../data/worldMapData";
import { getPropertyTravelTimeMultiplier } from "../data/propertyData";

export type PersistedTravelState = {
  currentCityId: WorldCityId;
  originCityId: WorldCityId | null;
  destinationCityId: WorldCityId | null;
  startedAt: number | null;
  arrivalAt: number | null;
  durationMs: number | null;
};

const TRAVEL_STATE_PREFIX = "nexis_travel_state_";
const DEFAULT_CITY_ID: WorldCityId = "nexis";

function keyFor(internalPlayerId: string) {
  return `${TRAVEL_STATE_PREFIX}${internalPlayerId}`;
}

export function defaultTravelState(): PersistedTravelState {
  return {
    currentCityId: DEFAULT_CITY_ID,
    originCityId: null,
    destinationCityId: null,
    startedAt: null,
    arrivalAt: null,
    durationMs: null,
  };
}

export function readTravelState(internalPlayerId: string): PersistedTravelState {
  if (typeof window === "undefined") return defaultTravelState();
  try {
    const raw = window.localStorage.getItem(keyFor(internalPlayerId));
    if (!raw) return defaultTravelState();
    const parsed = JSON.parse(raw) as Partial<PersistedTravelState>;
    const currentCityId = worldCities.some((city) => city.id === parsed.currentCityId)
      ? (parsed.currentCityId as WorldCityId)
      : DEFAULT_CITY_ID;
    const originCityId = worldCities.some((city) => city.id === parsed.originCityId)
      ? (parsed.originCityId as WorldCityId)
      : null;
    const destinationCityId = worldCities.some((city) => city.id === parsed.destinationCityId)
      ? (parsed.destinationCityId as WorldCityId)
      : null;

    return {
      currentCityId,
      originCityId,
      destinationCityId,
      startedAt: typeof parsed.startedAt === "number" ? parsed.startedAt : null,
      arrivalAt: typeof parsed.arrivalAt === "number" ? parsed.arrivalAt : null,
      durationMs: typeof parsed.durationMs === "number" ? parsed.durationMs : null,
    };
  } catch {
    return defaultTravelState();
  }
}

export function writeTravelState(internalPlayerId: string, state: PersistedTravelState) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(keyFor(internalPlayerId), JSON.stringify(state));
}

export function resolveTravelState(internalPlayerId: string, now = Date.now()): PersistedTravelState {
  const current = readTravelState(internalPlayerId);
  if (current.destinationCityId && current.arrivalAt && now >= current.arrivalAt) {
    const resolved: PersistedTravelState = {
      currentCityId: current.destinationCityId,
      originCityId: null,
      destinationCityId: null,
      startedAt: null,
      arrivalAt: null,
      durationMs: null,
    };
    writeTravelState(internalPlayerId, resolved);
    return resolved;
  }
  return current;
}

export function getRouteDurationMs(from: WorldCityId, to: WorldCityId) {
  const route = worldRoutes.find(
    (entry) => (entry.from === from && entry.to === to) || (entry.from === to && entry.to === from),
  );

  if (!route) return 10 * 60 * 1000;

  switch (route.type) {
    case "road":
      return 12 * 60 * 1000;
    case "sea":
      return 18 * 60 * 1000;
    case "mixed":
      return 22 * 60 * 1000;
    default:
      return 10 * 60 * 1000;
  }
}

export function startTravel(
  internalPlayerId: string,
  destinationCityId: WorldCityId,
  now = Date.now(),
  options?: { propertyId?: string; installedUpgradeIds?: string[] },
) {
  const current = resolveTravelState(internalPlayerId, now);
  if (current.destinationCityId) return current;
  if (current.currentCityId === destinationCityId) return current;

  const propertyMultiplier = getPropertyTravelTimeMultiplier(
    options?.propertyId ?? "shack",
    options?.installedUpgradeIds ?? [],
  );
  const durationMs = Math.max(
    30 * 1000,
    Math.round(getRouteDurationMs(current.currentCityId, destinationCityId) * propertyMultiplier),
  );
  const next: PersistedTravelState = {
    currentCityId: current.currentCityId,
    originCityId: current.currentCityId,
    destinationCityId,
    startedAt: now,
    arrivalAt: now + durationMs,
    durationMs,
  };
  writeTravelState(internalPlayerId, next);
  return next;
}

export function cancelTravel(internalPlayerId: string, now = Date.now()) {
  const current = resolveTravelState(internalPlayerId, now);
  if (!current.destinationCityId || !current.startedAt || !current.durationMs) return current;

  const elapsedMs = Math.max(30 * 1000, Math.min(current.durationMs, now - current.startedAt));
  const next: PersistedTravelState = {
    currentCityId: current.currentCityId,
    originCityId: current.destinationCityId,
    destinationCityId: current.currentCityId,
    startedAt: now,
    arrivalAt: now + elapsedMs,
    durationMs: elapsedMs,
  };
  writeTravelState(internalPlayerId, next);
  return next;
}

export function getTravelProgress(state: PersistedTravelState, now = Date.now()) {
  if (!state.destinationCityId || !state.startedAt || !state.arrivalAt || !state.durationMs) {
    return {
      active: false,
      percent: 0,
      remainingMs: 0,
      elapsedMs: 0,
    };
  }

  const elapsedMs = Math.max(0, now - state.startedAt);
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
