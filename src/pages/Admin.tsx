import { useEffect, useMemo, useState } from "react";
import { Navigate } from "react-router-dom";
import { AppShell } from "../components/layout/AppShell";
import { ContentPanel } from "../components/layout/ContentPanel";
import {
  getAdminAuditLog,
  getAdminPlayerDetails,
  postAdminOneShotTokenGrant,
  postAdminPlayerAction,
  reassignOrganizationLeadership,
  searchAdminPlayers,
  type AdminActionSuccess,
  type AdminAuditLogEntry,
  type AdminOneShotTokenGrantResult,
  type AdminOneShotTokenType,
  type AdminOrganizationLeadershipResult,
  type AdminPlayerSummary,
  type AdminPlayerTarget,
} from "../lib/adminApi";
import { getOrganizationByPublicId } from "../lib/organizationApi";
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

const RESOURCE_STAT_OPTIONS = [
  { value: "energy", label: "Energy" },
  { value: "stamina", label: "Stamina" },
  { value: "health", label: "Health" },
  { value: "comfort", label: "Comfort" },
  { value: "nerve", label: "Nerve" },
] as const;

const CURRENCY_OPTIONS = ["copper", "silver", "gold", "platinum"] as const;

const ADMIN_TABS = [
  { key: "overview", label: "Overview" },
  { key: "resources", label: "Resources" },
  { key: "stats", label: "Stats" },
  { key: "inventory", label: "Inventory" },
  { key: "conditions", label: "Conditions" },
  { key: "education", label: "Education" },
  { key: "travel", label: "Travel" },
  { key: "organizations", label: "Organizations" },
  { key: "records", label: "Records" },
  { key: "adminLogs", label: "Admin Logs" },
] as const;
type AdminTabKey = (typeof ADMIN_TABS)[number]["key"];

const ADMIN_CURRENCY_CAP = 100_000_000;
const ADMIN_ITEM_QUANTITY_CAP = 10_000;
const ADMIN_ONE_SHOT_TOKEN_GRANT_CAP = 20;

const ONE_SHOT_TOKEN_TYPE_LABELS: Record<AdminOneShotTokenType, string> = {
  tradeable: "Tradeable",
  donor: "Donor",
};

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

function AuditLogRow({ entry }: { entry: AdminAuditLogEntry }) {
  const actorLabel = entry.actorDisplayName ?? `P${String(entry.actorPublicId).padStart(7, "0")}`;
  const targetLabel = entry.targetDisplayName ?? `P${String(entry.targetPublicId).padStart(7, "0")}`;
  return (
    <details style={{ border: "1px solid rgba(255,255,255,0.08)", borderRadius: 6, padding: 8, background: "rgba(7,13,20,0.3)" }}>
      <summary style={{ cursor: "pointer" }}>
        <span style={{ color: "#9fb0bf" }}>{new Date(entry.createdAt).toLocaleString()}</span>
        {" — "}
        <strong>{entry.actionType}</strong>
        {" by "}
        {actorLabel}
        {" on "}
        {targetLabel}
      </summary>
      <div style={{ marginTop: 6, display: "grid", gap: 4 }}>
        <div>Reason: {entry.reason}</div>
        <DossierJson value={{ before: entry.beforeSummary, after: entry.afterSummary }} />
      </div>
    </details>
  );
}

export default function AdminPage() {
  const { player } = usePlayer();
  const { activeAccount, authSource, serverSessionToken } = useAuth();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<AdminPlayerSummary[]>([]);
  const [selected, setSelected] = useState<AdminPlayerTarget | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [reason, setReason] = useState("");
  const [activeTab, setActiveTab] = useState<AdminTabKey>("overview");

  // Stats / resources
  const [battleStats, setBattleStats] = useState({ strength: 10, defense: 10, speed: 10, dexterity: 10 });
  const [workingStats, setWorkingStats] = useState({ manualLabor: 10, intelligence: 10, endurance: 10 });
  const [currencies, setCurrencies] = useState({ copper: 0, silver: 0, gold: 500, platinum: 0 });
  const [resourceStatKey, setResourceStatKey] = useState<(typeof RESOURCE_STAT_OPTIONS)[number]["value"]>("energy");
  const [resourceStatValue, setResourceStatValue] = useState(0);
  const [resourceStatDelta, setResourceStatDelta] = useState(10);
  const [currencyAdjustKey, setCurrencyAdjustKey] = useState<(typeof CURRENCY_OPTIONS)[number]>("gold");
  const [currencyAdjustDelta, setCurrencyAdjustDelta] = useState(100);
  const [xpGrant, setXpGrant] = useState(50);

  // Phase 4: one-shot token grants (tradeable/donor)
  const [tokenGrantType, setTokenGrantType] = useState<AdminOneShotTokenType>("tradeable");
  const [tokenGrantQuantity, setTokenGrantQuantity] = useState(1);
  const [tokenGrantBusy, setTokenGrantBusy] = useState(false);
  const [tokenGrantMessage, setTokenGrantMessage] = useState<string | null>(null);
  const [tokenGrantConfirmKey, setTokenGrantConfirmKey] = useState<string | null>(null);

  // Overview / account
  const [jobValue, setJobValue] = useState("");
  const [privilegeRole, setPrivilegeRole] = useState<"player" | "staff" | "admin">("player");

  // Inventory
  const [inventoryItemId, setInventoryItemId] = useState(ITEM_OPTIONS[0]?.itemId ?? "wild_herb");
  const [inventoryQty, setInventoryQty] = useState(1);
  const [enhancementItemId, setEnhancementItemId] = useState(ITEM_OPTIONS[0]?.itemId ?? "wild_herb");
  const [enhancementValue, setEnhancementValue] = useState(ITEM_ENHANCEMENT_OPTIONS[0] ?? "Tempered");
  const [absoluteInventoryQty, setAbsoluteInventoryQty] = useState(1);
  const [equipmentSlot, setEquipmentSlot] = useState("weapon");

  // Stats tab: skills
  const [skillId, setSkillId] = useState("quick_strike");
  const [skillUseCount, setSkillUseCount] = useState(50);
  const [skillSlotType, setSkillSlotType] = useState<"active" | "passive">("active");
  const [skillSlotIndex, setSkillSlotIndex] = useState(0);

  // Education tab
  const [courseId, setCourseId] = useState("basic-literacy");
  const [academyId, setAcademyId] = useState("hall-of-letters");
  const [academyStageId, setAcademyStageId] = useState("foundation");

  // Travel tab
  const [cityId, setCityId] = useState("nexis");
  const [cityStandingValue, setCityStandingValue] = useState(0);
  const [contractId, setContractId] = useState("");

  // Organizations tab
  const [orgLookupType, setOrgLookupType] = useState<"guild" | "consortium">("guild");
  const [orgLookupPublicId, setOrgLookupPublicId] = useState("");
  const [orgLookupResult, setOrgLookupResult] = useState<unknown>(null);
  const [orgLookupError, setOrgLookupError] = useState<string | null>(null);
  const [orgNextLeaderPublicId, setOrgNextLeaderPublicId] = useState("");

  // Admin Logs tab
  const [auditLogScope, setAuditLogScope] = useState<"target" | "global">("target");
  const [auditLogEntries, setAuditLogEntries] = useState<AdminAuditLogEntry[]>([]);
  const [auditLogLoading, setAuditLogLoading] = useState(false);
  const [auditLogError, setAuditLogError] = useState<string | null>(null);

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
    setResourceStatValue(Number(selected.player.stats[resourceStatKey] ?? 0));
    setActiveTab("overview");
    setAuditLogEntries([]);
    setAuditLogError(null);
    setOrgLookupResult(null);
    setOrgLookupError(null);
    // Deliberately excludes resourceStatKey so switching the stat dropdown
    // doesn't get clobbered by this target-load effect.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected?.user.internalId]);

  const dossier = asRecord(selected?.dossier);
  const dossierSummary = asRecord(dossier.summary);
  const dossierInventory = asArray(dossier.inventory);
  const dossierRecords = asArray(asRecord(dossier.records).entries ?? dossier.records).slice(0, 30);
  const dossierOrganizations = asRecord(dossier.organizations);
  const dossierGuild = asRecord(dossierOrganizations.guild);
  const dossierConsortium = asRecord(dossierOrganizations.consortium);
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

  // Admin hotfix: targetPublicId, not internalId - the server resolves the
  // public ID to the authoritative internal user itself. See
  // server/lib/adminTargetResolution.js.
  async function loadTarget(targetPublicId: string) {
    if (!serverSessionToken) return;
    const result = await getAdminPlayerDetails(serverSessionToken, targetPublicId);
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
    const result = await postAdminPlayerAction(serverSessionToken, String(selected.user.publicId), { actionType, reason, ...payload });
    if ("ok" in result && result.ok === false) {
      setMessage(result.error);
      return;
    }
    const response = result as AdminActionSuccess;
    setSelected(response.target);
    setMessage(`Admin action complete: ${response.audit.actionType}.`);
    // Admin hotfix: was comparing the real internal ID to activeAccount's
    // synthetic placeholder ID (always false) - compare public IDs instead,
    // which are both real.
    if (activeAccount && selected.user.publicId === activeAccount.publicId) {
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

  // Phase 4: two-step confirm. First click generates a stable idempotency
  // key and shows a summary; the SAME key is resent if "Confirm" is
  // clicked again (e.g. after a network hiccup), so a retry can never
  // grant twice - the server returns the original result instead.
  function beginTokenGrant() {
    if (!selected) return;
    setTokenGrantMessage(null);
    setTokenGrantConfirmKey(crypto.randomUUID());
  }

  function cancelTokenGrant() {
    setTokenGrantConfirmKey(null);
  }

  async function confirmTokenGrant() {
    if (!serverSessionToken || !selected || !tokenGrantConfirmKey) return;
    if (!reason.trim()) {
      setTokenGrantMessage("A reason is required for token grants.");
      return;
    }
    setTokenGrantBusy(true);
    setTokenGrantMessage(null);
    try {
      const result = await postAdminOneShotTokenGrant(serverSessionToken, String(selected.user.publicId), {
        tokenType: tokenGrantType,
        quantity: tokenGrantQuantity,
        reason,
        idempotencyKey: tokenGrantConfirmKey,
      });
      if ("ok" in result && result.ok === false) {
        setTokenGrantMessage(result.error);
        return;
      }
      const success = result as AdminOneShotTokenGrantResult;
      if (success.target) setSelected(success.target);
      setTokenGrantMessage(
        `${success.grant.replay ? "Already recorded" : "Granted"}: ${success.grant.quantity} ${ONE_SHOT_TOKEN_TYPE_LABELS[success.grant.tokenType].toLowerCase()} token(s). Balance ${success.grant.before} -> ${success.grant.after}. Operation ${success.grant.operationId}.`,
      );
      setTokenGrantConfirmKey(null);
    } catch {
      setTokenGrantMessage("Token grant failed. See console for details.");
    } finally {
      setTokenGrantBusy(false);
    }
  }

  async function fetchOrgDetails() {
    if (!serverSessionToken || !orgLookupPublicId.trim()) return;
    setOrgLookupError(null);
    const result = await getOrganizationByPublicId(serverSessionToken, orgLookupType, orgLookupPublicId.trim());
    if ("ok" in result && result.ok === false) {
      setOrgLookupError(result.error);
      setOrgLookupResult(null);
      return;
    }
    setOrgLookupResult(result);
  }

  async function runReassignLeadership() {
    if (!serverSessionToken || !orgLookupPublicId.trim() || !orgNextLeaderPublicId.trim()) return;
    const result = await reassignOrganizationLeadership(serverSessionToken, orgLookupPublicId.trim(), {
      nextLeaderPublicId: orgNextLeaderPublicId.trim(),
      reason,
    });
    if ("ok" in result && result.ok === false) {
      setMessage(result.error);
      return;
    }
    const success = result as AdminOrganizationLeadershipResult;
    setMessage(`Leadership reassigned: organization ${success.organizationPublicId} -> P${String(success.nextLeaderPublicId).padStart(7, "0")}.`);
  }

  async function loadAuditLog(scope: "target" | "global") {
    if (!serverSessionToken) return;
    setAuditLogScope(scope);
    setAuditLogLoading(true);
    setAuditLogError(null);
    const result = await getAdminAuditLog(serverSessionToken, {
      targetInternalId: scope === "target" ? selected?.user.internalId ?? null : null,
      limit: 50,
    });
    setAuditLogLoading(false);
    if ("ok" in result && result.ok === false) {
      setAuditLogError(result.error);
      return;
    }
    setAuditLogEntries((result as { entries: AdminAuditLogEntry[] }).entries);
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
              <button type="button" onClick={() => activeAccount && loadTarget(String(activeAccount.publicId))}>Select Self</button>
            </div>
            {results.length ? (
              <div style={{ display: "grid", gap: 8 }}>
                {results.map((result) => (
                  <button key={result.internalId} type="button" onClick={() => loadTarget(String(result.publicId))} style={{ textAlign: "left" }}>
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
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 8 }}>
                  <div>Level {selected.player.level} | XP {selected.player.experience}</div>
                  <div>Job: {selected.player.currentJob ?? "None"}</div>
                  <div>Condition: <strong>{selected.player.condition.type}</strong></div>
                  <div>Identity: <strong>{selected.user.entityType}</strong></div>
                  <div>Role: <strong>{selected.user.privilegeRole}</strong></div>
                  <div>Gold: <strong>{selected.player.currencies.gold.toLocaleString("en-GB")}</strong></div>
                </div>
                <input value={reason} onChange={(event) => setReason(event.target.value)} placeholder="Required reason for admin actions (applies to every action below)" style={{ width: "100%" }} />
                {!canUseSensitiveMutations ? (
                  <div style={{ color: "#9fb0bf", fontSize: 13 }}>
                    Staff can search accounts, inspect target details, and perform support recovery actions (bar fills, clearing hospital/jail). Stat edits, currency edits, job edits, inventory/gear changes, and account-role changes are administrator-only.
                  </div>
                ) : null}
              </div>
            </ContentPanel>

            <div style={{ display: "flex", gap: 6, flexWrap: "wrap", borderBottom: "1px solid rgba(255,255,255,0.1)", paddingBottom: 8 }}>
              {ADMIN_TABS.map((tab) => (
                <button
                  key={tab.key}
                  type="button"
                  onClick={() => setActiveTab(tab.key)}
                  style={{
                    padding: "6px 12px",
                    borderRadius: 6,
                    border: "1px solid rgba(255,255,255,0.12)",
                    background: activeTab === tab.key ? "#d8c278" : "transparent",
                    color: activeTab === tab.key ? "#0b0f14" : "#d7dee6",
                    fontWeight: activeTab === tab.key ? 800 : 500,
                    cursor: "pointer",
                  }}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            {activeTab === "overview" ? (
              <ContentPanel title="Overview">
                <div style={{ display: "grid", gap: 14 }}>
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 8 }}>
                    <div>Location: <strong>{String(dossierSummary.location ?? "unknown")}</strong></div>
                    <div>Travel: <strong>{String(asRecord(dossierSummary.travel).status ?? "idle")}</strong></div>
                    <div>Education: <strong>{asRecord(dossierSummary.activeEducation).courseId ? String(asRecord(dossierSummary.activeEducation).courseId) : "none"}</strong></div>
                    <div>Academy: <strong>{asRecord(dossierSummary.activeAcademy).academyId ? String(asRecord(dossierSummary.activeAcademy).academyId) : "none"}</strong></div>
                  </div>

                  <SectionTitle>Account Role Control</SectionTitle>
                  <div style={{ color: "#9fb0bf", fontSize: 13 }}>
                    NPC/system identity classification is separate from account privilege role. Changing the role below does not rewrite the target&apos;s reserved identity.
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

                  {canUseSensitiveMutations ? (
                    <>
                      <SectionTitle>Player Job</SectionTitle>
                      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                        <input value={jobValue} onChange={(event) => setJobValue(event.target.value)} placeholder="Assign or clear current job" style={{ flex: 1, minWidth: 240 }} />
                        <button type="button" onClick={() => runAction("setPlayerJob", { job: jobValue })}>Assign / Change</button>
                        <button type="button" onClick={() => runAction("setPlayerJob", { job: null })}>Remove Job</button>
                      </div>

                      <SectionTitle>Progression</SectionTitle>
                      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                        <input type="number" value={xpGrant} min={1} onChange={(event) => setXpGrant(Number(event.target.value))} />
                        <button type="button" onClick={() => runAction("grantExperience", { amount: xpGrant })}>{ADMIN_ACTION_POLICIES.grantExperience.label}</button>
                      </div>
                    </>
                  ) : null}
                </div>
              </ContentPanel>
            ) : null}

            {activeTab === "resources" ? (
              <ContentPanel title="Resources">
                <div style={{ display: "grid", gap: 14 }}>
                  <SectionTitle>Recovery Bars (staff-safe)</SectionTitle>
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 8 }}>
                    <button type="button" onClick={() => runAction("fillEnergy", {})}>{ADMIN_ACTION_POLICIES.fillEnergy.label}</button>
                    <button type="button" onClick={() => runAction("fillStamina", {})}>{ADMIN_ACTION_POLICIES.fillStamina.label}</button>
                    <button type="button" onClick={() => runAction("fillHealth", {})}>{ADMIN_ACTION_POLICIES.fillHealth.label}</button>
                    <button type="button" onClick={() => runAction("fillComfort", {})}>{ADMIN_ACTION_POLICIES.fillComfort.label}</button>
                    <button type="button" onClick={() => runAction("fillAllBars", {})}>{ADMIN_ACTION_POLICIES.fillAllBars.label}</button>
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: 8 }}>
                    {["energy", "stamina", "health", "comfort", "nerve"].map((stat) => (
                      <div key={stat}>{stat}: <strong>{Number(selected.player.stats[stat] ?? 0)}</strong> / {Number(selected.player.stats[`max${stat[0].toUpperCase()}${stat.slice(1)}`] ?? 0)}</div>
                    ))}
                  </div>

                  {canUseSensitiveMutations ? (
                    <>
                      <SectionTitle>Set / Adjust Resource Stat (administrator)</SectionTitle>
                      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
                        <select value={resourceStatKey} onChange={(event) => setResourceStatKey(event.target.value as typeof resourceStatKey)}>
                          {RESOURCE_STAT_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                        </select>
                        <input type="number" value={resourceStatValue} min={0} onChange={(event) => setResourceStatValue(Number(event.target.value))} style={{ width: 100 }} />
                        <button type="button" onClick={() => runAction("setResourceStat", { stat: resourceStatKey, value: resourceStatValue })}>{ADMIN_ACTION_POLICIES.setResourceStat.label}</button>
                        <input type="number" value={resourceStatDelta} min={1} onChange={(event) => setResourceStatDelta(Number(event.target.value))} style={{ width: 100 }} />
                        <button type="button" onClick={() => runAction("adjustResourceStat", { stat: resourceStatKey, delta: resourceStatDelta })}>+ Add</button>
                        <button type="button" onClick={() => runAction("adjustResourceStat", { stat: resourceStatKey, delta: -resourceStatDelta })}>- Subtract</button>
                      </div>

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

                      <SectionTitle>Adjust Currency (delta)</SectionTitle>
                      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
                        <select value={currencyAdjustKey} onChange={(event) => setCurrencyAdjustKey(event.target.value as typeof currencyAdjustKey)}>
                          {CURRENCY_OPTIONS.map((option) => <option key={option} value={option}>{option}</option>)}
                        </select>
                        <input type="number" value={currencyAdjustDelta} min={1} onChange={(event) => setCurrencyAdjustDelta(Number(event.target.value))} style={{ width: 120 }} />
                        <button type="button" onClick={() => runAction("adjustCurrency", { currency: currencyAdjustKey, delta: currencyAdjustDelta })}>+ Add</button>
                        <button type="button" onClick={() => runAction("adjustCurrency", { currency: currencyAdjustKey, delta: -currencyAdjustDelta })}>- Subtract</button>
                      </div>

                      <SectionTitle>Personal One-Shot Tokens</SectionTitle>
                      <div style={{ fontSize: 13, color: "#9fb0bf" }}>
                        Tradeable and donor tokens are tracked separately and never affect donor tier or monthly entitlement history.
                      </div>
                      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 8 }}>
                        <div>Tradeable balance: <strong>{selected.player.oneShotTokens.tradeable}</strong></div>
                        <div>Donor balance: <strong>{selected.player.oneShotTokens.donor}</strong></div>
                      </div>
                      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
                        <select value={tokenGrantType} onChange={(event) => { setTokenGrantType(event.target.value as AdminOneShotTokenType); setTokenGrantConfirmKey(null); }}>
                          <option value="tradeable">Tradeable</option>
                          <option value="donor">Donor</option>
                        </select>
                        <input
                          type="number"
                          value={tokenGrantQuantity}
                          min={1}
                          max={ADMIN_ONE_SHOT_TOKEN_GRANT_CAP}
                          onChange={(event) => { setTokenGrantQuantity(Number(event.target.value)); setTokenGrantConfirmKey(null); }}
                          style={{ width: 100 }}
                        />
                        {tokenGrantConfirmKey ? (
                          <>
                            <span style={{ color: "#d8c278" }}>
                              Confirm: grant {tokenGrantQuantity} {ONE_SHOT_TOKEN_TYPE_LABELS[tokenGrantType].toLowerCase()} token(s) to P{String(selected.user.publicId).padStart(7, "0")}?
                              Balance {selected.player.oneShotTokens[tokenGrantType]} -&gt; {selected.player.oneShotTokens[tokenGrantType] + tokenGrantQuantity}.
                            </span>
                            <button type="button" onClick={confirmTokenGrant} disabled={tokenGrantBusy}>Confirm Grant</button>
                            <button type="button" onClick={cancelTokenGrant} disabled={tokenGrantBusy}>Cancel</button>
                          </>
                        ) : (
                          <button
                            type="button"
                            onClick={beginTokenGrant}
                            disabled={tokenGrantQuantity < 1 || tokenGrantQuantity > ADMIN_ONE_SHOT_TOKEN_GRANT_CAP || !Number.isInteger(tokenGrantQuantity)}
                          >
                            Add {ONE_SHOT_TOKEN_TYPE_LABELS[tokenGrantType]} One-Shot Token{tokenGrantQuantity === 1 ? "" : "s"}
                          </button>
                        )}
                      </div>
                      {tokenGrantMessage ? <div style={{ fontSize: 13 }}>{tokenGrantMessage}</div> : null}
                    </>
                  ) : (
                    <div style={{ color: "#d98f8f", fontSize: 13 }}>Setting exact resource/currency values is administrator-only.</div>
                  )}
                </div>
              </ContentPanel>
            ) : null}

            {activeTab === "stats" ? (
              <ContentPanel title="Stats">
                {canUseSensitiveMutations ? (
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

                    <SectionTitle>Skills</SectionTitle>
                    <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                      <input value={skillId} onChange={(event) => setSkillId(event.target.value)} placeholder="skill id" />
                      <button type="button" onClick={() => runAction("unlockSkill", { skillId })}>Unlock</button>
                      <button type="button" onClick={() => runAction("instantLearnSkill", { skillId })}>Instant Learn</button>
                      <button type="button" onClick={() => runAction("revokeSkill", { skillId })}>Revoke</button>
                      <input type="number" value={skillUseCount} min={0} onChange={(event) => setSkillUseCount(Number(event.target.value))} />
                      <button type="button" onClick={() => runAction("setSkillUseCount", { skillId, uses: skillUseCount })}>Set Uses</button>
                      <select value={skillSlotType} onChange={(event) => setSkillSlotType(event.target.value as "active" | "passive")}>
                        <option value="active">active</option>
                        <option value="passive">passive</option>
                      </select>
                      <input type="number" value={skillSlotIndex} min={0} max={7} onChange={(event) => setSkillSlotIndex(Number(event.target.value))} />
                      <button type="button" onClick={() => runAction("slotSkill", { skillId, slotType: skillSlotType, slotIndex: skillSlotIndex })}>Slot</button>
                    </div>
                    <DossierBlock title="Skills (raw)"><DossierJson value={dossier.skills} /></DossierBlock>
                  </div>
                ) : (
                  <div style={{ color: "#d98f8f", fontSize: 13 }}>Stat edits are administrator-only.</div>
                )}
              </ContentPanel>
            ) : null}

            {activeTab === "inventory" ? (
              <ContentPanel title="Inventory">
                <div style={{ display: "grid", gap: 14 }}>
                  <SectionTitle>Current Inventory</SectionTitle>
                  <div style={{ display: "grid", gap: 6 }}>
                    {inventoryRows.length ? inventoryRows.map(([itemId, quantity]) => <div key={itemId}>{itemId}: x{quantity}</div>) : <div>No inventory recorded.</div>}
                  </div>

                  {canUseSensitiveMutations ? (
                    <>
                      <SectionTitle>Grant / Remove Items</SectionTitle>
                      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                        <select value={inventoryItemId} onChange={(event) => setInventoryItemId(event.target.value)}>
                          {ITEM_OPTIONS.map((item) => <option key={item.itemId} value={item.itemId}>{item.name}</option>)}
                        </select>
                        <input type="number" value={inventoryQty} min={1} max={ADMIN_ITEM_QUANTITY_CAP} step={1} onChange={(event) => setInventoryQty(Number(event.target.value))} style={{ width: 120 }} />
                        <button type="button" onClick={() => runAction("addInventoryItem", { itemId: inventoryItemId, quantity: inventoryQty })} disabled={Boolean(inventoryQuantityValidationError)}>Add Item</button>
                        <button type="button" onClick={() => runAction("removeInventoryItem", { itemId: inventoryItemId, quantity: inventoryQty })} disabled={Boolean(inventoryQuantityValidationError)}>Remove Item</button>
                        {inventoryQuantityValidationError ? <div style={{ color: "#d98f8f", fontSize: 13, flexBasis: "100%" }}>{inventoryQuantityValidationError}</div> : null}
                      </div>
                      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                        <input type="number" value={absoluteInventoryQty} min={0} onChange={(event) => setAbsoluteInventoryQty(Number(event.target.value))} style={{ width: 120 }} />
                        <button type="button" onClick={() => runAction("setInventoryItemQuantity", { itemId: inventoryItemId, quantity: absoluteInventoryQty })}>{ADMIN_ACTION_POLICIES.setInventoryItemQuantity.label} (selected item above)</button>
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

                      <SectionTitle>Equipment</SectionTitle>
                      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                        <input value={equipmentSlot} onChange={(event) => setEquipmentSlot(event.target.value)} placeholder="equipment slot" />
                        <button type="button" onClick={() => runAction("clearEquipmentSlot", { slot: equipmentSlot })}>{ADMIN_ACTION_POLICIES.clearEquipmentSlot.label}</button>
                      </div>
                      <DossierBlock title="Equipped Items / Loadouts"><DossierJson value={{ equipment: dossier.equipment, loadouts: dossier.loadouts, maintenance: dossier.equipmentMaintenance }} /></DossierBlock>
                    </>
                  ) : (
                    <div style={{ color: "#d98f8f", fontSize: 13 }}>Granting/removing items and gear changes are administrator-only.</div>
                  )}

                  <DossierBlock title="Full Inventory Dossier"><div style={{ display: "grid", gap: 5 }}>{dossierInventory.length ? dossierInventory.slice(0, 24).map((entry, index) => { const record = asRecord(entry); const item = asRecord(record.item); return <div key={`${record.itemId ?? index}`}>{String(item.displayName ?? record.itemId)}: x{String(record.quantity ?? 0)}</div>; }) : <div>No inventory recorded.</div>}</div></DossierBlock>
                </div>
              </ContentPanel>
            ) : null}

            {activeTab === "conditions" ? (
              <ContentPanel title="Conditions">
                <div style={{ display: "grid", gap: 10 }}>
                  <div>Current condition: <strong>{selected.player.condition.type}</strong></div>
                  {selected.player.condition.until ? <div>Until: {new Date(selected.player.condition.until).toLocaleString()}</div> : null}
                  {selected.player.condition.reason ? <div>Reason on record: {selected.player.condition.reason}</div> : null}
                  <div>
                    <button type="button" onClick={() => runAction("clearCondition", {})} disabled={selected.player.condition.type === "normal"}>
                      {ADMIN_ACTION_POLICIES.clearCondition.label} (Hospital / Jail / other → Normal)
                    </button>
                  </div>
                  <div style={{ color: "#9fb0bf", fontSize: 13 }}>
                    Staff-safe support action — a reason is still required above and the change is still written to the admin audit log.
                  </div>
                </div>
              </ContentPanel>
            ) : null}

            {activeTab === "education" ? (
              <ContentPanel title="Education">
                <div style={{ display: "grid", gap: 14 }}>
                  <DossierBlock title="Education"><DossierJson value={dossier.education} /></DossierBlock>
                  <DossierBlock title="Academy"><DossierJson value={dossier.academy} /></DossierBlock>

                  {canUseSensitiveMutations ? (
                    <>
                      <SectionTitle>Education</SectionTitle>
                      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                        <input value={courseId} onChange={(event) => setCourseId(event.target.value)} placeholder="course id" />
                        <button type="button" onClick={() => runAction("grantEducationCompletion", { courseId })}>Grant Course</button>
                        <button type="button" onClick={() => runAction("revokeEducationCompletion", { courseId })}>Revoke Course</button>
                        <button type="button" onClick={() => runAction("cancelEducation", {})}>Cancel Education</button>
                      </div>
                      <SectionTitle>Academy</SectionTitle>
                      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                        <input value={academyId} onChange={(event) => setAcademyId(event.target.value)} placeholder="academy id" />
                        <input value={academyStageId} onChange={(event) => setAcademyStageId(event.target.value)} placeholder="stage id" />
                        <button type="button" onClick={() => runAction("completeAcademyStage", { academyId, stageId: academyStageId })}>Complete Stage</button>
                        <button type="button" onClick={() => runAction("resetAcademy", { academyId })}>Reset Academy</button>
                      </div>
                    </>
                  ) : (
                    <div style={{ color: "#d98f8f", fontSize: 13 }}>Education/academy edits are administrator-only.</div>
                  )}
                </div>
              </ContentPanel>
            ) : null}

            {activeTab === "travel" ? (
              <ContentPanel title="Travel">
                <div style={{ display: "grid", gap: 14 }}>
                  <DossierBlock title="Contracts / Travel / Discovery"><DossierJson value={dossier.contractsTravelDiscovery} /></DossierBlock>

                  {canUseSensitiveMutations ? (
                    <>
                      <SectionTitle>Travel / City / Contracts</SectionTitle>
                      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                        <input value={cityId} onChange={(event) => setCityId(event.target.value)} placeholder="city id" />
                        <button type="button" onClick={() => runAction("clearTravelState", { currentCityId: cityId })}>Clear Travel To City</button>
                        <input type="number" value={cityStandingValue} min={0} max={1000} onChange={(event) => setCityStandingValue(Number(event.target.value))} />
                        <button type="button" onClick={() => runAction("setCityStanding", { cityId, value: cityStandingValue })}>Set Standing</button>
                        <input value={contractId} onChange={(event) => setContractId(event.target.value)} placeholder="contract id or blank" />
                        <button type="button" onClick={() => runAction("clearContractState", { contractId: contractId || null })}>Clear Contract State</button>
                      </div>
                    </>
                  ) : (
                    <div style={{ color: "#d98f8f", fontSize: 13 }}>Travel/city/contract edits are administrator-only. Use Conditions tab to finish a stuck trip via Clear Condition first if it's blocking a player.</div>
                  )}
                </div>
              </ContentPanel>
            ) : null}

            {activeTab === "organizations" ? (
              <ContentPanel title="Organizations">
                <div style={{ display: "grid", gap: 14 }}>
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 8 }}>
                    <div>Guild: <strong>{dossierGuild.publicId ? `${String(dossierGuild.name ?? "")} [${String(dossierGuild.publicId)}]` : "None"}</strong></div>
                    <div>Consortium: <strong>{dossierConsortium.publicId ? `${String(dossierConsortium.name ?? "")} [${String(dossierConsortium.publicId)}]` : "None"}</strong></div>
                  </div>
                  <DossierBlock title="Organizations (raw)"><DossierJson value={dossier.organizations} /></DossierBlock>

                  <SectionTitle>View Guild / Consortium Details</SectionTitle>
                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
                    <select value={orgLookupType} onChange={(event) => setOrgLookupType(event.target.value as "guild" | "consortium")}>
                      <option value="guild">Guild</option>
                      <option value="consortium">Consortium</option>
                    </select>
                    <input value={orgLookupPublicId} onChange={(event) => setOrgLookupPublicId(event.target.value)} placeholder="Organization public ID" style={{ width: 200 }} />
                    <button type="button" onClick={fetchOrgDetails}>Fetch Details</button>
                  </div>
                  {orgLookupError ? <div style={{ color: "#d98f8f", fontSize: 13 }}>{orgLookupError}</div> : null}
                  {orgLookupResult ? <DossierBlock title="Fetched Organization"><DossierJson value={orgLookupResult} /></DossierBlock> : null}

                  {canUseSensitiveMutations ? (
                    <>
                      <SectionTitle>Administer — Reassign Leadership</SectionTitle>
                      <div style={{ color: "#9fb0bf", fontSize: 13 }}>
                        Uses the organization public ID entered above. Sets the target member as guildmaster/director and demotes the previous leader to a fallback role.
                      </div>
                      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
                        <input value={orgNextLeaderPublicId} onChange={(event) => setOrgNextLeaderPublicId(event.target.value)} placeholder="Next leader public ID (e.g. P0000123)" style={{ width: 240 }} />
                        <button type="button" onClick={runReassignLeadership}>Reassign Leadership</button>
                      </div>
                    </>
                  ) : (
                    <div style={{ color: "#d98f8f", fontSize: 13 }}>Reassigning guild/consortium leadership is administrator-only.</div>
                  )}
                </div>
              </ContentPanel>
            ) : null}

            {activeTab === "records" ? (
              <ContentPanel title="Records">
                <div style={{ display: "grid", gap: 14 }}>
                  <SectionTitle>Records / Audit Trail</SectionTitle>
                  <div style={{ display: "grid", gap: 6 }}>
                    {dossierRecords.length ? dossierRecords.map((entry, index) => { const record = asRecord(entry); return <div key={`${record.id ?? index}`}>{String(record.category ?? "record")}: {String(record.summary ?? "Account record")}</div>; }) : <div>No player records yet.</div>}
                  </div>
                  <DossierBlock title="Rare Manual Eligibility"><DossierJson value={dossier.rareManualEligibility} /></DossierBlock>
                </div>
              </ContentPanel>
            ) : null}

            {activeTab === "adminLogs" ? (
              <ContentPanel title="Admin Logs">
                <div style={{ display: "grid", gap: 10 }}>
                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
                    <button type="button" onClick={() => loadAuditLog("target")}>Load This Player&apos;s History</button>
                    <button type="button" onClick={() => loadAuditLog("global")}>Load Recent Admin Actions (All Players)</button>
                    {auditLogLoading ? <span style={{ color: "#9fb0bf", fontSize: 13 }}>Loading…</span> : null}
                  </div>
                  <div style={{ color: "#9fb0bf", fontSize: 13 }}>
                    Scope: {auditLogScope === "target" ? "This player only" : "All players (most recent 50)"}
                  </div>
                  {auditLogError ? <div style={{ color: "#d98f8f", fontSize: 13 }}>{auditLogError}</div> : null}
                  <div style={{ display: "grid", gap: 6 }}>
                    {auditLogEntries.length ? auditLogEntries.map((entry) => <AuditLogRow key={entry.id} entry={entry} />) : <div>No admin actions loaded yet — click a button above.</div>}
                  </div>
                </div>
              </ContentPanel>
            ) : null}
          </>
        ) : null}
      </div>
    </AppShell>
  );
}
