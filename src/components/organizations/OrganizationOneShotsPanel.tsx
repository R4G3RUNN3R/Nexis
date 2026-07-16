import { useEffect, useMemo, useState } from "react";
import {
  getOrganizationOneShotBoard,
  resolveOrganizationOneShot,
  signUpOrganizationOneShot,
  type OrganizationOneShotCampaign,
  type OrganizationOneShotLegacyRecord,
} from "../../lib/organizationOneShotApi";
import { useAuth } from "../../state/AuthContext";

type OrganizationOneShotsPanelProps = {
  organizationId: string | number | null | undefined;
  organizationName?: string | null;
  organizationType: "guild" | "consortium";
};

type StatusFilter = "all" | "open" | "signed" | "ready" | "completed";
type SortMode = "recommended" | "signups" | "reward" | "category" | "title";

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}

function formatDate(value: unknown) {
  const timestamp = typeof value === "number" ? value : Number(value ?? 0);
  if (!Number.isFinite(timestamp) || timestamp <= 0) return "Unrecorded";
  return new Intl.DateTimeFormat("en-GB", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }).format(new Date(timestamp));
}

function formatPercent(value: unknown) {
  const numeric = Number(value ?? 0);
  if (!Number.isFinite(numeric)) return "0%";
  return `${(numeric * 100).toFixed(2)}%`;
}

function titleCase(value: string) {
  return value.replace(/[_-]+/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function themeLabel(campaign: OrganizationOneShotCampaign) {
  if (campaign.organizationType === "guild") return "Dungeon / monster";
  if (campaign.theme === "espionage") return "Espionage";
  if (campaign.theme === "sabotage") return "Rival sabotage";
  return "Trade operation";
}

function rewardScore(campaign: OrganizationOneShotCampaign) {
  const reward = asRecord(campaign.reward);
  return Number(reward.treasuryGold ?? 0) + Number(reward.progressionPoints ?? 0) * 80 + Number(reward.reputation ?? 0) * 60 + Number(reward.renown ?? 0) * 40;
}

function campaignStatus(campaign: OrganizationOneShotCampaign) {
  if (campaign.status === "completed") return "Completed";
  if (campaign.canResolve) return "Ready to resolve";
  if (campaign.viewerSignedUp) return "Token committed";
  return "Recruiting";
}

export function OrganizationOneShotsPanel({ organizationId, organizationName, organizationType }: OrganizationOneShotsPanelProps) {
  const { authSource, serverSessionToken, serverHydrationVersion, refreshServerState } = useAuth();
  const [campaigns, setCampaigns] = useState<OrganizationOneShotCampaign[]>([]);
  const [legacyRecords, setLegacyRecords] = useState<OrganizationOneShotLegacyRecord[]>([]);
  const [minimumSignups, setMinimumSignups] = useState(5);
  const [tokenCost, setTokenCost] = useState(1);
  const [refundChance, setRefundChance] = useState(0.0001);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("open");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [sortMode, setSortMode] = useState<SortMode>("recommended");
  const [searchTerm, setSearchTerm] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busyCampaignId, setBusyCampaignId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const boardTitle = organizationType === "guild" ? "Guild One-Shots" : "Consortium One-Shots";
  const boardRole = organizationType === "guild"
    ? "Dungeon and monster-fighting operations paid to guild legacy and treasury."
    : "Trade, espionage, and rival-sabotage operations paid to company legacy and treasury.";

  useEffect(() => {
    let cancelled = false;
    async function loadBoard() {
      if (authSource !== "server" || !serverSessionToken || !organizationId) {
        setCampaigns([]);
        setLegacyRecords([]);
        return;
      }
      setLoading(true);
      setError(null);
      const result = await getOrganizationOneShotBoard(serverSessionToken, organizationId);
      if (cancelled) return;
      setLoading(false);
      if (!result.ok) {
        setCampaigns([]);
        setLegacyRecords([]);
        setError(result.error);
        return;
      }
      setCampaigns(result.campaigns.filter((campaign) => campaign.organizationType === organizationType));
      setLegacyRecords(result.legacyRecords);
      setMinimumSignups(result.minimumSignups);
      setTokenCost(result.tokenCost ?? 1);
      setRefundChance(result.tokenRefundChance ?? 0.0001);
      if (result.message) setMessage(result.message);
    }
    void loadBoard();
    return () => { cancelled = true; };
  }, [authSource, organizationId, organizationType, serverHydrationVersion, serverSessionToken]);

  const categories = useMemo(() => Array.from(new Set(campaigns.map((campaign) => campaign.category).filter(Boolean))).sort(), [campaigns]);

  const filteredCampaigns = useMemo(() => {
    const normalizedSearch = searchTerm.trim().toLowerCase();
    const filtered = campaigns.filter((campaign) => {
      const statusMatches = statusFilter === "all"
        || (statusFilter === "open" && campaign.status !== "completed")
        || (statusFilter === "signed" && campaign.viewerSignedUp && campaign.status !== "completed")
        || (statusFilter === "ready" && campaign.canResolve)
        || (statusFilter === "completed" && campaign.status === "completed");
      const categoryMatches = categoryFilter === "all" || campaign.category === categoryFilter;
      const searchMatches = !normalizedSearch
        || `${campaign.title} ${campaign.category} ${campaign.theme} ${campaign.summary} ${campaign.rewardPreview}`.toLowerCase().includes(normalizedSearch);
      return statusMatches && categoryMatches && searchMatches;
    });
    return filtered.sort((a, b) => {
      if (sortMode === "signups") return (b.tokenCommittedCount - a.tokenCommittedCount) || a.title.localeCompare(b.title);
      if (sortMode === "reward") return rewardScore(b) - rewardScore(a) || a.title.localeCompare(b.title);
      if (sortMode === "category") return a.category.localeCompare(b.category) || a.title.localeCompare(b.title);
      if (sortMode === "title") return a.title.localeCompare(b.title);
      const aPriority = (a.status === "completed" ? 0 : 4) + (a.canResolve ? 3 : 0) + (a.viewerSignedUp ? 1 : 0);
      const bPriority = (b.status === "completed" ? 0 : 4) + (b.canResolve ? 3 : 0) + (b.viewerSignedUp ? 1 : 0);
      return bPriority - aPriority || (b.tokenCommittedCount - a.tokenCommittedCount) || a.title.localeCompare(b.title);
    });
  }, [campaigns, categoryFilter, searchTerm, sortMode, statusFilter]);

  async function reloadFrom(result: Awaited<ReturnType<typeof signUpOrganizationOneShot>>) {
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setCampaigns(result.campaigns.filter((campaign) => campaign.organizationType === organizationType));
    setLegacyRecords(result.legacyRecords);
    setMinimumSignups(result.minimumSignups);
    setTokenCost(result.tokenCost ?? tokenCost);
    setRefundChance(result.tokenRefundChance ?? refundChance);
    setMessage(result.message ?? "One-shot board updated.");
    setError(null);
    await refreshServerState();
  }

  async function handleSignup(campaignId: string) {
    if (!serverSessionToken || !organizationId) return;
    setBusyCampaignId(campaignId);
    const result = await signUpOrganizationOneShot(serverSessionToken, organizationId, campaignId);
    setBusyCampaignId(null);
    await reloadFrom(result);
  }

  async function handleResolve(campaignId: string) {
    if (!serverSessionToken || !organizationId) return;
    setBusyCampaignId(campaignId);
    const result = await resolveOrganizationOneShot(serverSessionToken, organizationId, campaignId);
    setBusyCampaignId(null);
    await reloadFrom(result);
  }

  if (!organizationId) return null;

  return (
    <section className="panel org-panel organization-one-shots" id={`${organizationType}-one-shots`}>
      <div className="org-panel__head organization-one-shots__head">
        <div>
          <p className="org-eyebrow">DMOS group channel</p>
          <h3>{boardTitle}</h3>
        </div>
        <span className="org-chip">{organizationName ?? "Organization"}</span>
      </div>
      <div className="organization-one-shots__rules">
        <strong>{boardRole}</strong>
        <span>{minimumSignups} members required | {tokenCost} token each | {formatPercent(refundChance)} token refund chance on completion.</span>
      </div>
      {message ? <div className="organization-one-shots__notice">{message}</div> : null}
      {error ? <div className="organization-one-shots__notice organization-one-shots__notice--error">{error}</div> : null}
      <div className="organization-one-shots__toolbar">
        <label>
          <span>Status</span>
          <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value as StatusFilter)}>
            <option value="open">Open</option>
            <option value="signed">My token committed</option>
            <option value="ready">Ready to resolve</option>
            <option value="completed">Completed</option>
            <option value="all">All</option>
          </select>
        </label>
        <label>
          <span>Category</span>
          <select value={categoryFilter} onChange={(event) => setCategoryFilter(event.target.value)}>
            <option value="all">All categories</option>
            {categories.map((category) => <option key={category} value={category}>{category}</option>)}
          </select>
        </label>
        <label>
          <span>Sort</span>
          <select value={sortMode} onChange={(event) => setSortMode(event.target.value as SortMode)}>
            <option value="recommended">Recommended</option>
            <option value="signups">Most signups</option>
            <option value="reward">Highest reward</option>
            <option value="category">Category</option>
            <option value="title">Title</option>
          </select>
        </label>
        <label className="organization-one-shots__search">
          <span>Search</span>
          <input value={searchTerm} onChange={(event) => setSearchTerm(event.target.value)} placeholder="Find run, reward, or theme" />
        </label>
      </div>
      {loading ? <div className="guild-inline-note">Loading group one-shot board.</div> : null}
      {!loading && !filteredCampaigns.length ? <div className="guild-inline-note">No group one-shots match these filters.</div> : null}
      <div className="organization-one-shots__grid">
        {filteredCampaigns.map((campaign) => {
          const complete = campaign.status === "completed";
          const busy = busyCampaignId === campaign.id;
          const signed = campaign.viewerSignedUp;
          const progressLabel = `${campaign.tokenCommittedCount}/${campaign.minimumSignups} tokens committed`;
          return (
            <article key={campaign.id} className={`organization-one-shot-card${complete ? " organization-one-shot-card--complete" : ""}${campaign.canResolve ? " organization-one-shot-card--ready" : ""}`}>
              <div className="organization-one-shot-card__top">
                <span>{campaign.category}</span>
                <strong>{campaignStatus(campaign)}</strong>
              </div>
              <h4>{campaign.title}</h4>
              <p>{campaign.summary}</p>
              <div className="organization-one-shot-card__meta">
                <span>{themeLabel(campaign)}</span>
                <span>{progressLabel}</span>
                <span>{campaign.rewardPreview}</span>
              </div>
              {campaign.signups.length ? (
                <div className="organization-one-shot-card__signups">
                  {campaign.signups.slice(0, 5).map((signup) => <i key={`${campaign.id}-${signup.publicId}`}>{signup.displayName} [P{signup.publicId}]</i>)}
                  {campaign.signups.length > 5 ? <i>+{campaign.signups.length - 5} more</i> : null}
                </div>
              ) : null}
              {complete ? <div className="organization-one-shot-card__lock">Completed {formatDate(campaign.completedAt)}. This run cannot be completed again.</div> : null}
              <div className="organization-one-shot-card__actions">
                <button type="button" className="org-button" disabled={complete || signed || busy} onClick={() => void handleSignup(campaign.id)}>
                  {signed ? "Token committed" : busy ? "Working..." : "Commit token"}
                </button>
                <button type="button" className="org-button org-button--ghost" disabled={complete || !campaign.canResolve || busy} onClick={() => void handleResolve(campaign.id)} title={campaign.canResolve ? "Resolve this organization one-shot." : `${minimumSignups} token-backed signups required.`}>
                  Resolve run
                </button>
              </div>
            </article>
          );
        })}
      </div>
      <details className="organization-one-shots__legacy">
        <summary>Organization legacy records ({legacyRecords.length})</summary>
        {legacyRecords.length ? legacyRecords.slice(0, 5).map((record) => (
          <article key={record.id ?? `${record.title}-${record.timestamp}`}>
            <strong>{record.title ?? "Group one-shot record"}</strong>
            <span>{formatDate(record.timestamp)}</span>
            <p>{record.summary ?? "Recorded to organization legacy."}</p>
          </article>
        )) : <div className="guild-inline-note">No group one-shot legacy records yet.</div>}
      </details>
    </section>
  );
}
