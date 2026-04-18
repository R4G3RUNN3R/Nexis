import { Link } from "react-router-dom";
import { ContentPanel } from "../layout/ContentPanel";
import { getCityDistricts } from "../../data/cityDistricts";
import { type WorldCity } from "../../data/worldMapData";

export default function CityDistrictHub({ city }: { city: WorldCity }) {
  const districts = getCityDistricts(city);

  return (
    <div style={{ display: "grid", gap: 14 }}>
      <div
        style={{
          border: "1px solid rgba(255,255,255,0.08)",
          borderRadius: 10,
          padding: 14,
          background: "rgba(7, 13, 20, 0.58)",
          display: "grid",
          gap: 6,
        }}
      >
        <strong>{city.name}</strong>
        <div style={{ color: "#9fb0bf", fontSize: 13 }}>{city.summary}</div>
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
          gap: 14,
        }}
      >
        {districts.map((district) => (
          <ContentPanel key={district.id} title={district.name}>
            <div style={{ display: "grid", gap: 10 }}>
              <div style={{ fontSize: 13, color: "#9fb0bf" }}>{district.summary}</div>
              {district.destinations.map((destination) =>
                destination.locked ? (
                  <div
                    key={destination.id}
                    style={{
                      border: "1px solid rgba(255,255,255,0.08)",
                      borderRadius: 8,
                      padding: 12,
                      background: "rgba(7, 13, 20, 0.55)",
                      display: "grid",
                      gap: 8,
                    }}
                  >
                    <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center" }}>
                      <strong style={{ display: "flex", gap: 8, alignItems: "center" }}>
                        <span>{destination.icon ?? "?"}</span>
                        <span>{destination.name}</span>
                      </strong>
                      <span style={{ fontSize: 12, color: "#d98f8f" }}>Locked</span>
                    </div>
                    <div style={{ fontSize: 13, opacity: 0.82 }}>{destination.description}</div>
                    <div style={{ fontSize: 12, color: "#b7c3cf" }}>{destination.lockReason}</div>
                  </div>
                ) : (
                  <Link
                    key={destination.id}
                    to={destination.route}
                    className="inline-route-link"
                    style={{
                      border: "1px solid rgba(255,255,255,0.08)",
                      borderRadius: 8,
                      padding: 12,
                      background: "rgba(7, 13, 20, 0.55)",
                      display: "grid",
                      gap: 8,
                      textDecoration: "none",
                      color: "inherit",
                      transition: "border-color 120ms ease, transform 120ms ease, background 120ms ease",
                    }}
                  >
                    <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center" }}>
                      <strong style={{ display: "flex", gap: 8, alignItems: "center" }}>
                        <span>{destination.icon ?? "?"}</span>
                        <span>{destination.name}</span>
                      </strong>
                      <span style={{ fontSize: 12, color: "#d8c278" }}>Open</span>
                    </div>
                    <div style={{ fontSize: 13, opacity: 0.82 }}>{destination.description}</div>
                  </Link>
                ),
              )}
            </div>
          </ContentPanel>
        ))}
      </div>
    </div>
  );
}
