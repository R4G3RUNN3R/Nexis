import { Link } from "react-router-dom";
import PublicPageShell from "../components/layout/PublicPageShell";

const pillars = [
  {
    title: "Education",
    body: "Study branches from General Studies to Arcane Studies and Shadowcraft. What you learn decides what the world lets you do.",
  },
  {
    title: "Travel & Discovery",
    body: "Cross dangerous roads and sea lanes toward cities, ruins, and frontier regions. Risk, cargo, and escorts all matter en route.",
  },
  {
    title: "Guilds & Consortiums",
    body: "Found or join a guild for standing and conflict, or a consortium for trade, contracts, and production under the city charter.",
  },
  {
    title: "Combat & Magic",
    body: "Test your build in the arena against bandits, beasts, and rival adventurers, with battle stats shaped by training and study.",
  },
  {
    title: "Economy",
    body: "Buy low, sell high, and move goods between cities through legal markets or the riskier black market.",
  },
  {
    title: "Academies",
    body: "Earn a place in elite, region-locked training grounds once you've proven yourself through the foundation systems.",
  },
];

export default function LandingPage() {
  return (
    <PublicPageShell
      title="Rise Through Every Layer of Nexis"
      subtitle="A persistent fantasy world of education, travel, trade, guilds, and conflict. Every course you finish and every road you survive shapes what you become."
    >
      <section className="public-panel">
        <div className="public-panel__header">Begin your account</div>
        <div className="public-panel__body">
          <p style={{ margin: "0 0 14px" }}>
            Registration takes a minute. Once inside, your education, travel, and career choices start
            compounding immediately &mdash; there is no wasted early game.
          </p>
          <div style={{ display: "flex", gap: 12 }}>
            <Link to="/register" className="public-topbar__button public-topbar__button--accent">
              Register
            </Link>
            <Link to="/login" className="public-topbar__button">
              Login
            </Link>
          </div>
        </div>
      </section>

      <section className="public-panel">
        <div className="public-panel__header">World pillars</div>
        <div className="public-panel__body">
          <div className="public-card-grid">
            {pillars.map((pillar) => (
              <article key={pillar.title} className="public-card">
                <h3>{pillar.title}</h3>
                <p>{pillar.body}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="public-panel">
        <div className="public-panel__header">Stay informed</div>
        <div className="public-panel__body">
          Read the latest city reports and civic notices on the{" "}
          <Link to="/news">Nexis News</Link> page &mdash; no account required.
        </div>
      </section>
    </PublicPageShell>
  );
}
