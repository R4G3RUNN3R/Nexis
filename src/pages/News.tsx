import PublicPageShell from "../components/layout/PublicPageShell";

const stories = [
  {
    title: "City board expansion underway",
    date: "Ashfall 18, Year 1",
    summary:
      "Public notices, contracts, properties, and faction bulletins are being consolidated into a single browsable board so the realm feels like a live city instead of a collection of disconnected menus.",
  },
  {
    title: "Education reforms approved",
    date: "Ashfall 14, Year 1",
    summary:
      "General Studies, Street Survival, and specialist branches now present clearer hard-gated progression. Locked systems explain why they are locked and what course unlocks them.",
  },
  {
    title: "Travel discoveries being mapped",
    date: "Ashfall 09, Year 1",
    summary:
      "World Geography is now positioned as the first meaningful travel gate. Future journeys will support passive discoveries, ruin finds, and rare item events after arrival.",
  },
  {
    title: "Consortium charter drafted",
    date: "Ashfall 03, Year 1",
    summary:
      "Civic Fundamentals is planned as the formal requirement for founding a consortium, gaining permits, and taking on city contracts under the Ashen Crown charter.",
  },
];

export default function NewsPage() {
  return (
    <PublicPageShell
      title="Realm News"
      subtitle="Public dispatches, development notices, and city reports available to any visitor before they step through the gate."
    >
      <section className="public-panel">
        <div className="public-panel__header">Front Page</div>
        <div className="public-panel__body">
          <div className="public-news-grid">
            {stories.map((story) => (
              <article key={story.title} className="public-news-card">
                <div className="public-news-card__meta">{story.date}</div>
                <h3>{story.title}</h3>
                <p>{story.summary}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="public-panel">
        <div className="public-panel__header">Editor&apos;s note</div>
        <div className="public-panel__body">
          Visitors can read realm notices while logged out. In-game bulletin systems will later surface richer city reports, guild notices, bounty chatter, and public market disruptions without requiring players to hunt for information blind.
        </div>
      </section>
    </PublicPageShell>
  );
}
