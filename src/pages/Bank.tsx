import { AppShell } from "../components/layout/AppShell";
import { ContentPanel } from "../components/layout/ContentPanel";

export default function BankPage() {
  const flavor = "Coin stored is not idle. It is future leverage waiting for discipline.";
  const ciel = "The banking hall will eventually handle deposits, reserves, interest tiers, and treasury movement. In simpler terms: controlled money instead of loose pockets and wishful arithmetic.";
  const alt = "Wealth kept well becomes power. Wealth handled badly becomes a lesson.";

  return (
    <AppShell title="Bank" hint={flavor}>
      <div className="page-intro-grid">
        <ContentPanel title="Banking Hall">
          <p className="page-intro__lead">{flavor}</p>
          <p className="page-intro__body">{alt}</p>
        </ContentPanel>
        <ContentPanel title="CIEL">
          <p className="page-intro__body">{ciel}</p>
        </ContentPanel>
      </div>

      <ContentPanel title="Bank">
        <p style={{ padding: "1rem 1rem 0", color: "#e8d7b5", lineHeight: 1.7 }}>
          The Ashen Crown banking hall is reserved in the city structure, but long-term deposits, reserves, and institution upgrades are still being wired.
        </p>
        <ul style={{ padding: "0 2rem 1rem", color: "var(--color-text-muted, #aaa)", lineHeight: 1.8 }}>
          <li>Personal deposits and withdrawals will live here.</li>
          <li>Long-term reserves and interest tiers are planned here.</li>
          <li>Guild and consortium treasury hooks will eventually flow through the same financial layer.</li>
        </ul>
      </ContentPanel>
    </AppShell>
  );
}
