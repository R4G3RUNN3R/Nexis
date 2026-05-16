import PublicPageShell from "../components/layout/PublicPageShell";

const stories = [
  {
    title: "City board expansion underway",
    date: "16 May 2026",
    summary:
      "Public notices, contracts, properties, and faction bulletins are being consolidated into a single browsable board so Nexis feels like a live city instead of a collection of disconnected menus.",
  },
  {
    title: "Education reforms approved",
    date: "15 May 2026",
    summary:
      "General Studies, Street Survival, Applied Knowledge, and academy specializations now present clearer hard-gated progression. Locked systems explain why they are locked and what path unlocks them.",
  },
  {
    title: "Travel discoveries being mapped",
    date: "14 May 2026",
    summary:
      "World Geography is now positioned as the first meaningful travel gate. Future journeys will support passive discoveries, ruin finds, and rare item events after arrival.",
  },
  {
    title: "Consortium charter drafted",
    date: "13 May 2026",
    summary:
      "Civic Fundamentals is planned as the formal requirement for founding a consortium, gaining permits, and taking on city contracts under the Nexis civic charter.",
  },
];

export default function NewsPage() {
  return (
    <PublicPageShell
      title="Nexis News"
      subtitle="Public dispatches, city reports, and live-shard notices available to visitors before they step through the gate."
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
          Visitors can read Nexis notices while logged out. In-game bulletin boards surface city reports, guild notices, bounty chatter, and market disruptions from the same civic-facing direction.
        </div>
      </section>
    </PublicPageShell>
  );
}
