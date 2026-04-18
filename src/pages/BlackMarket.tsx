import { AppShell } from "../components/layout/AppShell";
import { ContentPanel } from "../components/layout/ContentPanel";

export default function BlackMarketPage() {
  return (
    <AppShell title="Black Market">
      <ContentPanel title="Black Market">
        <p style={{ padding: "1rem", color: "var(--color-text-muted, #aaa)" }}>
          This section is under construction.
        </p>
      </ContentPanel>
    </AppShell>
  );
}
