// ---------------------------------------------------------------------------
// Nexis - Travel Splash / Interstitial
//
// Dedicated "you are traveling" state screen, rendered by Travel.tsx whenever
// server-reported travel state is in_transit. Gives active travel a real,
// Torn-style interstitial presence (origin/destination, transport visual,
// a live-ticking countdown, and a cargo/escort summary) instead of a small
// status block buried under the destination picker.
//
// IMPORTANT: the countdown here is DISPLAY ONLY. It is driven entirely by the
// `now` prop, which Travel.tsx already advances once per second via
// setInterval for its own progress bar. This component intentionally does
// not run its own timer and never decides "travel is over" on its own -
// arrival is resolved server-side (resolveTravelForRuntimeState) and reaches
// the client only through a fresh player/travel state fetch. See the
// arrival-sync effect in Travel.tsx for how that resync is triggered.
// ---------------------------------------------------------------------------

import { Link } from "react-router-dom";
import { getTransportIcon } from "../../assets/travel/transportIcons";
import { getCityName, getTravelProgress, type PersistedTravelState } from "../../lib/travelState";
import type { ServerTransportTier } from "../../lib/authApi";
import "../../styles/travel-splash.css";

function formatCountdown(ms: number): string {
  const totalSeconds = Math.max(0, Math.ceil(ms / 1000));
  const days = Math.floor(totalSeconds / 86400);
  const hours = Math.floor((totalSeconds % 86400) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  if (days > 0) {
    return `${days}d ${String(hours).padStart(2, "0")}h ${String(minutes).padStart(2, "0")}m`;
  }
  if (hours > 0) {
    return `${hours}h ${String(minutes).padStart(2, "0")}m ${String(seconds).padStart(2, "0")}s`;
  }
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

function titleCaseFromId(id: string) {
  return id
    .split(/[_-]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function getItemLabelFallback(itemId: string, label?: string) {
  return label && label.trim() ? label : titleCaseFromId(itemId);
}

const ROUTE_LABELS: Record<string, string> = {
  "/adventure": "Jobs",
  "/jobs": "Jobs",
  "/civic-jobs": "Civic Jobs",
  "/market": "Market",
  "/black-market": "Black Market",
  "/city-board": "City Board",
  "/housing": "Housing",
  "/bank": "Bank",
  "/city": "City",
  "/salvage-yard": "Salvage Yard",
  "/arena": "Arena",
  "/education": "Education",
  "/crafting": "Crafting",
  "/academies": "Academies",
  "/life-paths": "Life Paths",
  "/guilds": "Guilds",
  "/consortiums": "Consortiums",
};

function prettyRouteLabel(pathname: string) {
  if (ROUTE_LABELS[pathname]) return ROUTE_LABELS[pathname];
  const lastSegment = pathname.split("/").filter(Boolean).pop() ?? pathname;
  return titleCaseFromId(lastSegment);
}

export type TravelSplashProps = {
  travelState: PersistedTravelState;
  now: number;
  tier: ServerTransportTier | null;
  redirectedFrom?: string | null;
  onCancel: () => void;
  cancelBusy?: boolean;
};

export function TravelSplash({ travelState, now, tier, redirectedFrom, onCancel, cancelBusy }: TravelSplashProps) {
  const progress = getTravelProgress(travelState, now);
  const originName = getCityName(travelState.originCityId);
  const destinationName = getCityName(travelState.destinationCityId);
  const modeId = travelState.mode || "caravan";
  const modeLabel = tier?.name ?? titleCaseFromId(modeId);
  const modeSubtitle = tier?.subtype ?? "Transport";
  const Icon = getTransportIcon(modeId);
  const arrivingNow = progress.remainingMs <= 0;
  const cargoLines = travelState.cargo?.manifest ?? [];
  const hasCargo = cargoLines.length > 0;
  const hasEscort = Boolean(travelState.escort);

  return (
    <section className="travel-splash" aria-live="polite">
      <div className="travel-splash__eyebrow">Currently traveling</div>

      <div className="travel-splash__route">
        <div className="travel-splash__city travel-splash__city--origin">
          <span className="travel-splash__city-label">Departed</span>
          <strong>{originName}</strong>
        </div>
        <div className="travel-splash__arrow" aria-hidden>
          &#8594;
        </div>
        <div className="travel-splash__city travel-splash__city--destination">
          <span className="travel-splash__city-label">Bound for</span>
          <strong>{destinationName}</strong>
        </div>
      </div>

      <div className="travel-splash__body">
        <div className="travel-splash__visual">
          <div className="travel-splash__icon-badge">
            <Icon className="travel-splash__icon-svg" />
          </div>
          <div className="travel-splash__mode">
            <div className="travel-splash__mode-name">{modeLabel}</div>
            <div className="travel-splash__mode-subtitle">{modeSubtitle}{hasEscort ? " + Hired Escort" : ""}</div>
          </div>
        </div>

        <div className="travel-splash__status">
          <div className="travel-splash__countdown" role="timer">
            {arrivingNow ? "Arriving..." : formatCountdown(progress.remainingMs)}
          </div>
          <div className="travel-splash__countdown-label">
            {arrivingNow ? "Confirming arrival with the road ahead" : "until arrival"}
          </div>

          <div className="travel-splash__track">
            <span className="travel-splash__track-fill" style={{ width: `${progress.percent}%` }} />
            <span
              className="travel-splash__track-marker"
              style={{ left: `${progress.percent}%` }}
              aria-hidden
            >
              <Icon className="travel-splash__track-icon" />
            </span>
          </div>
          <div className="travel-splash__track-meta">
            <span>{originName}</span>
            <span>{progress.percent}% complete</span>
            <span>{destinationName}</span>
          </div>
        </div>
      </div>

      {hasCargo || hasEscort ? (
        <div className="travel-splash__manifest">
          <div className="travel-splash__manifest-title">Traveling With You</div>
          <div className="travel-splash__manifest-rows">
            {hasCargo
              ? cargoLines.map((line) => (
                  <div key={line.itemId} className="travel-splash__manifest-row">
                    <span>{getItemLabelFallback(line.itemId, line.label)}</span>
                    <span>x{line.quantity}</span>
                  </div>
                ))
              : null}
            {hasEscort ? (
              <div className="travel-splash__manifest-row travel-splash__manifest-row--escort">
                <span>Hired Guard Escort</span>
                <span>Active</span>
              </div>
            ) : null}
          </div>
        </div>
      ) : null}

      {redirectedFrom ? (
        <div className="travel-splash__redirect-note">
          {prettyRouteLabel(redirectedFrom)} isn't available while you're en route to {destinationName}. It will unlock the moment you arrive.
        </div>
      ) : null}

      <div className="travel-splash__actions">
        <button type="button" className="travel-splash__cancel" onClick={onCancel} disabled={cancelBusy}>
          {cancelBusy ? "Turning back..." : "Turn Caravan Back"}
        </button>
        <Link to="/home" className="travel-splash__home-link">
          Return to Command Center
        </Link>
      </div>
    </section>
  );
}

export default TravelSplash;
