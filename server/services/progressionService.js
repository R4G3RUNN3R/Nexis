import { addPlayerRecord, queueProgressionEvent } from "./playerRecordsService.js";
import { getRareManualEligibility, getRareManualUnlockSummary } from "./rareManualService.js";

const MAX_PLAYER_LEVEL = 100;
function asRecord(value) { return value && typeof value === "object" && !Array.isArray(value) ? value : {}; }
function asNumber(value, fallback = 0) { const numeric = Number(value); return Number.isFinite(numeric) ? numeric : fallback; }
function clamp(value, min, max) { return Math.max(min, Math.min(max, value)); }

export function getExperienceToNextLevel(level) { return Math.max(50, Math.floor(asNumber(level, 1)) * 50); }
export function getExperienceFloorForLevel(level) { let total = 0; for (let current = 1; current < Math.max(1, Math.floor(asNumber(level, 1))); current += 1) total += getExperienceToNextLevel(current); return total; }
export function getLevelFromExperience(experience) { let level = 1; let remaining = Math.max(0, Math.floor(asNumber(experience, 0))); while (remaining >= getExperienceToNextLevel(level) && level < MAX_PLAYER_LEVEL) { remaining -= getExperienceToNextLevel(level); level += 1; } return level; }
export function getMaxLifeForLevel(level) { return 100 + (Math.max(1, Math.floor(asNumber(level, 1))) - 1) * 50; }

export function normalizeProgressionState(runtimeState, { healIfRaised = false } = {}) {
  runtimeState.player = asRecord(runtimeState.player);
  const player = runtimeState.player;
  const experience = Math.max(0, Math.floor(asNumber(player.experience, 0)));
  const level = Math.max(1, getLevelFromExperience(experience), Math.floor(asNumber(player.level, 1)));
  player.experience = experience;
  player.level = level;
  player.stats = { ...asRecord(player.stats) };
  const expectedMaxLife = getMaxLifeForLevel(level);
  const currentMax = Math.max(1, Math.floor(asNumber(player.stats.maxHealth, expectedMaxLife)));
  if (currentMax < expectedMaxLife) {
    player.stats.maxHealth = expectedMaxLife;
    player.stats.health = healIfRaised ? expectedMaxLife : clamp(Math.floor(asNumber(player.stats.health, expectedMaxLife)), 1, expectedMaxLife);
  } else {
    player.stats.maxHealth = currentMax;
    player.stats.health = clamp(Math.floor(asNumber(player.stats.health, currentMax)), 1, currentMax);
  }
  player.rareManualEligibility = getRareManualEligibility(runtimeState);
  return runtimeState;
}

function buildMilestoneSummary(newLevel) {
  const summaries = [];
  if (newLevel % 5 === 0) summaries.push(`Level ${newLevel} milestone reached.`);
  summaries.push(...getRareManualUnlockSummary(newLevel));
  return summaries;
}

export function addPlayerExperience(runtimeState, amount, source = "progression", options = {}) {
  runtimeState.player = asRecord(runtimeState.player);
  const player = runtimeState.player;
  player.stats = { ...asRecord(player.stats) };
  const xpAmount = Math.max(0, Math.floor(asNumber(amount, 0)));
  if (xpAmount <= 0) return { xpGained: 0, levelUps: [], oldLevel: Math.max(1, Math.floor(asNumber(player.level, 1))), newLevel: Math.max(1, Math.floor(asNumber(player.level, 1))) };
  const now = typeof options.now === "number" ? options.now : Date.now();
  const oldXp = Math.max(0, Math.floor(asNumber(player.experience, 0)));
  const oldLevel = Math.max(1, getLevelFromExperience(oldXp), Math.floor(asNumber(player.level, 1)));
  const oldMaxLife = Math.max(getMaxLifeForLevel(oldLevel), Math.floor(asNumber(player.stats.maxHealth, getMaxLifeForLevel(oldLevel))));
  const newXp = oldXp + xpAmount;
  const newLevel = Math.max(oldLevel, getLevelFromExperience(newXp));
  player.experience = newXp;
  player.level = newLevel;
  const levelUps = [];
  if (newLevel > oldLevel) {
    const newMaxLife = getMaxLifeForLevel(newLevel);
    player.stats.maxHealth = newMaxLife;
    player.stats.health = newMaxLife;
    player.counters = { ...asRecord(player.counters), levelUps: Math.max(0, Math.floor(asNumber(player.counters?.levelUps, 0))) + (newLevel - oldLevel), lastLevelUpAt: now };
    const milestoneSummary = [];
    for (let level = oldLevel + 1; level <= newLevel; level += 1) milestoneSummary.push(...buildMilestoneSummary(level));
    const detail = { oldLevel, newLevel, oldMaxLife, newMaxLife, xpGained: xpAmount, source, milestones: milestoneSummary };
    addPlayerRecord(runtimeState, { id: `level_up_${oldLevel}_${newLevel}_${now}`, category: "progression", summary: `Level up: ${oldLevel} -> ${newLevel}. Max Life ${oldMaxLife} -> ${newMaxLife}; Life fully restored.`, detail, source, route: "/home", timestamp: now });
    addPlayerRecord(runtimeState, { id: `max_life_${newLevel}_${now}`, category: "progression", summary: `Max Life increased to ${newMaxLife}.`, detail: { oldMaxLife, newMaxLife, newLevel }, source: "level-up", route: "/profile", timestamp: now });
    queueProgressionEvent(runtimeState, { id: `level_up_${oldLevel}_${newLevel}_${now}`, type: "level_up", title: `Level ${newLevel} reached`, summary: `Level ${oldLevel} -> ${newLevel}. Max Life ${oldMaxLife} -> ${newMaxLife}. Life fully restored.`, route: "/home", createdAt: now, detail });
    levelUps.push(detail);
  }
  normalizeProgressionState(runtimeState, { healIfRaised: false });
  return { xpGained: xpAmount, levelUps, oldLevel, newLevel, oldExperience: oldXp, newExperience: newXp };
}

export function serializeProgression(runtimeState) {
  normalizeProgressionState(runtimeState);
  const player = asRecord(runtimeState.player);
  return {
    level: player.level,
    experience: player.experience,
    maxLife: asRecord(player.stats).maxHealth,
    currentLife: asRecord(player.stats).health,
    nextLevelAt: getExperienceFloorForLevel(Math.min(MAX_PLAYER_LEVEL, player.level + 1)),
    rareManualEligibility: getRareManualEligibility(runtimeState),
  };
}
