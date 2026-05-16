import { formatEntityPublicId } from "./publicIds";

export type OrganizationType = "guild" | "consortium";

export type OrganizationPermission =
  | "manage_members"
  | "manage_treasury"
  | "declare_operations"
  | "manage_contracts"
  | "recruit_members"
  | "view_logs"
  | "participate";

export type OrganizationRole = {
  roleKey: string;
  displayName: string;
  rankOrder: number;
  permissions: OrganizationPermission[];
  isSystemRole: boolean;
};

export type OrganizationMember = {
  userInternalId: string;
  publicId: number;
  displayName: string;
  roleKey: string;
  joinedAt: number;
};

export type OrganizationLog = {
  actionType: string;
  actorInternalId: string | null;
  actorPublicId: number | null;
  summary: Record<string, unknown>;
  createdAt: number;
};

export type OrganizationTreasury = {
  copper: number;
  silver: number;
  gold: number;
  platinum: number;
};

export type ConsortiumReward = {
  starTier: number;
  rewardKey: string;
  displayName: string;
  mode: "active" | "passive";
  pointCost: number | null;
  effectSummary: string;
  poolKey: string | null;
  unlocked?: boolean;
  canRedeem?: boolean;
};

export type ConsortiumTypeDefinition = {
  key: string;
  displayName: string;
  creationCost: number;
  description: string;
  rolesFlavor: string[];
  rewards: ConsortiumReward[];
};

export type ConsortiumPointState = {
  consortiumTypeKey: string;
  organizationInternalId: string;
  scope: "type";
  points: number;
  totalEarned: number;
  totalSpent: number;
  lastClaimedAt: number | null;
  dailyGain: number;
};

export type OrganizationBaseAuction = {
  auctionId: number;
  opensAt: number;
  closesAt: number;
  openingBidGold: number;
  currentBidGold: number;
  debtGoldAtConfiscation: number;
  bidderOrganizationInternalId: string | null;
  bidderOrganizationPublicId: number | null;
  bidderPublicId: number | null;
};

export type OrganizationBaseSnapshot = {
  baseId: number;
  organizationInternalId: string;
  ownershipMode: string;
  propertyKey: string;
  status: "active" | "confiscated" | "auction" | string;
  monthlyUpkeepGold: number;
  periodDueGold: number;
  periodPaidGold: number;
  outstandingGold: number;
  review: {
    minimumRequiredGold: number;
    shortfallToThresholdGold: number;
    isUnderThreshold: boolean;
    msUntilReview: number;
    daysUntilReview: number;
    warningWindowDays: number;
    isReviewWindowOpen: boolean;
  };
  reviewAnchorDayUtc: number;
  acquiredAt: number;
  cityId: string | null;
  displayName: string;
  acquisitionCostGold: number;
  periodStartedAt: number;
  nextReviewAt: number;
  buybackUntil: number | null;
  debtGoldAtConfiscation: number | null;
  leaderInternalId: string | null;
  passiveBenefitsActive: boolean;
  buyback: {
    principalDebtGold: number;
    interestPct: number;
    totalDueGold: number;
    buybackUntil: number | null;
  } | null;
  auction: OrganizationBaseAuction | null;
  construction: Record<string, unknown> | null;
  buildingState: string | null;
  plotSize: string | null;
  roomCapacity: number;
  roomsUsed: number;
  rooms: Array<Record<string, unknown>>;
  buildQuality: {
    tier: "poor" | "standard" | "fine" | "exceptional";
    score: number;
    modifiers: {
      operationalMultiplier: number;
      upkeepMultiplier: number;
    };
    breakdown: Record<string, unknown>;
    contributions: Array<Record<string, unknown>>;
  } | null;
  qualityModifiers: {
    upkeepMultiplier: number;
    operationalMultiplier: number;
  } | null;
  mechanicalEffects: {
    organizationType: string;
    baseStatus: string;
    buildingKey: string | null;
    qualityFactor: number;
    effects: Record<string, number>;
    contributions: Array<Record<string, unknown>>;
    roomCount: number;
    source: string;
  } | null;
  events: Array<Record<string, unknown>>;
  storage: Array<Record<string, unknown>>;
};

export type OrganizationBaseOwnershipResponse = {
  organizationPublicId: number;
  organizationType: OrganizationType;
  catalog: {
    modes: Record<string, string>;
    eligibleBuildings: Array<Record<string, unknown>>;
    eligiblePlots: Array<Record<string, unknown>>;
    mainBuildingOptions?: Array<Record<string, unknown>>;
    roomOptions?: Array<Record<string, unknown>>;
    propertyOffice?: {
      plotPurchaseMinLevel: number;
      npcSellbackReturnPct: number;
      builderAvailability: {
        playerBuilders: number;
        npcBuilders: number;
        totalAvailable: number;
      };
      constructionEligibleTracks?: string[];
      hireVisibilityPolicy?: {
        aggregateOnly: boolean;
        exposesRawBuilderIdentity: boolean;
      };
    };
  };
  base: OrganizationBaseSnapshot | null;
};

export type ConsortiumLogisticsTemplate = {
  key: string;
  displayName: string;
  summary: string;
  routeType: "caravan" | "ship";
  lane: string;
  riskLevel: string;
  upfrontCostGold: number;
  durationHours: number;
  rewardRange: {
    minGold: number;
    maxGold: number;
  };
  dangerTags: string[];
  dangerProfile: string;
  recommendedWorkers: number;
  recommendedWorkingScore: number;
  recommendedBattleScore: number;
  escortEligible: boolean;
};

export type ConsortiumLogisticsWorker = {
  userInternalId: string;
  publicId: number;
  displayName: string;
  roleKey: string;
  workingStats: Record<string, number>;
  battleStats: Record<string, number>;
  workingScore: number;
  battleScore: number;
};

export type ConsortiumLogisticsEscortMode = {
  key: "none" | "internal_team" | "guild_contract";
  displayName: string;
  summary: string;
};

export type ConsortiumLogisticsAssignedWorker = {
  userInternalId: string;
  publicId: number;
  displayName: string;
  roleKey: string;
  assignmentRole: string;
  assignedAt: number;
  workingStats: Record<string, number>;
  battleStats: Record<string, number>;
};

export type ConsortiumLogisticsOperation = {
  internalId: string;
  templateKey: string;
  displayName: string;
  routeType: string;
  lane: string;
  riskLevel: string;
  upfrontCostGold: number;
  durationHours: number;
  rewardRange: {
    minGold: number;
    maxGold: number;
  };
  dangerProfile: {
    summary: string | null;
    tags: string[];
  };
  state: string;
  statusText: string;
  createdAt: number;
  updatedAt: number;
  startedAt: number | null;
  expectedOutcomeAt: number | null;
  assignedWorkers: ConsortiumLogisticsAssignedWorker[];
  escortContract: {
    mode: string;
    status: string;
    guildOrganizationInternalId: string | null;
    guildPublicId: number | null;
    guildName: string | null;
    coverageRating: number;
    notes: string | null;
    attachedAt: number | null;
  };
  outcome: {
    result: string | null;
    resolvedAt: number | null;
    summary: string | null;
    goldReturned: number | null;
    treasuryDeltaGold: number | null;
    lossAppliedGold: number;
    lossSummary: string | null;
    dangerTriggered: string[];
    escortContribution: string | null;
    crewContribution: string | null;
    resolutionScore: number | null;
  };
  template?: ConsortiumLogisticsTemplate;
  preview?: {
    successOdds: number;
    totalWorking: number;
    totalBattle: number;
    escortScore: number;
    dangerPressure: number;
    workerCoverage: number;
    workingLift: number;
    battleLift: number;
  };
  canLaunch?: boolean;
  canManageAssignments?: boolean;
};

export type ConsortiumLogisticsBoard = {
  templates: ConsortiumLogisticsTemplate[];
  operations: ConsortiumLogisticsOperation[];
  workerPool: ConsortiumLogisticsWorker[];
  escortModes: ConsortiumLogisticsEscortMode[];
  canManageOperations: boolean;
  summary: {
    draftCount: number;
    activeCount: number;
    resolvedCount: number;
    escortLinkedCount: number;
  };
  placeholderNotice: string;
};

export type GuildPublicProfile = {
  headline: string;
  recruitmentStatus: string;
  doctrine: string;
  territory: string;
  diplomacy: string;
  publicNotice: string;
};

export type GuildMemberDetail = OrganizationMember & {
  roleDisplayName: string;
  level: number;
  title: string | null;
  location: string;
  status: string;
  life: {
    current: number;
    max: number;
  };
  isOnline: boolean;
  lastAction: string;
};

export type GuildWarRoom = {
  readiness: number;
  warRating: number;
  doctrine: string;
  activeWars: Array<{
    target: string;
    status: string;
    startedAt: number;
  }>;
  recentHistory: Array<{
    summary: string;
    createdAt: number;
  }>;
};

export type GuildDungeonTemplate = {
  key: string;
  displayName: string;
  summary: string;
  minMembers: number;
  recommendedPower: number;
  reputationReward: number;
  goldReward: number;
  cooldownHours: number;
};

export type GuildQuestSlot = {
  slotKey: string;
  label: string;
  focus: string;
  assignedMember?: {
    userInternalId: string;
    publicId: number;
    displayName: string;
    roleDisplayName: string;
    level: number;
    status: string;
    location: string;
    isOkay: boolean;
    unavailableReason: string | null;
  } | null;
};

export type GuildQuestTemplate = {
  key: string;
  displayName: string;
  summary: string;
  planningHours: number;
  requiredMembers: number;
  slots: GuildQuestSlot[];
  reputationReward: number;
  treasuryGoldReward: number;
  memberGoldReward: number;
  canPlan: boolean;
  blockedReason: string | null;
};

export type GuildQuestPlan = {
  questKey: string;
  displayName: string;
  summary: string;
  planningHours: number;
  plannedAt: number;
  readyAt: number;
  plannedBy: {
    publicId: number;
    displayName: string;
  };
  slots: GuildQuestSlot[];
  planningComplete: boolean;
  allSlotsFilled: boolean;
  everyoneOkay: boolean;
  canInitiate: boolean;
  canCancel: boolean;
  canPlanAgain: boolean;
  blockedReason: string | null;
};

export type GuildQuestHistoryEntry = {
  questKey: string;
  displayName: string;
  summary: string;
  outcome: "success" | "failure";
  createdAt: number;
  reputationGain: number;
  treasuryGoldGain: number;
  participantPublicIds: number[];
};

export type GuildQuestBoard = {
  templates: GuildQuestTemplate[];
  currentPlan: GuildQuestPlan | null;
  history: GuildQuestHistoryEntry[];
};

export type GuildQuestMemberPoolEntry = {
  userInternalId: string;
  publicId: number;
  displayName: string;
  roleDisplayName: string;
  level: number;
  status: string;
  location: string;
  isQuestReady: boolean;
  questBlockReason: string | null;
};

export type GuildPassives = {
  reputation: number;
  totalEarned: number;
  totalSpent: number;
  availablePoints: number;
  dailyRenown: number;
};

export type OrganizationAcademyContract = {
  source: string;
  businessStudies?: {
    averageTrackCompletionPct: number;
    averageCompletedCourses?: number;
    requiredCourses?: number;
    consortiumYieldPct: number;
    workerEfficiencyPct: number;
    treasuryEfficiencyPct: number;
    routePerformancePct: number;
  };
  adventuringSurvival?: {
    averageTrackCompletionPct: number;
    averageCompletedCourses?: number;
    requiredCourses?: number;
    guildReadinessPct: number;
    operationSurvivalPct: number;
    battleEdgePct: number;
  };
};

export type GuildSkillNode = {
  key: string;
  displayName: string;
  tier: number;
  pointCost: number;
  effectSummary: string;
  unlocked: boolean;
  prerequisites: string[];
};

export type GuildArmory = {
  items: Array<{
    itemId: string;
    label: string;
    quantity: number;
  }>;
};

export type GuildSettings = {
  invitePolicy: string;
  warDoctrine: string;
  publicProfile: GuildPublicProfile;
};

export type OrganizationRecord = {
  internalId: string;
  publicId: number;
  type: OrganizationType;
  name: string;
  tag: string | null;
  founderInternalId: string;
  founderPublicId: number;
  description: string;
  statusText: string;
  consortiumTypeKey: string | null;
  consortiumTypeName: string | null;
  passiveBonusSummary: string;
  creationCost: number;
  treasury: OrganizationTreasury;
  metadata: Record<string, unknown>;
  createdAt: number;
  updatedAt: number;
  roles: OrganizationRole[];
  members: OrganizationMember[];
  logs: OrganizationLog[];
  starRating?: number;
  consortiumType?: ConsortiumTypeDefinition | null;
  rolesFlavor?: string[];
  memberRoleKey?: string;
  rewardLadder?: ConsortiumReward[];
  unlockedPassives?: ConsortiumReward[];
  redeemableActives?: ConsortiumReward[];
  consortiumPoints?: ConsortiumPointState | null;
  publicProfile?: GuildPublicProfile;
  memberDetails?: GuildMemberDetail[];
  warRoom?: GuildWarRoom;
  dungeonBoard?: GuildDungeonTemplate[];
  guildQuestBoard?: GuildQuestBoard;
  questMemberPool?: GuildQuestMemberPoolEntry[];
  guildPassives?: GuildPassives;
  academyContract?: OrganizationAcademyContract;
  baseMechanicalEffects?: {
    organizationType: string;
    baseStatus: string;
    buildingKey: string | null;
    qualityFactor: number;
    effects: Record<string, number>;
    contributions: Array<Record<string, unknown>>;
    roomCount: number;
    source: string;
  };
  skillTree?: GuildSkillNode[];
  armory?: GuildArmory;
  settingsView?: GuildSettings;
  viewerPermissions?: OrganizationPermission[];
};

export type GuildBoard = OrganizationRecord & { type: "guild" };
export type ConsortiumBoard = OrganizationRecord & { type: "consortium" };

export const GUILD_STORAGE_PREFIX = "nexis_guild_board_";
export const CONSORTIUM_STORAGE_PREFIX = "nexis_consortium_board_";

export function guildKey(internalId: string) {
  return `${GUILD_STORAGE_PREFIX}${internalId}`;
}

export function consortiumKey(internalId: string) {
  return `${CONSORTIUM_STORAGE_PREFIX}${internalId}`;
}

export function readJson<T>(key: string): T | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

export function writeJson<T>(key: string, value: T) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(key, JSON.stringify(value));
}

export function readGuildBoard(internalId: string) {
  return readJson<GuildBoard>(guildKey(internalId));
}

export function readConsortiumBoard(internalId: string) {
  return readJson<ConsortiumBoard>(consortiumKey(internalId));
}

function resolveSummaryName(record: Record<string, unknown>) {
  if (typeof record.name === "string" && record.name) {
    return typeof record.publicId === "number" ? `${record.name} [${formatOrganizationBadge("guild", record.publicId)}]` : record.name;
  }
  const membership = record.membership && typeof record.membership === "object" ? record.membership as Record<string, unknown> : null;
  if (membership && typeof membership.name === "string" && membership.name && typeof membership.publicId === "number") {
    const type = typeof membership.consortiumTypeKey === "string" ? "consortium" : "guild";
    return `${membership.name} [${formatOrganizationBadge(type as OrganizationType, membership.publicId)}]`;
  }
  return null;
}

export function getGuildSummary(internalId: string) {
  const guild = readJson<Record<string, unknown>>(guildKey(internalId));
  return guild ? resolveSummaryName(guild) ?? "No guild" : "No guild";
}

export function getConsortiumSummary(internalId: string) {
  const consortium = readJson<Record<string, unknown>>(consortiumKey(internalId));
  return consortium ? resolveSummaryName(consortium) ?? "No consortium" : "No consortium";
}

export function formatDate(timestamp: number) {
  try {
    return new Date(timestamp).toLocaleDateString("en-GB", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  } catch {
    return "Unknown";
  }
}

export function formatOrganizationBadge(type: OrganizationType, publicId: number) {
  return `${formatEntityPublicId(type, publicId)}`;
}
