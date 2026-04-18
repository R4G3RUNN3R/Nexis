// ─────────────────────────────────────────────────────────────────────────────
// Nexis — StatBars
// Sidebar stat bars: Energy, Health, Stamina, Comfort.
// That's it. No Chain. No Nerve display.
// ─────────────────────────────────────────────────────────────────────────────

import { usePlayer } from "../../state/PlayerContext";

// ─── Regen intervals (ms) — must match PlayerContext ─────────────────────────
const ENERGY_INTERVAL_MS  = 5  * 60 * 1000;
const HEALTH_INTERVAL_MS  = 3  * 60 * 1000;
const STAMINA_INTERVAL_MS = 15 * 60 * 1000;
const COMFORT_INTERVAL_MS = 10 * 60 * 1000;

// ─── Colour palette ───────────────────────────────────────────────────────────
const COLOURS = {
  energy:  "#4caf50",   // green
  health:  "#e53935",   // red
  stamina: "#29b6f6",   // blue
  comfort: "#ab47bc",   // purple
} as const;

// ─── Helpers ──────────────────────────────────────────────────────────────────

function secsUntilNextTick(current: number, intervalMs: number): number {
  const fraction  = current - Math.floor(current);
  const remaining = 1 - fraction;
  const intervalSec = intervalMs / 1000;
  return Math.ceil(remaining * intervalSec);
}

function formatCountdown(secsLeft: number, isFull: boolean): string {
  if (isFull) return "Full";
  if (secsLeft <= 0) return "...";
  const m = Math.floor(secsLeft / 60);
  const s = secsLeft % 60;
  return m > 0 ? `${m}:${String(s).padStart(2, "0")}` : `${s}s`;
}

function formatTimeToFull(current: number, max: number, intervalMs: number) {
  if (current >= max) return "Already full";
  const remainingUnits = Math.max(0, max - current);
  const totalMs = Math.ceil(remainingUnits * intervalMs);
  const totalMinutes = Math.ceil(totalMs / 60000);
  const days = Math.floor(totalMinutes / (60 * 24));
  const hours = Math.floor((totalMinutes % (60 * 24)) / 60);
  const minutes = totalMinutes % 60;
  const parts: string[] = [];
  if (days > 0) parts.push(`${days}d`);
  if (hours > 0) parts.push(`${hours}h`);
  if (minutes > 0) parts.push(`${minutes}m`);
  return parts.join(" ") || "under 1m";
}

// ─── Single stat bar ──────────────────────────────────────────────────────────

function StatBar({
  label,
  current,
  max,
  colour,
  intervalMs,
}: {
  label: string;
  current: number;
  max: number;
  colour: string;
  intervalMs: number;
}) {
  const displayCurrent = Math.floor(current);
  const isFull = displayCurrent >= max;
  const pct = Math.min(100, (current / max) * 100);
  const secsLeft = isFull ? 0 : secsUntilNextTick(current, intervalMs);
  const countdown = formatCountdown(secsLeft, isFull);
  const isOver = displayCurrent > max;
  const title = `Next tick in ${countdown}. Full in ${formatTimeToFull(current, max, intervalMs)}.`;

  return (
    <div className="sb-row" title={title}>
      <div className="sb-row__label" style={{ color: colour }}>
        {label}:
      </div>
      <div className="sb-row__middle">
        <div className="sb-row__nums">
          {displayCurrent} / {max}
          {isOver && <span className="sb-over"> OVER</span>}
        </div>
        <div className="sb-track">
          <div
            className="sb-fill"
            style={{
              width: `${Math.min(100, pct)}%`,
              background: colour,
            }}
          />
        </div>
      </div>
      <div className={`sb-row__cd${isFull ? " sb-row__cd--full" : ""}`}>
        {countdown}
      </div>
    </div>
  );
}

// ─── Exported component ───────────────────────────────────────────────────────

export function StatBars() {
  const { player } = usePlayer();
  const { stats } = player;

  return (
    <div className="statbars">
      <StatBar
        label="Energy"
        current={stats.energy}
        max={stats.maxEnergy}
        colour={COLOURS.energy}
        intervalMs={ENERGY_INTERVAL_MS}
      />
      <StatBar
        label="Health"
        current={stats.health}
        max={stats.maxHealth}
        colour={COLOURS.health}
        intervalMs={HEALTH_INTERVAL_MS}
      />
      <StatBar
        label="Stamina"
        current={stats.stamina}
        max={stats.maxStamina}
        colour={COLOURS.stamina}
        intervalMs={STAMINA_INTERVAL_MS}
      />
      <StatBar
        label="Comfort"
        current={stats.comfort}
        max={stats.maxComfort}
        colour={COLOURS.comfort}
        intervalMs={COMFORT_INTERVAL_MS}
      />
    </div>
  );
}
