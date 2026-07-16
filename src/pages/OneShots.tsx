import { useEffect, useMemo, useState, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { ContentPanel } from "../components/layout/ContentPanel";
import { PlayerAvatar } from "../components/common/PlayerAvatar";
import { AppShell } from "../components/layout/AppShell";
import { useAuth } from "../state/AuthContext";
import { usePlayer } from "../state/PlayerContext";
import { chooseOneShotOption, getOneShotHub, startOneShot, type OneShotHub, type OneShotSession } from "../lib/nexisOneShotApi";

function formatDate(value: unknown) {
  const timestamp = typeof value === "number" ? value : 0;
  if (!timestamp) return "Not recorded";
  return new Intl.DateTimeFormat("en-GB", { dateStyle: "medium", timeStyle: "short" }).format(new Date(timestamp));
}

function text(value: unknown, fallback = "Not recorded") {
  return typeof value === "string" && value.trim() ? value.trim() : fallback;
}

function numberText(value: unknown, fallback = "0") {
  return typeof value === "number" && Number.isFinite(value) ? value.toLocaleString("en-GB") : fallback;
}

function rewardTagLabel(tag: string) {
  const labels: Record<string, string> = {
    civic: "Civic",
    focus: "Arcane",
    covert: "Covert",
    travel: "Travel",
    healing: "Healing",
  };
  return labels[tag] ?? tag.replace(/[-_]+/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function campaignStatus(campaign: OneShotHub["campaigns"][number]) {
  if (campaign.isCompleted) return "completed";
  if (campaign.isLocked) return "locked";
  if (campaign.canStart) return "available";
  return "unavailable";
}

function SnapshotRow({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="one-shot-kv">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function SessionLog({ session }: { session: OneShotSession }) {
  return (
    <div className="one-shot-log" aria-live="polite">
      {session.log.map((entry) => (
        <article key={entry.id} className={`one-shot-log__entry one-shot-log__entry--${entry.type === "choice" ? "choice" : "dm"}`}>
          <div className="one-shot-log__top">
            <span>{entry.type === "choice" ? "Choice" : "DMOS"}</span>
            <time>{formatDate(entry.timestamp)}</time>
          </div>
          <h3>{entry.title}</h3>
          <p>{entry.text}</p>
        </article>
      ))}
    </div>
  );
}

function RewardLine({ session }: { session: OneShotSession }) {
  const reward = session.completion?.reward;
  if (!reward) return null;
  const itemText = reward.items?.length
    ? reward.items.map((item) => `${item.label} x${item.quantity}`).join(" | ")
    : "No item payout";
  return (
    <div className="one-shot-reward">
      <span>Reward granted</span>
      <strong>{reward.gold.toLocaleString("en-GB")} gold | {reward.experience.toLocaleString("en-GB")} XP | {itemText}</strong>
      {reward.multiplier && reward.multiplier > 1 ? <em>The Absolute multiplier x{reward.multiplier} applied.</em> : null}
    </div>
  );
}

function CampaignList({ hub, campaigns, selectedId, onSelect }: { hub: OneShotHub; campaigns: OneShotHub["campaigns"]; selectedId: string; onSelect: (id: string) => void }) {
  if (!campaigns.length) return <div className="one-shot-empty">No campaigns match these filters.</div>;

  return (
    <div className="one-shot-campaigns">
      {campaigns.map((campaign) => (
        <button
          key={campaign.id}
          type="button"
          className={`one-shot-campaign${selectedId === campaign.id ? " one-shot-campaign--selected" : ""}${campaign.isCompleted ? " one-shot-campaign--completed" : ""}`}
          onClick={() => onSelect(campaign.id)}
          disabled={Boolean(hub.activeSession) || campaign.isLocked}
          aria-pressed={selectedId === campaign.id}
        >
          <span>{campaign.region} | {campaign.category}</span>
          <strong>{campaign.title}</strong>
          <small>{campaign.theme} | {campaign.durationMinutes} min | {campaign.rewardPreview}</small>
          {campaign.rewardTags?.length ? <div className="one-shot-campaign__tags">{campaign.rewardTags.slice(0, 3).map((tag) => <i key={tag}>{rewardTagLabel(tag)}</i>)}</div> : null}
          {campaign.isCompleted ? <em>Completed {formatDate(campaign.completedAt)}</em> : campaign.lockReason ? <em>{campaign.lockReason}</em> : null}
        </button>
      ))}
    </div>
  );
}

function ActiveSessionPanel({ session, busy, onChoose }: { session: OneShotSession; busy: boolean; onChoose: (choiceId: string) => void }) {
  if (session.status === "completed") {
    return (
      <ContentPanel title="Completed Chronicle">
        <div className="one-shot-complete">
          <div>
            <span className="one-shot-eyebrow">Recorded</span>
            <h2>{session.title}</h2>
            <p>{session.completion?.chronicleSummary ?? session.completion?.outcome ?? "Campaign completed."}</p>
          </div>
          <RewardLine session={session} />
        </div>
        <SessionLog session={session} />
      </ContentPanel>
    );
  }

  const scene = session.scene;
  return (
    <ContentPanel title="Active One-Shot">
      <div className="one-shot-scene">
        <div className="one-shot-scene__head">
          <div>
            <span className="one-shot-eyebrow">{session.region} | {session.theme}</span>
            <h2>{scene?.title ?? session.title}</h2>
          </div>
          <div className="one-shot-engine-chip">{session.engine}</div>
        </div>
        <p>{scene?.narration ?? "DMOS is preparing the next fixed scene."}</p>
      </div>

      {scene?.choices.length ? (
        <div className="one-shot-choice-grid">
          {scene.choices.map((choice) => (
            <button key={choice.id} type="button" className="one-shot-choice" disabled={busy} onClick={() => onChoose(choice.id)}>
              <strong>{choice.label}</strong>
              <span>{choice.completesRun ? "Concludes this one-shot" : "Moves to the next scene"}</span>
              {choice.tags.length ? <small>{choice.tags.join(" | ")}</small> : null}
            </button>
          ))}
        </div>
      ) : null}

      <SessionLog session={session} />
    </ContentPanel>
  );
}

function ChronicleList({ hub }: { hub: OneShotHub }) {
  if (!hub.recentChronicles.length) return <div className="one-shot-empty">No completed Nexis one-shots yet.</div>;

  return (
    <div className="one-shot-chronicles">
      {hub.recentChronicles.map((entry) => {
        const id = text(entry.id, text(entry.title, "chronicle"));
        const reward = entry.reward && typeof entry.reward === "object" ? entry.reward as { gold?: number; experience?: number; items?: Array<{ label?: string; quantity?: number }> } : null;
        return (
          <article key={id} className="one-shot-chronicle">
            <div>
              <span>{formatDate(entry.completedAt)}</span>
              <h3>{text(entry.title, "Nexis One-Shot")}</h3>
              <p>{text(entry.summary, "Chronicle summary recorded privately.")}</p>
            </div>
            {reward ? (
              <small>
                {numberText(reward.gold)} gold | {numberText(reward.experience)} XP
                {reward.items?.length ? ` | ${reward.items.length} item line(s)` : ""}
              </small>
            ) : null}
          </article>
        );
      })}
    </div>
  );
}

export default function OneShotsPage() {
  const { serverSessionToken, refreshServerState } = useAuth();
  const { player } = usePlayer();
  const [hub, setHub] = useState<OneShotHub | null>(null);
  const [selectedCampaignId, setSelectedCampaignId] = useState<string | null>(null);
  const [session, setSession] = useState<OneShotSession | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [cityFilter, setCityFilter] = useState("all");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("unfinished");
  const [rewardFilter, setRewardFilter] = useState("all");
  const [sortMode, setSortMode] = useState("recommended");
  const [campaignSearch, setCampaignSearch] = useState("");

  const snapshot = hub?.characterSnapshot ?? {};
  const selectedId = selectedCampaignId ?? hub?.selectedCampaignId ?? "";
  const selectedCampaign = hub?.campaigns.find((campaign) => campaign.id === selectedId) ?? null;
  const portrait = (player as unknown as { portrait?: { imageUrl?: string | null; imageKey?: string | null } | null }).portrait;

  const cityOptions = useMemo(() => {
    const options = new Map<string, string>();
    hub?.campaigns.forEach((campaign) => options.set(campaign.cityId, campaign.region));
    return Array.from(options.entries()).map(([id, label]) => ({ id, label })).sort((a, b) => a.label.localeCompare(b.label));
  }, [hub]);

  const categoryOptions = useMemo(() => {
    const categories = new Set<string>();
    hub?.campaigns.forEach((campaign) => categories.add(campaign.category));
    return Array.from(categories).sort((a, b) => a.localeCompare(b));
  }, [hub]);

  const rewardOptions = useMemo(() => {
    const rewards = new Set<string>();
    hub?.campaigns.forEach((campaign) => campaign.rewardTags?.forEach((tag) => rewards.add(tag)));
    return Array.from(rewards).sort((a, b) => rewardTagLabel(a).localeCompare(rewardTagLabel(b)));
  }, [hub]);

  const filteredCampaigns = useMemo(() => {
    const query = campaignSearch.trim().toLowerCase();
    const currentCityId = typeof snapshot.currentCityId === "string" ? snapshot.currentCityId : null;
    const statusRank: Record<string, number> = { available: 0, unavailable: 1, locked: 2, completed: 3 };
    const campaigns = (hub?.campaigns ?? []).filter((campaign) => {
      const status = campaignStatus(campaign);
      const cityMatches = cityFilter === "all" || campaign.cityId === cityFilter;
      const categoryMatches = categoryFilter === "all" || campaign.category === categoryFilter;
      const rewardMatches = rewardFilter === "all" || campaign.rewardTags?.includes(rewardFilter);
      const statusMatches = statusFilter === "all"
        || (statusFilter === "unfinished" && !campaign.isCompleted)
        || status === statusFilter;
      const queryMatches = !query || [campaign.title, campaign.region, campaign.theme, campaign.category, campaign.summary, campaign.rewardPreview, ...(campaign.rewardTags ?? [])]
        .some((value) => value.toLowerCase().includes(query));
      return cityMatches && categoryMatches && rewardMatches && statusMatches && queryMatches;
    });

    return [...campaigns].sort((a, b) => {
      if (sortMode === "shortest") return a.durationMinutes - b.durationMinutes || a.title.localeCompare(b.title);
      if (sortMode === "longest") return b.durationMinutes - a.durationMinutes || a.title.localeCompare(b.title);
      if (sortMode === "title") return a.title.localeCompare(b.title);
      if (sortMode === "city") return a.region.localeCompare(b.region) || a.title.localeCompare(b.title);
      if (sortMode === "category") return a.category.localeCompare(b.category) || a.title.localeCompare(b.title);
      if (sortMode === "reward") return rewardTagLabel(a.rewardTags?.[0] ?? "").localeCompare(rewardTagLabel(b.rewardTags?.[0] ?? "")) || a.title.localeCompare(b.title);
      const aCityBoost = currentCityId && a.cityId === currentCityId ? -1 : 0;
      const bCityBoost = currentCityId && b.cityId === currentCityId ? -1 : 0;
      return (statusRank[campaignStatus(a)] ?? 9) - (statusRank[campaignStatus(b)] ?? 9)
        || aCityBoost - bCityBoost
        || a.durationMinutes - b.durationMinutes
        || a.title.localeCompare(b.title);
    });
  }, [campaignSearch, categoryFilter, cityFilter, hub, rewardFilter, snapshot.currentCityId, sortMode, statusFilter]);

  const tokenLabel = useMemo(() => {
    if (!hub) return "Checking access";
    const pieces = [`${hub.access.patronBoundTokens} Patron`, `${hub.access.sealedTokens} Sealed`];
    if (hub.access.staffTestAvailable) pieces.push("staff test enabled");
    return pieces.join(" | ");
  }, [hub]);

  const startDisabled = busy || loading || Boolean(hub?.activeSession) || !hub?.access.canStart || Boolean(selectedCampaign?.isLocked);
  const startLabel = busy
    ? "Recording"
    : hub?.activeSession
      ? "Run active"
      : selectedCampaign?.isCompleted
        ? "Completed"
        : selectedCampaign?.isLocked
          ? "Locked"
          : "Start one-shot";

  useEffect(() => {
    if (!hub || !filteredCampaigns.length) return;
    if (selectedId && filteredCampaigns.some((campaign) => campaign.id === selectedId)) return;
    const nextCampaign = filteredCampaigns.find((campaign) => !campaign.isLocked) ?? filteredCampaigns[0];
    setSelectedCampaignId(nextCampaign.id);
  }, [filteredCampaigns, hub, selectedId]);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      if (!serverSessionToken) {
        setLoading(false);
        setError("Authentication required.");
        return;
      }
      setLoading(true);
      const result = await getOneShotHub(serverSessionToken);
      if (cancelled) return;
      if (!result.ok) {
        setError(result.error);
        setLoading(false);
        return;
      }
      setHub(result.hub);
      setSession(result.hub.activeSession);
      setSelectedCampaignId(result.hub.selectedCampaignId);
      setError(null);
      setLoading(false);
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [serverSessionToken]);

  async function handleStart() {
    if (!serverSessionToken || !hub) return;
    if (selectedCampaign?.isLocked) {
      setError(selectedCampaign.lockReason ?? "Choose an available one-shot.");
      return;
    }
    setBusy(true);
    setError(null);
    setNotice(null);
    const result = await startOneShot(serverSessionToken, selectedId);
    setBusy(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setHub(result.hub);
    setSession(result.session ?? result.hub.activeSession);
    setNotice(result.message ?? "One-shot started.");
    await refreshServerState();
  }

  async function handleChoose(choiceId: string) {
    if (!serverSessionToken || !session) return;
    setBusy(true);
    setError(null);
    setNotice(null);
    const result = await chooseOneShotOption(serverSessionToken, session.id, choiceId);
    setBusy(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setHub(result.hub);
    setSession(result.session ?? result.hub.activeSession);
    setNotice(result.message ?? "Choice recorded.");
    await refreshServerState();
  }

  return (
    <AppShell title="Nexis One-Shots" hint="A Nexis-native fixed-choice campaign portal powered by the DMOS engine boundary.">
      <div className="one-shot-page">
        <section className="one-shot-hero">
          <div className="one-shot-hero__identity">
            <PlayerAvatar name={player.name} lastName={player.lastName} portrait={portrait} size={54} className="one-shot-hero__avatar" />
            <div>
              <span className="one-shot-eyebrow">Character snapshot embedded</span>
              <h1>{text(snapshot.displayName, "Nexis citizen")}</h1>
              <p>{text(snapshot.title, "Untitled citizen")} | Level {numberText(snapshot.level)} | {text(snapshot.currentCityName, "Nexis City")}</p>
            </div>
          </div>
          <div className="one-shot-hero__actions">
            <div className="one-shot-token-strip">
              <span>DMOS access</span>
              <strong>{tokenLabel}</strong>
            </div>
            <button type="button" className="one-shot-primary" disabled={startDisabled} onClick={handleStart}>
              {startLabel}
            </button>
          </div>
        </section>

        {error ? <div className="one-shot-alert one-shot-alert--error">{error}</div> : null}
        {notice ? <div className="one-shot-alert">{notice}</div> : null}
        {hub?.access.lockReason && !hub.activeSession ? <div className="one-shot-alert one-shot-alert--locked">{hub.access.lockReason}</div> : null}
        {selectedCampaign?.lockReason ? <div className="one-shot-alert one-shot-alert--locked">{selectedCampaign.lockReason}</div> : null}

        <div className="one-shot-layout">
          <div className="one-shot-layout__main">
            {loading ? (
              <ContentPanel title="DMOS Channel"><div className="one-shot-empty">Loading Nexis one-shot channel.</div></ContentPanel>
            ) : session ? (
              <ActiveSessionPanel session={session} busy={busy} onChoose={handleChoose} />
            ) : hub ? (
              <ContentPanel title="Campaign Selection">
                <div className="one-shot-brief">
                  <p>This portal does not alter standalone DMOS. Nexis opens a setting-specific one-shot, embeds your character state, offers fixed choices, and validates the result.</p>
                </div>
                <div className="one-shot-catalog-toolbar">
                  <div className="one-shot-catalog-toolbar__summary">
                    <strong>{hub.access.completedCount.toLocaleString("en-GB")} / {hub.access.totalCampaigns.toLocaleString("en-GB")}</strong>
                    <span>Chronicles completed</span>
                  </div>
                  <label>
                    <span>City</span>
                    <select value={cityFilter} onChange={(event) => setCityFilter(event.target.value)}>
                      <option value="all">All cities</option>
                      {cityOptions.map((option) => <option key={option.id} value={option.id}>{option.label}</option>)}
                    </select>
                  </label>
                  <label>
                    <span>Category</span>
                    <select value={categoryFilter} onChange={(event) => setCategoryFilter(event.target.value)}>
                      <option value="all">All categories</option>
                      {categoryOptions.map((option) => <option key={option} value={option}>{option}</option>)}
                    </select>
                  </label>
                  <label>
                    <span>Status</span>
                    <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}>
                      <option value="unfinished">Unfinished</option>
                      <option value="available">Available now</option>
                      <option value="completed">Completed</option>
                      <option value="locked">Locked</option>
                      <option value="all">All statuses</option>
                    </select>
                  </label>
                  <label>
                    <span>Reward</span>
                    <select value={rewardFilter} onChange={(event) => setRewardFilter(event.target.value)}>
                      <option value="all">All rewards</option>
                      {rewardOptions.map((option) => <option key={option} value={option}>{rewardTagLabel(option)}</option>)}
                    </select>
                  </label>
                  <label>
                    <span>Sort</span>
                    <select value={sortMode} onChange={(event) => setSortMode(event.target.value)}>
                      <option value="recommended">Recommended</option>
                      <option value="shortest">Shortest first</option>
                      <option value="longest">Longest first</option>
                      <option value="city">City</option>
                      <option value="category">Category</option>
                      <option value="reward">Reward focus</option>
                      <option value="title">Title A-Z</option>
                    </select>
                  </label>
                  <label className="one-shot-catalog-toolbar__search">
                    <span>Search</span>
                    <input value={campaignSearch} onChange={(event) => setCampaignSearch(event.target.value)} placeholder="Find title, city, theme, reward..." />
                  </label>
                  <small>{filteredCampaigns.length.toLocaleString("en-GB")} shown</small>
                </div>
                <CampaignList hub={hub} campaigns={filteredCampaigns} selectedId={selectedId} onSelect={setSelectedCampaignId} />
              </ContentPanel>
            ) : null}
          </div>

          <aside className="one-shot-layout__rail">
            <ContentPanel title="Embedded Character" defaultOpen>
              <div className="one-shot-kv-list">
                <SnapshotRow label="Public ID" value={`P${String(snapshot.publicId ?? "unknown")}`} />
                <SnapshotRow label="City" value={text(snapshot.currentCityName, "Unknown")} />
                <SnapshotRow label="Condition" value={text(snapshot.condition, "normal")} />
                <SnapshotRow label="Life Path" value={text(snapshot.lifePath, "Unchosen")} />
                <SnapshotRow label="Guild" value={text(snapshot.guild, "No guild")} />
                <SnapshotRow label="Consortium" value={text(snapshot.consortium, "No consortium")} />
              </div>
            </ContentPanel>

            <ContentPanel title="Engine Boundary" defaultOpen={false}>
              <div className="one-shot-engine-note">
                <strong>{hub?.engine.name ?? "DMOS Nexis Adapter"}</strong>
                <p>DMOS narrates; Nexis owns tokens, fixed outcomes, rewards, records, and sharing permissions.</p>
                <Link className="inline-route-link" to="/codex">Open Codex context</Link>
              </div>
            </ContentPanel>

            <ContentPanel title="Recent Chronicles" defaultOpen>
              {hub ? <ChronicleList hub={hub} /> : <div className="one-shot-empty">No Chronicle data loaded.</div>}
            </ContentPanel>
          </aside>
        </div>
      </div>
    </AppShell>
  );
}
