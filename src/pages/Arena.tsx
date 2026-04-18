import { useEffect, useMemo, useState } from "react";
import { AppShell } from "../components/layout/AppShell";
import { getPropertyBattleTrainingMultiplier } from "../data/propertyData";
import { getArenaStateKey } from "../lib/arenaState";
import { usePlayer } from "../state/PlayerContext";
import "../styles/arena.css";

type BattleStat = "strength" | "defense" | "speed" | "dexterity";

type ArenaDef = {
  id: string;
  name: string;
  tier: number;
  energyCost: number;
  unlockEnergySpent: number;
  unlockCost: number;
  flavor: string;
  gains: Record<BattleStat, number>;
};

type TrainResult = {
  stat: BattleStat;
  trains: number;
  energyUsed: number;
  comfortUsed: number;
  totalGain: number;
  newTotal: number;
  xpGained: number;
  arenaName: string;
  averageComfortMultiplier: number;
  unlockedNextArena: boolean;
};

const ARENAS: ArenaDef[] = [
  { id: "iron_pit", name: "Iron Pit", tier: 1, energyCost: 5, unlockEnergySpent: 0, unlockCost: 0, flavor: "A crude starter arena built around raw effort and bruised pride.", gains: { strength: 2.0, defense: 2.0, speed: 2.0, dexterity: 2.0 } },
  { id: "stone_guard_yard", name: "Stone Guard Yard", tier: 1, energyCost: 5, unlockEnergySpent: 150, unlockCost: 500, flavor: "Guard drills, shield walls, and very little sympathy.", gains: { strength: 2.2, defense: 2.6, speed: 2.0, dexterity: 2.1 } },
  { id: "windrunner_court", name: "Windrunner Court", tier: 1, energyCost: 5, unlockEnergySpent: 350, unlockCost: 1200, flavor: "Sprints, footwork lanes, and enough exhaustion to become religious.", gains: { strength: 2.0, defense: 2.1, speed: 2.8, dexterity: 2.4 } },
  { id: "silent_step_hall", name: "Silent Step Hall", tier: 1, energyCost: 5, unlockEnergySpent: 700, unlockCost: 2500, flavor: "Precision forms and evasive drills for people who dislike being hit.", gains: { strength: 1.8, defense: 2.2, speed: 2.4, dexterity: 3.0 } },
  { id: "bastion_forge", name: "Bastion Forge", tier: 1, energyCost: 5, unlockEnergySpent: 1200, unlockCost: 5000, flavor: "Hammer chains, weighted plates, and enough impact work to rattle the bones.", gains: { strength: 3.2, defense: 3.0, speed: 2.4, dexterity: 2.6 } },

  { id: "wolf_den", name: "Wolf Den", tier: 2, energyCost: 10, unlockEnergySpent: 2000, unlockCost: 15000, flavor: "Predatory pressure training with faster returns and nastier bruises.", gains: { strength: 4.0, defense: 3.6, speed: 3.4, dexterity: 3.6 } },
  { id: "tower_break", name: "Tower Break", tier: 2, energyCost: 10, unlockEnergySpent: 3200, unlockCost: 30000, flavor: "Heavy-contact conditioning and defensive punishment drills.", gains: { strength: 4.2, defense: 4.8, speed: 3.2, dexterity: 3.4 } },
  { id: "razor_lane", name: "Razor Lane", tier: 2, energyCost: 10, unlockEnergySpent: 4600, unlockCost: 60000, flavor: "Speed corridors and reaction traps for the terminally competitive.", gains: { strength: 3.4, defense: 3.6, speed: 5.0, dexterity: 4.2 } },
  { id: "veil_arena", name: "Veil Arena", tier: 2, energyCost: 10, unlockEnergySpent: 6200, unlockCost: 100000, flavor: "Dexterity-focused pattern work where mistakes become very public.", gains: { strength: 3.2, defense: 3.8, speed: 4.2, dexterity: 5.0 } },
  { id: "war_hall", name: "War Hall", tier: 2, energyCost: 10, unlockEnergySpent: 8000, unlockCost: 175000, flavor: "Balanced combat practice for people who want all four stats moving upward.", gains: { strength: 5.0, defense: 5.0, speed: 5.0, dexterity: 5.0 } },

  { id: "titan_crucible", name: "Titan Crucible", tier: 3, energyCost: 15, unlockEnergySpent: 11000, unlockCost: 300000, flavor: "Elite strength work under brutal load progression.", gains: { strength: 6.4, defense: 5.6, speed: 4.8, dexterity: 5.0 } },
  { id: "bulwark_cells", name: "Bulwark Cells", tier: 3, energyCost: 15, unlockEnergySpent: 14500, unlockCost: 500000, flavor: "Sustained punishment drills for those building impossible resilience.", gains: { strength: 5.2, defense: 6.8, speed: 4.8, dexterity: 5.0 } },
  { id: "skybreak_track", name: "Skybreak Track", tier: 3, energyCost: 15, unlockEnergySpent: 18500, unlockCost: 800000, flavor: "Acceleration, stride, and motion efficiency tuned toward speed.", gains: { strength: 4.8, defense: 5.0, speed: 7.0, dexterity: 5.8 } },
  { id: "phantom_wire", name: "Phantom Wire", tier: 3, energyCost: 15, unlockEnergySpent: 23000, unlockCost: 1200000, flavor: "Evasion grids and weapon-line drills built around dexterity.", gains: { strength: 4.6, defense: 5.0, speed: 5.8, dexterity: 7.0 } },
  { id: "champions_square", name: "Champion's Square", tier: 3, energyCost: 15, unlockEnergySpent: 28000, unlockCost: 1750000, flavor: "Where contenders are sanded down into monsters with balanced output.", gains: { strength: 7.0, defense: 7.0, speed: 7.0, dexterity: 7.0 } },

  { id: "dragons_anvil", name: "Dragon's Anvil", tier: 4, energyCost: 20, unlockEnergySpent: 34000, unlockCost: 2500000, flavor: "Legend-tier pressure for those who still think their body belongs to them.", gains: { strength: 8.5, defense: 7.2, speed: 6.2, dexterity: 6.4 } },
  { id: "blackwall_keep", name: "Blackwall Keep", tier: 4, energyCost: 20, unlockEnergySpent: 41000, unlockCost: 3500000, flavor: "Defense-centric training where survival itself feels optional.", gains: { strength: 6.4, defense: 8.8, speed: 6.2, dexterity: 6.6 } },
  { id: "stormglass_loop", name: "Stormglass Loop", tier: 4, energyCost: 20, unlockEnergySpent: 49000, unlockCost: 5000000, flavor: "A final speed arena designed for reckless feet and bad decisions.", gains: { strength: 6.0, defense: 6.4, speed: 9.0, dexterity: 7.6 } },
  { id: "ghost_bloom_dojo", name: "Ghost Bloom Dojo", tier: 4, energyCost: 20, unlockEnergySpent: 58000, unlockCost: 6500000, flavor: "Dexterity mastery through impossible timing and elegant cruelty.", gains: { strength: 5.8, defense: 6.4, speed: 7.8, dexterity: 9.0 } },
  { id: "crownfall_coliseum", name: "Crownfall Coliseum", tier: 4, energyCost: 20, unlockEnergySpent: 68000, unlockCost: 8000000, flavor: "The highest standard arena. Nothing left but refinement, pain, and numbers.", gains: { strength: 9.5, defense: 9.5, speed: 9.5, dexterity: 9.5 } },
];

const STAT_LABELS: Record<BattleStat, string> = {
  strength: "Strength",
  defense: "Defense",
  speed: "Speed",
  dexterity: "Dexterity",
};
const STAT_DESCRIPTIONS: Record<BattleStat, string> = {
  strength: "Damage you impose on impact.",
  defense: "Ability to withstand incoming damage.",
  speed: "Chance of hitting before the opponent reacts.",
  dexterity: "Ability to evade and control an exchange.",
};
const MAX_COMFORT_GAIN_BONUS = 0.1;

function readArenaState(playerId: string) {
  if (typeof window === "undefined") {
    return { unlockedArenaIds: [ARENAS[0].id], selectedArenaId: ARENAS[0].id, totalEnergySpent: 0, logs: [] as string[] };
  }
  try {
    const raw = window.localStorage.getItem(getArenaStateKey(playerId));
    if (!raw) {
      return { unlockedArenaIds: [ARENAS[0].id], selectedArenaId: ARENAS[0].id, totalEnergySpent: 0, logs: [] as string[] };
    }
    const parsed = JSON.parse(raw) as { unlockedArenaIds?: string[]; selectedArenaId?: string; totalEnergySpent?: number; logs?: string[] };
    return {
      unlockedArenaIds: parsed.unlockedArenaIds?.length ? parsed.unlockedArenaIds : [ARENAS[0].id],
      selectedArenaId: parsed.selectedArenaId ?? ARENAS[0].id,
      totalEnergySpent: parsed.totalEnergySpent ?? 0,
      logs: parsed.logs ?? [],
    };
  } catch {
    return { unlockedArenaIds: [ARENAS[0].id], selectedArenaId: ARENAS[0].id, totalEnergySpent: 0, logs: [] as string[] };
  }
}

function writeArenaState(playerId: string, value: { unlockedArenaIds: string[]; selectedArenaId: string; totalEnergySpent: number; logs: string[] }) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(getArenaStateKey(playerId), JSON.stringify(value));
}

function formatNumber(value: number) {
  return value.toLocaleString("en-GB", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function getTierXp(tier: number) {
  return tier;
}

function getComfortCostPerTrain(arena: ArenaDef) {
  return Math.max(1, Math.ceil(arena.energyCost / 5));
}

function getComfortGainMultiplier(currentComfort: number, maxComfort: number) {
  if (maxComfort <= 0) return 1;
  const comfortRatio = Math.max(0, Math.min(1, currentComfort / maxComfort));
  return 1 + comfortRatio * MAX_COMFORT_GAIN_BONUS;
}

function getAverageMultiplier(totalMultiplier: number, trains: number) {
  if (trains <= 0) return 1;
  return parseFloat((totalMultiplier / trains).toFixed(2));
}

function simulateArenaTraining({
  currentStat,
  baseMultiplier,
  trains,
  currentComfort,
  maxComfort,
  comfortCostPerTrain,
  propertyTrainingMultiplier,
  useRandomness,
}: {
  currentStat: number;
  baseMultiplier: number;
  trains: number;
  currentComfort: number;
  maxComfort: number;
  comfortCostPerTrain: number;
  propertyTrainingMultiplier: number;
  useRandomness: boolean;
}) {
  let total = 0;
  let comfortRemaining = currentComfort;
  let totalComfortMultiplier = 0;

  for (let i = 0; i < trains; i += 1) {
    const comfortMultiplier = getComfortGainMultiplier(comfortRemaining, maxComfort);
    const statFactor = Math.sqrt(Math.max(currentStat + total, 0) + 100) / 10;
    const randomness = useRandomness ? 0.92 + Math.random() * 0.18 : 1;
    totalComfortMultiplier += comfortMultiplier;
    total += baseMultiplier * propertyTrainingMultiplier * comfortMultiplier * statFactor * randomness;
    comfortRemaining = Math.max(0, comfortRemaining - comfortCostPerTrain);
  }

  const totalComfortCost = Math.min(currentComfort, comfortCostPerTrain * trains);

  return {
    totalGain: parseFloat(total.toFixed(2)),
    comfortUsed: Math.floor(totalComfortCost),
    averageComfortMultiplier: getAverageMultiplier(totalComfortMultiplier, trains),
  };
}

export default function ArenaPage() {
  const {
    player,
    spendEnergy,
    spendComfort,
    spendGold,
    addBattleStat,
    addExperience,
    isHospitalized,
    isJailed,
  } = usePlayer();
  const [arenaState, setArenaState] = useState(() => readArenaState(player.internalId));
  const [trainQty, setTrainQty] = useState(1);
  const [toast, setToast] = useState<TrainResult | null>(null);

  useEffect(() => {
    setArenaState(readArenaState(player.internalId));
  }, [player.internalId]);

  useEffect(() => {
    writeArenaState(player.internalId, arenaState);
  }, [player.internalId, arenaState]);

  const selectedArena = useMemo(
    () => ARENAS.find((arena) => arena.id === arenaState.selectedArenaId) ?? ARENAS[0],
    [arenaState.selectedArenaId],
  );

  const unlockedSet = useMemo(() => new Set(arenaState.unlockedArenaIds), [arenaState.unlockedArenaIds]);
  const nextArena = useMemo(() => {
    const currentIndex = ARENAS.findIndex((arena) => arena.id === selectedArena.id);
    return currentIndex >= 0 ? ARENAS[currentIndex + 1] ?? null : null;
  }, [selectedArena.id]);
  const comfortCostPerTrain = useMemo(() => getComfortCostPerTrain(selectedArena), [selectedArena]);
  const currentComfortMultiplier = useMemo(
    () => getComfortGainMultiplier(player.stats.comfort, player.stats.maxComfort),
    [player.stats.comfort, player.stats.maxComfort],
  );
  const propertyTrainingMultiplier = useMemo(
    () => getPropertyBattleTrainingMultiplier(player.property.current, player.property.installedUpgrades),
    [player.property.current, player.property.installedUpgrades],
  );

  function selectArena(arenaId: string) {
    if (!unlockedSet.has(arenaId)) return;
    setArenaState((prev) => ({ ...prev, selectedArenaId: arenaId }));
  }

  function unlockArena(arena: ArenaDef) {
    if (unlockedSet.has(arena.id)) return;
    if (arenaState.totalEnergySpent < arena.unlockEnergySpent) return;
    const paid = spendGold(arena.unlockCost);
    if (!paid) return;
    setArenaState((prev) => ({
      ...prev,
      unlockedArenaIds: [...prev.unlockedArenaIds, arena.id],
      selectedArenaId: arena.id,
    }));
  }

  function handleTrain(stat: BattleStat) {
    if (isHospitalized || isJailed) return;
    const energyNeeded = selectedArena.energyCost * trainQty;
    if (player.stats.energy < energyNeeded) return;
    const multiplier = selectedArena.gains[stat];
    if (multiplier <= 0) return;

    const currentStat = player.battleStats[stat];
    const trainingResult = simulateArenaTraining({
      currentStat,
      baseMultiplier: multiplier,
      trains: trainQty,
      currentComfort: player.stats.comfort,
      maxComfort: player.stats.maxComfort,
      comfortCostPerTrain,
      propertyTrainingMultiplier,
      useRandomness: true,
    });
    const newTotal = parseFloat((currentStat + trainingResult.totalGain).toFixed(2));

    spendEnergy(energyNeeded);
    if (trainingResult.comfortUsed > 0) spendComfort(trainingResult.comfortUsed);
    addBattleStat(stat, trainingResult.totalGain);
    addExperience(getTierXp(selectedArena.tier) * trainQty);

    let unlockedNextArena = false;
    const newEnergySpent = arenaState.totalEnergySpent + energyNeeded;
    if (nextArena && newEnergySpent >= nextArena.unlockEnergySpent && !unlockedSet.has(nextArena.id)) {
      unlockedNextArena = true;
    }

    const trainTimesLabel = trainQty > 1 ? ` ${trainQty} times` : "";
    const logLine = `You used ${energyNeeded} energy and ${trainingResult.comfortUsed} comfort training your ${stat}${trainTimesLabel} in ${selectedArena.name} increasing it by ${formatNumber(trainingResult.totalGain)} to ${formatNumber(newTotal)}. Average comfort bonus x${trainingResult.averageComfortMultiplier.toFixed(2)}.`;

    setArenaState((prev) => ({
      ...prev,
      totalEnergySpent: newEnergySpent,
      logs: [logLine, ...prev.logs].slice(0, 40),
    }));

    setToast({
      stat,
      trains: trainQty,
      energyUsed: energyNeeded,
      comfortUsed: trainingResult.comfortUsed,
      totalGain: trainingResult.totalGain,
      newTotal,
      xpGained: getTierXp(selectedArena.tier) * trainQty,
      arenaName: selectedArena.name,
      averageComfortMultiplier: trainingResult.averageComfortMultiplier,
      unlockedNextArena,
    });
  }

  const qtyOptions = [1, 5, 10];

  return (
    <AppShell title="Arena" hint="Train battle stats, unlock stronger arenas, and build power without accidentally power-leveling into absurdity.">
      <div className="arena-page">
        <div className="arena-panel">
          <div className="arena-panel__head">
            <div>
              <div className="arena-panel__subtitle">Current Arena</div>
              <h2 className="arena-panel__title">{selectedArena.name}</h2>
              <p className="arena-panel__desc">{selectedArena.flavor}</p>
            </div>
          </div>

          <div className="arena-energy-row">
            <span className="arena-energy-label">Energy Available</span>
            <span className={`arena-energy-val${player.stats.energy < selectedArena.energyCost ? " arena-energy-val--low" : ""}`}>{Math.floor(player.stats.energy)}/{player.stats.maxEnergy}</span>
            <span className="arena-energy-cost">{selectedArena.energyCost} energy per train</span>
          </div>
          <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginBottom: 12, color: "#6a7a8a", fontSize: 12 }}>
            <span>Comfort {Math.floor(player.stats.comfort)} / {player.stats.maxComfort}</span>
            <span>{comfortCostPerTrain} comfort per train</span>
            <span>Comfort bonus x{currentComfortMultiplier.toFixed(2)}</span>
            {propertyTrainingMultiplier > 1 ? <span>Property bonus x{propertyTrainingMultiplier.toFixed(2)}</span> : null}
          </div>

          {isHospitalized ? <div className="arena-status-banner">You cannot train while hospitalized.</div> : null}
          {isJailed ? <div className="arena-status-banner arena-status-banner--locked">You cannot use standard arenas while jailed.</div> : null}

          {toast ? (
            <div className="arena-toast">
              <div className="arena-toast__body">
                <span className="arena-toast__stat">{STAT_LABELS[toast.stat]}</span>
                <span className="arena-toast__gained">+{formatNumber(toast.totalGain)}</span>
                <span className="arena-toast__complete">New total {formatNumber(toast.newTotal)} | -{toast.comfortUsed} Comfort</span>
                <span className="arena-toast__complete">Average comfort bonus x{toast.averageComfortMultiplier.toFixed(2)}</span>
                {toast.unlockedNextArena ? <span className="arena-toast__unlock">A new arena can now be purchased.</span> : null}
              </div>
              <button type="button" className="arena-toast__dismiss" onClick={() => setToast(null)}>x</button>
            </div>
          ) : null}

          <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
            <span className="arena-energy-label">Train Quantity</span>
            {qtyOptions.map((qty) => (
              <button
                key={qty}
                type="button"
                className={`arena-panel__spec-chip${trainQty === qty ? "" : ""}`}
                onClick={() => setTrainQty(qty)}
              >
                {qty}
              </button>
            ))}
          </div>

          <div className="arena-train-grid">
            {(["strength", "defense", "speed", "dexterity"] as BattleStat[]).map((stat) => {
              const multiplier = selectedArena.gains[stat];
              const disabled = multiplier <= 0 || isHospitalized || isJailed || player.stats.energy < selectedArena.energyCost * trainQty;
              const estimatedGain = multiplier > 0
                ? simulateArenaTraining({
                    currentStat: player.battleStats[stat],
                    baseMultiplier: multiplier,
                    trains: trainQty,
                    currentComfort: player.stats.comfort,
                    maxComfort: player.stats.maxComfort,
                    comfortCostPerTrain,
                    propertyTrainingMultiplier,
                    useRandomness: false,
                  }).totalGain
                : 0;
              return (
                <button
                  key={stat}
                  type="button"
                  className={`arena-train-btn${disabled ? " arena-train-btn--disabled" : ""}`}
                  onClick={() => handleTrain(stat)}
                  disabled={disabled}
                >
                  <span className="arena-train-btn__stat">{STAT_LABELS[stat]}</span>
                  <span className="arena-train-btn__gain">{multiplier > 0 ? `+${formatNumber(estimatedGain)}` : "Unavailable"}</span>
                  <span className="arena-train-btn__spec">{STAT_DESCRIPTIONS[stat]}</span>
                </button>
              );
            })}
          </div>

          <div className="arena-current-stats">
            <div className="arena-current-stats__title">Current Battle Stats</div>
            <div className="arena-current-stats__grid">
              {(["strength", "defense", "speed", "dexterity"] as BattleStat[]).map((stat) => (
                <div key={stat} className="arena-stat-cell">
                  <span className="arena-stat-cell__label">{STAT_LABELS[stat]}</span>
                  <strong className="arena-stat-cell__val">{formatNumber(player.battleStats[stat])}</strong>
                </div>
              ))}
            </div>
          </div>
        </div>

        <section className="panel">
          <div className="panel__header"><h2>Arenas</h2></div>
          <div className="panel__body">
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 8 }}>
              {ARENAS.map((arena) => {
                const unlocked = unlockedSet.has(arena.id);
                const canBuy = !unlocked && arenaState.totalEnergySpent >= arena.unlockEnergySpent;
                const selected = arena.id === selectedArena.id;
                return (
                  <div key={arena.id} className={`arena-tier-card${selected ? " arena-tier-card--active" : ""}${!unlocked ? " arena-tier-card--locked" : ""}`}>
                    <div className="arena-tier-card__header">
                      <span className="arena-tier-card__subtitle">Tier {arena.tier}</span>
                      {!unlocked ? <span className="arena-tier-card__badge arena-tier-card__badge--locked">Locked</span> : null}
                    </div>
                    <div className="arena-tier-card__name">{arena.name}</div>
                    <div className="arena-tier-card__desc">{arena.flavor}</div>
                    <div className="arena-tier-card__meta">Unlock threshold: {arena.unlockEnergySpent.toLocaleString()} energy spent</div>
                    <div className="arena-tier-card__meta">Membership: {arena.unlockCost.toLocaleString()} gold</div>
                    {unlocked ? (
                      <button type="button" className="arena-panel__spec-chip" onClick={() => selectArena(arena.id)}>Activate</button>
                    ) : canBuy ? (
                      <button type="button" className="arena-panel__spec-chip" onClick={() => unlockArena(arena)}>Buy Membership</button>
                    ) : (
                      <div className="arena-tier-card__meta">Need {Math.max(0, arena.unlockEnergySpent - arenaState.totalEnergySpent).toLocaleString()} more energy spent</div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </section>

        <section className="panel">
          <div className="panel__header"><h2>Recent Training Log</h2></div>
          <div className="panel__body">
            <div className="info-list">
              {arenaState.logs.length ? arenaState.logs.map((entry, index) => (
                <div key={`${index}-${entry.slice(0, 24)}`} className="info-row" style={{ alignItems: "flex-start" }}>
                  <span className="info-row__label">Train {arenaState.logs.length - index}</span>
                  <span className="info-row__value" style={{ textAlign: "left", flex: 1 }}>{entry}</span>
                </div>
              )) : <div className="info-row"><span className="info-row__label">No training recorded yet.</span></div>}
            </div>
          </div>
        </section>
      </div>
    </AppShell>
  );
}
