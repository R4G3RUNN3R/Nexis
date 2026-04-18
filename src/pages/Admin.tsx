import { useEffect, useMemo, useState } from "react";
import { Navigate } from "react-router-dom";
import { AppShell } from "../components/layout/AppShell";
import { ContentPanel } from "../components/layout/ContentPanel";
import { getAdminPlayerDetails, postAdminPlayerAction, searchAdminPlayers, type AdminActionSuccess, type AdminPlayerSummary, type AdminPlayerTarget } from "../lib/adminApi";
import { isAdministrator } from "../lib/adminAccess";
import { ITEM_ENHANCEMENT_OPTIONS, ITEM_OPTIONS } from "../data/itemsData";
import { mergeServerStateIntoCache } from "../lib/runtimeStateCache";
import { useAuth } from "../state/AuthContext";
import { usePlayer } from "../state/PlayerContext";

const PRIVILEGE_OPTIONS = [
  { value: "player", label: "Normal Player" },
  { value: "staff", label: "Staff" },
  { value: "admin", label: "Admin" },
] as const;

function SectionTitle({ children }: { children: React.ReactNode }) {
  return <div style={{ fontSize: 13, textTransform: "uppercase", letterSpacing: "0.08em", color: "#9fb0bf" }}>{children}</div>;
}

export default function AdminPage() {
  const { player } = usePlayer();
  const { activeAccount, authSource, serverSessionToken } = useAuth();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<AdminPlayerSummary[]>([]);
  const [selected, setSelected] = useState<AdminPlayerTarget | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [reason, setReason] = useState("");
  const [battleStats, setBattleStats] = useState({ strength: 10, defense: 10, speed: 10, dexterity: 10 });
  const [workingStats, setWorkingStats] = useState({ manualLabor: 10, intelligence: 10, endurance: 10 });
  const [currencies, setCurrencies] = useState({ copper: 0, silver: 0, gold: 500, platinum: 0 });
  const [jobValue, setJobValue] = useState("");
  const [inventoryItemId, setInventoryItemId] = useState(ITEM_OPTIONS[0]?.itemId ?? "wild_herb");
  const [inventoryQty, setInventoryQty] = useState(1);
  const [enhancementItemId, setEnhancementItemId] = useState(ITEM_OPTIONS[0]?.itemId ?? "wild_herb");
  const [enhancementValue, setEnhancementValue] = useState(ITEM_ENHANCEMENT_OPTIONS[0] ?? "Tempered");
  const [privilegeRole, setPrivilegeRole] = useState<"player" | "staff" | "admin">("player");

  const isAdmin = authSource === "server" && Boolean(serverSessionToken) && isAdministrator(activeAccount ?? player.publicId);

  useEffect(() => {
    if (!selected) return;
    setBattleStats({
      strength: Number(selected.player.battleStats.strength ?? 0),
      defense: Number(selected.player.battleStats.defense ?? 0),
      speed: Number(selected.player.battleStats.speed ?? 0),
      dexterity: Number(selected.player.battleStats.dexterity ?? 0),
    });
    setWorkingStats({
      manualLabor: Number(selected.player.workingStats.manualLabor ?? 0),
      intelligence: Number(selected.player.workingStats.intelligence ?? 0),
      endurance: Number(selected.player.workingStats.endurance ?? 0),
    });
    setCurrencies(selected.player.currencies);
    setJobValue(selected.player.currentJob ?? "");
    setPrivilegeRole(selected.user.privilegeRole);
  }, [selected]);

  const inventoryRows = useMemo(() => Object.entries(selected?.player.inventory ?? {}).sort((left, right) => left[0].localeCompare(right[0])), [selected]);
  const enhancementRows = useMemo(() => Object.entries(selected?.player.itemEnhancements ?? {}).sort((left, right) => left[0].localeCompare(right[0])), [selected]);

  if (!isAdmin) {
    return <Navigate to="/home" replace />;
  }

  async function loadTarget(internalId: string) {
    if (!serverSessionToken) return;
    const result = await getAdminPlayerDetails(serverSessionToken, internalId);
    if ("ok" in result && result.ok === false) {
      setMessage(result.error);
      return;
    }
    setSelected((result as { target: AdminPlayerTarget }).target);
  }

  async function runSearch() {
    if (!serverSessionToken || !query.trim()) return;
    const result = await searchAdminPlayers(serverSessionToken, query.trim());
    if ("ok" in result && result.ok === false) {
      setMessage(result.error);
      return;
    }
    setResults((result as { results: AdminPlayerSummary[] }).results);
  }

  async function runAction(actionType: string, payload: Record<string, unknown>) {
    if (!serverSessionToken || !selected) return;
    const result = await postAdminPlayerAction(serverSessionToken, selected.user.internalId, { actionType, reason, ...payload });
    if ("ok" in result && result.ok === false) {
      setMessage(result.error);
      return;
    }
    const response = result as AdminActionSuccess;
    setSelected(response.target);
    setMessage(`Admin action complete: ${response.audit.actionType}.`);
    if (activeAccount && selected.user.internalId === activeAccount.internalPlayerId) {
      mergeServerStateIntoCache({
        email: activeAccount.email,
        user: {
          internalPlayerId: activeAccount.internalPlayerId,
          publicId: activeAccount.publicId,
          firstName: activeAccount.firstName,
          lastName: activeAccount.lastName,
        },
        playerState: response.playerState,
      });
      window.dispatchEvent(new CustomEvent("nexis:player-refresh"));
    }
  }

  return (
    <AppShell title="Administrator Panel" hint="Server-authoritative player controls only. The audit log still exists, because we are trying to run a game rather than a crime scene.">
      <div style={{ display: "grid", gap: 16 }}>
        {message ? <ContentPanel title="Command Feedback"><strong>{message}</strong></ContentPanel> : null}
        <ContentPanel title="Target Selection">
          <div style={{ display: "grid", gap: 12 }}>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search by name or public ID" style={{ flex: 1, minWidth: 240 }} />
              <button type="button" onClick={runSearch}>Search</button>
              <button type="button" onClick={() => activeAccount && loadTarget(activeAccount.internalPlayerId)}>Select Self</button>
            </div>
            {results.length ? (
              <div style={{ display: "grid", gap: 8 }}>
                {results.map((result) => (
                  <button key={result.internalId} type="button" onClick={() => loadTarget(result.internalId)} style={{ textAlign: "left" }}>
                    {result.displayName} [P{String(result.publicId).padStart(7, "0")}] | {result.entityType} | {result.privilegeRole}
                  </button>
                ))}
              </div>
            ) : null}
          </div>
        </ContentPanel>

        {selected ? (
          <>
            <ContentPanel title={`Target | ${selected.user.displayName} [P${String(selected.user.publicId).padStart(7, "0")}]`}>
              <div style={{ display: "grid", gap: 8 }}>
                <div>Level {selected.player.level} | XP {selected.player.experience}</div>
                <div>Current job: {selected.player.currentJob ?? "None"}</div>
                <div>Condition: {selected.player.condition.type}</div>
                <div>Identity classification: <strong>{selected.user.entityType}</strong></div>
                <div>Privilege role: <strong>{selected.user.privilegeRole}</strong></div>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 8 }}>
                  <button type="button" onClick={() => runAction("fillEnergy", {})}>Fill Energy</button>
                  <button type="button" onClick={() => runAction("fillStamina", {})}>Fill Stamina</button>
                  <button type="button" onClick={() => runAction("fillHealth", {})}>Fill Health</button>
                  <button type="button" onClick={() => runAction("fillComfort", {})}>Fill Comfort</button>
                  <button type="button" onClick={() => runAction("fillAllBars", {})}>Fill All Bars</button>
                </div>
              </div>
            </ContentPanel>

            <ContentPanel title="Audit Reason">
              <input value={reason} onChange={(event) => setReason(event.target.value)} placeholder="Required reason for admin actions" style={{ width: "100%" }} />
            </ContentPanel>

            <ContentPanel title="Account Role Control">
              <div style={{ display: "grid", gap: 12 }}>
                <div style={{ color: "#9fb0bf", fontSize: 13 }}>
                  NPC or system identity classification is separate from account privilege role. Changing the role below does not rewrite the target's reserved identity.
                </div>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
                  <select value={privilegeRole} onChange={(event) => setPrivilegeRole(event.target.value as "player" | "staff" | "admin") }>
                    {PRIVILEGE_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                  </select>
                  <button type="button" onClick={() => runAction("setAccountPrivilegeRole", { privilegeRole })}>Apply Account Role</button>
                </div>
              </div>
            </ContentPanel>

            <ContentPanel title="Stats and Currency Controls">
              <div style={{ display: "grid", gap: 14 }}>
                <SectionTitle>Battle Stats</SectionTitle>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 8 }}>
                  {Object.entries(battleStats).map(([key, value]) => (
                    <label key={key} style={{ display: "grid", gap: 4 }}>
                      <span>{key}</span>
                      <input type="number" value={value} min={0} onChange={(event) => setBattleStats((current) => ({ ...current, [key]: Number(event.target.value) }))} />
                    </label>
                  ))}
                </div>
                <button type="button" onClick={() => runAction("setBattleStats", { battleStats })}>Apply Battle Stats</button>

                <SectionTitle>Working Stats</SectionTitle>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 8 }}>
                  {Object.entries(workingStats).map(([key, value]) => (
                    <label key={key} style={{ display: "grid", gap: 4 }}>
                      <span>{key}</span>
                      <input type="number" value={value} min={0} onChange={(event) => setWorkingStats((current) => ({ ...current, [key]: Number(event.target.value) }))} />
                    </label>
                  ))}
                </div>
                <button type="button" onClick={() => runAction("setWorkingStats", { workingStats })}>Apply Working Stats</button>

                <SectionTitle>Currencies</SectionTitle>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 8 }}>
                  {Object.entries(currencies).map(([key, value]) => (
                    <label key={key} style={{ display: "grid", gap: 4 }}>
                      <span>{key}</span>
                      <input type="number" value={value} min={0} onChange={(event) => setCurrencies((current) => ({ ...current, [key]: Number(event.target.value) }))} />
                    </label>
                  ))}
                </div>
                <button type="button" onClick={() => runAction("setCurrencies", { currencies })}>Apply Currency Values</button>

                <SectionTitle>Player Job</SectionTitle>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  <input value={jobValue} onChange={(event) => setJobValue(event.target.value)} placeholder="Assign or clear current job" style={{ flex: 1, minWidth: 240 }} />
                  <button type="button" onClick={() => runAction("setPlayerJob", { job: jobValue })}>Assign / Change</button>
                  <button type="button" onClick={() => runAction("setPlayerJob", { job: null })}>Remove Job</button>
                </div>
              </div>
            </ContentPanel>

            <ContentPanel title="Inventory and Enhancements">
              <div style={{ display: "grid", gap: 14 }}>
                <SectionTitle>Inventory</SectionTitle>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  <select value={inventoryItemId} onChange={(event) => setInventoryItemId(event.target.value)}>
                    {ITEM_OPTIONS.map((item) => <option key={item.itemId} value={item.itemId}>{item.name}</option>)}
                  </select>
                  <input type="number" value={inventoryQty} min={1} onChange={(event) => setInventoryQty(Number(event.target.value))} style={{ width: 120 }} />
                  <button type="button" onClick={() => runAction("addInventoryItem", { itemId: inventoryItemId, quantity: inventoryQty })}>Add Item</button>
                  <button type="button" onClick={() => runAction("removeInventoryItem", { itemId: inventoryItemId, quantity: inventoryQty })}>Remove Item</button>
                </div>
                <div style={{ display: "grid", gap: 6 }}>
                  {inventoryRows.length ? inventoryRows.map(([itemId, quantity]) => <div key={itemId}>{itemId}: x{quantity}</div>) : <div>No inventory recorded.</div>}
                </div>

                <SectionTitle>Item Enhancements</SectionTitle>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  <select value={enhancementItemId} onChange={(event) => setEnhancementItemId(event.target.value)}>
                    {ITEM_OPTIONS.map((item) => <option key={item.itemId} value={item.itemId}>{item.name}</option>)}
                  </select>
                  <select value={enhancementValue} onChange={(event) => setEnhancementValue(event.target.value)}>
                    {ITEM_ENHANCEMENT_OPTIONS.map((option) => <option key={option} value={option}>{option}</option>)}
                  </select>
                  <button type="button" onClick={() => runAction("addItemEnhancement", { itemId: enhancementItemId, enhancement: enhancementValue })}>Add Enhancement</button>
                  <button type="button" onClick={() => runAction("removeItemEnhancement", { itemId: enhancementItemId, enhancement: enhancementValue })}>Remove Enhancement</button>
                </div>
                <div style={{ display: "grid", gap: 6 }}>
                  {enhancementRows.length ? enhancementRows.map(([itemId, enhancements]) => <div key={itemId}>{itemId}: {(enhancements as string[]).join(", ")}</div>) : <div>No enhancements recorded.</div>}
                </div>
              </div>
            </ContentPanel>

            <ContentPanel title="Organization Controls">
              <div style={{ color: "#9fb0bf", fontSize: 13 }}>Future section: guild and consortium administration will sit here once the shared organization core has more than founder/member scaffolding.</div>
            </ContentPanel>
          </>
        ) : null}
      </div>
    </AppShell>
  );
}
