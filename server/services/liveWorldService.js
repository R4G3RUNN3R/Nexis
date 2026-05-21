import { getCityDefinition, normalizeCityId } from "../data/cityData.js";
import { getCompletedCourseIds } from "./educationService.js";
import {
  CITY_DEMAND_PROFILES,
  CITY_RHYTHMS,
  CITY_THREAT_EVENTS,
  DAILY_STREAK_BEHAVIOR,
  DISCOVERY_EVENT_POOL,
  HIDDEN_SITE_DEFINITIONS,
  LIVE_WORLD_DAY_MS,
  PRESTIGE_BADGE_DEFINITIONS,
  PRESTIGE_TITLE_DEFINITIONS,
  SHADOW_RESOURCE,
  WORLD_BOSS_EVENTS,
} from "../data/liveWorldData.js";
import { addPlayerRecord } from "./playerRecordsService.js";

function asRecord(value) { return value && typeof value === "object" && !Array.isArray(value) ? value : {}; }
function asArray(value) { return Array.isArray(value) ? value : []; }
function asNumber(value, fallback = 0) { const numeric = Number(value); return Number.isFinite(numeric) ? numeric : fallback; }
function clamp(value, min, max) { return Math.max(min, Math.min(max, value)); }
function dayNumber(now = Date.now()) { return Math.floor(now / LIVE_WORLD_DAY_MS); }
function cleanId(value) { return String(value ?? "").toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "").slice(0, 64) || "entry"; }
function dayPick(list, cityId, now = Date.now(), offset = 0) { if (!Array.isArray(list) || !list.length) return null; const seed = Array.from(String(cityId ?? "nexis")).reduce((sum, char) => sum + char.charCodeAt(0), 0); return list[(dayNumber(now) + seed + offset) % list.length]; }
function ensurePlayer(runtimeState) { runtimeState.player = asRecord(runtimeState.player); return runtimeState.player; }
function completedSet(runtimeState) { return new Set(getCompletedCourseIds(runtimeState)); }
function getStats(runtimeState) { const player = ensurePlayer(runtimeState); player.stats = { ...asRecord(player.stats) }; return player.stats; }
function addInventory(runtimeState, itemId, quantity = 1) { if (!itemId) return; const player = ensurePlayer(runtimeState); player.inventory = { ...asRecord(player.inventory) }; player.inventory[itemId] = Math.max(0, Math.floor(asNumber(player.inventory[itemId], 0) + Math.max(1, Math.floor(asNumber(quantity, 1))))); }
function addGold(runtimeState, amount) { const player = ensurePlayer(runtimeState); const nextGold = Math.max(0, Math.floor(asNumber(player.gold, 500) + asNumber(amount, 0))); player.gold = nextGold; player.currencies = { ...asRecord(player.currencies), gold: nextGold }; }
function addExperience(runtimeState, amount) { if (!amount) return; const player = ensurePlayer(runtimeState); player.experience = Math.max(0, Math.floor(asNumber(player.experience, 0) + asNumber(amount, 0))); }
function ensureWorldLoops(runtimeState) { const player = ensurePlayer(runtimeState); player.worldLoops = { ...asRecord(player.worldLoops) }; return player.worldLoops; }
function ensureNotifications(runtimeState) { const player = ensurePlayer(runtimeState); const current = asRecord(player.notifications); player.notifications = { ...current, alerts: asArray(current.alerts) }; return player.notifications; }
function ensureWorldDiscovery(runtimeState) { const player = ensurePlayer(runtimeState); const current = asRecord(player.worldDiscovery); player.worldDiscovery = { ...current, hiddenSites: { ...asRecord(current.hiddenSites) }, discoveries: asArray(current.discoveries) }; return player.worldDiscovery; }
function addLegacyEntry(runtimeState, entry) { const legacy = asRecord(runtimeState.legacy); const visibleEntries = asArray(legacy.visibleEntries); if (visibleEntries.some((current) => asRecord(current).id === entry.id)) { runtimeState.legacy = legacy; return; } legacy.visibleEntries = [entry, ...visibleEntries].slice(0, 50); runtimeState.legacy = legacy; }

export function addWorldAlert(runtimeState, input) {
  const notifications = ensureNotifications(runtimeState);
  const id = typeof input.id === "string" ? input.id : cleanId(`${input.kind}_${input.label}`);
  const alert = { id, kind: input.kind ?? "notice", label: input.label ?? "New notice", summary: input.summary ?? null, route: input.route ?? null, createdAt: asNumber(input.createdAt, Date.now()), resolved: Boolean(input.resolved) };
  const existing = asArray(notifications.alerts).filter((entry) => asRecord(entry).id !== id);
  notifications.alerts = [alert, ...existing].slice(0, 24);
  return alert;
}
function computeDailyReward(streak) { const capped = Math.max(1, Math.min(30, Math.floor(asNumber(streak, 1)))); const reward = { gold: 25 + Math.min(150, capped * 6), energy: capped % 7 === 0 ? 18 : capped % 3 === 0 ? 10 : 5, items: [] }; if (capped % 3 === 0) reward.items.push({ itemId: "rations", quantity: 1 }); if (capped % 5 === 0) reward.items.push({ itemId: "field_bandage", quantity: 1 }); if (capped % 7 === 0) reward.items.push({ itemId: "torn_map", quantity: 1 }); return reward; }
function applyDailyLogin(runtimeState, now) {
  const loops = ensureWorldLoops(runtimeState); const daily = asRecord(loops.dailyLogin); const today = dayNumber(now); const lastRewardDay = Number.isFinite(Number(daily.lastRewardDay)) ? Number(daily.lastRewardDay) : null; if (lastRewardDay === today) return false;
  const previousStreak = Math.max(0, Math.floor(asNumber(daily.streak, 0))); const dayDiff = lastRewardDay === null ? 0 : today - lastRewardDay; const streak = lastRewardDay === null ? 1 : dayDiff === 1 ? previousStreak + 1 : dayDiff === 2 ? Math.max(1, previousStreak) : 1;
  const reward = computeDailyReward(streak); addGold(runtimeState, reward.gold); const stats = getStats(runtimeState); stats.energy = clamp(asNumber(stats.energy, 100) + reward.energy, 0, asNumber(stats.maxEnergy, 100)); for (const item of reward.items) addInventory(runtimeState, item.itemId, item.quantity);
  loops.dailyLogin = { lastRewardDay: today, lastRewardAt: now, streak, previousStreak, graceUsed: dayDiff === 2, behavior: DAILY_STREAK_BEHAVIOR, reward };
  addWorldAlert(runtimeState, { id: `daily_login_${today}`, kind: "daily", label: `Daily streak ${streak}: reward claimed`, summary: `${reward.gold} gold, ${reward.energy} energy${reward.items.length ? ", supplies packed" : ""}.`, route: "/home", createdAt: now });
  return true;
}
function applyOfflineRecovery(runtimeState, now) {
  const loops = ensureWorldLoops(runtimeState); const lastSeenAt = asNumber(loops.lastSeenAt, asNumber(ensurePlayer(runtimeState).createdAt, now)); const elapsedMs = Math.max(0, now - lastSeenAt); const stats = getStats(runtimeState); const recovered = { energy: 0, health: 0, stamina: 0 };
  if (elapsedMs >= 300000) { const gain = Math.floor(elapsedMs / 300000); const before = asNumber(stats.energy, 100); stats.energy = clamp(before + gain, 0, asNumber(stats.maxEnergy, 100)); recovered.energy = Math.max(0, stats.energy - before); }
  if (elapsedMs >= 360000) { const gain = Math.floor(elapsedMs / 360000); const before = asNumber(stats.health, 100); stats.health = clamp(before + gain, 1, asNumber(stats.maxHealth, 100)); recovered.health = Math.max(0, stats.health - before); }
  if (elapsedMs >= 900000) { const gain = Math.floor(elapsedMs / 900000); const before = asNumber(stats.stamina, 10); stats.stamina = clamp(before + gain, 0, asNumber(stats.maxStamina, 10)); recovered.stamina = Math.max(0, stats.stamina - before); }
  loops.lastSeenAt = now; const player = ensurePlayer(runtimeState); player.counters = { ...asRecord(player.counters), barRevision: Math.max(0, Math.floor(asNumber(player.counters?.barRevision, 0) + (recovered.energy || recovered.health || recovered.stamina ? 1 : 0))) }; return { elapsedMs, recovered };
}
function readyEntries(runtimeState, now = Date.now()) {
  const education = asRecord(runtimeState.education); const activeCourse = asRecord(education.activeCourse); const entries = [];
  if (activeCourse.courseId && asNumber(activeCourse.completesAt, Infinity) <= now) entries.push({ id: "education_ready", label: "Education course ready to complete", route: "/education" });
  const study = asRecord(ensurePlayer(runtimeState).cityAcademy?.activeStudy); if (study.academyId && asNumber(study.endsAt, Infinity) <= now) entries.push({ id: "academy_ready", label: "Academy study ready to complete", route: "/city#academy" });
  return entries;
}
function buildReturnSummary(runtimeState, elapsedMs, recovered, now) {
  const entries = []; if (recovered.energy) entries.push({ id: "energy", label: `Energy recovered: +${recovered.energy}`, route: "/home" }); if (recovered.health) entries.push({ id: "health", label: `Health recovered: +${recovered.health}`, route: "/home" }); if (recovered.stamina) entries.push({ id: "stamina", label: `Stamina recovered: +${recovered.stamina}`, route: "/home" });
  const travel = asRecord(runtimeState.travel); if (asRecord(travel.arrivalNotice).arrivedAt) entries.push({ id: "travel", label: `Arrived in ${travel.arrivalNotice.destinationName ?? "destination city"}`, route: "/travel" }); entries.push(...readyEntries(runtimeState, now));
  const contracts = Object.values(asRecord(asRecord(ensurePlayer(runtimeState).cityContracts).records)).filter((record) => asRecord(record).status === "completed"); if (contracts.length) entries.push({ id: "contracts", label: `${contracts.length} contract${contracts.length === 1 ? "" : "s"} ready to claim`, route: "/city#contracts" });
  const discoveries = asArray(asRecord(ensurePlayer(runtimeState).worldDiscovery).discoveries).filter((entry) => now - asNumber(asRecord(entry).foundAt, 0) < 172800000); if (discoveries.length) entries.push({ id: "discoveries", label: `${discoveries.length} recent discovery note${discoveries.length === 1 ? "" : "s"}`, route: "/world-map" });
  if (elapsedMs < 1800000 && !entries.length) return null; return { generatedAt: now, elapsedMs, entries: entries.slice(0, 8) };
}
export function ensureShadowState(runtimeState, now = Date.now()) {
  const player = ensurePlayer(runtimeState); const completed = completedSet(runtimeState); const current = asRecord(player.shadow); const academyUnlocks = asArray(asRecord(player.cityAcademy).unlocks);
  const max = SHADOW_RESOURCE.baseMax + (completed.has("street-survival") ? 4 : 0) + (academyUnlocks.some((entry) => String(entry).includes("nightwake")) ? 2 : 0);
  const lastUpdatedAt = asNumber(current.updatedAt, now); const prior = Math.max(0, Math.floor(asNumber(current.current, SHADOW_RESOURCE.starterCurrent))); const regenerated = Math.floor(Math.max(0, now - lastUpdatedAt) / SHADOW_RESOURCE.regenMs); const nextCurrent = clamp(prior + regenerated, 0, max);
  player.shadow = { id: SHADOW_RESOURCE.id, label: SHADOW_RESOURCE.label, current: nextCurrent, max, regenMs: SHADOW_RESOURCE.regenMs, updatedAt: regenerated > 0 ? lastUpdatedAt + regenerated * SHADOW_RESOURCE.regenMs : lastUpdatedAt, nextAt: nextCurrent >= max ? null : (regenerated > 0 ? lastUpdatedAt + (regenerated + 1) * SHADOW_RESOURCE.regenMs : lastUpdatedAt + SHADOW_RESOURCE.regenMs), description: SHADOW_RESOURCE.description, lockReason: completed.has("street-survival") ? null : "Street Survival improves Shadow capacity and reveals safer under-market routes." };
  return player.shadow;
}
export function spendShadow(runtimeState, amount, reason = "covert action", now = Date.now()) {
  const shadow = ensureShadowState(runtimeState, now); const cost = Math.max(0, Math.floor(asNumber(amount, 0))); if (cost <= 0) return shadow;
  if (shadow.current < cost) { const error = new Error(`Not enough Shadow for ${reason}. Requires ${cost}; current Shadow: ${shadow.current}.`); error.code = "SHADOW_INSUFFICIENT"; throw error; }
  shadow.current -= cost; shadow.updatedAt = now; shadow.nextAt = shadow.current >= shadow.max ? null : now + shadow.regenMs;
  const player = ensurePlayer(runtimeState); player.counters = { ...asRecord(player.counters), shadowSpent: Math.max(0, Math.floor(asNumber(player.counters?.shadowSpent, 0) + cost)), shadowActions: Math.max(0, Math.floor(asNumber(player.counters?.shadowActions, 0) + 1)) };
  return shadow;
}
function titleById(id) { return PRESTIGE_TITLE_DEFINITIONS.find((entry) => entry.id === id) ?? PRESTIGE_TITLE_DEFINITIONS[0]; }
export function resolvePrestigeState(runtimeState, now = Date.now()) {
  const player = ensurePlayer(runtimeState); const completed = completedSet(runtimeState); const titleIds = new Set(["citizen"]);
  if (completed.has("basic-literacy")) titleIds.add("lettered-citizen"); if (completed.has("practical-arithmetic")) titleIds.add("ledger-hand"); if (completed.has("world-geography")) titleIds.add("wayfinder"); if (completed.has("street-survival")) titleIds.add("streetwise"); if (completed.has("historical-awareness")) titleIds.add("field-scholar");
  const academyCompleted = Object.keys(asRecord(asRecord(player.cityAcademy).completed)).length; if (academyCompleted > 0) titleIds.add("academy-graduate");
  const standingHigh = Object.values(asRecord(player.cityStanding)).some((record) => asNumber(asRecord(record).value, asNumber(asRecord(record).standing, 0)) >= 8); if (standingHigh) titleIds.add("city-fixture");
  const hiddenSiteCount = Object.values(asRecord(asRecord(player.worldDiscovery).hiddenSites)).filter((record) => ["discovered", "explored"].includes(asRecord(record).status)).length; if (hiddenSiteCount >= 2) titleIds.add("route-finder");
  if (asArray(asRecord(player.duels).history).length) titleIds.add("duelist"); if (asNumber(asRecord(player.counters).shadowActions, 0) > 0) titleIds.add("under-market-hand");
  const titles = Array.from(titleIds).map((id) => ({ ...titleById(id), unlockedAt: now })); const badges = [];
  if (completed.size) badges.push(PRESTIGE_BADGE_DEFINITIONS.find((entry) => entry.id === "education-mark")); if (academyCompleted) badges.push(PRESTIGE_BADGE_DEFINITIONS.find((entry) => entry.id === "academy-mark")); if (hiddenSiteCount || asArray(asRecord(player.worldDiscovery).discoveries).length) badges.push(PRESTIGE_BADGE_DEFINITIONS.find((entry) => entry.id === "explorer-mark")); if (standingHigh) badges.push(PRESTIGE_BADGE_DEFINITIONS.find((entry) => entry.id === "standing-mark")); if (asRecord(player.worldEvents).lastParticipationAt) badges.push(PRESTIGE_BADGE_DEFINITIONS.find((entry) => entry.id === "event-mark")); if (asNumber(asRecord(player.counters).shadowActions, 0) > 0) badges.push(PRESTIGE_BADGE_DEFINITIONS.find((entry) => entry.id === "shadow-mark"));
  const existing = asRecord(player.prestige); const currentTitleId = titleIds.has(existing.currentTitleId) ? existing.currentTitleId : titles[titles.length - 1]?.id ?? "citizen"; const selected = titleById(currentTitleId);
  player.prestige = { currentTitleId, currentTitle: selected, titles, badges: badges.filter(Boolean), distinctions: [selected.label, ...badges.filter(Boolean).map((badge) => badge.label)].slice(0, 5), updatedAt: now };
  player.title = selected.label; return player.prestige;
}
export function setPrestigeTitle(runtimeState, titleId, now = Date.now()) { const prestige = resolvePrestigeState(runtimeState, now); const normalized = cleanId(titleId).replace(/_/g, "-"); if (!prestige.titles.some((title) => title.id === normalized)) return { ok: false, prestige, message: "That title is not unlocked yet." }; ensurePlayer(runtimeState).prestige.currentTitleId = normalized; return { ok: true, prestige: resolvePrestigeState(runtimeState, now), message: `Title set to ${titleById(normalized).label}.` }; }
function statusRank(status) { return { unknown: 0, locked: 0, rumored: 1, discovered: 2, explored: 3 }[status] ?? 0; }
function setHiddenSiteStatus(runtimeState, siteId, status, now, source) { const discovery = ensureWorldDiscovery(runtimeState); const current = asRecord(discovery.hiddenSites[siteId]); if (statusRank(current.status) >= statusRank(status)) return current; discovery.hiddenSites[siteId] = { ...current, status, source, updatedAt: now, firstRumoredAt: current.firstRumoredAt ?? (status === "rumored" ? now : null), discoveredAt: current.discoveredAt ?? (status === "discovered" || status === "explored" ? now : null), exploredAt: current.exploredAt ?? (status === "explored" ? now : null) }; return discovery.hiddenSites[siteId]; }
function addDiscoveryRecord(runtimeState, record) { const discovery = ensureWorldDiscovery(runtimeState); const id = record.id ?? cleanId(`${record.kind}_${record.title}`); discovery.discoveries = [{ ...record, id }, ...asArray(discovery.discoveries).filter((entry) => asRecord(entry).id !== id)].slice(0, 80); const education = asRecord(runtimeState.education); education.discoveries = [{ ...record, id }, ...asArray(education.discoveries).filter((entry) => asRecord(entry).id !== id)].slice(0, 80); runtimeState.education = education; }
function pickDiscoveryEventForRoute(route, runtimeState, now) {
  const routeTags = asArray(route?.encounterTags).map(String); const completed = completedSet(runtimeState); const viable = DISCOVERY_EVENT_POOL.filter((event) => !event.requiredCourses.length || event.requiredCourses.some((courseId) => completed.has(courseId))); const tagged = viable.filter((event) => event.tags.some((tag) => routeTags.includes(tag)) || event.siteIds.some((siteId) => HIDDEN_SITE_DEFINITIONS.find((site) => site.id === siteId)?.routeTags.some((tag) => routeTags.includes(tag)))); const list = tagged.length ? tagged : viable; return dayPick(list, `${route?.originCityId ?? route?.from}_${route?.destinationCityId ?? route?.to}`, now);
}
export function recordTravelDiscoveryFromEncounter(runtimeState, encounter, route = {}, now = Date.now()) {
  const baseDiscovery = encounter?.reward?.discovery; if (!baseDiscovery && !encounter?.hasWorldGeography) return null; const event = pickDiscoveryEventForRoute(route, runtimeState, now); if (!event) return null;
  const completed = completedSet(runtimeState); const siteId = event.siteIds[dayNumber(now) % event.siteIds.length]; const site = HIDDEN_SITE_DEFINITIONS.find((entry) => entry.id === siteId); const unlockCourseSatisfied = !event.requiredCourses.length || event.requiredCourses.some((courseId) => completed.has(courseId)); const nextStatus = unlockCourseSatisfied && (completed.has("historical-awareness") || completed.has("street-survival") || completed.has("applied-knowledge") || event.rarity === "common") ? "discovered" : "rumored";
  if (site) setHiddenSiteStatus(runtimeState, site.id, nextStatus, now, event.family); for (const item of asArray(event.rewards)) addInventory(runtimeState, item.itemId, item.quantity);
  const record = { id: `discovery_${event.id}_${siteId}`, kind: event.family, title: site?.name ?? event.family, summary: baseDiscovery ? `${baseDiscovery}. ${event.summary}` : event.summary, status: nextStatus, regionId: site?.regionId ?? null, siteId: site?.id ?? null, source: encounter?.title ?? "Travel discovery", foundAt: now, codexEntryId: site?.codexEntryId ?? null, rewards: event.rewards };
  addDiscoveryRecord(runtimeState, record); addPlayerRecord(runtimeState, { id: `record_${record.id}`, category: "discovery", summary: `${record.title}: ${nextStatus}.`, detail: record, source: "travel-discovery", route: "/world-map", timestamp: now }); addWorldAlert(runtimeState, { id: `discovery_alert_${record.id}`, kind: "discovery", label: `${record.title}: ${nextStatus}`, summary: record.summary, route: "/world-map", createdAt: now }); if (site) addLegacyEntry(runtimeState, { id: `discovery_${site.id}`, title: `Discovery: ${site.name}`, summary: site.summary, kind: "discovery", awardedAt: now }); return record;
}
export function getHiddenSiteAtlas(runtimeState, now = Date.now()) {
  const completed = completedSet(runtimeState); const records = asRecord(asRecord(ensurePlayer(runtimeState).worldDiscovery).hiddenSites);
  return HIDDEN_SITE_DEFINITIONS.map((site) => {
    const record = asRecord(records[site.id]); let status = typeof record.status === "string" ? record.status : "unknown";
    if (status === "unknown" && site.requiredCourses.some((courseId) => completed.has(courseId))) status = "rumored";
    if (status === "unknown" && site.cityIds.includes(normalizeCityId(asRecord(runtimeState.travel).currentCityId ?? asRecord(ensurePlayer(runtimeState).current).currentCityId, "nexis"))) status = "rumored";
    const missing = site.requiredCourses.filter((courseId) => !completed.has(courseId)); const lockReason = status === "unknown" && missing.length ? `Complete ${missing.map((courseId) => courseId.replace(/-/g, " ")).join(", ")} or find this site through travel.` : null;
    return { ...site, title: site.name, kind: "hidden_site", status, lockReason, summary: site.summary, updatedAt: record.updatedAt ?? null, codexEntryId: site.codexEntryId };
  });
}
export function getBoardDiscoveryNotices(runtimeState, cityId) {
  const city = normalizeCityId(cityId, "nexis");
  return asArray(asRecord(ensurePlayer(runtimeState).worldDiscovery).discoveries).filter((entry) => { const site = HIDDEN_SITE_DEFINITIONS.find((candidate) => candidate.id === asRecord(entry).siteId); return !site || site.cityIds.includes(city); }).slice(0, 3);
}
export function getCityLiveDigest(runtimeState, cityId, now = Date.now()) {
  const normalized = normalizeCityId(cityId, "nexis"); const rhythm = dayPick(CITY_RHYTHMS[normalized] ?? CITY_RHYTHMS.nexis, normalized, now); const threat = dayPick(CITY_THREAT_EVENTS[normalized] ?? CITY_THREAT_EVENTS.nexis, normalized, now, 1); const boss = WORLD_BOSS_EVENTS[normalized] ?? WORLD_BOSS_EVENTS.nexis; const demand = CITY_DEMAND_PROFILES[normalized] ?? CITY_DEMAND_PROFILES.nexis; return { rhythm, threat, boss, demand, generatedAt: now };
}
function addDerivedNotifications(runtimeState, now) {
  for (const ready of readyEntries(runtimeState, now)) addWorldAlert(runtimeState, { id: ready.id, kind: "ready", label: ready.label, route: ready.route, createdAt: now });
  const travel = asRecord(runtimeState.travel); if (asRecord(travel.arrivalNotice).arrivedAt) addWorldAlert(runtimeState, { id: `travel_arrival_${travel.arrivalNotice.arrivedAt}`, kind: "travel", label: `Arrived in ${travel.arrivalNotice.destinationName ?? "destination city"}`, route: "/travel", createdAt: asNumber(travel.arrivalNotice.arrivedAt, now) });
  const contracts = Object.values(asRecord(asRecord(ensurePlayer(runtimeState).cityContracts).records)).filter((record) => asRecord(record).status === "completed"); if (contracts.length) addWorldAlert(runtimeState, { id: "contract_claimable", kind: "contract", label: `${contracts.length} contract${contracts.length === 1 ? "" : "s"} ready to claim`, route: "/city#contracts", createdAt: now });
}
export function resolveLiveWorldForRuntimeState(runtimeState, user = null, now = Date.now()) {
  const before = JSON.stringify({ loops: runtimeState.player?.worldLoops, notifications: runtimeState.player?.notifications, shadow: runtimeState.player?.shadow, prestige: runtimeState.player?.prestige, worldDiscovery: runtimeState.player?.worldDiscovery, stats: runtimeState.player?.stats, gold: runtimeState.player?.gold, experience: runtimeState.player?.experience });
  const recovery = applyOfflineRecovery(runtimeState, now); applyDailyLogin(runtimeState, now); ensureShadowState(runtimeState, now); resolvePrestigeState(runtimeState, now); addDerivedNotifications(runtimeState, now);
  const loops = ensureWorldLoops(runtimeState); const cityId = normalizeCityId(asRecord(runtimeState.travel).currentCityId ?? asRecord(ensurePlayer(runtimeState).current).currentCityId, "nexis"); loops.cityRhythm = { currentCityId: cityId, ...getCityLiveDigest(runtimeState, cityId, now) };
  const returnSummary = buildReturnSummary(runtimeState, recovery.elapsedMs, recovery.recovered, now); if (returnSummary) loops.returnSummary = returnSummary;
  const after = JSON.stringify({ loops: runtimeState.player?.worldLoops, notifications: runtimeState.player?.notifications, shadow: runtimeState.player?.shadow, prestige: runtimeState.player?.prestige, worldDiscovery: runtimeState.player?.worldDiscovery, stats: runtimeState.player?.stats, gold: runtimeState.player?.gold, experience: runtimeState.player?.experience });
  return { changed: before !== after, returnSummary: loops.returnSummary ?? null };
}
export function getSerializedNotifications(runtimeState) { return asArray(asRecord(ensurePlayer(runtimeState).notifications).alerts).filter((entry) => !asRecord(entry).resolved).slice(0, 12); }
export function getCityDemandProfile(cityId) { return CITY_DEMAND_PROFILES[normalizeCityId(cityId, "nexis")] ?? CITY_DEMAND_PROFILES.nexis; }
export function serializeWorldBossForCity(cityId) { return WORLD_BOSS_EVENTS[normalizeCityId(cityId, "nexis")] ?? WORLD_BOSS_EVENTS.nexis; }
