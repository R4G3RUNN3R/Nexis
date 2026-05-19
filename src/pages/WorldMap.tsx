import { Link, useParams } from "react-router-dom";
import { AppShell } from "../components/layout/AppShell";
import { getMapView, mapViews, type MapNode } from "../data/mapSchema";
import "../styles/world-map-ui.css";

function formatAtlasLabel(value: string) {
  return value
    .replace(/_/g, " ")
    .replace(/-/g, " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function atlasRouteForViewId(viewId: string) {
  return viewId === "world" ? "/world-map" : `/maps/${viewId}`;
}

function publicAtlasText(value: string) {
  return value;
}

function statusLabel(node: MapNode) {
  if (node.visibility === "visible") return "Discovered";
  if (node.visibility === "locked") return "Locked rumor";
  return "Hidden rumor";
}

function NodeEntry({ node }: { node: MapNode }) {
  const lockReason = typeof node.metadata?.lockReason === "string" ? node.metadata.lockReason : null;
  return (
    <article style={{ border: "1px solid rgba(255,255,255,0.08)", borderRadius: 8, padding: 12, background: "rgba(7, 13, 20, 0.52)", display: "grid", gap: 6 }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
        <strong>{node.label}</strong>
        <span style={{ color: node.visibility === "visible" ? "#8ec8a7" : "#d0ad74", fontSize: 12 }}>{statusLabel(node)}</span>
      </div>
      <div style={{ color: "#d8c278", fontSize: 12 }}>{formatAtlasLabel(node.kind)}</div>
      <p style={{ margin: 0, color: "#b7c3cf", fontSize: 13 }}>{publicAtlasText(node.summary)}</p>
      {lockReason ? <div style={{ color: "#d0ad74", fontSize: 12 }}>{lockReason}</div> : null}
    </article>
  );
}

export default function WorldMapPage() {
  const params = useParams();
  const activeMap = getMapView(params.mapId ?? "world") ?? mapViews[0];
  const visibleNodes = activeMap.nodes.filter((node) => node.visibility === "visible");
  const lockedNodes = activeMap.nodes.filter((node) => node.visibility !== "visible");
  const discoveryEdges = activeMap.edges.filter((edge) => edge.requirements?.length || edge.discovery || edge.label);

  return (
    <AppShell
      title={activeMap.label}
      hint="Atlas, lore, discovery status, and rumored geography. Use Travel for departure and route movement."
    >
      <div className="nexis-grid">
        <div className="nexis-column">
          <section className="panel">
            <div className="panel__header"><h2>Atlas Volumes</h2></div>
            <div className="panel__body">
              <div className="info-list">
                {mapViews.map((view) => (
                  <div key={view.id} className="info-row">
                    <span className="info-row__label">{view.label}</span>
                    <span className="info-row__value info-row__value--accent">
                      <Link className="inline-route-link" to={atlasRouteForViewId(view.id)}>Read</Link>
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </section>

          <section className="panel">
            <div className="panel__header"><h2>Discovered Entries</h2></div>
            <div className="panel__body">
              <div style={{ display: "grid", gap: 10 }}>
                {visibleNodes.map((node) => <NodeEntry key={node.id} node={node} />)}
              </div>
            </div>
          </section>
        </div>

        <div className="nexis-column">
          <section className="panel">
            <div className="panel__header"><h2>Atlas Summary</h2></div>
            <div className="panel__body">
              <p style={{ marginTop: 0 }}>{publicAtlasText(activeMap.summary)}</p>
              <div className="stat-table">
                <div className="stat-row"><span className="stat-row__label">Atlas Kind</span><strong className="stat-row__value">{formatAtlasLabel(activeMap.kind)}</strong></div>
                <div className="stat-row"><span className="stat-row__label">Discovered</span><strong className="stat-row__value">{visibleNodes.length}</strong></div>
                <div className="stat-row"><span className="stat-row__label">Rumored / Locked</span><strong className="stat-row__value">{lockedNodes.length}</strong></div>
                <div className="stat-row"><span className="stat-row__label">Known Corridors</span><strong className="stat-row__value">{activeMap.edges.length}</strong></div>
              </div>
            </div>
          </section>

          <section className="panel">
            <div className="panel__header"><h2>Rumored and Locked Regions</h2></div>
            <div className="panel__body">
              <div style={{ display: "grid", gap: 10 }}>
                {lockedNodes.length ? lockedNodes.slice(0, 8).map((node) => <NodeEntry key={node.id} node={node} />) : <div style={{ color: "#9fb0bf", fontSize: 13 }}>No locked atlas entries in this volume.</div>}
              </div>
            </div>
          </section>
        </div>

        <div className="nexis-column">
          <section className="panel">
            <div className="panel__header"><h2>Discovery Notes</h2></div>
            <div className="panel__body">
              <div style={{ display: "grid", gap: 8 }}>
                {discoveryEdges.slice(0, 8).map((edge) => (
                  <div key={`${edge.from}-${edge.to}-${edge.label}`} className="info-row">
                    <span className="info-row__label">{edge.label ? publicAtlasText(edge.label) : `${edge.from} to ${edge.to}`}</span>
                    <span className="info-row__value">
                      {edge.requirements?.length
                        ? edge.requirements.map((requirement) => requirement.label).join(", ")
                        : edge.discovery?.unlockHint ?? "Known connection"}
                    </span>
                  </div>
                ))}
              </div>
              <p style={{ color: "#9fb0bf", fontSize: 13, margin: "12px 0 0" }}>
                The atlas records geography and discovery state only. Departure, route risk, and travel timing live on the Travel page.
              </p>
            </div>
          </section>
        </div>
      </div>
    </AppShell>
  );
}
