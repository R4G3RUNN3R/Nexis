import { Link } from "react-router-dom";
import { groupCityBoardListings, type CityBoardCategory } from "../../data/cityBoardData";
import "../../styles/city-board.css";

const CATEGORY_TITLES: Record<CityBoardCategory, string> = {
  civic_jobs: "Civic Appointments",
  notices: "Public Notices",
  opportunities: "Opportunities",
  bounties: "Bounties",
  personals: "Personals",
  properties: "Property Watch",
};

const CATEGORY_STRAPS: Record<CityBoardCategory, string> = {
  civic_jobs: "Structured work for citizens who prefer wages over improvising disaster.",
  notices: "Regulations, advisories, and the city politely threatening everyone again.",
  opportunities: "Contracts, errands, and respectable schemes with cleaner paperwork.",
  bounties: "Violence with public blessing and slightly better record-keeping.",
  personals: "Rooms, requests, and the softer side of urban desperation.",
  properties: "Leases, openings, and places to sleep that are not technically a wall.",
};

export default function CityBoardSections() {
  const groups = groupCityBoardListings();
  const ordered: CityBoardCategory[] = ["civic_jobs", "opportunities", "bounties", "notices", "properties", "personals"];
  const leadListing = groups.civic_jobs[0] ?? groups.opportunities[0];
  const sideHighlights = [groups.opportunities[0], groups.bounties[0], groups.notices[0]].filter(Boolean);

  return (
    <div className="city-paper">
      <header className="city-paper__masthead">
        <div className="city-paper__issue">Vol. 1 | Morning Edition</div>
        <div className="city-paper__title">The Nexis Daily Board</div>
        <div className="city-paper__tagline">Public postings, civic work, and trouble arranged into columns so people can find things like adults.</div>
      </header>

      {leadListing ? (
        <section className="city-paper__front-page">
          <article className="city-paper__lead">
            <div className="city-paper__section-label">Front Page</div>
            <h2>{leadListing.title}</h2>
            <p>{leadListing.summary}</p>
            <div className="city-paper__meta">
              {leadListing.rewardLabel ? <span>Reward: {leadListing.rewardLabel}</span> : null}
              {leadListing.requirementLabel ? <span>Requires: {leadListing.requirementLabel}</span> : null}
            </div>
            {leadListing.route ? (
              <Link className="city-paper__action" to={leadListing.route}>
                Read posting
              </Link>
            ) : null}
          </article>

          <div className="city-paper__briefs">
            {sideHighlights.map((listing) => (
              <article key={listing.id} className="city-paper__brief">
                <div className="city-paper__section-label">{CATEGORY_TITLES[listing.category]}</div>
                <h3>{listing.title}</h3>
                <p>{listing.summary}</p>
                {listing.route ? (
                  <Link className="city-paper__mini-link" to={listing.route}>
                    Open
                  </Link>
                ) : null}
              </article>
            ))}
          </div>
        </section>
      ) : null}

      <div className="city-paper__columns">
        {ordered.map((category) => (
          <section key={category} className="city-paper__column">
            <div className="city-paper__column-head">
              <h3>{CATEGORY_TITLES[category]}</h3>
              <p>{CATEGORY_STRAPS[category]}</p>
            </div>

            <div className="city-paper__list">
              {groups[category].map((listing) => (
                <article key={listing.id} className="city-paper__listing">
                  <h4>{listing.title}</h4>
                  <p>{listing.summary}</p>
                  <div className="city-paper__meta">
                    {listing.rewardLabel ? <span>Reward: {listing.rewardLabel}</span> : null}
                    {listing.requirementLabel ? <span>Requires: {listing.requirementLabel}</span> : null}
                  </div>
                  {listing.route ? (
                    <Link className="city-paper__mini-link" to={listing.route}>
                      Open section
                    </Link>
                  ) : null}
                </article>
              ))}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}
