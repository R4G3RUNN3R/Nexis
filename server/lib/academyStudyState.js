// Shared helpers for the pause-based academy study timer.
//
// Study progress is tracked as ACCUMULATED study time rather than a fixed
// wall-clock end timestamp. While the player is physically present in the
// academy's city (currentCityId matches and they are not in transit),
// elapsed time counts toward the active stage. The moment they leave —
// travel starts, or currentCityId otherwise changes — accumulation freezes
// at whatever progress was made, and resumes exactly where it left off when
// they return.
//
// activeStudy shape:
//   {
//     academyId, stageId, cityId,
//     durationMs,          // total study duration required for this stage
//     startedAt,           // first-ever start timestamp (telemetry only)
//     accumulatedMs,       // banked study ms from completed presence periods
//     lastResumedAt,       // epoch ms when the current accrual period began,
//                          // or null when accrual is paused (player absent)
//   }
//
// This module is intentionally dependency-free (no imports from
// cityService.js/travelService.js) so it can be called from both without
// creating a circular import.

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

export function ensureAcademyState(runtimeState) {
  const player = asRecord(runtimeState.player);
  const existing = asRecord(player.cityAcademy);
  const activeStudy = asRecord(existing.activeStudy);
  const completed = asRecord(existing.completed);
  player.cityAcademy = {
    ...existing,
    activeStudy: activeStudy.academyId ? { ...activeStudy } : null,
    completed: { ...completed },
    unlocks: asArray(existing.unlocks).filter((entry) => typeof entry === "string"),
    skillAccess: asArray(existing.skillAccess).filter((entry) => typeof entry === "string"),
  };
  runtimeState.player = player;
  return player.cityAcademy;
}

// Ms of study time banked so far, folding in any accrual currently in progress.
export function getAccumulatedStudyMs(activeStudy, now = Date.now()) {
  if (!activeStudy || !activeStudy.academyId) return 0;
  const base = Math.max(0, asNumber(activeStudy.accumulatedMs, 0));
  if (typeof activeStudy.lastResumedAt === "number") {
    return base + Math.max(0, now - activeStudy.lastResumedAt);
  }
  return base;
}

export function isAccruing(activeStudy) {
  return Boolean(activeStudy && typeof activeStudy.lastResumedAt === "number");
}

/**
 * Freezes or resumes the active study's accrual based on whether the player
 * is currently present (in the study's city and not in transit). Safe to
 * call on every relevant event (travel start, travel arrival, academy status
 * checks, or any general state refresh) — it is a no-op unless presence
 * actually changed since the last sync.
 *
 * Returns true if runtimeState.player.cityAcademy was mutated (caller should
 * persist the runtime state).
 */
export function syncAcademyStudyPresence(runtimeState, currentCityId, inTransit, now = Date.now()) {
  const academyState = ensureAcademyState(runtimeState);
  const activeStudy = academyState.activeStudy;
  if (!activeStudy || !activeStudy.academyId) return false;

  const presentAtStudyCity = !inTransit && activeStudy.cityId === currentCityId;
  const currentlyAccruing = isAccruing(activeStudy);
  if (presentAtStudyCity === currentlyAccruing) return false;

  const accumulatedMs = getAccumulatedStudyMs(activeStudy, now);
  academyState.activeStudy = {
    ...activeStudy,
    accumulatedMs,
    lastResumedAt: presentAtStudyCity ? now : null,
  };
  return true;
}
