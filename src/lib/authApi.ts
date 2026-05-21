export type ServerAuthUser = {
  email: string;
  username: string | null;
  firstName: string;
  lastName: string;
  publicId: number;
  publicPlayerId: string;
  internalId?: string;
  internalPlayerId: string;
  entityType: "player" | "npc" | "system" | "event";
  privilegeRole: "player" | "staff" | "admin";
  createdAt: number;
};

export type ServerRecordEntry = {
  id: string;
  timestamp: number;
  category: string;
  summary: string;
  detail?: Record<string, unknown>;
  source?: string;
  route?: string | null;
};

export type ServerProgressionEvent = {
  id: string;
  type: string;
  createdAt: number;
  acknowledgedAt?: number | null;
  summary: string;
  detail?: Record<string, unknown>;
  route?: string | null;
};

export type RareManualBand = {
  tier: number;
  label: string;
  minimumLevel: number;
  unlocked: boolean;
  lockReason: string | null;
};

export type RareManualEntry = {
  id: string;
  name: string;
  tier: number;
  tierLabel: string;
  requiredLevel: number;
  family: string;
  sourceCity: string;
  acquisition: string[];
  eligible: boolean;
  lockReason: string | null;
};

export type RareManualEligibility = {
  level: number;
  highestEligibleTier: number;
  eligibleBands: RareManualBand[];
  nextBand: RareManualBand | null;
  rule: string;
  manuals: RareManualEntry[];
};

export type ServerPlayerState = {
  level: number;
  experience?: number;
  gold: number;
  currencies?: Record<string, number>;
  itemEnhancements?: Record<string, string[]>;
  records?: { entries?: ServerRecordEntry[]; categories?: Record<string, number>; total?: number };
  progressionEvents?: { pending?: ServerProgressionEvent[]; history?: ServerProgressionEvent[] };
  rareManualEligibility?: RareManualEligibility;
  stats: Record<string, number>;
  workingStats: Record<string, number>;
  battleStats: Record<string, number>;
  currentJob: Record<string, unknown> | string | null;
  runtimeState?: {
    player?: Record<string, unknown>;
    jobs?: Record<string, unknown>;
    education?: Record<string, unknown>;
    arena?: Record<string, unknown>;
    timers?: Record<string, unknown>;
    guild?: Record<string, unknown>;
    consortium?: Record<string, unknown>;
    civicEmployment?: Record<string, unknown>;
    travel?: Record<string, unknown>;
    legacy?: Record<string, unknown>;
    citySpecials?: Record<string, unknown>;
  };
  createdAt: number;
  updatedAt: number;
} | null;

export type ApiFailure = {
  ok: false;
  error: string;
  unavailable: boolean;
  status: number | null;
  code: string | null;
};

type ApiAuthSuccess = {
  ok: true;
  user: ServerAuthUser;
  playerState: ServerPlayerState;
  sessionToken: string;
  sessionExpiresAt: string | null;
};

type ApiMeSuccess = {
  ok: true;
  user: ServerAuthUser;
  playerState: ServerPlayerState;
};

type RawAuthSuccess = Omit<ApiAuthSuccess, "ok">;
type RawMeSuccess = Omit<ApiMeSuccess, "ok">;

export type ApiAuthResponse = ApiAuthSuccess | ApiFailure;
export type ApiMeResponse = ApiMeSuccess | ApiFailure;
export type ApiStateSyncResponse =
  | {
      ok: true;
      playerState: ServerPlayerState;
    }
  | ApiFailure;

export type ApiPasswordResetRequestResponse =
  | { ok: true; delivered: true }
  | ApiFailure;

export type ApiPasswordResetResponse =
  | { ok: true; reset: true }
  | ApiFailure;

export type ApiTravelResponse =
  | {
      ok: true;
      playerState: ServerPlayerState;
      travel: Record<string, unknown>;
    }
  | ApiFailure;

export type ServerCityOccupant = {
  publicId: number;
  displayName: string;
  title: string;
  level: number;
  currentCityId: string;
  isSelf: boolean;
  sharesGuild?: boolean;
  sharesConsortium?: boolean;
  duelEligible?: boolean;
  portraitImageUrl?: string | null;
  distinctions?: string[];
};

export type ServerCityPopulation = {
  visibleCount: number;
  listLimit: number;
  peopleLabel?: string;
  guildmatesVisible: number;
  consortiumMembersVisible: number;
  duelEligibleVisible?: number;
  totalFiltered?: number;
  page?: number;
  pageSize?: number;
  totalPages?: number;
  hasMore?: boolean;
  filter?: string;
};

export type ApiCityPeopleResponse =
  | {
      ok: true;
      city: { id: string; name: string; role: string; peopleLabel?: string };
      population: ServerCityPopulation;
      people: ServerCityOccupant[];
    }
  | ApiFailure;


export type ServerEducationCourse = {
  id: string;
  categoryId: string;
  code: string;
  name: string;
  durationDays: number;
  costGold: number;
  description: string;
  rewardKind: string;
  prerequisites?: string[];
  statRewards?: Record<string, number>;
  workingStatRewards?: Record<string, number>;
  systemEffects?: string[];
  unlocksSystems?: string[];
  summaryLines: string[];
  completed: boolean;
  active: boolean;
  locked: boolean;
  status: "completed" | "current" | "locked" | "available";
  missingPrerequisites: string[];
  lockReason: string | null;
  durationMs: number;
  remainingMs: number;
  readyToComplete: boolean;
};
export type ServerEducationCategory = { id: string; name: string; description: string; courses: ServerEducationCourse[]; progress: { completed: number; total: number; locked: number } };
export type ServerEducationPayload = {
  categories: ServerEducationCategory[];
  completedCourses: string[];
  activeCourse: { courseId: string; categoryId: string; startedAt: number; durationMs: number; completesAt: number } | null;
  passiveBonuses: Record<string, number>;
  activeUnlocks: string[];
  systemUnlocks: string[];
  history: Array<Record<string, unknown>>;
  discoveries: Array<Record<string, unknown>>;
  adminMode: boolean;
  now: number;
};
export type ApiEducationResponse = { ok: true; playerState: ServerPlayerState; education: ServerEducationPayload; message?: string } | ApiFailure;

export type ServerCityBoardEntry = { id: string; section: string; title: string; summary: string; route: string | null; actionLabel: string; source: string; locked: boolean; lockReason: string | null; rewardLabel: string | null; requirementLabel: string | null };
export type ServerCityBoard = { city: { id: string; name: string; role: string }; masthead: { title: string; edition: string; editorial: string }; frontPage: ServerCityBoardEntry; sections: { civicAppointments: ServerCityBoardEntry[]; opportunities: ServerCityBoardEntry[]; bounties: ServerCityBoardEntry[]; publicNotices: ServerCityBoardEntry[]; classifieds: ServerCityBoardEntry[] }; generatedAt: number };
export type ApiCityBoardResponse = { ok: true; playerState: ServerPlayerState; board: ServerCityBoard } | ApiFailure;

export type ServerWorldAtlas = { currentCityId: string; education: Record<string, unknown>; regions: Array<Record<string, unknown>>; cities: Array<Record<string, unknown>>; hiddenSites: Array<Record<string, unknown>>; hiddenCounts?: Record<string, number>; discoveries: Array<Record<string, unknown>>; generatedAt: number };
export type ApiWorldAtlasResponse = { ok: true; playerState: ServerPlayerState; atlas: ServerWorldAtlas } | ApiFailure;

export type ServerCityStanding = {
  cityId: string;
  value: number;
  tier: string;
  nextTierAt: number | null;
  nextTierLabel: string | null;
  contractCompletions: number;
  academyStagesCompleted: number;
  updatedAt: number | null;
};

export type ServerCityContract = {
  id: string;
  cityId: string;
  title: string;
  type: string;
  summary: string;
  risk: "low" | "moderate" | "high";
  requirementLabel: string;
  completion: {
    staminaCost: number;
    note: string | null;
    visitCityId: string | null;
    visitLabel: string | null;
    visitComplete: boolean;
  };
  reward: {
    gold?: number;
    experience?: number;
    items?: Array<{ itemId: string; label: string; quantity: number }>;
  };
  combat: {
    enabled: boolean;
    opponentId: string;
    label: string;
    summary: string;
  } | null;
  status: "available" | "active" | "completed" | "claimed" | "locked";
  acceptedAt: number | null;
  completedAt: number | null;
  claimedAt: number | null;
  visitedCityAt: number | null;
  refreshAvailableAt: number | null;
  runs: number;
  minimumStanding: number;
  standingReward: number;
  canAccept: boolean;
  canComplete: boolean;
  canClaim: boolean;
  canRefresh: boolean;
  blockedReason: string | null;
};

export type ApiCityContractsResponse =
  | {
      ok: true;
      playerState: ServerPlayerState;
      city: { id: string; name: string; role: string };
      currentCityId: string;
      standing: ServerCityStanding;
      contracts: ServerCityContract[];
      combat?: ServerCombatResult | null;
      message?: string;
    }
  | ApiFailure;

export type ServerCityAcademy = {
  id: string;
  cityId: string;
  name: string;
  theme: string;
  entryRequirements: string[];
  requiredCourses: string[];
  missingCourses: string[];
  lockReason: string | null;
  durationMs: number;
  progressionSupports: string[];
  reward: Record<string, unknown>;
  standing: ServerCityStanding;
  stages: ServerCityAcademyStage[];
  currentStageId: string | null;
  isCompleted: boolean;
  completedAt: number | null;
  activeStudy: {
    academyId: string;
    stageId: string;
    cityId: string;
    startedAt: number;
    endsAt: number;
    readyToComplete: boolean;
    progressPercent: number;
  } | null;
  canStart: boolean;
  canComplete: boolean;
};

export type ServerCityAcademyStage = {
  id: string;
  title: string;
  summary: string;
  durationMs: number;
  requiredCourses: string[];
  missingCourses: string[];
  requiredStanding: number;
  standingMissing: number;
  entryRequirements: string[];
  reward: Record<string, unknown>;
  standingReward: number;
  status: "available" | "active" | "completed" | "locked";
  lockReason: string | null;
  completedAt: number | null;
  activeStudy: ServerCityAcademy["activeStudy"];
  canStart: boolean;
  canComplete: boolean;
};

export type ApiCityAcademyResponse =
  | {
      ok: true;
      playerState: ServerPlayerState;
      city: { id: string; name: string; role: string };
      currentCityId: string;
      academy: ServerCityAcademy;
      academies?: ServerCityAcademy[];
      message?: string;
    }
  | ApiFailure;

export type ServerItemSummary = {
  id: string;
  displayName: string;
  category: string;
  subtype: string;
  rarity: string;
  itemRole?: string;
  equipSlot: string | null;
  allowedSlots: string[];
  visualSlot?: string | null;
  allowedVisualSlots?: string[];
  visualOnly?: boolean;
  stackLimit: number;
  valueBuy: number;
  valueSell: number;
  cityBias: string;
  sourceCity: string;
  statModifiers: Record<string, Record<string, number>>;
  combatModifiers: Record<string, number>;
  weaponStats?: { damageMin: number; damageMax: number; damageType: string; accuracy: number; handedness: string; critBonus?: number; speed?: number; penetration?: number } | null;
  armorStats?: { weightClass: string; reductions: Record<string, number>; setId?: string | null } | null;
  setId?: string | null;
  armorSet?: { id: string; name: string; theme: string; profile: string[]; bonuses?: Record<string, unknown> } | null;
  useEffects: Array<Record<string, unknown>>;
  requirements: Record<string, unknown>;
  lockReasonText: string | null;
  shortDescription: string;
  flavorText: string;
  sourceTags: string[];
  academyTags: string[];
  marketEligible?: boolean;
  iconKey: string;
  iconUrl?: string;
  iconBrief: string;
  iconPalette: string[];
  iconSilhouette: string;
  iconRarityFrame: string;
  effectSummary: string[];
};

export type ServerInventoryEntry = {
  itemId: string;
  quantity: number;
  item: ServerItemSummary | null;
};

export type ServerEquipmentSlot = {
  slot: string;
  itemId: string | null;
  item: ServerItemSummary | null;
  effects: string[];
};

export type ServerVisualEquipmentSlot = ServerEquipmentSlot;

export type ApiItemInventoryResponse =
  | {
      ok: true;
      playerState: ServerPlayerState;
      inventory: ServerInventoryEntry[];
      equipment: ServerEquipmentSlot[];
      visualEquipment?: ServerVisualEquipmentSlot[];
      equipmentSlots: string[];
      visualSlots?: string[];
      equipmentTotals: Record<string, unknown>;
      itemBuffs: Record<string, unknown>;
      iconManifest: Array<Record<string, unknown>>;
      catalogueCount: number;
      message?: string | null;
    }
  | ApiFailure;

export type ServerCraftingRequirement = {
  itemId: string;
  item: ServerItemSummary | null;
  quantity: number;
  owned: number;
  missing: number;
};

export type ServerCraftingOutput = {
  itemId: string;
  item: ServerItemSummary | null;
  quantity: number;
};

export type ServerCraftingRecipe = {
  id: string;
  cityId: string;
  city: { id: string; name: string };
  family: string;
  title: string;
  summary: string;
  requirementsText: string;
  minimumStanding: number;
  requiredCourses: string[];
  requiredAcademyUnlocks: string[];
  goldCost: number;
  inputs: ServerCraftingRequirement[];
  outputs: ServerCraftingOutput[];
  currentCityId: string;
  canCraft: boolean;
  lockReason: string | null;
};

export type ServerSalvageOption = {
  itemId: string;
  item: ServerItemSummary | null;
  ownedQuantity: number;
  yieldItems: ServerCraftingOutput[];
  canSalvage: boolean;
  lockReason: string | null;
};

export type ServerRepairOption = {
  slot: string;
  itemId: string | null;
  item: ServerItemSummary | null;
  maintained: boolean;
  bonusUntil: number | null;
  canRepair: boolean;
  lockReason: string | null;
  cost: { items: Array<{ itemId: string; quantity: number }>; gold: number };
};

export type ServerLoadout = {
  slot: string;
  label: string;
  savedAt: number | null;
  active: boolean;
  equipment: Array<{ slot: string; itemId: string | null; item: ServerItemSummary | null }>;
};

export type ApiCraftingResponse =
  | {
      ok: true;
      playerState: ServerPlayerState;
      currentCityId: string;
      currentCityName: string;
      recipes: ServerCraftingRecipe[];
      salvageOptions: ServerSalvageOption[];
      repairOptions: ServerRepairOption[];
      loadouts: ServerLoadout[];
      message?: string | null;
    }
  | ApiFailure;

export type ApiLoadoutsResponse =
  | {
      ok: true;
      playerState: ServerPlayerState;
      loadouts: ServerLoadout[];
      message?: string | null;
    }
  | ApiFailure;

export type ServerCityEconomyStock = {
  itemId: string;
  item?: ServerItemSummary | null;
  price: number;
  quantity: number;
  totalPrice: number;
  tier: string;
  source: string;
  description: string;
  minimumStanding: number;
  requiredCourses: string[];
  missingCourses: string[];
  standingMissing: number;
  canBuy: boolean;
  lockReason: string | null;
};

export type ServerCitySellOffer = {
  itemId: string;
  item?: ServerItemSummary | null;
  category?: string;
  sourceCityId?: string;
  sourceCityName?: string;
  unitPrice: number;
  quantity: number;
  totalPrice: number;
  ownedQuantity: number;
  minimumStanding?: number;
  requiredCourses: string[];
  missingCourses: string[];
  standingMissing?: number;
  note?: string;
  bestDestination?: { cityId: string; cityName: string; price: number } | null;
  canSell: boolean;
  lockReason: string | null;
};

export type ServerTradeOpportunity = {
  itemId: string;
  item?: ServerItemSummary | null;
  category: string;
  buyCityId: string;
  buyCityName: string;
  buyPrice: number;
  bestSellCityId: string;
  bestSellCityName: string;
  bestSellPrice: number;
  expectedMargin: number;
  requiredCourses: string[];
  missingCourses: string[];
  lockReason: string | null;
  note: string;
};

export type ServerCargoSummary = {
  carriedTradeGoods: number;
  currentCityLiquidationValue: number;
  bestCurrentSale: ServerCitySellOffer | null;
};

export type ServerCityMarket = {
  cityId: string;
  name: string;
  summary: string;
  imports: string[];
  exports: string[];
  demand?: { tags?: string[]; headline?: string; shortages?: string[]; highDemand?: string[]; surplus?: string[]; contraband?: string[]; note?: string };
  discountPercent: number;
  sellBonusPercent: number;
  stock: ServerCityEconomyStock[];
  sellOffers: ServerCitySellOffer[];
  tradeOpportunities: ServerTradeOpportunity[];
  cargoSummary: ServerCargoSummary;
};

export type ServerCitySpecialAction = {
  id: string;
  cityId: string;
  name: string;
  summary: string;
  actionLabel: string;
  costGold: number;
  minimumStanding: number;
  requiredCourses: string[];
  missingCourses: string[];
  standingMissing: number;
  cooldownMs: number;
  cooldownUntil: number | null;
  cooldownRemainingMs: number;
  reward: Record<string, unknown>;
  runs: number;
  canUse: boolean;
  lockReason: string | null;
};

export type ServerCityBlackMarket = {
  cityId: string;
  name: string;
  summary: string;
  shadow?: { current: number; max: number; label: string; regenPerHour: number; buyCost?: number; sellCost?: number };
  minimumStanding: number;
  requiredCourses: string[];
  missingCourses: string[];
  standingMissing: number;
  canOpen: boolean;
  lockReason: string | null;
  stock: ServerCityEconomyStock[];
  sellOffers: ServerCitySellOffer[];
};

type CityEconomyBaseResponse = {
  playerState: ServerPlayerState;
  city: { id: string; name: string; role: string };
  currentCityId: string;
  isCurrentCity: boolean;
  standing: ServerCityStanding;
  message?: string;
};

export type ApiCityMarketResponse =
  | (CityEconomyBaseResponse & { ok: true; market: ServerCityMarket })
  | ApiFailure;

export type ApiCitySpecialsResponse =
  | (CityEconomyBaseResponse & { ok: true; specials: ServerCitySpecialAction[] })
  | ApiFailure;

export type ApiCityBlackMarketResponse =
  | (CityEconomyBaseResponse & { ok: true; blackMarket: ServerCityBlackMarket })
  | ApiFailure;

export type ServerMarketplaceListing = {
  id: string;
  itemId: string;
  item: ServerItemSummary | null;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
  status: "active" | "sold" | "cancelled" | "expired";
  cityId: string;
  cityName: string;
  seller: { publicId: number; name: string };
  createdAt: number;
  expiresAt: number | null;
  isOwnListing: boolean;
};

export type ServerMarketplacePayload = {
  listings: ServerMarketplaceListing[];
  inventory: ServerInventoryEntry[];
  filters: Record<string, string>;
  cityDemand?: ServerCityMarket["demand"];
};

export type ApiMarketplaceResponse =
  | { ok: true; playerState: ServerPlayerState; marketplace: ServerMarketplacePayload; listing?: ServerMarketplaceListing; message?: string }
  | ApiFailure;

export type ApiChronicleStatusResponse =
  | {
      ok: true;
      donorTier: Record<string, unknown>;
      legacy: Record<string, unknown>;
      activeRun: Record<string, unknown> | null;
    }
  | ApiFailure;

export type ServerLegacyAchievement = {
  id: string;
  category: string;
  name: string;
  description: string;
  progress: number;
  target: number;
  completed: boolean;
  completedOn?: string;
  rewardPoints: number;
};

export type ApiLegacyAchievementsResponse =
  | {
      ok: true;
      achievementCategories: string[];
      achievements: ServerLegacyAchievement[];
      legacyPoints: {
        totalEarned: number;
        totalSpent: number;
        available: number;
      };
      perkRanks: Record<string, number>;
      newlyAwarded: Array<{
        id: string;
        name: string;
        category: string;
        rewardPoints: number;
      }>;
      legacy: Record<string, unknown>;
    }
  | ApiFailure;


export type ServerSkillEvolutionStep = {
  id: string;
  name: string;
  unlockTier: number;
  unlocked: boolean;
};

export type ServerSkill = {
  id: string;
  name: string;
  family: string;
  slotType: "active" | "passive";
  kind: "active" | "passive";
  tier: number;
  definitionTier: number;
  summary: string;
  unlocked: boolean;
  learned: boolean;
  learning: boolean;
  learningStartedAt: number | null;
  learningCompletesAt: number | null;
  canLearn: boolean;
  canCompleteLearning: boolean;
  learningCostGold: number;
  learningDurationMs: number;
  lockReason: string | null;
  requiredCourses: string[];
  requiredFlags: string[];
  requiredSkills: string[];
  xp: number;
  xpToEvolve: number | null;
  totalUses: number;
  masteryTier: number;
  nextTierThreshold: number | null;
  usesToNextTier: number;
  progressPercent: number;
  evolvesTo: string | null;
  evolvedTo: string | null;
  currentEvolutionId: string;
  currentEvolutionName: string;
  evolutionPath: ServerSkillEvolutionStep[];
  nextTierImprovement: string;
  combat: Record<string, unknown>;
  baseCombat: Record<string, unknown>;
};

export type ServerSkillsPayload = {
  slotConfig: { activeSlots: number; passiveSlots: number };
  families: string[];
  activeSlots: Array<string | null>;
  passiveSlots: Array<string | null>;
  unlockedCount: number;
  learningCount: number;
  masteryThresholds: number[];
  skills: ServerSkill[];
  unlockHistory: Array<Record<string, unknown>>;
  rareManualEligibility?: RareManualEligibility;
  adminControlsEnabled?: boolean;
};

export type ApiSkillsResponse =
  | { ok: true; playerState: ServerPlayerState; skills: ServerSkillsPayload; message?: string }
  | ApiFailure;

export type ApiRecordsResponse =
  | {
      ok: true;
      records: { entries: ServerRecordEntry[]; categories: Record<string, number>; total: number };
      progressionEvents: { pending: ServerProgressionEvent[]; history: ServerProgressionEvent[] };
    }
  | ApiFailure;

export type ApiProgressionEventAckResponse =
  | { ok: true; progressionEvents: { pending: ServerProgressionEvent[]; history: ServerProgressionEvent[] } }
  | ApiFailure;

export type ServerCombatLogEntry = {
  turn: number;
  actor: string;
  target: string;
  skillId: string | null;
  skillName: string;
  outcome: "hit" | "crit" | "miss" | "item";
  damage: number;
  heal?: number;
  message: string;
};

export type ServerCombatResult = {
  context: string;
  energySpent?: number;
  energyBefore?: number | null;
  energyAfter?: number | null;
  requiredEnergy?: number;
  combatXpGained?: number;
  skillXpGained?: number;
  participants?: Record<string, { publicId?: number; energySpent?: number; combatXpGained?: number }>;
  opponent: { id: string; name: string; level: number; summary?: string | null };
  winner: "player" | "opponent" | "draw";
  outcome: "victory" | "defeat" | "draw";
  player: { health: number; maxHealth: number };
  opponentState: { health: number; maxHealth: number };
  activeSkills: Array<{ id: string; name: string; masteryTier?: number; totalUses?: number }>;
  passiveSkills: string[];
  log: ServerCombatLogEntry[];
  skillEvents: Array<Record<string, unknown>>;
  reward?: Record<string, unknown> | null;
  resolvedAt: number;
};

export type ServerArenaCombatPayload = {
  opponents: Array<{ id: string; name: string; tier: number; summary: string; level: number; reward: Record<string, unknown> }>;
  history: Array<Record<string, unknown>>;
  lastResult: ServerCombatResult | null;
};

export type ApiArenaCombatResponse =
  | { ok: true; playerState: ServerPlayerState; arena: ServerArenaCombatPayload; result?: ServerCombatResult; message?: string }
  | ApiFailure;

export type ServerDuelSummary = {
  id: string;
  status: string;
  cityId: string;
  challenger: { publicId: number; name: string };
  target: { publicId: number; name: string };
  createdAt: number;
  resolvedAt?: number;
  winner?: { publicId: number; name: string };
  loser?: { publicId: number; name: string };
  result?: ServerCombatResult;
};

export type ServerDuelsPayload = {
  incoming: ServerDuelSummary[];
  outgoing: ServerDuelSummary[];
  history: ServerDuelSummary[];
};

export type ApiDuelsResponse =
  | { ok: true; playerState: ServerPlayerState; duels: ServerDuelsPayload; result?: ServerCombatResult; message?: string }
  | ApiFailure;

function asSuccess<T extends Record<string, unknown>>(payload: T): T & { ok: true } {
  return { ok: true, ...payload };
}

function asChronicleSuccess(payload: {
  donorTier: Record<string, unknown>;
  legacy: Record<string, unknown>;
  activeRun: Record<string, unknown> | null;
}): ApiChronicleStatusResponse {
  return asSuccess(payload);
}

const API_TIMEOUT_MS = 8000;

async function requestJson<TSuccess>(
  path: string,
  init: RequestInit = {},
): Promise<TSuccess | ApiFailure> {
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), API_TIMEOUT_MS);

  try {
    const response = await fetch(path, {
      ...init,
      headers: {
        ...(init.body ? { "Content-Type": "application/json" } : {}),
        ...(init.headers ?? {}),
      },
      signal: controller.signal,
    });

    let payload: Record<string, unknown> | null = null;
    try {
      payload = (await response.json()) as Record<string, unknown>;
    } catch {
      payload = null;
    }

    if (!response.ok) {
      const code = typeof payload?.code === "string" ? payload.code : null;
      return {
        ok: false,
        error:
          typeof payload?.error === "string"
            ? payload.error
            : `Request failed (${response.status}).`,
        unavailable:
          response.status >= 500 ||
          response.status === 404 ||
          code === "DATABASE_UNAVAILABLE",
        status: response.status,
        code,
      };
    }

    return payload as TSuccess;
  } catch {
    return {
      ok: false,
      error: "Server unavailable right now.",
      unavailable: true,
      status: null,
      code: "NETWORK_UNAVAILABLE",
    };
  } finally {
    window.clearTimeout(timeout);
  }
}

export function registerWithServer(data: {
  firstName: string;
  lastName: string;
  email: string;
  password: string;
  existingPublicId?: number;
}): Promise<ApiAuthResponse> {
  return requestJson<RawAuthSuccess>("/api/register", {
    method: "POST",
    body: JSON.stringify(data),
  }).then((result) => ("ok" in result ? result : asSuccess(result)));
}

export function loginWithServer(data: { email: string; password: string }): Promise<ApiAuthResponse> {
  return requestJson<RawAuthSuccess>("/api/login", {
    method: "POST",
    body: JSON.stringify(data),
  }).then((result) => ("ok" in result ? result : asSuccess(result)));
}

export function getCurrentServerUser(sessionToken: string): Promise<ApiMeResponse> {
  return requestJson<RawMeSuccess>("/api/me", {
    method: "GET",
    headers: {
      Authorization: `Bearer ${sessionToken}`,
    },
  }).then((result) => ("ok" in result ? result : asSuccess(result)));
}

export function saveCurrentServerState(
  sessionToken: string,
  runtimeState: Record<string, unknown>,
  options: {
    keepalive?: boolean;
  } = {},
): Promise<ApiStateSyncResponse> {
  return requestJson<{ playerState: ServerPlayerState }>("/api/state", {
    method: "PUT",
    keepalive: options.keepalive,
    headers: {
      Authorization: `Bearer ${sessionToken}`,
    },
    body: JSON.stringify(runtimeState),
  }).then((result) => ("ok" in result ? result : asSuccess(result)));
}

export function requestPasswordReset(data: { email: string }): Promise<ApiPasswordResetRequestResponse> {
  return requestJson<{ delivered: true }>("/api/forgot-password", {
    method: "POST",
    body: JSON.stringify(data),
  }).then((result) => ("ok" in result ? result : asSuccess(result)));
}

export function submitPasswordReset(data: { token: string; password: string }): Promise<ApiPasswordResetResponse> {
  return requestJson<{ reset: true }>("/api/reset-password", {
    method: "POST",
    body: JSON.stringify(data),
  }).then((result) => ("ok" in result ? result : asSuccess(result)));
}

export function getServerTravelState(sessionToken: string): Promise<ApiTravelResponse> {
  return requestJson<{ playerState: ServerPlayerState; travel: Record<string, unknown> }>("/api/travel", {
    method: "GET",
    headers: {
      Authorization: `Bearer ${sessionToken}`,
    },
  }).then((result) => ("ok" in result ? result : asSuccess(result)));
}

export function getServerCityPeople(
  sessionToken: string,
  cityId: string,
  options: { filter?: string; page?: number; pageSize?: number } = {},
): Promise<ApiCityPeopleResponse> {
  const params = new URLSearchParams();
  if (options.filter) params.set("filter", options.filter);
  if (options.page) params.set("page", String(options.page));
  if (options.pageSize) params.set("pageSize", String(options.pageSize));
  const query = params.toString();
  return requestJson<{ city: { id: string; name: string; role: string; peopleLabel?: string }; population: ServerCityPopulation; people: ServerCityOccupant[] }>(
    `/api/cities/${encodeURIComponent(cityId)}/people${query ? `?${query}` : ""}`,
    { method: "GET", headers: { Authorization: `Bearer ${sessionToken}` } },
  ).then((result) => ("ok" in result ? result : asSuccess(result)));
}

export function getServerEducation(sessionToken: string): Promise<ApiEducationResponse> {
  return requestJson<Omit<ApiEducationResponse & { ok: true }, "ok">>("/api/education", { method: "GET", headers: { Authorization: `Bearer ${sessionToken}` } }).then((result) => ("ok" in result ? result : asSuccess(result)));
}
export function startServerEducationCourse(sessionToken: string, courseId: string): Promise<ApiEducationResponse> {
  return requestJson<Omit<ApiEducationResponse & { ok: true }, "ok">>(`/api/education/${encodeURIComponent(courseId)}/start`, { method: "POST", headers: { Authorization: `Bearer ${sessionToken}` } }).then((result) => ("ok" in result ? result : asSuccess(result)));
}
export function completeServerEducationCourse(sessionToken: string, courseId?: string | null): Promise<ApiEducationResponse> {
  return requestJson<Omit<ApiEducationResponse & { ok: true }, "ok">>("/api/education/complete", { method: "POST", headers: { Authorization: `Bearer ${sessionToken}` }, body: JSON.stringify({ courseId: courseId ?? null }) }).then((result) => ("ok" in result ? result : asSuccess(result)));
}
export function cancelServerEducationCourse(sessionToken: string): Promise<ApiEducationResponse> {
  return requestJson<Omit<ApiEducationResponse & { ok: true }, "ok">>("/api/education/cancel", { method: "POST", headers: { Authorization: `Bearer ${sessionToken}` } }).then((result) => ("ok" in result ? result : asSuccess(result)));
}
export function adminCompleteServerEducationCourse(sessionToken: string, courseId: string): Promise<ApiEducationResponse> {
  return requestJson<Omit<ApiEducationResponse & { ok: true }, "ok">>("/api/education/admin/complete", { method: "POST", headers: { Authorization: `Bearer ${sessionToken}` }, body: JSON.stringify({ courseId }) }).then((result) => ("ok" in result ? result : asSuccess(result)));
}
export function getServerCityBoard(sessionToken: string, cityId?: string | null): Promise<ApiCityBoardResponse> {
  const path = cityId ? `/api/city-board/${encodeURIComponent(cityId)}` : "/api/city-board";
  return requestJson<Omit<ApiCityBoardResponse & { ok: true }, "ok">>(path, { method: "GET", headers: { Authorization: `Bearer ${sessionToken}` } }).then((result) => ("ok" in result ? result : asSuccess(result)));
}
export function getServerWorldAtlas(sessionToken: string): Promise<ApiWorldAtlasResponse> {
  return requestJson<Omit<ApiWorldAtlasResponse & { ok: true }, "ok">>("/api/world-map/atlas", { method: "GET", headers: { Authorization: `Bearer ${sessionToken}` } }).then((result) => ("ok" in result ? result : asSuccess(result)));
}

export function getServerCityContracts(sessionToken: string, cityId: string): Promise<ApiCityContractsResponse> {
  return requestJson<{
    playerState: ServerPlayerState;
    city: { id: string; name: string; role: string };
    currentCityId: string;
    standing: ServerCityStanding;
    contracts: ServerCityContract[];
  }>(`/api/cities/${encodeURIComponent(cityId)}/contracts`, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${sessionToken}`,
    },
  }).then((result) => ("ok" in result ? result : asSuccess(result)));
}

function runServerCityContractAction(
  sessionToken: string,
  contractId: string,
  action: "accept" | "complete" | "claim" | "refresh",
): Promise<ApiCityContractsResponse> {
  return requestJson<{
    playerState: ServerPlayerState;
    city: { id: string; name: string; role: string };
    currentCityId: string;
    standing: ServerCityStanding;
    contracts: ServerCityContract[];
    combat?: ServerCombatResult | null;
    message?: string;
  }>(`/api/cities/contracts/${encodeURIComponent(contractId)}/${action}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${sessionToken}`,
    },
  }).then((result) => ("ok" in result ? result : asSuccess(result)));
}

export function acceptServerCityContract(sessionToken: string, contractId: string): Promise<ApiCityContractsResponse> {
  return runServerCityContractAction(sessionToken, contractId, "accept");
}

export function completeServerCityContract(sessionToken: string, contractId: string): Promise<ApiCityContractsResponse> {
  return runServerCityContractAction(sessionToken, contractId, "complete");
}

export function claimServerCityContract(sessionToken: string, contractId: string): Promise<ApiCityContractsResponse> {
  return runServerCityContractAction(sessionToken, contractId, "claim");
}

export function refreshServerCityContract(sessionToken: string, contractId: string): Promise<ApiCityContractsResponse> {
  return runServerCityContractAction(sessionToken, contractId, "refresh");
}

export function getServerCityAcademy(sessionToken: string, cityId: string): Promise<ApiCityAcademyResponse> {
  return requestJson<{
    playerState: ServerPlayerState;
    city: { id: string; name: string; role: string };
    currentCityId: string;
    academy: ServerCityAcademy;
  }>(`/api/cities/${encodeURIComponent(cityId)}/academy`, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${sessionToken}`,
    },
  }).then((result) => ("ok" in result ? result : asSuccess(result)));
}

function runServerCityAcademyAction(
  sessionToken: string,
  academyId: string,
  action: "start" | "complete",
): Promise<ApiCityAcademyResponse> {
  return requestJson<{
    playerState: ServerPlayerState;
    city: { id: string; name: string; role: string };
    currentCityId: string;
    academy: ServerCityAcademy;
    academies?: ServerCityAcademy[];
    message?: string;
  }>(`/api/cities/academies/${encodeURIComponent(academyId)}/${action}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${sessionToken}`,
    },
  }).then((result) => ("ok" in result ? result : asSuccess(result)));
}

export function startServerCityAcademy(sessionToken: string, academyId: string): Promise<ApiCityAcademyResponse> {
  return runServerCityAcademyAction(sessionToken, academyId, "start");
}

export function completeServerCityAcademy(sessionToken: string, academyId: string): Promise<ApiCityAcademyResponse> {
  return runServerCityAcademyAction(sessionToken, academyId, "complete");
}

export function getServerCityMarket(sessionToken: string, cityId: string): Promise<ApiCityMarketResponse> {
  return requestJson<Omit<ApiCityMarketResponse & { ok: true }, "ok">>(`/api/cities/${encodeURIComponent(cityId)}/market`, {
    method: "GET",
    headers: { Authorization: `Bearer ${sessionToken}` },
  }).then((result) => ("ok" in result ? result : asSuccess(result)));
}

export function buyServerCityMarketItem(
  sessionToken: string,
  cityId: string,
  itemId: string,
  quantity: number,
): Promise<ApiCityMarketResponse> {
  return requestJson<Omit<ApiCityMarketResponse & { ok: true }, "ok">>(`/api/cities/${encodeURIComponent(cityId)}/market/${encodeURIComponent(itemId)}/buy`, {
    method: "POST",
    headers: { Authorization: `Bearer ${sessionToken}` },
    body: JSON.stringify({ quantity }),
  }).then((result) => ("ok" in result ? result : asSuccess(result)));
}

export function sellServerCityMarketItem(
  sessionToken: string,
  cityId: string,
  itemId: string,
  quantity: number,
): Promise<ApiCityMarketResponse> {
  return requestJson<Omit<ApiCityMarketResponse & { ok: true }, "ok">>(`/api/cities/${encodeURIComponent(cityId)}/market/${encodeURIComponent(itemId)}/sell`, {
    method: "POST",
    headers: { Authorization: `Bearer ${sessionToken}` },
    body: JSON.stringify({ quantity }),
  }).then((result) => ("ok" in result ? result : asSuccess(result)));
}

export function getServerCitySpecials(sessionToken: string, cityId: string): Promise<ApiCitySpecialsResponse> {
  return requestJson<Omit<ApiCitySpecialsResponse & { ok: true }, "ok">>(`/api/cities/${encodeURIComponent(cityId)}/specials`, {
    method: "GET",
    headers: { Authorization: `Bearer ${sessionToken}` },
  }).then((result) => ("ok" in result ? result : asSuccess(result)));
}

export function useServerCitySpecial(sessionToken: string, specialId: string): Promise<ApiCitySpecialsResponse> {
  return requestJson<Omit<ApiCitySpecialsResponse & { ok: true }, "ok">>(`/api/cities/specials/${encodeURIComponent(specialId)}/use`, {
    method: "POST",
    headers: { Authorization: `Bearer ${sessionToken}` },
  }).then((result) => ("ok" in result ? result : asSuccess(result)));
}

export function getServerBlackMarket(sessionToken: string, cityId: string): Promise<ApiCityBlackMarketResponse> {
  return requestJson<Omit<ApiCityBlackMarketResponse & { ok: true }, "ok">>(`/api/cities/${encodeURIComponent(cityId)}/black-market`, {
    method: "GET",
    headers: { Authorization: `Bearer ${sessionToken}` },
  }).then((result) => ("ok" in result ? result : asSuccess(result)));
}

export function buyServerBlackMarketItem(
  sessionToken: string,
  cityId: string,
  itemId: string,
  quantity: number,
): Promise<ApiCityBlackMarketResponse> {
  return requestJson<Omit<ApiCityBlackMarketResponse & { ok: true }, "ok">>(`/api/cities/${encodeURIComponent(cityId)}/black-market/${encodeURIComponent(itemId)}/buy`, {
    method: "POST",
    headers: { Authorization: `Bearer ${sessionToken}` },
    body: JSON.stringify({ quantity }),
  }).then((result) => ("ok" in result ? result : asSuccess(result)));
}

export function sellServerBlackMarketItem(
  sessionToken: string,
  cityId: string,
  itemId: string,
  quantity: number,
): Promise<ApiCityBlackMarketResponse> {
  return requestJson<Omit<ApiCityBlackMarketResponse & { ok: true }, "ok">>(`/api/cities/${encodeURIComponent(cityId)}/black-market/${encodeURIComponent(itemId)}/sell`, {
    method: "POST",
    headers: { Authorization: `Bearer ${sessionToken}` },
    body: JSON.stringify({ quantity }),
  }).then((result) => ("ok" in result ? result : asSuccess(result)));
}


export function getServerMarketplace(
  sessionToken: string,
  options: { category?: string; cityId?: string; rarity?: string; seller?: string } = {},
): Promise<ApiMarketplaceResponse> {
  const params = new URLSearchParams();
  if (options.category) params.set("category", options.category);
  if (options.cityId) params.set("cityId", options.cityId);
  if (options.rarity) params.set("rarity", options.rarity);
  if (options.seller) params.set("seller", options.seller);
  const query = params.toString();
  return requestJson<Omit<ApiMarketplaceResponse & { ok: true }, "ok">>(`/api/marketplace${query ? `?${query}` : ""}`, {
    method: "GET",
    headers: { Authorization: `Bearer ${sessionToken}` },
  }).then((result) => ("ok" in result ? result : asSuccess(result)));
}

export function createServerMarketplaceListing(
  sessionToken: string,
  payload: { itemId: string; quantity: number; unitPrice: number; cityId?: string | null },
): Promise<ApiMarketplaceResponse> {
  return requestJson<Omit<ApiMarketplaceResponse & { ok: true }, "ok">>("/api/marketplace/listings", {
    method: "POST",
    headers: { Authorization: `Bearer ${sessionToken}` },
    body: JSON.stringify(payload),
  }).then((result) => ("ok" in result ? result : asSuccess(result)));
}

export function buyServerMarketplaceListing(sessionToken: string, listingId: string): Promise<ApiMarketplaceResponse> {
  return requestJson<Omit<ApiMarketplaceResponse & { ok: true }, "ok">>(`/api/marketplace/listings/${encodeURIComponent(listingId)}/buy`, {
    method: "POST",
    headers: { Authorization: `Bearer ${sessionToken}` },
  }).then((result) => ("ok" in result ? result : asSuccess(result)));
}

export function cancelServerMarketplaceListing(sessionToken: string, listingId: string): Promise<ApiMarketplaceResponse> {
  return requestJson<Omit<ApiMarketplaceResponse & { ok: true }, "ok">>(`/api/marketplace/listings/${encodeURIComponent(listingId)}/cancel`, {
    method: "POST",
    headers: { Authorization: `Bearer ${sessionToken}` },
  }).then((result) => ("ok" in result ? result : asSuccess(result)));
}

export function getServerItemInventory(sessionToken: string): Promise<ApiItemInventoryResponse> {
  return requestJson<Omit<ApiItemInventoryResponse & { ok: true }, "ok">>("/api/items/inventory", {
    method: "GET",
    headers: { Authorization: `Bearer ${sessionToken}` },
  }).then((result) => ("ok" in result ? result : asSuccess(result)));
}

export function equipServerItem(sessionToken: string, itemId: string, slot?: string | null): Promise<ApiItemInventoryResponse> {
  return requestJson<Omit<ApiItemInventoryResponse & { ok: true }, "ok">>("/api/items/equip", {
    method: "POST",
    headers: { Authorization: `Bearer ${sessionToken}` },
    body: JSON.stringify({ itemId, slot }),
  }).then((result) => ("ok" in result ? result : asSuccess(result)));
}

export function unequipServerItem(sessionToken: string, slot: string): Promise<ApiItemInventoryResponse> {
  return requestJson<Omit<ApiItemInventoryResponse & { ok: true }, "ok">>("/api/items/unequip", {
    method: "POST",
    headers: { Authorization: `Bearer ${sessionToken}` },
    body: JSON.stringify({ slot }),
  }).then((result) => ("ok" in result ? result : asSuccess(result)));
}

export function wearServerItem(sessionToken: string, itemId: string, slot?: string | null): Promise<ApiItemInventoryResponse> {
  return requestJson<Omit<ApiItemInventoryResponse & { ok: true }, "ok">>("/api/items/wear", {
    method: "POST",
    headers: { Authorization: `Bearer ${sessionToken}` },
    body: JSON.stringify({ itemId, slot }),
  }).then((result) => ("ok" in result ? result : asSuccess(result)));
}

export function removeWornServerItem(sessionToken: string, slot: string): Promise<ApiItemInventoryResponse> {
  return requestJson<Omit<ApiItemInventoryResponse & { ok: true }, "ok">>("/api/items/remove-worn", {
    method: "POST",
    headers: { Authorization: `Bearer ${sessionToken}` },
    body: JSON.stringify({ slot }),
  }).then((result) => ("ok" in result ? result : asSuccess(result)));
}

export function sendServerItem(sessionToken: string, payload: { itemId: string; targetPublicId: string; quantity: number }): Promise<ApiItemInventoryResponse> {
  return requestJson<Omit<ApiItemInventoryResponse & { ok: true }, "ok">>("/api/items/send", {
    method: "POST",
    headers: { Authorization: `Bearer ${sessionToken}` },
    body: JSON.stringify(payload),
  }).then((result) => ("ok" in result ? result : asSuccess(result)));
}

export function destroyServerItem(sessionToken: string, payload: { itemId: string; quantity: number; confirmation: true | string }): Promise<ApiItemInventoryResponse> {
  return requestJson<Omit<ApiItemInventoryResponse & { ok: true }, "ok">>("/api/items/destroy", {
    method: "POST",
    headers: { Authorization: `Bearer ${sessionToken}` },
    body: JSON.stringify(payload),
  }).then((result) => ("ok" in result ? result : asSuccess(result)));
}

export function useServerItem(sessionToken: string, itemId: string, quantity = 1): Promise<ApiItemInventoryResponse> {
  return requestJson<Omit<ApiItemInventoryResponse & { ok: true }, "ok">>("/api/items/use", {
    method: "POST",
    headers: { Authorization: `Bearer ${sessionToken}` },
    body: JSON.stringify({ itemId, quantity }),
  }).then((result) => ("ok" in result ? result : asSuccess(result)));
}

export function getServerCrafting(sessionToken: string): Promise<ApiCraftingResponse> {
  return requestJson<Omit<ApiCraftingResponse & { ok: true }, "ok">>("/api/items/crafting", {
    method: "GET",
    headers: { Authorization: `Bearer ${sessionToken}` },
  }).then((result) => ("ok" in result ? result : asSuccess(result)));
}

export function craftServerRecipe(sessionToken: string, recipeId: string): Promise<ApiCraftingResponse> {
  return requestJson<Omit<ApiCraftingResponse & { ok: true }, "ok">>(`/api/items/crafting/${encodeURIComponent(recipeId)}/craft`, {
    method: "POST",
    headers: { Authorization: `Bearer ${sessionToken}` },
  }).then((result) => ("ok" in result ? result : asSuccess(result)));
}

export function salvageServerItem(sessionToken: string, itemId: string, quantity = 1): Promise<ApiCraftingResponse> {
  return requestJson<Omit<ApiCraftingResponse & { ok: true }, "ok">>("/api/items/salvage", {
    method: "POST",
    headers: { Authorization: `Bearer ${sessionToken}` },
    body: JSON.stringify({ itemId, quantity }),
  }).then((result) => ("ok" in result ? result : asSuccess(result)));
}

export function repairServerEquipment(sessionToken: string, slot: string): Promise<ApiCraftingResponse> {
  return requestJson<Omit<ApiCraftingResponse & { ok: true }, "ok">>("/api/items/repair", {
    method: "POST",
    headers: { Authorization: `Bearer ${sessionToken}` },
    body: JSON.stringify({ slot }),
  }).then((result) => ("ok" in result ? result : asSuccess(result)));
}

export function getServerLoadouts(sessionToken: string): Promise<ApiLoadoutsResponse> {
  return requestJson<Omit<ApiLoadoutsResponse & { ok: true }, "ok">>("/api/items/loadouts", {
    method: "GET",
    headers: { Authorization: `Bearer ${sessionToken}` },
  }).then((result) => ("ok" in result ? result : asSuccess(result)));
}

export function saveServerLoadout(sessionToken: string, slot: string, label?: string | null): Promise<ApiLoadoutsResponse> {
  return requestJson<Omit<ApiLoadoutsResponse & { ok: true }, "ok">>(`/api/items/loadouts/${encodeURIComponent(slot)}/save`, {
    method: "POST",
    headers: { Authorization: `Bearer ${sessionToken}` },
    body: JSON.stringify({ label }),
  }).then((result) => ("ok" in result ? result : asSuccess(result)));
}

export function equipServerLoadout(sessionToken: string, slot: string): Promise<ApiLoadoutsResponse> {
  return requestJson<Omit<ApiLoadoutsResponse & { ok: true }, "ok">>(`/api/items/loadouts/${encodeURIComponent(slot)}/equip`, {
    method: "POST",
    headers: { Authorization: `Bearer ${sessionToken}` },
  }).then((result) => ("ok" in result ? result : asSuccess(result)));
}

export function startServerTravel(
  sessionToken: string,
  destinationCityId: string,
): Promise<ApiTravelResponse> {
  return requestJson<{ playerState: ServerPlayerState; travel: Record<string, unknown> }>("/api/travel/start", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${sessionToken}`,
    },
    body: JSON.stringify({ destinationCityId }),
  }).then((result) => ("ok" in result ? result : asSuccess(result)));
}

export function cancelServerTravel(sessionToken: string): Promise<ApiTravelResponse> {
  return requestJson<{ playerState: ServerPlayerState; travel: Record<string, unknown> }>("/api/travel/cancel", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${sessionToken}`,
    },
  }).then((result) => ("ok" in result ? result : asSuccess(result)));
}


export function getServerSkills(sessionToken: string): Promise<ApiSkillsResponse> {
  return requestJson<{ playerState: ServerPlayerState; skills: ServerSkillsPayload }>("/api/skills", {
    method: "GET",
    headers: { Authorization: `Bearer ${sessionToken}` },
  }).then((result) => ("ok" in result ? result : asSuccess(result)));
}

export function getServerRecords(sessionToken: string, category?: string | null, limit?: number): Promise<ApiRecordsResponse> {
  const params = new URLSearchParams();
  if (category) params.set("category", category);
  if (typeof limit === "number" && Number.isFinite(limit)) params.set("limit", String(Math.max(1, Math.floor(limit))));
  const suffix = params.toString() ? `?${params.toString()}` : "";
  return requestJson<Omit<ApiRecordsResponse & { ok: true }, "ok">>(`/api/records${suffix}`, {
    method: "GET",
    headers: { Authorization: `Bearer ${sessionToken}` },
  }).then((result) => ("ok" in result ? result : asSuccess(result)));
}

export function acknowledgeProgressionEvent(sessionToken: string, eventId: string = "all"): Promise<ApiProgressionEventAckResponse> {
  return requestJson<Omit<ApiProgressionEventAckResponse & { ok: true }, "ok">>(`/api/progression-events/${encodeURIComponent(eventId)}/ack`, {
    method: "POST",
    headers: { Authorization: `Bearer ${sessionToken}` },
  }).then((result) => ("ok" in result ? result : asSuccess(result)));
}

export function learnServerSkill(sessionToken: string, skillId: string): Promise<ApiSkillsResponse> {
  return requestJson<{ playerState: ServerPlayerState; skills: ServerSkillsPayload; message?: string }>("/api/skills/learn", {
    method: "POST",
    headers: { Authorization: `Bearer ${sessionToken}` },
    body: JSON.stringify({ skillId }),
  }).then((result) => ("ok" in result ? result : asSuccess(result)));
}

export function completeServerSkillLearning(sessionToken: string, skillId?: string | null): Promise<ApiSkillsResponse> {
  return requestJson<{ playerState: ServerPlayerState; skills: ServerSkillsPayload; message?: string }>("/api/skills/complete-learning", {
    method: "POST",
    headers: { Authorization: `Bearer ${sessionToken}` },
    body: JSON.stringify({ skillId: skillId ?? null }),
  }).then((result) => ("ok" in result ? result : asSuccess(result)));
}

export function adminSetServerSkillMastery(sessionToken: string, skillId: string, uses: number): Promise<ApiSkillsResponse> {
  return requestJson<{ playerState: ServerPlayerState; skills: ServerSkillsPayload; message?: string }>("/api/skills/admin/mastery", {
    method: "POST",
    headers: { Authorization: `Bearer ${sessionToken}` },
    body: JSON.stringify({ skillId, uses }),
  }).then((result) => ("ok" in result ? result : asSuccess(result)));
}


export function adminUnlockAllServerSkills(sessionToken: string): Promise<ApiSkillsResponse> {
  return requestJson<{ playerState: ServerPlayerState; skills: ServerSkillsPayload; message?: string }>("/api/skills/admin/unlock-all", {
    method: "POST",
    headers: { Authorization: `Bearer ${sessionToken}` },
  }).then((result) => ("ok" in result ? result : asSuccess(result)));
}

export function slotServerSkill(
  sessionToken: string,
  slotType: "active" | "passive",
  slotIndex: number,
  skillId: string | null,
): Promise<ApiSkillsResponse> {
  return requestJson<{ playerState: ServerPlayerState; skills: ServerSkillsPayload; message?: string }>("/api/skills/slot", {
    method: "POST",
    headers: { Authorization: `Bearer ${sessionToken}` },
    body: JSON.stringify({ slotType, slotIndex, skillId }),
  }).then((result) => ("ok" in result ? result : asSuccess(result)));
}

export function getServerArenaCombat(sessionToken: string): Promise<ApiArenaCombatResponse> {
  return requestJson<{ playerState: ServerPlayerState; arena: ServerArenaCombatPayload }>("/api/arena/combat", {
    method: "GET",
    headers: { Authorization: `Bearer ${sessionToken}` },
  }).then((result) => ("ok" in result ? result : asSuccess(result)));
}

export function sparServerArenaOpponent(sessionToken: string, opponentId: string, combatItemId?: string | null): Promise<ApiArenaCombatResponse> {
  return requestJson<{ playerState: ServerPlayerState; arena: ServerArenaCombatPayload; result: ServerCombatResult; message?: string }>(`/api/arena/combat/spar/${encodeURIComponent(opponentId)}`, {
    method: "POST",
    headers: { Authorization: `Bearer ${sessionToken}` },
    body: JSON.stringify({ combatItemId: combatItemId ?? null }),
  }).then((result) => ("ok" in result ? result : asSuccess(result)));
}

export function getServerDuels(sessionToken: string): Promise<ApiDuelsResponse> {
  return requestJson<{ playerState: ServerPlayerState; duels: ServerDuelsPayload }>("/api/duels", {
    method: "GET",
    headers: { Authorization: `Bearer ${sessionToken}` },
  }).then((result) => ("ok" in result ? result : asSuccess(result)));
}

export function challengeServerDuel(sessionToken: string, targetPublicId: number): Promise<ApiDuelsResponse> {
  return requestJson<{ playerState: ServerPlayerState; duels: ServerDuelsPayload; message?: string }>("/api/duels/challenge", {
    method: "POST",
    headers: { Authorization: `Bearer ${sessionToken}` },
    body: JSON.stringify({ targetPublicId }),
  }).then((result) => ("ok" in result ? result : asSuccess(result)));
}

export function respondServerDuel(sessionToken: string, duelId: string, action: "accept" | "decline"): Promise<ApiDuelsResponse> {
  return requestJson<{ playerState: ServerPlayerState; duels: ServerDuelsPayload; result?: ServerCombatResult; message?: string }>(`/api/duels/${encodeURIComponent(duelId)}/respond`, {
    method: "POST",
    headers: { Authorization: `Bearer ${sessionToken}` },
    body: JSON.stringify({ action }),
  }).then((result) => ("ok" in result ? result : asSuccess(result)));
}

export function getChronicleStatus(sessionToken: string): Promise<ApiChronicleStatusResponse> {
  return requestJson<{ donorTier: Record<string, unknown>; legacy: Record<string, unknown>; activeRun: Record<string, unknown> | null }>("/api/legacy/chronicle", {
    method: "GET",
    headers: {
      Authorization: `Bearer ${sessionToken}`,
    },
  }).then((result) => ("ok" in result ? result : asChronicleSuccess(result)));
}

export function openMonthlyChronicle(sessionToken: string): Promise<ApiChronicleStatusResponse> {
  return requestJson<{ donorTier: Record<string, unknown>; legacy: Record<string, unknown>; activeRun: Record<string, unknown> | null }>("/api/legacy/chronicle/open", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${sessionToken}`,
    },
  }).then((result) => ("ok" in result ? result : asChronicleSuccess(result)));
}

export function submitChronicleChoice(
  sessionToken: string,
  choiceKey: string,
): Promise<ApiChronicleStatusResponse> {
  return requestJson<{ donorTier?: Record<string, unknown>; legacy: Record<string, unknown>; activeRun: Record<string, unknown> | null }>("/api/legacy/chronicle/choice", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${sessionToken}`,
    },
    body: JSON.stringify({ choiceKey }),
  }).then((result) =>
    "ok" in result
      ? result
      : asChronicleSuccess({
          donorTier: result.donorTier ?? {},
          legacy: result.legacy,
          activeRun: result.activeRun,
      }),
  );
}

export function getLegacyAchievements(sessionToken: string): Promise<ApiLegacyAchievementsResponse> {
  return requestJson<{
    achievementCategories: string[];
    achievements: ServerLegacyAchievement[];
    legacyPoints: {
      totalEarned: number;
      totalSpent: number;
      available: number;
    };
    perkRanks: Record<string, number>;
    newlyAwarded: Array<{
      id: string;
      name: string;
      category: string;
      rewardPoints: number;
    }>;
    legacy: Record<string, unknown>;
  }>("/api/legacy/achievements", {
    method: "GET",
    headers: {
      Authorization: `Bearer ${sessionToken}`,
    },
  }).then((result) => ("ok" in result ? result : asSuccess(result)));
}

export function spendLegacyPerkRank(
  sessionToken: string,
  perkId: string,
): Promise<ApiLegacyAchievementsResponse> {
  return requestJson<{
    achievementCategories: string[];
    achievements: ServerLegacyAchievement[];
    legacyPoints: {
      totalEarned: number;
      totalSpent: number;
      available: number;
    };
    perkRanks: Record<string, number>;
    newlyAwarded: Array<{
      id: string;
      name: string;
      category: string;
      rewardPoints: number;
    }>;
    legacy: Record<string, unknown>;
  }>("/api/legacy/perks/rank", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${sessionToken}`,
    },
    body: JSON.stringify({ perkId }),
  }).then((result) => ("ok" in result ? result : asSuccess(result)));
}
