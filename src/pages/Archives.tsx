import { AppShell } from "../components/layout/AppShell";
import { ContentPanel } from "../components/layout/ContentPanel";

const timeline = [
  {
    title: "A Torn-sized ambition",
    body: "Nexis started with a simple, dangerous idea: take the infrastructure rhythm that makes a persistent browser RPG addictive, then rebuild it around an original fantasy world instead of simply worshipping someone else's concrete."
  },
  {
    title: "From prototype to shard",
    body: "The first versions were rough scaffolds: player bars, city routes, education, jobs, travel, and enough broken edges to keep humility employed full-time. The current shard is the result of repeatedly hardening those pieces into actual systems." 
  },
  {
    title: "Why the Archives exist",
    body: "The Archives are where Nexis keeps its own memory: world lore, development milestones, institutional history, and eventually the recovered fragments that explain how the realm was shaped before the player ever arrived." 
  },
];

export default function ArchivesPage() {
  return (
    <AppShell title="Archives" hint="History matters because systems without memory become sludge astonishingly quickly.">
      <div className="page-intro-grid">
        <ContentPanel title="Founding Record">
          <p className="page-intro__lead">Nexis was built to become a long-lived browser RPG with original world logic, layered progression, and enough structure to feel inhabited instead of merely assembled.</p>
          <p className="page-intro__body">This page is the in-world archive for how the shard came to exist and why its institutions, cities, and power structures look the way they do.</p>
        </ContentPanel>
        <ContentPanel title="CIEL">
          <p className="page-intro__body">Most histories begin as ambition and survive as revision. Keeping a cleaner record here would be unusually sensible. Let us enjoy the novelty.</p>
        </ContentPanel>
      </div>

      <div className="nexis-grid">
        <div className="nexis-column nexis-column--wide">
          <ContentPanel title="Creation Chronicle">
            <div style={{ display: "grid", gap: 14 }}>
              {timeline.map((entry) => (
                <section key={entry.title} style={{ border: "1px solid rgba(255,255,255,0.08)", padding: 14, background: "rgba(10,14,19,0.62)", display: "grid", gap: 8 }}>
                  <strong>{entry.title}</strong>
                  <div style={{ color: "#c4c9d0", lineHeight: 1.6 }}>{entry.body}</div>
                </section>
              ))}
            </div>
          </ContentPanel>
        </div>

        <div className="nexis-column">
          <ContentPanel title="Archive Scope">
            <ul style={{ margin: 0, paddingLeft: 18, lineHeight: 1.8, color: "#c4c9d0" }}>
              <li>World history and institutional records</li>
              <li>Recovered lore fragments and regional chronicles</li>
              <li>Development milestones for the shard itself</li>
              <li>Eventually: recovered truths the public record does not love</li>
            </ul>
          </ContentPanel>
        </div>
      </div>
    </AppShell>
  );
}
