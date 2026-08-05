import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { AppShell } from "../components/layout/AppShell";
import { ContentPanel } from "../components/layout/ContentPanel";
import { useAuth } from "../state/AuthContext";
import { getAdvancedSearchAccess, runAdvancedSearch, type AdvancedSearchFilters, type AdvancedSearchResult } from "../lib/authApi";
import { propertyTiers, getPropertyById } from "../data/propertyData";

const CONDITION_OPTIONS = [
  { value: "", label: "Any" },
  { value: "normal", label: "Okay" },
  { value: "hospitalized", label: "Hospital" },
  { value: "jailed", label: "Jail" },
];

const LAST_ACTION_OPTIONS = [
  { value: "", label: "Any" },
  { value: "day", label: "Last day" },
  { value: "week", label: "Last 7 days" },
  { value: "month", label: "Last 30 days" },
];

const SORT_OPTIONS = [
  { value: "level", label: "Level" },
  { value: "days", label: "Days old" },
  { value: "lastAction", label: "Last action" },
];

function formatLastAction(lastSeenAt: number | null): string {
  if (!lastSeenAt) return "No sessions on record";
  const diffMs = Math.max(0, Date.now() - lastSeenAt);
  const minutes = Math.floor(diffMs / 60000);
  if (minutes < 1) return "Just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

export default function AdvancedSearchPage() {
  const { authSource, serverSessionToken } = useAuth();
  const [access, setAccess] = useState<{ allowed: boolean; donorTier: string } | null>(null);

  const [name, setName] = useState("");
  const [faction, setFaction] = useState("");
  const [property, setProperty] = useState("");
  const [condition, setCondition] = useState("");
  const [levelMin, setLevelMin] = useState("");
  const [levelMax, setLevelMax] = useState("");
  const [daysMin, setDaysMin] = useState("");
  const [daysMax, setDaysMax] = useState("");
  const [lastAction, setLastAction] = useState("");
  const [sortBy, setSortBy] = useState("level");
  const [sortDir, setSortDir] = useState("desc");

  const [results, setResults] = useState<AdvancedSearchResult[] | null>(null);
  const [searching, setSearching] = useState(false);
  const [searchFailed, setSearchFailed] = useState(false);

  useEffect(() => {
    if (authSource !== "server" || !serverSessionToken) return;
    let cancelled = false;
    (async () => {
      const result = await getAdvancedSearchAccess(serverSessionToken);
      if (cancelled) return;
      if (result.ok) setAccess({ allowed: result.allowed, donorTier: result.donorTier });
    })();
    return () => {
      cancelled = true;
    };
  }, [authSource, serverSessionToken]);

  async function handleSearch(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (authSource !== "server" || !serverSessionToken) return;
    setSearching(true);
    setSearchFailed(false);
    const filters: AdvancedSearchFilters = {
      name,
      faction,
      property,
      condition,
      levelMin,
      levelMax,
      daysMin,
      daysMax,
      lastAction,
      sortBy,
      sortDir,
    };
    const result = await runAdvancedSearch(serverSessionToken, filters);
    setSearching(false);
    if (!result.ok) {
      setSearchFailed(true);
      setResults(null);
      return;
    }
    setResults(result.results);
  }

  if (access && !access.allowed) {
    return (
      <AppShell title="Advanced Search" hint="A donator perk for filtering the full citizen directory.">
        <ContentPanel title="Donator perk">
          <div className="info-row">
            <span className="info-row__value">
              Advanced Search is unlocked at Donor Tier I and above. Support Nexis via the Legacy Chronicle system to unlock it.
            </span>
          </div>
        </ContentPanel>
      </AppShell>
    );
  }

  return (
    <AppShell title="Advanced Search" hint="Filter the full citizen directory by level, condition, property, faction, and activity.">
      <ContentPanel title="Filters">
        <form onSubmit={handleSearch} style={{ display: "grid", gap: 10 }}>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 10 }}>
            <label style={{ display: "grid", gap: 4, fontSize: 12, color: "#b7c3cf" }}>
              Name
              <input className="org-input" value={name} onChange={(event) => setName(event.target.value)} placeholder="Citizen name" />
            </label>
            <label style={{ display: "grid", gap: 4, fontSize: 12, color: "#b7c3cf" }}>
              Faction
              <input className="org-input" value={faction} onChange={(event) => setFaction(event.target.value)} placeholder="Guild name or tag" />
            </label>
            <label style={{ display: "grid", gap: 4, fontSize: 12, color: "#b7c3cf" }}>
              Property
              <select className="org-input" value={property} onChange={(event) => setProperty(event.target.value)}>
                <option value="">Any</option>
                {propertyTiers.map((tier) => (
                  <option key={tier.id} value={tier.id}>{tier.name}</option>
                ))}
              </select>
            </label>
            <label style={{ display: "grid", gap: 4, fontSize: 12, color: "#b7c3cf" }}>
              Condition
              <select className="org-input" value={condition} onChange={(event) => setCondition(event.target.value)}>
                {CONDITION_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>{option.label}</option>
                ))}
              </select>
            </label>
            <label style={{ display: "grid", gap: 4, fontSize: 12, color: "#b7c3cf" }}>
              Level min
              <input className="org-input" inputMode="numeric" value={levelMin} onChange={(event) => setLevelMin(event.target.value.replace(/[^0-9]/g, ""))} placeholder="1" />
            </label>
            <label style={{ display: "grid", gap: 4, fontSize: 12, color: "#b7c3cf" }}>
              Level max
              <input className="org-input" inputMode="numeric" value={levelMax} onChange={(event) => setLevelMax(event.target.value.replace(/[^0-9]/g, ""))} placeholder="100" />
            </label>
            <label style={{ display: "grid", gap: 4, fontSize: 12, color: "#b7c3cf" }}>
              Days old min
              <input className="org-input" inputMode="numeric" value={daysMin} onChange={(event) => setDaysMin(event.target.value.replace(/[^0-9]/g, ""))} placeholder="0" />
            </label>
            <label style={{ display: "grid", gap: 4, fontSize: 12, color: "#b7c3cf" }}>
              Days old max
              <input className="org-input" inputMode="numeric" value={daysMax} onChange={(event) => setDaysMax(event.target.value.replace(/[^0-9]/g, ""))} placeholder="365" />
            </label>
            <label style={{ display: "grid", gap: 4, fontSize: 12, color: "#b7c3cf" }}>
              Last action
              <select className="org-input" value={lastAction} onChange={(event) => setLastAction(event.target.value)}>
                {LAST_ACTION_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>{option.label}</option>
                ))}
              </select>
            </label>
            <label style={{ display: "grid", gap: 4, fontSize: 12, color: "#b7c3cf" }}>
              Sort by
              <select className="org-input" value={sortBy} onChange={(event) => setSortBy(event.target.value)}>
                {SORT_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>{option.label}</option>
                ))}
              </select>
            </label>
            <label style={{ display: "grid", gap: 4, fontSize: 12, color: "#b7c3cf" }}>
              Sort direction
              <select className="org-input" value={sortDir} onChange={(event) => setSortDir(event.target.value)}>
                <option value="desc">Descending</option>
                <option value="asc">Ascending</option>
              </select>
            </label>
          </div>
          <div>
            <button type="submit" className="org-button" disabled={searching}>
              {searching ? "Searching." : "Search"}
            </button>
          </div>
        </form>
      </ContentPanel>

      <ContentPanel title="Results">
        {searchFailed ? (
          <div className="info-row"><span className="info-row__value">Search failed. Try again shortly.</span></div>
        ) : results === null ? (
          <div className="info-row"><span className="info-row__value">Set filters above and run a search.</span></div>
        ) : results.length ? (
          <div className="info-list">
            {results.map((result) => (
              <div key={result.publicId} className="info-row">
                <span className="info-row__label">
                  <Link className="inline-route-link" to={result.to}>{result.name}</Link> P{result.publicId}
                </span>
                <span className="info-row__value">
                  Lv {result.level} | {getPropertyById(result.propertyId)?.name ?? "Shack"} | {result.conditionLabel} | {result.daysOld}d old | {formatLastAction(result.lastSeenAt)}
                  {result.factionName ? (
                    <>
                      {" | "}
                      {result.factionRoute ? <Link className="inline-route-link" to={result.factionRoute}>{result.factionName}</Link> : result.factionName}
                    </>
                  ) : null}
                </span>
              </div>
            ))}
          </div>
        ) : (
          <div className="info-row"><span className="info-row__value">No citizens matched those filters.</span></div>
        )}
      </ContentPanel>
    </AppShell>
  );
}
