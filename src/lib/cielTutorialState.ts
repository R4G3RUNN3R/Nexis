import { CIEL_TUTORIAL_VERSION } from "../data/cielTutorialData";
import { readCachedRuntimeState, writeCachedRuntimeState } from "./runtimeStateCache";

export type CielTutorialState = {
  version: number;
  introSeenAt?: string;
  introCompletedAt?: string;
  skippedAt?: string;
  spotlightPending?: string;
  spotlightCompletedAt?: string;
  spotlightSkippedAt?: string;
  lastStepId?: string;
  completedStepIds?: string[];
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function asString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

export function readCielTutorialState(playerLike: unknown): CielTutorialState {
  const player = isRecord(playerLike) ? playerLike : {};
  const ui = isRecord(player.ui) ? player.ui : {};
  const raw = isRecord(ui.cielTutorial) ? ui.cielTutorial : {};
  const completedStepIds = Array.isArray(raw.completedStepIds)
    ? raw.completedStepIds.filter((entry): entry is string => typeof entry === "string" && entry.length <= 64)
    : [];

  return {
    version: Number(raw.version) === CIEL_TUTORIAL_VERSION ? CIEL_TUTORIAL_VERSION : CIEL_TUTORIAL_VERSION,
    introSeenAt: asString(raw.introSeenAt),
    introCompletedAt: asString(raw.introCompletedAt),
    skippedAt: asString(raw.skippedAt),
    spotlightPending: asString(raw.spotlightPending),
    spotlightCompletedAt: asString(raw.spotlightCompletedAt),
    spotlightSkippedAt: asString(raw.spotlightSkippedAt),
    lastStepId: asString(raw.lastStepId),
    completedStepIds,
  };
}

export function shouldShowCielIntro(playerLike: unknown) {
  const state = readCielTutorialState(playerLike);
  return !state.introCompletedAt && !state.skippedAt;
}

export function shouldRunHomeSpotlight(playerLike: unknown) {
  const state = readCielTutorialState(playerLike);
  return state.spotlightPending === "true" && !state.spotlightCompletedAt && !state.spotlightSkippedAt && !state.skippedAt;
}

export function updateCielTutorialState(email: string, patch: Partial<CielTutorialState>) {
  const runtime = readCachedRuntimeState(email);
  const existingPlayer = runtime.player ?? {};
  const existingUi = isRecord(existingPlayer.ui) ? existingPlayer.ui : {};
  const current = readCielTutorialState(existingPlayer);
  const next: CielTutorialState = {
    ...current,
    ...patch,
    version: CIEL_TUTORIAL_VERSION,
    completedStepIds: patch.completedStepIds ?? current.completedStepIds ?? [],
  };

  writeCachedRuntimeState(email, {
    player: {
      ...existingPlayer,
      ui: {
        ...existingUi,
        cielTutorial: next,
      },
    },
  });

  window.dispatchEvent(new Event("nexis:player-refresh"));
}

export function nowIso() {
  return new Date().toISOString();
}