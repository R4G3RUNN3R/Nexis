import { worldCities, type WorldCityId } from "../data/worldMapData";

export type TravelCargoLine = {
  itemId: string;
  quantity: number;
  unitValue?: number;
  label: string;
};

export type TravelCargoManifest = {
  manifest: TravelCargoLine[];
  totalValue: number;
  totalQuantity: number;
};

export type TravelEncounterNotice = {
  happened?: boolean;
  outcome: "avoided" | "victory" | "costly_victory" | "turned_back" | string;
  title: string;
  summary: string;
  hasWorldGeography?: boolean;
  encounterChance?: number;
  routeDanger?: number;
  delayMs?: number;
  escorted?: boolean;
  reward?: {
    gold?: number;
    experience?: number;
    item?: { itemId: string; label: string; quantity?: number } | null;
    items?: Array<{ itemId: string; label: string; quantity?: number }>;
    discovery?: string | null;
    throttled?: boolean;
  } | null;
  penalties?: Record<string, number> | null;
  combat?: {
    energySpent?: number;
    combatXpGained?: number;
    skillXpGained?: number;
    log?: Array<{ message?: string }>;
  } | null;
  cargoLoss?: { lost: boolean; items: Array<{ itemId: string; label: string; quantity: number }> } | null;
  resolvedAt?: number;
};

export type PersistedTravelState = {
  status: "idle" | "in_transit";
  currentCityId: WorldCityId;
  originCityId: WorldCityId;
  destinationCityId: WorldCityId | null;
  routeType: "road" | "sea" | "mixed";
  mode: string;
  cargo: TravelCargoManifest | null;
  escort: boolean;
  departureAt: number | null;
  arrivalAt: number | null;
  durationMs: number | null;
  arrivalNotice: {
    destinationCityId: WorldCityId | null;
    destinationName: string | null;
    arrivedAt: number | null;
    cargoBonusGold?: number;
    cargoDelivered?: TravelCargoLine[];
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
  cargo: null,
  escort: false,
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
    cargoBonusGold: typeof record.cargoBonusGold === "number" ? record.cargoBonusGold : undefined,
    cargoDelivered: Array.isArray(record.cargoDelivered) ? (record.cargoDelivered as TravelCargoLine[]) : undefined,
  };
}

function readCargoState(value: unknown): TravelCargoManifest | null {
  const record = asRecord(value);
  const manifest = Array.isArray(record.manifest) ? record.manifest : [];
  if (!manifest.length) return null;
  return {
    manifest: manifest
      .map((entry) => asRecord(entry))
      .filter((entry) => typeof entry.itemId === "string" && entry.itemId)
      .map((entry) => ({
        itemId: entry.itemId as string,
        quantity: typeof entry.quantity === "number" ? entry.quantity : 0,
        unitValue: typeof entry.unitValue === "number" ? entry.unitValue : undefined,
        label: typeof entry.label === "string" ? entry.label : (entry.itemId as string),
      })),
    totalValue: typeof record.totalValue === "number" ? record.totalValue : 0,
    totalQuantity: typeof record.totalQuantity === "number" ? record.totalQuantity : 0,
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
    escorted: typeof record.escorted === "boolean" ? record.escorted : undefined,
    reward: Object.keys(asRecord(record.reward)).length ? (asRecord(record.reward) as TravelEncounterNotice["reward"]) : null,
    penalties: Object.keys(asRecord(record.penalties)).length ? asRecord(record.penalties) as Record<string, number> : null,
    combat: Object.keys(asRecord(record.combat)).length ? (asRecord(record.combat) as TravelEncounterNotice["combat"]) : null,
    cargoLoss: Object.keys(asRecord(record.cargoLoss)).length
      ? (asRecord(record.cargoLoss) as TravelEncounterNotice["cargoLoss"])
      : null,
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
    mode: typeof record.mode === "string" && record.mode ? record.mode : "caravan",
    cargo: readCargoState(record.cargo),
    escort: Boolean(record.escort),
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
