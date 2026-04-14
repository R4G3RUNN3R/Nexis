import { useMemo, useState } from "react";
import { AppShell } from "../components/layout/AppShell";
import {
  worldCities,
  worldRoutes,
  type WorldCity,
  type WorldCityId,
  worldMapTitle,
} from "../data/worldMapData";
import { askCiel } from "../lib/ciel-system";
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
  const [selectedCityId, setSelectedCityId] = useState<WorldCityId>("nexis");

  const selectedCity = useMemo(
    () => worldCities.find((city) => city.id === selectedCityId) ?? worldCities[0],
    [selectedCityId]
  );

  const selectedRoutes = useMemo(
    () => worldRoutes.filter((route) => route.from === selectedCity.id || route.to === selectedCity.id),
    [selectedCity]
  );

  return (
    <AppShell
      title="Travel"
      hint="Large world map, clear destination card, minimal clutter. CIEL remains available through the global bubble and destination interactions."
    >
      <div className="travel-layout">
        <section className="travel-panel travel-panel--map">
          <div className="travel-panel__header">{worldMapTitle}</div>

          <div className="travel-map-frame">
            <img
              src={mapImage}
              alt="The locked world map of Nexis"
              className="travel-map-image"
            />

            {worldCities.map((city) => (
              <button
                key={city.id}
                type="button"
                className={getPinClass(city.region)}
                style={{
                  left: `${city.xPercent}%`,
                  top: `${city.yPercent}%`,
                }}
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
            {CITY_IMAGES[selectedCity.id] && (
              <div className="travel-city-art">
                <img
                  src={CITY_IMAGES[selectedCity.id]}
                  alt={selectedCity.name}
                  className="travel-city-art__img"
                />
              </div>
            )}
            <div className="travel-card__title">{selectedCity.name}</div>
            <div className="travel-card__subtitle">{selectedCity.subtitle}</div>

            <div className="travel-card__grid">
              <div className="travel-info">
                <span className="travel-info__label">Region</span>
                <strong className="travel-info__value">{selectedCity.region}</strong>
              </div>
              <div className="travel-info">
                <span className="travel-info__label">Access Rule</span>
                <strong className="travel-info__value">{selectedCity.accessRule}</strong>
              </div>
              <div className="travel-info">
                <span className="travel-info__label">Academy</span>
                <strong className="travel-info__value">{selectedCity.academy ?? "None"}</strong>
              </div>
              <div className="travel-info">
                <span className="travel-info__label">Travel Feel</span>
                <strong className="travel-info__value">{selectedCity.travelFeel}</strong>
              </div>
            </div>

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
              >
                Travel
              </button>
            </div>
          </div>
        </section>
      </div>
    </AppShell>
  );
}
