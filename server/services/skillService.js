import { withTransaction } from "../db/pool.js";
import { HttpError } from "../lib/errors.js";
import { buildMutableRuntimeState } from "../lib/runtimePlayerState.js";
import {
  createDefaultPlayerState,
  findPlayerStateByUserInternalId,
  upsertPlayerRuntimeState,
} from "../repositories/playerStateRepository.js";
import { getSkillDefinition, getSkillDefinitions, getSkillFamilies, SKILL_SLOT_CONFIG } from "../data/skillData.js";
import { addPlayerRecord } from "./playerRecordsService.js";
import { getRareManualEligibility } from "./rareManualService.js";

export const MASTERY_THRESHOLDS = [0, 50, 250, 500, 1000, 2500, 5000, 10000, 25000, 50000, 100000];
const VALID_SKILL_USE_CONTEXTS = new Set(["combat", "travel", "travel_encounter", "duel", "arena", "contract", "mission"]);
const ADMIN_LEARNING_MS = 1000;
const ACTIVE_LEARNING_MS = { 1: 10 * 60 * 1000, 2: 30 * 60 * 1000, 3: 60 * 60 * 1000 };
const PASSIVE_LEARNING_MS = { 1: 8 * 60 * 1000, 2: 20 * 60 * 1000, 3: 40 * 60 * 1000 };

const COURSE_LABELS = {
  "world-geography": "World Geography",
  "street-survival": "Street Survival",
  "civic-fundamentals": "Civic Fundamentals",
  "practical-arithmetic": "Practical Arithmetic",
};

function asRecord(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : {};
}

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function asNumber(value, fallback = 0) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : fallback;
}

function uniqueStrings(values) {
  return Array.from(new Set(asArray(values).filter((entry) => typeof entry === "string" && entry.trim()).map((entry) => entry.trim())));
}

function isAdminUser(user) {
  return user?.privilegeRole === "admin";
}

function getCompletedCourses(runtimeState) {
  const education = asRecord(runtimeState.education);
  const completedCourses = uniqueStrings(education.completedCourses);
  const legacyCompleted = Object.entries(asRecord(education.completed))
    .filter(([, value]) => value === true || asRecord(value).completed === true)
    .map(([courseId]) => courseId);
  return new Set([...completedCourses, ...legacyCompleted]);
}

function getAcademyUnlocks(runtimeState) {
  const academy = asRecord(runtimeState.player?.cityAcademy);
  return new Set(uniqueStrings(academy.unlocks));
}

function getCityStandingValue(runtimeState, cityId) {
  const standing = asRecord(runtimeState.player?.cityStanding);
  const record = asRecord(standing[cityId]);
  return Math.max(0, Math.floor(asNumber(record.value, record.standing ?? 0)));
}

function normalizeSlots(value, count) {
  const slots = asArray(value).slice(0, count).map((entry) => (typeof entry === "string" ? entry : null));
  while (slots.length < count) slots.push(null);
  return slots;
}

function buildParentMap() {
  const parents = new Map();
  for (const skill of getSkillDefinitions()) {
    if (skill.evolvesTo) parents.set(skill.evolvesTo, skill.id);
  }
  return parents;
}

function getParentMap() {
  return buildParentMap();
}

export function getSkillChainRoot(skillId) {
  const parents = getParentMap();
  let current = skillId;
  const seen = new Set();
  while (parents.has(current) && !seen.has(current)) {
    seen.add(current);
    current = parents.get(current);
  }
  return current;
}

function getEvolutionPath(rootSkillId) {
  const path = [];
  let current = getSkillDefinition(rootSkillId);
  const seen = new Set();
  while (current && !seen.has(current.id)) {
    seen.add(current.id);
    path.push(current);
    current = current.evolvesTo ? getSkillDefinition(current.evolvesTo) : null;
  }
  return path;
}

function getEvolutionUnlockTier(stageIndex) {
  if (stageIndex <= 0) return 0;
  if (stageIndex === 1) return 3;
  if (stageIndex === 2) return 6;
  return 10;
}

function getSkillStage(skillId) {
  const rootId = getSkillChainRoot(skillId);
  return getEvolutionPath(rootId).findIndex((skill) => skill.id === skillId);
}

function isEvolutionChild(skillId) {
  return getSkillStage(skillId) > 0;
}

function getMasteryTierFromUses(totalUses) {
  const uses = Math.max(0, Math.floor(asNumber(totalUses, 0)));
  let tier = 0;
  for (let index = 1; index < MASTERY_THRESHOLDS.length; index += 1) {
    if (uses >= MASTERY_THRESHOLDS[index]) tier = index;
  }
  return tier;
}

function getNextThresholdForTier(tier) {
  const currentTier = Math.max(0, Math.min(10, Math.floor(asNumber(tier, 0))));
  return currentTier >= 10 ? null : MASTERY_THRESHOLDS[currentTier + 1];
}

function getSkillLearningProfile(skill, user) {
  const tier = Math.max(1, Math.min(3, Math.floor(asNumber(skill.tier, 1))));
  if (isAdminUser(user)) return { costGold: 0, durationMs: ADMIN_LEARNING_MS };
  const baseCost = skill.slotType === "passive" ? 60 : 75;
  const starterDiscount = skill.starter ? 25 : 0;
  const durationTable = skill.slotType === "passive" ? PASSIVE_LEARNING_MS : ACTIVE_LEARNING_MS;
  return {
    costGold: Math.max(0, baseCost * tier - starterDiscount),
    durationMs: durationTable[tier] ?? durationTable[3],
  };
}

function ensureSkillState(runtimeState) {
  const player = asRecord(runtimeState.player);
  const existing = asRecord(player.skills);
  existing.unlocked = uniqueStrings(existing.unlocked);
  existing.learning = { ...asRecord(existing.learning) };
  existing.xp = { ...asRecord(existing.xp) };
  existing.useCounts = { ...asRecord(existing.useCounts) };
  existing.evolved = { ...asRecord(existing.evolved) };
  existing.masteryMilestones = { ...asRecord(existing.masteryMilestones) };
  existing.unlockHistory = asArray(existing.unlockHistory).filter((entry) => entry && typeof entry === "object");
  existing.activeSlots = normalizeSlots(existing.activeSlots, SKILL_SLOT_CONFIG.activeSlots);
  existing.passiveSlots = normalizeSlots(existing.passiveSlots, SKILL_SLOT_CONFIG.passiveSlots);
  existing.lastUpdatedAt = typeof existing.lastUpdatedAt === "number" ? existing.lastUpdatedAt : null;
  player.skills = existing;
  runtimeState.player = player;
  return existing;
}

function hasSkillUnlocked(runtimeState, skillId) {
  const state = ensureSkillState(runtimeState);
  return state.unlocked.includes(skillId);
}

function getRootUseCount(runtimeState, skillId) {
  const state = ensureSkillState(runtimeState);
  const rootId = getSkillChainRoot(skillId);
  return Math.max(0, Math.floor(asNumber(state.useCounts[rootId], 0)));
}

function flagLabel(flag) {
  return String(flag)
    .replace(/^academy_/, "academy ")
    .replaceAll("_", " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function addLegacyEntry(runtimeState, entry) {
  const legacy = asRecord(runtimeState.legacy);
  const visibleEntries = asArray(legacy.visibleEntries);
  if (!visibleEntries.some((current) => asRecord(current).id === entry.id)) {
    legacy.visibleEntries = [entry, ...visibleEntries].slice(0, 50);
  }
  runtimeState.legacy = legacy;
}

function unlockSkill(runtimeState, skillId, source = "system", now = Date.now()) {
  const skill = getSkillDefinition(skillId);
  if (!skill) return null;
  const state = ensureSkillState(runtimeState);
  if (!state.unlocked.includes(skillId)) {
    state.unlocked.push(skillId);
    delete state.learning[skillId];
    state.unlockHistory = [
      { skillId, source, unlockedAt: now },
      ...asArray(state.unlockHistory),
    ].slice(0, 80);
    state.lastUpdatedAt = now;
    const player = asRecord(runtimeState.player);
    player.counters = {
      ...asRecord(player.counters),
      skillsUnlocked: Math.max(0, Math.floor(asNumber(player.counters?.skillsUnlocked, 0))) + 1,
      firstSkillUnlockedAt: player.counters?.firstSkillUnlockedAt ?? now,
    };
    runtimeState.player = player;
    addLegacyEntry(runtimeState, {
      id: `skill_learned_${skill.id}`,
      title: `${skill.name} Learned`,
      summary: `${skill.name} became usable after training time completed.`,
      kind: "skill",
      awardedAt: now,
    });
    addPlayerRecord(runtimeState, { category: "skills", summary: `${skill.name} learned.`, detail: { skillId: skill.id, source }, source: "skills", route: "/skills", timestamp: now });
    return { skillId, name: skill.name, unlockedAt: now, source };
  }
  delete state.learning[skillId];
  return null;
}

function completeReadyLearning(runtimeState, user, now = Date.now(), force = false) {
  const events = [];
  const state = ensureSkillState(runtimeState);
  for (const [skillId, record] of Object.entries({ ...state.learning })) {
    const skill = getSkillDefinition(skillId);
    if (!skill) {
      delete state.learning[skillId];
      continue;
    }
    const ready = asNumber(asRecord(record).completesAt, Infinity) <= now;
    if (ready || force || isAdminUser(user)) {
      const event = unlockSkill(runtimeState, skillId, asRecord(record).source ?? "learning", now);
      if (event) events.push(event);
    }
  }
  return events;
}

function syncEvolutionUnlocks(runtimeState, now = Date.now()) {
  const state = ensureSkillState(runtimeState);
  const events = [];
  for (const rootSkill of getSkillDefinitions().filter((skill) => getSkillChainRoot(skill.id) === skill.id)) {
    if (!state.unlocked.includes(rootSkill.id)) continue;
    const uses = getRootUseCount(runtimeState, rootSkill.id);
    const masteryTier = getMasteryTierFromUses(uses);
    const path = getEvolutionPath(rootSkill.id);
    let currentSkillId = rootSkill.id;
    for (let stageIndex = 1; stageIndex < path.length; stageIndex += 1) {
      const requiredTier = getEvolutionUnlockTier(stageIndex);
      if (masteryTier >= requiredTier) {
        const event = unlockSkill(runtimeState, path[stageIndex].id, `mastery-tier-${requiredTier}:${rootSkill.id}`, now);
        if (event) events.push({ ...event, rootSkillId: rootSkill.id, requiredTier });
        currentSkillId = path[stageIndex].id;
      }
    }
    state.evolved[rootSkill.id] = {
      currentSkillId,
      masteryTier,
      updatedAt: now,
    };
  }
  return events;
}

export function syncUnlockedSkills(runtimeState, now = Date.now(), user = null) {
  const learningEvents = completeReadyLearning(runtimeState, user, now);
  const evolutionEvents = syncEvolutionUnlocks(runtimeState, now);
  return [...learningEvents, ...evolutionEvents];
}

function getSkillAccess(runtimeState, skill, user = null) {
  const state = ensureSkillState(runtimeState);
  const admin = isAdminUser(user);
  const learningProfile = getSkillLearningProfile(skill, user);
  const completedCourses = getCompletedCourses(runtimeState);
  const academyUnlocks = getAcademyUnlocks(runtimeState);
  const rootId = getSkillChainRoot(skill.id);
  const rootSkill = getSkillDefinition(rootId) ?? skill;
  const stageIndex = getSkillStage(skill.id);
  const requiredEvolutionTier = getEvolutionUnlockTier(stageIndex);
  const rootUses = getRootUseCount(runtimeState, skill.id);
  const rootMasteryTier = getMasteryTierFromUses(rootUses);
  const missingCourses = admin ? [] : uniqueStrings(skill.requiredCourses).filter((courseId) => !completedCourses.has(courseId));
  const missingFlags = admin ? [] : uniqueStrings(skill.requiredFlags).filter((flag) => !academyUnlocks.has(flag));
  const missingSkills = admin ? [] : uniqueStrings(skill.requiredSkills).filter((skillId) => !hasSkillUnlocked(runtimeState, skillId));
  const missingAcademies = admin ? [] : uniqueStrings(skill.requiredAcademies).filter((flag) => !academyUnlocks.has(flag));
  const requiredStanding = asRecord(skill.requiredStanding);
  const standingMissing = admin ? [] : Object.entries(requiredStanding)
    .map(([cityId, amount]) => ({ cityId, required: Math.max(0, Math.floor(asNumber(amount, 0))), current: getCityStandingValue(runtimeState, cityId) }))
    .filter((entry) => entry.current < entry.required);
  const unlocked = state.unlocked.includes(skill.id);
  const learning = asRecord(state.learning[skill.id]);
  const isLearning = Boolean(learning.startedAt && !unlocked);
  const gold = Math.max(0, Math.floor(asNumber(runtimeState.player?.gold, 0)));
  const missingGold = admin ? 0 : Math.max(0, learningProfile.costGold - gold);
  const evolutionLocked = !admin && stageIndex > 0 && rootMasteryTier < requiredEvolutionTier;
  const canLearn = !unlocked && !isLearning && !evolutionLocked && (admin || (!missingCourses.length && !missingFlags.length && !missingSkills.length && !missingAcademies.length && !standingMissing.length && missingGold === 0));

  const reasons = [];
  if (evolutionLocked) reasons.push(`Reach Mastery Tier ${requiredEvolutionTier} with ${rootSkill.name} to unlock ${skill.name}.`);
  if (missingCourses.length) reasons.push(`Complete ${missingCourses.map((courseId) => COURSE_LABELS[courseId] ?? courseId).join(", ")}.`);
  if (missingFlags.length) reasons.push(`Complete ${missingFlags.map(flagLabel).join(", ")}.`);
  if (missingSkills.length) reasons.push(`Learn ${missingSkills.map((skillId) => getSkillDefinition(skillId)?.name ?? skillId).join(", ")}.`);
  if (missingAcademies.length) reasons.push(`Finish ${missingAcademies.map(flagLabel).join(", ")}.`);
  if (standingMissing.length) reasons.push(`Earn ${standingMissing.map((entry) => `${entry.required - entry.current} more ${entry.cityId} standing`).join(", ")}.`);
  if (missingGold > 0) reasons.push(`Requires ${learningProfile.costGold} gold. You need ${missingGold} more.`);

  return {
    unlocked,
    learned: unlocked,
    isLearning,
    learningStartedAt: asNumber(learning.startedAt, null),
    learningCompletesAt: asNumber(learning.completesAt, null),
    canCompleteLearning: isLearning && (admin || asNumber(learning.completesAt, Infinity) <= Date.now()),
    canLearn,
    learningCostGold: learningProfile.costGold,
    learningDurationMs: learningProfile.durationMs,
    missingCourses,
    missingFlags,
    missingSkills,
    missingAcademies,
    standingMissing,
    lockReason: unlocked || canLearn || isLearning ? null : reasons.join(" ") || "Requirements are not met yet.",
  };
}

function nextTierImprovement(skill, masteryTier) {
  if (masteryTier >= 10) return "Mastery capped. No further tier scaling remains.";
  const combat = asRecord(skill.combat);
  const parts = [];
  if (asNumber(combat.damageMultiplier, 0) > 0) parts.push("damage +4%");
  if (asNumber(combat.heal, 0) > 0) parts.push("healing +4%");
  if (asNumber(combat.accuracyBonus, 0) !== 0) parts.push("accuracy +2%");
  if (asNumber(combat.critBonus, 0) !== 0) parts.push("crit +2%");
  if (asNumber(combat.evadeBonus, 0) !== 0) parts.push("evade +2%");
  if (asNumber(combat.mitigationBonus, 0) !== 0) parts.push("mitigation +2%");
  if (!parts.length) parts.push("utility potency +2%");
  return `Next tier improves ${parts.join(", ")}.`;
}

function scaleCombatValue(key, value, masteryTier) {
  const numeric = asNumber(value, 0);
  if (!numeric) return numeric;
  if (["damageMultiplier", "heal", "shielding"].includes(key)) return Number((numeric * (1 + masteryTier * 0.04)).toFixed(4));
  if (["accuracyBonus", "critBonus", "evadeBonus", "mitigationBonus", "initiativeBonus", "maxHealthBonus", "duration", "potency", "utilityStrength"].includes(key)) return Number((numeric * (1 + masteryTier * 0.02)).toFixed(4));
  if (key === "cooldown") return Number((numeric * (1 - Math.min(0.25, masteryTier * 0.025))).toFixed(4));
  if (key === "resourceCost") return Number((numeric * (1 - Math.min(0.1, masteryTier * 0.01))).toFixed(4));
  return numeric;
}

export function getScaledSkillCombat(runtimeState, skillIdOrSkill) {
  const skill = typeof skillIdOrSkill === "string" ? getSkillDefinition(skillIdOrSkill) : skillIdOrSkill;
  if (!skill) return {};
  const masteryTier = getMasteryTierFromUses(getRootUseCount(runtimeState, skill.id));
  return Object.fromEntries(Object.entries(asRecord(skill.combat)).map(([key, value]) => [key, scaleCombatValue(key, value, masteryTier)]));
}

export function getScaledSkillForUse(runtimeState, skillIdOrSkill) {
  const skill = typeof skillIdOrSkill === "string" ? getSkillDefinition(skillIdOrSkill) : skillIdOrSkill;
  if (!skill) return null;
  const rootId = getSkillChainRoot(skill.id);
  const totalUses = getRootUseCount(runtimeState, skill.id);
  const masteryTier = getMasteryTierFromUses(totalUses);
  return { ...skill, rootSkillId: rootId, masteryTier, totalUses, combat: getScaledSkillCombat(runtimeState, skill) };
}

export function grantSkillXp(runtimeState, skillId, amount, reason = "use", now = Date.now()) {
  const skill = getSkillDefinition(skillId);
  if (!skill || skill.slotType !== "active") return null;
  const context = String(reason || "use").replaceAll("-", "_");
  if (!VALID_SKILL_USE_CONTEXTS.has(context)) return null;
  const state = ensureSkillState(runtimeState);
  if (!state.unlocked.includes(skill.id)) return null;
  const rootId = getSkillChainRoot(skill.id);
  if (!state.unlocked.includes(rootId)) state.unlocked.push(rootId);
  const xpAmount = Math.max(0, Math.floor(asNumber(amount, 0)));
  const beforeXp = Math.max(0, Math.floor(asNumber(state.xp[skill.id], 0)));
  const afterXp = beforeXp + xpAmount;
  state.xp[skill.id] = afterXp;

  const beforeUses = Math.max(0, Math.floor(asNumber(state.useCounts[rootId], 0)));
  const afterUses = beforeUses + 1;
  state.useCounts[rootId] = afterUses;
  state.lastUpdatedAt = now;

  const beforeTier = getMasteryTierFromUses(beforeUses);
  const afterTier = getMasteryTierFromUses(afterUses);
  const event = {
    skillId: skill.id,
    rootSkillId: rootId,
    name: skill.name,
    xpGained: xpAmount,
    totalXp: afterXp,
    usesGained: 1,
    totalUses: afterUses,
    masteryTier: afterTier,
    reason: context,
    evolvedTo: null,
    tierChanged: afterTier > beforeTier ? { from: beforeTier, to: afterTier } : null,
  };

  if (afterTier > beforeTier) {
    state.masteryMilestones[rootId] = { ...(asRecord(state.masteryMilestones[rootId])), [afterTier]: now };
    addLegacyEntry(runtimeState, {
      id: `skill_mastery_${rootId}_${afterTier}`,
      title: `${getSkillDefinition(rootId)?.name ?? skill.name} Mastery Tier ${afterTier}`,
      summary: `${getSkillDefinition(rootId)?.name ?? skill.name} reached ${afterUses.toLocaleString("en-US")} valid uses.`,
      kind: "skill",
      awardedAt: now,
    });
    addPlayerRecord(runtimeState, { category: "skills", summary: `${getSkillDefinition(rootId)?.name ?? skill.name} reached Mastery Tier ${afterTier}.`, detail: { rootSkillId: rootId, totalUses: afterUses, masteryTier: afterTier }, source: "skill-mastery", route: "/skills", timestamp: now });
  }

  const evolutionEvents = syncEvolutionUnlocks(runtimeState, now);
  const relevantEvolution = evolutionEvents.find((entry) => entry.rootSkillId === rootId);
  if (relevantEvolution) {
    event.evolvedTo = { skillId: relevantEvolution.skillId, name: relevantEvolution.name };
    const player = asRecord(runtimeState.player);
    player.counters = {
      ...asRecord(player.counters),
      skillEvolutions: Math.max(0, Math.floor(asNumber(player.counters?.skillEvolutions, 0))) + 1,
      firstSkillEvolutionAt: player.counters?.firstSkillEvolutionAt ?? now,
    };
    runtimeState.player = player;
  }
  return event;
}

export function getSlottedSkillIds(runtimeState, slotType = "active") {
  const state = ensureSkillState(runtimeState);
  const slotKey = slotType === "passive" ? "passiveSlots" : "activeSlots";
  return state[slotKey].filter((entry) => typeof entry === "string" && hasSkillUnlocked(runtimeState, entry));
}

function serializeSkill(runtimeState, skill, user = null) {
  const state = ensureSkillState(runtimeState);
  const access = getSkillAccess(runtimeState, skill, user);
  const rootId = getSkillChainRoot(skill.id);
  const totalUses = getRootUseCount(runtimeState, skill.id);
  const masteryTier = access.unlocked ? getMasteryTierFromUses(totalUses) : 0;
  const nextThreshold = getNextThresholdForTier(masteryTier);
  const path = getEvolutionPath(rootId).map((entry, index) => ({
    id: entry.id,
    name: entry.name,
    unlockTier: getEvolutionUnlockTier(index),
    unlocked: state.unlocked.includes(entry.id),
  }));
  const currentEvolution = [...path].reverse().find((entry) => entry.unlocked) ?? path[0] ?? null;
  return {
    id: skill.id,
    name: skill.name,
    family: skill.family,
    slotType: skill.slotType,
    kind: skill.kind,
    tier: masteryTier,
    definitionTier: skill.tier,
    summary: skill.summary,
    unlocked: access.unlocked,
    learned: access.learned,
    learning: access.isLearning,
    learningStartedAt: access.learningStartedAt,
    learningCompletesAt: access.learningCompletesAt,
    canLearn: access.canLearn,
    canCompleteLearning: access.canCompleteLearning,
    learningCostGold: access.learningCostGold,
    learningDurationMs: access.learningDurationMs,
    lockReason: access.lockReason,
    requiredCourses: skill.requiredCourses,
    requiredFlags: skill.requiredFlags,
    requiredSkills: skill.requiredSkills,
    xp: totalUses,
    xpToEvolve: nextThreshold,
    totalUses,
    masteryTier,
    nextTierThreshold: nextThreshold,
    usesToNextTier: nextThreshold === null ? 0 : Math.max(0, nextThreshold - totalUses),
    progressPercent: nextThreshold ? Math.max(0, Math.min(100, Math.round((totalUses / nextThreshold) * 100))) : 100,
    evolvesTo: skill.evolvesTo,
    evolvedTo: asRecord(state.evolved[rootId]).currentSkillId ?? null,
    currentEvolutionId: currentEvolution?.id ?? skill.id,
    currentEvolutionName: currentEvolution?.name ?? skill.name,
    evolutionPath: path,
    nextTierImprovement: nextTierImprovement(skill, masteryTier),
    combat: access.unlocked ? getScaledSkillCombat(runtimeState, skill) : skill.combat,
    baseCombat: skill.combat,
  };
}

function serializeSkills(runtimeState, user = null) {
  syncUnlockedSkills(runtimeState, Date.now(), user);
  const state = ensureSkillState(runtimeState);
  return {
    slotConfig: SKILL_SLOT_CONFIG,
    families: getSkillFamilies(),
    activeSlots: state.activeSlots,
    passiveSlots: state.passiveSlots,
    unlockedCount: state.unlocked.length,
    learningCount: Object.keys(state.learning).length,
    masteryThresholds: MASTERY_THRESHOLDS.slice(1),
    skills: getSkillDefinitions().map((skill) => serializeSkill(runtimeState, skill, user)),
    unlockHistory: asArray(state.unlockHistory).slice(0, 20),
    rareManualEligibility: getRareManualEligibility(runtimeState),
    adminControlsEnabled: isAdminUser(user),
  };
}

async function loadRuntimeState(client, user) {
  await createDefaultPlayerState(client, user.internalId);
  const playerState = await findPlayerStateByUserInternalId(client, user.internalId);
  if (!playerState) throw new HttpError(404, "Player state unavailable.", "PLAYER_STATE_NOT_FOUND");
  const runtimeState = buildMutableRuntimeState(user, playerState);
  return { playerState, runtimeState };
}

export async function getSkillsForUser(user) {
  return withTransaction(async (client) => {
    const { runtimeState } = await loadRuntimeState(client, user);
    const before = JSON.stringify(asRecord(runtimeState.player?.skills));
    const skills = serializeSkills(runtimeState, user);
    const after = JSON.stringify(asRecord(runtimeState.player?.skills));
    let playerState = await findPlayerStateByUserInternalId(client, user.internalId);
    if (before !== after) {
      playerState = await upsertPlayerRuntimeState(client, user.internalId, runtimeState);
    }
    return { playerState, skills };
  });
}

export async function learnSkillForUser(user, payload) {
  return withTransaction(async (client) => {
    const skillId = typeof payload?.skillId === "string" ? payload.skillId.trim() : "";
    const skill = getSkillDefinition(skillId);
    if (!skill) throw new HttpError(404, "Skill not found.", "SKILL_NOT_FOUND");
    const { runtimeState } = await loadRuntimeState(client, user);
    completeReadyLearning(runtimeState, user);
    const state = ensureSkillState(runtimeState);
    const access = getSkillAccess(runtimeState, skill, user);
    if (access.unlocked) throw new HttpError(409, "That skill is already learned.", "SKILL_ALREADY_LEARNED");
    if (access.isLearning) throw new HttpError(409, "That skill is already being learned.", "SKILL_ALREADY_LEARNING");
    if (!access.canLearn) throw new HttpError(409, access.lockReason ?? "Skill requirements are not met.", "SKILL_LEARNING_LOCKED");
    const now = Date.now();
    const costGold = access.learningCostGold;
    if (costGold > 0) {
      const gold = Math.max(0, Math.floor(asNumber(runtimeState.player.gold, 0) - costGold));
      runtimeState.player.gold = gold;
      runtimeState.player.currencies = { ...asRecord(runtimeState.player.currencies), gold };
    }
    state.learning[skill.id] = {
      skillId: skill.id,
      startedAt: now,
      completesAt: now + access.learningDurationMs,
      costGold,
      source: isAdminUser(user) ? "admin-learning" : "paid-learning",
    };
    state.lastUpdatedAt = now;
    const player = asRecord(runtimeState.player);
    player.counters = {
      ...asRecord(player.counters),
      skillLearningStarted: Math.max(0, Math.floor(asNumber(player.counters?.skillLearningStarted, 0))) + 1,
      firstSkillLearningStartedAt: player.counters?.firstSkillLearningStartedAt ?? now,
    };
    runtimeState.player = player;
    if (isAdminUser(user)) completeReadyLearning(runtimeState, user, now, true);
    const playerState = await upsertPlayerRuntimeState(client, user.internalId, runtimeState);
    const nextRuntimeState = buildMutableRuntimeState(user, playerState);
    return { playerState, skills: serializeSkills(nextRuntimeState, user), message: isAdminUser(user) ? `${skill.name} learned instantly for admin testing.` : `${skill.name} learning started.` };
  });
}

export async function completeSkillLearningForUser(user, payload = {}) {
  return withTransaction(async (client) => {
    const { runtimeState } = await loadRuntimeState(client, user);
    const state = ensureSkillState(runtimeState);
    const skillId = typeof payload?.skillId === "string" && payload.skillId.trim() ? payload.skillId.trim() : null;
    const now = Date.now();
    if (skillId && !state.learning[skillId]) throw new HttpError(404, "No active learning record for that skill.", "SKILL_LEARNING_NOT_FOUND");
    if (skillId) {
      const record = asRecord(state.learning[skillId]);
      if (!isAdminUser(user) && asNumber(record.completesAt, Infinity) > now) throw new HttpError(409, "Learning time is not finished yet.", "SKILL_LEARNING_IN_PROGRESS");
      unlockSkill(runtimeState, skillId, record.source ?? "learning", now);
    } else {
      const events = completeReadyLearning(runtimeState, user, now, false);
      if (!events.length) throw new HttpError(409, "No skill learning is ready to complete.", "SKILL_LEARNING_NONE_READY");
    }
    const playerState = await upsertPlayerRuntimeState(client, user.internalId, runtimeState);
    const nextRuntimeState = buildMutableRuntimeState(user, playerState);
    return { playerState, skills: serializeSkills(nextRuntimeState, user), message: skillId ? `${getSkillDefinition(skillId)?.name ?? "Skill"} learning completed.` : "Ready skill learning completed." };
  });
}

export async function slotSkillForUser(user, payload) {
  return withTransaction(async (client) => {
    const { runtimeState } = await loadRuntimeState(client, user);
    syncUnlockedSkills(runtimeState, Date.now(), user);
    const slotType = payload?.slotType === "passive" ? "passive" : "active";
    const slotIndex = Math.floor(asNumber(payload?.slotIndex, -1));
    const skillId = typeof payload?.skillId === "string" && payload.skillId.trim() ? payload.skillId.trim() : null;
    const maxSlots = slotType === "passive" ? SKILL_SLOT_CONFIG.passiveSlots : SKILL_SLOT_CONFIG.activeSlots;
    if (slotIndex < 0 || slotIndex >= maxSlots) throw new HttpError(400, "Skill slot unavailable.", "SKILL_SLOT_INVALID");

    const state = ensureSkillState(runtimeState);
    const slotKey = slotType === "passive" ? "passiveSlots" : "activeSlots";
    if (!skillId) {
      state[slotKey][slotIndex] = null;
    } else {
      const skill = getSkillDefinition(skillId);
      if (!skill) throw new HttpError(404, "Skill not found.", "SKILL_NOT_FOUND");
      if (skill.slotType !== slotType) throw new HttpError(400, "That skill does not fit this slot type.", "SKILL_SLOT_TYPE_MISMATCH");
      if (!state.unlocked.includes(skillId)) throw new HttpError(409, "That skill is still locked or learning.", "SKILL_LOCKED");
      state[slotKey] = state[slotKey].map((entry) => (entry === skillId ? null : entry));
      state[slotKey][slotIndex] = skillId;
    }
    state.lastUpdatedAt = Date.now();
    const playerState = await upsertPlayerRuntimeState(client, user.internalId, runtimeState);
    const nextRuntimeState = buildMutableRuntimeState(user, playerState);
    return { playerState, skills: serializeSkills(nextRuntimeState, user), message: "Skill slots updated." };
  });
}

export async function adminSetSkillMasteryForUser(user, payload) {
  if (!isAdminUser(user)) throw new HttpError(403, "Admin privileges required.", "ADMIN_REQUIRED");
  return withTransaction(async (client) => {
    const skillId = typeof payload?.skillId === "string" ? payload.skillId.trim() : "";
    const skill = getSkillDefinition(skillId);
    if (!skill) throw new HttpError(404, "Skill not found.", "SKILL_NOT_FOUND");
    const uses = Math.max(0, Math.min(100000, Math.floor(asNumber(payload?.uses, 0))));
    const { runtimeState } = await loadRuntimeState(client, user);
    const state = ensureSkillState(runtimeState);
    const rootId = getSkillChainRoot(skill.id);
    unlockSkill(runtimeState, rootId, "admin-mastery", Date.now());
    state.useCounts[rootId] = uses;
    syncEvolutionUnlocks(runtimeState, Date.now());
    const playerState = await upsertPlayerRuntimeState(client, user.internalId, runtimeState);
    const nextRuntimeState = buildMutableRuntimeState(user, playerState);
    return { playerState, skills: serializeSkills(nextRuntimeState, user), message: `${getSkillDefinition(rootId)?.name ?? skill.name} mastery set to ${uses.toLocaleString("en-US")} uses.` };
  });
}

export async function adminUnlockAllSkillsForUser(user) {
  if (!isAdminUser(user)) throw new HttpError(403, "Admin privileges required.", "ADMIN_REQUIRED");
  return withTransaction(async (client) => {
    const { runtimeState } = await loadRuntimeState(client, user);
    const now = Date.now();
    for (const skill of getSkillDefinitions()) {
      unlockSkill(runtimeState, skill.id, "admin-unlock-all", now);
    }
    const state = ensureSkillState(runtimeState);
    state.learning = {};
    state.lastUpdatedAt = now;
    syncEvolutionUnlocks(runtimeState, now);
    const player = asRecord(runtimeState.player);
    player.counters = {
      ...asRecord(player.counters),
      adminSkillUnlockAllAt: now,
    };
    runtimeState.player = player;
    const playerState = await upsertPlayerRuntimeState(client, user.internalId, runtimeState);
    const nextRuntimeState = buildMutableRuntimeState(user, playerState);
    return { playerState, skills: serializeSkills(nextRuntimeState, user), message: "All skills unlocked for admin testing." };
  });
}
