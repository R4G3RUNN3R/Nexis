import { HttpError } from "../lib/errors.js";
import { withTransaction } from "../db/pool.js";
import { buildMutableRuntimeState } from "../lib/runtimePlayerState.js";
import { createDefaultPlayerState, findPlayerStateByUserInternalId } from "../repositories/playerStateRepository.js";
import { getCityDefinition, isValidCityId, normalizeCityId } from "../data/cityData.js";
import { getCityAcademies, getCityContracts } from "../data/cityLoopData.js";
import { getLegalTradeGoods } from "../data/cityEconomyData.js";
import { getCompletedCourseIds } from "./educationService.js";
import { getBoardDiscoveryNotices, getCityLiveDigest } from "./liveWorldService.js";
function asRecord(value) { return value && typeof value === "object" && !Array.isArray(value) ? value : {}; }
function asArray(value) { return Array.isArray(value) ? value : []; }
function currentCity(runtimeState) { const travel = asRecord(runtimeState.travel); const current = asRecord(runtimeState.player?.current); return normalizeCityId(travel.currentCityId ?? current.currentCityId ?? "nexis"); }
function lock(completed, courseId, label) { return completed.has(courseId) ? null : `Locked: complete ${label} to open this notice.`; }
function entry(section, input) { return { id: input.id, section, title: input.title, summary: input.summary, route: input.route ?? null, actionLabel: input.actionLabel ?? (input.route ? "Open desk" : "Notice only"), source: input.source ?? "city", locked: Boolean(input.lockReason), lockReason: input.lockReason ?? null, rewardLabel: input.rewardLabel ?? null, requirementLabel: input.requirementLabel ?? null }; }
function add(section, seen, item) { if (!seen.has(item.id)) { seen.add(item.id); section.push(item); } }
const CITY_LINES = {
  nexis: ["The Nexis City Gazette", "Civic filings, starter work, and public desk notices for citizens finding their footing."],
  west: ["The Blackharbor Tide Sheet", "Dock warnings, cargo leads, and the polite portion of port gossip."],
  north: ["The Silverbough Wardleaf", "Herb commissions, ward failures, relic rumors, and academy notices under the bough."],
  east: ["The Ironhall Foundry Ledger", "Forge orders, material shortages, road incidents, and workshop calls."],
  south: ["The Highcourt Public Register", "Petitions, seals, court errands, and notices written by people who own three pens."],
};
function standingFor(runtimeState, cityId) { const record = asRecord(asRecord(runtimeState.player?.cityStanding)[cityId]); return Math.max(0, Math.floor(Number(record.value ?? record.standing ?? 0) || 0)); }
function sectionForContract(contract, sections) { if (contract.combat?.opponentId) return [sections.bounties, "bounties"]; if (String(contract.type ?? "").toLowerCase().includes("civic")) return [sections.civicAppointments, "civicAppointments"]; return [sections.opportunities, "opportunities"]; }
function composeBoard(runtimeState, requestedCityId) {
  const cityId = normalizeCityId(requestedCityId || currentCity(runtimeState));
  if (!cityId || !isValidCityId(cityId)) throw new HttpError(400, "City unavailable.", "CITY_INVALID");
  const city = getCityDefinition(cityId);
  const lines = CITY_LINES[cityId] ?? CITY_LINES.nexis;
  const completed = new Set(getCompletedCourseIds(runtimeState));
  const standing = standingFor(runtimeState, cityId);
  const contracts = getCityContracts(cityId);
  const academies = getCityAcademies(cityId);
  const tradeGoods = getLegalTradeGoods().filter((good) => good.sourceCityId === cityId).slice(0, 3);
  const live = getCityLiveDigest(runtimeState, cityId);
  const discoveryNotices = getBoardDiscoveryNotices(runtimeState, cityId);
  const sections = { civicAppointments: [], opportunities: [], bounties: [], publicNotices: [], classifieds: [] };
  const seen = new Set();
  const leadCandidates = [
    live.threat ? entry("frontPage", { id: `front_threat_${live.threat.id}`, title: live.threat.title, summary: live.threat.summary, route: live.threat.affects?.includes("bounties") ? "/city#contracts" : "/city-board", actionLabel: live.threat.affects?.includes("bounties") ? "Read bounties" : "Read notice", rewardLabel: live.threat.severity ? `Severity: ${live.threat.severity}` : null, source: "city_event" }) : null,
    live.rhythm ? entry("frontPage", { id: `front_rhythm_${live.rhythm.id}`, title: live.rhythm.title, summary: live.rhythm.summary, route: "/city-board", actionLabel: "Read bulletin", source: "city_rhythm" }) : null,
    live.boss ? entry("frontPage", { id: `front_boss_${live.boss.id}`, title: live.boss.name, summary: live.boss.summary, route: live.boss.participationPath, actionLabel: "View path", rewardLabel: live.boss.rewardLabel, source: "world_boss" }) : null,
    contracts[0] ? entry("frontPage", { id: `front_${contracts[0].id}`, title: contracts[0].title, summary: contracts[0].summary, route: "/city#contracts", actionLabel: "Read contract", rewardLabel: contracts[0].reward?.gold ? `${contracts[0].reward.gold} gold` : "Local standing", requirementLabel: contracts[0].minimumStanding ? `${contracts[0].minimumStanding} standing` : "Open board", source: "local_contract" }) : null,
  ].filter(Boolean);
  const front = leadCandidates.length ? leadCandidates[(Math.floor(Date.now() / 86400000) + standing) % leadCandidates.length] : entry("frontPage", { id: `front_${cityId}_desk`, title: `${city.name} Desk Opens`, summary: "The local desk is accepting verified civic notices and paid leads.", route: "/city" });
  for (const contract of contracts) {
    const [target, sectionName] = sectionForContract(contract, sections);
    add(target, seen, entry(sectionName, { id: `contract_${contract.id}`, title: contract.title, summary: contract.summary, route: "/city#contracts", actionLabel: "Open contract", rewardLabel: contract.reward?.gold ? `${contract.reward.gold} gold` : "Local reward", requirementLabel: contract.requirementLabel ?? (contract.minimumStanding ? `${contract.minimumStanding} standing` : "Local availability"), lockReason: standing < (contract.minimumStanding ?? 0) ? `Locked: requires ${contract.minimumStanding} ${city.name} standing.` : null, source: "local_contract" }));
  }
  add(sections.civicAppointments, seen, entry("civicAppointments", { id: `${cityId}_civic_jobs`, title: cityId === "nexis" ? "Registry seeks steady hands" : `${city.name} office accepts auxiliary hands`, summary: cityId === "nexis" ? "Clerks need runners for permit counters, archive errands, and lawful starter work." : "The city office has lawful work for citizens with the right footing.", route: "/civic-jobs", actionLabel: "Open civic jobs", requirementLabel: "Basic Literacy helps most posts", lockReason: lock(completed, "basic-literacy", "Basic Literacy"), source: "civic_jobs" }));
  for (const academy of academies.slice(0, 2)) { const required = asArray(academy.requiredCourses ?? academy.stages?.[0]?.requiredCourses); const missing = required.find((courseId) => !completed.has(courseId)); add(sections.publicNotices, seen, entry("publicNotices", { id: `academy_${academy.id}`, title: `${academy.name} posts intake notice`, summary: academy.theme, route: "/city#academy", actionLabel: "View academy", requirementLabel: required.length ? required.join(", ") : "Local standing may apply", lockReason: missing ? `Locked: complete ${missing.replace(/-/g, " ")} to study here.` : null, source: "academy" })); }
  for (const good of tradeGoods) { const missing = asArray(good.requiredCourses).find((courseId) => !completed.has(courseId)); add(sections.publicNotices, seen, entry("publicNotices", { id: `market_${cityId}_${good.itemId}`, title: `${city.name} market quotes ${good.category}`, summary: good.note, route: "/market", actionLabel: "Open market", requirementLabel: good.requiredCourses?.length ? `Requires ${good.requiredCourses.join(", ")}` : "Open trade notice", lockReason: missing ? `Locked: complete ${missing.replace(/-/g, " ")} to use this trade lead.` : null, source: "market" })); }
  if (live.rhythm) add(sections.publicNotices, seen, entry("publicNotices", { id: `rhythm_${live.rhythm.id}`, title: live.rhythm.title, summary: live.rhythm.summary, route: "/city-board", actionLabel: "Notice only", source: "city_rhythm" }));
  if (live.threat) add(live.threat.affects?.includes("bounties") ? sections.bounties : sections.publicNotices, seen, entry(live.threat.affects?.includes("bounties") ? "bounties" : "publicNotices", { id: `threat_${live.threat.id}`, title: live.threat.title, summary: live.threat.summary, route: live.threat.affects?.includes("bounties") ? "/city#contracts" : "/city-board", actionLabel: live.threat.affects?.includes("bounties") ? "Open bounties" : "Notice only", requirementLabel: live.threat.severity ? `Severity: ${live.threat.severity}` : null, source: "city_event" }));
  if (live.boss) add(sections.bounties, seen, entry("bounties", { id: `boss_${live.boss.id}`, title: live.boss.name, summary: live.boss.summary, route: live.boss.participationPath, actionLabel: "View path", rewardLabel: live.boss.rewardLabel, requirementLabel: `State: ${live.boss.status}`, source: "world_boss" }));
  add(sections.publicNotices, seen, entry("publicNotices", { id: `demand_${cityId}`, title: `${city.name} demand: ${live.demand.tags.slice(0, 3).join(", ")}`, summary: live.demand.headline, route: "/market", actionLabel: "Open market", requirementLabel: live.demand.shortages.join(", "), source: "market_demand" }));
  for (const notice of discoveryNotices) add(sections.publicNotices, seen, entry("publicNotices", { id: `discovery_notice_${asRecord(notice).id}`, title: asRecord(notice).title ?? "Discovery notice", summary: asRecord(notice).summary ?? "A travel discovery has entered local circulation.", route: "/world-map", actionLabel: "Open atlas", requirementLabel: asRecord(notice).status ?? null, source: "discovery" }));
  add(sections.classifieds, seen, entry("classifieds", { id: `${cityId}_housing`, title: `${city.name} room leads and property notes`, summary: cityId === "nexis" ? "Starter rooms, basic leases, and public lodging notices are filed at the housing desk." : "Local room lets and property leads are posted for travelers with enough coin and patience.", route: "/housing", actionLabel: "Open housing", source: "housing" }));
  add(sections.classifieds, seen, entry("classifieds", { id: `${cityId}_marketplace`, title: "Player trade board accepts fixed-price listings", summary: "Citizens can list carried goods for other players; city demand decides what looks tempting.", route: "/market", actionLabel: "Open marketplace", source: "marketplace" }));
  if (cityId === "west") add(sections.publicNotices, seen, entry("publicNotices", { id: "west_under_market", title: "Dock whispers mention under-market cargo", summary: "Some cargo does not reach the official ledger. Street Survival and Shadow decide whether the rumor is useful or just bait.", route: "/black-market", actionLabel: "Check under-market", requirementLabel: "Street Survival + Shadow", lockReason: lock(completed, "street-survival", "Street Survival"), source: "black_market" }));
  return { city: { id: city.id, name: city.name, role: city.role }, masthead: { title: lines[0], edition: `Vol. ${Math.max(1, standing + 1)} | ${city.name} Edition`, editorial: lines[1] }, frontPage: front, sections, generatedAt: Date.now() };
}
export async function getCityBoardForUser(user, cityId) { return withTransaction(async (client) => { await createDefaultPlayerState(client, user.internalId); const playerState = await findPlayerStateByUserInternalId(client, user.internalId); if (!playerState) throw new HttpError(404, "Player state unavailable.", "PLAYER_STATE_NOT_FOUND"); const runtimeState = buildMutableRuntimeState(user, playerState); return { playerState, board: composeBoard(runtimeState, cityId) }; }); }
