import { Link, useParams } from "react-router-dom";
import { AppShell } from "../components/layout/AppShell";
import { getMapView, mapViews } from "../data/mapSchema";
import "../styles/world-map-ui.css";

function formatMapLabel(value: string) {
  return value
    .replace(/_/g, " ")
    .replace(/-/g, " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

export default function WorldMapPage() {
  const params = useParams();
  const activeMap = getMapView(params.mapId ?? "world") ?? mapViews[0];
  const visibleNodes = activeMap.nodes.filter((node) => node.visibility === "visible");
  const hiddenCount = activeMap.nodes.filter((node) => node.visibility !== "visible").length;

  return (
    <AppShell
      title={activeMap.label}
      hint="Move from world region to regional map, destination node, travel panel, and local screen as routes open."
    >
      <div className="nexis-grid">
        <div className="nexis-column">
          <section className="panel">
            <div className="panel__header">
              <h2>Map Registry</h2>
            </div>
            <div className="panel__body">
              <div className="info-list">
                {mapViews.map((view) => (
                  <div key={view.id} className="info-row">
                    <span className="info-row__label">{view.label}</span>
                    <span className="info-row__value info-row__value--accent">
                      <Link className="inline-route-link" to={view.id === "world" ? "/world-map" : `/maps/${view.id}`}>
                        Open
                      </Link>
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </section>

          <section className="panel">
            <div className="panel__header">
              <h2>Visible Nodes</h2>
            </div>
            <div className="panel__body">
              <div className="info-list">
                {visibleNodes.map((node) => (
                  <div key={node.id} className="info-row">
                    <span className="info-row__label">{node.label}</span>
                    <span className="info-row__value">{formatMapLabel(node.kind)}</span>
                  </div>
                ))}
              </div>
            </div>
          </section>
        </div>

        <div className="nexis-column">
          <section className="panel">
            <div className="panel__header">
              <h2>Map Summary</h2>
            </div>
            <div className="panel__body">
              <p style={{ marginTop: 0 }}>{activeMap.summary}</p>
              <div className="stat-table">
                <div className="stat-row">
                  <span className="stat-row__label">Map Kind</span>
                  <strong className="stat-row__value">{formatMapLabel(activeMap.kind)}</strong>
                </div>
                <div className="stat-row">
                  <span className="stat-row__label">Visible Nodes</span>
                  <strong className="stat-row__value">{visibleNodes.length}</strong>
                </div>
                <div className="stat-row">
                  <span className="stat-row__label">Hidden / Locked</span>
                  <strong className="stat-row__value">{hiddenCount}</strong>
                </div>
                <div className="stat-row">
                  <span className="stat-row__label">Connections</span>
                  <strong className="stat-row__value">{activeMap.edges.length}</strong>
                </div>
              </div>
            </div>
          </section>
        </div>

        <div className="nexis-column">
          <section className="panel">
            <div className="panel__header">
              <h2>Expansion Hooks</h2>
            </div>
            <div className="panel__body">
              <div className="info-list">
                <div className="info-row">
                  <span className="info-row__label">Guild Influence</span>
                  <span className="info-row__value">Ready</span>
                </div>
                <div className="info-row">
                  <span className="info-row__label">Consortium Presence</span>
                  <span className="info-row__value">Ready</span>
                </div>
                <div className="info-row">
                  <span className="info-row__label">Hidden Nodes</span>
                  <span className="info-row__value">Discovery-gated</span>
                </div>
                <div className="info-row">
                  <span className="info-row__label">Keeps / Strongholds</span>
                  <span className="info-row__value">Planned</span>
                </div>
              </div>
              {activeMap.edges.some((edge) => edge.requirements?.length || edge.discovery) ? (
                <div style={{ marginTop: 12, display: "grid", gap: 8 }}>
                  {activeMap.edges
                    .filter((edge) => edge.requirements?.length || edge.discovery)
                    .slice(0, 6)
                    .map((edge) => (
                      <div key={`${edge.from}-${edge.to}-${edge.label}`} className="info-row">
                        <span className="info-row__label">{edge.label ?? `${edge.from} to ${edge.to}`}</span>
                        <span className="info-row__value">
                          {edge.requirements?.length
                            ? edge.requirements.map((requirement) => requirement.label).join(", ")
                            : edge.discovery?.unlockHint ?? "Discovery required"}
                        </span>
                      </div>
                    ))}
                </div>
              ) : null}
            </div>
          </section>
        </div>
      </div>
    </AppShell>
  );
}
