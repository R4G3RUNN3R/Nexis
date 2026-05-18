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

export type ServerPlayerState = {
  level: number;
  experience?: number;
  gold: number;
  currencies?: Record<string, number>;
  itemEnhancements?: Record<string, string[]>;
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
};

export type ServerCityPopulation = {
  visibleCount: number;
  listLimit: number;
  peopleLabel?: string;
  guildmatesVisible: number;
  consortiumMembersVisible: number;
};

export type ApiCityPeopleResponse =
  | {
      ok: true;
      city: { id: string; name: string; role: string; peopleLabel?: string };
      population: ServerCityPopulation;
      people: ServerCityOccupant[];
    }
  | ApiFailure;

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
      message?: string;
    }
  | ApiFailure;

export type ServerCityEconomyStock = {
  itemId: string;
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

export function getServerCityPeople(sessionToken: string, cityId: string): Promise<ApiCityPeopleResponse> {
  return requestJson<{ city: { id: string; name: string; role: string; peopleLabel?: string }; population: ServerCityPopulation; people: ServerCityOccupant[] }>(
    `/api/cities/${encodeURIComponent(cityId)}/people`,
    {
      method: "GET",
      headers: {
        Authorization: `Bearer ${sessionToken}`,
      },
    },
  ).then((result) => ("ok" in result ? result : asSuccess(result)));
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
