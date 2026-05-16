import { usePlayer } from "../../state/PlayerContext";

const ENERGY_INTERVAL_MS = 5 * 60 * 1000;
const HEALTH_INTERVAL_MS = 3 * 60 * 1000;
const STAMINA_INTERVAL_MS = 15 * 60 * 1000;
const COMFORT_INTERVAL_MS = 10 * 60 * 1000;

const COLORS = {
  energy: "#7eb85b",
  health: "#c76754",
  stamina: "#4f8ea4",
  comfort: "#c29a52",
} as const;

function secsUntilNextTick(current: number, intervalMs: number): number {
  const fraction = current - Math.floor(current);
  const remaining = 1 - fraction;
  return Math.ceil(remaining * (intervalMs / 1000));
}

function formatCountdown(secsLeft: number, isFull: boolean): string {
  if (isFull) return "Full";
  if (secsLeft <= 0) return "...";

  const minutes = Math.floor(secsLeft / 60);
  const seconds = secsLeft % 60;
  return minutes > 0 ? `${minutes}:${String(seconds).padStart(2, "0")}` : `${seconds}s`;
}

function formatTimeToFull(current: number, max: number, intervalMs: number) {
  if (current >= max) return "Already full";

  const remainingUnits = Math.max(0, max - current);
  const totalMinutes = Math.ceil((remainingUnits * intervalMs) / 60000);
  const days = Math.floor(totalMinutes / (60 * 24));
  const hours = Math.floor((totalMinutes % (60 * 24)) / 60);
  const minutes = totalMinutes % 60;
  const parts: string[] = [];

  if (days > 0) parts.push(`${days}d`);
  if (hours > 0) parts.push(`${hours}h`);
  if (minutes > 0) parts.push(`${minutes}m`);

  return parts.join(" ") || "under 1m";
}

function StatBar({
  label,
  current,
  max,
  color,
  intervalMs,
}: {
  label: string;
  current: number;
  max: number;
  color: string;
  intervalMs: number;
}) {
  const displayCurrent = Math.floor(current);
  const isFull = displayCurrent >= max;
  const percent = Math.min(100, (current / max) * 100);
  const countdown = formatCountdown(isFull ? 0 : secsUntilNextTick(current, intervalMs), isFull);
  const title = `Next recovery tick in ${countdown}. Full in ${formatTimeToFull(current, max, intervalMs)}.`;

  return (
    <div className="sb-row" title={title}>
      <div className="sb-row__copy">
        <div className="sb-row__topline">
          <span className="sb-row__label">{label}</span>
          <span className="sb-row__nums">
            {displayCurrent} / {max}
          </span>
        </div>
        <div className="sb-track">
          <div
            className="sb-fill"
            style={{
              width: `${percent}%`,
              background: `linear-gradient(90deg, ${color} 0%, ${color}dd 100%)`,
              boxShadow: `0 0 14px ${color}33`,
            }}
          />
        </div>
      </div>
      <div className={`sb-row__cd${isFull ? " sb-row__cd--full" : ""}`}>{countdown}</div>
    </div>
  );
}

export function StatBars() {
  const { player } = usePlayer();
  const { stats } = player;

  return (
    <div className="statbars">
      <div className="statbars__header">
        <span>Vital reserves</span>
        <strong>Recovery ledger</strong>
      </div>

      <StatBar
        label="Energy"
        current={stats.energy}
        max={stats.maxEnergy}
        color={COLORS.energy}
        intervalMs={ENERGY_INTERVAL_MS}
      />
      <StatBar
        label="Health"
        current={stats.health}
        max={stats.maxHealth}
        color={COLORS.health}
        intervalMs={HEALTH_INTERVAL_MS}
      />
      <StatBar
        label="Stamina"
        current={stats.stamina}
        max={stats.maxStamina}
        color={COLORS.stamina}
        intervalMs={STAMINA_INTERVAL_MS}
      />
      <StatBar
        label="Comfort"
        current={stats.comfort}
        max={stats.maxComfort}
        color={COLORS.comfort}
        intervalMs={COMFORT_INTERVAL_MS}
      />
    </div>
  );
}
