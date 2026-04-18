import { useLocation } from "react-router-dom";
import { AppShell } from "../components/layout/AppShell";
import { ContentPanel } from "../components/layout/ContentPanel";
import { usePlayer } from "../state/PlayerContext";
import { useAuth } from "../state/AuthContext";
import { isStaffOrAdmin } from "../lib/adminAccess";
import "../styles/hospital.css";
import "../styles/hosp-full.css";

type StoredPlayerSnapshot = {
  internalId?: string;
  name?: string;
  lastName?: string;
  publicId?: number | null;
  condition?: {
    type?: string;
    until?: number | null;
    reason?: string | null;
  };
};

function InfoRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="info-row">
      <span className="info-row__label">{label}</span>
      <span className="info-row__value">{value}</span>
    </div>
  );
}

function formatRemaining(ms: number) {
  if (ms <= 0) return "0m";
  const totalMinutes = Math.ceil(ms / 60000);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  if (hours > 0) return `${hours}h ${minutes}m`;
  return `${minutes}m`;
}

function readConditionRoster(conditionType: "hospitalized" | "jailed", activeInternalId: string) {
  if (typeof window === "undefined") return [];

  const roster: Array<{
    internalId: string;
    name: string;
    reason: string;
    remainingLabel: string;
  }> = [];

  for (let index = 0; index < window.localStorage.length; index += 1) {
    const key = window.localStorage.key(index);
    if (!key || !key.startsWith("nexis_player__")) continue;

    try {
      const parsed = JSON.parse(window.localStorage.getItem(key) ?? "null") as StoredPlayerSnapshot | null;
      if (!parsed?.condition || parsed.condition.type !== conditionType) continue;

      const internalId = parsed.internalId ?? key;
      if (internalId === activeInternalId) continue;

      const name = [parsed.name, parsed.lastName].filter(Boolean).join(" ").trim() || "Unknown";
      const until = typeof parsed.condition.until === "number" ? parsed.condition.until : Date.now();
      roster.push({
        internalId,
        name,
        reason: parsed.condition.reason ?? "No reason recorded",
        remainingLabel: formatRemaining(Math.max(0, until - Date.now())),
      });
    } catch {
      // Ignore broken snapshots.
    }
  }

  return roster;
}

export default function HospitalPage() {
  const location = useLocation() as { state?: { redirectedFrom?: string } };
  const {
    player,
    isHospitalized,
    isJailed,
    hospitalRemainingLabel,
    jailRemainingLabel,
    hospitalizeFor,
    recoverFromHospital,
    releaseFromJail,
    setHealth,
    jailFor,
  } = usePlayer();
  const { activeAccount } = useAuth();

  const activeCondition = isHospitalized ? "hospitalized" : isJailed ? "jailed" : "normal";
  const canUsePrototypeControls = isStaffOrAdmin(activeAccount ?? player.publicId);
  const roster = activeCondition === "hospitalized"
    ? readConditionRoster("hospitalized", player.internalId)
    : activeCondition === "jailed"
    ? readConditionRoster("jailed", player.internalId)
    : [];

  const pageTitle = activeCondition === "jailed" ? "Jail" : "Hospital";
  const timerLabel = activeCondition === "hospitalized" ? hospitalRemainingLabel : activeCondition === "jailed" ? jailRemainingLabel : "0m";

  return (
    <AppShell
      title={pageTitle}
      hint={activeCondition === "normal" ? "No active condition." : "Your current condition updates here in real time. Everything else can stop pretending to be accessible."}
    >
      <div className="nexis-grid">
        <div className="nexis-column">
          <ContentPanel title="Current Status">
            <div className="hosp-status-block">
              <div className={`hosp-status-badge hosp-status-badge--${activeCondition}`}>
                {activeCondition === "hospitalized" && "Hospitalized"}
                {activeCondition === "jailed" && "Jailed"}
                {activeCondition === "normal" && "Normal"}
              </div>
            </div>

            <div className="info-list" style={{ marginTop: "12px" }}>
              <InfoRow label="Citizen" value={player.lastName ? `${player.name} ${player.lastName}` : player.name || "Unknown"} />
              <InfoRow label="Time Remaining" value={timerLabel} />
              <InfoRow label="Reason" value={player.condition.reason ?? "No active condition"} />
            </div>

            {location.state?.redirectedFrom ? (
              <div className="hospital-note hospital-note--redirect">
                Access to <strong>{location.state.redirectedFrom}</strong> is unavailable while you are {activeCondition === "normal" ? "fine" : activeCondition}.
              </div>
            ) : null}

            {activeCondition === "hospitalized" ? (
              <div className="hospital-note">You will leave the hospital automatically when the timer expires.</div>
            ) : null}

            {activeCondition === "jailed" ? (
              <div className="hospital-note">You will be released automatically when your sentence expires.</div>
            ) : null}

            {activeCondition === "normal" ? (
              <div className="hospital-note">No current recovery or jail status. Congratulations on basic functionality.</div>
            ) : null}
          </ContentPanel>
        </div>

        <div className="nexis-column">
          <ContentPanel title={activeCondition === "jailed" ? "Others In Jail" : "Others In Hospital"}>
            {roster.length ? (
              <div style={{ display: "grid", gap: 10 }}>
                {roster.map((entry) => (
                  <div
                    key={entry.internalId}
                    style={{
                      border: "1px solid rgba(255,255,255,0.08)",
                      borderRadius: 8,
                      padding: 12,
                      background: "rgba(7, 13, 20, 0.55)",
                      display: "grid",
                      gap: 4,
                    }}
                  >
                    <strong>{entry.name}</strong>
                    <div style={{ fontSize: 12, color: "#b7c3cf" }}>Remaining: {entry.remainingLabel}</div>
                    <div style={{ fontSize: 12, color: "#d7dee6" }}>Reason: {entry.reason}</div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="hospital-note">
                {activeCondition === "jailed"
                  ? "No other prisoners are currently listed."
                  : "No other patients are currently listed."}
              </div>
            )}
          </ContentPanel>
        </div>

        {canUsePrototypeControls ? (
          <div className="nexis-column">
            <ContentPanel title="Admin Prototype Controls">
              <div className="hospital-note">
                Reserved for the administrator while combat, jail, and recovery systems are still being stitched together properly.
              </div>
              <div className="hospital-actions" style={{ marginTop: "10px" }}>
                <button type="button" className="hospital-btn hospital-btn--danger" onClick={() => setHealth(0, "Combat defeat")}>
                  Simulate Defeat
                </button>
                <button type="button" className="hospital-btn" onClick={() => hospitalizeFor(15, "Test admission")}>
                  Admit 15 Minutes
                </button>
                <button type="button" className="hospital-btn" onClick={() => hospitalizeFor(60, "Extended test")}>
                  Admit 60 Minutes
                </button>
                <button type="button" className="hospital-btn hospital-btn--danger" onClick={() => jailFor(10, "Caught stealing")}>
                  Jail for 10 Minutes
                </button>
                {isHospitalized || isJailed ? (
                  <button
                    type="button"
                    className="hospital-btn"
                    onClick={isHospitalized ? recoverFromHospital : releaseFromJail}
                  >
                    Clear Condition
                  </button>
                ) : null}
              </div>
            </ContentPanel>
          </div>
        ) : null}
      </div>
    </AppShell>
  );
}
