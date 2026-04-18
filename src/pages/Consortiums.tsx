import { useEffect, useMemo, useState } from "react";
import { AppShell } from "../components/layout/AppShell";
import { ContentPanel } from "../components/layout/ContentPanel";
import { usePlayer } from "../state/PlayerContext";
import { useAuth } from "../state/AuthContext";
import { mergeServerStateIntoCache } from "../lib/runtimeStateCache";
import { formatEntityPublicId } from "../lib/publicIds";
import {
  addOrganizationMember,
  applyToConsortium,
  assignConsortiumPosition,
  claimConsortiumPoints,
  createOrganization,
  depositConsortiumTreasury,
  getMyOrganization,
  redeemConsortiumReward,
  removeConsortiumMember,
  reviewConsortiumApplication,
  runConsortiumOutreach,
} from "../lib/organizationApi";
import { formatDate, type ConsortiumBoard, type ConsortiumReward, type ConsortiumTypeDefinition } from "../lib/organizations";
import { cielPageCopy } from "../data/cielPageCopy";
import "../styles/guild.css";

type AnyBoard = ConsortiumBoard & Record<string, any>;
type DirectoryEntry = Record<string, any>;

const panelStyle = { border: "1px solid rgba(255,255,255,0.08)", borderRadius: 12, padding: 14, display: "grid", gap: 10, background: "rgba(255,255,255,0.02)" } as const;
const statCard = { border: "1px solid rgba(255,255,255,0.06)", borderRadius: 10, padding: 12, display: "grid", gap: 6 } as const;

function Field({ label, value }: { label: string; value: React.ReactNode }) { return <div className="info-row"><span className="info-row__label">{label}</span><span className="info-row__value">{value}</span></div>; }
function TreasuryLine({ treasury }: { treasury: { copper: number; silver: number; gold: number; platinum: number } }) { return <>{treasury.platinum}p | {treasury.gold}g | {treasury.silver}s | {treasury.copper}c</>; }
function RewardCard({ reward, points, onRedeem }: { reward: ConsortiumReward; points: number; onRedeem?: (rewardKey: string) => void }) {
  const unlocked = reward.unlocked ?? true;
  const canRedeem = reward.canRedeem ?? true;
  return <div style={panelStyle}><div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}><strong>{reward.starTier}? {reward.displayName}</strong><span style={{ color: reward.mode === "passive" ? "#8ec8a7" : "#f7cf80", fontSize: 12 }}>{reward.mode === "passive" ? "Passive" : "Active"}</span></div><div style={{ color: "#b7c3cf", fontSize: 13 }}>{reward.effectSummary}</div>{reward.mode === "active" && onRedeem ? <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center" }}><span style={{ fontSize: 12, color: "#9fb0bf" }}>Cost: {reward.pointCost} CP</span><button type="button" className="org-button" disabled={!unlocked || !canRedeem} onClick={() => onRedeem(reward.rewardKey)}>{unlocked ? (canRedeem ? "Redeem" : "Need more CP") : "Locked"}</button></div> : <span style={{ fontSize: 12, color: unlocked ? "#8ec8a7" : "#9fb0bf" }}>{unlocked ? "Unlocked" : `Unlocks at ${reward.starTier}?`}</span>}</div>;
}

export default function ConsortiumsPage() {
  const { player } = usePlayer();
  const { activeAccount, authSource, serverSessionToken } = useAuth();
  const [board, setBoard] = useState<AnyBoard | null>(null);
  const [templates, setTemplates] = useState<ConsortiumTypeDefinition[]>([]);
  const [directory, setDirectory] = useState<DirectoryEntry[]>([]);
  const [consortiumName, setConsortiumName] = useState("");
  const [selectedTypeKey, setSelectedTypeKey] = useState("merchant");
  const [applyNotes, setApplyNotes] = useState<Record<string, string>>({});
  const [memberInviteId, setMemberInviteId] = useState("");
  const [treasuryDeposit, setTreasuryDeposit] = useState("1000");
  const [message, setMessage] = useState<string | null>(null);
  const pageCopy = cielPageCopy.consortiums;

  const refreshPlayerCache = (playerState?: Record<string, unknown>) => {
    if (!activeAccount || !playerState) return;
    mergeServerStateIntoCache({ email: activeAccount.email, user: { internalPlayerId: activeAccount.internalPlayerId, publicId: activeAccount.publicId, firstName: activeAccount.firstName, lastName: activeAccount.lastName }, playerState: playerState as never });
    window.dispatchEvent(new CustomEvent("nexis:player-refresh"));
  };

  const reload = async () => {
    if (!serverSessionToken) return;
    const result = await getMyOrganization(serverSessionToken, "consortium");
    if ("ok" in result && result.ok === false) { setMessage(result.error); return; }
    setBoard(((result as any).organization ?? null) as AnyBoard | null);
    setTemplates(((result as any).consortiumTemplates ?? []) as ConsortiumTypeDefinition[]);
    setDirectory((((result as any).directory ?? []) as DirectoryEntry[]));
    if (((result as any).organization?.consortiumType?.key)) setSelectedTypeKey((result as any).organization.consortiumType.key);
    else if (((result as any).consortiumTemplates?.[0]?.key)) setSelectedTypeKey((result as any).consortiumTemplates[0].key);
  };

  useEffect(() => {
    if (authSource !== "server" || !serverSessionToken) {
      setBoard(null); setTemplates([]); setDirectory([]); setMessage("Consortium companies are live-server only. The browser-only fallback has been escorted outside before it could embarrass itself further."); return;
    }
    void reload();
  }, [authSource, serverSessionToken]);

  const selectedType = useMemo(() => templates.find((entry) => entry.key === selectedTypeKey) ?? templates[0] ?? null, [selectedTypeKey, templates]);
  const hasWrit = (player.inventory.consortium_writ ?? 0) > 0;
  const foundingCost = selectedType ? (hasWrit ? Math.max(75000, selectedType.creationCost - 75000) : selectedType.creationCost) : 0;
  const createDisabled = !!board || !selectedType || consortiumName.trim().length < 3 || player.gold < foundingCost;

  const act = async (runner: () => Promise<any>, success?: (payload: any) => void) => {
    const result = await runner();
    if ("ok" in result && result.ok === false) { setMessage(result.error); return; }
    success?.(result as any);
    await reload();
  };

  return (
    <AppShell title="Consortiums" hint={pageCopy.flavor}>
      <div style={{ display: "grid", gap: 16 }}>
        <div className="page-intro-grid">
          <ContentPanel title="Consortium Flavor">
            <p className="page-intro__lead">{pageCopy.flavor}</p>
            <p className="page-intro__body">{pageCopy.alt}</p>
          </ContentPanel>
          <ContentPanel title="CIEL">
            <p className="page-intro__body">{pageCopy.ciel}</p>
          </ContentPanel>
        </div>

        {message ? <section className="panel"><div className="panel__body"><strong>{message}</strong></div></section> : null}
        {board ? (
          <>
            <section className="panel"><div className="panel__header"><h2>{board.name} [{formatEntityPublicId("consortium", board.publicId)}]</h2></div><div className="panel__body" style={{ display: "grid", gap: 16 }}>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 12 }}>
                {Object.values((board.healthMetrics ?? {}) as Record<string, any>).map((metric: any) => <div key={metric.key} style={statCard}><div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}><strong>{metric.label}</strong><span>{metric.value}</span></div><div style={{ color: "#b7c3cf", fontSize: 12 }}>{metric.meaning}</div><div style={{ color: metric.rating === "Strong" ? "#8ec8a7" : metric.rating === "Stable" ? "#f7cf80" : "#ff9b8f", fontSize: 12 }}>{metric.rating}</div></div>)}
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 16 }}>
                <div style={panelStyle}><strong>Company Details</strong><Field label="Type" value={board.consortiumType?.displayName ?? board.consortiumTypeName} /><Field label="Founded" value={`${formatDate(board.createdAt)} (${board.companyAgeDays ?? 1} days)`} /><Field label="Stars" value={`${board.starRating ?? 1}?`} /><Field label="Director" value={board.members?.find((entry: any) => entry.roleKey === "director")?.displayName ?? "Unknown"} /><Field label="Employees" value={`${board.performance?.employeeCount ?? board.members?.length ?? 0} / ${board.employeeCapacity ?? 0}`} /><Field label="Treasury / Vault" value={<TreasuryLine treasury={board.treasury} />} /><Field label="Daily CP Generation" value={`${board.companyDailyGeneration ?? 0} CP / day`} /><Field label="Performance" value={board.performance?.summary ?? board.passiveBonusSummary} /></div>
                <div style={panelStyle}><strong>Your Details</strong><Field label="Current Role" value={board.yourDetails?.roleDisplayName ?? board.memberRoleKey ?? "Employee"} /><Field label="Current Position" value={board.yourDetails?.positionDisplayName ?? "Unassigned"} /><Field label="Contribution" value={`${board.yourDetails?.contributionScore ?? 0}`} /><Field label="Working Stats" value={board.yourDetails ? `ML ${board.yourDetails.workingStats.manualLabor} | INT ${board.yourDetails.workingStats.intelligence} | END ${board.yourDetails.workingStats.endurance}` : "Unavailable"} /><Field label="Consortium Points" value={`${board.consortiumPoints?.points ?? 0} CP`} /><Field label="Daily CP Gain" value={`${board.consortiumPoints?.dailyGain ?? 0} CP / day`} /></div>
              </div>
              {board.memberRoleKey === "director" ? <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 16 }}>
                <div style={panelStyle}><strong>Management Tools</strong><div className="org-form" style={{ margin: 0, gridTemplateColumns: "1fr auto" }}><input className="org-input" value={treasuryDeposit} onChange={(event) => setTreasuryDeposit(event.target.value)} placeholder="Gold to deposit" /><button type="button" className="org-button" onClick={() => act(() => depositConsortiumTreasury(serverSessionToken!, board.internalId, Number(treasuryDeposit || 0)), (payload) => refreshPlayerCache(payload.playerState))}>Deposit Gold</button></div><div className="org-form" style={{ margin: 0, gridTemplateColumns: "1fr auto" }}><input className="org-input" value={memberInviteId} onChange={(event) => setMemberInviteId(event.target.value)} placeholder="Direct hire public ID" /><button type="button" className="org-button" onClick={() => act(() => addOrganizationMember(serverSessionToken!, board.internalId, memberInviteId), () => setMemberInviteId("") )}>Direct Hire</button></div><button type="button" className="org-button" onClick={() => act(() => runConsortiumOutreach(serverSessionToken!, board.internalId))}>Launch Outreach (2,500g)</button></div>
                <div style={panelStyle}><strong>Applications</strong>{(board.applications ?? []).length ? (board.applications as any[]).map((application) => <div key={application.applicantInternalId} style={{ borderTop: "1px solid rgba(255,255,255,0.06)", paddingTop: 10 }}><div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}><strong>{application.applicantName} [P{String(application.applicantPublicId).padStart(7, "0")}]</strong><span style={{ color: "#9fb0bf", fontSize: 12 }}>{formatDate(application.submittedAt)}</span></div><div style={{ color: "#b7c3cf", fontSize: 13 }}>{application.note || "No cover note. Bold. Possibly reckless."}</div><div style={{ color: "#9fb0bf", fontSize: 12 }}>ML {application.workingStats.manualLabor} | INT {application.workingStats.intelligence} | END {application.workingStats.endurance}</div><div style={{ display: "flex", gap: 8, marginTop: 8 }}><button type="button" className="org-button" onClick={() => act(() => reviewConsortiumApplication(serverSessionToken!, board.internalId, String(application.applicantPublicId), "accept"))}>Accept</button><button type="button" className="org-button org-button--ghost" onClick={() => act(() => reviewConsortiumApplication(serverSessionToken!, board.internalId, String(application.applicantPublicId), "reject"))}>Reject</button></div></div>) : <div style={{ color: "#9fb0bf", fontSize: 13 }}>No pending applications. Popularity will have to do the flirting for you.</div>}</div>
              </div> : null}
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: 12 }}>
                {(board.rewardLadder ?? []).map((reward: ConsortiumReward) => <RewardCard key={reward.rewardKey} reward={{ ...reward, unlocked: (board.starRating ?? 0) >= reward.starTier, canRedeem: reward.mode === "active" ? (board.consortiumPoints?.points ?? 0) >= Number(reward.pointCost ?? 0) : undefined }} points={board.consortiumPoints?.points ?? 0} onRedeem={reward.mode === "active" ? (rewardKey) => act(() => redeemConsortiumReward(serverSessionToken!, board.internalId, rewardKey), (payload) => refreshPlayerCache(payload.playerState)) : undefined} />)}
              </div>
              <div style={panelStyle}><strong>Roster</strong>{(board.memberDetails ?? []).map((member: any) => <div key={member.userInternalId} style={{ borderTop: "1px solid rgba(255,255,255,0.06)", paddingTop: 10, display: "grid", gap: 8 }}><div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}><strong>{member.displayName} [P{String(member.publicId).padStart(7, "0")}]</strong><span style={{ color: "#9fb0bf", fontSize: 12 }}>{member.roleDisplayName} | {member.positionDisplayName} | {member.dailyCpGain} CP/day</span></div><div style={{ color: "#b7c3cf", fontSize: 13 }}>Contribution {member.contributionScore} | ML {member.workingStats.manualLabor} | INT {member.workingStats.intelligence} | END {member.workingStats.endurance}</div>{board.memberRoleKey === "director" && member.roleKey !== "director" ? <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>{(board.positions ?? []).filter((position: any) => position.key !== "director").map((position: any) => <button key={position.key} type="button" className="org-button org-button--ghost" onClick={() => act(() => assignConsortiumPosition(serverSessionToken!, board.internalId, String(member.publicId), position.key))}>{position.displayName}</button>)}<button type="button" className="org-button org-button--ghost" onClick={() => act(() => removeConsortiumMember(serverSessionToken!, board.internalId, String(member.publicId)))}>Dismiss</button></div> : null}</div>)}</div>
              <div style={panelStyle}><strong>Company History</strong>{(board.logs ?? []).length ? (board.logs as any[]).map((entry) => <div key={`${entry.actionType}-${entry.createdAt}`} style={{ color: "#b7c3cf", fontSize: 13 }}>{formatDate(entry.createdAt)} · {entry.actionType}</div>) : <div style={{ color: "#9fb0bf", fontSize: 13 }}>No company log entries yet.</div>}</div>
            </div></section>
          </>
        ) : (
          <>
            <section className="panel"><div className="panel__header"><h2>Found A Consortium</h2></div><div className="panel__body" style={{ display: "grid", gap: 12 }}><div className="org-form"><input className="org-input" value={consortiumName} onChange={(event) => setConsortiumName(event.target.value)} placeholder="Consortium name" /><select className="org-input" value={selectedTypeKey} onChange={(event) => setSelectedTypeKey(event.target.value)}>{templates.map((template) => <option key={template.key} value={template.key}>{template.displayName} · {template.creationCost.toLocaleString("en-GB")}g</option>)}</select><button type="button" className="org-button" disabled={createDisabled} onClick={() => act(() => createOrganization(serverSessionToken!, { type: "consortium", name: consortiumName.trim(), consortiumTypeKey: selectedType?.key }), (payload) => refreshPlayerCache(payload.playerState))}>Create Consortium</button></div><div style={{ color: "#9fb0bf", fontSize: 13 }}>{selectedType?.description ?? "Template data is still loading."} Founding cost: {foundingCost.toLocaleString("en-GB")} gold.</div></div></section>
            <section className="panel"><div className="panel__header"><h2>Open Companies</h2></div><div className="panel__body" style={{ display: "grid", gap: 12 }}>{directory.length ? directory.map((entry) => <div key={String(entry.internalId)} style={panelStyle}><div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}><strong>{entry.name} [{formatEntityPublicId("consortium", Number(entry.publicId))}]</strong><span style={{ color: "#9fb0bf", fontSize: 12 }}>{entry.consortiumTypeName} · {entry.starRating}?</span></div><div style={{ color: "#b7c3cf", fontSize: 13 }}>{entry.performanceSummary}</div><div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 10 }}>{Object.values((entry.healthMetrics ?? {}) as Record<string, any>).map((metric: any) => <div key={metric.key} style={statCard}><strong>{metric.label}</strong><span>{metric.value}</span></div>)}</div><div style={{ color: "#9fb0bf", fontSize: 12 }}>Director: {entry.director?.displayName ?? "Unknown"} · Employees: {entry.employeeCount} / {entry.employeeCapacity} · Treasury: <TreasuryLine treasury={entry.treasury} /></div><div className="org-form" style={{ margin: 0, gridTemplateColumns: "1fr auto" }}><input className="org-input" value={applyNotes[String(entry.internalId)] ?? ""} onChange={(event) => setApplyNotes((current) => ({ ...current, [String(entry.internalId)]: event.target.value }))} placeholder={entry.viewerHasPendingApplication ? "Application pending" : "Application note (optional)"} disabled={!!entry.viewerHasPendingApplication} /><button type="button" className="org-button" disabled={!!entry.viewerHasPendingApplication} onClick={() => act(() => applyToConsortium(serverSessionToken!, String(entry.internalId), applyNotes[String(entry.internalId)] ?? ""), () => setApplyNotes((current) => ({ ...current, [String(entry.internalId)]: "" })))}>{entry.viewerHasPendingApplication ? "Applied" : "Apply"}</button></div></div>) : <div style={{ color: "#9fb0bf", fontSize: 13 }}>No live consortium companies are available right now.</div>}</div></section>
          </>
        )}
      </div>
    </AppShell>
  );
}
