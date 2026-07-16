import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { AppShell } from "../components/layout/AppShell";
import { allWikiEntries, wikiSections, type WikiEntry } from "../data/wikiData";

function WikiEntryCard({ entry }: { entry: WikiEntry }) {
  return (
    <article className="wiki-entry" id={entry.id}>
      <div className="wiki-entry__head">
        <span className="wiki-entry__category">{entry.category}</span>
        <h2>{entry.title}</h2>
      </div>
      <p>{entry.summary}</p>
      {entry.rules?.length ? (
        <ul className="wiki-entry__rules">
          {entry.rules.map((rule) => <li key={rule}>{rule}</li>)}
        </ul>
      ) : null}
      {entry.routes?.length ? (
        <div className="wiki-entry__routes" aria-label={`${entry.title} routes`}>
          {entry.routes.map((route) => <Link key={`${entry.id}-${route.to}-${route.label}`} to={route.to}>{route.label}</Link>)}
        </div>
      ) : null}
      {entry.related?.length ? <div className="wiki-entry__related">Related: {entry.related.join(", ")}</div> : null}
    </article>
  );
}

export default function WikiPage() {
  const [activeSection, setActiveSection] = useState(wikiSections[0]?.id ?? "start");
  const [query, setQuery] = useState("");
  const normalizedQuery = query.trim().toLowerCase();
  const selectedSection = wikiSections.find((section) => section.id === activeSection) ?? wikiSections[0];
  const entries = useMemo(() => {
    if (normalizedQuery) {
      return allWikiEntries.filter((entry) => `${entry.title} ${entry.category} ${entry.summary} ${(entry.rules ?? []).join(" ")}`.toLowerCase().includes(normalizedQuery));
    }
    return selectedSection?.entries ?? [];
  }, [normalizedQuery, selectedSection]);

  return (
    <AppShell title="Wiki" hint="Compact game manual for Nexis systems, rules, locks, loops, and records.">
      <section className="wiki-page">
        <aside className="wiki-index" aria-label="Wiki sections">
          <div className="wiki-index__title">Nexis Wiki</div>
          <input
            className="wiki-search"
            type="search"
            placeholder="Search systems, rules, locks..."
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
          <div className="wiki-section-list">
            {wikiSections.map((section) => (
              <button
                key={section.id}
                type="button"
                className={`wiki-section-button${section.id === activeSection && !normalizedQuery ? " wiki-section-button--active" : ""}`}
                onClick={() => {
                  setActiveSection(section.id);
                  setQuery("");
                }}
              >
                <span>{section.label}</span>
                <small>{section.entries.length} entries</small>
              </button>
            ))}
          </div>
        </aside>

        <main className="wiki-content">
          <div className="wiki-content__masthead">
            <div>
              <span className="wiki-content__eyebrow">Player Manual</span>
              <h1>{normalizedQuery ? "Search Results" : selectedSection?.label}</h1>
              <p>{normalizedQuery ? `${entries.length} matching entr${entries.length === 1 ? "y" : "ies"} for "${query.trim()}".` : selectedSection?.summary}</p>
            </div>
            <div className="wiki-content__stats">
              <strong>{allWikiEntries.length}</strong>
              <span>rules entries</span>
            </div>
          </div>

          <div className="wiki-entry-list">
            {entries.length ? entries.map((entry) => <WikiEntryCard key={entry.id} entry={entry} />) : (
              <div className="wiki-empty">No matching entry. Try a system name like Travel, Shadow, Guilds, Legacy, PvP, or One-Shots.</div>
            )}
          </div>
        </main>
      </section>
    </AppShell>
  );
}
