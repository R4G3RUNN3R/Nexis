import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { useLocation } from "react-router-dom";
import { AppShell } from "../components/layout/AppShell";
import { worldCities, worldRoutes, type WorldCity, type WorldCityId } from "../data/worldMapData";
import { getCityHubContent } from "../data/cityHubData";
import { useAuth } from "../state/AuthContext";
import { usePlayer } from "../state/PlayerContext";
import { mergeServerStateIntoCache } from "../lib/runtimeStateCache";
import { cancelServerTravel, getServerTravelState, startServerTravel, type ServerPlayerState } from "../lib/authApi";
import {
  formatTravelDuration,
  getCityName,
  getTravelProgress,
  readTravelStateFromPlayer,
  type PersistedTravelState,
} from "../lib/travelState";
import mapImage from "../assets/maps/nexis-world-map-expanded.jpg";
import "../styles/world-map-ui.css";

const CITY_IMAGES: Record<string, string> = {
  nexis: "/images/cities/city_nexis.png",
  north: "/images/cities/city_aethermoor.png",
  east: "/images/cities/city_torvhal.png",
  west: "/images/cities/city_westmarch.png",
  south: "/images/cities/city_embervale.png",
};

function getFocusedCityId(state: PersistedTravelState): WorldCityId {
  return state.status === "in_transit" && state.destinationCityId ? state.destinationCityId : state.currentCityId;
}

const PIN_LABEL_OFFSETS: Partial<Record<WorldCityId, { x: string; y: string }>> = {
  nexis: { x: "-112%", y: "8%" },
  south: { x: "12%", y: "-132%" },
};

function getPinStyle(city: WorldCity): CSSProperties {
  const offset = PIN_LABEL_OFFSETS[city.id];
  return {
    left: `${city.xPercent}%`,
    top: `${city.yPercent}%`,
    "--pin-label-x": offset?.x ?? "-50%",
    "--pin-label-y": offset?.y ?? "0%",
  } as CSSProperties;
}

function getPinClass(region: WorldCity["region"]) {
  switch (region) {
    case "north":
      return "travel-pin travel-pin--north";
    case "east":
      return "travel-pin travel-pin--east";
    case "west":
      return "travel-pin travel-pin--west";
    case "south":
      return "travel-pin travel-pin--south";
    default:
      return "travel-pin travel-pin--center";
  }
}

function getEncounterRewardText(notice: PersistedTravelState["encounterNotice"]) {
  const reward = notice?.reward;
  if (!reward) return null;
  if (reward.throttled) return "Route spoils are cooling down.";
  const parts = [
    reward.gold ? `${reward.gold} gold` : null,
    reward.experience ? `${reward.experience} experience` : null,
    ...(Array.isArray(reward.items) ? reward.items.map((item) => item?.label ? `${item.label}${item.quantity ? ` x${item.quantity}` : ""}` : null) : [reward.item?.label ?? null]),
    reward.discovery ? `Discovery: ${reward.discovery}` : null,
  ].filter(Boolean);
  return parts.length ? `Reward: ${parts.join(", ")}.` : null;
}

function getEncounterTone(outcome: string) {
  if (outcome === "turned_back") return "#d98f8f";
  if (outcome === "costly_victory") return "#d0ad74";
  return "#d8c278";
}

export default function TravelPage() {
  const { player } = usePlayer();
  const { activeAccount, authSource, serverSessionToken } = useAuth();
  const location = useLocation() as { state?: { redirectedFrom?: string } };
  const [now, setNow] = useState(Date.now());
  const [travelState, setTravelState] = useState<PersistedTravelState>(() => readTravelStateFromPlayer(player));
  const [selectedCityId, setSelectedCityId] = useState<WorldCityId>(() => getFocusedCityId(readTravelStateFromPlayer(player)));
  const [message, setMessage] = useState<string | null>(null);
  const travelStateSyncRef = useRef<PersistedTravelState>(travelState);

  const applyServerTravelState = useCallback((travel: Record<string, unknown>) => {
    setTravelState(
      readTravelStateFromPlayer({
        current: {
          travel,
          currentCityId: travel.currentCityId,
        },
      }),
    );
  }, []);

  const cacheAndApplyTravelResult = useCallback((result: {
    playerState: ServerPlayerState;
    travel: Record<string, unknown>;
  }) => {
    if (!activeAccount) return;

    mergeServerStateIntoCache({
      email: activeAccount.email,
      user: {
        internalPlayerId: activeAccount.internalPlayerId,
        publicId: activeAccount.publicId,
        firstName: activeAccount.firstName,
        lastName: activeAccount.lastName,
      },
      playerState: result.playerState,
    });
    window.dispatchEvent(new Event("nexis:player-refresh"));
    applyServerTravelState(result.travel);
  }, [activeAccount, applyServerTravelState]);

  const refreshServerTravel = useCallback(async () => {
    if (authSource !== "server" || !serverSessionToken || !activeAccount) {
      return;
    }

    const result = await getServerTravelState(serverSessionToken);
    if (!("ok" in result) || !result.ok) {
      setMessage(result.error);
      return;
    }

    cacheAndApplyTravelResult(result);
  }, [activeAccount, authSource, cacheAndApplyTravelResult, serverSessionToken]);

  useEffect(() => {
    const nextTravelState = readTravelStateFromPlayer(player);
    const focusedCityId = getFocusedCityId(nextTravelState);
    const previousTravelState = travelStateSyncRef.current;

    setTravelState(nextTravelState);
    setSelectedCityId((current) => {
      const enteredTransit = previousTravelState.status !== "in_transit" && nextTravelState.status === "in_transit";
      const exitedTransit = previousTravelState.status === "in_transit" && nextTravelState.status !== "in_transit";
      const currentCityChanged = previousTravelState.currentCityId !== nextTravelState.currentCityId;
      const transitDestinationChanged =
        nextTravelState.status === "in_transit" && previousTravelState.destinationCityId !== nextTravelState.destinationCityId;

      if (enteredTransit || exitedTransit || currentCityChanged || transitDestinationChanged) {
        return focusedCityId;
      }

      return current;
    });

    travelStateSyncRef.current = nextTravelState;
  }, [player]);

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    if (authSource !== "server" || !serverSessionToken) return undefined;
    const syncTimer = window.setInterval(() => {
      const nextState = readTravelStateFromPlayer(player);
      if (nextState.status === "in_transit") {
        void refreshServerTravel();
      }
    }, 5000);
    return () => window.clearInterval(syncTimer);
  }, [authSource, player, refreshServerTravel, serverSessionToken]);

  const selectedCity = useMemo(
    () => worldCities.find((city) => city.id === selectedCityId) ?? worldCities[0],
    [selectedCityId],
  );
  const currentCity = useMemo(
    () => worldCities.find((city) => city.id === travelState.currentCityId) ?? worldCities[0],
    [travelState.currentCityId],
  );
  const selectedRoutes = useMemo(
    () => worldRoutes.filter((route) => route.from === selectedCity.id || route.to === selectedCity.id),
    [selectedCity],
  );
  const cityRouteCounts = useMemo(
    () =>
      worldCities.reduce<Record<WorldCityId, number>>((acc, city) => {
        acc[city.id] = worldRoutes.filter((route) => route.from === city.id || route.to === city.id).length;
        return acc;
      }, {} as Record<WorldCityId, number>),
    [],
  );

  const progress = getTravelProgress(travelState, now);
  const isTraveling = progress.active;
  const destinationName = getCityName(travelState.destinationCityId);
  const originName = getCityName(travelState.originCityId);
  const canTravel = !isTraveling && selectedCity.id !== travelState.currentCityId;
  const selectedCityHub = getCityHubContent(selectedCity.id);
  const academyLabel = selectedCityHub.academy.name;

  async function handleTravel() {
    if (!canTravel || authSource !== "server" || !serverSessionToken || !activeAccount) return;
    const result = await startServerTravel(serverSessionToken, selectedCity.id);
    if (!("ok" in result) || !result.ok) {
      setMessage(result.error);
      return;
    }
    cacheAndApplyTravelResult(result);
    const nextTravel = readTravelStateFromPlayer({ current: { travel: result.travel, currentCityId: result.travel.currentCityId } });
    setMessage(nextTravel.encounterNotice?.summary ?? `Caravan assembled for ${selectedCity.name}.`);
  }

  async function handleCancelTravel() {
    if (authSource !== "server" || !serverSessionToken || !activeAccount) return;
    const result = await cancelServerTravel(serverSessionToken);
    if (!("ok" in result) || !result.ok) {
      setMessage(result.error);
      return;
    }
    cacheAndApplyTravelResult(result);
    setMessage("The caravan turns back along the road already traveled.");
  }

  useEffect(() => {
    if (travelState.arrivalNotice?.arrivedAt && travelState.arrivalNotice.destinationName) {
      setMessage(`Caravan arrived in ${travelState.arrivalNotice.destinationName}.`);
    }
  }, [travelState.arrivalNotice?.arrivedAt, travelState.arrivalNotice?.destinationName]);

  return (
    <AppShell
      title="Travel"
      hint="The movement hub: choose destinations, review risk, depart, and track active travel."
    >
      <div className="travel-layout">
        <section className="travel-panel travel-panel--map">
          <div className="travel-panel__header">Route Selection</div>
          <div className="travel-map-frame">
            <img src={mapImage} alt="The world map of Nexis" className="travel-map-image" />
            <div
              className="travel-map-spotlight"
              style={{ left: `${selectedCity.xPercent}%`, top: `${selectedCity.yPercent}%` }}
              aria-hidden
            />
            {worldCities.map((city) => {
              const isSelected = selectedCityId === city.id;
              const isCurrent = travelState.currentCityId === city.id;
              const isTransitTarget = isTraveling && travelState.destinationCityId === city.id;
              return (
                <button
                  key={city.id}
                  type="button"
                  className={`${getPinClass(city.region)}${isSelected ? " travel-pin--selected" : ""}${isCurrent ? " travel-pin--current" : ""}${isTransitTarget ? " travel-pin--target" : ""}`}
                  style={getPinStyle(city)}
                  onClick={() => setSelectedCityId(city.id)}
                  aria-label={city.name}
                  title={`${city.name} (Map quick-select)`}
                >
                  <span className="travel-pin__dot" />
                  <span className="travel-pin__label">{city.name}</span>
                </button>
              );
            })}
          </div>

          <div className="travel-destination-registry">
            <div className="travel-subsection__title">Destination Selector</div>
            <div className="travel-destination-registry__hint">
              Choose where to go here. World Map is an atlas; Travel owns departure.
            </div>
            <div className="travel-destination-list">
              {worldCities.map((city) => {
                const isSelected = selectedCityId === city.id;
                const isCurrent = travelState.currentCityId === city.id;
                const isTransitTarget = isTraveling && travelState.destinationCityId === city.id;
                return (
                  <button
                    key={city.id}
                    type="button"
                    className={`travel-destination-entry${isSelected ? " travel-destination-entry--selected" : ""}`}
                    onClick={() => setSelectedCityId(city.id)}
                    aria-current={isSelected ? "true" : undefined}
                  >
                    <div className="travel-destination-entry__name">{city.name}</div>
                    <div className="travel-destination-entry__meta">{city.subtitle}</div>
                    <div className="travel-destination-entry__meta">
                      {cityRouteCounts[city.id]} connected route{cityRouteCounts[city.id] === 1 ? "" : "s"}
                    </div>
                    <div className="travel-destination-entry__flags">
                      {isSelected ? <span className="travel-destination-flag travel-destination-flag--selected">Selected</span> : null}
                      {isCurrent ? <span className="travel-destination-flag">Current City</span> : null}
                      {isTransitTarget ? <span className="travel-destination-flag travel-destination-flag--target">Transit Target</span> : null}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </section>

        <section className="travel-panel">
          <div className="travel-panel__header">Caravan Operations</div>
          <div className="travel-card">
            {CITY_IMAGES[selectedCity.id] ? (
              <div className="travel-city-art">
                <img src={CITY_IMAGES[selectedCity.id]} alt={selectedCity.name} className="travel-city-art__img" />
              </div>
            ) : null}

            <div className="travel-card__title">{selectedCity.name}</div>
            <div className="travel-card__subtitle">{selectedCity.subtitle}</div>

            {message ? <div className="travel-inline-note">{message}</div> : null}

            {travelState.encounterNotice ? (
              <div
                className="travel-card__status"
                style={{ borderColor: "rgba(216,194,120,0.18)", background: "rgba(7, 13, 20, 0.68)" }}
              >
                <strong style={{ color: getEncounterTone(travelState.encounterNotice.outcome) }}>{travelState.encounterNotice.title}</strong>
                <div>{travelState.encounterNotice.summary}</div>
                <div>
                  Route danger {travelState.encounterNotice.routeDanger ?? 0}% | Encounter chance {travelState.encounterNotice.encounterChance ?? 0}% |
                  {travelState.encounterNotice.hasWorldGeography ? " World Geography applied" : " World Geography missing"}
                </div>
                {travelState.encounterNotice.delayMs ? <div>Travel delay: {formatTravelDuration(travelState.encounterNotice.delayMs)}.</div> : null}
                {travelState.encounterNotice.combat ? (
                  <div>Combat: {travelState.encounterNotice.combat.energySpent ?? 0} energy spent | +{travelState.encounterNotice.combat.combatXpGained ?? 0} combat XP | +{travelState.encounterNotice.combat.skillXpGained ?? 0} skill XP.</div>
                ) : null}
                {getEncounterRewardText(travelState.encounterNotice) ? <div>{getEncounterRewardText(travelState.encounterNotice)}</div> : null}
              </div>
            ) : null}

            <div className="travel-card__grid">
              <div className="travel-info">
                <span className="travel-info__label">Current City</span>
                <strong className="travel-info__value">{currentCity.name}</strong>
              </div>
              <div className="travel-info">
                <span className="travel-info__label">Travel Mode</span>
                <strong className="travel-info__value">{travelState.mode === "personal_wagon" ? "Personal Wagon" : "Caravan"}</strong>
              </div>
              <div className="travel-info">
                <span className="travel-info__label">Academy</span>
                <strong className="travel-info__value">{academyLabel}</strong>
              </div>
              <div className="travel-info">
                <span className="travel-info__label">Route Feel</span>
                <strong className="travel-info__value">{selectedCity.travelFeel}</strong>
              </div>
            </div>

            {isTraveling ? (
              <div className="travel-card__status">
                <strong>Caravan In Transit</strong>
                <div>{originName} to {destinationName}</div>
                <div className="travel-progress">
                  <span style={{ width: `${progress.percent}%` }} />
                </div>
                <div>{progress.percent}% complete | ETA {formatTravelDuration(progress.remainingMs)}</div>
                {location.state?.redirectedFrom ? (
                  <div className="travel-inline-note travel-inline-note--warning">
                    {location.state.redirectedFrom} is unavailable while you are in transit.
                  </div>
                ) : null}
              </div>
            ) : null}

            <p className="travel-card__summary">{selectedCity.summary}</p>

            <div className="travel-subsection">
              <div className="travel-subsection__title">Connected Routes</div>
              <ul className="travel-list">
                {selectedRoutes.map((route) => (
                  <li key={route.id}>
                    <strong>{route.travelLabel}</strong>: {route.rule}
                  </li>
                ))}
              </ul>
            </div>

            <div className="travel-actions">
              <button
                type="button"
                className="travel-action-button travel-action-button--primary"
                onClick={() => void handleTravel()}
                disabled={!canTravel}
              >
                {isTraveling
                  ? "Already Traveling"
                  : selectedCity.id === travelState.currentCityId
                    ? "Already Here"
                    : `Depart Now: ${selectedCity.name}`}
              </button>
              {isTraveling ? (
                <button type="button" className="travel-action-button" onClick={() => void handleCancelTravel()}>
                  Turn Caravan Back
                </button>
              ) : null}
            </div>
          </div>
        </section>
      </div>
    </AppShell>
  );
}
