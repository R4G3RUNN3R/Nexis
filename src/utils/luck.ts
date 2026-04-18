import type { LuckSources } from "../data/playerProfileData";

export function getTotalLuck(luckSources: LuckSources): number {
  return Object.values(luckSources).reduce((sum, value) => sum + value, 0);
}

export function getLuckBonusPercent(totalLuck: number): number {
  if (totalLuck <= 100) return totalLuck * 0.001;
  if (totalLuck <= 200) return 0.1 + (totalLuck - 100) * 0.0005;
  if (totalLuck <= 400) return 0.15 + (totalLuck - 200) * 0.00025;
  return 0.2 + Math.min((totalLuck - 400) * 0.0001, 0.05);
}

export function getLuckEffectSummary(totalLuck: number) {
  const bonusPercent = getLuckBonusPercent(totalLuck);

  return {
    totalLuck,
    bonusPercent,
    lootFindBonusText: `+${bonusPercent.toFixed(3)}% better chance of finding something`,
    npcInteractionBonusText: `+${bonusPercent.toFixed(3)}% improved chance for favorable NPC side outcomes`,
    explorationBonusText: `+${bonusPercent.toFixed(3)}% improved chance for extra discoveries`,
  };
}
