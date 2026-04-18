import {
  PLAYER_TITLE_DEFINITIONS,
  type PlayerTitleDefinition,
  type PlayerTitleStats,
  type TitleBonus,
  type TitleProgressState,
} from "../data/titleData";

export interface PlayerTitleProfile {
  unlockedTitleIds: string[];
  activeTitleId?: string;
}

export interface ResolvedTitleState {
  title: PlayerTitleDefinition;
  unlocked: boolean;
  canActivate: boolean;
  progressPercent: number;
  progressValue: number;
}

function getMetricValue(stats: PlayerTitleStats, title: PlayerTitleDefinition): number {
  switch (title.requirement.metric) {
    case "travels_completed":
      return stats.travelsCompleted;
    case "books_read":
      return stats.booksRead;
    case "defensive_attacks_received":
      return stats.defensiveAttacksReceived;
    case "recovery_items_used":
      return stats.recoveryItemsUsed;
    case "job_days_worked":
      return stats.jobDaysWorked;
    case "raid_attendances":
      return stats.raidAttendances;
    case "inventory_movements":
      return stats.inventoryMovements;
    case "civic_reputation":
      return stats.civicReputation;
    case "special_assignment":
      return title.id === "the_absolute" && stats.specialAssignments?.includes("the_absolute") ? 1 : 0;
    default:
      return 0;
  }
}

export function isTitleUnlocked(stats: PlayerTitleStats, title: PlayerTitleDefinition): boolean {
  return getMetricValue(stats, title) >= title.requirement.threshold;
}

export function resolveTitleStates(
  stats: PlayerTitleStats,
  profile: PlayerTitleProfile,
): ResolvedTitleState[] {
  return PLAYER_TITLE_DEFINITIONS.map((title) => {
    const progressValue = getMetricValue(stats, title);
    const unlocked = profile.unlockedTitleIds.includes(title.id) || isTitleUnlocked(stats, title);
    const progressPercent = Math.min(100, Math.floor((progressValue / title.requirement.threshold) * 100));

    return {
      title,
      unlocked,
      canActivate: unlocked,
      progressPercent,
      progressValue,
    };
  });
}

export function getUnlockedTitleProgress(stats: PlayerTitleStats): TitleProgressState[] {
  return PLAYER_TITLE_DEFINITIONS.filter((title) => isTitleUnlocked(stats, title)).map((title) => ({
    titleId: title.id,
    unlocked: true,
  }));
}

export function getActiveTitle(
  profile: PlayerTitleProfile,
): PlayerTitleDefinition | undefined {
  return PLAYER_TITLE_DEFINITIONS.find((title) => title.id === profile.activeTitleId);
}

export function activateTitle(
  profile: PlayerTitleProfile,
  titleId: string,
): PlayerTitleProfile {
  if (!profile.unlockedTitleIds.includes(titleId)) {
    return profile;
  }

  return {
    ...profile,
    activeTitleId: titleId,
  };
}

export function clearActiveTitle(profile: PlayerTitleProfile): PlayerTitleProfile {
  return {
    ...profile,
    activeTitleId: undefined,
  };
}

export function getActiveTitleBonuses(profile: PlayerTitleProfile): TitleBonus[] {
  return getActiveTitle(profile)?.bonuses ?? [];
}
