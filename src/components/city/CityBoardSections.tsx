import { Link } from "react-router-dom";
import { getCityHubContent } from "../../data/cityHubData";
import { getCityLocalContracts } from "../../data/cityLoopData";
import { readTravelStateFromPlayer } from "../../lib/travelState";
import { usePlayer } from "../../state/PlayerContext";
import { groupCityBoardListings, type CityBoardCategory, type CityBoardListing } from "../../data/cityBoardData";
import "../../styles/city-board.css";

const CATEGORY_TITLES: Record<CityBoardCategory, string> = {
  civic_jobs: "Civic Appointments",
  notices: "Public Notices",
  opportunities: "Opportunities",
  bounties: "Bounties",
  personals: "Personals",
  properties: "Property Leads",
};

const CATEGORY_STRAPS: Record<CityBoardCategory, string> = {
  civic_jobs: "Official work, clerk assignments, and civic service notices.",
  notices: "Rules, advisories, and warnings issued for the current city.",
  opportunities: "Errands, contracts, and paid leads suited to local conditions.",
  bounties: "Sanctioned combat work and dangerous public claims.",
  personals: "Rooms, requests, and small notices from residents.",
  properties: "Leases, rooms, and property openings worth checking before the ink dries.",
};

function ListingAction({ listing }: { listing: CityBoardListing }) {
  if (!listing.route) return <span className="city-paper__mini-link" aria-disabled="true">Notice only</span>;
  return <Link className="city-paper__mini-link" to={listing.route}>Visit desk</Link>;
}

export default function CityBoardSections() {
  const { player } = usePlayer();
  const travelState = readTravelStateFromPlayer(player);
  const hub = getCityHubContent(travelState.currentCityId);
  const localContracts = getCityLocalContracts(travelState.currentCityId);
  const groups = groupCityBoardListings();
  const editorialSections: CityBoardCategory[] = ["civic_jobs", "opportunities", "bounties", "notices"];
  const classifieds: CityBoardListing[] = [...groups.properties, ...groups.personals];
  const frontContract = localContracts[0];

  return (
    <div className="city-paper">
      <header className="city-paper__masthead">
        <div className="city-paper__issue">Vol. 1 | Local Edition | {hub.displayName}</div>
        <div className="city-paper__title">The {hub.displayName} Gazette</div>
        <div className="city-paper__tagline">Public notices, paid work, and civic warnings from the city desk.</div>
      </header>

      <section className="city-paper__front-page">
        <article className="city-paper__lead">
          <div className="city-paper__section-label">Front Page</div>
          <h2>{frontContract?.title ?? `${hub.displayName} Public Desk Opens`}</h2>
          <p>{frontContract?.summary ?? "The local board is accepting civic notices, service leads, and verified opportunities for citizens currently in the city."}</p>
          <div className="city-paper__meta">
            {frontContract?.reward ? <span>Reward: {frontContract.reward}</span> : null}
            {frontContract?.requirement ? <span>Requires: {frontContract.requirement}</span> : null}
            {frontContract?.risk ? <span>Risk: {frontContract.risk}</span> : null}
          </div>
          <Link className="city-paper__action" to="/city#contracts">Read local contracts</Link>
        </article>
        <aside className="city-paper__briefs" aria-label="Edition notes">
          <article className="city-paper__brief">
            <div className="city-paper__section-label">Market Note</div>
            <h3>{hub.market.name}</h3>
            <p>{hub.market.summary}</p>
            <Link className="city-paper__mini-link" to="/market">Visit market</Link>
          </article>
          <article className="city-paper__brief">
            <div className="city-paper__section-label">Service Desk</div>
            <h3>{hub.special.name}</h3>
            <p>{hub.special.summary}</p>
            <Link className="city-paper__mini-link" to="/city#services">View local services</Link>
          </article>
        </aside>
      </section>

      <div className="city-paper__columns">
        {editorialSections.map((category) => (
          <section key={category} className="city-paper__column">
            <div className="city-paper__column-head">
              <h3>{CATEGORY_TITLES[category]}</h3>
              <p>{CATEGORY_STRAPS[category]}</p>
            </div>
            <div className="city-paper__list">
              {groups[category].length ? groups[category].map((listing) => (
                <article key={listing.id} className="city-paper__listing">
                  <h4>{listing.title}</h4>
                  <p>{listing.summary}</p>
                  <div className="city-paper__meta">
                    {listing.rewardLabel ? <span>Reward: {listing.rewardLabel}</span> : null}
                    {listing.requirementLabel ? <span>Requires: {listing.requirementLabel}</span> : null}
                  </div>
                  <ListingAction listing={listing} />
                </article>
              )) : (
                <article className="city-paper__listing">
                  <h4>No filed notice</h4>
                  <p>The desk has no current posting for this column.</p>
                  <span className="city-paper__mini-link" aria-disabled="true">Notice only</span>
                </article>
              )}
            </div>
          </section>
        ))}
      </div>

      <section className="city-paper__classifieds">
        <div className="city-paper__column-head">
          <h3>Classifieds</h3>
          <p>Property leads, room notices, personals, and small city ads.</p>
        </div>
        <div className="city-paper__classified-grid">
          {classifieds.map((listing) => (
            <article key={listing.id} className="city-paper__listing">
              <div className="city-paper__section-label">{CATEGORY_TITLES[listing.category]}</div>
              <h4>{listing.title}</h4>
              <p>{listing.summary}</p>
              <ListingAction listing={listing} />
            </article>
          ))}
        </div>
      </section>
    </div>
  );
}
