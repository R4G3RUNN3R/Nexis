import { withTransaction } from "../db/pool.js";
import { buildMutableRuntimeState } from "../lib/runtimePlayerState.js";
import { createDefaultPlayerState, findPlayerStateByUserInternalId } from "../repositories/playerStateRepository.js";
import { activateCityEvent, getCityEventRow } from "../repositories/cityEventRepository.js";
import { getCityCrisisTemplate, getSeverityProfile, CITY_EVENT_COOLDOWN_MS, BURN_EFFECT } from "../data/cityEventData.js";
import { normalizeCityId } from "../data/cityData.js";

function asRecord(value) { return value && typeof value === "object" && !Array.isArray(value) ? value : {}; }
function asNumber(value, fallback = 0) { const numeric = Number(value); return Number.isFinite(numeric) ? numeric : fallback; }

// Hydrates a raw city_events row against its flavor template. Returns null
// when the city has no active crisis right now (inactive or on cooldown).
export function hydrateCityEvent(row) {
  if (!row || row.status !== "active") return null;
  const template = getCityCrisisTemplate(row.cityId);
  if (!template) return null;
  return {
    cityId: row.cityId,
    templateId: row.templateId ?? template.id,
    label: template.label,
    antagonist: template.antagonist,
    summary: template.summary,
    blocksShops: Boolean(template.blocksShops),
    severity: row.severity,
    startedAt: row.startedAt,
    expiresAt: row.expiresAt,
    triggeredByLabel: row.triggeredByLabel,
  };
}

export async function getActiveCityEvent(client, cityId) {
  const normalized = normalizeCityId(cityId, "nexis");
  const row = await getCityEventRow(client, normalized, CITY_EVENT_COOLDOWN_MS);
  return hydrateCityEvent(row);
}

// Rolls a probability and, on a hit, attempts the atomic conditional
// activation. Always resolves, never throws - a losing roll or a losing
// race against another concurrent trigger are both silent no-ops. The
// caller's own success/failure flow (an adventure resolving, a guild quest
// paying out) must never be blocked or altered by whether the city-wide
// consequence actually fired.
export async function triggerCityEventIfEligible(client, { cityId, source, chance, severity, triggeredByLabel, triggeredByPublicId }) {
  const normalized = normalizeCityId(cityId, "nexis");
  const template = getCityCrisisTemplate(normalized);
  if (!template) return null;
  if (Math.random() >= asNumber(chance, 0)) return null;
  const profile = getSeverityProfile(severity);
  const activated = await activateCityEvent(client, normalized, {
    templateId: template.id,
    severity,
    durationMs: profile.durationMs,
    triggerSource: source,
    triggeredByLabel: triggeredByLabel ?? null,
    triggeredByPublicId: triggeredByPublicId ?? null,
  });
  return hydrateCityEvent(activated);
}

// Pure, no DB access - mutates the caller's own already-loaded runtimeState
// in place and returns whether it applied. Must stay pure: a caller that
// already holds this runtimeState and will do its own final
// upsertPlayerRuntimeState would have that write clobbered if this function
// tried to do its own independent load/mutate/persist cycle (confirmed by
// checking hospitalService.applyHospitalStay's call sites - always a
// standalone transaction, never nested inside another service's flow).
//
// Duration scales with the triggering event's severity (major crisis burns
// longer than moderate) - normalCapMs for moderate, absoluteCapMs for major,
// same two-tier idiom as applyHospitalStay's normal/absolute ceiling.
export function applyBurnedConditionToRuntimeState(runtimeState, { reason, severity = "moderate", now = Date.now() }) {
  const player = asRecord(runtimeState.player);
  const existing = asRecord(player.condition);
  if (existing.type === "hospitalized" || existing.type === "jailed") return false;

  const stats = { ...asRecord(player.stats) };
  const currentHealth = asNumber(stats.health, asNumber(stats.maxHealth, 100));
  stats.health = Math.max(1, Math.floor(currentHealth * (1 - BURN_EFFECT.healthPct)));
  stats.energy = Math.max(0, Math.floor(asNumber(stats.energy, 0) - BURN_EFFECT.energyFlat));
  player.stats = stats;

  const existingUntil = existing.type === "burned" && typeof existing.until === "number" ? existing.until : 0;
  const duration = severity === "major" ? BURN_EFFECT.absoluteCapMs : BURN_EFFECT.normalCapMs;
  const until = Math.max(existingUntil, now + duration);
  player.condition = { type: "burned", until, reason: typeof reason === "string" && reason.trim() ? reason.trim().slice(0, 200) : "Burned." };

  runtimeState.player = player;
  return true;
}

// The shared "did this player just interact with a city under crisis" check.
// Reads the player's ACTUAL current city (travel.currentCityId), not
// whatever city page happens to be requested - a player can browse a remote
// city's market without having traveled there, and only physical presence
// should risk a burn. Idempotent per event instance via
// player.worldLoops.lastBurnedCityEventStartedAt[cityId].
export async function applyCityEventExposureIfEligible(client, runtimeState, now = Date.now()) {
  const player = asRecord(runtimeState.player);
  const travel = asRecord(runtimeState.travel);
  const cityId = normalizeCityId(travel.currentCityId ?? asRecord(player.current).currentCityId, "nexis");
  const event = await getActiveCityEvent(client, cityId);
  if (!event) return false;

  const worldLoops = { ...asRecord(player.worldLoops) };
  const burnedMarks = { ...asRecord(worldLoops.lastBurnedCityEventStartedAt) };
  if (burnedMarks[cityId] === event.startedAt) return false;

  const applied = applyBurnedConditionToRuntimeState(runtimeState, { reason: event.summary, severity: event.severity, now });
  burnedMarks[cityId] = event.startedAt;
  worldLoops.lastBurnedCityEventStartedAt = burnedMarks;
  runtimeState.player = { ...asRecord(runtimeState.player), worldLoops };
  return applied;
}

export async function getCityEventForUser(user, cityId) {
  return withTransaction(async (client) => {
    await createDefaultPlayerState(client, user.internalId);
    const playerState = await findPlayerStateByUserInternalId(client, user.internalId);
    const runtimeState = buildMutableRuntimeState(user, playerState);
    const normalized = normalizeCityId(cityId, "nexis");
    const event = await getActiveCityEvent(client, normalized);
    const travel = asRecord(runtimeState.travel);
    return { cityId: normalized, event, isCurrentCity: normalizeCityId(travel.currentCityId, "nexis") === normalized };
  });
}
