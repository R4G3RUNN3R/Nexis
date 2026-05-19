import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { getCityHubContent } from "../../data/cityHubData";
import { getCityLocalContracts } from "../../data/cityLoopData";
import { readTravelStateFromPlayer } from "../../lib/travelState";
import { getServerCityBoard, type ServerCityBoard, type ServerCityBoardEntry } from "../../lib/authApi";
import { useAuth } from "../../state/AuthContext";
import { usePlayer } from "../../state/PlayerContext";
import { groupCityBoardListings, type CityBoardCategory, type CityBoardListing } from "../../data/cityBoardData";
import "../../styles/city-board.css";

const SECTION_TITLES = {
  civicAppointments: "Civic Appointments",
  opportunities: "Opportunities",
  bounties: "Bounties",
  publicNotices: "Public Notices",
  classifieds: "Classifieds",
} as const;
const SECTION_STRAPS = {
  civicAppointments: "Official work, clerk assignments, and civic service notices.",
  opportunities: "Errands, contracts, and paid leads suited to local conditions.",
  bounties: "Sanctioned combat work and dangerous public claims.",
  publicNotices: "Rules, advisories, market notes, academy notices, and travel intelligence.",
  classifieds: "Property leads, room notices, personals, and small city ads.",
} as const;

function ListingAction({ route, actionLabel, locked }: { route: string | null; actionLabel: string; locked?: boolean }) {
  if (locked) return <span className="city-paper__mini-link" aria-disabled="true">Locked</span>;
  if (!route) return <span className="city-paper__mini-link" aria-disabled="true">Notice only</span>;
  return <Link className="city-paper__mini-link" to={route}>{actionLabel || "Visit desk"}</Link>;
}
function BoardEntry({ listing }: { listing: ServerCityBoardEntry }) {
  return <article className="city-paper__listing"><h4>{listing.title}</h4><p>{listing.summary}</p><div className="city-paper__meta">{listing.rewardLabel ? <span>Reward: {listing.rewardLabel}</span> : null}{listing.requirementLabel ? <span>Requires: {listing.requirementLabel}</span> : null}</div>{listing.lockReason ? <div style={{ color: "#d0ad74", fontSize: 12 }}>{listing.lockReason}</div> : null}<ListingAction route={listing.route} actionLabel={listing.actionLabel} locked={listing.locked} /></article>;
}
function FallbackListingAction({ listing }: { listing: CityBoardListing }) { return <ListingAction route={listing.route ?? null} actionLabel={listing.route ? "Visit desk" : "Notice only"} />; }

export default function CityBoardSections() {
  const { player } = usePlayer();
  const { authSource, serverSessionToken } = useAuth();
  const travelState = readTravelStateFromPlayer(player);
  const hub = getCityHubContent(travelState.currentCityId);
  const localContracts = getCityLocalContracts(travelState.currentCityId);
  const [board, setBoard] = useState<ServerCityBoard | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    let cancelled = false;
    async function loadBoard() {
      if (authSource !== "server" || !serverSessionToken) { setBoard(null); return; }
      const result = await getServerCityBoard(serverSessionToken, travelState.currentCityId);
      if (cancelled) return;
      if (result.ok) { setBoard(result.board); setError(null); } else { setBoard(null); setError(result.error); }
    }
    void loadBoard();
    return () => { cancelled = true; };
  }, [authSource, serverSessionToken, travelState.currentCityId]);
  const fallback = useMemo(() => groupCityBoardListings(), []);
  const frontContract = localContracts[0];
  if (!board) {
    const editorialSections: CityBoardCategory[] = ["civic_jobs", "opportunities", "bounties", "notices"];
    const classifieds: CityBoardListing[] = [...fallback.properties, ...fallback.personals];
    return <div className="city-paper"><header className="city-paper__masthead"><div className="city-paper__issue">Vol. 1 | Local Edition | {hub.displayName}</div><div className="city-paper__title">The {hub.displayName} Gazette</div><div className="city-paper__tagline">{error ?? "Public notices, paid work, and civic warnings from the city desk."}</div></header><section className="city-paper__front-page"><article className="city-paper__lead"><div className="city-paper__section-label">Front Page</div><h2>{frontContract?.title ?? `${hub.displayName} Public Desk Opens`}</h2><p>{frontContract?.summary ?? "The local board is waiting for the live city desk."}</p><Link className="city-paper__action" to="/city#contracts">Read local contracts</Link></article></section><div className="city-paper__columns">{editorialSections.map((category) => <section key={category} className="city-paper__column"><div className="city-paper__column-head"><h3>{category.replace(/_/g, " ")}</h3></div><div className="city-paper__list">{fallback[category].map((listing) => <article key={listing.id} className="city-paper__listing"><h4>{listing.title}</h4><p>{listing.summary}</p><FallbackListingAction listing={listing} /></article>)}</div></section>)}</div><section className="city-paper__classifieds"><div className="city-paper__classified-grid">{classifieds.map((listing) => <article key={listing.id} className="city-paper__listing"><h4>{listing.title}</h4><p>{listing.summary}</p><FallbackListingAction listing={listing} /></article>)}</div></section></div>;
  }
  return <div className="city-paper"><header className="city-paper__masthead"><div className="city-paper__issue">{board.masthead.edition}</div><div className="city-paper__title">{board.masthead.title}</div><div className="city-paper__tagline">{board.masthead.editorial}</div></header><section className="city-paper__front-page"><article className="city-paper__lead"><div className="city-paper__section-label">Front Page</div><h2>{board.frontPage.title}</h2><p>{board.frontPage.summary}</p><div className="city-paper__meta">{board.frontPage.rewardLabel ? <span>Reward: {board.frontPage.rewardLabel}</span> : null}{board.frontPage.requirementLabel ? <span>Requires: {board.frontPage.requirementLabel}</span> : null}</div>{board.frontPage.lockReason ? <div style={{ color: "#d0ad74", fontSize: 12 }}>{board.frontPage.lockReason}</div> : null}<ListingAction route={board.frontPage.route} actionLabel={board.frontPage.actionLabel} locked={board.frontPage.locked} /></article></section><div className="city-paper__columns">{(["civicAppointments", "opportunities", "bounties", "publicNotices"] as const).map((section) => <section key={section} className="city-paper__column"><div className="city-paper__column-head"><h3>{SECTION_TITLES[section]}</h3><p>{SECTION_STRAPS[section]}</p></div><div className="city-paper__list">{board.sections[section].length ? board.sections[section].map((listing) => <BoardEntry key={listing.id} listing={listing} />) : <article className="city-paper__listing"><h4>No filed notice</h4><p>The desk has no current posting for this column.</p><ListingAction route={null} actionLabel="Notice only" /></article>}</div></section>)}</div><section className="city-paper__classifieds"><div className="city-paper__column-head"><h3>{SECTION_TITLES.classifieds}</h3><p>{SECTION_STRAPS.classifieds}</p></div><div className="city-paper__classified-grid">{board.sections.classifieds.map((listing) => <BoardEntry key={listing.id} listing={listing} />)}</div></section></div>;
}
