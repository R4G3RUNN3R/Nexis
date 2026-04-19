import PublicPageShell from "../components/layout/PublicPageShell";

const credits = [
  { role: "Project Direction", people: ["Core project lead"], years: "Founding – Present" },
  { role: "Realm Systems Design", people: ["Progression and economy design"], years: "Founding – Present" },
  { role: "Frontend Development", people: ["Portal, public pages, and in-game shell"], years: "Current phase" },
  { role: "Worldbuilding & Narrative", people: ["Lore, factions, cities, and route planning"], years: "Current phase" },
  { role: "Future Team Slots", people: ["Engineering", "Art", "Writing", "QA"], years: "To be expanded" },
];

export default function CreditsPage() {
  return (
    <PublicPageShell
      title="Credits"
      subtitle="The current credits board is intentionally lean. It gives the project a proper home now and leaves space for the full roster as the realm grows."
    >
      <section className="public-panel">
        <div className="public-panel__header">Current roster</div>
        <div className="public-panel__body">
          <div className="public-credits-grid">
            {credits.map((entry) => (
              <article key={entry.role} className="public-credit-card">
                <div className="public-credit-card__meta">{entry.years}</div>
                <h3>{entry.role}</h3>
                {entry.people.map((person) => (
                  <h4 key={person}>{person}</h4>
                ))}
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="public-panel">
        <div className="public-panel__header">Special thanks</div>
        <div className="public-panel__body">
          To the players, testers, and future contributors who help pressure every system until it either improves or breaks honestly. Browser games survive on people who care enough to notice when something still feels fake.
        </div>
      </section>
    </PublicPageShell>
  );
}
