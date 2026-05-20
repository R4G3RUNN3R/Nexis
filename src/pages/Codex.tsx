import { useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { AppShell } from "../components/layout/AppShell";
import { codexEntries, codexSections, getCodexEntry, getCodexEntryRoute, type CodexSectionId } from "../data/codexData";
import "../styles/codex.css";

function statusText(value?: string) {
  return value ? value.replace(/[_-]+/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase()) : "Filed";
}

export default function CodexPage() {
  const [params, setParams] = useSearchParams();
  const selected = getCodexEntry(params.get("entry"));
  const [section, setSection] = useState<CodexSectionId>(selected.section);
  const [query, setQuery] = useState("");
  const filtered = useMemo(() => {
    const text = query.trim().toLowerCase();
    return codexEntries.filter((entry) => entry.section === section && (!text || `${entry.title} ${entry.kicker} ${entry.summary} ${entry.tags.join(" ")}`.toLowerCase().includes(text)));
  }, [query, section]);

  function selectEntry(entryId: string) {
    setParams({ entry: entryId });
  }

  return (
    <AppShell title="Codex" hint="Archive, atlas, records, manuals, discoveries, and reference notes live here. Action pages stay action-first.">
      <div className="codex-shell">
        <aside className="codex-rail">
          <div className="codex-search">
            <label htmlFor="codex-search">Archive Search</label>
            <input id="codex-search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search entries..." />
          </div>
          <div className="codex-section-list">
            {codexSections.map((item) => {
              const active = item.id === section;
              const count = codexEntries.filter((entry) => entry.section === item.id).length;
              return (
                <button key={item.id} type="button" className={`codex-section${active ? " codex-section--active" : ""}`} onClick={() => setSection(item.id)}>
                  <span>{item.label}</span>
                  <strong>{count}</strong>
                  <small>{item.summary}</small>
                </button>
              );
            })}
          </div>
        </aside>

        <section className="codex-list-panel">
          <div className="codex-panel-head">
            <h2>{codexSections.find((item) => item.id === section)?.label}</h2>
            <span>{filtered.length} entries</span>
          </div>
          <div className="codex-entry-list">
            {filtered.map((entry) => (
              <button key={entry.id} type="button" className={`codex-list-entry${entry.id === selected.id ? " codex-list-entry--active" : ""}`} onClick={() => selectEntry(entry.id)}>
                <span className="codex-list-entry__top"><strong>{entry.title}</strong><em>{statusText(entry.status)}</em></span>
                <span>{entry.summary}</span>
              </button>
            ))}
            {!filtered.length ? <div className="codex-empty">No archive entries match that filter.</div> : null}
          </div>
        </section>

        <article className="codex-detail">
          <div className="codex-detail__kicker">{selected.kicker}</div>
          <h1>{selected.title}</h1>
          <div className="codex-detail__summary">{selected.summary}</div>
          <div className="codex-tag-row">
            {selected.tags.map((tag) => <span key={tag}>{tag}</span>)}
          </div>
          <div className="codex-body">
            {selected.body.map((paragraph, index) => <p key={`${selected.id}-${index}`}>{paragraph}</p>)}
          </div>
          {selected.related?.length ? (
            <div className="codex-related">
              <div className="codex-related__label">Related actions</div>
              <div className="codex-related__links">
                {selected.related.map((link) => <Link key={`${selected.id}-${link.to}-${link.label}`} to={link.to}>{link.label}</Link>)}
              </div>
            </div>
          ) : null}
          <Link className="codex-permalink" to={getCodexEntryRoute(selected.id)}>Archive link</Link>
        </article>
      </div>
    </AppShell>
  );
}
