import PublicPageShell from "../components/layout/PublicPageShell";
import { newsStories as stories } from "../data/newsData";

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
