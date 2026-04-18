import { AppShell } from "../components/layout/AppShell";
import { ContentPanel } from "../components/layout/ContentPanel";

export default function ContactsPage() {
  const flavor = "No one rises without witnesses, rivals, helpers, debtors, and the occasional person who should never have been trusted twice.";
  const ciel = "Contacts are where memory becomes utility. Friends, enemies, useful names, and social gravity all deserve structure before they become chaos.";
  const alt = "Networks are simply ambition arranged into people.";

  return (
    <AppShell title="Contacts" hint={flavor}>
      <div className="page-intro-grid">
        <ContentPanel title="Social Ledger">
          <p className="page-intro__lead">{flavor}</p>
          <p className="page-intro__body">{alt}</p>
        </ContentPanel>
        <ContentPanel title="CIEL">
          <p className="page-intro__body">{ciel}</p>
        </ContentPanel>
      </div>

      <ContentPanel title="Contacts">
        <div
          style={{
            minHeight: "320px",
            border: "1px solid #20262a",
            background: "#050607",
            padding: "16px",
            color: "#d5ddd2",
            display: "grid",
            gap: "12px",
          }}
        >
          <div>This page is still a structural shell, but it no longer has to look like one.</div>
          <div style={{ color: "#b7c3cf" }}>
            Friend lists, notable rivals, social bookmarks, and future direct-contact tools will live here once those systems stop pretending a blank rectangle counts as design.
          </div>
        </div>
      </ContentPanel>
    </AppShell>
  );
}
