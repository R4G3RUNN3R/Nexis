import crypto from "node:crypto";
import { withTransaction } from "../db/pool.js";
import { HttpError } from "../lib/errors.js";
import { buildMutableRuntimeState } from "../lib/runtimePlayerState.js";
import {
  createDefaultPlayerState,
  findPlayerStateByUserInternalId,
  upsertPlayerRuntimeState,
} from "../repositories/playerStateRepository.js";
import { CHRONICLE_CHOICES, CHRONICLE_FRAMES, CHRONICLE_SCENES, DONOR_TIERS } from "../data/chronicleData.js";

function asRecord(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : {};
}

function toMonthKey(timestamp = Date.now()) {
  const date = new Date(timestamp);
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
}

function getDonorTierDefinition(tierKey) {
  return DONOR_TIERS.find((entry) => entry.key === tierKey) ?? DONOR_TIERS[0];
}

function hashNumber(seed) {
  return Number.parseInt(crypto.createHash("sha256").update(seed).digest("hex").slice(0, 8), 16);
}

function chooseWeighted(list, seed, getWeight) {
  const weighted = list.map((entry, index) => ({
    entry,
    score: hashNumber(`${seed}:${index}`) + getWeight(entry) * 1000,
  }));
  weighted.sort((left, right) => right.score - left.score);
  return weighted[0]?.entry ?? null;
}

function getBuildWeights(runtimeState) {
  const battle = asRecord(runtimeState.player.battleStats);
  const working = asRecord(runtimeState.player.workingStats);
  return {
    intelligence: Number(working.intelligence ?? 0),
    manualLabor: Number(working.manualLabor ?? 0),
    endurance: Number(working.endurance ?? 0),
    battle:
      Number(battle.strength ?? 0) +
      Number(battle.defense ?? 0) +
      Number(battle.speed ?? 0) +
      Number(battle.dexterity ?? 0),
  };
}

function normalizeLegacyState(runtimeState) {
  const current = asRecord(runtimeState.legacy);
  const hiddenTags = Array.isArray(current.hiddenTags)
    ? current.hiddenTags.filter((entry) => typeof entry === "string")
    : [];
  const visibleEntries = Array.isArray(current.visibleEntries) ? current.visibleEntries : [];
  const chronicleHistory = Array.isArray(current.chronicleHistory) ? current.chronicleHistory : [];
  return {
    donorTier: typeof current.donorTier === "string" ? current.donorTier : "tier_0",
    hiddenTags,
    visibleEntries,
    chronicleHistory,
    monthly: {
      monthKey: typeof asRecord(current.monthly).monthKey === "string" ? asRecord(current.monthly).monthKey : null,
      eligible: Boolean(asRecord(current.monthly).eligible),
      claimed: Boolean(asRecord(current.monthly).claimed),
      resolved: Boolean(asRecord(current.monthly).resolved),
      generatedAt: typeof asRecord(current.monthly).generatedAt === "number" ? asRecord(current.monthly).generatedAt : null,
    },
    activeRun: current.activeRun && typeof current.activeRun === "object" ? current.activeRun : null,
    awards: {
      titles: Array.isArray(asRecord(current.awards).titles) ? asRecord(current.awards).titles : [],
      artifacts: Array.isArray(asRecord(current.awards).artifacts) ? asRecord(current.awards).artifacts : [],
      residences: Array.isArray(asRecord(current.awards).residences) ? asRecord(current.awards).residences : [],
    },
  };
}

export function ensureChronicleEntitlement(runtimeState, now = Date.now()) {
  const legacy = normalizeLegacyState(runtimeState);
  const monthKey = toMonthKey(now);
  const donorTier = getDonorTierDefinition(legacy.donorTier);
  if (legacy.monthly.monthKey !== monthKey) {
    legacy.monthly = {
      monthKey,
      eligible: donorTier.chronicleEligible,
      claimed: false,
      resolved: false,
      generatedAt: null,
    };
    runtimeState.legacy = legacy;
    return { changed: true, legacy };
  }
  runtimeState.legacy = legacy;
  return { changed: false, legacy };
}

function tagsSatisfied(requiredTags, blockedTags, hiddenTags) {
  return requiredTags.every((tag) => hiddenTags.includes(tag)) && blockedTags.every((tag) => !hiddenTags.includes(tag));
}

function buildChronicleRun(runtimeState, user, now = Date.now()) {
  const legacy = normalizeLegacyState(runtimeState);
  const monthKey = toMonthKey(now);
  const seedBase = `${user.internalId}:${monthKey}:${legacy.hiddenTags.sort().join("|")}:${legacy.chronicleHistory.length}`;
  const framePool = CHRONICLE_FRAMES.filter((frame) => tagsSatisfied(frame.requiredTags, frame.blockedTags, legacy.hiddenTags));
  const frame = chooseWeighted(framePool, `${seedBase}:frame`, () => 1) ?? CHRONICLE_FRAMES[0];
  const buildWeights = getBuildWeights(runtimeState);
  const scenePool = CHRONICLE_SCENES.filter((scene) => scene.frameKey === frame.key && tagsSatisfied(scene.requiredTags, scene.blockedTags, legacy.hiddenTags));
  const rankedScenes = [...scenePool]
    .map((scene, index) => ({
      scene,
      score:
        hashNumber(`${seedBase}:scene:${index}`) +
        (Number(scene.weights.intelligence ?? 0) * buildWeights.intelligence) +
        (Number(scene.weights.manualLabor ?? 0) * buildWeights.manualLabor) +
        (Number(scene.weights.endurance ?? 0) * buildWeights.endurance) +
        (Number(scene.weights.battle ?? 0) * buildWeights.battle * 0.05),
    }))
    .sort((left, right) => right.score - left.score)
    .slice(0, 3)
    .map((entry) => entry.scene);

  return {
    runId: `chronicle_${monthKey}_${hashNumber(seedBase).toString(16)}`,
    monthKey,
    seed: hashNumber(seedBase),
    frameKey: frame.key,
    frameTitle: frame.title,
    frameSummary: frame.summary,
    sceneKeys: rankedScenes.map((scene) => scene.key),
    currentSceneIndex: 0,
    resolvedChoices: [],
    startedAt: now,
    completedAt: null,
  };
}

async function loadRuntimeState(client, user) {
  await createDefaultPlayerState(client, user.internalId);
  const playerState = await findPlayerStateByUserInternalId(client, user.internalId);
  if (!playerState) {
    throw new HttpError(404, "Player state unavailable.", "PLAYER_STATE_NOT_FOUND");
  }
  const runtimeState = buildMutableRuntimeState(user, playerState);
  ensureChronicleEntitlement(runtimeState);
  return { playerState, runtimeState };
}

function serializeRunForResponse(runtimeState) {
  const legacy = normalizeLegacyState(runtimeState);
  const run = asRecord(legacy.activeRun);
  if (!run.runId) return null;
  const currentScene = CHRONICLE_SCENES.find((scene) => scene.key === run.sceneKeys?.[run.currentSceneIndex]) ?? null;
  return {
    runId: run.runId,
    monthKey: run.monthKey,
    frameKey: run.frameKey,
    frameTitle: run.frameTitle,
    frameSummary: run.frameSummary,
    currentSceneIndex: Number(run.currentSceneIndex ?? 0),
    currentScene: currentScene
      ? {
          key: currentScene.key,
          text: currentScene.text,
          choices: currentScene.choiceKeys.map((choiceKey) => {
            const choice = CHRONICLE_CHOICES.find((entry) => entry.key === choiceKey);
            return choice ? { key: choice.key, label: choice.label } : null;
          }).filter(Boolean),
        }
      : null,
    resolvedChoices: Array.isArray(run.resolvedChoices) ? run.resolvedChoices : [],
    completedAt: typeof run.completedAt === "number" ? run.completedAt : null,
  };
}

function applyChoiceOutcome(runtimeState, choiceKey, now = Date.now()) {
  const legacy = normalizeLegacyState(runtimeState);
  const run = asRecord(legacy.activeRun);
  const choice = CHRONICLE_CHOICES.find((entry) => entry.key === choiceKey);
  if (!choice) {
    throw new HttpError(400, "Chronicle choice unavailable.", "CHRONICLE_CHOICE_INVALID");
  }

  legacy.hiddenTags = [...new Set([...legacy.hiddenTags, ...choice.addTags])].filter(
    (tag) => !choice.removeTags.includes(tag),
  );

  if (choice.visibleEntry) {
    legacy.visibleEntries.unshift({
      id: `legacy_${Date.now()}_${choice.key}`,
      title: choice.visibleEntry.title,
      summary: choice.visibleEntry.summary,
      kind: choice.visibleEntry.kind,
      awardedAt: now,
    });
  }

  if (choice.awardTitle) legacy.awards.titles.unshift({ key: choice.awardTitle, awardedAt: now });
  if (choice.awardArtifact) legacy.awards.artifacts.unshift({ key: choice.awardArtifact, awardedAt: now });
  if (choice.awardResidence) legacy.awards.residences.unshift({ key: choice.awardResidence, awardedAt: now });

  const resolvedChoices = Array.isArray(run.resolvedChoices) ? [...run.resolvedChoices] : [];
  resolvedChoices.push({
    choiceKey: choice.key,
    label: choice.label,
    outcome: choice.outcome,
    resolvedAt: now,
  });

  const nextIndex = Number(run.currentSceneIndex ?? 0) + 1;
  const completed = nextIndex >= (Array.isArray(run.sceneKeys) ? run.sceneKeys.length : 0);
  legacy.activeRun = {
    ...run,
    currentSceneIndex: completed ? Number(run.currentSceneIndex ?? 0) : nextIndex,
    resolvedChoices,
    completedAt: completed ? now : null,
  };

  if (completed) {
    legacy.monthly.claimed = true;
    legacy.monthly.resolved = true;
    legacy.chronicleHistory.unshift({
      runId: run.runId,
      monthKey: run.monthKey,
      frameKey: run.frameKey,
      frameTitle: run.frameTitle,
      resolvedChoices,
      completedAt: now,
    });
  }

  runtimeState.legacy = legacy;
  return {
    completed,
    selectedChoice: choice,
  };
}

export async function getChronicleStatusForUser(user) {
  return withTransaction(async (client) => {
    const { runtimeState } = await loadRuntimeState(client, user);
    return {
      donorTier: getDonorTierDefinition(normalizeLegacyState(runtimeState).donorTier),
      legacy: normalizeLegacyState(runtimeState),
      activeRun: serializeRunForResponse(runtimeState),
    };
  });
}

export async function setDonorTierForUser(actorUser, targetUser, payload) {
  return withTransaction(async (client) => {
    if (!actorUser?.privilegeRole || actorUser.privilegeRole === "player") {
      throw new HttpError(403, "Only staff can modify donor tiers.", "DONOR_TIER_FORBIDDEN");
    }
    const { runtimeState } = await loadRuntimeState(client, targetUser);
    const donorTierKey = String(payload?.donorTier ?? "").trim();
    const donorTier = getDonorTierDefinition(donorTierKey);
    if (donorTier.key !== donorTierKey) {
      throw new HttpError(400, "Donor tier unavailable.", "DONOR_TIER_INVALID");
    }
    const legacy = normalizeLegacyState(runtimeState);
    legacy.donorTier = donorTier.key;
    runtimeState.legacy = legacy;
    ensureChronicleEntitlement(runtimeState);
    const playerState = await upsertPlayerRuntimeState(client, targetUser.internalId, runtimeState);
    return { playerState, donorTier };
  });
}

export async function openMonthlyChronicleForUser(user) {
  return withTransaction(async (client) => {
    const { runtimeState } = await loadRuntimeState(client, user);
    const legacy = normalizeLegacyState(runtimeState);
    const donorTier = getDonorTierDefinition(legacy.donorTier);
    if (!donorTier.chronicleEligible) {
      throw new HttpError(403, "This donor tier does not grant a Legacy Chronicle.", "CHRONICLE_TIER_REQUIRED");
    }
    if (!legacy.monthly.eligible || legacy.monthly.claimed) {
      throw new HttpError(409, "No monthly Chronicle is currently available.", "CHRONICLE_MONTHLY_UNAVAILABLE");
    }
    if (!legacy.activeRun) {
      legacy.activeRun = buildChronicleRun(runtimeState, user);
      legacy.monthly.generatedAt = Date.now();
      runtimeState.legacy = legacy;
    }
    const playerState = await upsertPlayerRuntimeState(client, user.internalId, runtimeState);
    return {
      playerState,
      donorTier,
      activeRun: serializeRunForResponse(runtimeState),
    };
  });
}

export async function submitChronicleChoiceForUser(user, payload) {
  return withTransaction(async (client) => {
    const { runtimeState } = await loadRuntimeState(client, user);
    const legacy = normalizeLegacyState(runtimeState);
    if (!legacy.activeRun) {
      throw new HttpError(409, "No active Chronicle run exists.", "CHRONICLE_RUN_MISSING");
    }
    const currentScene = CHRONICLE_SCENES.find(
      (scene) => scene.key === legacy.activeRun.sceneKeys?.[legacy.activeRun.currentSceneIndex],
    );
    if (!currentScene) {
      throw new HttpError(409, "Chronicle scene unavailable.", "CHRONICLE_SCENE_INVALID");
    }
    const choiceKey = String(payload?.choiceKey ?? "").trim();
    if (!currentScene.choiceKeys.includes(choiceKey)) {
      throw new HttpError(400, "That choice does not belong to the current Chronicle scene.", "CHRONICLE_CHOICE_SCENE_MISMATCH");
    }

    const outcome = applyChoiceOutcome(runtimeState, choiceKey);
    const playerState = await upsertPlayerRuntimeState(client, user.internalId, runtimeState);
    return {
      playerState,
      activeRun: serializeRunForResponse(runtimeState),
      completed: outcome.completed,
      selectedChoice: {
        key: outcome.selectedChoice.key,
        label: outcome.selectedChoice.label,
        outcome: outcome.selectedChoice.outcome,
      },
      legacy: normalizeLegacyState(runtimeState),
    };
  });
}
