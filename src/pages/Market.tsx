import { AppShell } from "../components/layout/AppShell";
import { ContentPanel } from "../components/layout/ContentPanel";
import { cielEmptyStates, cielPageCopy } from "../data/cielPageCopy";

export default function MarketPage() {
  const pageCopy = cielPageCopy.market;

  return (
    <AppShell title="Market" hint={pageCopy.flavor}>
      <div className="page-intro-grid">
        <ContentPanel title="Market Flavor">
          <p className="page-intro__lead">{pageCopy.flavor}</p>
        </ContentPanel>
        <ContentPanel title="CIEL">
          <p className="page-intro__body">{pageCopy.ciel}</p>
        </ContentPanel>
      </div>

      <ContentPanel title="Market">
        <p style={{ padding: "1rem 1rem 0", color: "#e8d7b5", lineHeight: 1.7 }}>
          The full economy layer is still being wired. Vendor structure, pricing behavior, and broader item circulation will live here once the systems stop pretending they are decorative.
        </p>
        <p style={{ padding: "0 1rem 1rem", color: "var(--color-text-muted, #aaa)", lineHeight: 1.7 }}>
          {cielEmptyStates.marketSoldOut}
        </p>
      </ContentPanel>
    </AppShell>
  );
}
