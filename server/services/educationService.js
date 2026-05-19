import { withTransaction } from "../db/pool.js";
import { HttpError } from "../lib/errors.js";
import { buildMutableRuntimeState } from "../lib/runtimePlayerState.js";
import { createDefaultPlayerState, findPlayerStateByUserInternalId, upsertPlayerRuntimeState } from "../repositories/playerStateRepository.js";
import { educationCategories, educationCourseMap, getCourseLabel } from "../data/educationData.js";

const DAY_MS = 24 * 60 * 60 * 1000;
const ADMIN_DURATION_MS = 1000;

function asRecord(value) { return value && typeof value === "object" && !Array.isArray(value) ? value : {}; }
function asArray(value) { return Array.isArray(value) ? value : []; }
function asNumber(value, fallback = 0) { const n = Number(value); return Number.isFinite(n) ? n : fallback; }
function uniqueStrings(values) { return Array.from(new Set(asArray(values).filter((v) => typeof v === "string" && v.trim()).map((v) => v.trim()))); }
function isAdmin(user) { return user?.privilegeRole === "admin" || user?.privilegeRole === "staff"; }

function addLegacyEntry(runtimeState, entry) {
  const legacy = asRecord(runtimeState.legacy);
  const visibleEntries = asArray(legacy.visibleEntries);
  if (!visibleEntries.some((current) => asRecord(current).id === entry.id)) {
    legacy.visibleEntries = [entry, ...visibleEntries].slice(0, 50);
  }
  runtimeState.legacy = legacy;
}

export function ensureEducationState(runtimeState) {
  const existing = asRecord(runtimeState.education);
  const completed = asRecord(existing.completed);
  const completedCourses = uniqueStrings([
    ...asArray(existing.completedCourses),
    ...Object.entries(completed).filter(([, value]) => value === true || asRecord(value).completed === true).map(([courseId]) => courseId),
  ]);
  const active = asRecord(existing.activeCourse);
  runtimeState.education = {
    completedCourses,
    completed,
    completedAtByCourse: asRecord(existing.completedAtByCourse),
    activeCourse: active.courseId ? { ...active } : null,
    passiveBonuses: asRecord(existing.passiveBonuses),
    activeUnlocks: uniqueStrings(existing.activeUnlocks),
    systemUnlocks: uniqueStrings(existing.systemUnlocks),
    history: asArray(existing.history).filter((entry) => entry && typeof entry === "object").slice(0, 80),
    discoveries: asArray(existing.discoveries).filter((entry) => entry && typeof entry === "object").slice(0, 80),
  };
  runtimeState.player.current = {
    ...asRecord(runtimeState.player.current),
    education: runtimeState.education.activeCourse
      ? {
          id: runtimeState.education.activeCourse.courseId,
          name: getCourseLabel(runtimeState.education.activeCourse.courseId),
          startedAt: runtimeState.education.activeCourse.startedAt,
          durationMs: runtimeState.education.activeCourse.durationMs,
        }
      : null,
  };
  return runtimeState.education;
}

export function getCompletedCourseIds(runtimeState) {
  return ensureEducationState(runtimeState).completedCourses;
}

function missingPrereqs(course, completedCourses) {
  const completed = new Set(completedCourses);
  return (course.prerequisites ?? []).filter((courseId) => !completed.has(courseId));
}

function durationMs(runtimeState, course, admin) {
  if (admin) return ADMIN_DURATION_MS;
  const speedBonus = Math.min(65, Math.max(0, asNumber(ensureEducationState(runtimeState).passiveBonuses.educationSpeed, 0)));
  return Math.max(60 * 1000, Math.round(asNumber(course.durationDays, 1) * DAY_MS * Math.max(0.25, 1 - speedBonus / 100)));
}

function applyEffectLists(education, course) {
  const passive = { ...asRecord(education.passiveBonuses) };
  const active = new Set(uniqueStrings(education.activeUnlocks));
  const systems = new Set(uniqueStrings(education.systemUnlocks));
  for (const effect of course.systemEffects ?? []) {
    const text = String(effect);
    const lower = text.toLowerCase();
    if (lower.includes("education speed +5%")) passive.educationSpeed = asNumber(passive.educationSpeed, 0) + 5;
    if (lower.includes("health regeneration +10%")) passive.healthRegen = asNumber(passive.healthRegen, 0) + 10;
    if (lower.includes("mission success +5%")) passive.missionSuccess = asNumber(passive.missionSuccess, 0) + 5;
    if (lower.includes("market efficiency +5%")) passive.marketEfficiency = asNumber(passive.marketEfficiency, 0) + 5;
    if (lower.includes("all battle stats +5%")) passive.battleStats = asNumber(passive.battleStats, 0) + 5;
    if (lower.includes("all working stats +5%")) passive.workingStats = asNumber(passive.workingStats, 0) + 5;
    active.add(text);
  }
  for (const unlock of course.unlocksSystems ?? []) systems.add(unlock);
  education.passiveBonuses = passive;
  education.activeUnlocks = Array.from(active);
  education.systemUnlocks = Array.from(systems);
}

function applyStatRewards(runtimeState, course) {
  const player = runtimeState.player;
  if (course.statRewards) {
    player.battleStats = { ...asRecord(player.battleStats) };
    for (const [stat, value] of Object.entries(course.statRewards)) player.battleStats[stat] = Math.max(0, Math.floor(asNumber(player.battleStats[stat], 0) + asNumber(value, 0)));
  }
  if (course.workingStatRewards) {
    player.workingStats = { ...asRecord(player.workingStats) };
    for (const [stat, value] of Object.entries(course.workingStatRewards)) player.workingStats[stat] = Math.max(0, Math.floor(asNumber(player.workingStats[stat], 0) + asNumber(value, 0)));
  }
  if (course.id === "general-mastery") {
    player.battleStats = { ...asRecord(player.battleStats) };
    for (const stat of ["strength", "defense", "speed", "dexterity"]) player.battleStats[stat] = Math.max(0, Math.floor(asNumber(player.battleStats[stat], 0) * 1.05));
    player.workingStats = { ...asRecord(player.workingStats) };
    for (const stat of ["manualLabor", "intelligence", "endurance"]) player.workingStats[stat] = Math.max(0, Math.floor(asNumber(player.workingStats[stat], 0) * 1.05));
  }
  player.experience = Math.max(0, Math.floor(asNumber(player.experience, 0) + Math.max(10, Math.round(asNumber(course.durationDays, 1) * 2))));
}
function completeCourse(runtimeState, course, now, admin = false) {
  const education = ensureEducationState(runtimeState);
  if (education.completedCourses.includes(course.id)) return false;
  education.completedCourses = uniqueStrings([...education.completedCourses, course.id]);
  education.completed[course.id] = { completed: true, completedAt: now };
  education.completedAtByCourse[course.id] = now;
  if (course.id === "underworld-etiquette" || course.id === "streetwise-mastery") {
    education.completedCourses = uniqueStrings([...education.completedCourses, "street-survival"]);
    education.completed["street-survival"] = { completed: true, completedAt: now, aliasFor: course.id };
    education.completedAtByCourse["street-survival"] = now;
  }
  applyEffectLists(education, course);
  applyStatRewards(runtimeState, course);
  education.history = [{ id: `education_${course.id}_${now}`, courseId: course.id, title: course.name, completedAt: now, adminGranted: admin }, ...asArray(education.history)].slice(0, 80);
  addLegacyEntry(runtimeState, { id: `education_${course.id}`, title: `Completed ${course.name}`, summary: `${course.name} joined the permanent education record.`, kind: "education", awardedAt: now });
  ensureEducationState(runtimeState);
  return true;
}

function serializeCourse(runtimeState, course, education, admin, now) {
  const missing = missingPrereqs(course, education.completedCourses);
  const active = education.activeCourse?.courseId === course.id ? education.activeCourse : null;
  const completed = education.completedCourses.includes(course.id);
  const locked = !completed && !active && missing.length > 0;
  return {
    ...course,
    completed,
    active: Boolean(active),
    locked,
    status: completed ? "completed" : active ? "current" : locked ? "locked" : "available",
    missingPrerequisites: missing,
    lockReason: locked ? `Complete ${missing.map(getCourseLabel).join(", ")} to unlock ${course.name}.` : null,
    durationMs: durationMs(runtimeState, course, admin),
    remainingMs: active ? Math.max(0, asNumber(active.completesAt, now) - now) : 0,
    readyToComplete: active ? now >= asNumber(active.completesAt, now + 1) : false,
  };
}

function serializeEducation(runtimeState, user, now = Date.now()) {
  const education = ensureEducationState(runtimeState);
  const admin = isAdmin(user);
  const categories = educationCategories.map((category) => {
    const courses = category.courses.map((course) => serializeCourse(runtimeState, course, education, admin, now));
    return { ...category, courses, progress: { completed: courses.filter((course) => course.completed).length, total: courses.length, locked: courses.filter((course) => course.locked).length } };
  });
  return {
    categories,
    completedCourses: education.completedCourses,
    activeCourse: education.activeCourse,
    passiveBonuses: education.passiveBonuses,
    activeUnlocks: education.activeUnlocks,
    systemUnlocks: education.systemUnlocks,
    history: education.history,
    discoveries: education.discoveries,
    adminMode: admin,
    now,
  };
}

async function loadRuntimeState(client, user) {
  await createDefaultPlayerState(client, user.internalId);
  const playerState = await findPlayerStateByUserInternalId(client, user.internalId);
  if (!playerState) throw new HttpError(404, "Player state unavailable.", "PLAYER_STATE_NOT_FOUND");
  return buildMutableRuntimeState(user, playerState);
}

export async function getEducationForUser(user) {
  return withTransaction(async (client) => {
    const runtimeState = await loadRuntimeState(client, user);
    ensureEducationState(runtimeState);
    const playerState = await upsertPlayerRuntimeState(client, user.internalId, runtimeState);
    return { playerState, education: serializeEducation(buildMutableRuntimeState(user, playerState), user) };
  });
}

export async function startEducationForUser(user, courseId) {
  return withTransaction(async (client) => {
    const runtimeState = await loadRuntimeState(client, user);
    const education = ensureEducationState(runtimeState);
    const course = educationCourseMap[courseId];
    if (!course) throw new HttpError(404, "Course unavailable.", "EDUCATION_COURSE_NOT_FOUND");
    if (education.activeCourse) throw new HttpError(409, "You are already studying an education course.", "EDUCATION_ALREADY_ACTIVE");
    if (education.completedCourses.includes(course.id)) throw new HttpError(409, "That course is already complete.", "EDUCATION_ALREADY_COMPLETE");
    const missing = missingPrereqs(course, education.completedCourses);
    if (missing.length) throw new HttpError(403, `Complete ${missing.map(getCourseLabel).join(", ")} before starting ${course.name}.`, "EDUCATION_LOCKED");
    const admin = isAdmin(user);
    const cost = Math.max(0, Math.floor(asNumber(course.costGold, 0)));
    if (!admin && asNumber(runtimeState.player.gold, 0) < cost) throw new HttpError(400, `You need ${cost.toLocaleString()} gold to start ${course.name}.`, "EDUCATION_GOLD_REQUIRED");
    if (!admin && cost > 0) {
      runtimeState.player.gold = Math.max(0, Math.floor(asNumber(runtimeState.player.gold, 0) - cost));
      runtimeState.player.currencies = { ...asRecord(runtimeState.player.currencies), gold: runtimeState.player.gold };
    }
    const now = Date.now();
    const ms = durationMs(runtimeState, course, admin);
    const nextEducation = ensureEducationState(runtimeState);
    nextEducation.activeCourse = { courseId: course.id, categoryId: course.categoryId, startedAt: now, durationMs: ms, completesAt: now + ms, adminFastTrack: admin };
    ensureEducationState(runtimeState);
    const playerState = await upsertPlayerRuntimeState(client, user.internalId, runtimeState);
    return { playerState, education: serializeEducation(buildMutableRuntimeState(user, playerState), user), message: `${course.name} started.` };
  });
}

export async function cancelEducationForUser(user) {
  return withTransaction(async (client) => {
    const runtimeState = await loadRuntimeState(client, user);
    const education = ensureEducationState(runtimeState);
    if (!education.activeCourse) throw new HttpError(409, "No education course is active.", "EDUCATION_NOT_ACTIVE");
    education.activeCourse = null;
    ensureEducationState(runtimeState);
    const playerState = await upsertPlayerRuntimeState(client, user.internalId, runtimeState);
    return { playerState, education: serializeEducation(buildMutableRuntimeState(user, playerState), user), message: "Education course cancelled." };
  });
}

export async function completeEducationForUser(user, courseId = null) {
  return withTransaction(async (client) => {
    const runtimeState = await loadRuntimeState(client, user);
    const education = ensureEducationState(runtimeState);
    const active = education.activeCourse;
    const targetId = courseId || active?.courseId;
    const course = educationCourseMap[targetId];
    if (!course) throw new HttpError(404, "Course unavailable.", "EDUCATION_COURSE_NOT_FOUND");
    const admin = isAdmin(user);
    if (!active || active.courseId !== course.id) {
      if (!admin) throw new HttpError(409, "That course is not active.", "EDUCATION_NOT_ACTIVE");
    } else if (!admin && Date.now() < asNumber(active.completesAt, Date.now() + 1)) {
      throw new HttpError(409, "That course is still in progress.", "EDUCATION_STILL_RUNNING");
    }
    const now = Date.now();
    completeCourse(runtimeState, course, now, admin);
    if (ensureEducationState(runtimeState).activeCourse?.courseId === course.id) runtimeState.education.activeCourse = null;
    ensureEducationState(runtimeState);
    const playerState = await upsertPlayerRuntimeState(client, user.internalId, runtimeState);
    return { playerState, education: serializeEducation(buildMutableRuntimeState(user, playerState), user), message: `${course.name} completed.` };
  });
}

export async function adminCompleteEducationForUser(user, payload = {}) {
  if (!isAdmin(user)) throw new HttpError(403, "Admin education tools are unavailable for this account.", "ADMIN_REQUIRED");
  return withTransaction(async (client) => {
    const runtimeState = await loadRuntimeState(client, user);
    const ids = payload?.courseId === "all" ? Object.keys(educationCourseMap) : [String(payload?.courseId ?? "")].filter(Boolean);
    if (!ids.length) throw new HttpError(400, "Course id is required.", "EDUCATION_COURSE_REQUIRED");
    const now = Date.now();
    for (const id of ids) if (educationCourseMap[id]) completeCourse(runtimeState, educationCourseMap[id], now, true);
    ensureEducationState(runtimeState).activeCourse = null;
    ensureEducationState(runtimeState);
    const playerState = await upsertPlayerRuntimeState(client, user.internalId, runtimeState);
    return { playerState, education: serializeEducation(buildMutableRuntimeState(user, playerState), user), message: ids.length > 1 ? "All education courses completed for admin testing." : `${getCourseLabel(ids[0])} completed for admin testing.` };
  });
}
