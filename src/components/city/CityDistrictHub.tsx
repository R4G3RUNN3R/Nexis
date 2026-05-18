import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { ContentPanel } from "../layout/ContentPanel";
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
  refreshServerCityContract,
  startServerCityAcademy,
  type ServerCityAcademy,
  type ServerCityContract,
  type ServerCityOccupant,
  type ServerCityPopulation,
  type ServerCityStanding,
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
  if (loading) return <div style={{ color: "#9fb0bf", fontSize: 13 }}>Checking local presence...</div>;
  if (error) return <div style={{ color: "#d98f8f", fontSize: 13 }}>{error}</div>;

  const visibleCount = population?.visibleCount ?? people.length;
  const peopleLabel = population?.peopleLabel ?? "citizens";

  return (
    <div style={{ display: "grid", gap: 8 }}>
      <div style={{ border: "1px solid rgba(255,255,255,0.08)", borderRadius: 8, padding: 10, background: "rgba(7, 13, 20, 0.45)", display: "grid", gap: 4 }}>
        <div className="info-row"><span className="info-row__label">Visible population</span><span className="info-row__value">{visibleCount} {peopleLabel}</span></div>
        <div className="info-row"><span className="info-row__label">Guildmates present</span><span className="info-row__value">{population?.guildmatesVisible ?? 0}</span></div>
        <div className="info-row"><span className="info-row__label">Consortium peers present</span><span className="info-row__value">{population?.consortiumMembersVisible ?? 0}</span></div>
      </div>
      {!people.length ? <div style={{ color: "#9fb0bf", fontSize: 13 }}>No visible citizens are listed in this city right now.</div> : null}
      {people.map((person) => (
        <Link
          key={person.publicId}
          to={getProfileRoute(person.publicId)}
          className="inline-route-link"
          style={{
            border: "1px solid rgba(255,255,255,0.08)",
            borderRadius: 8,
            padding: 10,
            display: "grid",
            gap: 4,
            color: "inherit",
            textDecoration: "none",
            background: person.isSelf ? "rgba(216,194,120,0.08)" : "rgba(7, 13, 20, 0.48)",
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
            <strong>{person.displayName}</strong>
            <span style={{ color: "#d8c278", fontSize: 12 }}>{person.isSelf ? "You" : `P${person.publicId}`}</span>
          </div>
          <div style={{ color: "#9fb0bf", fontSize: 12 }}>{person.title} | Level {person.level}</div>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap", fontSize: 11, color: "#d0ad74" }}>
            {person.sharesGuild ? <span>Guildmate</span> : null}
            {person.sharesConsortium ? <span>Consortium peer</span> : null}
          </div>
        </Link>
      ))}
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

function AcademyPanel({
  academy,
  fallbackName,
  fallbackFocus,
  now,
  busy,
  onAction,
}: {
  academy: ServerCityAcademy | null;
  fallbackName: string;
  fallbackFocus: string;
  now: number;
  busy: boolean;
  onAction: (academyId: string, action: "start" | "complete") => void;
}) {
  if (!academy) {
    return (
      <div style={{ display: "grid", gap: 10 }}>
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

  return (
    <div style={{ display: "grid", gap: 10 }}>
      <strong>{academy.name}</strong>
      <p style={{ margin: 0, color: "#b7c3cf" }}>{academy.theme}</p>
      <div className="info-row"><span className="info-row__label">Local standing</span><span className="info-row__value">{academy.standing.value} | {academy.standing.tier}</span></div>
      <div className="info-row"><span className="info-row__label">Supports</span><span className="info-row__value">{academy.progressionSupports.join(" | ")}</span></div>
      {active ? (
        <div style={{ border: "1px solid rgba(255,255,255,0.08)", borderRadius: 8, padding: 10, display: "grid", gap: 6, background: "rgba(7, 13, 20, 0.45)" }}>
          <div className="info-row"><span className="info-row__label">Active stage</span><span className="info-row__value">{academy.stages.find((stage) => stage.id === active.stageId)?.title ?? active.stageId}</span></div>
          <div className="info-row"><span className="info-row__label">Study progress</span><span className="info-row__value">{progress}%</span></div>
          <div style={{ height: 8, borderRadius: 999, background: "rgba(255,255,255,0.08)", overflow: "hidden" }}>
            <div style={{ width: `${progress}%`, height: "100%", background: "#d8c278" }} />
          </div>
          <div style={{ color: "#9fb0bf", fontSize: 12 }}>{active.readyToComplete || remainingMs <= 0 ? "Ready to complete if you are in the academy city." : `Ready in ${formatDuration(remainingMs)}.`}</div>
        </div>
      ) : null}
      <div style={{ display: "grid", gap: 8 }}>
        {academy.stages.map((stage, index) => (
          <div key={stage.id} style={{ border: "1px solid rgba(255,255,255,0.08)", borderRadius: 8, padding: 10, background: stage.status === "active" ? "rgba(216,194,120,0.08)" : "rgba(7, 13, 20, 0.45)", display: "grid", gap: 5 }}>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
              <strong>{index + 1}. {stage.title}</strong>
              <span style={{ color: stage.status === "completed" ? "#8ec8a7" : stage.status === "locked" ? "#d0ad74" : "#d8c278", fontSize: 12 }}>{stage.status}</span>
            </div>
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
      <button
        type="button"
        disabled={disabled}
        onClick={() => nextAction ? onAction(academy.id, nextAction) : undefined}
        style={actionButtonStyle(disabled)}
      >
        {busy ? "Working..." : nextAction === "complete" ? "Complete stage" : "Start next stage"}
      </button>
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
  const [contractsLoading, setContractsLoading] = useState(false);
  const [academy, setAcademy] = useState<ServerCityAcademy | null>(null);
  const [academyError, setAcademyError] = useState<string | null>(null);
  const [academyMessage, setAcademyMessage] = useState<string | null>(null);
  const [academyLoading, setAcademyLoading] = useState(false);
  const [busyAction, setBusyAction] = useState<string | null>(null);
  const [now, setNow] = useState(Date.now());

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
      setAcademyMessage(null);
      if (authSource !== "server" || !serverSessionToken) {
        setContracts([]);
        setStanding(null);
        setAcademy(null);
        setContractsError("Sign in through the live server session to use local contracts.");
        setAcademyError("Sign in through the live server session to use academy study.");
        return;
      }

      setContractsLoading(true);
      setAcademyLoading(true);
      setContractsError(null);
      setAcademyError(null);
      const [contractResult, academyResult] = await Promise.all([
        getServerCityContracts(serverSessionToken, city.id),
        getServerCityAcademy(serverSessionToken, city.id),
      ]);
      if (cancelled) return;
      setContractsLoading(false);
      setAcademyLoading(false);

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
      } else {
        setAcademy(null);
        setAcademyError(academyResult.error);
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
    setAcademyMessage(result.message ?? "Academy state updated.");
    await refreshServerState();
  }

  const openServiceCards = [hub.services.market, hub.services.travel, hub.services.consortium, hub.services.guild];
  const localServiceCards = [hub.services.blackMarket, hub.services.citySpecial, hub.services.academy];

  return (
    <div style={{ display: "grid", gap: 14 }}>
      <div
        style={{
          border: "1px solid rgba(255,255,255,0.08)",
          borderRadius: 10,
          padding: 14,
          background: "rgba(7, 13, 20, 0.58)",
          display: "grid",
          gap: 6,
        }}
      >
        <strong>{hub.displayName}</strong>
        <div style={{ color: "#d8c278", fontSize: 13 }}>{hub.identity}</div>
        <div style={{ color: "#9fb0bf", fontSize: 13 }}>{hub.overview}</div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 14 }}>
        <ContentPanel title="City Overview">
          <div style={{ display: "grid", gap: 10 }}>
            <p style={{ margin: 0 }}>{hub.localIdentity}</p>
            <div className="info-row">
              <span className="info-row__label">Property Flavor</span>
              <span className="info-row__value">{hub.propertyFlavor}</span>
            </div>
            {standing ? (
              <>
                <div className="info-row"><span className="info-row__label">Local standing</span><span className="info-row__value">{standing.value} | {standing.tier}</span></div>
                <div style={{ color: "#9fb0bf", fontSize: 12 }}>Standing unlocks stronger local contracts and later academy stages.</div>
              </>
            ) : null}
          </div>
        </ContentPanel>

        <ContentPanel title={hub.market.name}>
          <div style={{ display: "grid", gap: 10 }}>
            <p style={{ margin: 0, color: "#b7c3cf" }}>{hub.market.summary}</p>
            <div className="info-row">
              <span className="info-row__label">Imports</span>
              <span className="info-row__value">{hub.market.imports.join(", ")}</span>
            </div>
            <div className="info-row">
              <span className="info-row__label">Exports</span>
              <span className="info-row__value">{hub.market.exports.join(", ")}</span>
            </div>
            <ServiceLink service={hub.services.market} />
          </div>
        </ContentPanel>

        <ContentPanel title="People">
          <div id="people" style={{ display: "grid", gap: 10 }}>
            <p style={{ margin: 0, color: "#b7c3cf" }}>{hub.peopleIntro}</p>
            <PeopleList people={people} population={population} loading={peopleLoading} error={peopleError} />
          </div>
        </ContentPanel>

        <ContentPanel title="Academy">
          <div id="academy" style={{ display: "grid", gap: 10 }}>
            {academyLoading ? <div style={{ color: "#9fb0bf", fontSize: 13 }}>Checking academy access...</div> : null}
            {academyError ? <div style={{ color: "#d98f8f", fontSize: 13 }}>{academyError}</div> : null}
            {academyMessage ? <div style={{ color: "#8ec8a7", fontSize: 13 }}>{academyMessage}</div> : null}
            <AcademyPanel
              academy={academy}
              fallbackName={hub.academy.name}
              fallbackFocus={hub.academy.focus}
              now={now}
              busy={Boolean(busyAction?.startsWith("academy:"))}
              onAction={runAcademyAction}
            />
            <ServiceLink service={hub.services.academy} />
            {!academy && academyDetail.lockReason ? <div style={{ fontSize: 12, color: "#d0ad74" }}>{academyDetail.lockReason}</div> : null}
            {hub.academy.unlockCourse ? <div style={{ fontSize: 12, color: "#d0ad74" }}>Unlock path: {hub.academy.unlockCourse}</div> : null}
          </div>
        </ContentPanel>

        <ContentPanel title="Local Contracts">
          <div style={{ display: "grid", gap: 10 }}>
            {contractsLoading ? <div style={{ color: "#9fb0bf", fontSize: 13 }}>Loading local contracts...</div> : null}
            {contractsError ? <div style={{ color: "#d98f8f", fontSize: 13 }}>{contractsError}</div> : null}
            {contractsMessage ? <div style={{ color: "#8ec8a7", fontSize: 13 }}>{contractsMessage}</div> : null}
            {contracts.length ? (
              contracts.map((contract) => (
                <ContractCard
                  key={contract.id}
                  contract={contract}
                  busy={Boolean(busyAction?.startsWith(`contract:${contract.id}:`))}
                  onAction={runContractAction}
                />
              ))
            ) : authSource === "server" ? null : (
              <>
                <div style={{ color: "#d0ad74", fontSize: 12 }}>Local contracts are server-backed. Sign in to accept, complete, and claim them.</div>
                {localContracts.map((contract) => (
                  <div key={contract.id} style={{ border: "1px solid rgba(255,255,255,0.08)", borderRadius: 8, padding: 12, background: "rgba(7, 13, 20, 0.55)", display: "grid", gap: 6 }}>
                    <strong>{contract.title}</strong>
                    <div style={{ color: "#d8c278", fontSize: 12 }}>{contract.type}</div>
                    <div style={{ color: "#b7c3cf", fontSize: 13 }}>{contract.summary}</div>
                  </div>
                ))}
              </>
            )}
          </div>
        </ContentPanel>

        <ContentPanel title="City Special">
          <div id="special" style={{ display: "grid", gap: 10 }}>
            <strong>{hub.special.name}</strong>
            <p style={{ margin: 0, color: "#b7c3cf" }}>{hub.special.summary}</p>
            <ServiceLink service={hub.services.citySpecial} />
          </div>
        </ContentPanel>

        <ContentPanel title="Local Services">
          <div style={{ display: "grid", gap: 10 }}>
            {[...openServiceCards, ...localServiceCards].map((service) => (
              <ServiceLink key={service.label} service={service} />
            ))}
          </div>
        </ContentPanel>
      </div>

      {hub.lockedContent.length ? (
        <ContentPanel title="Locked Content">
          <div style={{ display: "grid", gap: 10 }}>
            {hub.lockedContent.map((entry) => (
              <div
                key={entry.label}
                style={{
                  border: "1px solid rgba(255,255,255,0.08)",
                  borderRadius: 8,
                  padding: 12,
                  background: "rgba(7, 13, 20, 0.55)",
                  display: "grid",
                  gap: 6,
                }}
              >
                <strong>{entry.label}</strong>
                <div style={{ color: "#b7c3cf", fontSize: 13 }}>{entry.reason}</div>
                <div style={{ color: "#d0ad74", fontSize: 12 }}>Unlock path: {entry.unlockPath}</div>
              </div>
            ))}
          </div>
        </ContentPanel>
      ) : null}

      {city.id === "nexis" ? (
        <ContentPanel title="Nexis District Directory">
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 14 }}>
            {districts.map((district) => (
              <div key={district.id} style={{ display: "grid", gap: 10 }}>
                <strong>{district.name}</strong>
                <div style={{ fontSize: 13, color: "#9fb0bf" }}>{district.summary}</div>
                {district.destinations.map((destination) => {
                  const service: CityService = {
                    label: destination.name,
                    route: destination.route,
                    status: destination.locked ? "locked" : "open",
                    summary: destination.description,
                    lockReason: destination.lockReason,
                  };
                  return <ServiceLink key={destination.id} service={service} />;
                })}
              </div>
            ))}
          </div>
        </ContentPanel>
      ) : null}
    </div>
  );
}
