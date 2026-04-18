import { useEffect, useMemo, useState } from "react";
import { useLocation } from "react-router-dom";
import { AppShell } from "../components/layout/AppShell";
import { ContentPanel } from "../components/layout/ContentPanel";
import { worldCities, worldRoutes, type WorldCity, type WorldCityId, worldMapTitle } from "../data/worldMapData";
import { cielCityCopy, cielPageCopy } from "../data/cielPageCopy";
import { askCiel } from "../lib/ciel-system";
import {
  cancelTravel,
  formatTravelDuration,
  getCityName,
  getTravelProgress,
  resolveTravelState,
  startTravel,
  type PersistedTravelState,
} from "../lib/travelState";
import { usePlayer } from "../state/PlayerContext";
import mapImage from "../assets/maps/nexis-world-map.png";
import "../styles/world-map-ui.css";

const CITY_IMAGES: Record<string, string> = {
  nexis: "/images/cities/city_nexis.png",
  north: "/images/cities/city_aethermoor.png",
  east: "/images/cities/city_torvhal.png",
  west: "/images/cities/city_westmarch.png",
  south: "/images/cities/city_embervale.png",
};

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

export default function TravelPage() {
  const { player } = usePlayer();
  const location = useLocation() as { state?: { redirectedFrom?: string } };
  const [now, setNow] = useState(Date.now());
  const [travelState, setTravelState] = useState<PersistedTravelState>(() => resolveTravelState(player.internalId));
  const [selectedCityId, setSelectedCityId] = useState<WorldCityId>(() => resolveTravelState(player.internalId).currentCityId);

  useEffect(() => {
    setTravelState(resolveTravelState(player.internalId));
    const timer = window.setInterval(() => {
      const currentNow = Date.now();
      setNow(currentNow);
      setTravelState(resolveTravelState(player.internalId, currentNow));
    }, 1000);
    return () => window.clearInterval(timer);
  }, [player.internalId]);

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

  const pageCopy = cielPageCopy.travel;
  const cityCopy = cielCityCopy[selectedCity.id] ?? cielPageCopy.city;
  const progress = getTravelProgress(travelState, now);
  const isTraveling = progress.active;
  const destinationName = getCityName(travelState.destinationCityId);
  const originName = getCityName(travelState.originCityId);
  const canTravel = !isTraveling && selectedCity.id !== travelState.currentCityId;
  const academyLabel = selectedCity.academy ?? (selectedCity.id === "nexis" ? "Ashen Crown Academy of Commerce & Civil Arts" : "None");

  function handleTravel() {
    if (!canTravel) return;
    const nextState = startTravel(player.internalId, selectedCity.id, Date.now(), {
      propertyId: player.property.current,
      installedUpgradeIds: player.property.installedUpgrades,
    });
    setTravelState(nextState);
  }

  function handleCancelTravel() {
    const nextState = cancelTravel(player.internalId, Date.now());
    setTravelState(nextState);
  }

  return (
    <AppShell
      title="Travel"
      hint={pageCopy.flavor}
    >
      <div className="page-intro-grid">
        <ContentPanel title="Travel Office">
          <p className="page-intro__lead">{pageCopy.flavor}</p>
          <p className="page-intro__body">{pageCopy.alt}</p>
        </ContentPanel>
        <ContentPanel title="CIEL">
          <p className="page-intro__body">{pageCopy.ciel}</p>
        </ContentPanel>
      </div>

      <div className="travel-layout">
        <section className="travel-panel travel-panel--map">
          <div className="travel-panel__header">{worldMapTitle}</div>
          <div className="travel-map-frame">
            <img src={mapImage} alt="The world map of Ashen Crown" className="travel-map-image" />
            {worldCities.map((city) => (
              <button
                key={city.id}
                type="button"
                className={getPinClass(city.region)}
                style={{ left: `${city.xPercent}%`, top: `${city.yPercent}%` }}
                onClick={() => {
                  setSelectedCityId(city.id);
                  askCiel("travel_destination", city);
                }}
                aria-label={city.name}
                title={city.name}
              >
                <span className="travel-pin__dot" />
                <span className="travel-pin__label">{city.name}</span>
              </button>
            ))}
          </div>
        </section>

        <section className="travel-panel">
          <div className="travel-panel__header">Selected Destination</div>
          <div className="travel-card">
            {CITY_IMAGES[selectedCity.id] ? (
              <div className="travel-city-art">
                <img src={CITY_IMAGES[selectedCity.id]} alt={selectedCity.name} className="travel-city-art__img" />
              </div>
            ) : null}

            <div className="travel-card__title">{selectedCity.name}</div>
            <div className="travel-card__subtitle">{selectedCity.subtitle}</div>

            <div className="travel-card__copy-block">
              <p className="page-intro__lead">{cityCopy.flavor}</p>
              <p className="page-intro__body">{cityCopy.ciel}</p>
            </div>

            <div className="travel-card__grid">
              <div className="travel-info">
                <span className="travel-info__label">Current City</span>
                <strong className="travel-info__value">{currentCity.name}</strong>
              </div>
              <div className="travel-info">
                <span className="travel-info__label">Access Rule</span>
                <strong className="travel-info__value">{selectedCity.accessRule}</strong>
              </div>
              <div className="travel-info">
                <span className="travel-info__label">Academy</span>
                <strong className="travel-info__value">{academyLabel}</strong>
              </div>
              <div className="travel-info">
                <span className="travel-info__label">Travel Feel</span>
                <strong className="travel-info__value">{selectedCity.travelFeel}</strong>
              </div>
            </div>

            {isTraveling ? (
              <div
                style={{
                  display: "grid",
                  gap: 8,
                  marginBottom: 14,
                  border: "1px solid rgba(255,255,255,0.08)",
                  borderRadius: 8,
                  padding: 12,
                }}
              >
                <strong>Travel In Progress</strong>
                <div style={{ fontSize: 13, color: "#b7c3cf" }}>
                  {originName} to {destinationName}
                </div>
                <div style={{ height: 12, borderRadius: 999, background: "rgba(255,255,255,0.08)", overflow: "hidden" }}>
                  <div
                    style={{
                      width: `${progress.percent}%`,
                      height: "100%",
                      background: "linear-gradient(90deg, rgba(121,188,255,0.75), rgba(107,227,176,0.75))",
                    }}
                  />
                </div>
                <div style={{ fontSize: 12, color: "#d7dee6" }}>
                  {progress.percent}% complete | ETA {formatTravelDuration(progress.remainingMs)}
                </div>
                {location.state?.redirectedFrom ? (
                  <div style={{ fontSize: 12, color: "#d7c17a" }}>
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
                onClick={handleTravel}
                disabled={!canTravel}
              >
                {isTraveling
                  ? "Already Traveling"
                  : selectedCity.id === travelState.currentCityId
                    ? "Already Here"
                    : `Travel to ${selectedCity.name}`}
              </button>
              {isTraveling ? (
                <button type="button" className="travel-action-button" onClick={handleCancelTravel}>
                  Cancel And Return
                </button>
              ) : null}
            </div>
          </div>
        </section>
      </div>
    </AppShell>
  );
}
