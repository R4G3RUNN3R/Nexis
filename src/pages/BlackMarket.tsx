import { AppShell } from "../components/layout/AppShell";
import { ContentPanel } from "../components/layout/ContentPanel";
import { cielPageCopy } from "../data/cielPageCopy";

export default function BlackMarketPage() {
  const pageCopy = cielPageCopy.blackMarket;

  return (
    <AppShell title="Black Market" hint={pageCopy.flavor}>
      <div className="page-intro-grid">
        <ContentPanel title="Black Market Flavor">
          <p className="page-intro__lead">{pageCopy.flavor}</p>
          <p className="page-intro__body">{pageCopy.alt}</p>
        </ContentPanel>
        <ContentPanel title="CIEL">
          <p className="page-intro__body">{pageCopy.ciel}</p>
        </ContentPanel>
      </div>

      <ContentPanel title="Black Market">
        <p style={{ padding: "1rem 1rem 0", color: "#e8d7b5", lineHeight: 1.7 }}>
          Access to Nexis's quieter economy remains gated until the shadow systems are properly wired. That is less theatrical than a hidden door, but considerably more honest.
        </p>
        <p style={{ padding: "0 1rem 1rem", color: "var(--color-text-muted, #aaa)", lineHeight: 1.7 }}>
          Restricted for now. Not because secrecy failed, but because the mechanics have not yet earned the right to pretend they exist.
        </p>
      </ContentPanel>
    </AppShell>
  );
}
