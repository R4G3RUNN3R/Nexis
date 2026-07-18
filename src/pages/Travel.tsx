import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useLocation } from "react-router-dom";
import { AppShell } from "../components/layout/AppShell";
import { worldCities, worldRoutes, type WorldCityId } from "../data/worldMapData";
import { getPinClass, getPinStyle } from "../lib/mapPins";
import { getCityHubContent } from "../data/cityHubData";
import { ITEM_CATALOGUE } from "../data/itemsData";
import { useAuth } from "../state/AuthContext";
import { usePlayer } from "../state/PlayerContext";
import { mergeServerStateIntoCache } from "../lib/runtimeStateCache";
import {
  cancelServerTravel,
  getServerTravelOptions,
  getServerTravelState,
  startServerTravel,
  type ServerPlayerState,
  type ServerTransportTier,
} from "../lib/authApi";
import {
  formatTravelDuration,
  getTravelProgress,
  readTravelStateFromPlayer,
  type PersistedTravelState,
} from "../lib/travelState";
import { TravelSplash } from "../components/travel/TravelSplash";
import mapImage from "../assets/maps/nexis-world-map-expanded.jpg";
import "../styles/world-map-ui.css";
import "../styles/travel-splash.css";

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

function readRequestedCityId(search: string): WorldCityId | null {
  const requested = new URLSearchParams(search).get("to");
  if (requested && worldCities.some((city) => city.id === requested)) return requested as WorldCityId;
  return null;
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

function titleCaseFromId(id: string) {
  return id
    .split(/[_-]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function getModeLabel(mode: string, tiers: ServerTransportTier[]) {
  return tiers.find((tier) => tier.id === mode)?.name ?? titleCaseFromId(mode || "caravan");
}

function getItemLabel(itemId: string) {
  return ITEM_CATALOGUE[itemId]?.name ?? titleCaseFromId(itemId);
}

export default function TravelPage() {
  const { player } = usePlayer();
  const { activeAccount, authSource, serverSessionToken } = useAuth();
  const location = useLocation() as { state?: { redirectedFrom?: string }; search: string };
  const [now, setNow] = useState(Date.now());
  const [travelState, setTravelState] = useState<PersistedTravelState>(() => readTravelStateFromPlayer(player));
  const [selectedCityId, setSelectedCityId] = useState<WorldCityId>(
    () => readRequestedCityId(location.search) ?? getFocusedCityId(readTravelStateFromPlayer(player)),
  );
  const [message, setMessage] = useState<string | null>(null);
  const travelStateSyncRef = useRef<PersistedTravelState>(travelState);
  // Tracks the arrivalAt timestamp we've already triggered an immediate
  // server resync for, so the "countdown hit zero" resync below fires at
  // most once per journey instead of on every 1s tick while the server
  // hasn't caught up yet.
  const arrivalSyncedForRef = useRef<number | null>(null);

  const [transportTiers, setTransportTiers] = useState<ServerTransportTier[]>([]);
  const [selectedTierId, setSelectedTierId] = useState<string>("caravan");
  const [cargoSelections, setCargoSelections] = useState<Record<string, number>>({});
  const [escortHired, setEscortHired] = useState(false);
  const [cancelingTravel, setCancelingTravel] = useState(false);

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

  // World Map "Depart for..." links land here with ?to=<cityId> so the atlas
  // can preselect a destination while Travel keeps owning the departure flow.
  useEffect(() => {
    const requestedCityId = readRequestedCityId(location.search);
    if (requestedCityId) setSelectedCityId(requestedCityId);
  }, [location.search]);

  // Client-side ticker for DISPLAY ONLY: it advances `now` once per second so
  // the progress bar / splash countdown animate smoothly. It never flips
  // travel state to "arrived" itself - `getTravelProgress` derives `active`
  // purely from the last server-confirmed `travelState.status`, so refreshing
  // the page or opening a second tab always reflects the true server state,
  // not a locally-decremented timer. The one side effect here is triggering
  // an immediate resync the moment the local countdown reaches zero, so the
  // server-authoritative arrival (resolveTravelForRuntimeState) is fetched
  // promptly instead of waiting for the slower heartbeat below.
  useEffect(() => {
    const timer = window.setInterval(() => {
      const nowValue = Date.now();
      setNow(nowValue);

      const currentTravel = travelStateSyncRef.current;
      if (
        currentTravel.status === "in_transit" &&
        currentTravel.arrivalAt &&
        nowValue >= currentTravel.arrivalAt &&
        arrivalSyncedForRef.current !== currentTravel.arrivalAt
      ) {
        arrivalSyncedForRef.current = currentTravel.arrivalAt;
        void refreshServerTravel();
      }
    }, 1000);
    return () => window.clearInterval(timer);
  }, [refreshServerTravel]);

  // Fallback heartbeat: keeps re-fetching server travel state periodically
  // while in transit (covers cases like the tab regaining focus after being
  // backgrounded, where the 1s ticker above may have been throttled).
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

  useEffect(() => {
    setCargoSelections({});
    setEscortHired(false);
  }, [selectedCityId]);

  useEffect(() => {
    if (authSource !== "server" || !serverSessionToken || !activeAccount) return undefined;
    if (travelState.status === "in_transit") return undefined;
    if (selectedCityId === travelState.currentCityId) return undefined;

    let cancelled = false;
    void (async () => {
      const result = await getServerTravelOptions(serverSessionToken, selectedCityId);
      if (cancelled || !("ok" in result) || !result.ok) return;
      setTransportTiers(result.tiers);
      setSelectedTierId((current) => (result.tiers.some((tier) => tier.id === current) ? current : result.defaultTierId));
    })();
    return () => {
      cancelled = true;
    };
  }, [activeAccount, authSource, selectedCityId, serverSessionToken, travelState.currentCityId, travelState.status]);

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
  const canTravel = !isTraveling && selectedCity.id !== travelState.currentCityId;
  const selectedCityHub = getCityHubContent(selectedCity.id);
  const academyLabel = selectedCityHub.academy.name;

  const selectedTier = useMemo(
    () => transportTiers.find((tier) => tier.id === selectedTierId) ?? null,
    [transportTiers, selectedTierId],
  );

  const activeTravelTier = useMemo(
    () => transportTiers.find((tier) => tier.id === travelState.mode) ?? null,
    [transportTiers, travelState.mode],
  );

  const cargoOptions = useMemo(
    () =>
      Object.entries(player.inventory)
        .filter(([, quantity]) => quantity > 0)
        .map(([itemId, quantity]) => ({ itemId, owned: quantity, label: getItemLabel(itemId) }))
        .sort((left, right) => left.label.localeCompare(right.label)),
    [player.inventory],
  );

  const cargoCapacity = selectedTier?.cargoCapacity ?? 0;
  const cargoTotalQuantity = useMemo(
    () => Object.values(cargoSelections).reduce((sum, quantity) => sum + quantity, 0),
    [cargoSelections],
  );
  const cargoEntries = useMemo(
    () =>
      Object.entries(cargoSelections)
        .filter(([, quantity]) => quantity > 0)
        .map(([itemId, quantity]) => ({ itemId, quantity })),
    [cargoSelections],
  );

  function setCargoQuantity(itemId: string, quantity: number, owned: number) {
    setCargoSelections((current) => {
      const othersTotal = Object.entries(current).reduce((sum, [id, qty]) => (id === itemId ? sum : sum + qty), 0);
      const remainingCapacity = Math.max(0, cargoCapacity - othersTotal);
      const clamped = Math.max(0, Math.min(owned, remainingCapacity, quantity));
      const next = { ...current };
      if (clamped <= 0) {
        delete next[itemId];
      } else {
        next[itemId] = clamped;
      }
      return next;
    });
  }

  const escortCost = escortHired ? selectedTier?.estimatedEscortCost ?? 0 : 0;
  const totalDepartureCost = (selectedTier?.goldCost ?? 0) + escortCost;
  const canAffordDeparture = player.gold >= totalDepartureCost;

  async function handleTravel() {
    if (!canTravel || authSource !== "server" || !serverSessionToken || !activeAccount) return;
    const result = await startServerTravel(serverSessionToken, selectedCity.id, {
      mode: selectedTierId,
      cargo: cargoEntries,
      escort: escortHired,
    });
    if (!("ok" in result) || !result.ok) {
      setMessage(result.error);
      return;
    }
    cacheAndApplyTravelResult(result);
    setCargoSelections({});
    setEscortHired(false);
    const nextTravel = readTravelStateFromPlayer({ current: { travel: result.travel, currentCityId: result.travel.currentCityId } });
    setMessage(nextTravel.encounterNotice?.summary ?? `${getModeLabel(selectedTierId, transportTiers)} assembled for ${selectedCity.name}.`);
  }

  async function handleCancelTravel() {
    if (authSource !== "server" || !serverSessionToken || !activeAccount) return;
    setCancelingTravel(true);
    try {
      const result = await cancelServerTravel(serverSessionToken);
      if (!("ok" in result) || !result.ok) {
        setMessage(result.error);
        return;
      }
      cacheAndApplyTravelResult(result);
      setMessage("The caravan turns back along the road already traveled.");
    } finally {
      setCancelingTravel(false);
    }
  }

  useEffect(() => {
    if (travelState.arrivalNotice?.arrivedAt && travelState.arrivalNotice.destinationName) {
      const bonusGold = travelState.arrivalNotice.cargoBonusGold ?? 0;
      const bonusText = bonusGold > 0 ? ` Cargo sold at market for a ${bonusGold} gold trade bonus.` : "";
      setMessage(`Caravan arrived in ${travelState.arrivalNotice.destinationName}.${bonusText}`);
    }
  }, [travelState.arrivalNotice?.arrivedAt, travelState.arrivalNotice?.cargoBonusGold, travelState.arrivalNotice?.destinationName]);

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
              Choose where to go here. World Map is the atlas for excursion leads and discovery; Travel owns departure.
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
                {travelState.encounterNotice.escorted ? <div>Hired escort softened the encounter.</div> : null}
                {travelState.encounterNotice.combat ? (
                  <div>Combat: {travelState.encounterNotice.combat.energySpent ?? 0} energy spent | +{travelState.encounterNotice.combat.combatXpGained ?? 0} combat XP | +{travelState.encounterNotice.combat.skillXpGained ?? 0} skill XP.</div>
                ) : null}
                {getEncounterRewardText(travelState.encounterNotice) ? <div>{getEncounterRewardText(travelState.encounterNotice)}</div> : null}
                {travelState.encounterNotice.cargoLoss?.lost ? (
                  <div style={{ color: "#d98f8f" }}>
                    Cargo lost: {travelState.encounterNotice.cargoLoss.items.map((item) => `${item.label} x${item.quantity}`).join(", ")}.
                  </div>
                ) : null}
              </div>
            ) : null}

            <div className="travel-card__grid">
              <div className="travel-info">
                <span className="travel-info__label">Current City</span>
                <strong className="travel-info__value">{currentCity.name}</strong>
              </div>
              <div className="travel-info">
                <span className="travel-info__label">Travel Mode</span>
                <strong className="travel-info__value">
                  {isTraveling ? getModeLabel(travelState.mode, transportTiers) : selectedTier?.name ?? getModeLabel(selectedTierId, transportTiers)}
                  {travelState.escort || (!isTraveling && escortHired) ? " + Escort" : ""}
                </strong>
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
              <TravelSplash
                travelState={travelState}
                now={now}
                tier={activeTravelTier}
                redirectedFrom={location.state?.redirectedFrom ?? null}
                onCancel={() => void handleCancelTravel()}
                cancelBusy={cancelingTravel}
              />
            ) : null}

            <p className="travel-card__summary">{selectedCity.summary}</p>

            {!isTraveling && canTravel ? (
              <div className="travel-subsection">
                <div className="travel-subsection__title">Transport</div>
                <div className="travel-transport-grid">
                  {(transportTiers.length ? transportTiers : []).map((tier) => (
                    <button
                      key={tier.id}
                      type="button"
                      className={`travel-transport-option${selectedTierId === tier.id ? " travel-transport-option--selected" : ""}`}
                      onClick={() => setSelectedTierId(tier.id)}
                    >
                      <div className="travel-transport-option__name">{tier.name}</div>
                      <div className="travel-transport-option__meta">{tier.subtype}</div>
                      <div className="travel-transport-option__stats">
                        Cargo {tier.cargoCapacity} | {tier.goldCost} gold
                      </div>
                      <div className="travel-transport-option__stats">{tier.summary}</div>
                    </button>
                  ))}
                  {!transportTiers.length ? (
                    <div className="travel-inline-note">Loading transport options...</div>
                  ) : null}
                </div>

                <div className="travel-subsection__title" style={{ marginTop: 12 }}>
                  Cargo Manifest {cargoCapacity ? `(${cargoTotalQuantity} / ${cargoCapacity} capacity)` : ""}
                </div>
                {cargoOptions.length ? (
                  <div className="travel-cargo-list">
                    {cargoOptions.map((option) => {
                      const carried = cargoSelections[option.itemId] ?? 0;
                      return (
                        <div key={option.itemId} className="travel-cargo-row">
                          <div className="travel-cargo-row__label">
                            {option.label}
                            <span className="travel-cargo-row__owned"> ({option.owned} owned)</span>
                          </div>
                          <div className="travel-cargo-row__controls">
                            <button
                              type="button"
                              className="travel-cargo-step"
                              onClick={() => setCargoQuantity(option.itemId, carried - 1, option.owned)}
                              disabled={carried <= 0}
                            >
                              -
                            </button>
                            <span className="travel-cargo-row__quantity">{carried}</span>
                            <button
                              type="button"
                              className="travel-cargo-step"
                              onClick={() => setCargoQuantity(option.itemId, carried + 1, option.owned)}
                              disabled={carried >= option.owned || cargoTotalQuantity >= cargoCapacity}
                            >
                              +
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="travel-inline-note">Your inventory is empty. Nothing to bring as cargo.</div>
                )}

                <div className="travel-escort-toggle-row">
                  <button
                    type="button"
                    className={`travel-escort-toggle${escortHired ? " travel-escort-toggle--active" : ""}`}
                    onClick={() => setEscortHired((current) => !current)}
                  >
                    {escortHired ? "Escort Hired" : "Hire Escort"}
                    {selectedTier?.estimatedEscortCost != null ? ` (${selectedTier.estimatedEscortCost} gold)` : ""}
                  </button>
                  <span className="travel-destination-registry__hint" style={{ margin: 0 }}>
                    A hired guard cuts encounter risk and softens whatever gets through.
                  </span>
                </div>

                <div className="travel-inline-note">
                  Departure cost: {totalDepartureCost} gold ({player.gold} on hand).
                  {!canAffordDeparture ? " Not enough gold for this loadout." : ""}
                </div>
              </div>
            ) : null}

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
                disabled={!canTravel || !canAffordDeparture}
              >
                {isTraveling
                  ? "Already Traveling"
                  : selectedCity.id === travelState.currentCityId
                    ? "Already Here"
                    : !canAffordDeparture
                      ? "Not Enough Gold"
                      : `Depart Now: ${selectedCity.name}`}
              </button>
            </div>
          </div>
        </section>
      </div>
    </AppShell>
  );
}
