import { type ReactNode, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { getCityDistricts } from "../../data/cityDistricts";
import { getCityHubContent, type CityService } from "../../data/cityHubData";
import { getCityAcademyDetail, getCityLocalContracts } from "../../data/cityLoopData";
import { type WorldCity } from "../../data/worldMapData";
import { getProfileRoute } from "../../lib/publicIds";
import {
  acceptServerCityContract,
  claimServerCityContract,
  completeServerCityAcademy,
  completeServerCityContract,
  getServerCityAcademy,
  getServerCityContracts,
  getServerCityPeople,
  getServerCitySpecials,
  refreshServerCityContract,
  startServerCityAcademy,
  useServerCitySpecial,
  type ServerCityAcademy,
  type ServerCityContract,
  type ServerCitySpecialAction,
  type ServerCityOccupant,
  type ServerCityPopulation,
  type ServerCityStanding,
  type ServerCombatResult,
} from "../../lib/authApi";
import { useAuth } from "../../state/AuthContext";

function ServiceLink({ service }: { service: CityService }) {
  const statusLabel = service.status === "open" ? "Open" : service.status === "locked" ? "Locked" : "Unavailable";
  const body = (
    <>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center" }}>
        <strong>{service.label}</strong>
        <span style={{ fontSize: 12, color: service.status === "open" ? "#d8c278" : "#d98f8f" }}>{statusLabel}</span>
      </div>
      <div style={{ fontSize: 13, color: "#b7c3cf" }}>{service.summary}</div>
      {service.status !== "open" && service.lockReason ? <div style={{ fontSize: 12, color: "#d0ad74" }}>{service.lockReason}</div> : null}
    </>
  );

  const style = {
    border: "1px solid rgba(255,255,255,0.08)",
    borderRadius: 8,
    padding: 12,
    background: "rgba(7, 13, 20, 0.55)",
    display: "grid",
    gap: 8,
    textDecoration: "none",
    color: "inherit",
  } as const;

  if (service.status === "open" && service.route) {
    return (
      <Link to={service.route} className="inline-route-link" style={style}>
        {body}
      </Link>
    );
  }

  return <div style={style}>{body}</div>;
}

function isLikelyInternalPresence(person: ServerCityOccupant) {
  if (person.isSelf) return false;
  const label = `${person.displayName} ${person.title}`.toLowerCase();
  return /(canary|fixture|debug|automation|seed|admin test|qa test|test account|load test)/.test(label);
}

function pluralSuffix(count: number) {
  return count === 1 ? "" : "s";
}

function PeopleList({
  people,
  population,
  loading,
  error,
}: {
  people: ServerCityOccupant[];
  population: ServerCityPopulation | null;
  loading: boolean;
  error: string | null;
}) {
  const [showAll, setShowAll] = useState(false);

  if (loading) return <div style={{ color: "#9fb0bf", fontSize: 13 }}>Checking local presence...</div>;
  if (error) return <div style={{ color: "#d98f8f", fontSize: 13 }}>{error}</div>;

  const filteredPeople = people.filter((person) => !isLikelyInternalPresence(person));
  const visiblePeople = showAll ? filteredPeople : filteredPeople.slice(0, 6);
  const suppressedCount = people.length - filteredPeople.length;
  const visibleCount = population?.visibleCount ?? filteredPeople.length;
  const peopleLabel = population?.peopleLabel ?? "citizens";

  return (
    <div style={{ display: "grid", gap: 10 }}>
      <div style={{ border: "1px solid rgba(255,255,255,0.08)", borderRadius: 8, padding: 10, background: "rgba(7, 13, 20, 0.45)", display: "grid", gap: 4 }}>
        <div className="info-row"><span className="info-row__label">Visible population</span><span className="info-row__value">{visibleCount} {peopleLabel}</span></div>
        <div className="info-row"><span className="info-row__label">Guildmates present</span><span className="info-row__value">{population?.guildmatesVisible ?? 0}</span></div>
        <div className="info-row"><span className="info-row__label">Consortium peers present</span><span className="info-row__value">{population?.consortiumMembersVisible ?? 0}</span></div>
        {suppressedCount > 0 ? <div style={{ color: "#9fb0bf", fontSize: 12 }}>{suppressedCount} non-public presence record{pluralSuffix(suppressedCount)} hidden from the normal city list.</div> : null}
      </div>
      {!filteredPeople.length ? <div style={{ color: "#9fb0bf", fontSize: 13 }}>No visible citizens are listed in this city right now.</div> : null}
      {visiblePeople.map((person) => (
        <div key={person.publicId} style={{ border: "1px solid rgba(255,255,255,0.08)", borderRadius: 8, padding: 10, display: "grid", gap: 6, color: "inherit", background: person.isSelf ? "rgba(216,194,120,0.08)" : "rgba(7, 13, 20, 0.48)" }}>
          <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
            <strong>{person.displayName}</strong>
            <span style={{ color: "#d8c278", fontSize: 12 }}>{person.isSelf ? "You" : `P${person.publicId}`}</span>
          </div>
          <div style={{ color: "#9fb0bf", fontSize: 12 }}>{person.title} | Level {person.level}</div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center", fontSize: 12 }}>
            {person.sharesGuild ? <span style={{ color: "#d0ad74" }}>Guildmate</span> : null}
            {person.sharesConsortium ? <span style={{ color: "#d0ad74" }}>Consortium peer</span> : null}
            <Link className="inline-route-link" to={getProfileRoute(person.publicId)}>View Profile</Link>
            {!person.isSelf ? <Link className="inline-route-link" to="/arena">Duel</Link> : null}
          </div>
        </div>
      ))}
      {filteredPeople.length > 6 ? (
        <button type="button" onClick={() => setShowAll((current) => !current)} style={actionButtonStyle(false)}>
          {showAll ? "Show fewer people" : `Show all ${filteredPeople.length} visible people`}
        </button>
      ) : null}
    </div>
  );
}

function formatReward(contract: ServerCityContract) {
  const parts: string[] = [];
  if (contract.reward.gold) parts.push(`${contract.reward.gold} gold`);
  if (contract.reward.experience) parts.push(`${contract.reward.experience} XP`);
  for (const item of contract.reward.items ?? []) {
    parts.push(`${item.quantity} ${item.label}`);
  }
  return parts.length ? parts.join(" | ") : "Modest local standing";
}

function formatDuration(ms: number) {
  const totalSeconds = Math.max(0, Math.ceil(ms / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  if (minutes <= 0) return `${seconds}s`;
  return `${minutes}m ${seconds.toString().padStart(2, "0")}s`;
}

function actionButtonStyle(disabled: boolean) {
  return {
    border: "1px solid rgba(216,194,120,0.45)",
    background: disabled ? "rgba(90,93,100,0.22)" : "rgba(216,194,120,0.12)",
    color: disabled ? "#8d98a4" : "#f0d989",
    borderRadius: 8,
    padding: "8px 10px",
    cursor: disabled ? "not-allowed" : "pointer",
    fontWeight: 700,
  } as const;
}

function CombatMiniPanel({ combat }: { combat: ServerCombatResult | null }) {
  if (!combat) return null;
  return (
    <div style={{ border: "1px solid rgba(216,194,120,0.18)", borderRadius: 8, padding: 10, background: "rgba(7, 13, 20, 0.55)", display: "grid", gap: 5 }}>
      <strong>Contract fight resolved: {combat.outcome}</strong>
      <div style={{ color: "#d8c278", fontSize: 12 }}>Energy spent: {combat.energySpent ?? 0} | Combat XP: +{combat.combatXpGained ?? 0} | Skill XP: +{combat.skillXpGained ?? 0}</div>
      {combat.log.slice(0, 3).map((entry, index) => <div key={`${entry.turn}-${index}`} style={{ color: "#b7c3cf", fontSize: 12 }}>{entry.message}</div>)}
    </div>
  );
}

function ContractCard({
  contract,
  busy,
  onAction,
}: {
  contract: ServerCityContract;
  busy: boolean;
  onAction: (contractId: string, action: "accept" | "complete" | "claim" | "refresh") => void;
}) {
  const riskColor = contract.risk === "high" ? "#d98f8f" : contract.risk === "moderate" ? "#d0ad74" : "#8ec8a7";
  const nextAction = contract.canRefresh ? "refresh" : contract.canClaim ? "claim" : contract.canComplete ? "complete" : contract.canAccept ? "accept" : null;
  const actionLabel = nextAction === "refresh" ? "Renew contract" : nextAction === "claim" ? "Claim rewards" : nextAction === "complete" ? "Complete" : "Accept";
  const disabled = busy || !nextAction;
  const refreshText = contract.refreshAvailableAt ? `Refresh: ${new Date(contract.refreshAvailableAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}` : null;

  return (
    <div style={{ border: "1px solid rgba(255,255,255,0.08)", borderRadius: 8, padding: 12, background: "rgba(7, 13, 20, 0.55)", display: "grid", gap: 8 }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
        <strong>{contract.title}</strong>
        <span style={{ color: riskColor, fontSize: 12 }}>{contract.risk} risk</span>
      </div>
      <div style={{ color: "#d8c278", fontSize: 12 }}>{contract.type} | {contract.status}</div>
      <div style={{ color: "#b7c3cf", fontSize: 13 }}>{contract.summary}</div>
      <div style={{ color: "#9fb0bf", fontSize: 12 }}>Reward: {formatReward(contract)}</div>
      <div style={{ color: "#9fb0bf", fontSize: 12 }}>Standing: +{contract.standingReward} | Required: {contract.minimumStanding}</div>
      <div style={{ color: "#9fb0bf", fontSize: 12 }}>Requirement: {contract.requirementLabel}</div>
      {contract.combat ? <div style={{ color: "#d0ad74", fontSize: 12 }}>Combat check: {contract.combat.label} - {contract.combat.summary} Costs 25 energy when the fight begins.</div> : null}
      {contract.runs > 0 ? <div style={{ color: "#9fb0bf", fontSize: 12 }}>Completed runs: {contract.runs}</div> : null}
      {refreshText ? <div style={{ color: contract.canRefresh ? "#8ec8a7" : "#d0ad74", fontSize: 12 }}>{refreshText}</div> : null}
      {contract.completion.note ? <div style={{ color: "#9fb0bf", fontSize: 12 }}>Completion: {contract.completion.note}</div> : null}
      {contract.completion.visitCityId ? (
        <div style={{ color: contract.completion.visitComplete ? "#8ec8a7" : "#d0ad74", fontSize: 12 }}>
          Travel step: {contract.completion.visitComplete ? "visited" : `visit ${contract.completion.visitLabel ?? "the required city"} and return`}
        </div>
      ) : null}
      {contract.blockedReason && !nextAction ? <div style={{ color: "#d0ad74", fontSize: 12 }}>{contract.blockedReason}</div> : null}
      <button
        type="button"
        disabled={disabled}
        onClick={() => nextAction ? onAction(contract.id, nextAction) : undefined}
        style={actionButtonStyle(disabled)}
      >
        {busy ? "Working..." : actionLabel}
      </button>
    </div>
  );
}

function formatSpecialReward(action: ServerCitySpecialAction) {
  const reward = action.reward as {
    items?: Array<{ itemId?: string; label?: string; quantity?: number }>;
    experience?: number;
    cityStanding?: number;
  };
  const parts: string[] = [];
  for (const item of reward.items ?? []) {
    parts.push(`${item.quantity ?? 1} ${item.label ?? item.itemId ?? "item"}`);
  }
  if (reward.experience) parts.push(`${reward.experience} XP`);
  if (reward.cityStanding) parts.push(`+${reward.cityStanding} standing`);
  return parts.length ? parts.join(" | ") : "Local benefit";
}

function formatCooldown(ms: number) {
  if (ms <= 0) return "Ready";
  const minutes = Math.ceil(ms / 60000);
  return `${minutes}m cooldown`;
}

function SpecialActionCard({
  action,
  busy,
  onUse,
}: {
  action: ServerCitySpecialAction;
  busy: boolean;
  onUse: (specialId: string) => void;
}) {
  const disabled = busy || !action.canUse;
  return (
    <div style={{ border: "1px solid rgba(255,255,255,0.08)", borderRadius: 8, padding: 12, background: "rgba(7, 13, 20, 0.55)", display: "grid", gap: 8 }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
        <strong>{action.name}</strong>
        <span style={{ color: action.canUse ? "#8ec8a7" : "#d0ad74", fontSize: 12 }}>{action.canUse ? "Available" : "Locked"}</span>
      </div>
      <div style={{ color: "#b7c3cf", fontSize: 13 }}>{action.summary}</div>
      <div style={{ color: "#9fb0bf", fontSize: 12 }}>Cost: {action.costGold} gold | Reward: {formatSpecialReward(action)}</div>
      <div style={{ color: "#9fb0bf", fontSize: 12 }}>Standing required: {action.minimumStanding} | Uses: {action.runs} | {formatCooldown(action.cooldownRemainingMs)}</div>
      {action.requiredCourses.length ? <div style={{ color: "#9fb0bf", fontSize: 12 }}>Courses: {action.requiredCourses.join(" | ")}</div> : null}
      {action.lockReason ? <div style={{ color: "#d0ad74", fontSize: 12 }}>{action.lockReason}</div> : null}
      <button type="button" disabled={disabled} onClick={() => onUse(action.id)} style={actionButtonStyle(disabled)}>
        {busy ? "Working..." : action.actionLabel}
      </button>
    </div>
  );
}

type CityHubSectionId = "overview" | "services" | "people" | "contracts" | "academy" | "districts";

function HubSection({
  id,
  title,
  summary,
  openSection,
  onToggle,
  children,
}: {
  id: CityHubSectionId;
  title: string;
  summary: string;
  openSection: CityHubSectionId;
  onToggle: (id: CityHubSectionId) => void;
  children: ReactNode;
}) {
  const open = openSection === id;
  return (
    <section id={id} style={{ border: "1px solid rgba(255,255,255,0.09)", borderRadius: 8, background: "rgba(7, 13, 20, 0.55)", overflow: "hidden" }}>
      <button type="button" onClick={() => onToggle(id)} aria-expanded={open} style={{ width: "100%", border: 0, borderBottom: open ? "1px solid rgba(255,255,255,0.08)" : 0, background: "linear-gradient(180deg, rgba(35,42,50,0.9) 0%, rgba(20,26,32,0.92) 100%)", color: "#f7fbff", padding: "12px 14px", textAlign: "left", cursor: "pointer", display: "grid", gap: 4 }}>
        <span style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center" }}>
          <strong>{title}</strong>
          <span style={{ color: "#d8c278", fontSize: 12 }}>{open ? "Collapse" : "Expand"}</span>
        </span>
        <span style={{ color: "#9fb0bf", fontSize: 12, lineHeight: 1.45 }}>{summary}</span>
      </button>
      {open ? <div style={{ padding: 14, display: "grid", gap: 12 }}>{children}</div> : null}
    </section>
  );
}

function AcademyPanel({
  academy,
  fallbackName,
  fallbackFocus,
  now,
  busy,
  expanded,
  onToggle,
  onAction,
}: {
  academy: ServerCityAcademy | null;
  fallbackName: string;
  fallbackFocus: string;
  now: number;
  busy: boolean;
  expanded: boolean;
  onToggle: () => void;
  onAction: (academyId: string, action: "start" | "complete") => void;
}) {
  if (!academy) {
    return (
      <div style={{ border: "1px solid rgba(255,255,255,0.08)", borderRadius: 8, padding: 10, display: "grid", gap: 8, background: "rgba(7, 13, 20, 0.45)" }}>
        <strong>{fallbackName}</strong>
        <p style={{ margin: 0, color: "#b7c3cf" }}>{fallbackFocus}</p>
        <div style={{ color: "#d0ad74", fontSize: 12 }}>Sign in through the live server session to use academy study.</div>
      </div>
    );
  }

  const active = academy.activeStudy;
  const progress = active ? Math.max(0, Math.min(100, Math.round(((now - active.startedAt) / Math.max(academy.durationMs, 1000)) * 100))) : 0;
  const remainingMs = active ? Math.max(0, active.endsAt - now) : 0;
  const nextAction = academy.canComplete ? "complete" : academy.canStart ? "start" : null;
  const disabled = busy || !nextAction;
  const availableStage = academy.stages.find((stage) => stage.status === "active" || stage.status === "available");

  return (
    <div style={{ border: "1px solid rgba(255,255,255,0.08)", borderRadius: 8, background: "rgba(7, 13, 20, 0.45)", overflow: "hidden" }}>
      <button type="button" onClick={onToggle} aria-expanded={expanded} style={{ width: "100%", border: 0, background: "rgba(12,18,24,0.92)", color: "inherit", padding: 10, textAlign: "left", cursor: "pointer", display: "grid", gap: 5 }}>
        <span style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
          <strong>{academy.name}</strong>
          <span style={{ color: academy.isCompleted ? "#8ec8a7" : academy.lockReason ? "#d0ad74" : "#d8c278", fontSize: 12 }}>{academy.isCompleted ? "Complete" : academy.activeStudy ? "Studying" : academy.lockReason ? "Locked" : "Available"}</span>
        </span>
        <span style={{ color: "#b7c3cf", fontSize: 13 }}>{academy.theme}</span>
        <span style={{ color: "#9fb0bf", fontSize: 12 }}>Standing {academy.standing.value} | Next: {availableStage?.title ?? "academy chain complete"}</span>
      </button>
      {expanded ? (
        <div style={{ padding: 10, display: "grid", gap: 10 }}>
          <div className="info-row"><span className="info-row__label">Local standing</span><span className="info-row__value">{academy.standing.value} | {academy.standing.tier}</span></div>
          <div className="info-row"><span className="info-row__label">Supports</span><span className="info-row__value">{academy.progressionSupports.join(" | ")}</span></div>
          {academy.entryRequirements.length ? <div style={{ color: "#9fb0bf", fontSize: 12 }}>Entry: {academy.entryRequirements.join(" | ")}</div> : null}
          {active ? (
            <div style={{ border: "1px solid rgba(255,255,255,0.08)", borderRadius: 8, padding: 10, display: "grid", gap: 6, background: "rgba(7, 13, 20, 0.45)" }}>
              <div className="info-row"><span className="info-row__label">Active stage</span><span className="info-row__value">{academy.stages.find((stage) => stage.id === active.stageId)?.title ?? active.stageId}</span></div>
              <div className="info-row"><span className="info-row__label">Study progress</span><span className="info-row__value">{progress}%</span></div>
              <div style={{ height: 8, borderRadius: 999, background: "rgba(255,255,255,0.08)", overflow: "hidden" }}><div style={{ width: `${progress}%`, height: "100%", background: "#d8c278" }} /></div>
              <div style={{ color: "#9fb0bf", fontSize: 12 }}>{active.readyToComplete || remainingMs <= 0 ? "Ready to complete if you are in the academy city." : `Ready in ${formatDuration(remainingMs)}.`}</div>
            </div>
          ) : null}
          <div style={{ display: "grid", gap: 8 }}>
            {academy.stages.map((stage, index) => (
              <div key={stage.id} style={{ border: "1px solid rgba(255,255,255,0.08)", borderRadius: 8, padding: 10, background: stage.status === "active" ? "rgba(216,194,120,0.08)" : "rgba(7, 13, 20, 0.45)", display: "grid", gap: 5 }}>
                <div style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}><strong>{index + 1}. {stage.title}</strong><span style={{ color: stage.status === "completed" ? "#8ec8a7" : stage.status === "locked" ? "#d0ad74" : "#d8c278", fontSize: 12 }}>{stage.status}</span></div>
                <div style={{ color: "#b7c3cf", fontSize: 13 }}>{stage.summary}</div>
                <div style={{ color: "#9fb0bf", fontSize: 12 }}>Standing required: {stage.requiredStanding} | Reward standing: +{stage.standingReward}</div>
                {stage.requiredCourses.length ? <div style={{ color: "#9fb0bf", fontSize: 12 }}>Courses: {stage.requiredCourses.join(" | ")}</div> : null}
                {stage.missingCourses.length ? <div style={{ color: "#d0ad74", fontSize: 12 }}>Missing: {stage.missingCourses.join(" | ")}</div> : null}
                {stage.lockReason && stage.status !== "available" ? <div style={{ color: "#d0ad74", fontSize: 12 }}>{stage.lockReason}</div> : null}
              </div>
            ))}
          </div>
          {academy.isCompleted ? <div style={{ color: "#8ec8a7", fontSize: 12 }}>Academy chain complete.</div> : null}
          {academy.lockReason && !nextAction && !academy.isCompleted ? <div style={{ fontSize: 12, color: "#d0ad74" }}>{academy.lockReason}</div> : null}
          <button type="button" disabled={disabled} onClick={() => nextAction ? onAction(academy.id, nextAction) : undefined} style={actionButtonStyle(disabled)}>{busy ? "Working..." : nextAction === "complete" ? "Complete stage" : "Start next stage"}</button>
        </div>
      ) : null}
    </div>
  );
}

export default function CityDistrictHub({ city }: { city: WorldCity }) {
  const { authSource, serverSessionToken, refreshServerState } = useAuth();
  const hub = useMemo(() => getCityHubContent(city.id), [city.id]);
  const academyDetail = useMemo(() => getCityAcademyDetail(city.id), [city.id]);
  const localContracts = useMemo(() => getCityLocalContracts(city.id), [city.id]);
  const districts = getCityDistricts(city);
  const [people, setPeople] = useState<ServerCityOccupant[]>([]);
  const [population, setPopulation] = useState<ServerCityPopulation | null>(null);
  const [peopleError, setPeopleError] = useState<string | null>(null);
  const [peopleLoading, setPeopleLoading] = useState(false);
  const [contracts, setContracts] = useState<ServerCityContract[]>([]);
  const [standing, setStanding] = useState<ServerCityStanding | null>(null);
  const [contractsError, setContractsError] = useState<string | null>(null);
  const [contractsMessage, setContractsMessage] = useState<string | null>(null);
  const [lastContractCombat, setLastContractCombat] = useState<ServerCombatResult | null>(null);
  const [contractsLoading, setContractsLoading] = useState(false);
  const [academy, setAcademy] = useState<ServerCityAcademy | null>(null);
  const [academies, setAcademies] = useState<ServerCityAcademy[]>([]);
  const [academyError, setAcademyError] = useState<string | null>(null);
  const [academyMessage, setAcademyMessage] = useState<string | null>(null);
  const [academyLoading, setAcademyLoading] = useState(false);
  const [specials, setSpecials] = useState<ServerCitySpecialAction[]>([]);
  const [specialsError, setSpecialsError] = useState<string | null>(null);
  const [specialsMessage, setSpecialsMessage] = useState<string | null>(null);
  const [specialsLoading, setSpecialsLoading] = useState(false);
  const [busyAction, setBusyAction] = useState<string | null>(null);
  const [now, setNow] = useState(Date.now());
  const [openSection, setOpenSection] = useState<CityHubSectionId>("overview");
  const [showAllContracts, setShowAllContracts] = useState(false);
  const [openAcademyId, setOpenAcademyId] = useState<string | null>(null);

  useEffect(() => {
    const handle = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(handle);
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function loadPeople() {
      if (authSource !== "server" || !serverSessionToken) {
        setPeople([]);
        setPopulation(null);
        setPeopleError("Sign in through the live server session to view city presence.");
        return;
      }

      setPeopleLoading(true);
      setPeopleError(null);
      const result = await getServerCityPeople(serverSessionToken, city.id);
      if (cancelled) return;
      setPeopleLoading(false);
      if (!result.ok) {
        setPeople([]);
        setPopulation(null);
        setPeopleError(result.error);
        return;
      }
      setPeople(result.people);
      setPopulation(result.population);
    }

    void loadPeople();
    return () => {
      cancelled = true;
    };
  }, [authSource, city.id, serverSessionToken]);

  useEffect(() => {
    let cancelled = false;

    async function loadCityGameplay() {
      setContractsMessage(null);
      setLastContractCombat(null);
      setAcademyMessage(null);
      setSpecialsMessage(null);
      if (authSource !== "server" || !serverSessionToken) {
        setContracts([]);
        setStanding(null);
        setAcademy(null);
        setAcademies([]);
        setSpecials([]);
        setContractsError("Sign in through the live server session to use local contracts.");
        setAcademyError("Sign in through the live server session to use academy study.");
        setSpecialsError("Sign in through the live server session to use city special actions.");
        return;
      }

      setContractsLoading(true);
      setAcademyLoading(true);
      setSpecialsLoading(true);
      setContractsError(null);
      setAcademyError(null);
      setSpecialsError(null);
      const [contractResult, academyResult, specialsResult] = await Promise.all([
        getServerCityContracts(serverSessionToken, city.id),
        getServerCityAcademy(serverSessionToken, city.id),
        getServerCitySpecials(serverSessionToken, city.id),
      ]);
      if (cancelled) return;
      setContractsLoading(false);
      setAcademyLoading(false);
      setSpecialsLoading(false);

      if (contractResult.ok) {
        setContracts(contractResult.contracts);
        setStanding(contractResult.standing);
      } else {
        setContracts([]);
        setStanding(null);
        setContractsError(contractResult.error);
      }

      if (academyResult.ok) {
        setAcademy(academyResult.academy);
        setAcademies(academyResult.academies ?? [academyResult.academy]);
      } else {
        setAcademy(null);
        setAcademies([]);
        setAcademyError(academyResult.error);
      }

      if (specialsResult.ok) {
        setSpecials(specialsResult.specials);
      } else {
        setSpecials([]);
        setSpecialsError(specialsResult.error);
      }
    }

    void loadCityGameplay();
    return () => {
      cancelled = true;
    };
  }, [authSource, city.id, serverSessionToken]);

  async function runContractAction(contractId: string, action: "accept" | "complete" | "claim" | "refresh") {
    if (!serverSessionToken) return;
    setBusyAction(`contract:${contractId}:${action}`);
    setContractsMessage(null);
    setContractsError(null);
    const result =
      action === "accept"
        ? await acceptServerCityContract(serverSessionToken, contractId)
        : action === "complete"
          ? await completeServerCityContract(serverSessionToken, contractId)
          : action === "refresh"
            ? await refreshServerCityContract(serverSessionToken, contractId)
            : await claimServerCityContract(serverSessionToken, contractId);
    setBusyAction(null);
    if (!result.ok) {
      setContractsError(result.error);
      return;
    }
    setContracts(result.contracts);
    setStanding(result.standing);
    setLastContractCombat(result.combat ?? null);
    setContractsMessage(result.message ?? "Contract updated.");
    await refreshServerState();
  }

  async function runAcademyAction(academyId: string, action: "start" | "complete") {
    if (!serverSessionToken) return;
    setBusyAction(`academy:${academyId}:${action}`);
    setAcademyMessage(null);
    setAcademyError(null);
    const result = action === "start" ? await startServerCityAcademy(serverSessionToken, academyId) : await completeServerCityAcademy(serverSessionToken, academyId);
    setBusyAction(null);
    if (!result.ok) {
      setAcademyError(result.error);
      return;
    }
    setAcademy(result.academy);
    setAcademies(result.academies ?? [result.academy]);
    setAcademyMessage(result.message ?? "Academy state updated.");
    await refreshServerState();
  }

  async function runSpecialAction(specialId: string) {
    if (!serverSessionToken) return;
    setBusyAction(`special:${specialId}`);
    setSpecialsMessage(null);
    setSpecialsError(null);
    const result = await useServerCitySpecial(serverSessionToken, specialId);
    setBusyAction(null);
    if (!result.ok) {
      setSpecialsError(result.error);
      return;
    }
    setSpecials(result.specials);
    setStanding(result.standing);
    setSpecialsMessage(result.message ?? "City special completed.");
    await refreshServerState();
  }

  const serviceCards = [
    hub.services.market,
    hub.services.travel,
    hub.services.guild,
    hub.services.consortium,
    hub.services.academy,
    hub.services.blackMarket,
    hub.services.citySpecial,
  ];
  const academyEntries = academies.length ? academies : academy ? [academy] : [];
  const visibleContracts = showAllContracts ? contracts : contracts.slice(0, 3);
  const fallbackContracts = showAllContracts ? localContracts : localContracts.slice(0, 3);
  const contractSummary = contracts.length
    ? `${contracts.length} local contracts | ${contracts.filter((contract) => contract.status === "active").length} active`
    : `${localContracts.length} local postings previewed`;
  const districtCount = districts.reduce((total, district) => total + district.destinations.length, 0);

  return (
    <div style={{ display: "grid", gap: 12 }}>
      <div style={{ border: "1px solid rgba(255,255,255,0.08)", borderRadius: 10, padding: 14, background: "rgba(7, 13, 20, 0.58)", display: "grid", gap: 6 }}>
        <strong>{hub.displayName}</strong>
        <div style={{ color: "#d8c278", fontSize: 13 }}>{hub.identity}</div>
        <div style={{ color: "#9fb0bf", fontSize: 13 }}>{hub.overview}</div>
      </div>

      <HubSection id="overview" title="City Overview" summary={`${standing ? `${standing.tier} standing` : "Local status"} | ${hub.market.imports.slice(0, 2).join(", ") || "city imports"} in, ${hub.market.exports.slice(0, 2).join(", ") || "city exports"} out`} openSection={openSection} onToggle={setOpenSection}>
        <div style={{ display: "grid", gap: 10 }}>
          <p style={{ margin: 0 }}>{hub.localIdentity}</p>
          {standing ? (
            <>
              <div className="info-row"><span className="info-row__label">Local standing</span><span className="info-row__value">{standing.value} | {standing.tier}</span></div>
              <div style={{ color: "#9fb0bf", fontSize: 12 }}>Standing improves local contracts, services, and academy access.</div>
            </>
          ) : null}
          <div className="info-row"><span className="info-row__label">Property flavor</span><span className="info-row__value">{hub.propertyFlavor}</span></div>
          <div className="info-row"><span className="info-row__label">Imports</span><span className="info-row__value">{hub.market.imports.join(", ")}</span></div>
          <div className="info-row"><span className="info-row__label">Exports</span><span className="info-row__value">{hub.market.exports.join(", ")}</span></div>
          {hub.lockedContent.length ? (
            <div style={{ display: "grid", gap: 8 }}>
              {hub.lockedContent.map((entry) => (
                <div key={entry.label} style={{ border: "1px solid rgba(255,255,255,0.08)", borderRadius: 8, padding: 10, background: "rgba(7, 13, 20, 0.45)", display: "grid", gap: 4 }}>
                  <strong>{entry.label}</strong>
                  <div style={{ color: "#b7c3cf", fontSize: 13 }}>{entry.reason}</div>
                  <div style={{ color: "#d0ad74", fontSize: 12 }}>Unlock path: {entry.unlockPath}</div>
                </div>
              ))}
            </div>
          ) : null}
        </div>
      </HubSection>

      <HubSection id="services" title="Local Services" summary={`Market, Travel, Guild, Consortium, Academy${hub.services.blackMarket.status === "open" ? ", Black Market" : ""}, and ${hub.special.name}`} openSection={openSection} onToggle={setOpenSection}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 10 }}>
          {serviceCards.map((service) => <ServiceLink key={service.label} service={service} />)}
        </div>
        <div id="special" style={{ display: "grid", gap: 10 }}>
          <strong>{hub.special.name}</strong>
          <p style={{ margin: 0, color: "#b7c3cf" }}>{hub.special.summary}</p>
          {specialsLoading ? <div style={{ color: "#9fb0bf", fontSize: 13 }}>Checking local services...</div> : null}
          {specialsError ? <div style={{ color: "#d98f8f", fontSize: 13 }}>{specialsError}</div> : null}
          {specialsMessage ? <div style={{ color: "#8ec8a7", fontSize: 13 }}>{specialsMessage}</div> : null}
          {specials.length ? specials.map((action) => <SpecialActionCard key={action.id} action={action} busy={busyAction === `special:${action.id}`} onUse={runSpecialAction} />) : <div style={{ color: "#9fb0bf", fontSize: 13 }}>No city-special action is available from this city right now.</div>}
        </div>
      </HubSection>

      <HubSection id="people" title="People" summary={`${population?.visibleCount ?? people.length} visible | ${population?.guildmatesVisible ?? 0} guildmates | ${population?.consortiumMembersVisible ?? 0} consortium peers`} openSection={openSection} onToggle={setOpenSection}>
        <p style={{ margin: 0, color: "#b7c3cf" }}>{hub.peopleIntro}</p>
        <PeopleList people={people} population={population} loading={peopleLoading} error={peopleError} />
      </HubSection>

      <HubSection id="contracts" title="Local Contracts" summary={contractSummary} openSection={openSection} onToggle={setOpenSection}>
        <div style={{ display: "grid", gap: 10 }}>
          {contractsLoading ? <div style={{ color: "#9fb0bf", fontSize: 13 }}>Loading local contracts...</div> : null}
          {contractsError ? <div style={{ color: "#d98f8f", fontSize: 13 }}>{contractsError}</div> : null}
          {contractsMessage ? <div style={{ color: "#8ec8a7", fontSize: 13 }}>{contractsMessage}</div> : null}
          <CombatMiniPanel combat={lastContractCombat} />
          {contracts.length ? (
            <>
              {visibleContracts.map((contract) => <ContractCard key={contract.id} contract={contract} busy={Boolean(busyAction?.startsWith(`contract:${contract.id}:`))} onAction={runContractAction} />)}
              {contracts.length > 3 ? <button type="button" onClick={() => setShowAllContracts((current) => !current)} style={actionButtonStyle(false)}>{showAllContracts ? "Show fewer contracts" : `Show all ${contracts.length} contracts`}</button> : null}
            </>
          ) : authSource === "server" ? null : (
            <>
              <div style={{ color: "#d0ad74", fontSize: 12 }}>Local contracts are server-backed. Sign in to accept, complete, and claim them.</div>
              {fallbackContracts.map((contract) => (
                <div key={contract.id} style={{ border: "1px solid rgba(255,255,255,0.08)", borderRadius: 8, padding: 12, background: "rgba(7, 13, 20, 0.55)", display: "grid", gap: 6 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}><strong>{contract.title}</strong><span style={{ color: "#d8c278", fontSize: 12 }}>{contract.risk} risk</span></div>
                  <div style={{ color: "#d8c278", fontSize: 12 }}>{contract.type}</div>
                  <div style={{ color: "#b7c3cf", fontSize: 13 }}>{contract.summary}</div>
                  <div style={{ color: "#9fb0bf", fontSize: 12 }}>Reward: {contract.reward}</div>
                  <div style={{ color: "#9fb0bf", fontSize: 12 }}>Requires: {contract.requirement}</div>
                </div>
              ))}
            </>
          )}
        </div>
      </HubSection>

      <HubSection id="academy" title="Academy" summary={`${academyEntries.length || 1} local academ${(academyEntries.length || 1) === 1 ? "y" : "ies"} | compact until expanded`} openSection={openSection} onToggle={setOpenSection}>
        <div style={{ display: "grid", gap: 10 }}>
          {academyLoading ? <div style={{ color: "#9fb0bf", fontSize: 13 }}>Checking academy access...</div> : null}
          {academyError ? <div style={{ color: "#d98f8f", fontSize: 13 }}>{academyError}</div> : null}
          {academyMessage ? <div style={{ color: "#8ec8a7", fontSize: 13 }}>{academyMessage}</div> : null}
          {academyEntries.length ? academyEntries.map((academyEntry) => (
            <AcademyPanel key={academyEntry.id} academy={academyEntry} fallbackName={hub.academy.name} fallbackFocus={hub.academy.focus} now={now} busy={Boolean(busyAction?.startsWith("academy:"))} expanded={openAcademyId === academyEntry.id} onToggle={() => setOpenAcademyId((current) => current === academyEntry.id ? null : academyEntry.id)} onAction={runAcademyAction} />
          )) : (
            <AcademyPanel academy={null} fallbackName={hub.academy.name} fallbackFocus={hub.academy.focus} now={now} busy={Boolean(busyAction?.startsWith("academy:"))} expanded onToggle={() => undefined} onAction={runAcademyAction} />
          )}
          <ServiceLink service={hub.services.academy} />
          {!academy && academyDetail.lockReason ? <div style={{ fontSize: 12, color: "#d0ad74" }}>{academyDetail.lockReason}</div> : null}
          {hub.academy.unlockCourse ? <div style={{ fontSize: 12, color: "#d0ad74" }}>Unlock path: {hub.academy.unlockCourse}</div> : null}
        </div>
      </HubSection>

      <HubSection id="districts" title="District Directory" summary={`${districts.length} districts | ${districtCount} linked services, collapsed by default`} openSection={openSection} onToggle={setOpenSection}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 12 }}>
          {districts.map((district) => (
            <div key={district.id} style={{ border: "1px solid rgba(255,255,255,0.08)", borderRadius: 8, padding: 12, background: "rgba(7, 13, 20, 0.45)", display: "grid", gap: 8 }}>
              <strong>{district.name}</strong>
              <div style={{ fontSize: 13, color: "#9fb0bf" }}>{district.summary}</div>
              <div style={{ display: "grid", gap: 6 }}>
                {district.destinations.map((destination) => {
                  const service: CityService = { label: destination.name, route: destination.route, status: destination.locked ? "locked" : "open", summary: destination.description, lockReason: destination.lockReason };
                  return <ServiceLink key={destination.id} service={service} />;
                })}
              </div>
            </div>
          ))}
        </div>
      </HubSection>
    </div>
  );
}