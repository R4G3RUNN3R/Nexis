import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { AppShell } from "../components/layout/AppShell";
import { ContentPanel } from "../components/layout/ContentPanel";
import { useAuth } from "../state/AuthContext";
import { getServerRecords, type ServerRecordEntry } from "../lib/authApi";

const CATEGORY_LABELS: Record<string, string> = {
  progression: "Progression",
  education: "Education",
  academy: "Academy",
  skills: "Skills",
  manuals: "Manuals",
  contracts: "Contracts",
  discovery: "Discovery",
  travel: "Travel",
  combat: "Combat",
  crafting: "Crafting",
  marketplace: "Marketplace",
  guild: "Guild",
  consortium: "Consortium",
  admin: "Admin",
  adventure: "Adventure",
  chronicle: "Chronicle",
  prestige: "Prestige",
};

function formatTimestamp(timestamp: number) {
  return new Date(timestamp).toLocaleString("en-GB", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function RecordsPage() {
  const { authSource, serverSessionToken } = useAuth();
  const [category, setCategory] = useState<string | null>(null);
  const [entries, setEntries] = useState<ServerRecordEntry[] | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (authSource !== "server" || !serverSessionToken) return;
    let cancelled = false;
    setLoading(true);
    (async () => {
      const result = await getServerRecords(serverSessionToken, category, 100);
      if (cancelled) return;
      setLoading(false);
      if (result.ok) setEntries(result.records);
    })();
    return () => {
      cancelled = true;
    };
  }, [authSource, serverSessionToken, category]);

  return (
    <AppShell title="Record Log" hint="Every recorded action on your account, newest first.">
      <ContentPanel title="Filter">
        <div className="home-actions-grid">
          <button type="button" className="home-action" style={{ cursor: "pointer" }} onClick={() => setCategory(null)}>
            <div className="home-action__copy"><strong>All</strong></div>
          </button>
          {Object.entries(CATEGORY_LABELS).map(([key, label]) => (
            <button key={key} type="button" className="home-action" style={{ cursor: "pointer" }} onClick={() => setCategory(key)}>
              <div className="home-action__copy"><strong>{label}</strong></div>
            </button>
          ))}
        </div>
      </ContentPanel>

      <ContentPanel title={category ? `${CATEGORY_LABELS[category] ?? category} Log` : "Full Log"}>
        {loading ? (
          <div className="info-row"><span className="info-row__label">Loading</span></div>
        ) : entries && entries.length ? (
          <div className="info-list">
            {entries.map((entry) => (
              <div key={entry.id} className="info-row">
                <span className="info-row__label">{formatTimestamp(entry.timestamp)}</span>
                <span className="info-row__value">
                  {entry.route ? <Link className="inline-route-link" to={entry.route}>{entry.summary}</Link> : entry.summary}
                </span>
              </div>
            ))}
          </div>
        ) : (
          <div className="info-row"><span className="info-row__label">No records in this category yet.</span></div>
        )}
      </ContentPanel>
    </AppShell>
  );
}
