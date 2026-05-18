import { withTransaction } from "../db/pool.js";
import { HttpError } from "../lib/errors.js";
import { buildMutableRuntimeState } from "../lib/runtimePlayerState.js";
import {
  createDefaultPlayerState,
  findPlayerStateByUserInternalId,
  upsertPlayerRuntimeState,
} from "../repositories/playerStateRepository.js";
import { getSkillDefinition, getSkillDefinitions, getSkillFamilies, SKILL_SLOT_CONFIG } from "../data/skillData.js";

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

function ensureSkillState(runtimeState) {
  const player = asRecord(runtimeState.player);
  const existing = asRecord(player.skills);
  const unlocked = uniqueStrings(existing.unlocked);
  const xp = { ...asRecord(existing.xp) };
  const evolved = { ...asRecord(existing.evolved) };
  const unlockHistory = asArray(existing.unlockHistory).filter((entry) => entry && typeof entry === "object");
  const activeSlots = normalizeSlots(existing.activeSlots, SKILL_SLOT_CONFIG.activeSlots);
  const passiveSlots = normalizeSlots(existing.passiveSlots, SKILL_SLOT_CONFIG.passiveSlots);

  const next = {
    unlocked,
    xp,
    evolved,
    activeSlots,
    passiveSlots,
    unlockHistory,
    lastUpdatedAt: typeof existing.lastUpdatedAt === "number" ? existing.lastUpdatedAt : null,
  };
  player.skills = next;
  runtimeState.player = player;
  return next;
}

function hasSkillUnlocked(runtimeState, skillId) {
  const state = ensureSkillState(runtimeState);
  return state.unlocked.includes(skillId);
}

function flagLabel(flag) {
  return String(flag)
    .replace(/^academy_/, "academy ")
    .replaceAll("_", " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function getSkillAccess(runtimeState, skill) {
  const completedCourses = getCompletedCourses(runtimeState);
  const academyUnlocks = getAcademyUnlocks(runtimeState);
  const missingCourses = uniqueStrings(skill.requiredCourses).filter((courseId) => !completedCourses.has(courseId));
  const missingFlags = uniqueStrings(skill.requiredFlags).filter((flag) => !academyUnlocks.has(flag));
  const missingSkills = uniqueStrings(skill.requiredSkills).filter((skillId) => !hasSkillUnlocked(runtimeState, skillId));
  const missingAcademies = uniqueStrings(skill.requiredAcademies).filter((flag) => !academyUnlocks.has(flag));
  const requiredStanding = asRecord(skill.requiredStanding);
  const standingMissing = Object.entries(requiredStanding)
    .map(([cityId, amount]) => ({ cityId, required: Math.max(0, Math.floor(asNumber(amount, 0))), current: getCityStandingValue(runtimeState, cityId) }))
    .filter((entry) => entry.current < entry.required);
  const unlocked = ensureSkillState(runtimeState).unlocked.includes(skill.id);
  const canUnlock = skill.starter || (!missingCourses.length && !missingFlags.length && !missingSkills.length && !missingAcademies.length && !standingMissing.length);

  const reasons = [];
  if (missingCourses.length) reasons.push(`Complete ${missingCourses.map((courseId) => COURSE_LABELS[courseId] ?? courseId).join(", ")}.`);
  if (missingFlags.length) reasons.push(`Complete ${missingFlags.map(flagLabel).join(", ")}.`);
  if (missingSkills.length) reasons.push(`Unlock ${missingSkills.map((skillId) => getSkillDefinition(skillId)?.name ?? skillId).join(", ")}.`);
  if (missingAcademies.length) reasons.push(`Finish ${missingAcademies.map(flagLabel).join(", ")}.`);
  if (standingMissing.length) reasons.push(`Earn ${standingMissing.map((entry) => `${entry.required - entry.current} more ${entry.cityId} standing`).join(", ")}.`);

  return {
    unlocked,
    canUnlock,
    missingCourses,
    missingFlags,
    missingSkills,
    missingAcademies,
    standingMissing,
    lockReason: unlocked || canUnlock ? null : reasons.join(" ") || "Requirements are not met yet.",
  };
}

export function unlockSkill(runtimeState, skillId, source = "system", now = Date.now()) {
  const skill = getSkillDefinition(skillId);
  if (!skill) return null;
  const state = ensureSkillState(runtimeState);
  if (!state.unlocked.includes(skillId)) {
    state.unlocked.push(skillId);
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
    return { skillId, name: skill.name, unlockedAt: now, source };
  }
  return null;
}

export function syncUnlockedSkills(runtimeState, now = Date.now()) {
  const events = [];
  for (const skill of getSkillDefinitions()) {
    const access = getSkillAccess(runtimeState, skill);
    if (!access.unlocked && access.canUnlock) {
      const event = unlockSkill(runtimeState, skill.id, skill.starter ? "starter" : "requirements", now);
      if (event) events.push(event);
    }
  }
  return events;
}

export function grantSkillXp(runtimeState, skillId, amount, reason = "use", now = Date.now()) {
  const skill = getSkillDefinition(skillId);
  if (!skill || skill.slotType !== "active") return null;
  const state = ensureSkillState(runtimeState);
  if (!state.unlocked.includes(skill.id)) return null;
  const xpAmount = Math.max(0, Math.floor(asNumber(amount, 0)));
  if (!xpAmount) return null;
  const before = Math.max(0, Math.floor(asNumber(state.xp[skill.id], 0)));
  const after = before + xpAmount;
  state.xp[skill.id] = after;
  state.lastUpdatedAt = now;

  const event = { skillId: skill.id, name: skill.name, xpGained: xpAmount, totalXp: after, reason, evolvedTo: null };
  if (skill.evolvesTo && skill.xpToEvolve && after >= skill.xpToEvolve && !state.evolved[skill.id]) {
    const nextSkill = getSkillDefinition(skill.evolvesTo);
    if (nextSkill) {
      state.evolved[skill.id] = { evolvedTo: skill.evolvesTo, evolvedAt: now };
      unlockSkill(runtimeState, skill.evolvesTo, `evolution:${skill.id}`, now);
      event.evolvedTo = { skillId: nextSkill.id, name: nextSkill.name };
      const player = asRecord(runtimeState.player);
      player.counters = {
        ...asRecord(player.counters),
        skillEvolutions: Math.max(0, Math.floor(asNumber(player.counters?.skillEvolutions, 0))) + 1,
        firstSkillEvolutionAt: player.counters?.firstSkillEvolutionAt ?? now,
      };
      runtimeState.player = player;
    }
  }
  return event;
}

export function getSlottedSkillIds(runtimeState, slotType = "active") {
  syncUnlockedSkills(runtimeState);
  const state = ensureSkillState(runtimeState);
  const slotKey = slotType === "passive" ? "passiveSlots" : "activeSlots";
  return state[slotKey].filter((entry) => typeof entry === "string" && hasSkillUnlocked(runtimeState, entry));
}

function serializeSkill(runtimeState, skill) {
  const state = ensureSkillState(runtimeState);
  const access = getSkillAccess(runtimeState, skill);
  const xp = Math.max(0, Math.floor(asNumber(state.xp[skill.id], 0)));
  const xpToEvolve = skill.xpToEvolve ?? null;
  return {
    id: skill.id,
    name: skill.name,
    family: skill.family,
    slotType: skill.slotType,
    kind: skill.kind,
    tier: skill.tier,
    summary: skill.summary,
    unlocked: access.unlocked,
    lockReason: access.lockReason,
    requiredCourses: skill.requiredCourses,
    requiredFlags: skill.requiredFlags,
    requiredSkills: skill.requiredSkills,
    xp,
    xpToEvolve,
    progressPercent: xpToEvolve ? Math.max(0, Math.min(100, Math.round((xp / xpToEvolve) * 100))) : 100,
    evolvesTo: skill.evolvesTo,
    evolvedTo: asRecord(state.evolved[skill.id]).evolvedTo ?? null,
    combat: skill.combat,
  };
}

function serializeSkills(runtimeState) {
  syncUnlockedSkills(runtimeState);
  const state = ensureSkillState(runtimeState);
  return {
    slotConfig: SKILL_SLOT_CONFIG,
    families: getSkillFamilies(),
    activeSlots: state.activeSlots,
    passiveSlots: state.passiveSlots,
    unlockedCount: state.unlocked.length,
    skills: getSkillDefinitions().map((skill) => serializeSkill(runtimeState, skill)),
    unlockHistory: asArray(state.unlockHistory).slice(0, 20),
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
    const skills = serializeSkills(runtimeState);
    const after = JSON.stringify(asRecord(runtimeState.player?.skills));
    let playerState = await findPlayerStateByUserInternalId(client, user.internalId);
    if (before !== after) {
      playerState = await upsertPlayerRuntimeState(client, user.internalId, runtimeState);
    }
    return { playerState, skills };
  });
}

export async function slotSkillForUser(user, payload) {
  return withTransaction(async (client) => {
    const { runtimeState } = await loadRuntimeState(client, user);
    syncUnlockedSkills(runtimeState);
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
      if (!state.unlocked.includes(skillId)) throw new HttpError(409, "That skill is still locked.", "SKILL_LOCKED");
      state[slotKey] = state[slotKey].map((entry) => (entry === skillId ? null : entry));
      state[slotKey][slotIndex] = skillId;
    }
    state.lastUpdatedAt = Date.now();
    const playerState = await upsertPlayerRuntimeState(client, user.internalId, runtimeState);
    const nextRuntimeState = buildMutableRuntimeState(user, playerState);
    return { playerState, skills: serializeSkills(nextRuntimeState), message: "Skill slots updated." };
  });
}
