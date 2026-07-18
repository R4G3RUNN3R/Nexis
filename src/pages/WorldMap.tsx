import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { AppShell } from "../components/layout/AppShell";
import { getMapView, mapViews, type MapNode } from "../data/mapSchema";
import { getCodexEntryIdForCity, getCodexEntryIdForRegion, getCodexEntryRoute } from "../data/codexData";
import {
  worldCities,
  worldRegions,
  worldRoutes,
  worldRumorLinks,
  type WorldCity,
  type WorldCityId,
} from "../data/worldMapData";
import { ATLAS_REGION_ANCHORS, FRONTIER_REGION_IDS, getHiddenSitePosition } from "../data/worldAtlasPositions";
import { getPinStyle } from "../lib/mapPins";
import { getServerWorldAtlas, type ServerWorldAtlas } from "../lib/authApi";
import { useAuth } from "../state/AuthContext";
import { usePlayer } from "../state/PlayerContext";
import { readTravelStateFromPlayer } from "../lib/travelState";
import { useMapZoomPan } from "../hooks/useMapZoomPan";
import { MapZoomControls } from "../components/worldmap/MapZoomControls";
import mapImage from "../assets/maps/nexis-world-map-expanded.jpg";
import { EXCURSION_GRID, excursionMapLocations, getExcursionMarkerStyle } from "../data/excursionMapData";
import "../styles/world-map-ui.css";
import "../styles/world-atlas-interactive.css";
import "../styles/map-zoom-controls.css";

type AtlasRecordData = Record<string, unknown>;

type CityAtlas = {
  id: WorldCityId;
  name: string;
  regionId: string;
  status: "discovered" | "rumored" | "locked";
  lockReason: string | null;
  summary: string;
  current: boolean;
};

type RegionAtlas = {
  id: string;
  name: string;
  summary: string;
  status: "discovered" | "rumored" | "locked";
  lockReason: string | null;
};

type SiteAtlas = {
  id: string;
  name: string;
  status: "unknown" | "rumored" | "discovered" | "explored";
  summary: string;
  lockReason: string | null;
  regionId: string;
  cityIds: string[];
  codexEntryId: string;
};

type DiscoveryNote = {
  id: string;
  title: string;
  summary: string;
  regionId: string | null;
  siteId: string | null;
};

type AtlasSelection =
  | { kind: "city"; id: WorldCityId }
  | { kind: "site"; id: string }
  | { kind: "region"; id: string }
  | { kind: "frontier"; id: string }
  | null;

const CITY_REGION_IDS: Record<WorldCityId, string> = {
  nexis: "central_crown",
  west: "western_coast",
  north: "northern_bough",
  east: "eastern_forges",
  south: "southern_court",
};

function readString(value: unknown, fallback = "") {
  return typeof value === "string" ? value : fallback;
}

function readStringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((entry): entry is string => typeof entry === "string") : [];
}

function formatAtlasLabel(value: string) {
  return value.replace(/[_-]/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function shortLine(value: unknown, fallback = "Archive note available.") {
  const text = readString(value, fallback).trim();
  if (text.length <= 110) return text;
  return `${text.slice(0, 107).trim()}...`;
}

function normalizeTriState(value: unknown): "discovered" | "rumored" | "locked" {
  const status = readString(value, "locked");
  return status === "discovered" || status === "rumored" ? status : "locked";
}

function parseCities(atlas: ServerWorldAtlas | null, fallbackCurrentCityId: string): CityAtlas[] {
  if (!atlas) {
    // Local/offline fallback mirrors the old page's fallback (all core cities
    // treated as charted) so the map never renders empty.
    return worldCities.map((city) => ({
      id: city.id,
      name: city.name,
      regionId: CITY_REGION_IDS[city.id],
      status: "discovered" as const,
      lockReason: null,
      summary: city.summary,
      current: city.id === fallbackCurrentCityId,
    }));
  }
  return (atlas.cities as AtlasRecordData[]).flatMap((record) => {
    const id = readString(record.id);
    const staticCity = worldCities.find((city) => city.id === id);
    if (!staticCity) return [];
    return [{
      id: staticCity.id,
      name: readString(record.name, staticCity.name),
      regionId: readString(record.regionId, CITY_REGION_IDS[staticCity.id]),
      status: normalizeTriState(record.status),
      lockReason: record.lockReason ? String(record.lockReason) : null,
      summary: readString(record.summary, staticCity.summary),
      current: Boolean(record.current),
    }];
  });
}

function parseRegions(atlas: ServerWorldAtlas | null): RegionAtlas[] {
  if (!atlas) return [];
  return (atlas.regions as AtlasRecordData[]).map((record) => ({
    id: readString(record.id),
    name: readString(record.name, formatAtlasLabel(readString(record.id, "region"))),
    summary: readString(record.summary),
    status: normalizeTriState(record.status),
    lockReason: record.lockReason ? String(record.lockReason) : null,
  }));
}

function parseSites(atlas: ServerWorldAtlas | null): SiteAtlas[] {
  if (!atlas) return [];
  return (atlas.hiddenSites as AtlasRecordData[]).map((record) => {
    const status = readString(record.status, "unknown");
    return {
      id: readString(record.id),
      name: readString(record.name, readString(record.title, "Hidden Site")),
      status: (["rumored", "discovered", "explored"].includes(status) ? status : "unknown") as SiteAtlas["status"],
      summary: readString(record.summary),
      lockReason: record.lockReason ? String(record.lockReason) : null,
      regionId: readString(record.regionId),
      cityIds: readStringArray(record.cityIds),
      codexEntryId: readString(record.codexEntryId, `discovery-site-${readString(record.id)}`),
    };
  });
}

function parseDiscoveries(atlas: ServerWorldAtlas | null): DiscoveryNote[] {
  if (!atlas) return [];
  return (atlas.discoveries as AtlasRecordData[]).map((record) => ({
    id: readString(record.id, readString(record.title, "discovery")),
    title: readString(record.title, "Discovery"),
    summary: readString(record.summary, "Recorded."),
    regionId: record.regionId ? String(record.regionId) : null,
    siteId: record.siteId ? String(record.siteId) : null,
  }));
}

function nodePointFor(nodeId: string): { xPercent: number; yPercent: number } | null {
  const city = worldCities.find((entry) => entry.id === nodeId);
  if (city) return { xPercent: city.xPercent, yPercent: city.yPercent };
  const region = worldRegions.find((entry) => entry.id === nodeId);
  if (region) return { xPercent: region.xPercent, yPercent: region.yPercent };
  return null;
}

function StatusBadge({ status }: { status: string }) {
  const cls = status === "discovered" || status === "explored"
    ? "wm-status--discovered"
    : status === "rumored"
      ? "wm-status--rumored"
      : status === "charted"
        ? "wm-status--charted"
        : "wm-status--locked";
  return <span className={`wm-status ${cls}`}>{status === "charted" ? "Charted rumor" : status}</span>;
}

function InteractiveWorldAtlas() {
  const { authSource, serverSessionToken } = useAuth();
  const { player } = usePlayer();
  const [atlas, setAtlas] = useState<ServerWorldAtlas | null>(null);
  const [selection, setSelection] = useState<AtlasSelection>(null);
  const [recordsOpen, setRecordsOpen] = useState(false);
  const zoomPan = useMapZoomPan();

  useEffect(() => {
    let cancelled = false;
    async function loadAtlas() {
      if (authSource !== "server" || !serverSessionToken) {
        setAtlas(null);
        return;
      }
      const result = await getServerWorldAtlas(serverSessionToken);
      if (cancelled) return;
      setAtlas(result.ok ? result.atlas : null);
    }
    void loadAtlas();
    return () => {
      cancelled = true;
    };
  }, [authSource, serverSessionToken]);

  const fallbackCurrentCityId = readTravelStateFromPlayer(player).currentCityId;
  const cities = useMemo(() => parseCities(atlas, fallbackCurrentCityId), [atlas, fallbackCurrentCityId]);
  const regions = useMemo(() => parseRegions(atlas), [atlas]);
  const sites = useMemo(() => parseSites(atlas), [atlas]);
  const discoveries = useMemo(() => parseDiscoveries(atlas), [atlas]);

  const cityById = useMemo(() => new Map(cities.map((city) => [city.id, city])), [cities]);
  const regionById = useMemo(() => new Map(regions.map((region) => [region.id, region])), [regions]);
  // Undiscovered content stays invisible: "unknown" sites never reach the map.
  const revealedSites = useMemo(() => sites.filter((site) => site.status !== "unknown"), [sites]);
  const siteById = useMemo(() => new Map(revealedSites.map((site) => [site.id, site])), [revealedSites]);
  const hiddenCounts = atlas?.hiddenCounts ?? {};

  const frontierRegions = useMemo(
    () => worldRegions.filter((region) => (FRONTIER_REGION_IDS as readonly string[]).includes(region.id)),
    [],
  );

  // Region markers: atlas regions with a map anchor. City-adjacent region
  // labels double as "fog" markers when locked.
  const regionMarkers = useMemo(
    () =>
      regions.flatMap((region) => {
        const anchor = ATLAS_REGION_ANCHORS[region.id];
        return anchor ? [{ region, anchor }] : [];
      }),
    [regions],
  );

  const renderedNodeIds = useMemo(() => {
    const ids = new Set<string>(worldCities.map((city) => city.id));
    for (const region of frontierRegions) ids.add(region.id);
    if (regionById.has("hellenic_sphere")) ids.add("hellenic_sphere");
    return ids;
  }, [frontierRegions, regionById]);

  const rumorLines = useMemo(
    () =>
      worldRumorLinks.flatMap((link) => {
        if (!renderedNodeIds.has(link.fromNodeId) || !renderedNodeIds.has(link.toNodeId)) return [];
        const from = nodePointFor(link.fromNodeId);
        const to = nodePointFor(link.toNodeId);
        return from && to ? [{ link, from, to }] : [];
      }),
    [renderedNodeIds],
  );

  const selectedPoint = useMemo(() => {
    if (!selection) return null;
    if (selection.kind === "city") return nodePointFor(selection.id);
    if (selection.kind === "site") {
      const site = siteById.get(selection.id);
      return site ? getHiddenSitePosition(site.id, site.cityIds) : null;
    }
    if (selection.kind === "region") return ATLAS_REGION_ANCHORS[selection.id] ?? null;
    return nodePointFor(selection.id);
  }, [selection, siteById]);

  const discoveredCityCount = cities.filter((city) => city.status === "discovered").length;
  const discoveredRegionCount = regions.filter((region) => region.status === "discovered").length;

  function selectCity(id: WorldCityId) {
    setSelection((current) => (current?.kind === "city" && current.id === id ? null : { kind: "city", id }));
  }

  function renderSiteChips(list: SiteAtlas[]) {
    return (
      <div className="wm-chip-row">
        {list.map((site) => (
          <button key={site.id} type="button" className="wm-chip" onClick={() => setSelection({ kind: "site", id: site.id })}>
            {site.status === "rumored" ? "?" : "◆"} {site.name}
            <span className="wm-chip__state">{site.status}</span>
          </button>
        ))}
      </div>
    );
  }

  function renderDiscoveryNotes(list: DiscoveryNote[]) {
    if (!list.length) return null;
    return (
      <div className="wm-subsection">
        <div className="wm-subsection__title">Discovery Notes</div>
        <div className="wm-note-list">
          {list.slice(0, 5).map((note) => (
            <div key={note.id} className="wm-note-row">
              <strong>{note.title}.</strong> {shortLine(note.summary)}
            </div>
          ))}
        </div>
      </div>
    );
  }

  function renderCityPanel(city: CityAtlas) {
    const staticCity = worldCities.find((entry) => entry.id === city.id) as WorldCity;
    const region = regionById.get(city.regionId) ?? null;
    const citySites = revealedSites.filter((site) => site.cityIds.includes(city.id));
    const cityRoutes = worldRoutes.filter((route) => route.from === city.id || route.to === city.id);
    const cityRumors = rumorLines.filter(({ link }) => link.fromNodeId === city.id || link.toNodeId === city.id);
    const citySiteIds = new Set(citySites.map((site) => site.id));
    const cityNotes = discoveries.filter(
      (note) => (note.siteId && citySiteIds.has(note.siteId)) || note.regionId === city.regionId,
    );
    const discovered = city.status === "discovered";
    return (
      <div className="wm-side-panel__body">
        <div className="wm-place-kicker">{region ? region.name : "City"} · City</div>
        <div className="wm-place-title-row">
          <h3 className="wm-place-title">{city.name}</h3>
          <StatusBadge status={city.status} />
        </div>
        <div className="wm-place-subtitle">{staticCity.subtitle}{city.current ? " · You are here" : ""}</div>

        {discovered ? (
          <>
            <p className="wm-place-summary">{city.summary}</p>
            <p className="wm-place-summary">{staticCity.travelFeel}</p>
          </>
        ) : (
          <>
            <p className="wm-place-summary">{shortLine(city.summary, "Only fragmentary notes exist for this place.")}</p>
            {city.lockReason ? <div className="wm-lock-note">{city.lockReason}</div> : null}
          </>
        )}

        {region && region.status !== "discovered" && region.lockReason ? (
          <div className="wm-lock-note">{region.lockReason}</div>
        ) : null}

        <div className="wm-subsection">
          <div className="wm-subsection__title">Known Routes</div>
          <div className="wm-route-list">
            {cityRoutes.map((route) => {
              const otherId = route.from === city.id ? route.to : route.from;
              const other = worldCities.find((entry) => entry.id === otherId);
              return (
                <div key={route.id} className="wm-route-row">
                  <strong>{route.travelLabel}</strong> — to {other?.name ?? formatAtlasLabel(otherId)}. {route.rule}
                </div>
              );
            })}
            {cityRumors.map(({ link }) => (
              <div key={link.id} className="wm-route-row wm-route-row--rumored">
                <strong>{link.label}</strong>
                <span className="wm-route-row__tag">charted, locked</span>
                <div>{link.summary}</div>
                {link.discovery?.unlockHint ? <div>{link.discovery.unlockHint}</div> : null}
              </div>
            ))}
          </div>
        </div>

        {citySites.length ? (
          <div className="wm-subsection">
            <div className="wm-subsection__title">Sites Found Nearby</div>
            {renderSiteChips(citySites)}
          </div>
        ) : null}

        {renderDiscoveryNotes(cityNotes)}

        <div className="wm-side-actions">
          {city.current ? (
            <Link className="wm-depart-btn" to="/city">You are here — enter the city</Link>
          ) : (
            <Link className="wm-depart-btn" to={`/travel?to=${city.id}`}>Depart for {city.name}</Link>
          )}
          <Link className="wm-side-link" to={getCodexEntryRoute(getCodexEntryIdForCity(city.id))}>Read full Codex entry</Link>
        </div>
      </div>
    );
  }

  function renderSitePanel(site: SiteAtlas) {
    const region = regionById.get(site.regionId) ?? null;
    const nearCities = site.cityIds
      .map((cityId) => cityById.get(cityId as WorldCityId))
      .filter((city): city is CityAtlas => Boolean(city));
    const siteNotes = discoveries.filter((note) => note.siteId === site.id);
    return (
      <div className="wm-side-panel__body">
        <div className="wm-place-kicker">{region ? region.name : "Wilds"} · Hidden Site</div>
        <div className="wm-place-title-row">
          <h3 className="wm-place-title">{site.name}</h3>
          <StatusBadge status={site.status} />
        </div>
        <p className="wm-place-summary">{site.summary}</p>
        {site.status === "rumored" ? (
          <div className="wm-lock-note">
            Only rumors place this site so far. Its marker is approximate until you find it through travel.
          </div>
        ) : null}
        {site.lockReason ? <div className="wm-lock-note">{site.lockReason}</div> : null}
        {nearCities.length ? (
          <div className="wm-subsection">
            <div className="wm-subsection__title">Reported Near</div>
            <div className="wm-chip-row">
              {nearCities.map((city) => (
                <button key={city.id} type="button" className="wm-chip" onClick={() => selectCity(city.id)}>
                  {city.name}
                </button>
              ))}
            </div>
          </div>
        ) : null}
        {renderDiscoveryNotes(siteNotes)}
        <div className="wm-side-actions">
          <Link className="wm-side-link" to={getCodexEntryRoute(site.codexEntryId)}>Read full Codex entry</Link>
        </div>
      </div>
    );
  }

  function renderRegionPanel(region: RegionAtlas) {
    const regionCities = cities.filter((city) => city.regionId === region.id);
    const regionSites = revealedSites.filter((site) => site.regionId === region.id);
    const regionNotes = discoveries.filter((note) => note.regionId === region.id);
    return (
      <div className="wm-side-panel__body">
        <div className="wm-place-kicker">Region</div>
        <div className="wm-place-title-row">
          <h3 className="wm-place-title">{region.name}</h3>
          <StatusBadge status={region.status} />
        </div>
        <p className="wm-place-summary">{region.summary}</p>
        {region.lockReason ? <div className="wm-lock-note">{region.lockReason}</div> : null}
        {regionCities.length ? (
          <div className="wm-subsection">
            <div className="wm-subsection__title">Cities</div>
            <div className="wm-chip-row">
              {regionCities.map((city) => (
                <button key={city.id} type="button" className="wm-chip" onClick={() => selectCity(city.id)}>
                  {city.name}
                  <span className="wm-chip__state">{city.status}</span>
                </button>
              ))}
            </div>
          </div>
        ) : null}
        {regionSites.length ? (
          <div className="wm-subsection">
            <div className="wm-subsection__title">Sites Found Here</div>
            {renderSiteChips(regionSites)}
          </div>
        ) : null}
        {renderDiscoveryNotes(regionNotes)}
        <div className="wm-side-actions">
          <Link className="wm-side-link" to={getCodexEntryRoute(getCodexEntryIdForRegion(region.id))}>Read full Codex entry</Link>
        </div>
      </div>
    );
  }

  function renderFrontierPanel(regionId: string) {
    const region = worldRegions.find((entry) => entry.id === regionId);
    if (!region) return null;
    const touchingRumors = worldRumorLinks.filter(
      (link) => link.fromNodeId === region.id || link.toNodeId === region.id,
    );
    const isKnown = region.status === "preserved_core" || region.status === "fully_wired";
    return (
      <div className="wm-side-panel__body">
        <div className="wm-place-kicker">{formatAtlasLabel(region.kind)} · Frontier</div>
        <div className="wm-place-title-row">
          <h3 className="wm-place-title">{region.name}</h3>
          <StatusBadge status={isKnown ? "discovered" : "charted"} />
        </div>
        <p className="wm-place-summary">{region.summary}</p>
        {!isKnown ? (
          <div className="wm-lock-note">
            Charted from rumor only. No open travel routes reach this expanse yet.
          </div>
        ) : null}
        {touchingRumors.length ? (
          <div className="wm-subsection">
            <div className="wm-subsection__title">Rumored Corridors</div>
            <div className="wm-route-list">
              {touchingRumors.map((link) => (
                <div key={link.id} className="wm-route-row wm-route-row--rumored">
                  <strong>{link.label}</strong>
                  <span className="wm-route-row__tag">charted, locked</span>
                  <div>{link.summary}</div>
                  {link.discovery?.unlockHint ? <div>{link.discovery.unlockHint}</div> : null}
                </div>
              ))}
            </div>
          </div>
        ) : null}
      </div>
    );
  }

  function renderDefaultPanel() {
    return (
      <div className="wm-side-panel__body">
        <div className="wm-place-kicker">Atlas of the Realm</div>
        <div className="wm-place-title-row">
          <h3 className="wm-place-title">The Known World</h3>
        </div>
        <p className="wm-place-summary wm-empty-hint">
          Select any marker on the map to review everything you have discovered about that place —
          atlas notes, known routes, nearby sites, and what still remains to unlock.
        </p>
        <div className="wm-count-table">
          <div className="wm-count-row"><span>Cities charted</span><strong>{discoveredCityCount} of {cities.length}</strong></div>
          <div className="wm-count-row"><span>Regions expanded</span><strong>{discoveredRegionCount} of {regions.length || "—"}</strong></div>
          <div className="wm-count-row"><span>Hidden sites</span><strong>{hiddenCounts.discovered ?? 0} found / {hiddenCounts.rumored ?? 0} rumored</strong></div>
          <div className="wm-count-row"><span>Sites still unknown</span><strong>{hiddenCounts.unknown ?? 0}</strong></div>
        </div>
        <p className="wm-place-summary wm-empty-hint">
          Travel, World Geography, and Historical Awareness reveal more of the map. Undiscovered
          places stay blank until you earn them.
        </p>
      </div>
    );
  }

  const selectedCity = selection?.kind === "city" ? cityById.get(selection.id) ?? null : null;
  const selectedSite = selection?.kind === "site" ? siteById.get(selection.id) ?? null : null;
  const selectedRegion = selection?.kind === "region" ? regionById.get(selection.id) ?? null : null;

  return (
    <AppShell
      title="World Map"
      hint="The living atlas: everything you have discovered, charted where it belongs. Travel owns departures."
    >
      <div className="wm-layout">
        <div className="wm-map-column">
          <section className="wm-map-panel">
            <div className="wm-map-panel__header">
              <h2 className="wm-map-panel__title">The Lands of Nexis</h2>
              <span className="wm-map-panel__hint">Select a marker for its atlas entry</span>
            </div>
            <div
              ref={zoomPan.viewportRef}
              className={`wm-map-viewport${zoomPan.isDragging ? " wm-map-viewport--dragging" : ""}`}
              {...zoomPan.pointerHandlers}
            >
              <div ref={zoomPan.contentRef} className="wm-map-frame" style={{ transform: zoomPan.cssTransform }}>
                <img src={mapImage} alt="The world map of Nexis" className="wm-map-image" draggable={false} />
                <svg className="wm-routes" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden>
                  {worldRoutes.map((route) => {
                    const from = nodePointFor(route.from);
                    const to = nodePointFor(route.to);
                    if (!from || !to) return null;
                    return (
                      <line
                        key={route.id}
                        x1={from.xPercent}
                        y1={from.yPercent}
                        x2={to.xPercent}
                        y2={to.yPercent}
                        stroke="rgba(216, 154, 71, 0.55)"
                        strokeWidth="1.6"
                        vectorEffect="non-scaling-stroke"
                      />
                    );
                  })}
                  {rumorLines.map(({ link, from, to }) => (
                    <line
                      key={link.id}
                      x1={from.xPercent}
                      y1={from.yPercent}
                      x2={to.xPercent}
                      y2={to.yPercent}
                      stroke="rgba(205, 178, 138, 0.22)"
                      strokeWidth="1.1"
                      strokeDasharray="4 5"
                      vectorEffect="non-scaling-stroke"
                    />
                  ))}
                </svg>

                {selectedPoint ? (
                  <div
                    className="wm-spotlight"
                    style={{ left: `${selectedPoint.xPercent}%`, top: `${selectedPoint.yPercent}%` }}
                    aria-hidden
                  />
                ) : null}

                {regionMarkers.map(({ region, anchor }) => (
                  <button
                    key={region.id}
                    type="button"
                    className={`wm-region wm-region--${region.status}${selection?.kind === "region" && selection.id === region.id ? " wm-region--selected" : ""}`}
                    style={{ left: `${anchor.xPercent}%`, top: `${anchor.yPercent}%` }}
                    onClick={() => setSelection({ kind: "region", id: region.id })}
                    title={`${region.name} (${region.status})`}
                  >
                    {region.name}{region.status !== "discovered" ? " ?" : ""}
                  </button>
                ))}

                {frontierRegions.filter((region) => region.id !== "hellenic_sphere").map((region) => {
                  const isKnown = region.status === "preserved_core" || region.status === "fully_wired";
                  return (
                    <button
                      key={region.id}
                      type="button"
                      className={`wm-region ${isKnown ? "wm-region--discovered" : "wm-region--frontier"}${selection?.kind === "frontier" && selection.id === region.id ? " wm-region--selected" : ""}`}
                      style={{ left: `${region.xPercent}%`, top: `${region.yPercent}%` }}
                      onClick={() => setSelection({ kind: "frontier", id: region.id })}
                      title={`${region.name} (${isKnown ? "known expanse" : "charted rumor"})`}
                    >
                      {region.name}{isKnown ? "" : " ?"}
                    </button>
                  );
                })}

                <div className="excursion-map-grid excursion-map-grid--atlas" aria-hidden>
                  {Array.from({ length: EXCURSION_GRID.columns - 1 }).map((_, index) => <span key={`atlas-x-${index}`} style={{ left: `${((index + 1) / EXCURSION_GRID.columns) * 100}%` }} />)}
                  {Array.from({ length: EXCURSION_GRID.rows - 1 }).map((_, index) => <i key={`atlas-y-${index}`} style={{ top: `${((index + 1) / EXCURSION_GRID.rows) * 100}%` }} />)}
                </div>
                {excursionMapLocations.map((location) => (
                  <Link
                    key={location.id}
                    to={`/adventure?excursion=${location.id}`}
                    className={`excursion-map-marker excursion-map-marker--atlas excursion-map-marker--${location.risk.toLowerCase()}`}
                    style={getExcursionMarkerStyle(location)}
                    title={`${location.name} | ${location.type} | ${location.risk}`}
                    aria-label={`Open excursion lead for ${location.name}`}
                  >
                    <span className="excursion-map-marker__dot" />
                    <span className="excursion-map-marker__label">{location.name}</span>
                  </Link>
                ))}
                {revealedSites.map((site) => {
                  const position = getHiddenSitePosition(site.id, site.cityIds);
                  if (!position) return null;
                  const isSelected = selection?.kind === "site" && selection.id === site.id;
                  return (
                    <button
                      key={site.id}
                      type="button"
                      className={`wm-site wm-site--${site.status}${isSelected ? " wm-site--selected" : ""}`}
                      style={{ left: `${position.xPercent}%`, top: `${position.yPercent}%` }}
                      onClick={() => setSelection({ kind: "site", id: site.id })}
                      aria-label={`${site.name} (${site.status} hidden site)`}
                      title={`${site.name} (${site.status})`}
                    >
                      <span className="wm-site__mark">{site.status === "rumored" ? "?" : "◆"}</span>
                      <span className="wm-site__label">{site.name}</span>
                    </button>
                  );
                })}

                {cities.map((city) => {
                  const staticCity = worldCities.find((entry) => entry.id === city.id) as WorldCity;
                  const isSelected = selectedCity?.id === city.id;
                  return (
                    <button
                      key={city.id}
                      type="button"
                      className={`wm-pin wm-pin--${city.status}${isSelected ? " wm-pin--selected" : ""}${city.current ? " wm-pin--current" : ""}`}
                      style={getPinStyle(staticCity)}
                      onClick={() => selectCity(city.id)}
                      aria-label={`${city.name} (${city.status})`}
                      title={`${city.name} (${city.status})`}
                    >
                      <span className="wm-pin__dot">{city.status !== "discovered" ? "?" : ""}</span>
                      <span className="wm-pin__label">{city.name}</span>
                    </button>
                  );
                })}
              </div>
              <MapZoomControls
                scale={zoomPan.scale}
                canZoomIn={zoomPan.canZoomIn}
                canZoomOut={zoomPan.canZoomOut}
                onZoomIn={zoomPan.zoomIn}
                onZoomOut={zoomPan.zoomOut}
                onReset={zoomPan.reset}
                onFitToView={zoomPan.fitToView}
              />
            </div>
            <div className="wm-legend">
              <span className="wm-legend__item"><span className="wm-legend__swatch wm-legend__swatch--discovered" /> Discovered city</span>
              <span className="wm-legend__item"><span className="wm-legend__swatch wm-legend__swatch--rumored">?</span> Rumored</span>
              <span className="wm-legend__item"><span className="wm-legend__swatch wm-legend__swatch--locked">?</span> Locked entry</span>
              <span className="wm-legend__item"><span className="wm-legend__swatch wm-legend__swatch--site">◆</span> Hidden site found</span>
              <span className="wm-legend__item"><span className="wm-legend__swatch wm-legend__swatch--site">?</span> Site rumor (approximate)</span>
            </div>
          </section>

          <section className="wm-side-panel">
            <button type="button" className="wm-records-toggle" onClick={() => setRecordsOpen((open) => !open)}>
              Atlas Records &amp; Discovery Training
              <span>{recordsOpen ? "−" : "+"}</span>
            </button>
            {recordsOpen ? (
              <div className="wm-records-body">
                <div className="wm-records-block">
                  <div className="wm-records-block__title">Atlas Volumes</div>
                  <div className="wm-volume-list">
                    {mapViews.map((view) => (
                      <Link key={view.id} to={view.id === "world" ? "/world-map" : `/maps/${view.id}`}>{view.label}</Link>
                    ))}
                  </div>
                </div>
                <div className="wm-records-block">
                  <div className="wm-records-block__title">Discovery Training</div>
                  <div className="wm-training-note">{shortLine(atlas?.education?.worldGeographyMessage, "World Geography controls safe travel discovery and atlas clarity.")}</div>
                  <div className="wm-training-note">{shortLine(atlas?.education?.historicalAwarenessMessage, "Historical Awareness controls ruin, relic, and lore interpretation.")}</div>
                  <Link className="inline-route-link" to={getCodexEntryRoute("manual-education")}>Open education manual</Link>
                </div>
                <div className="wm-records-block">
                  <div className="wm-records-block__title">Recent Discoveries</div>
                  {discoveries.length ? (
                    <div className="wm-note-list">
                      {discoveries.slice(0, 6).map((note) => (
                        <div key={note.id} className="wm-note-row"><strong>{note.title}.</strong> {shortLine(note.summary)}</div>
                      ))}
                    </div>
                  ) : (
                    <div>Nothing recorded yet. Discoveries made on the road are archived here and pinned to the map.</div>
                  )}
                </div>
              </div>
            ) : null}
          </section>
        </div>

        <div className="wm-side">
          <section className="wm-side-panel">
            {selectedCity
              ? renderCityPanel(selectedCity)
              : selectedSite
                ? renderSitePanel(selectedSite)
                : selectedRegion
                  ? renderRegionPanel(selectedRegion)
                  : selection?.kind === "frontier"
                    ? renderFrontierPanel(selection.id)
                    : renderDefaultPanel()}
          </section>
        </div>
      </div>
    </AppShell>
  );
}

/* ── City atlas volumes (/maps/:mapId) keep the compact archive layout ──── */

type CompactEntry = {
  id: string;
  title: string;
  type: string;
  status: string;
  tagline: string;
  lockReason?: string | null;
  codexEntryId: string;
};

function statusFromNode(node: MapNode) {
  if (node.visibility === "visible") return "Discovered";
  if (node.visibility === "locked") return "Locked";
  return "Unknown";
}

function codexIdFromNode(node: MapNode) {
  if (node.kind === "city") return getCodexEntryIdForCity(node.id);
  if (node.kind === "strategic_site") return getCodexEntryIdForRegion(node.id);
  return `discovery-site-${node.id.replace(/:/g, "-")}`;
}

function entryFromNode(node: MapNode): CompactEntry {
  return {
    id: node.id,
    title: node.label,
    type: formatAtlasLabel(node.kind),
    status: statusFromNode(node),
    tagline: shortLine(node.summary),
    lockReason: readString(node.metadata?.lockReason, "") || null,
    codexEntryId: codexIdFromNode(node),
  };
}

function CompactAtlasCard({ entry }: { entry: CompactEntry }) {
  const status = entry.status.toLowerCase();
  const statusClass = status.includes("discovered")
    ? "world-atlas-card__status--discovered"
    : status.includes("locked")
      ? "world-atlas-card__status--locked"
      : status.includes("rumor")
        ? "world-atlas-card__status--rumored"
        : "";
  return (
    <article className="world-atlas-card">
      <div className="world-atlas-card__top"><strong>{entry.title}</strong><span className={`world-atlas-card__status ${statusClass}`}>{entry.status}</span></div>
      <div className="world-atlas-card__meta">{entry.type}</div>
      <p>{entry.tagline}</p>
      {entry.lockReason ? <div className="world-atlas-card__lock">{entry.lockReason}</div> : null}
      <Link className="world-atlas-card__link" to={getCodexEntryRoute(entry.codexEntryId)}>Read Entry</Link>
    </article>
  );
}

function CityAtlasVolume({ mapId }: { mapId: string }) {
  const activeMap = getMapView(mapId) ?? mapViews[0];
  const visibleNodes = activeMap.nodes.filter((node) => node.visibility === "visible");
  const lockedNodes = activeMap.nodes.filter((node) => node.visibility === "locked");
  return (
    <AppShell title={activeMap.label} hint="City atlas volume. The interactive world atlas lives on the World Map.">
      <div className="nexis-grid world-atlas-overview">
        <div className="nexis-column">
          <section className="panel">
            <div className="panel__header"><h2>Atlas Volumes</h2></div>
            <div className="panel__body">
              <div className="info-list">
                {mapViews.map((view) => (
                  <div key={view.id} className="info-row">
                    <span className="info-row__label">{view.label}</span>
                    <span className="info-row__value info-row__value--accent">
                      <Link className="inline-route-link" to={view.id === "world" ? "/world-map" : `/maps/${view.id}`}>Open</Link>
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </section>
        </div>
        <div className="nexis-column">
          <section className="panel">
            <div className="panel__header"><h2>Charted</h2></div>
            <div className="panel__body"><div className="world-atlas-card-grid">{visibleNodes.map((node) => <CompactAtlasCard key={node.id} entry={entryFromNode(node)} />)}</div></div>
          </section>
        </div>
        <div className="nexis-column">
          <section className="panel">
            <div className="panel__header"><h2>Locked</h2></div>
            <div className="panel__body">
              <div className="world-atlas-card-grid">
                {lockedNodes.length
                  ? lockedNodes.map((node) => <CompactAtlasCard key={node.id} entry={entryFromNode(node)} />)
                  : <div className="world-atlas-empty">Every charted entry in this volume is open.</div>}
              </div>
            </div>
          </section>
        </div>
      </div>
    </AppShell>
  );
}

export default function WorldMapPage() {
  const params = useParams();
  const mapId = params.mapId ?? "world";
  if (mapId !== "world") return <CityAtlasVolume mapId={mapId} />;
  return <InteractiveWorldAtlas />;
}
