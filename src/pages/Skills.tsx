import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { AppShell } from "../components/layout/AppShell";
import { getCodexEntryRoute } from "../data/codexData";
import { ContentPanel } from "../components/layout/ContentPanel";
import {
  adminSetServerSkillMastery,
  adminUnlockAllServerSkills,
  completeServerSkillLearning,
  getServerSkills,
  learnServerSkill,
  slotServerSkill,
  type ServerSkill,
  type ServerSkillsPayload,
} from "../lib/authApi";
import { useAuth } from "../state/AuthContext";

function actionStyle(disabled: boolean) {
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

function formatDuration(ms: number | null | undefined) {
  const value = Math.max(0, Math.floor(Number(ms ?? 0)));
  if (!value) return "Ready";
  const minutes = Math.ceil(value / 60000);
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return rest ? `${hours}h ${rest}m` : `${hours}h`;
}

function combatSummary(skill: ServerSkill) {
  const parts: string[] = [];
  const damage = Number(skill.combat.damageMultiplier ?? 0);
  const accuracy = Number(skill.combat.accuracyBonus ?? 0);
  const crit = Number(skill.combat.critBonus ?? 0);
  const evade = Number(skill.combat.evadeBonus ?? 0);
  const heal = Number(skill.combat.heal ?? 0);
  if (skill.slotType === "active" && damage) parts.push(`x${damage.toFixed(2)} damage`);
  if (accuracy) parts.push(`${accuracy > 0 ? "+" : ""}${accuracy.toFixed(1)} accuracy`);
  if (crit) parts.push(`${crit > 0 ? "+" : ""}${crit.toFixed(1)} crit`);
  if (evade) parts.push(`${evade > 0 ? "+" : ""}${evade.toFixed(1)} evade`);
  if (heal) parts.push(`${heal.toFixed(0)} recovery`);
  return parts.join(" | ") || "Passive utility";
}

function skillStateLabel(skill: ServerSkill) {
  if (skill.learned) return `Learned | Mastery T${skill.masteryTier}`;
  if (skill.learning) return "Learning over time";
  if (skill.canLearn) return "Ready to learn";
  return "Locked";
}

function RareManualPanel({ payload }: { payload: ServerSkillsPayload | null }) {
  const eligibility = payload?.rareManualEligibility;
  if (!eligibility) return null;
  const visibleManuals = eligibility.manuals.slice(0, 8);
  return (
    <ContentPanel title="Rare Manuals">
      <div style={{ display: "grid", gap: 10 }}>
        <div style={{ color: "#b7c3cf", fontSize: 13 }}>{eligibility.rule}</div>
        <div className="info-row"><span className="info-row__label">Current eligibility</span><span className="info-row__value">Level {eligibility.level} | Tier {eligibility.highestEligibleTier || 0}</span></div>
        {eligibility.nextBand ? <div className="info-row"><span className="info-row__label">Next band</span><span className="info-row__value">{eligibility.nextBand.label} at level {eligibility.nextBand.minimumLevel}</span></div> : null}
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          {eligibility.eligibleBands.map((band) => (
            <span key={band.label} title={band.lockReason ?? "Eligible"} style={{ border: "1px solid rgba(255,255,255,0.1)", borderRadius: 999, padding: "4px 8px", color: band.unlocked ? "#8ec8a7" : "#9fb0bf", fontSize: 12 }}>
              {band.label}: {band.unlocked ? "eligible" : `level ${band.minimumLevel}`}
            </span>
          ))}
        </div>
        <div style={{ color: "#9fb0bf", fontSize: 12 }}>Eligibility does not grant a rare skill. Manuals still have to be found through discoveries, hidden sites, boss drops, black markets, academy archives, rumors, expeditions, or the marketplace.</div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(230px, 1fr))", gap: 8 }}>
          {visibleManuals.map((manual) => (
            <div key={manual.id} style={{ border: "1px solid rgba(255,255,255,0.08)", borderRadius: 8, padding: 10, background: manual.eligible ? "rgba(7, 20, 14, 0.45)" : "rgba(22, 17, 17, 0.44)", display: "grid", gap: 5 }}>
              <strong>{manual.name}</strong>
              <span style={{ color: "#d8c278", fontSize: 12 }}>{manual.tierLabel} | {manual.family} | {manual.sourceCity}</span>
              <span style={{ color: manual.eligible ? "#8ec8a7" : "#d0ad74", fontSize: 12 }}>{manual.eligible ? "Eligible to learn if acquired" : manual.lockReason}</span>
              <span style={{ color: "#9fb0bf", fontSize: 12 }}>Sources: {manual.acquisition.slice(0, 3).join(", ")}</span>
            </div>
          ))}
        </div>
        <Link className="inline-route-link" to={getCodexEntryRoute("manual-skills")}>Open Codex manual rules</Link>
      </div>
    </ContentPanel>
  );
}

function SkillCard({
  skill,
  busy,
  isAdmin,
  onLearn,
  onComplete,
  onSlot,
  onAdminUses,
}: {
  skill: ServerSkill;
  busy: boolean;
  isAdmin: boolean;
  onLearn: (skill: ServerSkill) => void;
  onComplete: (skill: ServerSkill) => void;
  onSlot: (skill: ServerSkill) => void;
  onAdminUses: (skill: ServerSkill, uses: number) => void;
}) {
  const remainingMs = skill.learningCompletesAt ? skill.learningCompletesAt - Date.now() : null;
  const nextThreshold = skill.nextTierThreshold ? skill.nextTierThreshold.toLocaleString("en-US") : "Cap";
  return (
    <div style={{ border: "1px solid rgba(255,255,255,0.08)", borderRadius: 8, padding: 12, background: skill.learned ? "rgba(7, 13, 20, 0.55)" : skill.learning ? "rgba(33, 37, 46, 0.55)" : "rgba(35, 29, 29, 0.45)", display: "grid", gap: 9 }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
        <strong>{skill.name}</strong>
        <span style={{ color: skill.learned ? "#8ec8a7" : skill.learning ? "#d8c278" : "#d0ad74", fontSize: 12 }}>{skillStateLabel(skill)}</span>
      </div>
      <div style={{ color: "#d8c278", fontSize: 12 }}>{skill.family} | {skill.slotType} | Form: {skill.currentEvolutionName}</div>
      <div style={{ color: "#b7c3cf", fontSize: 13 }}>{skill.summary}</div>
      <div style={{ color: "#9fb0bf", fontSize: 12 }}>{combatSummary(skill)}</div>

      <div style={{ display: "grid", gap: 4 }}>
        <div className="info-row"><span className="info-row__label">Total valid uses</span><span className="info-row__value">{skill.totalUses.toLocaleString("en-US")}</span></div>
        <div className="info-row"><span className="info-row__label">Next tier</span><span className="info-row__value">{nextThreshold}</span></div>
        <div style={{ height: 8, borderRadius: 999, background: "rgba(255,255,255,0.08)", overflow: "hidden" }}>
          <div style={{ width: `${skill.progressPercent}%`, height: "100%", background: skill.masteryTier >= 10 ? "#8ec8a7" : "#d8c278" }} />
        </div>
        <div style={{ color: "#9fb0bf", fontSize: 12 }}>{skill.nextTierImprovement}</div>
      </div>

      <div style={{ display: "grid", gap: 4 }}>
        <strong style={{ fontSize: 12, color: "#d8c278" }}>Evolution Path</strong>
        <div style={{ color: "#b7c3cf", fontSize: 12 }}>
          {skill.evolutionPath.map((step) => `${step.name}${step.unlockTier ? ` at T${step.unlockTier}` : ""}${step.unlocked ? " learned" : ""}`).join(" -> ")}
        </div>
      </div>

      {skill.learning ? <div style={{ color: "#d8c278", fontSize: 12 }}>Learning completes in {formatDuration(remainingMs)}.</div> : null}
      {!skill.learned && !skill.learning && skill.lockReason ? <div style={{ color: "#d0ad74", fontSize: 12 }}>{skill.lockReason}</div> : null}
      {!skill.learned && !skill.learning ? <div style={{ color: "#9fb0bf", fontSize: 12 }}>Learning cost: {skill.learningCostGold} gold | Time: {formatDuration(skill.learningDurationMs)}</div> : null}

      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        {skill.learned ? <button type="button" disabled={busy} onClick={() => onSlot(skill)} style={actionStyle(busy)}>Slot {skill.slotType}</button> : null}
        {!skill.learned && !skill.learning ? <button type="button" disabled={busy || !skill.canLearn} onClick={() => onLearn(skill)} style={actionStyle(busy || !skill.canLearn)}>{skill.canLearn ? "Start Learning" : "Locked"}</button> : null}
        {skill.learning ? <button type="button" disabled={busy || !skill.canCompleteLearning} onClick={() => onComplete(skill)} style={actionStyle(busy || !skill.canCompleteLearning)}>{skill.canCompleteLearning ? "Complete Learning" : "Still Learning"}</button> : null}
        {isAdmin ? <button type="button" disabled={busy} onClick={() => onAdminUses(skill, 500)} style={actionStyle(busy)}>Admin: 500 uses</button> : null}
        {isAdmin ? <button type="button" disabled={busy} onClick={() => onAdminUses(skill, 100000)} style={actionStyle(busy)}>Admin: Master</button> : null}
      </div>
    </div>
  );
}

export default function SkillsPage() {
  const { authSource, serverSessionToken, refreshServerState } = useAuth();
  const [payload, setPayload] = useState<ServerSkillsPayload | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [openFamily, setOpenFamily] = useState<string | null>(null);
  const isAdmin = Boolean(payload?.adminControlsEnabled);

  async function loadSkills() {
    if (authSource !== "server" || !serverSessionToken) {
      setPayload(null);
      setError("Skills are server-authoritative. Sign in through the live server session to manage them.");
      return;
    }
    setError(null);
    const result = await getServerSkills(serverSessionToken);
    if (!result.ok) {
      setPayload(null);
      setError(result.error);
      return;
    }
    setPayload(result.skills);
  }

  useEffect(() => {
    void loadSkills();
  }, [authSource, serverSessionToken]);

  const byId = useMemo(() => new Map((payload?.skills ?? []).map((skill) => [skill.id, skill])), [payload]);
  const grouped = useMemo(() => {
    const groups = new Map<string, ServerSkill[]>();
    for (const skill of payload?.skills ?? []) groups.set(skill.family, [...(groups.get(skill.family) ?? []), skill]);
    return Array.from(groups.entries());
  }, [payload]);

  async function runSkillAction(action: () => Promise<void>) {
    setBusy(true);
    setMessage(null);
    setError(null);
    try {
      await action();
    } finally {
      setBusy(false);
    }
  }

  function applyResult(result: Awaited<ReturnType<typeof getServerSkills>>) {
    if (!result.ok) {
      setError(result.error);
      return false;
    }
    setPayload(result.skills);
    setMessage(result.message ?? "Skills updated.");
    return true;
  }

  function learnSkill(skill: ServerSkill) {
    if (!serverSessionToken) return;
    void runSkillAction(async () => {
      const result = await learnServerSkill(serverSessionToken, skill.id);
      if (applyResult(result)) await refreshServerState();
    });
  }

  function completeLearning(skill: ServerSkill) {
    if (!serverSessionToken) return;
    void runSkillAction(async () => {
      const result = await completeServerSkillLearning(serverSessionToken, skill.id);
      if (applyResult(result)) await refreshServerState();
    });
  }

  async function slotSkill(skill: ServerSkill) {
    if (!serverSessionToken || !payload) return;
    const slots = skill.slotType === "passive" ? payload.passiveSlots : payload.activeSlots;
    const emptyIndex = slots.findIndex((entry) => !entry);
    const slotIndex = emptyIndex >= 0 ? emptyIndex : 0;
    await runSkillAction(async () => {
      const result = await slotServerSkill(serverSessionToken, skill.slotType, slotIndex, skill.id);
      if (applyResult(result)) await refreshServerState();
    });
  }

  async function clearSlot(slotType: "active" | "passive", slotIndex: number) {
    if (!serverSessionToken) return;
    await runSkillAction(async () => {
      const result = await slotServerSkill(serverSessionToken, slotType, slotIndex, null);
      if (applyResult(result)) setMessage("Skill slot cleared.");
    });
  }

  function adminSetUses(skill: ServerSkill, uses: number) {
    if (!serverSessionToken) return;
    void runSkillAction(async () => {
      const result = await adminSetServerSkillMastery(serverSessionToken, skill.id, uses);
      if (applyResult(result)) await refreshServerState();
    });
  }

  function adminUnlockAll() {
    if (!serverSessionToken) return;
    void runSkillAction(async () => {
      const result = await adminUnlockAllServerSkills(serverSessionToken);
      if (applyResult(result)) await refreshServerState();
    });
  }

  return (
    <AppShell title="Skills" hint="Learn skills deliberately, then master them through valid use in combat, travel encounters, arena, duels, and missions.">
      <div style={{ display: "grid", gap: 14 }}>
        <ContentPanel title="Skill Path">
          <div style={{ color: "#b7c3cf", fontSize: 13, marginBottom: 10 }}>Acquire, learn, slot, and master skills here. Long-form rules live in <Link className="inline-route-link" to={getCodexEntryRoute("manual-skills")}>Codex Manuals</Link>.</div>
        </ContentPanel>

        <RareManualPanel payload={payload} />

        <ContentPanel title="Skill Loadout">
          {error ? <div style={{ color: "#d98f8f", fontSize: 13 }}>{error}</div> : null}
          {message ? <div style={{ color: "#8ec8a7", fontSize: 13 }}>{message}</div> : null}
          {payload ? (
            <div style={{ display: "grid", gap: 12 }}>
              <div className="info-row"><span className="info-row__label">Learned skills</span><span className="info-row__value">{payload.unlockedCount}</span></div>
              <div className="info-row"><span className="info-row__label">Learning now</span><span className="info-row__value">{payload.learningCount}</span></div>
              {isAdmin ? <button type="button" disabled={busy} onClick={adminUnlockAll} style={actionStyle(busy)}>Admin: Unlock all skills instantly</button> : null}
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 10 }}>
                <div style={{ display: "grid", gap: 8 }}>
                  <strong>Active slots</strong>
                  {payload.activeSlots.map((skillId, index) => {
                    const skill = skillId ? byId.get(skillId) : null;
                    return (
                      <div key={`active-${index}`} style={{ border: "1px solid rgba(255,255,255,0.08)", borderRadius: 8, padding: 10, background: "rgba(7, 13, 20, 0.48)", display: "flex", justifyContent: "space-between", gap: 10 }}>
                        <span title={skill ? `${skill.summary} | ${combatSummary(skill)}` : "Active skills are used during real combat turns."}>{index + 1}. {skill?.name ?? "Empty active slot"}{skill ? <small style={{ display: "block", color: "#9fb0bf", fontSize: 11 }}>{combatSummary(skill)}</small> : <small style={{ display: "block", color: "#9fb0bf", fontSize: 11 }}>Used during combat, arena, duels, and mission fights.</small>}</span>
                        {skill ? <button type="button" disabled={busy} onClick={() => clearSlot("active", index)} style={actionStyle(busy)}>Clear</button> : null}
                      </div>
                    );
                  })}
                </div>
                <div style={{ display: "grid", gap: 8 }}>
                  <strong>Passive slots</strong>
                  {payload.passiveSlots.map((skillId, index) => {
                    const skill = skillId ? byId.get(skillId) : null;
                    return (
                      <div key={`passive-${index}`} style={{ border: "1px solid rgba(255,255,255,0.08)", borderRadius: 8, padding: 10, background: "rgba(7, 13, 20, 0.48)", display: "flex", justifyContent: "space-between", gap: 10 }}>
                        <span title={skill ? `${skill.summary} | ${combatSummary(skill)}` : "Passive/support skills modify combat or utility from the background."}>{index + 1}. {skill?.name ?? "Empty passive slot"}{skill ? <small style={{ display: "block", color: "#9fb0bf", fontSize: 11 }}>{combatSummary(skill)}</small> : <small style={{ display: "block", color: "#9fb0bf", fontSize: 11 }}>Support effects apply when slotted and eligible.</small>}</span>
                        {skill ? <button type="button" disabled={busy} onClick={() => clearSlot("passive", index)} style={actionStyle(busy)}>Clear</button> : null}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          ) : null}
        </ContentPanel>

        {grouped.map(([family, skills]) => {
          const learned = skills.filter((skill) => skill.learned).length;
          const learning = skills.filter((skill) => skill.learning).length;
          const topTier = skills.reduce((max, skill) => Math.max(max, skill.masteryTier), 0);
          const open = openFamily === family;
          return (
            <ContentPanel key={family} title={family}>
              <button
                type="button"
                onClick={() => setOpenFamily(open ? null : family)}
                style={{ width: "100%", textAlign: "left", border: "1px solid rgba(255,255,255,0.08)", background: "rgba(7, 13, 20, 0.48)", color: "#d7dee6", borderRadius: 8, padding: 12, display: "grid", gap: 5 }}
              >
                <strong>{open ? "Collapse" : "Expand"} {family}</strong>
                <span style={{ color: "#9fb0bf", fontSize: 13 }}>{learned} learned | {learning} learning | top mastery T{topTier} | {skills.length} skills</span>
              </button>
              {open ? (
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 10, marginTop: 10 }}>
                  {skills.map((skill) => <SkillCard key={skill.id} skill={skill} busy={busy} isAdmin={isAdmin} onLearn={learnSkill} onComplete={completeLearning} onSlot={slotSkill} onAdminUses={adminSetUses} />)}
                </div>
              ) : null}
            </ContentPanel>
          );
        })}
      </div>
    </AppShell>
  );
}
