import { useEffect, useMemo, useState } from "react";
import { Navigate } from "react-router-dom";
import { AppShell } from "../components/layout/AppShell";
import { ContentPanel } from "../components/layout/ContentPanel";
import {
  getAdminPlayerDetails,
  postAdminPlayerAction,
  searchAdminPlayers,
  type AdminActionSuccess,
  type AdminPlayerSummary,
  type AdminPlayerTarget,
} from "../lib/adminApi";
import { ADMIN_ACTION_POLICIES } from "../lib/adminActionPolicy";
import { isAdministrator, isStaffOrAdmin } from "../lib/adminAccess";
import { ITEM_ENHANCEMENT_OPTIONS, ITEM_OPTIONS } from "../data/itemsData";
import { mergeServerStateIntoCache } from "../lib/runtimeStateCache";
import { useAuth } from "../state/AuthContext";
import { usePlayer } from "../state/PlayerContext";

const PRIVILEGE_OPTIONS = [
  { value: "player", label: "Normal Player" },
  { value: "staff", label: "Staff" },
  { value: "admin", label: "Admin" },
] as const;

const ADMIN_CURRENCY_CAP = 100_000_000;
const ADMIN_ITEM_QUANTITY_CAP = 10_000;

function findWholeNumberRangeError(value: number, label: string, min: number, max: number) {
  if (!Number.isInteger(value)) return `${label} must be a whole number.`;
  if (value < min) return `${label} must be at least ${min}.`;
  if (value > max) return `${label} cannot exceed ${max.toLocaleString("en-GB")}.`;
  return null;
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return <div style={{ fontSize: 13, textTransform: "uppercase", letterSpacing: "0.08em", color: "#9fb0bf" }}>{children}</div>;
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function DossierBlock({ title, children }: { title: string; children: React.ReactNode }) {
  return <details style={{ border: "1px solid rgba(255,255,255,0.08)", borderRadius: 8, padding: 10, background: "rgba(7,13,20,0.35)" }}><summary style={{ cursor: "pointer", color: "#d8c278", fontWeight: 800 }}>{title}</summary><div style={{ marginTop: 10, display: "grid", gap: 8 }}>{children}</div></details>;
}

function DossierJson({ value }: { value: unknown }) {
  return <pre style={{ margin: 0, whiteSpace: "pre-wrap", maxHeight: 260, overflow: "auto", fontSize: 12, color: "#b7c3cf" }}>{JSON.stringify(value ?? {}, null, 2)}</pre>;
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
  const [xpGrant, setXpGrant] = useState(50);
  const [absoluteInventoryQty, setAbsoluteInventoryQty] = useState(1);
  const [equipmentSlot, setEquipmentSlot] = useState("weapon");
  const [skillId, setSkillId] = useState("quick_strike");
  const [skillUseCount, setSkillUseCount] = useState(50);
  const [skillSlotType, setSkillSlotType] = useState<"active" | "passive">("active");
  const [skillSlotIndex, setSkillSlotIndex] = useState(0);
  const [courseId, setCourseId] = useState("basic-literacy");
  const [academyId, setAcademyId] = useState("hall-of-letters");
  const [academyStageId, setAcademyStageId] = useState("foundation");
  const [cityId, setCityId] = useState("nexis");
  const [cityStandingValue, setCityStandingValue] = useState(0);
  const [contractId, setContractId] = useState("");

  const canAccessAdmin = authSource === "server"
    && Boolean(serverSessionToken)
    && isStaffOrAdmin({
      publicId: activeAccount?.publicId ?? player.publicId,
      privilegeRole: activeAccount?.privilegeRole ?? "player",
    });
  const canManageRoles = authSource === "server"
    && Boolean(serverSessionToken)
    && isAdministrator({
      publicId: activeAccount?.publicId ?? player.publicId,
      privilegeRole: activeAccount?.privilegeRole ?? "player",
    });
  const canUseSensitiveMutations = canManageRoles;
  const invalidCurrencyEntry = Object.entries(currencies).find(([, value]) => findWholeNumberRangeError(value, "Currency value", 0, ADMIN_CURRENCY_CAP));
  const currencyValidationError = invalidCurrencyEntry
    ? findWholeNumberRangeError(invalidCurrencyEntry[1], `${invalidCurrencyEntry[0]} currency`, 0, ADMIN_CURRENCY_CAP)
    : null;
  const inventoryQuantityValidationError = findWholeNumberRangeError(inventoryQty, "Inventory quantity", 1, ADMIN_ITEM_QUANTITY_CAP);

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

  const dossier = asRecord(selected?.dossier);
  const dossierSummary = asRecord(dossier.summary);
  const dossierInventory = asArray(dossier.inventory);
  const dossierRecords = asArray(asRecord(dossier.records).entries ?? dossier.records).slice(0, 30);
  const inventoryRows = useMemo(
    () => Object.entries(selected?.player.inventory ?? {}).sort((left, right) => left[0].localeCompare(right[0])),
    [selected],
  );
  const enhancementRows = useMemo(
    () => Object.entries(selected?.player.itemEnhancements ?? {}).sort((left, right) => left[0].localeCompare(right[0])),
    [selected],
  );

  if (!canAccessAdmin) {
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
    if (actionType === "setCurrencies" && currencyValidationError) {
      setMessage(currencyValidationError);
      return;
    }
    if ((actionType === "addInventoryItem" || actionType === "removeInventoryItem") && inventoryQuantityValidationError) {
      setMessage(inventoryQuantityValidationError);
      return;
    }
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
                  <button type="button" onClick={() => runAction("fillEnergy", {})}>{ADMIN_ACTION_POLICIES.fillEnergy.label}</button>
                  <button type="button" onClick={() => runAction("fillStamina", {})}>{ADMIN_ACTION_POLICIES.fillStamina.label}</button>
                  <button type="button" onClick={() => runAction("fillHealth", {})}>{ADMIN_ACTION_POLICIES.fillHealth.label}</button>
                  <button type="button" onClick={() => runAction("fillComfort", {})}>{ADMIN_ACTION_POLICIES.fillComfort.label}</button>
                  <button type="button" onClick={() => runAction("fillAllBars", {})}>{ADMIN_ACTION_POLICIES.fillAllBars.label}</button>
                </div>
                <div style={{ color: "#9fb0bf", fontSize: 13 }}>
                  Staff-safe support actions: bar recovery only. Progression, economy, gear, and role mutations are restricted below.
                </div>
              </div>
            </ContentPanel>

            <ContentPanel title="Audit Reason">
              <input value={reason} onChange={(event) => setReason(event.target.value)} placeholder="Required reason for admin actions" style={{ width: "100%" }} />
            </ContentPanel>

            <ContentPanel title="Staff Dossier">
              <div style={{ display: "grid", gap: 10 }}>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 8 }}>
                  <div>Location: <strong>{String(dossierSummary.location ?? "unknown")}</strong></div>
                  <div>Travel: <strong>{String(asRecord(dossierSummary.travel).status ?? "idle")}</strong></div>
                  <div>Education: <strong>{asRecord(dossierSummary.activeEducation).courseId ? String(asRecord(dossierSummary.activeEducation).courseId) : "none"}</strong></div>
                  <div>Academy: <strong>{asRecord(dossierSummary.activeAcademy).academyId ? String(asRecord(dossierSummary.activeAcademy).academyId) : "none"}</strong></div>
                </div>
                <DossierBlock title="Inventory"><div style={{ display: "grid", gap: 5 }}>{dossierInventory.length ? dossierInventory.slice(0, 24).map((entry, index) => { const record = asRecord(entry); const item = asRecord(record.item); return <div key={`${record.itemId ?? index}`}>{String(item.displayName ?? record.itemId)}: x{String(record.quantity ?? 0)}</div>; }) : <div>No inventory recorded.</div>}</div></DossierBlock>
                <DossierBlock title="Equipped Items / Loadouts"><DossierJson value={{ equipment: dossier.equipment, loadouts: dossier.loadouts, maintenance: dossier.equipmentMaintenance }} /></DossierBlock>
                <DossierBlock title="Skills"><DossierJson value={dossier.skills} /></DossierBlock>
                <DossierBlock title="Education"><DossierJson value={dossier.education} /></DossierBlock>
                <DossierBlock title="Academy"><DossierJson value={dossier.academy} /></DossierBlock>
                <DossierBlock title="Contracts / Travel / Discovery"><DossierJson value={dossier.contractsTravelDiscovery} /></DossierBlock>
                <DossierBlock title="Organizations"><DossierJson value={dossier.organizations} /></DossierBlock>
                <DossierBlock title="Rare Manual Eligibility"><DossierJson value={dossier.rareManualEligibility} /></DossierBlock>
                <DossierBlock title="Records / Audit Trail"><div style={{ display: "grid", gap: 6 }}>{dossierRecords.length ? dossierRecords.map((entry, index) => { const record = asRecord(entry); return <div key={`${record.id ?? index}`}>{String(record.category ?? "record")}: {String(record.summary ?? "Account record")}</div>; }) : <div>No player records yet.</div>}</div></DossierBlock>
              </div>
            </ContentPanel>

            <ContentPanel title="Account Role Control">
              <div style={{ display: "grid", gap: 12 }}>
                <div style={{ color: "#9fb0bf", fontSize: 13 }}>
                  NPC or system identity classification is separate from account privilege role. Changing the role below does not rewrite the target&apos;s reserved identity.
                </div>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
                  <select value={privilegeRole} onChange={(event) => setPrivilegeRole(event.target.value as "player" | "staff" | "admin")} disabled={!canManageRoles}>
                    {PRIVILEGE_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                  </select>
                  <button type="button" onClick={() => runAction("setAccountPrivilegeRole", { privilegeRole })} disabled={!canManageRoles}>
                    Apply Account Role
                  </button>
                </div>
                <div style={{ color: canManageRoles ? "#9fb0bf" : "#d98f8f", fontSize: 13 }}>
                  {canManageRoles ? "Administrator-level privilege change control enabled." : "Role changes are administrator-only, because letting staff mint more staff is how you accidentally breed a coup."}
                </div>
              </div>
            </ContentPanel>

            {canUseSensitiveMutations ? (
              <>
                <ContentPanel title="Dossier Management Actions">
                  <div style={{ display: "grid", gap: 14 }}>
                    <SectionTitle>Progression</SectionTitle>
                    <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}><input type="number" value={xpGrant} min={1} onChange={(event) => setXpGrant(Number(event.target.value))} /><button type="button" onClick={() => runAction("grantExperience", { amount: xpGrant })}>{ADMIN_ACTION_POLICIES.grantExperience.label}</button></div>
                    <SectionTitle>Inventory / Equipment</SectionTitle>
                    <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}><select value={inventoryItemId} onChange={(event) => setInventoryItemId(event.target.value)}>{ITEM_OPTIONS.map((item) => <option key={item.itemId} value={item.itemId}>{item.name}</option>)}</select><input type="number" value={absoluteInventoryQty} min={0} onChange={(event) => setAbsoluteInventoryQty(Number(event.target.value))} /><button type="button" onClick={() => runAction("setInventoryItemQuantity", { itemId: inventoryItemId, quantity: absoluteInventoryQty })}>{ADMIN_ACTION_POLICIES.setInventoryItemQuantity.label}</button><input value={equipmentSlot} onChange={(event) => setEquipmentSlot(event.target.value)} placeholder="equipment slot" /><button type="button" onClick={() => runAction("clearEquipmentSlot", { slot: equipmentSlot })}>{ADMIN_ACTION_POLICIES.clearEquipmentSlot.label}</button></div>
                    <SectionTitle>Skills</SectionTitle>
                    <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}><input value={skillId} onChange={(event) => setSkillId(event.target.value)} placeholder="skill id" /><button type="button" onClick={() => runAction("unlockSkill", { skillId })}>Unlock</button><button type="button" onClick={() => runAction("instantLearnSkill", { skillId })}>Instant Learn</button><button type="button" onClick={() => runAction("revokeSkill", { skillId })}>Revoke</button><input type="number" value={skillUseCount} min={0} onChange={(event) => setSkillUseCount(Number(event.target.value))} /><button type="button" onClick={() => runAction("setSkillUseCount", { skillId, uses: skillUseCount })}>Set Uses</button><select value={skillSlotType} onChange={(event) => setSkillSlotType(event.target.value as "active" | "passive")}><option value="active">active</option><option value="passive">passive</option></select><input type="number" value={skillSlotIndex} min={0} max={7} onChange={(event) => setSkillSlotIndex(Number(event.target.value))} /><button type="button" onClick={() => runAction("slotSkill", { skillId, slotType: skillSlotType, slotIndex: skillSlotIndex })}>Slot</button></div>
                    <SectionTitle>Education / Academy</SectionTitle>
                    <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}><input value={courseId} onChange={(event) => setCourseId(event.target.value)} placeholder="course id" /><button type="button" onClick={() => runAction("grantEducationCompletion", { courseId })}>Grant Course</button><button type="button" onClick={() => runAction("revokeEducationCompletion", { courseId })}>Revoke Course</button><button type="button" onClick={() => runAction("cancelEducation", {})}>Cancel Education</button><input value={academyId} onChange={(event) => setAcademyId(event.target.value)} placeholder="academy id" /><input value={academyStageId} onChange={(event) => setAcademyStageId(event.target.value)} placeholder="stage id" /><button type="button" onClick={() => runAction("completeAcademyStage", { academyId, stageId: academyStageId })}>Complete Stage</button><button type="button" onClick={() => runAction("resetAcademy", { academyId })}>Reset Academy</button></div>
                    <SectionTitle>Travel / City / Contracts</SectionTitle>
                    <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}><input value={cityId} onChange={(event) => setCityId(event.target.value)} placeholder="city id" /><button type="button" onClick={() => runAction("clearTravelState", { currentCityId: cityId })}>Clear Travel To City</button><input type="number" value={cityStandingValue} min={0} max={1000} onChange={(event) => setCityStandingValue(Number(event.target.value))} /><button type="button" onClick={() => runAction("setCityStanding", { cityId, value: cityStandingValue })}>Set Standing</button><input value={contractId} onChange={(event) => setContractId(event.target.value)} placeholder="contract id or blank" /><button type="button" onClick={() => runAction("clearContractState", { contractId: contractId || null })}>Clear Contract State</button></div>
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
                    <button type="button" onClick={() => runAction("setBattleStats", { battleStats })}>{ADMIN_ACTION_POLICIES.setBattleStats.label}</button>

                    <SectionTitle>Working Stats</SectionTitle>
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 8 }}>
                      {Object.entries(workingStats).map(([key, value]) => (
                        <label key={key} style={{ display: "grid", gap: 4 }}>
                          <span>{key}</span>
                          <input type="number" value={value} min={0} onChange={(event) => setWorkingStats((current) => ({ ...current, [key]: Number(event.target.value) }))} />
                        </label>
                      ))}
                    </div>
                    <button type="button" onClick={() => runAction("setWorkingStats", { workingStats })}>{ADMIN_ACTION_POLICIES.setWorkingStats.label}</button>

                    <SectionTitle>Currencies</SectionTitle>
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 8 }}>
                      {Object.entries(currencies).map(([key, value]) => (
                        <label key={key} style={{ display: "grid", gap: 4 }}>
                          <span>{key}</span>
                          <input type="number" value={value} min={0} max={ADMIN_CURRENCY_CAP} step={1} onChange={(event) => setCurrencies((current) => ({ ...current, [key]: Number(event.target.value) }))} />
                        </label>
                      ))}
                    </div>
                    <button type="button" onClick={() => runAction("setCurrencies", { currencies })} disabled={Boolean(currencyValidationError)}>{ADMIN_ACTION_POLICIES.setCurrencies.label}</button>
                    {currencyValidationError ? <div style={{ color: "#d98f8f", fontSize: 13 }}>{currencyValidationError}</div> : null}

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
                      <input type="number" value={inventoryQty} min={1} max={ADMIN_ITEM_QUANTITY_CAP} step={1} onChange={(event) => setInventoryQty(Number(event.target.value))} style={{ width: 120 }} />
                      <button type="button" onClick={() => runAction("addInventoryItem", { itemId: inventoryItemId, quantity: inventoryQty })} disabled={Boolean(inventoryQuantityValidationError)}>Add Item</button>
                      <button type="button" onClick={() => runAction("removeInventoryItem", { itemId: inventoryItemId, quantity: inventoryQty })} disabled={Boolean(inventoryQuantityValidationError)}>Remove Item</button>
                      {inventoryQuantityValidationError ? <div style={{ color: "#d98f8f", fontSize: 13, flexBasis: "100%" }}>{inventoryQuantityValidationError}</div> : null}
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
                      {enhancementRows.length ? enhancementRows.map(([itemId, enhancements]) => <div key={itemId}>{itemId}: {enhancements.join(", ")}</div>) : <div>No enhancements recorded.</div>}
                    </div>
                  </div>
                </ContentPanel>
              </>
            ) : (
              <ContentPanel title="Restricted Mutations">
                <div style={{ color: "#d7dee6", display: "grid", gap: 8 }}>
                  <div>Staff can search accounts, inspect target details, and perform support recovery actions.</div>
                  <div>Stat edits, currency edits, job edits, inventory or gear changes, and account-role changes are administrator-only.</div>
                </div>
              </ContentPanel>
            )}

            <ContentPanel title="Organization Controls">
              <div style={{ color: "#9fb0bf", fontSize: 13, display: "grid", gap: 6 }}>
                <div>Guild and Consortium state is now inspectable in the dossier above.</div>
                <div>Use city standing and stuck-state controls for bounded support; membership promotion/removal remains governed by the organization pages until deeper staff tooling is needed.</div>
              </div>
            </ContentPanel>
          </>
        ) : null}
      </div>
    </AppShell>
  );
}
