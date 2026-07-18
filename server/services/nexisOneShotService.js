import crypto from "crypto";
import { withTransaction } from "../db/pool.js";
import { HttpError } from "../lib/errors.js";
import { buildMutableRuntimeState } from "../lib/runtimePlayerState.js";
import { createDefaultPlayerState, findPlayerStateByUserInternalId, upsertPlayerRuntimeState } from "../repositories/playerStateRepository.js";
import { findOrganizationForUserByType } from "../repositories/organizationRepository.js";
import { getCityDefinition, normalizeCityId } from "../data/cityData.js";
import { DMOS_NEXIS_DIRECTIVE, NEXIS_ONE_SHOT_ENGINE, getOneShotCampaign, getOneShotCampaignForCity, getOneShotCampaigns } from "../data/nexisOneShotData.js";
import { getItemDisplayName } from "../data/itemData.js";
import { addPlayerExperience } from "./progressionService.js";
import { addPlayerRecord, queueProgressionEvent } from "./playerRecordsService.js";
import { evaluateLegacyAchievementsForRuntime } from "./achievementService.js";
import { recordOneShotCompletion } from "../repositories/oneShotCompletionRepository.js";

function asRecord(value) { return value && typeof value === "object" && !Array.isArray(value) ? value : {}; }
function asArray(value) { return Array.isArray(value) ? value : []; }
function asNumber(value, fallback = 0) { const numeric = Number(value); return Number.isFinite(numeric) ? numeric : fallback; }
function asWholeNumber(value, fallback = 0) { return Math.max(0, Math.floor(asNumber(value, fallback))); }
function cleanId(value) { return String(value ?? "entry").toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "").slice(0, 64) || "entry"; }

// Ticket A: locked unconditionally - every exported function in this file
// ends in an upsertPlayerRuntimeState call (even getOneShotHubForUser, to
// persist token/session normalization), so there is no genuinely read-only
// caller to spare from the lock. Two concurrent completion attempts for
// the same session (double-click, retried request, two tabs) previously
// both read the same "activeSession.status === 'active'" snapshot before
// either committed; now the second blocks on the row lock and re-reads a
// state where the first request's write has already landed.
async function loadRuntimeState(client, user) {
  await createDefaultPlayerState(client, user.internalId);
  const playerState = await findPlayerStateByUserInternalId(client, user.internalId, { forUpdate: true });
  if (!playerState) throw new HttpError(404, "Player state unavailable.", "PLAYER_STATE_NOT_FOUND");
  return { playerState, runtimeState: buildMutableRuntimeState(user, playerState) };
}

function currentCityId(runtimeState) {
  const travel = asRecord(runtimeState.travel);
  const current = asRecord(asRecord(runtimeState.player).current);
  return normalizeCityId(travel.currentCityId ?? current.currentCityId ?? "nexis");
}

function formatOrganizationPublicId(publicId, type) {
  const raw = String(publicId ?? "").trim();
  if (!raw) return null;
  if (/^[GC]\d+$/i.test(raw)) return raw.toUpperCase();
  const numeric = Number(raw.replace(/[^0-9]/g, ""));
  if (!Number.isFinite(numeric) || numeric <= 0) return null;
  const prefix = type === "guild" ? "G" : type === "consortium" ? "C" : "";
  return `${prefix}${numeric}`;
}

function getOrganizationLabel(value, type, fallback) {
  const record = asRecord(value);
  const candidates = [record.membership, record.myOrganization, record.organization, record].map(asRecord);
  for (const org of candidates) {
    const name = typeof org.name === "string" && org.name.trim() ? org.name.trim() : null;
    if (!name) continue;
    const publicId = formatOrganizationPublicId(org.publicId ?? org.organizationPublicId ?? record.publicId ?? record.organizationPublicId, type);
    return publicId ? `${name} [${publicId}]` : name;
  }
  return fallback;
}

function getOrganizationLabelFromEntity(organization, type) {
  const record = asRecord(organization);
  const name = typeof record.name === "string" && record.name.trim() ? record.name.trim() : null;
  if (!name) return null;
  const publicId = formatOrganizationPublicId(record.publicId, type);
  return publicId ? `${name} [${publicId}]` : name;
}

async function loadOrganizationLabels(client, user, runtimeState) {
  let guild = getOrganizationLabel(runtimeState.guild, "guild", null);
  let consortium = getOrganizationLabel(runtimeState.consortium, "consortium", null);

  if (!guild) {
    guild = getOrganizationLabelFromEntity(await findOrganizationForUserByType(client, user.internalId, "guild"), "guild");
  }
  if (!consortium) {
    consortium = getOrganizationLabelFromEntity(await findOrganizationForUserByType(client, user.internalId, "consortium"), "consortium");
  }

  return {
    guild: guild ?? "No guild",
    consortium: consortium ?? "No consortium",
  };
}

function buildCharacterSnapshot(user, runtimeState, organizationLabels = {}) {
  const player = asRecord(runtimeState.player);
  const cityId = currentCityId(runtimeState);
  const city = getCityDefinition(cityId);
  const education = asRecord(runtimeState.education);
  const completedCourses = asArray(education.completedCourses).concat(asArray(education.completedCourseIds));
  const skills = asRecord(player.skills);
  const unlockedSkills = asArray(skills.unlocked).concat(Object.keys(asRecord(skills.learned)));
  const title = typeof player.title === "string" && player.title.trim() ? player.title.trim() : "Untitled citizen";

  return {
    publicId: user.publicId,
    displayName: `${player.name ?? user.firstName}${player.lastName || user.lastName ? ` ${player.lastName || user.lastName}` : ""}`.trim(),
    title,
    level: asWholeNumber(player.level, 1),
    currentCityId: cityId,
    currentCityName: city.name,
    condition: asRecord(player.condition).type ?? "normal",
    lifePath: asRecord(player.lifePath).current ?? null,
    guild: organizationLabels.guild ?? getOrganizationLabel(runtimeState.guild, "guild", "No guild"),
    consortium: organizationLabels.consortium ?? getOrganizationLabel(runtimeState.consortium, "consortium", "No consortium"),
    educationCompleted: Array.from(new Set(completedCourses.filter((entry) => typeof entry === "string"))).slice(0, 12),
    skillsKnown: Array.from(new Set(unlockedSkills.filter((entry) => typeof entry === "string"))).slice(0, 12),
    stats: {
      health: asWholeNumber(asRecord(player.stats).health, 0),
      maxHealth: asWholeNumber(asRecord(player.stats).maxHealth, 0),
      energy: asWholeNumber(asRecord(player.stats).energy, 0),
      maxEnergy: asWholeNumber(asRecord(player.stats).maxEnergy, 0),
      shadow: asWholeNumber(asRecord(player.shadow).current, 0),
      maxShadow: asWholeNumber(asRecord(player.shadow).max, 0),
    },
  };
}

function normalizeOneShotState(runtimeState) {
  const player = asRecord(runtimeState.player);
  const current = asRecord(player.dmosOneShots);
  const tokens = asRecord(current.tokens);
  const activeSession = asRecord(current.activeSession);
  const history = asArray(current.history).filter((entry) => entry && typeof entry === "object");
  const completedCampaignIds = Array.from(new Set([
    ...asArray(current.completedCampaignIds),
    ...history.map((entry) => entry.campaignId),
  ].filter((entry) => typeof entry === "string" && entry.trim()).map((entry) => entry.trim())));
  const normalized = {
    tokens: {
      patronBound: asWholeNumber(tokens.patronBound, 0),
      sealed: asWholeNumber(tokens.sealed, 0),
      lifetimeSpent: asWholeNumber(tokens.lifetimeSpent, 0),
    },
    activeSession: activeSession.status === "active" ? activeSession : null,
    completedCampaignIds,
    history: history.slice(0, 60),
    lastUpdatedAt: typeof current.lastUpdatedAt === "number" ? current.lastUpdatedAt : null,
  };
  player.dmosOneShots = normalized;
  runtimeState.player = player;
  return normalized;
}

function getCompletedCampaignMap(oneShots) {
  const completed = new Map();
  for (const campaignId of asArray(oneShots.completedCampaignIds)) {
    if (typeof campaignId === "string" && campaignId.trim()) completed.set(campaignId.trim(), { completedAt: null, source: "completedCampaignIds" });
  }
  for (const entry of asArray(oneShots.history)) {
    const record = asRecord(entry);
    const campaignId = typeof record.campaignId === "string" && record.campaignId.trim() ? record.campaignId.trim() : null;
    if (!campaignId) continue;
    const completedAt = typeof record.completedAt === "number" ? record.completedAt : null;
    const previous = completed.get(campaignId);
    if (!previous || (completedAt && completedAt > asWholeNumber(previous.completedAt, 0))) {
      completed.set(campaignId, { completedAt, title: record.title ?? null, source: "history" });
    }
  }
  return completed;
}

function pickDefaultCampaign(runtimeState, completedCampaigns) {
  const cityId = currentCityId(runtimeState);
  const campaigns = getOneShotCampaigns();
  return campaigns.find((campaign) => campaign.cityId === cityId && !completedCampaigns.has(campaign.id))
    ?? campaigns.find((campaign) => !completedCampaigns.has(campaign.id))
    ?? getOneShotCampaignForCity(cityId)
    ?? campaigns[0]
    ?? null;
}

function serializeCampaignSummary(campaign, selectedCampaignId, completedCampaigns, oneShots, user) {
  const completion = completedCampaigns.get(campaign.id) ?? null;
  const tokenCount = availableTokenCount(oneShots, user);
  const active = Boolean(oneShots.activeSession);
  return {
    id: campaign.id,
    title: campaign.title,
    cityId: campaign.cityId,
    region: campaign.region,
    theme: campaign.theme,
    category: campaign.category ?? campaign.theme,
    durationMinutes: asWholeNumber(campaign.durationMinutes, 20),
    rewardTags: asArray(campaign.rewardTags).filter((entry) => typeof entry === "string"),
    summary: campaign.summary,
    rewardPreview: campaign.rewardPreview,
    selected: campaign.id === selectedCampaignId,
    isCompleted: Boolean(completion),
    completedAt: completion?.completedAt ?? null,
    isLocked: Boolean(completion),
    lockReason: completion ? "Already recorded in your Chronicle. Choose another one-shot." : null,
    canStart: !active && !completion && tokenCount > 0,
  };
}

function isStaffOrAdmin(user) {
  return user?.privilegeRole === "staff" || user?.privilegeRole === "admin";
}

function availableTokenCount(oneShots, user) {
  const tokens = asRecord(oneShots.tokens);
  return asWholeNumber(tokens.patronBound, 0) + asWholeNumber(tokens.sealed, 0) + (isStaffOrAdmin(user) ? 1 : 0);
}

function consumeToken(oneShots, user) {
  const tokens = oneShots.tokens;
  if (tokens.patronBound > 0) {
    tokens.patronBound -= 1;
    tokens.lifetimeSpent += 1;
    return "patron_bound";
  }
  if (tokens.sealed > 0) {
    tokens.sealed -= 1;
    tokens.lifetimeSpent += 1;
    return "sealed_token";
  }
  if (isStaffOrAdmin(user)) return "staff_test";
  throw new HttpError(409, "No DMOS one-shot token available. Founder Pack or Patron access required.", "ONE_SHOT_TOKEN_REQUIRED");
}

function getScene(campaign, sceneId) {
  return asRecord(campaign.scenes)[sceneId] ?? null;
}

function serializeChoice(choice) {
  return { id: choice.id, label: choice.label, tags: asArray(choice.tags), completesRun: Boolean(choice.conclusion) };
}

function serializeSession(session) {
  if (!session) return null;
  const campaign = getOneShotCampaign(session.campaignId);
  const scene = session.status === "active" && campaign ? getScene(campaign, session.sceneId) : null;
  return {
    id: session.id,
    engine: session.engine,
    status: session.status,
    campaignId: session.campaignId,
    title: session.title,
    theme: session.theme,
    region: session.region,
    tokenSource: session.tokenSource,
    startedAt: session.startedAt,
    completedAt: session.completedAt ?? null,
    characterSnapshot: asRecord(session.characterSnapshot),
    scene: scene ? { id: scene.id, title: scene.title, narration: scene.narration, choices: asArray(scene.choices).map(serializeChoice) } : null,
    log: asArray(session.log).slice(-12),
    choicesMade: asArray(session.choicesMade),
    rewardPreview: campaign?.rewardPreview ?? null,
    category: campaign?.category ?? session.category ?? null,
    completion: session.completion ?? null,
  };
}

function serializeHub(runtimeState, user, organizationLabels = {}) {
  const oneShots = normalizeOneShotState(runtimeState);
  const completedCampaigns = getCompletedCampaignMap(oneShots);
  const selectedCampaign = pickDefaultCampaign(runtimeState, completedCampaigns);
  const campaigns = getOneShotCampaigns();
  const completedCount = campaigns.filter((campaign) => completedCampaigns.has(campaign.id)).length;
  const allComplete = campaigns.length > 0 && completedCount >= campaigns.length;
  const tokens = asRecord(oneShots.tokens);
  const tokenCount = availableTokenCount(oneShots, user);
  return {
    engine: { name: "DMOS Nexis One-Shot Adapter", version: NEXIS_ONE_SHOT_ENGINE, standaloneUntouched: true, directive: DMOS_NEXIS_DIRECTIVE },
    access: {
      tokenCount,
      patronBoundTokens: asWholeNumber(tokens.patronBound, 0),
      sealedTokens: asWholeNumber(tokens.sealed, 0),
      staffTestAvailable: isStaffOrAdmin(user),
      canStart: !oneShots.activeSession && tokenCount > 0 && !allComplete,
      lockReason: oneShots.activeSession
        ? "Finish the active one-shot before opening another."
        : allComplete
          ? "Every available Nexis one-shot is already recorded in your Chronicle."
          : tokenCount > 0
            ? null
            : "No DMOS token available. Patronage or a Sealed DMOS Token unlocks a run.",
      completedCount,
      totalCampaigns: campaigns.length,
    },
    characterSnapshot: buildCharacterSnapshot(user, runtimeState, organizationLabels),
    selectedCampaignId: selectedCampaign?.id ?? campaigns[0]?.id ?? "",
    campaigns: campaigns.map((campaign) => serializeCampaignSummary(campaign, selectedCampaign?.id, completedCampaigns, oneShots, user)),
    activeSession: serializeSession(oneShots.activeSession),
    recentChronicles: asArray(oneShots.history).slice(0, 8),
    generatedAt: Date.now(),
  };
}

function maybeAbsoluteMultiplier(runtimeState, user) {
  const player = asRecord(runtimeState.player);
  const titleBits = [player.title, asRecord(asRecord(player.prestige).currentTitle).id, asRecord(asRecord(player.prestige).currentTitle).label]
    .map((value) => String(value ?? "").toLowerCase().replace(/[^a-z0-9]+/g, ""));
  const hasAbsoluteTitle = titleBits.some((value) => value === "theabsolute" || value === "absolute");
  return Number(user?.publicId) === 1000000 && hasAbsoluteTitle ? 100 : 1;
}

function addInventoryItem(runtimeState, itemId, quantity) {
  const qty = asWholeNumber(quantity, 0);
  if (!itemId || qty <= 0) return null;
  const player = asRecord(runtimeState.player);
  const inventory = { ...asRecord(player.inventory) };
  inventory[itemId] = asWholeNumber(inventory[itemId], 0) + qty;
  player.inventory = inventory;
  runtimeState.player = player;
  return { itemId, label: getItemDisplayName(itemId), quantity: qty };
}

function applyOneShotReward(runtimeState, user, reward, now) {
  const multiplier = maybeAbsoluteMultiplier(runtimeState, user);
  const gold = asWholeNumber(reward.gold, 0) * multiplier;
  const experience = asWholeNumber(reward.experience, 0) * multiplier;
  const player = asRecord(runtimeState.player);
  player.gold = asWholeNumber(player.gold, 0) + gold;
  player.currencies = { ...asRecord(player.currencies), gold: player.gold };
  runtimeState.player = player;
  const xpResult = addPlayerExperience(runtimeState, experience, "dmos-one-shot", { now });
  const items = asArray(reward.items).map((item) => addInventoryItem(runtimeState, item.itemId, asWholeNumber(item.quantity, 1) * multiplier)).filter(Boolean);
  return { gold, experience, items, multiplier, levelUps: xpResult.levelUps ?? [] };
}

function buildSession(user, runtimeState, campaign, tokenSource, now, organizationLabels = {}) {
  const openingScene = getScene(campaign, campaign.startSceneId);
  const id = `dmos_${cleanId(campaign.id)}_${now}_${crypto.randomUUID().slice(0, 8)}`;
  return {
    id,
    engine: NEXIS_ONE_SHOT_ENGINE,
    status: "active",
    campaignId: campaign.id,
    title: campaign.title,
    theme: campaign.theme,
    category: campaign.category ?? campaign.theme,
    region: campaign.region,
    tokenSource,
    startedAt: now,
    completedAt: null,
    sceneId: campaign.startSceneId,
    characterSnapshot: buildCharacterSnapshot(user, runtimeState, organizationLabels),
    choicesMade: [],
    log: [{ id: `${id}_opening`, type: "dm", title: openingScene?.title ?? campaign.title, text: openingScene?.narration ?? campaign.summary, timestamp: now }],
  };
}

function completeSession(runtimeState, user, session, choice, conclusion, now) {
  const reward = applyOneShotReward(runtimeState, user, asRecord(conclusion.reward), now);
  const completed = {
    ...session,
    status: "completed",
    completedAt: now,
    sceneId: null,
    completion: { outcome: conclusion.outcome, chronicleSummary: conclusion.chronicleSummary, reward, recordTags: asArray(conclusion.recordTags) },
    log: [...asArray(session.log), { id: `${session.id}_${choice.id}_choice`, type: "choice", title: choice.label, text: choice.label, timestamp: now }, { id: `${session.id}_${choice.id}_outcome`, type: "dm", title: "Outcome", text: conclusion.outcome, timestamp: now }].slice(-20),
    choicesMade: [...asArray(session.choicesMade), { id: choice.id, label: choice.label, at: now, outcome: conclusion.outcome }],
  };
  const oneShots = normalizeOneShotState(runtimeState);
  const chronicle = { id: completed.id, campaignId: completed.campaignId, title: completed.title, theme: completed.theme, region: completed.region, completedAt: now, summary: conclusion.chronicleSummary, choices: completed.choicesMade, reward, visibility: "private" };
  oneShots.activeSession = null;
  oneShots.completedCampaignIds = Array.from(new Set([...asArray(oneShots.completedCampaignIds), completed.campaignId].filter((entry) => typeof entry === "string" && entry.trim())));
  oneShots.history = [chronicle, ...asArray(oneShots.history)].slice(0, 60);
  oneShots.lastUpdatedAt = now;
  runtimeState.player.dmosOneShots = oneShots;
  const player = asRecord(runtimeState.player);
  player.counters = { ...asRecord(player.counters), dmosOneShotsCompleted: asWholeNumber(asRecord(player.counters).dmosOneShotsCompleted, 0) + 1 };
  runtimeState.player = player;
  addPlayerRecord(runtimeState, { id: `dmos_chronicle_${completed.id}`, category: "chronicle", summary: `${completed.title}: ${conclusion.chronicleSummary}`, detail: { type: "dmos_one_shot", campaignId: completed.campaignId, theme: completed.theme, region: completed.region, choices: completed.choicesMade, reward, visibility: "private" }, source: "dmos-one-shot", route: "/one-shots", timestamp: now });
  queueProgressionEvent(runtimeState, { id: `dmos_one_shot_complete_${completed.id}`, type: "dmos_one_shot_complete", title: "One-shot completed", summary: `${completed.title} recorded in your Chronicle.`, route: "/one-shots", createdAt: now, detail: { campaignId: completed.campaignId, reward } });
  return { completed, reward, chronicle };
}

export async function getOneShotHubForUser(user) {
  return withTransaction(async (client) => {
    const { runtimeState } = await loadRuntimeState(client, user);
    const organizationLabels = await loadOrganizationLabels(client, user, runtimeState);
    const playerState = await upsertPlayerRuntimeState(client, user.internalId, runtimeState);
    return { playerState, hub: serializeHub(runtimeState, user, organizationLabels) };
  });
}

export async function startOneShotForUser(user, payload = {}) {
  return withTransaction(async (client) => {
    const { runtimeState } = await loadRuntimeState(client, user);
    const oneShots = normalizeOneShotState(runtimeState);
    if (oneShots.activeSession) throw new HttpError(409, "A DMOS one-shot is already active.", "ONE_SHOT_ALREADY_ACTIVE");
    const now = Date.now();
    const completedCampaigns = getCompletedCampaignMap(oneShots);
    const requestedCampaign = typeof payload.campaignId === "string" ? getOneShotCampaign(payload.campaignId) : null;
    const campaign = requestedCampaign ?? pickDefaultCampaign(runtimeState, completedCampaigns);
    if (!campaign) throw new HttpError(404, "No Nexis one-shot campaign is available.", "ONE_SHOT_CAMPAIGN_NOT_FOUND");
    if (completedCampaigns.has(campaign.id)) throw new HttpError(409, "That one-shot is already recorded in your Chronicle. Choose another campaign.", "ONE_SHOT_ALREADY_COMPLETED");
    const organizationLabels = await loadOrganizationLabels(client, user, runtimeState);
    const tokenSource = consumeToken(oneShots, user);
    const session = buildSession(user, runtimeState, campaign, tokenSource, now, organizationLabels);
    oneShots.activeSession = session;
    oneShots.lastUpdatedAt = now;
    runtimeState.player.dmosOneShots = oneShots;
    addPlayerRecord(runtimeState, { category: "chronicle", summary: `${campaign.title} opened through the DMOS Nexis portal.`, detail: { campaignId: campaign.id, tokenSource, engine: NEXIS_ONE_SHOT_ENGINE }, source: "dmos-one-shot", route: "/one-shots", timestamp: now });
    const playerState = await upsertPlayerRuntimeState(client, user.internalId, runtimeState);
    return { playerState, hub: serializeHub(runtimeState, user, organizationLabels), session: serializeSession(session), message: `${campaign.title} is open.` };
  });
}

export async function advanceOneShotForUser(user, sessionId, payload = {}) {
  return withTransaction(async (client) => {
    const { runtimeState } = await loadRuntimeState(client, user);
    const oneShots = normalizeOneShotState(runtimeState);
    const session = asRecord(oneShots.activeSession);
    if (!session || session.status !== "active") throw new HttpError(404, "No active DMOS one-shot found.", "ONE_SHOT_NOT_ACTIVE");
    if (session.id !== sessionId) throw new HttpError(404, "One-shot session not found.", "ONE_SHOT_NOT_FOUND");
    const campaign = getOneShotCampaign(session.campaignId);
    const scene = campaign ? getScene(campaign, session.sceneId) : null;
    if (!campaign || !scene) throw new HttpError(409, "One-shot scene unavailable.", "ONE_SHOT_SCENE_NOT_FOUND");
    const choiceId = String(payload.choiceId ?? "").trim();
    const choice = asArray(scene.choices).find((entry) => entry.id === choiceId);
    if (!choice) throw new HttpError(400, "Choose one of the listed one-shot options.", "ONE_SHOT_CHOICE_INVALID");
    const now = Date.now();

    if (choice.conclusion) {
      // Ticket A: database-enforced completion ledger, in addition to (not
      // instead of) the row lock acquired above. The row lock is the
      // primary defense - a genuine concurrent retry of this same session
      // blocks until the first request commits, then re-reads and hits
      // the "session.status !== active" check above before ever reaching
      // here. This insert is the backstop: it throws ONE_SHOT_ALREADY_COMPLETED
      // (409) rather than silently granting a second reward if that
      // primary defense is ever bypassed by a bug elsewhere.
      await recordOneShotCompletion(client, {
        userInternalId: user.internalId,
        campaignId: session.campaignId,
        sessionId: session.id,
        outcomeKey: typeof choice.conclusion.outcome === "string" && choice.conclusion.outcome.trim() ? choice.conclusion.outcome.trim().slice(0, 120) : "completed",
      });
      const { completed, reward } = completeSession(runtimeState, user, session, choice, choice.conclusion, now);
      evaluateLegacyAchievementsForRuntime(runtimeState, user, now);
      const playerState = await upsertPlayerRuntimeState(client, user.internalId, runtimeState);
      const organizationLabels = await loadOrganizationLabels(client, user, runtimeState);
      return { playerState, hub: serializeHub(runtimeState, user, organizationLabels), session: serializeSession(completed), reward, message: `${completed.title} completed and recorded.` };
    }

    const nextScene = getScene(campaign, choice.nextSceneId);
    if (!nextScene) throw new HttpError(409, "One-shot route unavailable.", "ONE_SHOT_NEXT_SCENE_NOT_FOUND");
    const advanced = {
      ...session,
      sceneId: nextScene.id,
      log: [...asArray(session.log), { id: `${session.id}_${choice.id}_choice`, type: "choice", title: choice.label, text: choice.label, timestamp: now }, { id: `${session.id}_${choice.id}_result`, type: "dm", title: nextScene.title, text: choice.narration ?? nextScene.narration, timestamp: now }, { id: `${session.id}_${nextScene.id}_scene`, type: "dm", title: nextScene.title, text: nextScene.narration, timestamp: now + 1 }].slice(-20),
      choicesMade: [...asArray(session.choicesMade), { id: choice.id, label: choice.label, at: now, outcome: choice.narration ?? nextScene.title }],
    };
    oneShots.activeSession = advanced;
    oneShots.lastUpdatedAt = now;
    runtimeState.player.dmosOneShots = oneShots;
    const playerState = await upsertPlayerRuntimeState(client, user.internalId, runtimeState);
    const organizationLabels = await loadOrganizationLabels(client, user, runtimeState);
    return { playerState, hub: serializeHub(runtimeState, user, organizationLabels), session: serializeSession(advanced), message: nextScene.title };
  });
}
