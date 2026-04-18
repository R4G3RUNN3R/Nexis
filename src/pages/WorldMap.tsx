import { AppShell } from "../components/layout/AppShell";

export default function WorldMapPage() {
  return (
    <AppShell title="World Map" hint="General view of the player's location and surrounding regions.">
      <div
        style={{
          minHeight: "420px",
          border: "1px solid #20262a",
          background: "#050607",
          padding: "16px",
          color: "#d5ddd2",
        }}
      >
        This page is a placeholder for now.
      </div>
    </AppShell>
  );
}
