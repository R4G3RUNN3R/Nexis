import { useMemo, useState } from "react";
import { useLocation } from "wouter";
import { AppShell } from "../../components/layout/AppShell";
import { activeAccount } from "../../data/accountsData";
import { cityBuildings, type CityBuilding } from "../../data/cityData";
import "./city.css";

function isLocked(building: CityBuilding, level: number) {
  if (building.locked) return true;
  if (building.minLevel && level < building.minLevel) return true;
  return false;
}

function getLockReason(building: CityBuilding, level: number) {
  if (building.lockedReason && isLocked(building, level)) return building.lockedReason;
  return "Unavailable.";
}

export default function CityPage() {
  const [, navigate] = useLocation();
  const [hoveredId, setHoveredId] = useState<string | null>(null);

  const hoveredBuilding = useMemo(
    () => cityBuildings.find((building) => building.id === hoveredId) ?? cityBuildings[0],
    [hoveredId]
  );

  return (
    <AppShell
      title="City"
      hint="Hover buildings to identify them. Click unlocked buildings to enter."
    >
      <div className="city-layout">
        <div className="city-scene-panel">
          <div className="city-scene">
            <img
              src="/city/city-map.png"
              alt="Fortified city of Nexis"
              className="city-scene__image"
            />

            {cityBuildings.map((building) => {
              const locked = isLocked(building, activeAccount.level);
              const active = hoveredId === building.id;

              return (
                <button
                  key={building.id}
                  type="button"
                  className={[
                    "city-hotspot",
                    active ? "city-hotspot--active" : "",
                    locked ? "city-hotspot--locked" : "",
                  ].join(" ")}
                  style={{
                    left: `${building.x}%`,
                    top: `${building.y}%`,
                    width: `${building.w}%`,
                    height: `${building.h}%`,
                  }}
                  onMouseEnter={() => setHoveredId(building.id)}
                  onFocus={() => setHoveredId(building.id)}
                  onClick={() => {
                    if (locked) return;
                    navigate(building.route);
                  }}
                  aria-label={building.name}
                >
                  <span className="city-hotspot__label">{building.name}</span>
                </button>
              );
            })}
          </div>
        </div>

        <div className="city-info-panel">
          <div className="city-info-card">
            <div className="city-info-card__eyebrow">Selected Building</div>
            <div className="city-info-card__title">{hoveredBuilding.name}</div>
            <div className="city-info-card__text">{hoveredBuilding.description}</div>

            {isLocked(hoveredBuilding, activeAccount.level) ? (
              <div className="city-info-card__state city-info-card__state--locked">
                Locked: {getLockReason(hoveredBuilding, activeAccount.level)}
              </div>
            ) : (
              <div className="city-info-card__state city-info-card__state--open">
                Available now.
              </div>
            )}
          </div>

          <div className="city-info-card">
            <div className="city-info-card__eyebrow">Access Notes</div>
            <div className="city-info-list">
              <div>Academy handles Education access.</div>
              <div>Estate Office opens the property marketplace.</div>
              <div>Travel Office and Caravan Depot unlock at level 15.</div>
              <div>Black Market remains restricted until Shadowcraft access exists.</div>
            </div>
          </div>
        </div>
      </div>
    </AppShell>
  );
}
