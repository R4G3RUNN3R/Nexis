import { useEffect, useState } from "react";
import {
  challengeServerDuel,
  getServerArenaCombat,
  getServerDuels,
  getServerItemInventory,
  sparServerArenaOpponent,
  respondServerDuel,
  type ServerArenaCombatPayload,
  type ServerCombatResult,
  type ServerDuelsPayload,
  type ServerInventoryEntry,
} from "../../lib/authApi";
import { useAuth } from "../../state/AuthContext";

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

function CombatResultPanel({ result }: { result: ServerCombatResult | null }) {
  if (!result) return <div style={{ color: "#9fb0bf", fontSize: 13 }}>No server combat resolved yet.</div>;
  const resolvedLabel = result.resolvedAt ? new Date(result.resolvedAt).toLocaleString("en-GB") : "recent fight";
  const reward = (result.reward ?? {}) as { gold?: number; experience?: number; items?: Array<{ itemId: string; label?: string; quantity?: number }> };
  const rewardBits = [
    reward.gold ? `${reward.gold} gold` : null,
    reward.experience ? `${reward.experience} XP` : null,
    ...(reward.items ?? []).map((item) => `${item.label ?? item.itemId} x${item.quantity ?? 1}`),
  ].filter(Boolean);
  return (
    <div style={{ border: "1px solid rgba(255,255,255,0.08)", borderRadius: 8, padding: 10, background: "rgba(7, 13, 20, 0.48)", display: "grid", gap: 8 }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
        <strong>{result.opponent.name}</strong>
        <span style={{ color: result.winner === "player" ? "#8ec8a7" : "#d0ad74", fontSize: 12 }}>{result.outcome}</span>
      </div>
      <div style={{ color: "#9fb0bf", fontSize: 12 }}>Snapshot: {resolvedLabel}. Sidebar bars show current live stats; this card records that fight only.</div>
      <div style={{ color: "#9fb0bf", fontSize: 12 }}>You: {result.player.health}/{result.player.maxHealth} | Opponent: {result.opponentState.health}/{result.opponentState.maxHealth}</div>
      <div style={{ color: "#d8c278", fontSize: 12 }}>Energy spent in this fight: {result.energySpent ?? 0}{typeof result.energyAfter === "number" ? ` | After this fight: ${result.energyAfter}` : ""}</div>
      <div style={{ color: "#8ec8a7", fontSize: 12 }}>Combat XP: +{result.combatXpGained ?? 0}</div>
      <div style={{ color: "#9fb0bf", fontSize: 12 }}>Skills: {result.activeSkills.map((skill) => skill.name).join(" | ") || "Basic pressure"}</div>
      {result.skillEvents.length ? <div style={{ color: "#8ec8a7", fontSize: 12 }}>Skill XP: {result.skillEvents.map((event) => `${String(event.name ?? event.skillId)} +${String(event.xpGained ?? 0)}`).join(" | ")}</div> : null}
      {result.participants?.target ? <div style={{ color: "#9fb0bf", fontSize: 12 }}>Duel opponent also spent {result.participants.target.energySpent ?? 0} energy and gained {result.participants.target.combatXpGained ?? 0} combat XP.</div> : null}
      {rewardBits.length ? <div style={{ color: "#d8c278", fontSize: 12 }}>Rewards: {rewardBits.join(" | ")}</div> : null}
      <div style={{ display: "grid", gap: 5 }}>
        {result.log.slice(0, 8).map((entry, index) => <div key={`${entry.turn}-${index}`} style={{ color: "#b7c3cf", fontSize: 12 }}>{entry.message}</div>)}
      </div>
    </div>
  );
}

export default function ServerCombatBoard() {
  const { activeAccount, authSource, serverSessionToken, refreshServerState } = useAuth();
  const [arena, setArena] = useState<ServerArenaCombatPayload | null>(null);
  const [duels, setDuels] = useState<ServerDuelsPayload | null>(null);
  const [combatItems, setCombatItems] = useState<ServerInventoryEntry[]>([]);
  const [selectedCombatItemId, setSelectedCombatItemId] = useState<string>("");
  const [targetPublicId, setTargetPublicId] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  async function load() {
    if (authSource !== "server" || !serverSessionToken) {
      setArena(null);
      setDuels(null);
      setCombatItems([]);
      setError("Server combat requires a live server session.");
      return;
    }
    setError(null);
    const [arenaResult, duelResult, inventoryResult] = await Promise.all([getServerArenaCombat(serverSessionToken), getServerDuels(serverSessionToken), getServerItemInventory(serverSessionToken)]);
    if (arenaResult.ok) setArena(arenaResult.arena);
    else setError(arenaResult.error);
    if (duelResult.ok) setDuels(duelResult.duels);
    else setError(duelResult.error);
    if (inventoryResult.ok) {
      const usableCombatItems = inventoryResult.inventory.filter((entry) => entry.item?.useEffects?.some((effect) => ["restore_health", "combat_buff"].includes(String(effect.type))));
      setCombatItems(usableCombatItems);
      if (selectedCombatItemId && !usableCombatItems.some((entry) => entry.itemId === selectedCombatItemId)) setSelectedCombatItemId("");
    }
  }

  useEffect(() => {
    void load();
  }, [authSource, serverSessionToken]);

  async function spar(opponentId: string) {
    if (!serverSessionToken) return;
    setBusy(`spar:${opponentId}`);
    setMessage(null);
    setError(null);
    const result = await sparServerArenaOpponent(serverSessionToken, opponentId, selectedCombatItemId || null);
    setBusy(null);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setArena(result.arena);
    setMessage(result.message ?? "Spar resolved.");
    await refreshServerState();
    void load();
  }

  function parseDuelTarget(): { targetPublicId: number | null; error: string | null } {
    const raw = targetPublicId.trim();
    if (!raw) return { targetPublicId: null, error: "Enter a target public ID before challenging." };
    const normalized = raw.toUpperCase().replace(/[^0-9]/g, "");
    if (normalized.length !== 7) return { targetPublicId: null, error: "Use a valid public ID, for example P1000001." };
    const parsed = Number(normalized);
    if (!Number.isInteger(parsed) || parsed <= 0) return { targetPublicId: null, error: "That public ID is not valid." };
    if (activeAccount?.publicId === parsed) return { targetPublicId: null, error: "You cannot challenge yourself. Admirable confidence, wrong form." };
    return { targetPublicId: parsed, error: null };
  }

  function friendlyDuelFailure(errorText: string, code?: string | null) {
    if (code === "DUEL_TARGET_NOT_FOUND") return "Player not found for that public ID.";
    if (code === "DUEL_SELF_TARGET") return "You cannot challenge yourself.";
    if (code === "DUEL_CITY_MISMATCH") return "That player is not eligible: duels are same-city only.";
    if (code === "COMBAT_ENERGY_LOW") return "Not enough energy to start a real duel. You need 25 energy.";
    return errorText || "Duel challenge failed.";
  }

  async function challenge() {
    if (!serverSessionToken) return;
    const parsed = parseDuelTarget();
    if (parsed.error || !parsed.targetPublicId) {
      setMessage(null);
      setError(parsed.error ?? "That public ID is not valid.");
      return;
    }
    setBusy("duel:challenge");
    setError(null);
    setMessage("Sending duel challenge...");
    const result = await challengeServerDuel(serverSessionToken, parsed.targetPublicId);
    setBusy(null);
    if (!result.ok) {
      setMessage(null);
      setError(friendlyDuelFailure(result.error, result.code));
      return;
    }
    setDuels(result.duels);
    setTargetPublicId("");
    setMessage(result.message ?? "Duel challenge sent.");
  }

  async function respond(duelId: string, action: "accept" | "decline") {
    if (!serverSessionToken) return;
    setBusy(`duel:${duelId}:${action}`);
    setError(null);
    setMessage(null);
    const result = await respondServerDuel(serverSessionToken, duelId, action);
    setBusy(null);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setDuels(result.duels);
    setMessage(result.message ?? "Duel updated.");
    await refreshServerState();
    void load();
  }

  return (
    <section className="panel">
      <div className="panel__header"><h2>Live Combat</h2></div>
      <div className="panel__body" style={{ display: "grid", gap: 14 }}>
        {error ? <div style={{ color: "#d98f8f", fontSize: 13 }}>{error}</div> : null}
        {message ? <div style={{ color: "#8ec8a7", fontSize: 13 }}>{message}</div> : null}
        <div style={{ border: "1px solid rgba(255,255,255,0.08)", borderRadius: 8, padding: 10, background: "rgba(7, 13, 20, 0.48)", display: "grid", gap: 6 }}>
          <strong>Combat Item</strong>
          <select
            value={selectedCombatItemId}
            onChange={(event) => setSelectedCombatItemId(event.target.value)}
            style={{ border: "1px solid rgba(255,255,255,0.12)", background: "rgba(0,0,0,0.25)", color: "#f2f2f2", padding: "8px 10px" }}
          >
            <option value="">No item</option>
            {combatItems.map((entry) => (
              <option key={entry.itemId} value={entry.itemId}>{entry.item?.displayName ?? entry.itemId} x{entry.quantity}</option>
            ))}
          </select>
          <div style={{ color: "#9fb0bf", fontSize: 12 }}>One selected healing, ward, or combat trick item may be consumed during the next arena spar.</div>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 10 }}>
          {(arena?.opponents ?? []).map((opponent) => (
            <div key={opponent.id} style={{ border: "1px solid rgba(255,255,255,0.08)", borderRadius: 8, padding: 10, background: "rgba(7, 13, 20, 0.48)", display: "grid", gap: 8 }}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 10 }}><strong>{opponent.name}</strong><span style={{ color: "#d8c278", fontSize: 12 }}>Tier {opponent.tier}</span></div>
              <div style={{ color: "#b7c3cf", fontSize: 13 }}>{opponent.summary}</div>
              <button type="button" disabled={Boolean(busy)} onClick={() => spar(opponent.id)} style={actionStyle(Boolean(busy))}>{busy === `spar:${opponent.id}` ? "Resolving..." : "Spar (25 energy)"}</button>
            </div>
          ))}
        </div>
        <CombatResultPanel result={arena?.lastResult ?? null} />

        <div style={{ border: "1px solid rgba(255,255,255,0.08)", borderRadius: 8, padding: 10, background: "rgba(7, 13, 20, 0.48)", display: "grid", gap: 8 }}>
          <strong>Consensual Duels</strong>
          <div style={{ color: "#9fb0bf", fontSize: 12 }}>Same-city challenges only. No loot loss, no open-world nonsense.</div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <input value={targetPublicId} onChange={(event) => setTargetPublicId(event.target.value)} placeholder="Target public ID" style={{ minWidth: 180, borderRadius: 8, border: "1px solid rgba(255,255,255,0.12)", background: "rgba(0,0,0,0.25)", color: "#f2f2f2", padding: "8px 10px" }} />
            <button type="button" disabled={Boolean(busy)} onClick={challenge} style={actionStyle(Boolean(busy))}>Challenge</button>
          </div>
          {(duels?.incoming ?? []).length ? <strong>Incoming</strong> : null}
          {(duels?.incoming ?? []).map((duel) => (
            <div key={duel.id} style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "center", flexWrap: "wrap", color: "#b7c3cf", fontSize: 13 }}>
              <span>{duel.challenger.name} challenges you in {duel.cityId}</span>
              <span style={{ display: "flex", gap: 8 }}>
                <button type="button" disabled={Boolean(busy)} onClick={() => respond(duel.id, "accept")} style={actionStyle(Boolean(busy))}>Accept (25 energy)</button>
                <button type="button" disabled={Boolean(busy)} onClick={() => respond(duel.id, "decline")} style={actionStyle(Boolean(busy))}>Decline</button>
              </span>
            </div>
          ))}
          {(duels?.outgoing ?? []).length ? <strong>Outgoing</strong> : null}
          {(duels?.outgoing ?? []).map((duel) => <div key={duel.id} style={{ color: "#b7c3cf", fontSize: 13 }}>Waiting on {duel.target.name} in {duel.cityId}</div>)}
          {(duels?.history ?? []).length ? <strong>Recent Duel History</strong> : null}
          {(duels?.history ?? []).slice(0, 4).map((duel) => <div key={duel.id} style={{ color: "#9fb0bf", fontSize: 12 }}>{duel.status}: {duel.winner?.name ? `${duel.winner.name} defeated ${duel.loser?.name}` : `${duel.challenger.name} vs ${duel.target.name}`}</div>)}
        </div>
      </div>
    </section>
  );
}
