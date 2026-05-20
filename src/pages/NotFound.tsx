import { Link, useLocation } from "react-router-dom";
import { AppShell } from "../components/layout/AppShell";
import { ContentPanel } from "../components/layout/ContentPanel";

export default function NotFoundPage() {
  const location = useLocation();

  return (
    <AppShell title="Page Not Found" hint="The requested city desk, archive, or route does not exist.">
      <div style={{ display: "grid", gap: 12 }}>
        <ContentPanel title="Unknown Route">
          <div style={{ display: "grid", gap: 10, color: "#b7c3cf", fontSize: 13 }}>
            <strong style={{ color: "#f2f2f2", fontSize: 18 }}>Page not found</strong>
            <span>Nothing is registered at <code>{location.pathname}</code>. Admirably mysterious, but not useful.</span>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <Link className="inline-route-link" to="/home">Return Home</Link>
              <Link className="inline-route-link" to="/city">Open City</Link>
              <Link className="inline-route-link" to="/travel">Open Travel</Link>
              <Link className="inline-route-link" to="/codex">Open Codex</Link>
            </div>
          </div>
        </ContentPanel>
      </div>
    </AppShell>
  );
}
