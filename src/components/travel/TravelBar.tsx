import { useState, useEffect, useRef } from "react";
import "../../styles/worldmap.css";

// ── Types ─────────────────────────────────────────────────────────────────────

type RouteType = "LAND" | "SEA";

export interface TravelProgress {
  /** City name the player is heading toward */
  destinationName: string;
  /** Timestamp (ms) when travel began */
  startTime: number;
  /** Total duration of travel in ms */
  durationMs: number;
  /** Travel method — affects color and icon */
  routeType: RouteType;
}

interface TravelBarProps {
  /** Pass null/undefined when not traveling — the bar will not render. */
  travel: TravelProgress | null | undefined;
  /** Called when travel completes and the arrival banner should disappear. */
  onArrivalDismiss?: () => void;
  /** Delay (ms) before auto-dismissing the arrival banner. Default: 3000. */
  arrivalDismissDelay?: number;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatCountdown(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  if (h > 0) {
    return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  }
  return `${m}:${String(s).padStart(2, "0")}`;
}

// ── Component ─────────────────────────────────────────────────────────────────

/**
 * TravelBar — Compact sidebar/topbar travel progress widget.
 *
 * Shows when the player is traveling:
 *   "→ Aethermoor  [====----]  42:18"
 *
 * On arrival, briefly displays "Arrived in Aethermoor!" then calls
 * onArrivalDismiss() so the parent can clear the travel state.
 *
 * Usage:
 *   <TravelBar
 *     travel={{
 *       destinationName: "Aethermoor",
 *       startTime: Date.now(),
 *       durationMs: 45 * 60 * 1000,
 *       routeType: "LAND",
 *     }}
 *     onArrivalDismiss={() => setTravel(null)}
 *   />
 */
export function TravelBar({
  travel,
  onArrivalDismiss,
  arrivalDismissDelay = 3000,
}: TravelBarProps) {
  const [remaining, setRemaining] = useState<number>(0);
  const [arrived, setArrived] = useState(false);
  const dismissTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!travel) {
      setArrived(false);
      return;
    }

    // Reset arrived state when a new trip starts
    setArrived(false);

    const tick = () => {
      const rem = travel.durationMs - (Date.now() - travel.startTime);
      if (rem <= 0) {
        setRemaining(0);
        setArrived(true);
        // Auto-dismiss after delay
        if (dismissTimer.current) clearTimeout(dismissTimer.current);
        dismissTimer.current = setTimeout(() => {
          onArrivalDismiss?.();
        }, arrivalDismissDelay);
      } else {
        setRemaining(rem);
      }
    };

    tick();
    const id = setInterval(tick, 1000);
    return () => {
      clearInterval(id);
      if (dismissTimer.current) clearTimeout(dismissTimer.current);
    };
  }, [travel, onArrivalDismiss, arrivalDismissDelay]);

  // Don't render anything if no travel data
  if (!travel) return null;

  const elapsed = Date.now() - travel.startTime;
  const progress = Math.min(1, elapsed / travel.durationMs);
  const isSea = travel.routeType === "SEA";
  const icon = isSea ? "⛵" : "🥾";

  // ── Arrival state ──────────────────────────────────────────────────────────
  if (arrived) {
    return (
      <div
        className={`travel-bar-compact travel-bar-compact--arrived${isSea ? " travel-bar-compact--sea" : ""}`}
        role="status"
        aria-live="polite"
        style={{
          justifyContent: "center",
          gap: "8px",
        }}
      >
        <span style={{ fontSize: "13px" }}>{icon}</span>
        <span
          style={{
            fontSize: "12px",
            fontWeight: 700,
            color: isSea ? "#4cc9f0" : "#78a94f",
          }}
        >
          Arrived in {travel.destinationName}!
        </span>
      </div>
    );
  }

  // ── In-transit state ───────────────────────────────────────────────────────
  return (
    <div
      className={`travel-bar-compact${isSea ? " travel-bar-compact--sea" : ""}`}
      role="status"
      aria-live="polite"
      title={`Traveling to ${travel.destinationName} — ${formatCountdown(remaining)} remaining`}
    >
      <span
        className="travel-bar-compact__arrow"
        aria-hidden="true"
        style={{ fontSize: "13px" }}
      >
        {icon}
      </span>

      <span className="travel-bar-compact__dest">
        → {travel.destinationName}
      </span>

      <div
        className="travel-bar-compact__bar"
        role="progressbar"
        aria-valuenow={Math.round(progress * 100)}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={`Travel progress to ${travel.destinationName}`}
      >
        <div
          className="travel-bar-compact__fill"
          style={{ width: `${Math.round(progress * 100)}%` }}
        />
      </div>

      <span className="travel-bar-compact__time" aria-label="Time remaining">
        {formatCountdown(remaining)}
      </span>
    </div>
  );
}

// ── Demo wrapper (for development / storybook use) ────────────────────────────

/**
 * TravelBarDemo — Self-contained demo that auto-starts a 60-second mock
 * travel so you can see the component in action without wiring real state.
 *
 * Do not include in production builds.
 */
export function TravelBarDemo() {
  const [travel, setTravel] = useState<TravelProgress | null>(null);

  const startLandTrip = () =>
    setTravel({
      destinationName: "Aethermoor",
      startTime: Date.now(),
      durationMs: 60 * 1000, // 60-second demo
      routeType: "LAND",
    });

  const startSeaTrip = () =>
    setTravel({
      destinationName: "Embervale",
      startTime: Date.now(),
      durationMs: 60 * 1000, // 60-second demo
      routeType: "SEA",
    });

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 8,
        maxWidth: 420,
        padding: 12,
        background: "#040607",
      }}
    >
      <TravelBar travel={travel} onArrivalDismiss={() => setTravel(null)} />

      {!travel && (
        <div style={{ display: "flex", gap: 8 }}>
          <button
            type="button"
            onClick={startLandTrip}
            style={{
              padding: "6px 12px",
              background: "#20341b",
              border: "1px solid #3d5a34",
              color: "#eef8e2",
              cursor: "pointer",
              fontSize: 12,
            }}
          >
            Demo Land Trip
          </button>
          <button
            type="button"
            onClick={startSeaTrip}
            style={{
              padding: "6px 12px",
              background: "#0d2030",
              border: "1px solid #1a4a60",
              color: "#c0e8f8",
              cursor: "pointer",
              fontSize: 12,
            }}
          >
            Demo Sea Trip
          </button>
        </div>
      )}
    </div>
  );
}

export default TravelBar;
