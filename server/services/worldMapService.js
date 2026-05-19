import { withTransaction } from "../db/pool.js";
import { HttpError } from "../lib/errors.js";
import { buildMutableRuntimeState } from "../lib/runtimePlayerState.js";
import { createDefaultPlayerState, findPlayerStateByUserInternalId } from "../repositories/playerStateRepository.js";
import { getCityDefinition, normalizeCityId } from "../data/cityData.js";
import { getCompletedCourseIds } from "./educationService.js";
function asRecord(value) { return value && typeof value === "object" && !Array.isArray(value) ? value : {}; }
function asArray(value) { return Array.isArray(value) ? value : []; }
const ATLAS_CITIES = [
  ["nexis", "central_crown", "starter_capital", "Starter capital, civic baseline, safe services, and the first stable ledger of the realm."],
  ["west", "western_coast", "port_city", "Blackharbor anchors maritime trade, imported potions, cargo disputes, and louder-than-legal dock work."],
  ["north", "northern_bough", "arcane_city", "Silverbough gathers herbs, wards, relic study, and healing commissions under old trees."],
  ["east", "eastern_forges", "forge_city", "Ironhall turns ore, labor, repairs, and enginework into heavy civic value."],
  ["south", "southern_court", "court_city", "Highcourt runs law, prestige, writs, permits, and polished forms of pressure."],
].map(([id, regionId, kind, summary]) => ({ id, regionId, kind, summary }));
const REGIONS = [
  ["central_crown", "Central Crown", "The civic heart around Nexis City.", null],
  ["western_coast", "Western Coast", "Port lanes, foreign cargo, and Blackharbor pressure.", "world-geography"],
  ["northern_bough", "Northern Bough", "Warded roads, herbal paths, and Silverbough relic whispers.", "world-geography"],
  ["eastern_forges", "Eastern Forges", "Forge roads, material convoys, and Ironhall industrial routes.", "world-geography"],
  ["southern_court", "Southern Court", "Permit roads, legal cargo, and Highcourt statecraft.", "world-geography"],
  ["hellenic_sphere", "Hellenic Sphere", "A rumored bloc of poleis, sanctuaries, straits, and scholarly-martial city-states.", "historical-awareness"],
].map(([id, name, summary, requiredCourse]) => ({ id, name, summary, requiredCourse }));
function currentCity(runtimeState) { const travel = asRecord(runtimeState.travel); const current = asRecord(runtimeState.player?.current); return normalizeCityId(travel.currentCityId ?? current.currentCityId ?? "nexis"); }
function lockReason(courseId) { if (!courseId) return null; const label = courseId === "world-geography" ? "World Geography" : courseId === "historical-awareness" ? "Historical Awareness" : courseId.replace(/-/g, " "); return `Complete ${label} to expand this atlas entry.`; }
function buildAtlas(runtimeState) {
  const education = asRecord(runtimeState.education);
  const completed = new Set(getCompletedCourseIds(runtimeState));
  const discoveries = asArray(education.discoveries);
  const currentCityId = currentCity(runtimeState);
  const hasWorldGeography = completed.has("world-geography");
  const hasHistoricalAwareness = completed.has("historical-awareness");
  const regions = REGIONS.map((region) => {
    let status = !region.requiredCourse || completed.has(region.requiredCourse) ? "discovered" : "locked";
    if (status === "locked" && region.requiredCourse === "historical-awareness" && hasWorldGeography) status = "rumored";
    if (discoveries.some((entry) => String(asRecord(entry).regionId ?? "") === region.id)) status = "rumored";
    return { ...region, status, lockReason: status === "locked" ? lockReason(region.requiredCourse) : null };
  });
  const cities = ATLAS_CITIES.map((city) => { const def = getCityDefinition(city.id); const region = regions.find((entry) => entry.id === city.regionId); const discovered = city.id === "nexis" || city.id === currentCityId || region?.status === "discovered" || hasWorldGeography; return { ...city, name: def.name, role: def.role, status: discovered ? "discovered" : region?.status === "rumored" ? "rumored" : "locked", lockReason: discovered ? null : "Complete World Geography or discover this city through travel to reveal full atlas notes.", current: city.id === currentCityId }; });
  const hiddenSites = [
    { id: "west_tide_cache", title: "Marked Tide Cache", regionId: "western_coast", status: hasWorldGeography ? "rumored" : "unknown", lockReason: hasWorldGeography ? null : "World Geography reveals route caches." },
    { id: "north_ward_ruin", title: "Warded Root-Ruin", regionId: "northern_bough", status: hasHistoricalAwareness ? "rumored" : "locked", lockReason: hasHistoricalAwareness ? null : "Historical Awareness reveals relic-heavy sites." },
    { id: "east_convoy_pullout", title: "Forge-Road Pullout", regionId: "eastern_forges", status: hasWorldGeography ? "rumored" : "unknown", lockReason: hasWorldGeography ? null : "World Geography reveals practical route notes." },
    { id: "south_permit_detour", title: "Permit Clerk Detour", regionId: "southern_court", status: hasWorldGeography ? "rumored" : "unknown", lockReason: hasWorldGeography ? null : "World Geography reveals court-road detours." },
  ];
  return { currentCityId, education: { hasWorldGeography, hasHistoricalAwareness, worldGeographyMessage: hasWorldGeography ? "World Geography is expanding safe route and discovery readings." : "World Geography is incomplete: travel discoveries remain limited and many atlas entries stay locked or vague.", historicalAwarenessMessage: hasHistoricalAwareness ? "Historical Awareness is improving ruin, relic, and lore interpretation." : "Historical Awareness is incomplete: ruin and relic entries remain mostly rumor." }, regions, cities, hiddenSites, discoveries: discoveries.slice(0, 24), generatedAt: Date.now() };
}
export async function getWorldAtlasForUser(user) { return withTransaction(async (client) => { await createDefaultPlayerState(client, user.internalId); const playerState = await findPlayerStateByUserInternalId(client, user.internalId); if (!playerState) throw new HttpError(404, "Player state unavailable.", "PLAYER_STATE_NOT_FOUND"); return { playerState, atlas: buildAtlas(buildMutableRuntimeState(user, playerState)) }; }); }
