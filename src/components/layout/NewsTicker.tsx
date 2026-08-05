import { newsStories } from "../../data/newsData";

export function NewsTicker() {
  const items = newsStories.map((story) => `${story.title} — ${story.summary}`);
  const trackText = items.join("     •     ");

  return (
    <div className="news-ticker" role="marquee" aria-label="Nexis news ticker">
      <span className="news-ticker__label">News</span>
      <div className="news-ticker__viewport">
        <div className="news-ticker__track">
          <span>{trackText}</span>
          <span aria-hidden="true">{trackText}</span>
        </div>
      </div>
    </div>
  );
}
