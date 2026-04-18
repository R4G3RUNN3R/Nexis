import { AppShell } from "../components/layout/AppShell";
import { ContentPanel } from "../components/layout/ContentPanel";

export default function SkillsPage() {
  const flavor = "Skill is what remains after repetition strips excuses away. Talent helps. Discipline survives longer.";
  const ciel = "This section will eventually track combat, trade, travel, healing, protection, and profession skill growth. Use, repetition, and long-term specialization belong here once the system stops pretending a placeholder counts as progression.";
  const alt = "Potential is common. Follow-through is where things become rare.";

  return (
    <AppShell title="Skills" hint={flavor}>
      <div className="page-intro-grid">
        <ContentPanel title="Skill Ledger">
          <p className="page-intro__lead">{flavor}</p>
          <p className="page-intro__body">{alt}</p>
        </ContentPanel>
        <ContentPanel title="CIEL">
          <p className="page-intro__body">{ciel}</p>
        </ContentPanel>
      </div>

      <ContentPanel title="Skills">
        <p style={{ padding: "1rem 1rem 0", color: "#e8d7b5", lineHeight: 1.7 }}>
          The full skill system is still under construction, but this page now reflects what it is supposed to become instead of sitting there like abandoned scaffolding.
        </p>
        <p style={{ padding: "0 1rem 1rem", color: "var(--color-text-muted, #aaa)", lineHeight: 1.7 }}>
          Expect active and passive progression across combat, travel, healing, trading, professions, and later deeper specialization tracks.
        </p>
      </ContentPanel>
    </AppShell>
  );
}
