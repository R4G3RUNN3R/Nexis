// ─────────────────────────────────────────────────────────────────────────────
// Nexis — AdminInlineControls
//
// Compact "quick action" buttons rendered next to gameplay UI (bars, gold,
// condition) when an administrator has Admin Mode switched on. See
// src/state/AdminModeContext.tsx for the visibility gate.
//
// SECURITY NOTE: nothing here is a source of authority. Every call goes
// through postAdminPlayerAction() -> POST /api/admin/players/:id/actions,
// which is handled server-side by performAdminAction() in
// server/services/adminService.js. That function unconditionally calls
// assertStaffOrAdmin(actorUser) and, per action, assertAdminActionAllowed()
// (server/lib/adminActionPolicy.js), which calls assertAdministrator() /
// isAdministrator() from server/lib/adminAccess.js against the session's
// own privilegeRole looked up from the database — not anything this client
// sends. A forged request from a non-admin session is rejected there.
// ─────────────────────────────────────────────────────────────────────────────

import { useState } from "react";
import { useAdminMode } from "../../state/AdminModeContext";
import { useAuth } from "../../state/AuthContext";
import { postAdminPlayerAction } from "../../lib/adminApi";

const RESOURCE_STAT_LABELS: Record<string, string> = {
  energy: "Energy",
  stamina: "Stamina",
  health: "Health",
  comfort: "Comfort",
  nerve: "Nerve",
};

function promptReason(actionLabel: string): string | null {
  const reason = window.prompt(`Reason for "${actionLabel}" (required, min 3 characters):`, "");
  if (reason === null) return null; // user cancelled
  const trimmed = reason.trim();
  if (trimmed.length < 3) {
    window.alert("A short reason (3+ characters) is required for admin actions.");
    return null;
  }
  return trimmed;
}

function promptWholeNumber(message: string, defaultValue = ""): number | null {
  const raw = window.prompt(message, defaultValue);
  if (raw === null) return null;
  const value = Number(raw.trim());
  if (!Number.isFinite(value) || !Number.isInteger(value)) {
    window.alert("Please enter a whole number.");
    return null;
  }
  return value;
}

/**
 * Shared hook for firing an admin action against the current admin's own
 * account (the "quick action" controls apply to the account you're
 * currently logged in as — arbitrary-target moderation stays in the full
 * Admin Panel at /admin). Handles busy state, reason prompting, error
 * surfacing, and resyncing PlayerContext's cached state after success.
 *
 * Admin hotfix: targets by activeAccount.publicId, not player.internalId.
 * player.internalId (PlayerContext) is populated from the login/register
 * response's synthetic "plr_<publicId>" placeholder (see
 * authService.js's mapPublicApiUser), never the real database internal_id
 * - submitting it as an admin-action target always produced "Target
 * player not found." activeAccount.publicId is the real, already-correct
 * public ID, and the server resolves it to the authoritative internal
 * user itself (see adminTargetResolution.js).
 */
function useAdminActionRunner() {
  const { serverSessionToken, activeAccount, refreshServerState } = useAuth();
  const [busyActionKey, setBusyActionKey] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function run(
    actionKey: string,
    actionType: string,
    actionLabel: string,
    extraPayload: Record<string, unknown> = {},
  ) {
    if (!serverSessionToken || !activeAccount?.publicId) return;
    const reason = promptReason(actionLabel);
    if (reason === null) return;

    setError(null);
    setBusyActionKey(actionKey);
    try {
      const result = await postAdminPlayerAction(serverSessionToken, String(activeAccount.publicId), {
        actionType,
        reason,
        ...extraPayload,
      });
      if ("ok" in result && result.ok === false) {
        setError(result.error);
        return;
      }
      await refreshServerState();
    } catch {
      setError("Admin action failed. See console for details.");
    } finally {
      setBusyActionKey(null);
    }
  }

  return { run, busyActionKey, error };
}

function AdminInlineError({ error }: { error: string | null }) {
  if (!error) return null;
  return <span className="admin-inline__error">{error}</span>;
}

/** Fill / Set / Reduce controls for a single recovery-bar stat. */
export function AdminBarInlineControls({
  stat,
  current,
  max,
  fillActionType,
}: {
  stat: "energy" | "stamina" | "health" | "comfort" | "nerve";
  current: number;
  max: number;
  /** Existing dispatcher action reused for "Fill" when one exists (energy/stamina/health/comfort). */
  fillActionType?: string;
}) {
  const { adminModeEnabled } = useAdminMode();
  const { run, busyActionKey, error } = useAdminActionRunner();
  if (!adminModeEnabled) return null;

  const label = RESOURCE_STAT_LABELS[stat] ?? stat;
  const busy = busyActionKey !== null;

  async function handleFill() {
    if (fillActionType) {
      await run(`${stat}-fill`, fillActionType, `Fill ${label}`);
    } else {
      // No dedicated fillX dispatcher case for this stat (e.g. nerve) —
      // reuse the generic setResourceStat action, set to max.
      await run(`${stat}-fill`, "setResourceStat", `Fill ${label}`, { stat, value: max });
    }
  }

  async function handleSet() {
    const value = promptWholeNumber(`Set ${label} to (0-${max}):`, String(Math.round(current)));
    if (value === null) return;
    await run(`${stat}-set`, "setResourceStat", `Set ${label}`, { stat, value });
  }

  async function handleReduce() {
    const amount = promptWholeNumber(`Reduce ${label} by how much?`, "10");
    if (amount === null) return;
    if (amount <= 0) {
      window.alert("Enter a positive amount to reduce.");
      return;
    }
    await run(`${stat}-reduce`, "adjustResourceStat", `Reduce ${label}`, { stat, delta: -amount });
  }

  return (
    <span className="admin-inline admin-inline--bar">
      <button type="button" className="admin-inline__btn" disabled={busy} onClick={handleFill} title={`Admin: fill ${label}`}>
        Fill
      </button>
      <button type="button" className="admin-inline__btn" disabled={busy} onClick={handleSet} title={`Admin: set ${label}`}>
        Set
      </button>
      <button type="button" className="admin-inline__btn" disabled={busy} onClick={handleReduce} title={`Admin: reduce ${label}`}>
        Reduce
      </button>
      <AdminInlineError error={error} />
    </span>
  );
}

/** Nerve isn't rendered as a normal gameplay bar anywhere; give admins a compact readout + controls only in Admin Mode. */
export function AdminNerveInlineRow({ current, max }: { current: number; max: number }) {
  const { adminModeEnabled } = useAdminMode();
  if (!adminModeEnabled) return null;

  return (
    <div className="admin-inline-row">
      <span className="admin-inline-row__label">Admin: Nerve</span>
      <span className="admin-inline-row__value">
        {Math.floor(current)} / {max}
      </span>
      <AdminBarInlineControls stat="nerve" current={current} max={max} />
    </div>
  );
}

/** Add / Subtract / Set controls for gold. */
export function AdminGoldInlineControls({ gold }: { gold: number }) {
  const { adminModeEnabled } = useAdminMode();
  const { run, busyActionKey, error } = useAdminActionRunner();
  if (!adminModeEnabled) return null;

  const busy = busyActionKey !== null;

  async function handleAdd() {
    const amount = promptWholeNumber("Add how much gold?", "1000");
    if (amount === null) return;
    if (amount <= 0) {
      window.alert("Enter a positive amount to add.");
      return;
    }
    await run("gold-add", "adjustCurrency", "Add Gold", { currency: "gold", delta: amount });
  }

  async function handleSubtract() {
    const amount = promptWholeNumber("Subtract how much gold?", "1000");
    if (amount === null) return;
    if (amount <= 0) {
      window.alert("Enter a positive amount to subtract.");
      return;
    }
    await run("gold-subtract", "adjustCurrency", "Subtract Gold", { currency: "gold", delta: -amount });
  }

  async function handleSet() {
    const value = promptWholeNumber("Set gold to:", String(Math.round(gold)));
    if (value === null) return;
    if (value < 0) {
      window.alert("Gold cannot be negative.");
      return;
    }
    await run("gold-set", "setCurrencies", "Set Gold", { currencies: { gold: value } });
  }

  return (
    <span className="admin-inline admin-inline--gold">
      <button type="button" className="admin-inline__btn" disabled={busy} onClick={handleAdd} title="Admin: add gold">
        +
      </button>
      <button type="button" className="admin-inline__btn" disabled={busy} onClick={handleSubtract} title="Admin: subtract gold">
        -
      </button>
      <button type="button" className="admin-inline__btn" disabled={busy} onClick={handleSet} title="Admin: set gold">
        Set
      </button>
      <AdminInlineError error={error} />
    </span>
  );
}

/** Clear Hospital / Clear Jail / Finish Travel controls for condition + timers. */
export function AdminConditionInlineControls({
  conditionType,
  isTraveling,
}: {
  conditionType: "normal" | "hospitalized" | "jailed";
  isTraveling: boolean;
}) {
  const { adminModeEnabled } = useAdminMode();
  const { run, busyActionKey, error } = useAdminActionRunner();
  if (!adminModeEnabled) return null;
  if (conditionType === "normal" && !isTraveling) return null;

  const busy = busyActionKey !== null;

  async function handleClearCondition() {
    const label = conditionType === "hospitalized" ? "Clear Hospital" : "Clear Jail";
    await run("condition-clear", "clearCondition", label);
  }

  async function handleFinishTravel() {
    await run("travel-finish", "clearTravelState", "Finish Travel");
  }

  return (
    <span className="admin-inline admin-inline--condition">
      {conditionType === "hospitalized" ? (
        <button type="button" className="admin-inline__btn" disabled={busy} onClick={handleClearCondition} title="Admin: clear hospital">
          Clear Hospital
        </button>
      ) : null}
      {conditionType === "jailed" ? (
        <button type="button" className="admin-inline__btn" disabled={busy} onClick={handleClearCondition} title="Admin: clear jail">
          Clear Jail
        </button>
      ) : null}
      {isTraveling ? (
        <button type="button" className="admin-inline__btn" disabled={busy} onClick={handleFinishTravel} title="Admin: finish travel">
          Finish Travel
        </button>
      ) : null}
      <AdminInlineError error={error} />
    </span>
  );
}

/** The Admin Mode toggle itself. Only ever rendered by callers that already gate on isAdministrator. */
export function AdminModeToggle() {
  const { isAdministrator, adminModeEnabled, toggleAdminMode } = useAdminMode();
  if (!isAdministrator) return null;

  return (
    <button
      type="button"
      className={`admin-mode-toggle${adminModeEnabled ? " admin-mode-toggle--on" : ""}`}
      onClick={toggleAdminMode}
      title="Toggle compact inline admin controls throughout the app"
    >
      <span className="admin-mode-toggle__dot" />
      Admin Mode: {adminModeEnabled ? "On" : "Off"}
    </button>
  );
}
