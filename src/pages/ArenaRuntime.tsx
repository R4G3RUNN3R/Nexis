import { useMemo, useState } from "react";
import { AppShell } from "../components/layout/AppShell";
import { arenaTiers, type ArenaTier, type BattleStat } from "../data/arenaData";
import {
  getPlayerArmor,
  getPlayerWeapon,
  resolvePvpBattle,
  type CombatResolution,
  WANTED_TARGETS,
} from "../data/combatData";
import {
  buildHouseholdCombatTarget,
  getActivePropertyDefenders,
  getDiminishingRewardMultiplier,
  getEffectivePropertySecurity,
  RIVAL_PLAYER_TARGETS,
} from "../data/playerTargetData";
import { useArena, type TrainResult } from "../state/ArenaContext";
import { useCrimeRuntime } from "../state/CrimeRuntimeContext";
import { useEquipmentRuntime } from "../state/EquipmentRuntimeContext";
import { useLegacyRuntime } from "../state/LegacyRuntimeContext";
import { usePlayer } from "../state/PlayerContext";
import { useSkillsRuntime } from "../state/SkillsRuntimeContext";
import "../styles/arena.css";

const STAT_LABELS: Record<BattleStat, string> = {
  strength: "Strength",
  defense: "Defense",
  speed: "Speed",
  dexterity: "Dexterity",
};

const STAT_ORDER: BattleStat[] = ["strength", "defense", "speed", "dexterity"];

type ArenaTab = "training" | "bounties" | "player_hunts";

function OutcomeToast({ result, onDismiss }: { result: TrainResult; onDismiss: () => void }) {
  return (
    <div className="arena-toast">
      <div className="arena-toast__body">
        <span className="arena-toast__stat">{STAT_LABELS[result.stat]}</span>
        <span className="arena-toast__gained">
          +{result.gained}
          {result.isSpecialty ? <span className="arena-toast__specialty"> * specialty</span> : null}
        </span>
      </div>
      {result.tierComplete && !result.nextTierUnlocked ? (
        <div className="arena-toast__complete">Tier maxed - all arenas complete for now.</div>
      ) : null}
      {result.nextTierUnlocked && result.nextTierName ? (
        <div className="arena-toast__unlock">Next arena unlocked: {result.nextTierName}</div>
      ) : null}
      <button
        type="button"
        className="arena-toast__dismiss"
        onClick={onDismiss}
        aria-label="Dismiss"
      >
        x
      </button>
    </div>
  );
}

function TierCard({
  tier,
  isActive,
  isLocked,
  isMaxed,
  onClick,
}: {
  tier: ArenaTier;
  isActive: boolean;
  isLocked: boolean;
  isMaxed: boolean;
  onClick: () => void;
}) {
  const { getTierProgress } = useArena();
  const progress = getTierProgress(tier.id);

  return (
    <button
      type="button"
      className={[
        "arena-tier-card",
        isActive ? "arena-tier-card--active" : "",
        isLocked ? "arena-tier-card--locked" : "",
        isMaxed ? "arena-tier-card--maxed" : "",
      ]
        .filter(Boolean)
        .join(" ")}
      onClick={onClick}
      disabled={isLocked}
    >
      <div className="arena-tier-card__header">
        <span className="arena-tier-card__subtitle">{tier.subtitle}</span>
        {isMaxed ? <span className="arena-tier-card__badge arena-tier-card__badge--maxed">MAXED</span> : null}
        {isLocked ? <span className="arena-tier-card__badge arena-tier-card__badge--locked">LOCKED</span> : null}
      </div>
      <div className="arena-tier-card__name">{tier.name}</div>
      <div className="arena-tier-card__desc">{tier.description}</div>
      <div className="arena-tier-card__progress-track">
        <div className="arena-tier-card__progress-fill" style={{ width: `${progress.pct}%` }} />
      </div>
      <div className="arena-tier-card__meta">
        {progress.sessions.toLocaleString()} / {tier.totalToMax.toLocaleString()} sessions · {tier.energyCost} energy each
      </div>
    </button>
  );
}

function TrainingPanel({ tier }: { tier: ArenaTier }) {
  const { player, isHospitalized, isJailed } = usePlayer();
  const { train, getTierProgress, isTierUnlocked } = useArena();
  const [lastResult, setLastResult] = useState<TrainResult | null>(null);
  const progress = getTierProgress(tier.id);
  const unlocked = isTierUnlocked(tier.id);
  const energy = Math.floor(player.stats.energy);
  const canTrain = unlocked && !progress.maxed && !isHospitalized && !isJailed && energy >= tier.energyCost;

  function handleTrain(stat: BattleStat) {
    const result = train(tier.id, stat);
    if (!result) return;
    setLastResult(result);
    window.setTimeout(() => setLastResult(null), 4000);
  }

  return (
    <div className="arena-panel">
      <div className="arena-panel__head">
        <div>
          <div className="arena-panel__subtitle">{tier.subtitle}</div>
          <h2 className="arena-panel__title">{tier.name}</h2>
          <p className="arena-panel__desc">{tier.flavour}</p>
        </div>
      </div>

      <div className="arena-panel__progress">
        <div className="arena-panel__progress-labels">
          <span>Progress</span>
          <span>
            {progress.sessions.toLocaleString()} / {tier.totalToMax.toLocaleString()}
            {progress.maxed ? " - Maxed" : ""}
          </span>
        </div>
        <div className="arena-panel__progress-track">
          <div className="arena-panel__progress-fill" style={{ width: `${progress.pct}%` }} />
        </div>
      </div>

      <div className="arena-panel__specialties">
        <span className="arena-panel__spec-label">Specialty bonus</span>
        {tier.specialtyStats.map((stat) => (
          <span key={stat} className="arena-panel__spec-chip">
            {STAT_LABELS[stat]} x{tier.bonusMultiplier}
          </span>
        ))}
      </div>

      {isHospitalized ? <div className="arena-status-banner">You are hospitalized - training suspended.</div> : null}
      {isJailed ? <div className="arena-status-banner">You are in custody - training suspended.</div> : null}
      {!unlocked ? <div className="arena-status-banner arena-status-banner--locked">Complete the previous tier to unlock this arena.</div> : null}
      {progress.maxed ? <div className="arena-status-banner arena-status-banner--maxed">This tier is fully trained.</div> : null}

      {!progress.maxed && unlocked ? (
        <div className="arena-energy-row">
          <span className="arena-energy-label">Energy</span>
          <span className={`arena-energy-val${energy < tier.energyCost ? " arena-energy-val--low" : ""}`}>
            {energy} / {player.stats.maxEnergy}
          </span>
          <span className="arena-energy-cost">({tier.energyCost} per session)</span>
        </div>
      ) : null}

      {lastResult ? <OutcomeToast result={lastResult} onDismiss={() => setLastResult(null)} /> : null}

      {!progress.maxed && unlocked ? (
        <div className="arena-train-grid">
          {STAT_ORDER.map((stat) => {
            const isSpecialty = tier.specialtyStats.includes(stat);
            const gainPreview = (tier.baseGainPerSession * (isSpecialty ? tier.bonusMultiplier : 1)).toFixed(2);
            return (
              <button
                key={stat}
                type="button"
                className={[
                  "arena-train-btn",
                  isSpecialty ? "arena-train-btn--specialty" : "",
                  !canTrain ? "arena-train-btn--disabled" : "",
                ]
                  .filter(Boolean)
                  .join(" ")}
                disabled={!canTrain}
                onClick={() => handleTrain(stat)}
              >
                <span className="arena-train-btn__stat">{STAT_LABELS[stat]}</span>
                <span className="arena-train-btn__gain">+{gainPreview}</span>
                {isSpecialty ? <span className="arena-train-btn__spec">* specialty</span> : null}
              </button>
            );
          })}
        </div>
      ) : null}

      <div className="arena-current-stats">
        <div className="arena-current-stats__title">Your Battle Stats</div>
        <div className="arena-current-stats__grid">
          {STAT_ORDER.map((stat) => (
            <div key={stat} className="arena-stat-cell">
              <span className="arena-stat-cell__label">{STAT_LABELS[stat]}</span>
              <strong className="arena-stat-cell__val">{player.battleStats[stat].toFixed(2)}</strong>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function BountyPanel() {
  const { player, spendEnergy, addGold, hospitalizeFor, isHospitalized, isJailed } = usePlayer();
  const { crimeState, addHeat, reduceHeat, recordBounty } = useCrimeRuntime();
  const { equipmentState } = useEquipmentRuntime();
  const { getNodeLevel } = useLegacyRuntime();
  const { gainSkillXp } = useSkillsRuntime();
  const [selectedTargetId, setSelectedTargetId] = useState(WANTED_TARGETS[0]?.id ?? "");
  const [nonLethal, setNonLethal] = useState(true);
  const [lastCombat, setLastCombat] = useState<CombatResolution | null>(null);

  const selectedTarget = useMemo(
    () => WANTED_TARGETS.find((target) => target.id === selectedTargetId) ?? WANTED_TARGETS[0],
    [selectedTargetId]
  );
  const canFight = !isHospitalized && !isJailed && player.stats.energy >= 25;

  const battleLine = getNodeLevel("battle", "battle_stat_line");
  const battleVitality = getNodeLevel("battle", "battle_vitality");
  const weaponAccuracy = getNodeLevel("weapon_mastery", "weapon_accuracy");
  const weaponPressure = getNodeLevel("weapon_mastery", "weapon_pressure");
  const bountyTracking = getNodeLevel("arrest_bounty", "bounty_tracking");
  const arrestControl = getNodeLevel("arrest_bounty", "arrest_control");

  const statMultiplier = 1 + battleLine * 0.03;
  const hpMultiplier = 1 + battleVitality * 0.05;
  const bountyRewardMultiplier = 1 + bountyTracking * 0.03;
  const arrestReliabilityBonus = arrestControl * 0.02;

  const equippedWeaponBase = getPlayerWeapon(equipmentState.equippedWeaponId);
  const equippedWeapon = {
    ...equippedWeaponBase,
    accuracyMod: equippedWeaponBase.accuracyMod + weaponAccuracy * 2,
    baseDamage: Math.round(equippedWeaponBase.baseDamage * (1 + weaponPressure * 0.01)),
  };
  const equippedArmor = getPlayerArmor(equipmentState.equippedArmorId);

  const effectivePlayerStats = {
    strength: player.battleStats.strength * statMultiplier,
    dexterity: player.battleStats.dexterity * statMultiplier,
    endurance: player.workingStats.endurance,
    defense: player.battleStats.defense * statMultiplier,
    speed: player.battleStats.speed * statMultiplier,
    maxHp: Math.round(player.stats.maxHealth * hpMultiplier),
    currentHp: Math.min(
      Math.round(player.stats.health * hpMultiplier),
      Math.round(player.stats.maxHealth * hpMultiplier)
    ),
  };

  function handleFight() {
    if (!selectedTarget || !canFight) return;

    spendEnergy(25);
    const result = resolvePvpBattle({
      playerStats: effectivePlayerStats,
      playerWeapon: equippedWeapon,
      playerArmor: equippedArmor,
      target: selectedTarget,
      nonLethal,
      maxTurns: 25,
      bountyRewardMultiplier,
      arrestReliabilityBonus,
    });

    setLastCombat(result);
    gainSkillXp("combat_reading", result.outcome === "timeout" ? 2 : 5);

    if (result.outcome === "arrest") {
      gainSkillXp("arrest_technique", 8);
      addGold(result.bountyGold);
      reduceHeat(1);
      recordBounty({ targetName: selectedTarget.name, outcome: "arrest", gold: result.bountyGold });
      return;
    }

    if (result.outcome === "kill") {
      addGold(result.bountyGold);
      addHeat(3);
      recordBounty({ targetName: selectedTarget.name, outcome: "kill", gold: result.bountyGold });
      return;
    }

    if (result.outcome === "defeat") {
      gainSkillXp("evasion_drill", 5);
      hospitalizeFor(result.hospitalMinutes ?? 45, `Defeated by ${selectedTarget.name}`);
      addHeat(2);
      recordBounty({ targetName: selectedTarget.name, outcome: "defeat", gold: 0 });
      return;
    }

    gainSkillXp("evasion_drill", 2);
    addHeat(1);
    recordBounty({ targetName: selectedTarget.name, outcome: "timeout", gold: 0 });
  }

  return (
    <div className="arena-panel">
      <div className="arena-panel__head">
        <div>
          <div className="arena-panel__subtitle">Crime, Law, and Violence</div>
          <h2 className="arena-panel__title">Bounty Board</h2>
          <p className="arena-panel__desc">
            PvP-style bounty combat follows a 25-turn cap, costs 25 energy, and reads Legacy bonuses for battle,
            weapons, and arrest handling.
          </p>
        </div>
      </div>

      <div className="arena-current-stats">
        <div className="arena-current-stats__title">Operational Status</div>
        <div className="arena-current-stats__grid">
          <div className="arena-stat-cell">
            <span className="arena-stat-cell__label">Energy</span>
            <strong className="arena-stat-cell__val">{Math.floor(player.stats.energy)}</strong>
          </div>
          <div className="arena-stat-cell">
            <span className="arena-stat-cell__label">Heat</span>
            <strong className="arena-stat-cell__val">{crimeState.playerHeat}</strong>
          </div>
          <div className="arena-stat-cell">
            <span className="arena-stat-cell__label">Bounties logged</span>
            <strong className="arena-stat-cell__val">{crimeState.bountyHistory.length}</strong>
          </div>
          <div className="arena-stat-cell">
            <span className="arena-stat-cell__label">Mode</span>
            <strong className="arena-stat-cell__val">{nonLethal ? "Non-lethal" : "Lethal"}</strong>
          </div>
        </div>
      </div>

      <div className="arena-current-stats" style={{ marginTop: "1rem" }}>
        <div className="arena-current-stats__title">Current Loadout & Legacy</div>
        <div className="arena-current-stats__grid">
          <div className="arena-stat-cell">
            <span className="arena-stat-cell__label">Weapon</span>
            <strong className="arena-stat-cell__val">{equippedWeapon.name}</strong>
          </div>
          <div className="arena-stat-cell">
            <span className="arena-stat-cell__label">Damage / Acc</span>
            <strong className="arena-stat-cell__val">
              {equippedWeapon.baseDamage} / {equippedWeapon.accuracyMod}
            </strong>
          </div>
          <div className="arena-stat-cell">
            <span className="arena-stat-cell__label">Battle bonus</span>
            <strong className="arena-stat-cell__val">+{Math.round((statMultiplier - 1) * 100)}%</strong>
          </div>
          <div className="arena-stat-cell">
            <span className="arena-stat-cell__label">Bounty bonus</span>
            <strong className="arena-stat-cell__val">+{Math.round((bountyRewardMultiplier - 1) * 100)}%</strong>
          </div>
        </div>
      </div>

      <div className="travel-actions" style={{ marginBottom: "1rem" }}>
        <button type="button" className="travel-action-button" onClick={() => setNonLethal(true)} style={{ opacity: nonLethal ? 1 : 0.72 }}>
          Non-Lethal
        </button>
        <button type="button" className="travel-action-button" onClick={() => setNonLethal(false)} style={{ opacity: !nonLethal ? 1 : 0.72 }}>
          Lethal
        </button>
      </div>

      {isHospitalized ? <div className="arena-status-banner">You are hospitalized - bounty combat suspended.</div> : null}
      {isJailed ? <div className="arena-status-banner">You are jailed - bounty combat suspended.</div> : null}
      {!canFight && !isHospitalized && !isJailed ? (
        <div className="arena-status-banner arena-status-banner--locked">25 energy is required to begin a bounty engagement.</div>
      ) : null}

      <div className="arena-tiers">
        {WANTED_TARGETS.map((target) => (
          <button
            key={target.id}
            type="button"
            className={["arena-tier-card", selectedTarget?.id === target.id ? "arena-tier-card--active" : ""].filter(Boolean).join(" ")}
            onClick={() => setSelectedTargetId(target.id)}
          >
            <div className="arena-tier-card__header">
              <span className="arena-tier-card__subtitle">{target.archetype}</span>
              <span className="arena-tier-card__badge">Heat {target.heat}</span>
            </div>
            <div className="arena-tier-card__name">{target.name}</div>
            <div className="arena-tier-card__desc">
              Level {target.level} target · bounty {target.bountyGold.toLocaleString()} gold
            </div>
            <div className="arena-tier-card__meta">
              Weapon: {target.weapon.name} · Armor: {target.armor.name}
            </div>
          </button>
        ))}
      </div>

      {selectedTarget ? (
        <div className="arena-current-stats" style={{ marginTop: "1rem" }}>
          <div className="arena-current-stats__title">Target Profile</div>
          <div className="arena-current-stats__grid">
            <div className="arena-stat-cell">
              <span className="arena-stat-cell__label">HP</span>
              <strong className="arena-stat-cell__val">{selectedTarget.stats.maxHp}</strong>
            </div>
            <div className="arena-stat-cell">
              <span className="arena-stat-cell__label">Strength</span>
              <strong className="arena-stat-cell__val">{selectedTarget.stats.strength}</strong>
            </div>
            <div className="arena-stat-cell">
              <span className="arena-stat-cell__label">Dexterity</span>
              <strong className="arena-stat-cell__val">{selectedTarget.stats.dexterity}</strong>
            </div>
            <div className="arena-stat-cell">
              <span className="arena-stat-cell__label">Defense</span>
              <strong className="arena-stat-cell__val">{selectedTarget.stats.defense}</strong>
            </div>
          </div>
          <div className="arena-energy-row">
            <span className="arena-energy-label">Arrest rule</span>
            <span className="arena-energy-cost">
              Target must be near defeat and you must keep a clear current HP advantage.
            </span>
          </div>
          <button
            type="button"
            className="travel-action-button travel-action-button--primary"
            onClick={handleFight}
            disabled={!canFight}
          >
            {canFight ? "Engage Target (-25 energy)" : "Cannot Engage"}
          </button>
        </div>
      ) : null}

      {lastCombat ? (
        <div className="arena-current-stats" style={{ marginTop: "1rem" }}>
          <div className="arena-current-stats__title">Last Engagement</div>
          <div className="arena-current-stats__grid">
            <div className="arena-stat-cell">
              <span className="arena-stat-cell__label">Outcome</span>
              <strong className="arena-stat-cell__val">{lastCombat.outcome}</strong>
            </div>
            <div className="arena-stat-cell">
              <span className="arena-stat-cell__label">Turns</span>
              <strong className="arena-stat-cell__val">{lastCombat.turns}</strong>
            </div>
            <div className="arena-stat-cell">
              <span className="arena-stat-cell__label">Bounty</span>
              <strong className="arena-stat-cell__val">{lastCombat.bountyGold.toLocaleString()}</strong>
            </div>
            <div className="arena-stat-cell">
              <span className="arena-stat-cell__label">Your HP</span>
              <strong className="arena-stat-cell__val">{lastCombat.finalPlayerHp}</strong>
            </div>
          </div>
          <div className="info-list" style={{ marginTop: "1rem" }}>
            {lastCombat.logs.slice(-8).map((log) => (
              <div key={`${log.turn}-${log.actor}-${log.text.slice(0, 18)}`} className="info-row">
                <span className="info-row__label">Turn {log.turn}</span>
                <span className="info-row__value">{log.text}</span>
              </div>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}

function PlayerHuntsPanel() {
  const { player, spendEnergy, addGold, hospitalizeFor, jailFor, isHospitalized, isJailed } = usePlayer();
  const { crimeState, addHeat, recordBounty } = useCrimeRuntime();
  const { equipmentState } = useEquipmentRuntime();
  const { getNodeLevel } = useLegacyRuntime();
  const { gainSkillXp } = useSkillsRuntime();
  const [selectedTargetId, setSelectedTargetId] = useState(RIVAL_PLAYER_TARGETS[0]?.id ?? "");
  const [nonLethal, setNonLethal] = useState(true);
  const [lastCombat, setLastCombat] = useState<CombatResolution | null>(null);
  const [lastRewardNote, setLastRewardNote] = useState<string | null>(null);

  const selectedTarget = useMemo(
    () => RIVAL_PLAYER_TARGETS.find((target) => target.id === selectedTargetId) ?? RIVAL_PLAYER_TARGETS[0],
    [selectedTargetId]
  );
  const canFight = !isHospitalized && !isJailed && player.stats.energy >= 25;

  const battleLine = getNodeLevel("battle", "battle_stat_line");
  const battleVitality = getNodeLevel("battle", "battle_vitality");
  const weaponAccuracy = getNodeLevel("weapon_mastery", "weapon_accuracy");
  const weaponPressure = getNodeLevel("weapon_mastery", "weapon_pressure");
  const bountyTracking = getNodeLevel("arrest_bounty", "bounty_tracking");
  const arrestControl = getNodeLevel("arrest_bounty", "arrest_control");

  const statMultiplier = 1 + battleLine * 0.03;
  const hpMultiplier = 1 + battleVitality * 0.05;
  const bountyRewardMultiplier = 1 + bountyTracking * 0.03;
  const arrestReliabilityBonus = arrestControl * 0.02;

  const equippedWeaponBase = getPlayerWeapon(equipmentState.equippedWeaponId);
  const equippedWeapon = {
    ...equippedWeaponBase,
    accuracyMod: equippedWeaponBase.accuracyMod + weaponAccuracy * 2,
    baseDamage: Math.round(equippedWeaponBase.baseDamage * (1 + weaponPressure * 0.01)),
  };
  const equippedArmor = getPlayerArmor(equipmentState.equippedArmorId);

  const effectivePlayerStats = {
    strength: player.battleStats.strength * statMultiplier,
    dexterity: player.battleStats.dexterity * statMultiplier,
    endurance: player.workingStats.endurance,
    defense: player.battleStats.defense * statMultiplier,
    speed: player.battleStats.speed * statMultiplier,
    maxHp: Math.round(player.stats.maxHealth * hpMultiplier),
    currentHp: Math.min(
      Math.round(player.stats.health * hpMultiplier),
      Math.round(player.stats.maxHealth * hpMultiplier)
    ),
  };

  const playerBattleTotal =
    effectivePlayerStats.strength +
    effectivePlayerStats.defense +
    effectivePlayerStats.speed +
    effectivePlayerStats.dexterity;

  const homeDefenders = selectedTarget ? getActivePropertyDefenders(selectedTarget) : [];
  const combatTarget = selectedTarget
    ? homeDefenders.length > 0
      ? buildHouseholdCombatTarget(selectedTarget)
      : { ...selectedTarget, archetype: `Player • ${selectedTarget.propertyName}` }
    : null;

  function handleFight() {
    if (!selectedTarget || !combatTarget || !canFight) return;

    spendEnergy(25);
    const targetBattleTotal =
      combatTarget.stats.strength +
      combatTarget.stats.defense +
      combatTarget.stats.speed +
      combatTarget.stats.dexterity;
    const diminish = getDiminishingRewardMultiplier(playerBattleTotal, targetBattleTotal);
    const result = resolvePvpBattle({
      playerStats: effectivePlayerStats,
      playerWeapon: equippedWeapon,
      playerArmor: equippedArmor,
      target: combatTarget,
      nonLethal,
      maxTurns: 25,
      bountyRewardMultiplier,
      arrestReliabilityBonus,
    });

    setLastCombat(result);
    gainSkillXp("combat_reading", result.outcome === "timeout" ? 2 : 5);

    if (result.outcome === "arrest") {
      gainSkillXp("arrest_technique", 10);
      const reward = Math.floor(result.bountyGold * diminish);
      addGold(reward);
      setLastRewardNote(
        homeDefenders.length > 0
          ? `${selectedTarget.name}'s shared residence was defended by ${homeDefenders.length} resident(s). You still secured the arrest and took ${reward.toLocaleString()} gold.`
          : `${selectedTarget.name} was away from the residence. Reward adjusted to ${reward.toLocaleString()} gold.`
      );
      recordBounty({ targetName: selectedTarget.name, outcome: "arrest", gold: reward });
      return;
    }

    if (result.outcome === "kill") {
      const reward = Math.floor(result.bountyGold * diminish);
      addGold(reward);
      addHeat(4);
      setLastRewardNote(`Target killed. Reduced legal payout applied at ${reward.toLocaleString()} gold. Heat increased.`);
      recordBounty({ targetName: selectedTarget.name, outcome: "kill", gold: reward });
      return;
    }

    if (result.outcome === "defeat") {
      gainSkillXp("evasion_drill", 6);
      if (homeDefenders.length > 0) {
        jailFor(30, `Caught during failed attack on ${selectedTarget.name}`);
        setLastRewardNote(
          `${selectedTarget.propertyName} was defended by ${homeDefenders.map((resident) => resident.name).join(" and ")}. Your failed attack ended in jail.`
        );
      } else {
        hospitalizeFor(30, `Beaten during failed attack on ${selectedTarget.name}`);
        setLastRewardNote(
          `${selectedTarget.name} was away, but property security ${getEffectivePropertySecurity(selectedTarget)} and hired guards still put you in hospital.`
        );
      }
      addHeat(2);
      recordBounty({ targetName: selectedTarget.name, outcome: "defeat", gold: 0 });
      return;
    }

    gainSkillXp("evasion_drill", 2);
    addHeat(1);
    setLastRewardNote("No decisive result. Energy wasted, nothing gained, and your name still got a little dirtier.");
    recordBounty({ targetName: selectedTarget.name, outcome: "timeout", gold: 0 });
  }

  return (
    <div className="arena-panel">
      <div className="arena-panel__head">
        <div>
          <div className="arena-panel__subtitle">Actual Player-Target Framework</div>
          <h2 className="arena-panel__title">Player Hunts</h2>
          <p className="arena-panel__desc">
            Structured rival-player hunts with household-aware defense. Shared homes now defend together and guards add
            a smaller edge even when residents are away.
          </p>
        </div>
      </div>

      <div className="travel-actions" style={{ marginBottom: "1rem" }}>
        <button type="button" className="travel-action-button" onClick={() => setNonLethal(true)} style={{ opacity: nonLethal ? 1 : 0.72 }}>
          Non-Lethal
        </button>
        <button type="button" className="travel-action-button" onClick={() => setNonLethal(false)} style={{ opacity: !nonLethal ? 1 : 0.72 }}>
          Lethal
        </button>
      </div>

      {isHospitalized ? <div className="arena-status-banner">You are hospitalized - player hunts suspended.</div> : null}
      {isJailed ? <div className="arena-status-banner">You are jailed - player hunts suspended.</div> : null}
      {!canFight && !isHospitalized && !isJailed ? (
        <div className="arena-status-banner arena-status-banner--locked">25 energy is required to begin a player hunt.</div>
      ) : null}

      <div className="arena-tiers">
        {RIVAL_PLAYER_TARGETS.map((target) => {
          const defenders = getActivePropertyDefenders(target);
          return (
            <button
              key={target.id}
              type="button"
              className={["arena-tier-card", selectedTarget?.id === target.id ? "arena-tier-card--active" : ""].filter(Boolean).join(" ")}
              onClick={() => setSelectedTargetId(target.id)}
            >
              <div className="arena-tier-card__header">
                <span className="arena-tier-card__subtitle">Level {target.level}</span>
                <span className="arena-tier-card__badge">Heat {target.heat}</span>
              </div>
              <div className="arena-tier-card__name">{target.name}</div>
              <div className="arena-tier-card__desc">
                {target.propertyName} · security {getEffectivePropertySecurity(target)}
              </div>
              <div className="arena-tier-card__meta">
                {defenders.length > 0 ? `${defenders.length} resident defender(s)` : "Away-state"} · guards {target.guards?.count ?? 0}
              </div>
            </button>
          );
        })}
      </div>

      {selectedTarget ? (
        <div className="arena-current-stats" style={{ marginTop: "1rem" }}>
          <div className="arena-current-stats__title">Target Conditions</div>
          <div className="arena-current-stats__grid">
            <div className="arena-stat-cell">
              <span className="arena-stat-cell__label">Property</span>
              <strong className="arena-stat-cell__val">{selectedTarget.propertyName}</strong>
            </div>
            <div className="arena-stat-cell">
              <span className="arena-stat-cell__label">Home defenders</span>
              <strong className="arena-stat-cell__val">{homeDefenders.length}</strong>
            </div>
            <div className="arena-stat-cell">
              <span className="arena-stat-cell__label">Security</span>
              <strong className="arena-stat-cell__val">{getEffectivePropertySecurity(selectedTarget)}</strong>
            </div>
            <div className="arena-stat-cell">
              <span className="arena-stat-cell__label">Reward scaling</span>
              <strong className="arena-stat-cell__val">
                {Math.round(
                  getDiminishingRewardMultiplier(
                    playerBattleTotal,
                    (combatTarget?.stats.strength ?? 0) +
                      (combatTarget?.stats.defense ?? 0) +
                      (combatTarget?.stats.speed ?? 0) +
                      (combatTarget?.stats.dexterity ?? 0)
                  ) * 100
                )}%
              </strong>
            </div>
          </div>
          <div className="arena-energy-row">
            <span className="arena-energy-label">Defender-home rule</span>
            <span className="arena-energy-cost">
              If a shared household is home, you fight the combined residents. If not, the guards and property still shape the response.
            </span>
          </div>
          <button
            type="button"
            className="travel-action-button travel-action-button--primary"
            onClick={handleFight}
            disabled={!canFight}
          >
            {canFight ? "Hunt Target (-25 energy)" : "Cannot Engage"}
          </button>
        </div>
      ) : null}

      {lastRewardNote ? (
        <div className="arena-status-banner" style={{ marginTop: "1rem" }}>
          {lastRewardNote}
        </div>
      ) : null}

      {lastCombat ? (
        <div className="arena-current-stats" style={{ marginTop: "1rem" }}>
          <div className="arena-current-stats__title">Last Player Hunt</div>
          <div className="arena-current-stats__grid">
            <div className="arena-stat-cell">
              <span className="arena-stat-cell__label">Outcome</span>
              <strong className="arena-stat-cell__val">{lastCombat.outcome}</strong>
            </div>
            <div className="arena-stat-cell">
              <span className="arena-stat-cell__label">Turns</span>
              <strong className="arena-stat-cell__val">{lastCombat.turns}</strong>
            </div>
            <div className="arena-stat-cell">
              <span className="arena-stat-cell__label">Bounty base</span>
              <strong className="arena-stat-cell__val">{lastCombat.bountyGold.toLocaleString()}</strong>
            </div>
            <div className="arena-stat-cell">
              <span className="arena-stat-cell__label">Your HP</span>
              <strong className="arena-stat-cell__val">{lastCombat.finalPlayerHp}</strong>
            </div>
          </div>
          <div className="info-list" style={{ marginTop: "1rem" }}>
            {lastCombat.logs.slice(-8).map((log) => (
              <div key={`${log.turn}-${log.actor}-${log.text.slice(0, 18)}`} className="info-row">
                <span className="info-row__label">Turn {log.turn}</span>
                <span className="info-row__value">{log.text}</span>
              </div>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}

export default function ArenaRuntimePage() {
  const { isTierUnlocked, getTierProgress } = useArena();
  const [tab, setTab] = useState<ArenaTab>("training");
  const [activeTierId, setActiveTierId] = useState(arenaTiers[0].id);
  const activeTier = arenaTiers.find((tier) => tier.id === activeTierId) ?? arenaTiers[0];

  return (
    <AppShell title="Arena" hint="Battle training, bounty combat, and player-target hunts. Preparation matters more than panic.">
      <div className="arena-page">
        <div className="travel-actions" style={{ marginBottom: "1rem" }}>
          <button type="button" className="travel-action-button" onClick={() => setTab("training")} style={{ opacity: tab === "training" ? 1 : 0.72 }}>
            Training
          </button>
          <button type="button" className="travel-action-button" onClick={() => setTab("bounties")} style={{ opacity: tab === "bounties" ? 1 : 0.72 }}>
            Bounties
          </button>
          <button type="button" className="travel-action-button" onClick={() => setTab("player_hunts")} style={{ opacity: tab === "player_hunts" ? 1 : 0.72 }}>
            Player Hunts
          </button>
        </div>

        {tab === "training" ? (
          <>
            <p className="arena-intro">
              Train your battle stats through four progressive tiers. Complete each tier fully to unlock the next.
            </p>
            <div className="arena-layout">
              <div className="arena-tiers">
                {arenaTiers.map((tier) => {
                  const progress = getTierProgress(tier.id);
                  return (
                    <TierCard
                      key={tier.id}
                      tier={tier}
                      isActive={tier.id === activeTierId}
                      isLocked={!isTierUnlocked(tier.id)}
                      isMaxed={progress.maxed}
                      onClick={() => setActiveTierId(tier.id)}
                    />
                  );
                })}
              </div>
              <TrainingPanel tier={activeTier} />
            </div>
          </>
        ) : null}
        {tab === "bounties" ? <BountyPanel /> : null}
        {tab === "player_hunts" ? <PlayerHuntsPanel /> : null}
      </div>
    </AppShell>
  );
}
