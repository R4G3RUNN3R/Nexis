import { withTransaction } from "../db/pool.js";
import { HttpError } from "../lib/errors.js";
import { buildMutableRuntimeState } from "../lib/runtimePlayerState.js";
import {
  createDefaultPlayerState,
  findPlayerStateByUserInternalId,
  upsertPlayerRuntimeState,
} from "../repositories/playerStateRepository.js";
import { DEFAULT_CITY_ID, getCityName, getRouteDefinition, isValidCityId } from "../data/travelData.js";

function cloneTravelState(runtimeState) {
  return runtimeState.travel && typeof runtimeState.travel === "object"
    ? { ...runtimeState.travel }
    : {
        status: "idle",
        originCityId: DEFAULT_CITY_ID,
        destinationCityId: null,
        routeType: "road",
        mode: "caravan",
        departureAt: null,
        arrivalAt: null,
        durationMs: null,
        currentCityId: DEFAULT_CITY_ID,
        arrivalNotice: null,
      };
}

function syncTravelOntoPlayer(runtimeState, travelState) {
  runtimeState.travel = travelState;
  runtimeState.player.current = {
    ...(runtimeState.player.current ?? {}),
    currentCityId: travelState.currentCityId,
    travel: travelState,
  };
}

export function resolveTravelForRuntimeState(runtimeState, now = Date.now()) {
  const current = cloneTravelState(runtimeState);
  if (
    current.status === "in_transit" &&
    typeof current.arrivalAt === "number" &&
    now >= current.arrivalAt &&
    current.destinationCityId
  ) {
    const resolved = {
      status: "idle",
      originCityId: current.destinationCityId,
      destinationCityId: null,
      routeType: current.routeType ?? "road",
      mode: current.mode ?? "caravan",
      departureAt: null,
      arrivalAt: null,
      durationMs: null,
      currentCityId: current.destinationCityId,
      arrivalNotice: {
        destinationCityId: current.destinationCityId,
        destinationName: getCityName(current.destinationCityId),
        arrivedAt: now,
      },
    };
    syncTravelOntoPlayer(runtimeState, resolved);
    return { changed: true, travelState: resolved };
  }

  syncTravelOntoPlayer(runtimeState, current);
  return { changed: false, travelState: current };
}

async function loadRuntimeState(client, user) {
  await createDefaultPlayerState(client, user.internalId);
  const playerState = await findPlayerStateByUserInternalId(client, user.internalId);
  if (!playerState) {
    throw new HttpError(404, "Player state unavailable.", "PLAYER_STATE_NOT_FOUND");
  }
  const runtimeState = buildMutableRuntimeState(user, playerState);
  const resolution = resolveTravelForRuntimeState(runtimeState);
  if (resolution.changed) {
    const nextPlayerState = await upsertPlayerRuntimeState(client, user.internalId, runtimeState);
    return {
      playerState: nextPlayerState,
      runtimeState: buildMutableRuntimeState(user, nextPlayerState),
    };
  }
  return { playerState, runtimeState };
}

export async function getTravelStateForUser(user) {
  return withTransaction(async (client) => {
    const { playerState, runtimeState } = await loadRuntimeState(client, user);
    return { playerState, travel: cloneTravelState(runtimeState) };
  });
}

export async function startTravelForUser(user, payload) {
  return withTransaction(async (client) => {
    const { runtimeState } = await loadRuntimeState(client, user);
    const destinationCityId = String(payload?.destinationCityId ?? "").trim().toLowerCase();
    if (!isValidCityId(destinationCityId)) {
      throw new HttpError(400, "Travel destination unavailable.", "TRAVEL_DESTINATION_INVALID");
    }

    const current = cloneTravelState(runtimeState);
    if (current.status === "in_transit") {
      throw new HttpError(409, "You are already in transit.", "TRAVEL_ALREADY_ACTIVE");
    }

    const originCityId =
      typeof current.currentCityId === "string" && current.currentCityId
        ? current.currentCityId
        : DEFAULT_CITY_ID;

    if (originCityId === destinationCityId) {
      throw new HttpError(400, "You are already in that city.", "TRAVEL_ALREADY_THERE");
    }

    const route = getRouteDefinition(originCityId, destinationCityId);
    if (!route) {
      throw new HttpError(400, "No safe caravan route is available for that destination.", "TRAVEL_ROUTE_INVALID");
    }

    const now = Date.now();
    const nextTravel = {
      status: "in_transit",
      originCityId,
      destinationCityId,
      routeType: route.routeType,
      mode: "caravan",
      departureAt: now,
      arrivalAt: now + route.durationMs,
      durationMs: route.durationMs,
      currentCityId: originCityId,
      arrivalNotice: null,
    };

    syncTravelOntoPlayer(runtimeState, nextTravel);
    const playerState = await upsertPlayerRuntimeState(client, user.internalId, runtimeState);
    return { playerState, travel: nextTravel };
  });
}

export async function cancelTravelForUser(user) {
  return withTransaction(async (client) => {
    const { runtimeState } = await loadRuntimeState(client, user);
    const current = cloneTravelState(runtimeState);
    if (current.status !== "in_transit" || !current.originCityId || !current.destinationCityId) {
      throw new HttpError(409, "No caravan journey is active.", "TRAVEL_NOT_ACTIVE");
    }

    const now = Date.now();
    const elapsedMs = Math.max(
      30 * 1000,
      Math.min(current.durationMs ?? 30 * 1000, now - (current.departureAt ?? now)),
    );

    const reversed = {
      status: "in_transit",
      originCityId: current.destinationCityId,
      destinationCityId: current.originCityId,
      routeType: current.routeType ?? "road",
      mode: current.mode ?? "caravan",
      departureAt: now,
      arrivalAt: now + elapsedMs,
      durationMs: elapsedMs,
      currentCityId: current.currentCityId ?? current.originCityId,
      arrivalNotice: null,
    };

    syncTravelOntoPlayer(runtimeState, reversed);
    const playerState = await upsertPlayerRuntimeState(client, user.internalId, runtimeState);
    return { playerState, travel: reversed };
  });
}
