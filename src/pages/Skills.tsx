import { useEffect, useMemo, useState } from "react";
import { AppShell } from "../components/layout/AppShell";
import { ContentPanel } from "../components/layout/ContentPanel";
import { getServerSkills, slotServerSkill, type ServerSkill, type ServerSkillsPayload } from "../lib/authApi";
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

function combatSummary(skill: ServerSkill) {
  const parts: string[] = [];
  const damage = Number(skill.combat.damageMultiplier ?? 0);
  const accuracy = Number(skill.combat.accuracyBonus ?? 0);
  const crit = Number(skill.combat.critBonus ?? 0);
  const evade = Number(skill.combat.evadeBonus ?? 0);
  const heal = Number(skill.combat.heal ?? 0);
  if (skill.slotType === "active" && damage) parts.push(`x${damage.toFixed(2)} damage`);
  if (accuracy) parts.push(`${accuracy > 0 ? "+" : ""}${accuracy} accuracy`);
  if (crit) parts.push(`${crit > 0 ? "+" : ""}${crit} crit`);
  if (evade) parts.push(`${evade > 0 ? "+" : ""}${evade} evade`);
  if (heal) parts.push(`${heal} recovery`);
  return parts.join(" | ") || "Passive utility";
}

function SkillCard({ skill, onSlot, busy }: { skill: ServerSkill; onSlot: (skill: ServerSkill) => void; busy: boolean }) {
  const disabled = busy || !skill.unlocked;
  return (
    <div style={{ border: "1px solid rgba(255,255,255,0.08)", borderRadius: 8, padding: 12, background: skill.unlocked ? "rgba(7, 13, 20, 0.55)" : "rgba(35, 29, 29, 0.45)", display: "grid", gap: 8 }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
        <strong>{skill.name}</strong>
        <span style={{ color: skill.unlocked ? "#8ec8a7" : "#d0ad74", fontSize: 12 }}>{skill.unlocked ? `Tier ${skill.tier}` : "Locked"}</span>
      </div>
      <div style={{ color: "#d8c278", fontSize: 12 }}>{skill.family} | {skill.slotType}</div>
      <div style={{ color: "#b7c3cf", fontSize: 13 }}>{skill.summary}</div>
      <div style={{ color: "#9fb0bf", fontSize: 12 }}>{combatSummary(skill)}</div>
      {skill.xpToEvolve ? (
        <div style={{ display: "grid", gap: 4 }}>
          <div className="info-row"><span className="info-row__label">Skill XP</span><span className="info-row__value">{skill.xp} / {skill.xpToEvolve}</span></div>
          <div style={{ height: 8, borderRadius: 999, background: "rgba(255,255,255,0.08)", overflow: "hidden" }}>
            <div style={{ width: `${skill.progressPercent}%`, height: "100%", background: "#d8c278" }} />
          </div>
          <div style={{ color: skill.evolvedTo ? "#8ec8a7" : "#9fb0bf", fontSize: 12 }}>{skill.evolvedTo ? `Evolved into ${skill.evolvedTo}` : `Evolves into ${skill.evolvesTo}`}</div>
        </div>
      ) : null}
      {!skill.unlocked && skill.lockReason ? <div style={{ color: "#d0ad74", fontSize: 12 }}>{skill.lockReason}</div> : null}
      <button type="button" disabled={disabled} onClick={() => onSlot(skill)} style={actionStyle(disabled)}>
        Slot {skill.slotType}
      </button>
    </div>
  );
}

export default function SkillsPage() {
  const { authSource, serverSessionToken, refreshServerState } = useAuth();
  const [payload, setPayload] = useState<ServerSkillsPayload | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

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
    for (const skill of payload?.skills ?? []) {
      groups.set(skill.family, [...(groups.get(skill.family) ?? []), skill]);
    }
    return Array.from(groups.entries());
  }, [payload]);

  async function slotSkill(skill: ServerSkill) {
    if (!serverSessionToken || !payload) return;
    const slots = skill.slotType === "passive" ? payload.passiveSlots : payload.activeSlots;
    const emptyIndex = slots.findIndex((entry) => !entry);
    const slotIndex = emptyIndex >= 0 ? emptyIndex : 0;
    setBusy(true);
    setMessage(null);
    setError(null);
    const result = await slotServerSkill(serverSessionToken, skill.slotType, slotIndex, skill.id);
    setBusy(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setPayload(result.skills);
    setMessage(result.message ?? `${skill.name} slotted.`);
    await refreshServerState();
  }

  async function clearSlot(slotType: "active" | "passive", slotIndex: number) {
    if (!serverSessionToken) return;
    setBusy(true);
    const result = await slotServerSkill(serverSessionToken, slotType, slotIndex, null);
    setBusy(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setPayload(result.skills);
    setMessage("Skill slot cleared.");
  }

  return (
    <AppShell title="Skills" hint="Practice actions, slot combat tools, and evolve them by actually using them. Shocking, I know.">
      <div style={{ display: "grid", gap: 14 }}>
        <ContentPanel title="Skill Loadout">
          {error ? <div style={{ color: "#d98f8f", fontSize: 13 }}>{error}</div> : null}
          {message ? <div style={{ color: "#8ec8a7", fontSize: 13 }}>{message}</div> : null}
          {payload ? (
            <div style={{ display: "grid", gap: 12 }}>
              <div className="info-row"><span className="info-row__label">Unlocked skills</span><span className="info-row__value">{payload.unlockedCount}</span></div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 10 }}>
                <div style={{ display: "grid", gap: 8 }}>
                  <strong>Active slots</strong>
                  {payload.activeSlots.map((skillId, index) => {
                    const skill = skillId ? byId.get(skillId) : null;
                    return (
                      <div key={`active-${index}`} style={{ border: "1px solid rgba(255,255,255,0.08)", borderRadius: 8, padding: 10, background: "rgba(7, 13, 20, 0.48)", display: "flex", justifyContent: "space-between", gap: 10 }}>
                        <span>{index + 1}. {skill?.name ?? "Empty active slot"}</span>
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
                        <span>{index + 1}. {skill?.name ?? "Empty passive slot"}</span>
                        {skill ? <button type="button" disabled={busy} onClick={() => clearSlot("passive", index)} style={actionStyle(busy)}>Clear</button> : null}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          ) : null}
        </ContentPanel>

        {grouped.map(([family, skills]) => (
          <ContentPanel key={family} title={family}>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: 10 }}>
              {skills.map((skill) => <SkillCard key={skill.id} skill={skill} busy={busy} onSlot={slotSkill} />)}
            </div>
          </ContentPanel>
        ))}
      </div>
    </AppShell>
  );
}
