import { type ServerPlayerState } from "./authApi";

export type OneShotChoice = {
  id: string;
  label: string;
  tags: string[];
  completesRun: boolean;
};

export type OneShotScene = {
  id: string;
  title: string;
  narration: string;
  choices: OneShotChoice[];
};

export type OneShotLogEntry = {
  id: string;
  type: "dm" | "choice" | string;
  title: string;
  text: string;
  timestamp: number;
};

export type OneShotReward = {
  gold: number;
  experience: number;
  multiplier?: number;
  items: Array<{ itemId: string; label: string; quantity: number }>;
  levelUps?: Array<Record<string, unknown>>;
};

export type OneShotSession = {
  id: string;
  engine: string;
  status: "active" | "completed" | string;
  campaignId: string;
  title: string;
  theme: string;
  region: string;
  tokenSource: string;
  startedAt: number;
  completedAt: number | null;
  characterSnapshot: Record<string, unknown>;
  scene: OneShotScene | null;
  log: OneShotLogEntry[];
  choicesMade: Array<Record<string, unknown>>;
  rewardPreview: string | null;
  category?: string | null;
  completion?: {
    outcome?: string;
    chronicleSummary?: string;
    reward?: OneShotReward;
    recordTags?: string[];
  } | null;
};

export type OneShotCampaignSummary = {
  id: string;
  title: string;
  cityId: string;
  region: string;
  theme: string;
  category: string;
  durationMinutes: number;
  rewardTags: string[];
  summary: string;
  rewardPreview: string;
  selected: boolean;
  isCompleted: boolean;
  completedAt: number | null;
  isLocked: boolean;
  lockReason: string | null;
  canStart: boolean;
};

export type OneShotHub = {
  engine: {
    name: string;
    version: string;
    standaloneUntouched: boolean;
    directive: string;
  };
  access: {
    tokenCount: number;
    patronBoundTokens: number;
    sealedTokens: number;
    staffTestAvailable: boolean;
    canStart: boolean;
    lockReason: string | null;
    completedCount: number;
    totalCampaigns: number;
  };
  characterSnapshot: Record<string, unknown>;
  selectedCampaignId: string;
  campaigns: OneShotCampaignSummary[];
  activeSession: OneShotSession | null;
  recentChronicles: Array<Record<string, unknown>>;
  generatedAt: number;
};

type ApiFailure = { ok: false; error: string; status: number | null };

export type OneShotResponse =
  | { ok: true; playerState: ServerPlayerState; hub: OneShotHub; session?: OneShotSession; reward?: OneShotReward; message?: string }
  | ApiFailure;

async function requestOneShot(token: string, path: string, init: RequestInit = {}): Promise<OneShotResponse> {
  try {
    const response = await fetch(path, {
      ...init,
      headers: {
        ...(init.body ? { "Content-Type": "application/json" } : {}),
        ...(init.headers ?? {}),
        Authorization: `Bearer ${token}`,
      },
    });
    const payload = (await response.json().catch(() => null)) as
      | ({ playerState?: ServerPlayerState; hub?: OneShotHub; session?: OneShotSession; reward?: OneShotReward; message?: string; error?: string })
      | null;
    if (!response.ok || !payload?.hub || !payload.playerState) {
      return { ok: false, error: payload?.error ?? "Nexis one-shot service unavailable.", status: response.status };
    }
    return { ok: true, playerState: payload.playerState, hub: payload.hub, session: payload.session, reward: payload.reward, message: payload.message };
  } catch {
    return { ok: false, error: "Nexis one-shot service unavailable.", status: null };
  }
}

export function getOneShotHub(token: string) {
  return requestOneShot(token, "/api/one-shots");
}

export function startOneShot(token: string, campaignId?: string) {
  return requestOneShot(token, "/api/one-shots/start", {
    method: "POST",
    body: JSON.stringify(campaignId ? { campaignId } : {}),
  });
}

export function chooseOneShotOption(token: string, sessionId: string, choiceId: string) {
  return requestOneShot(token, `/api/one-shots/${encodeURIComponent(sessionId)}/choose`, {
    method: "POST",
    body: JSON.stringify({ choiceId }),
  });
}
