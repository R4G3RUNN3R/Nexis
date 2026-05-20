import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { AppShell } from "../components/layout/AppShell";
import { getMapView, mapViews, type MapNode } from "../data/mapSchema";
import { getCodexEntryIdForCity, getCodexEntryIdForRegion, getCodexEntryRoute } from "../data/codexData";
import { getServerWorldAtlas, type ServerWorldAtlas } from "../lib/authApi";
import { useAuth } from "../state/AuthContext";
import "../styles/world-map-ui.css";

type AtlasRecordData = Record<string, unknown>;

type CompactEntry = {
  id: string;
  title: string;
  type: string;
  status: string;
  tagline: string;
  lockReason?: string | null;
  current?: boolean;
  codexEntryId: string;
};

function formatAtlasLabel(value: string) {
  return value.replace(/_/g, " ").replace(/-/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}
function atlasRouteForViewId(viewId: string) { return viewId === "world" ? "/world-map" : `/maps/${viewId}`; }
function readString(value: unknown, fallback = "") { return typeof value === "string" ? value : fallback; }
function shortLine(value: unknown, fallback = "Archive note available.") {
  const text = readString(value, fallback).trim();
  if (text.length <= 96) return text;
  return `${text.slice(0, 93).trim()}...`;
}
function statusFromNode(node: MapNode) { if (node.visibility === "visible") return "Discovered"; if (node.visibility === "locked") return "Locked"; return "Unknown"; }
function codexIdFromNode(node: MapNode) {
  if (node.kind === "city") return getCodexEntryIdForCity(node.id);
  if (node.kind === "strategic_site") return getCodexEntryIdForRegion(node.id);
  return `discovery-site-${node.id.replace(/:/g, "-")}`;
}
function entryFromNode(node: MapNode): CompactEntry {
  return { id: node.id, title: node.label, type: formatAtlasLabel(node.kind), status: statusFromNode(node), tagline: shortLine(node.summary), lockReason: readString(node.metadata?.lockReason, "") || null, codexEntryId: codexIdFromNode(node) };
}
function entryFromRecord(record: AtlasRecordData): CompactEntry {
  const id = readString(record.id, readString(record.title, "atlas-entry"));
  const kind = readString(record.kind, record.regionId ? "hidden site" : "atlas entry");
  const status = readString(record.status, "unknown");
  const isCity = ["nexis", "west", "north", "east", "south"].includes(id);
  const codexEntryId = isCity ? getCodexEntryIdForCity(id) : record.regionId ? `discovery-site-${id}` : getCodexEntryIdForRegion(id);
  return { id, title: readString(record.name, readString(record.title, id)), type: formatAtlasLabel(kind), status: formatAtlasLabel(status), tagline: shortLine(record.summary, "Codex entry available."), lockReason: record.lockReason ? String(record.lockReason) : null, current: Boolean(record.current), codexEntryId };
}
function CompactAtlasCard({ entry }: { entry: CompactEntry }) {
  const status = entry.status.toLowerCase();
  const statusClass = status.includes("discovered") ? "world-atlas-card__status--discovered" : status.includes("locked") ? "world-atlas-card__status--locked" : status.includes("rumor") ? "world-atlas-card__status--rumored" : "";
  return (
    <article className="world-atlas-card">
      <div className="world-atlas-card__top"><strong>{entry.title}</strong><span className={`world-atlas-card__status ${statusClass}`}>{entry.status}</span></div>
      <div className="world-atlas-card__meta">{entry.type}{entry.current ? " | Current city" : ""}</div>
      <p>{entry.tagline}</p>
      {entry.lockReason ? <div className="world-atlas-card__lock">{entry.lockReason}</div> : null}
      <Link className="world-atlas-card__link" to={getCodexEntryRoute(entry.codexEntryId)}>Read Entry</Link>
    </article>
  );
}

export default function WorldMapPage() {
  const params = useParams();
  const { authSource, serverSessionToken } = useAuth();
  const activeMap = getMapView(params.mapId ?? "world") ?? mapViews[0];
  const visibleNodes = activeMap.nodes.filter((node) => node.visibility === "visible");
  const lockedNodes = activeMap.nodes.filter((node) => node.visibility !== "visible");
  const discoveryEdges = activeMap.edges.filter((edge) => edge.requirements?.length || edge.discovery || edge.label);
  const [atlas, setAtlas] = useState<ServerWorldAtlas | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function loadAtlas() {
      if (authSource !== "server" || !serverSessionToken) { setAtlas(null); return; }
      const result = await getServerWorldAtlas(serverSessionToken);
      if (cancelled) return;
      setAtlas(result.ok ? result.atlas : null);
    }
    void loadAtlas();
    return () => { cancelled = true; };
  }, [authSource, serverSessionToken]);

  const regions = useMemo(() => (atlas?.regions ?? []) as AtlasRecordData[], [atlas]);
  const cities = useMemo(() => (atlas?.cities ?? []) as AtlasRecordData[], [atlas]);
  const sites = useMemo(() => (atlas?.hiddenSites ?? []) as AtlasRecordData[], [atlas]);
  const discoveries = useMemo(() => (atlas?.discoveries ?? []) as AtlasRecordData[], [atlas]);
  const discoveredEntries = atlas ? cities.filter((entry) => entry.status === "discovered").map(entryFromRecord) : visibleNodes.map(entryFromNode);
  const rumorEntries = atlas ? [...regions, ...cities].filter((entry) => entry.status !== "discovered").slice(0, 10).map(entryFromRecord) : lockedNodes.slice(0, 8).map(entryFromNode);
  const siteEntries = sites.map(entryFromRecord);

  return (
    <AppShell title={activeMap.label} hint="Atlas overview only. Travel handles departures; Codex holds full entries.">
      <div className="nexis-grid world-atlas-overview">
        <div className="nexis-column">
          <section className="panel">
            <div className="panel__header"><h2>Atlas Volumes</h2></div>
            <div className="panel__body"><div className="info-list">{mapViews.map((view) => <div key={view.id} className="info-row"><span className="info-row__label">{view.label}</span><span className="info-row__value info-row__value--accent"><Link className="inline-route-link" to={atlasRouteForViewId(view.id)}>Open</Link></span></div>)}</div></div>
          </section>
          <section className="panel">
            <div className="panel__header"><h2>Discovery Training</h2></div>
            <div className="panel__body world-atlas-training">
              <div>{shortLine(atlas?.education?.worldGeographyMessage, "World Geography controls safe travel discovery and atlas clarity.")}</div>
              <div>{shortLine(atlas?.education?.historicalAwarenessMessage, "Historical Awareness controls ruin, relic, and lore interpretation.")}</div>
              <Link className="inline-route-link" to={getCodexEntryRoute("manual-education")}>Open education manual</Link>
            </div>
          </section>
          <section className="panel">
            <div className="panel__header"><h2>Discovered</h2></div>
            <div className="panel__body"><div className="world-atlas-card-grid">{discoveredEntries.map((entry) => <CompactAtlasCard key={entry.id} entry={entry} />)}</div></div>
          </section>
        </div>

        <div className="nexis-column">
          <section className="panel">
            <div className="panel__header"><h2>Atlas Summary</h2></div>
            <div className="panel__body">
              <div className="stat-table">
                <div className="stat-row"><span className="stat-row__label">Atlas Kind</span><strong className="stat-row__value">{formatAtlasLabel(activeMap.kind)}</strong></div>
                <div className="stat-row"><span className="stat-row__label">Regions</span><strong className="stat-row__value">{atlas ? regions.length : visibleNodes.length}</strong></div>
                <div className="stat-row"><span className="stat-row__label">Cities</span><strong className="stat-row__value">{atlas ? cities.length : activeMap.nodes.length}</strong></div>
                <div className="stat-row"><span className="stat-row__label">Known Corridors</span><strong className="stat-row__value">{activeMap.edges.length}</strong></div>
              </div>
              <div className="world-atlas-note">{shortLine(activeMap.summary)} <Link className="inline-route-link" to={getCodexEntryRoute("atlas-region-hellenic_sphere")}>Read full archive</Link></div>
            </div>
          </section>
          <section className="panel">
            <div className="panel__header"><h2>Rumored / Locked</h2></div>
            <div className="panel__body"><div className="world-atlas-card-grid">{rumorEntries.map((entry) => <CompactAtlasCard key={entry.id} entry={entry} />)}</div></div>
          </section>
        </div>

        <div className="nexis-column">
          <section className="panel">
            <div className="panel__header"><h2>Hidden Sites</h2></div>
            <div className="panel__body"><div className="world-atlas-card-grid">{siteEntries.length ? siteEntries.map((entry) => <CompactAtlasCard key={entry.id} entry={entry} />) : <div className="world-atlas-empty">Hidden site notes unlock through travel, World Geography, and Historical Awareness.</div>}</div></div>
          </section>
          <section className="panel">
            <div className="panel__header"><h2>Discovery Notes</h2></div>
            <div className="panel__body"><div className="info-list">{discoveries.length ? discoveries.slice(0, 8).map((entry) => <div key={String(entry.id)} className="info-row"><span className="info-row__label">{readString(entry.title, "Discovery")}</span><span className="info-row__value">{shortLine(entry.summary, "Recorded")}</span></div>) : discoveryEdges.slice(0, 8).map((edge) => <div key={`${edge.from}-${edge.to}-${edge.label}`} className="info-row"><span className="info-row__label">{edge.label ? edge.label : `${edge.from} to ${edge.to}`}</span><span className="info-row__value">{edge.requirements?.length ? edge.requirements.map((requirement) => requirement.label).join(", ") : edge.discovery?.unlockHint ?? "Known connection"}</span></div>)}</div><div className="world-atlas-note">No departure controls live here. Use <Link className="inline-route-link" to="/travel">Travel</Link> for movement.</div></div>
          </section>
        </div>
      </div>
    </AppShell>
  );
}
