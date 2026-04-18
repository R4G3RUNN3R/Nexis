import { AppShell } from "../components/layout/AppShell";
import { ContentPanel } from "../components/layout/ContentPanel";

export default function SkillsPage() {
  return (
    <AppShell title="Skills">
      <ContentPanel title="Skills">
        <p style={{ padding: "1rem", color: "var(--color-text-muted, #aaa)" }}>
          This section is under construction.
        </p>
      </ContentPanel>
    </AppShell>
  );
}
