import crypto from "node:crypto";
import { PLAYER_PUBLIC_ID_BASE, RESERVED_PLAYER_PUBLIC_ID_COUNT } from "../config/env.js";
import { withTransaction } from "../db/pool.js";
import { HttpError } from "../lib/errors.js";
import { buildMutableRuntimeState } from "../lib/runtimePlayerState.js";
import {
  addOrganizationMember,
  createOrganization,
  findOrganizationByInternalId,
  findOrganizationByPublicId,
  findOrganizationForUserByType,
  insertOrganizationLog,
  listOrganizationsByType,
  removeOrganizationMember,
  replaceOrganizationRoles,
  updateOrganizationDetails,
} from "../repositories/organizationRepository.js";
import { createDefaultPlayerState, findPlayerStateByUserInternalId, upsertPlayerRuntimeState } from "../repositories/playerStateRepository.js";
import { allocateNextPublicNumericId } from "../repositories/publicIdAllocatorRepository.js";
import { findUserByPublicId } from "../repositories/usersRepository.js";
import {
  chooseRandomReward,
  deriveConsortiumStarsFromPerformance,
  getActiveRewards,
  getConsortiumPositionDefinition,
  getConsortiumTypeDefinition,
  getDailyConsortiumPointsForStars,
  getRewardByKey,
  getUnlockedPassives,
  listConsortiumPositions,
  listConsortiumTypes,
} from "../data/consortiumTypes.js";
import { getOrganizationBaseEffectsForOrg } from "./organizationBaseEffectService.js";
import { getCompletedCourseIds } from "./educationService.js";

// Education hard-gate: mirrors the hasCompletedCourse(runtimeState, courseId) helper used by
// travelService.js (world-geography -> travel), built on the shared getCompletedCourseIds export
// from educationService.js (also used by worldMapService.js/cityBoardService.js/liveWorldService.js)
// so completion is read from the single normalized education state rather than re-derived here.
function hasCompletedCourse(runtimeState, courseId) {
  return getCompletedCourseIds(runtimeState).includes(courseId);
}

const FIRST_ORGANIZATION_PUBLIC_ID = PLAYER_PUBLIC_ID_BASE + RESERVED_PLAYER_PUBLIC_ID_COUNT;
const normalizeOrganizationPublicId = (value, type = null) => {
  const raw = String(value ?? "").trim();
  const match = raw.match(/^([GC])?(\d+)$/i);
  const prefix = match?.[1] ? match[1].toUpperCase() : null;
  const numeric = Number(match ? match[2] : raw);
  if (!Number.isFinite(numeric) || numeric < FIRST_ORGANIZATION_PUBLIC_ID) throw new HttpError(400, "Organization public ID is invalid.", "ORG_PUBLIC_ID_INVALID");
  if ((prefix === "G" && type === "consortium") || (prefix === "C" && type === "guild")) throw new HttpError(404, "Organization record unavailable.", "ORG_NOT_FOUND");
  return numeric;
};
const getFirstOrganizationPublicId = (type) =>
  FIRST_ORGANIZATION_PUBLIC_ID + (type === "consortium" ? 1 : 0);
const MS_HOUR = 60 * 60 * 1000;
const HEALTH_METRICS = {
  popularity: { label: "Popularity", meaning: "Recruitment pull, public reputation, and outside demand." },
  efficiency: { label: "Efficiency", meaning: "Operational throughput, coordination, and output discipline." },
  environment: { label: "Environment", meaning: "Morale, safety, and working conditions inside the company." },
};

const baseWorkingStats = { manualLabor: 10, intelligence: 10, endurance: 10 };
const asRecord = (v) => (v && typeof v === "object" && !Array.isArray(v) ? v : {});
const clamp = (v, min = 0, max = 100) => Math.max(min, Math.min(max, Number(v) || 0));
const asInt = (v, fallback = 0) => (Number.isFinite(Number(v)) ? Math.max(0, Math.floor(Number(v))) : fallback);
const round1 = (v) => Math.round((Number(v) || 0) * 10) / 10;
const titleCase = (value) => String(value ?? "").split(/\s+/).filter(Boolean).map((word) => word.charAt(0).toUpperCase() + word.slice(1)).join(" ");
const founderDisplayName = (user) => `${user.firstName}${user.lastName ? ` ${user.lastName}` : ""}`.trim();
const normalizeName = (value, label) => { const trimmed = String(value ?? "").trim(); if (trimmed.length < 3) throw new HttpError(400, `${label} must be at least 3 characters.`, "ORG_NAME_TOO_SHORT"); return trimmed; };
const normalizeTag = (value) => { const trimmed = String(value ?? "").trim().toUpperCase(); if (trimmed.length < 2) throw new HttpError(400, "Tag must be at least 2 characters.", "ORG_TAG_TOO_SHORT"); return trimmed.slice(0, 6); };
const normalizePublicId = (value) => { const match = /^P?(\d{7})$/i.exec(String(value ?? "").trim()); if (!match) throw new HttpError(400, "A valid player public ID is required.", "PLAYER_ID_REQUIRED"); return Number.parseInt(match[1], 10); };
const normalizeTreasury = (value) => { const treasury = asRecord(value); return { copper: asInt(treasury.copper), silver: asInt(treasury.silver), gold: asInt(treasury.gold), platinum: asInt(treasury.platinum) }; };
const getGuildFoundationCost = (runtimeState) => Number(runtimeState.player.inventory.guild_charter ?? 0) > 0 ? 50000 : 150000;
const getConsortiumFoundationCost = (runtimeState, template) => Number(runtimeState.player.inventory.consortium_writ ?? 0) > 0 ? Math.max(75000, template.creationCost - 75000) : template.creationCost;
const buildGuildRoles = () => [
  { roleKey: "guildmaster", displayName: "Guildmaster", rankOrder: 1, permissions: ["manage_members", "manage_treasury", "declare_operations", "recruit_members", "view_logs", "participate"], isSystemRole: true },
  { roleKey: "officer", displayName: "Officer", rankOrder: 2, permissions: ["recruit_members", "view_logs", "manage_treasury", "participate"], isSystemRole: true },
  { roleKey: "member", displayName: "Member", rankOrder: 3, permissions: ["participate"], isSystemRole: true },
];
const buildConsortiumRoles = (template) => [
  { roleKey: "director", displayName: "Director", rankOrder: 1, permissions: ["manage_members", "manage_treasury", "manage_contracts", "recruit_members", "view_logs", "participate"], isSystemRole: true },
  { roleKey: "specialist", displayName: titleCase(template.rolesFlavor[1] ?? "Specialist"), rankOrder: 2, permissions: ["recruit_members", "view_logs", "participate"], isSystemRole: true },
  { roleKey: "employee", displayName: titleCase(template.rolesFlavor[2] ?? "Employee"), rankOrder: 3, permissions: ["participate"], isSystemRole: true },
];
const ensureMember = (organization, userInternalId) => { const member = organization.members.find((entry) => entry.userInternalId === userInternalId); if (!member) throw new HttpError(403, "You are not part of this organization.", `${String(organization.type ?? "organization").toUpperCase()}_MEMBERSHIP_REQUIRED`); return member; };
const ensurePermission = (organization, member, permission) => { const role = organization.roles.find((entry) => entry.roleKey === member.roleKey); if (!role || !role.permissions.includes(permission)) throw new HttpError(403, "You do not have permission for that organization action.", `${String(organization.type ?? "organization").toUpperCase()}_PERMISSION_DENIED`); };
const getRuntimeForUser = async (client, user) => { await createDefaultPlayerState(client, user.internalId); const playerState = await findPlayerStateByUserInternalId(client, user.internalId); if (!playerState) throw new HttpError(404, "Player state unavailable.", "PLAYER_STATE_NOT_FOUND"); return { playerState, runtimeState: buildMutableRuntimeState(user, playerState) }; };
const sameUtcDay = (left, right) => { if (!left || !right) return false; const l = new Date(left); const r = new Date(right); return l.getUTCFullYear() === r.getUTCFullYear() && l.getUTCMonth() === r.getUTCMonth() && l.getUTCDate() === r.getUTCDate(); };
const buildPassiveSummary = (template) => template.rewards.filter((entry) => entry.mode === "passive").map((entry) => entry.displayName).join(", ");
const getConsortiumStore = (runtimeState) => { const consortiumStore = asRecord(runtimeState.consortium); return { ...consortiumStore, progressByType: asRecord(consortiumStore.progressByType), activeEffectsByType: asRecord(consortiumStore.activeEffectsByType), membership: asRecord(consortiumStore.membership) }; };
const getProgressEntry = (runtimeState, consortiumTypeKey, organizationInternalId) => { const existing = asRecord(getConsortiumStore(runtimeState).progressByType[consortiumTypeKey]); return { consortiumTypeKey, organizationInternalId: typeof existing.organizationInternalId === "string" && existing.organizationInternalId ? existing.organizationInternalId : organizationInternalId, points: asInt(existing.points), totalEarned: asInt(existing.totalEarned), totalSpent: asInt(existing.totalSpent), lastClaimedAt: typeof existing.lastClaimedAt === "number" ? existing.lastClaimedAt : null }; };
const setProgressEntry = (runtimeState, consortiumTypeKey, entry) => { const store = getConsortiumStore(runtimeState); runtimeState.consortium = { ...store, progressByType: { ...store.progressByType, [consortiumTypeKey]: { consortiumTypeKey, organizationInternalId: entry.organizationInternalId, points: entry.points, totalEarned: entry.totalEarned, totalSpent: entry.totalSpent, lastClaimedAt: entry.lastClaimedAt } } }; };
const appendActiveEffect = (runtimeState, consortiumTypeKey, effect) => { const store = getConsortiumStore(runtimeState); const existing = Array.isArray(store.activeEffectsByType[consortiumTypeKey]) ? store.activeEffectsByType[consortiumTypeKey] : []; runtimeState.consortium = { ...store, activeEffectsByType: { ...store.activeEffectsByType, [consortiumTypeKey]: [effect, ...existing].slice(0, 10) } }; };
const syncMembershipSummary = (runtimeState, organization, template, stars, memberRoleKey) => { const store = getConsortiumStore(runtimeState); runtimeState.consortium = { ...store, membership: { organizationInternalId: organization.internalId, publicId: organization.publicId, name: organization.name, consortiumTypeKey: template.key, consortiumTypeName: template.displayName, starRating: stars, roleKey: memberRoleKey, treasury: normalizeTreasury(organization.treasury) } }; };
const clearMembershipSummary = (runtimeState) => { const store = getConsortiumStore(runtimeState); runtimeState.consortium = { ...store, membership: null }; };
const sanitizeApplicationNote = (value) => String(value ?? "").trim().slice(0, 140);
const normalizeWorkingStats = (value) => ({ manualLabor: Number(asRecord(value).manualLabor ?? baseWorkingStats.manualLabor), intelligence: Number(asRecord(value).intelligence ?? baseWorkingStats.intelligence), endurance: Number(asRecord(value).endurance ?? baseWorkingStats.endurance) });
const scorePosition = (position, workingStats) => round1((workingStats.manualLabor * position.statWeights.manualLabor) + (workingStats.intelligence * position.statWeights.intelligence) + (workingStats.endurance * position.statWeights.endurance));
const BUSINESS_STUDIES_COURSES = ["practical-arithmetic", "civic-fundamentals", "ledger-basics", "supply-discipline", "caravan-operations", "merchant-command"];
const ADVENTURING_SURVIVAL_COURSES = ["field-survival", "drill-square-basics", "weapon-conditioning", "march-survival", "battlefield-reading"];
const readCompletedEducationCourses = (playerState) => {
  const educationState = asRecord(asRecord(playerState?.runtimeState).education);
  if (!Array.isArray(educationState.completedCourses)) return [];
  return Array.from(new Set(educationState.completedCourses.filter((entry) => typeof entry === "string" && entry.trim())));
};
const computeTrackProgress = (completedCourses, requiredCourses) => {
  const completedSet = new Set(completedCourses);
  const completed = requiredCourses.filter((courseId) => completedSet.has(courseId)).length;
  const total = requiredCourses.length;
  const completionPct = total ? round1((completed / total) * 100) : 0;
  return { completed, total, completionPct };
};
const deriveAcademyProfile = (playerState) => {
  const completedCourses = readCompletedEducationCourses(playerState);
  const business = computeTrackProgress(completedCourses, BUSINESS_STUDIES_COURSES);
  const adventuring = computeTrackProgress(completedCourses, ADVENTURING_SURVIVAL_COURSES);
  return {
    source: "education",
    businessStudies: {
      completedCourses: business.completed,
      totalCourses: business.total,
      trackCompletionPct: business.completionPct,
      consortiumYieldPct: round1(Math.min(14, (business.completed * 2) + (business.completed === business.total && business.total > 0 ? 2 : 0))),
      workerEfficiencyPct: round1(Math.min(18, business.completed * 2.4)),
      treasuryEfficiencyPct: round1(Math.min(10, business.completed * 1.5)),
      routePerformancePct: round1(Math.min(12, business.completed * 1.8)),
    },
    adventuringSurvival: {
      completedCourses: adventuring.completed,
      totalCourses: adventuring.total,
      trackCompletionPct: adventuring.completionPct,
      guildReadinessPct: round1(Math.min(10, adventuring.completed * 1.8)),
      operationSurvivalPct: round1(Math.min(12, adventuring.completed * 2.2)),
      battleEdgePct: round1(Math.min(6, adventuring.completed * 1.1)),
    },
  };
};
const normalizeManagement = (organization, template) => {
  const metadata = asRecord(organization.metadata);
  const management = asRecord(metadata.management);
  return {
    ...metadata,
    companyStyle: true,
    rewardTiers: template.rewards.map((entry) => entry.starTier),
    rolesFlavor: template.rolesFlavor,
    management: {
      positions: asRecord(management.positions),
      applications: Array.isArray(management.applications) ? management.applications.map((entry) => ({ ...asRecord(entry), workingStats: normalizeWorkingStats(asRecord(entry).workingStats) })) : [],
      outreach: { level: clamp(asRecord(management.outreach).level, 0, 6), campaignsLaunched: asInt(asRecord(management.outreach).campaignsLaunched), lastRunAt: typeof asRecord(management.outreach).lastRunAt === "number" ? asRecord(management.outreach).lastRunAt : null },
      health: asRecord(management.health),
      performance: asRecord(management.performance),
    },
  };
};
// Guild skill tree v2 ("Charter Doctrine"): a small fixed CORE every guild gets for free (no
// purchase, no swapping, granted the moment a guild is founded), plus a wider pool of named
// SPECIALIZATIONS a guild can invest reputation-derived skill points into. Only GUILD_SPECIALIZATION_CAP
// of those specializations can be active at once -- see buildGuildState()/unlockGuildSkillForUser()/
// swapGuildSkillForUser() for how the cap and the gold-priced respec are enforced.
const GUILD_CORE_SKILLS = [
  { key: "chartered_discipline", displayName: "Chartered Discipline", effectType: "passive", effectSummary: "+5% reputation from every guild source.", memberBenefit: "Every charter signed at founding carries this clause: the guild earns 5% more reputation from quests, dungeon delves, and recruiting, no points spent and nothing to swap out.", effectValue: 0.05 },
  { key: "standing_muster", displayName: "Standing Muster", effectType: "passive", effectSummary: "+5 flat readiness and operation success on every guild action.", memberBenefit: "Baseline command structure every founded guild starts with: a flat readiness boost and a small success bump on guild quests and dungeon delves, so a brand-new guild isn't rolling from zero.", effectValue: 5 },
];
const GUILD_SPECIALIZATION_CAP = 3;
const GUILD_SKILL_RESPEC_GOLD_COST = 5000;
const GUILD_RALLY_GOLD_COST = 1500;
const GUILD_RALLY_COOLDOWN_MS = 8 * MS_HOUR;
const GUILD_RALLY_WINDOW_MS = 4 * MS_HOUR;
const GUILD_SPECIALIZATIONS = [
  { key: "vault_discipline", branch: "armory", branchLabel: "Armory", displayName: "Vault Discipline", pointCost: 2, effectType: "passive", effectSummary: "+20% quantity credited on armory deposits.", memberBenefit: "Members who deposit spare gear into the guild armory see 20% more quantity credited to the vault than what they handed over -- donating to the guild stops being a straight loss.", effectValue: 0.20 },
  { key: "strike_cadence", branch: "chaining", branchLabel: "Chaining", displayName: "Strike Cadence", pointCost: 3, effectType: "active", effectSummary: "Leader-triggered: +15% success on the next guild quest or dungeon delve.", memberBenefit: "A guildmaster or officer can call a Strike Cadence before an operation, funded by the treasury and gated on a cooldown -- the whole crew gets +15% success on the very next guild quest or dungeon delve, rewarding coordinated timing over solo luck.", effectValue: 0.15 },
  { key: "delve_mastery", branch: "expedition", branchLabel: "Expedition", displayName: "Delve Mastery", pointCost: 3, effectType: "passive", effectSummary: "+12% success rating on quests/dungeons, +8% member gold on success.", memberBenefit: "Sharpens every expedition the guild runs: +12% success rating on guild quests and dungeon delves, plus +8% personal gold for members on a successful run.", effectValue: 0.12, secondaryEffectValue: 0.08 },
  { key: "bastion_wardwork", branch: "fortification", branchLabel: "Fortification", displayName: "Bastion Wardwork", pointCost: 2, effectType: "passive", effectSummary: "Failed operations keep 65% of their payout instead of the usual reduced cut.", memberBenefit: "Softens a bad roll: when a guild quest or dungeon delve fails, the crew still keeps 65% of the reputation and gold payout instead of the usual steep cut, so one rough night doesn't wreck the guild's week.", effectValue: 0.65 },
  { key: "open_roster_accord", branch: "recruitment", branchLabel: "Recruitment", displayName: "Open Roster Accord", pointCost: 2, effectType: "passive", effectSummary: "+75% reputation from recruiting a new member.", memberBenefit: "Every new member the guild recruits brings in 75% more reputation than usual, rewarding guilds that actively grow their roster instead of sitting on a fixed crew.", effectValue: 0.75 },
  { key: "trade_concord", branch: "territory", branchLabel: "Territory", displayName: "Trade Concord", pointCost: 3, effectType: "passive", effectSummary: "+8% reputation from every guild source -- a passive economic footprint, not a claim to defend.", memberBenefit: "Represents the guild's peaceful trade footprint across Nexis' territories: a standing economic presence that adds +8% to all guild reputation gains (quests, dungeons, and recruiting alike) as steady goodwill income. No war, no holding, no upkeep to defend -- just quiet regional pull.", effectValue: 0.08 },
  { key: "field_medic_corps", branch: "medical", branchLabel: "Medical", displayName: "Field Medic Corps", pointCost: 2, effectType: "passive", effectSummary: "Cuts remaining hospital time by 25% for members after a guild operation.", memberBenefit: "Any guild member who is hospitalized when a guild quest or dungeon delve resolves gets 25% of their remaining recovery time cut automatically, the same field-treatment support consortiums already extend to their own people.", effectValue: 0.25 },
  { key: "reclaimers_eye", branch: "looting", branchLabel: "Looting", displayName: "Reclaimer's Eye", pointCost: 2, effectType: "passive", effectSummary: "+20% treasury and member gold from successful operations.", memberBenefit: "The guild simply walks away with more of what it finds: +20% treasury gold and personal member gold from every successful guild quest and dungeon delve.", effectValue: 0.20 },
  { key: "drillyard_regimen", branch: "training", branchLabel: "Training", displayName: "Drillyard Regimen", pointCost: 3, effectType: "passive", effectSummary: "+25% effect from members' Adventuring & Survival academy bonuses.", memberBenefit: "Amplifies what members already learn at the Academies: readiness, operation-survival, and battle-edge bonuses from completed Adventuring & Survival coursework are boosted by 25%, so an educated roster pulls even more weight for the guild.", effectValue: 0.25 },
  { key: "accord_brokerage", branch: "diplomacy", branchLabel: "Diplomacy", displayName: "Accord Brokerage", pointCost: 2, effectType: "passive", effectSummary: "Guild-to-consortium assistance work unlocks 20% earlier.", memberBenefit: "Smooths guild-to-consortium relations: the reputation thresholds for offering assistance work to consortiums drop by 20%, so younger guilds get access to higher-tier collaborative contracts sooner.", effectValue: 0.20 },
];
const findGuildSpecialization = (key) => GUILD_SPECIALIZATIONS.find((entry) => entry.key === key) ?? null;
const GUILD_DUNGEONS = [
  { key: "ember_catacombs", displayName: "Ember Catacombs", summary: "A starter delve through scorched burial halls and half-mad sentries.", minMembers: 1, recommendedPower: 20, reputationReward: 70, goldReward: 800, cooldownHours: 6 },
  { key: "drowned_archive", displayName: "Drowned Archive", summary: "Recover relic ledgers and forbidden scraps before the water does.", minMembers: 2, recommendedPower: 45, reputationReward: 110, goldReward: 1400, cooldownHours: 10 },
  { key: "glass_throne", displayName: "Glass Throne", summary: "A prestige strike into a lethal hall of mirrors, wardens, and arrogance.", minMembers: 3, recommendedPower: 80, reputationReward: 180, goldReward: 2400, cooldownHours: 14 },
];
const GUILD_QUESTS = [
  { key: "grave_salt_run", displayName: "Grave Salt Run", summary: "Recover sanctified salt caches from the old grave line before the dead notice the accounting error.", planningHours: 24, requiredMembers: 2, slots: [{ slotKey: "lead", label: "Lead", focus: "combat" }, { slotKey: "runner", label: "Runner", focus: "endurance" }], reputationReward: 80, treasuryGoldReward: 1600, memberGoldReward: 250, powerFloor: 45 },
  { key: "blackharbor_ledger_theft", displayName: "Blackharbor Ledger Theft", summary: "Lift shipping ledgers from a protected port house and leave behind enough confusion to pass for weather.", planningHours: 48, requiredMembers: 2, slots: [{ slotKey: "infiltrator", label: "Infiltrator", focus: "intelligence" }, { slotKey: "reader", label: "Reader", focus: "intelligence" }], reputationReward: 125, treasuryGoldReward: 3200, memberGoldReward: 450, powerFloor: 70 },
  { key: "ashen_mine_collapse", displayName: "Ashen Mine Collapse", summary: "Stabilise a collapsed ore line, extract trapped workers, and leave with more than soot and complaints.", planningHours: 72, requiredMembers: 3, slots: [{ slotKey: "breaker", label: "Breaker", focus: "manualLabor" }, { slotKey: "extractor", label: "Extractor", focus: "endurance" }, { slotKey: "guard", label: "Guard", focus: "combat" }], reputationReward: 210, treasuryGoldReward: 6200, memberGoldReward: 700, powerFloor: 105 },
  { key: "mire_hag_recovery", displayName: "Mire Hag Recovery", summary: "Retrieve cursed relic stock from the Weeping Mire while a hag-cult keeps insisting the swamp belongs to them.", planningHours: 96, requiredMembers: 5, slots: [{ slotKey: "frontliner", label: "Frontliner", focus: "combat" }, { slotKey: "healer", label: "Healer", focus: "intelligence" }, { slotKey: "tracker", label: "Tracker", focus: "endurance" }, { slotKey: "alchemist", label: "Alchemist", focus: "intelligence" }, { slotKey: "porter", label: "Porter", focus: "manualLabor" }], reputationReward: 340, treasuryGoldReward: 12000, memberGoldReward: 1100, powerFloor: 180 },
  { key: "sunken_vault_breach", displayName: "Sunken Vault Breach", summary: "Break open a flooded pre-shard vault, catalogue what matters, and survive whatever else wakes up down there.", planningHours: 120, requiredMembers: 6, slots: [{ slotKey: "vanguard", label: "Vanguard", focus: "combat" }, { slotKey: "locksmith", label: "Locksmith", focus: "intelligence" }, { slotKey: "archivist", label: "Archivist", focus: "intelligence" }, { slotKey: "porter", label: "Porter", focus: "manualLabor" }, { slotKey: "medic", label: "Medic", focus: "endurance" }, { slotKey: "rear_guard", label: "Rear Guard", focus: "combat" }], reputationReward: 470, treasuryGoldReward: 18500, memberGoldReward: 1500, powerFloor: 255 },
  { key: "citadel_of_ash", displayName: "Citadel of Ash", summary: "Take a strike team into a ruined war-citadel, clear the furnace guard, and leave with the charter cache intact.", planningHours: 144, requiredMembers: 15, slots: [{ slotKey: "captain", label: "Captain", focus: "combat" }, { slotKey: "vanguard_1", label: "Vanguard I", focus: "combat" }, { slotKey: "vanguard_2", label: "Vanguard II", focus: "combat" }, { slotKey: "medic_1", label: "Medic I", focus: "intelligence" }, { slotKey: "medic_2", label: "Medic II", focus: "intelligence" }, { slotKey: "breaker_1", label: "Breaker I", focus: "manualLabor" }, { slotKey: "breaker_2", label: "Breaker II", focus: "manualLabor" }, { slotKey: "runner_1", label: "Runner I", focus: "endurance" }, { slotKey: "runner_2", label: "Runner II", focus: "endurance" }, { slotKey: "runner_3", label: "Runner III", focus: "endurance" }, { slotKey: "rear_guard_1", label: "Rear Guard I", focus: "combat" }, { slotKey: "rear_guard_2", label: "Rear Guard II", focus: "combat" }, { slotKey: "scribe", label: "Scribe", focus: "intelligence" }, { slotKey: "porter_1", label: "Porter I", focus: "manualLabor" }, { slotKey: "porter_2", label: "Porter II", focus: "manualLabor" }], reputationReward: 760, treasuryGoldReward: 36000, memberGoldReward: 2400, powerFloor: 520 },
  { key: "silverbough_ward_fracture", displayName: "Silverbough Ward Fracture", summary: "Contain a fractured arcane wardline before the enclave politely blames your guild forever.", planningHours: 168, requiredMembers: 8, slots: [{ slotKey: "wardbreaker", label: "Wardbreaker", focus: "intelligence" }, { slotKey: "duelist", label: "Duelist", focus: "combat" }, { slotKey: "medic", label: "Medic", focus: "intelligence" }, { slotKey: "scout", label: "Scout", focus: "endurance" }, { slotKey: "scholar", label: "Scholar", focus: "intelligence" }, { slotKey: "carrier", label: "Carrier", focus: "manualLabor" }, { slotKey: "sentinel", label: "Sentinel", focus: "combat" }, { slotKey: "captain", label: "Captain", focus: "combat" }], reputationReward: 920, treasuryGoldReward: 41000, memberGoldReward: 2800, powerFloor: 340 },
  { key: "throne_of_cinders", displayName: "Throne of Cinders", summary: "An elite strike into a cinder-throne redoubt where the wrong choice gets written in ash and remembered badly.", planningHours: 192, requiredMembers: 4, slots: [{ slotKey: "captain", label: "Captain", focus: "combat" }, { slotKey: "vanguard", label: "Vanguard", focus: "combat" }, { slotKey: "scribe", label: "Scribe", focus: "intelligence" }, { slotKey: "runner", label: "Runner", focus: "endurance" }], reputationReward: 1200, treasuryGoldReward: 60000, memberGoldReward: 4200, powerFloor: 320 },
];
const getGuildQuestTemplate = (questKey) => GUILD_QUESTS.find((entry) => entry.key === questKey) ?? null;
const getGuildQuestFocusScore = (focus, member) => {
  const levelScore = Number(member.level ?? 1) * 6;
  const workingStats = asRecord(member.workingStats);
  switch (focus) {
    case "manualLabor":
      return levelScore + Number(workingStats.manualLabor ?? 0) * 4 + Number(member.battleTotal ?? 0) * 0.08;
    case "intelligence":
      return levelScore + Number(workingStats.intelligence ?? 0) * 4 + Number(member.battleTotal ?? 0) * 0.05;
    case "endurance":
      return levelScore + Number(workingStats.endurance ?? 0) * 4 + Number(member.battleTotal ?? 0) * 0.06;
    case "combat":
    default:
      return levelScore + Number(member.battleTotal ?? 0) * 0.3;
  }
};
const getGuildQuestAvailability = (member) => {
  if (String(member.status ?? "").toLowerCase() !== "available") {
    return { isOkay: false, reason: `${member.displayName} is currently ${String(member.status ?? "unavailable").toLowerCase()}.` };
  }
  if (String(member.location ?? "").toLowerCase().includes("travell")) {
    return { isOkay: false, reason: `${member.displayName} is travelling.` };
  }
  return { isOkay: true, reason: null };
};
const normalizeGuildQuestPlan = (value) => {
  const plan = asRecord(value);
  return {
    questKey: typeof plan.questKey === "string" ? plan.questKey : "",
    plannedAt: typeof plan.plannedAt === "number" ? plan.plannedAt : null,
    readyAt: typeof plan.readyAt === "number" ? plan.readyAt : null,
    plannedByPublicId: asInt(plan.plannedByPublicId, 0),
    plannedByName: typeof plan.plannedByName === "string" ? plan.plannedByName : "",
    assignments: asRecord(plan.assignments),
    previousCrew: Array.isArray(plan.previousCrew) ? plan.previousCrew.map((entry) => asInt(entry)).filter(Boolean) : [],
  };
};
const getGuildStore = (runtimeState) => asRecord(runtimeState.guild);
const syncGuildMembershipSummary = (runtimeState, organization, roleKey) => { runtimeState.guild = { membership: { organizationInternalId: organization.internalId, publicId: organization.publicId, name: organization.name, tag: organization.tag, roleKey, statusText: organization.statusText } }; };
const clearGuildMembershipSummary = (runtimeState) => { runtimeState.guild = { membership: null }; };
const labelFromItemId = (itemId) => titleCase(String(itemId ?? "").replace(/[_-]+/g, " "));
// Reads the guild's stored skill/reputation passives and migrates them onto the v2 core+specialization
// shape. `everUnlocked` persists every specialization the guild has ever paid points for (so a benched
// specialization's sunk point cost is never lost); `activeSpecializations` is the capped subset that is
// actually granting its bonus right now. Legacy records from the old flat 6-node tree (field name
// `unlockedSkills`, keys like "war_college") simply have no matching keys in GUILD_SPECIALIZATIONS, so
// they safely resolve to an empty everUnlocked list -- the guild's reputation/totalEarned counters are
// untouched, it just starts the new specialization pool fresh.
const normalizeGuildPassives = (passives) => {
  const rawEverUnlocked = Array.isArray(passives.everUnlocked)
    ? passives.everUnlocked
    : Array.isArray(passives.unlockedSkills)
      ? passives.unlockedSkills
      : [];
  const everUnlocked = Array.from(new Set(rawEverUnlocked.filter((entry) => typeof entry === "string" && findGuildSpecialization(entry))));
  const rawActive = Array.isArray(passives.activeSpecializations) ? passives.activeSpecializations : null;
  const activeSpecializations = (rawActive
    ? rawActive.filter((entry) => typeof entry === "string" && everUnlocked.includes(entry))
    : [...everUnlocked]
  ).slice(0, GUILD_SPECIALIZATION_CAP);
  const rally = asRecord(passives.rally);
  return {
    reputation: asInt(passives.reputation),
    totalEarned: asInt(passives.totalEarned),
    totalSpent: everUnlocked.reduce((sum, key) => sum + Number(findGuildSpecialization(key)?.pointCost ?? 0), 0),
    everUnlocked,
    activeSpecializations,
    respecCount: asInt(passives.respecCount),
    lastRespecAt: typeof passives.lastRespecAt === "number" ? passives.lastRespecAt : null,
    rally: {
      active: Boolean(rally.active),
      activatedAt: typeof rally.activatedAt === "number" ? rally.activatedAt : null,
      expiresAt: typeof rally.expiresAt === "number" ? rally.expiresAt : null,
      lastTriggeredAt: typeof rally.lastTriggeredAt === "number" ? rally.lastTriggeredAt : null,
    },
  };
};
const normalizeGuildMetadata = (organization) => {
  const metadata = asRecord(organization.metadata);
  const guild = asRecord(metadata.guild);
  const publicProfile = asRecord(guild.publicProfile);
  const passives = asRecord(guild.passives);
  const wars = asRecord(guild.wars);
  const adventuring = asRecord(guild.adventuring);
  const armory = asRecord(guild.armory);
  const settings = asRecord(guild.settings);
  const recruitmentStatus = String(publicProfile.recruitmentStatus ?? "Seeking steady blades").trim() || "Seeking steady blades";
  const doctrine = String(publicProfile.doctrine ?? "Precision before spectacle.").trim() || "Precision before spectacle.";
  const territory = String(publicProfile.territory ?? "Nexis City").trim() || "Nexis City";
  const diplomacy = String(publicProfile.diplomacy ?? "Selective alliances, fewer fools.").trim() || "Selective alliances, fewer fools.";
  return {
    ...metadata,
    guild: {
      publicProfile: {
        headline: String(publicProfile.headline ?? `${organization.name} keeps its knives sharp and its standards higher.`).trim(),
        recruitmentStatus,
        doctrine,
        territory,
        diplomacy,
        publicNotice: String(publicProfile.publicNotice ?? "Visitors see the charter. Members see the machinery.").trim(),
      },
      passives: normalizeGuildPassives(passives),
      wars: {
        doctrine: String(wars.doctrine ?? "Measured escalation").trim() || "Measured escalation",
        activeWars: Array.isArray(wars.activeWars) ? wars.activeWars.map((entry) => ({ ...asRecord(entry) })) : [],
        history: Array.isArray(wars.history) ? wars.history.map((entry) => ({ ...asRecord(entry) })) : [],
      },
      adventuring: {
        lastRunAt: typeof adventuring.lastRunAt === "number" ? adventuring.lastRunAt : null,
        currentQuest: normalizeGuildQuestPlan(adventuring.currentQuest),
        lastCrew: Array.isArray(adventuring.lastCrew) ? adventuring.lastCrew.map((entry) => ({ ...asRecord(entry) })) : [],
        history: Array.isArray(adventuring.history) ? adventuring.history.map((entry) => ({ ...asRecord(entry) })) : [],
      },
      armory: {
        items: asRecord(armory.items),
      },
      settings: {
        invitePolicy: String(settings.invitePolicy ?? "Officer Approval").trim() || "Officer Approval",
        warDoctrine: String(settings.warDoctrine ?? "Precision Strikes").trim() || "Precision Strikes",
      },
    },
  };
};
const getGuildSkillSummary = (skillKey) => findGuildSpecialization(skillKey)?.effectSummary ?? GUILD_CORE_SKILLS.find((entry) => entry.key === skillKey)?.effectSummary ?? titleCase(skillKey);
// Aggregates the numeric bonuses granted by whichever specializations are currently active (plus the
// always-on core), as a single bundle every guild-action function can pull from instead of re-deriving
// "is X active" checks inline. isRecruit only affects the reputation multiplier (Open Roster Accord is
// recruit-specific; Trade Concord and the core bonus apply to every reputation source).
const computeGuildSpecializationEffects = (activeSpecializations) => {
  const active = new Set(Array.isArray(activeSpecializations) ? activeSpecializations : []);
  const core = GUILD_CORE_SKILLS;
  const coreReputationPct = core.find((entry) => entry.key === "chartered_discipline")?.effectValue ?? 0;
  const coreReadinessFlat = core.find((entry) => entry.key === "standing_muster")?.effectValue ?? 0;
  const has = (key) => active.has(key);
  return {
    active,
    reputationMultiplier: (isRecruit = false) => {
      let multiplier = 1 + coreReputationPct;
      if (has("trade_concord")) multiplier += findGuildSpecialization("trade_concord").effectValue;
      if (isRecruit && has("open_roster_accord")) multiplier += findGuildSpecialization("open_roster_accord").effectValue;
      return multiplier;
    },
    readinessFlat: coreReadinessFlat + (active.size * 4),
    successFlat: coreReadinessFlat,
    successCountBoost: active.size * 8,
    successMultiplier: 1 + (has("delve_mastery") ? findGuildSpecialization("delve_mastery").effectValue : 0),
    memberGoldMultiplier: 1 + (has("delve_mastery") ? findGuildSpecialization("delve_mastery").secondaryEffectValue : 0) + (has("reclaimers_eye") ? findGuildSpecialization("reclaimers_eye").effectValue : 0),
    treasuryGoldMultiplier: 1 + (has("reclaimers_eye") ? findGuildSpecialization("reclaimers_eye").effectValue : 0),
    failurePayoutFloor: has("bastion_wardwork") ? findGuildSpecialization("bastion_wardwork").effectValue : null,
    armoryDepositMultiplier: 1 + (has("vault_discipline") ? findGuildSpecialization("vault_discipline").effectValue : 0),
    medicalRecoveryReductionPct: has("field_medic_corps") ? findGuildSpecialization("field_medic_corps").effectValue : 0,
    academyBonusMultiplier: 1 + (has("drillyard_regimen") ? findGuildSpecialization("drillyard_regimen").effectValue : 0),
    diplomacyThresholdMultiplier: 1 - (has("accord_brokerage") ? findGuildSpecialization("accord_brokerage").effectValue : 0),
    rallyAvailable: has("strike_cadence"),
    rallyBonusPct: findGuildSpecialization("strike_cadence")?.effectValue ?? 0,
  };
};
// Reduces a hospitalized member's remaining recovery time by a percentage of what's left, mirroring
// applyRecoveryReduction()'s absolute-ms version above (used by consortium field-treatment rewards).
const applyRecoveryReductionPct = (runtimeState, pct) => {
  const condition = runtimeState.player.condition ?? { type: "normal", until: null, reason: null };
  if (condition.type !== "hospitalized" || typeof condition.until !== "number") return false;
  const remaining = Math.max(0, condition.until - Date.now());
  runtimeState.player.condition = { ...condition, until: Date.now() + Math.round(remaining * (1 - pct)) };
  return true;
};
const buildGuildState = async (client, organization, viewerInternalId = null) => {
  const metadata = normalizeGuildMetadata(organization);
  const guild = metadata.guild;
  const baseEffects = await getOrganizationBaseEffectsForOrg(client, organization);
  const memberProfiles = [];
  for (const member of organization.members) {
    const state = await findPlayerStateByUserInternalId(client, member.userInternalId);
    const runtime = buildMutableRuntimeState({ internalId: member.userInternalId, publicId: member.publicId, firstName: member.displayName, lastName: "" }, state);
    const condition = runtime.player.condition ?? { type: "normal", until: null, reason: null };
    const currentTravel = runtime.player.current?.travel;
    const location = condition.type === "jailed"
      ? "Jail"
      : condition.type === "hospitalized"
        ? "Hospital"
        : typeof currentTravel === "string" && currentTravel
          ? `Travelling: ${currentTravel}`
          : "Nexis City";
    const status = condition.type === "normal" ? "Available" : titleCase(condition.type.replace(/_/g, " "));
    const workingStats = normalizeWorkingStats(state?.workingStats);
    const academyProfile = deriveAcademyProfile(state);
    const battleTotal = Number(state?.battleStats?.strength ?? 0) + Number(state?.battleStats?.defense ?? 0) + Number(state?.battleStats?.speed ?? 0) + Number(state?.battleStats?.dexterity ?? 0);
    const availability = getGuildQuestAvailability({ ...member, status, location, displayName: member.displayName });
    memberProfiles.push({
      ...member,
      roleDisplayName: getRoleDisplayName(organization, member.roleKey),
      level: Number(state?.level ?? 1),
      title: typeof runtime.player.title === "string" && runtime.player.title ? runtime.player.title : null,
      location,
      status,
      life: { current: Number(runtime.player.stats?.health ?? 100), max: Number(runtime.player.stats?.maxHealth ?? 100) },
      isOnline: false,
      lastAction: typeof currentTravel === "string" && currentTravel ? "In transit" : "Recently active",
      battleTotal,
      workingStats,
      academyProfile,
      isQuestReady: availability.isOkay,
      questBlockReason: availability.reason,
    });
  }
  const memberCount = memberProfiles.length;
  const averageLevel = memberCount ? memberProfiles.reduce((sum, member) => sum + member.level, 0) / memberCount : 1;
  const combinedBattle = memberProfiles.reduce((sum, member) => sum + member.battleTotal, 0);
  const everUnlockedSkills = guild.passives.everUnlocked;
  const activeSpecializations = guild.passives.activeSpecializations;
  const specializationEffects = computeGuildSpecializationEffects(activeSpecializations);
  const academyReadinessPct = (memberCount ? round1(memberProfiles.reduce((sum, member) => sum + Number(asRecord(member.academyProfile).adventuringSurvival?.guildReadinessPct ?? 0), 0) / memberCount) : 0) * specializationEffects.academyBonusMultiplier;
  const academySurvivalPct = (memberCount ? round1(memberProfiles.reduce((sum, member) => sum + Number(asRecord(member.academyProfile).adventuringSurvival?.operationSurvivalPct ?? 0), 0) / memberCount) : 0) * specializationEffects.academyBonusMultiplier;
  const academyBattleEdgePct = (memberCount ? round1(memberProfiles.reduce((sum, member) => sum + Number(asRecord(member.academyProfile).adventuringSurvival?.battleEdgePct ?? 0), 0) / memberCount) : 0) * specializationEffects.academyBonusMultiplier;
  const academyTrackCompletionPct = memberCount ? round1(memberProfiles.reduce((sum, member) => sum + Number(asRecord(member.academyProfile).adventuringSurvival?.trackCompletionPct ?? 0), 0) / memberCount) : 0;
  const academyTrackCompletedCourses = memberCount ? round1(memberProfiles.reduce((sum, member) => sum + Number(asRecord(member.academyProfile).adventuringSurvival?.completedCourses ?? 0), 0) / memberCount) : 0;
  const readinessBase = 26 + (combinedBattle / Math.max(1, memberCount * 18)) + (averageLevel * 2) + specializationEffects.readinessFlat;
  const readiness = clamp(readinessBase * (1 + (academyReadinessPct / 100)) * (1 + (Number(asRecord(baseEffects).effects?.questPowerPct ?? 0) / 300)), 0, 220);
  const warRating = round1((((combinedBattle * (1 + (academyBattleEdgePct / 100))) / Math.max(1, memberCount))) + (readiness * 1.6) + Number(asRecord(baseEffects).effects?.dungeonPowerFlat ?? 0));
  const reputation = guild.passives.reputation;
  const totalSkillCostSpent = guild.passives.totalSpent;
  const totalPointsEarned = Math.max(asInt(guild.passives.totalEarned), Math.floor(reputation / 120));
  const availablePoints = Math.max(0, totalPointsEarned - totalSkillCostSpent);
  const dailyRenownBase = (memberCount * 6) + averageLevel + (specializationEffects.readinessFlat / 2);
  const dailyRenown = Math.max(8, Math.round(dailyRenownBase * (1 + (academySurvivalPct / 100)) * (1 + (Number(asRecord(baseEffects).effects?.renownDailyPct ?? 0) / 100))));
  const guildAcademyContract = {
    source: "education",
    adventuringSurvival: {
      averageTrackCompletionPct: academyTrackCompletionPct,
      averageCompletedCourses: academyTrackCompletedCourses,
      requiredCourses: ADVENTURING_SURVIVAL_COURSES.length,
      guildReadinessPct: academyReadinessPct,
      operationSurvivalPct: academySurvivalPct,
      battleEdgePct: academyBattleEdgePct,
    },
  };
  const cooldownRemaining = Math.max(0, Number(guild.adventuring.lastRunAt ?? 0) + (6 * MS_HOUR) - Date.now());
  const dungeonBoard = GUILD_DUNGEONS.map((entry) => ({
    ...entry,
    canLaunch: memberCount >= entry.minMembers && cooldownRemaining <= 0,
    blockedReason: memberCount < entry.minMembers ? `Requires ${entry.minMembers} members.` : cooldownRemaining > 0 ? "Guild adventuring is still on cooldown." : null,
  }));
  const warHistory = guild.wars.history.slice(0, 6).map((entry) => ({ summary: String(entry.summary ?? "No recorded campaign result."), createdAt: asInt(entry.createdAt, Date.now()) }));
  const rallyReady = guild.passives.rally.active && Number(guild.passives.rally.expiresAt ?? 0) > Date.now();
  const rallyCooldownRemaining = Math.max(0, Number(guild.passives.rally.lastTriggeredAt ?? 0) + GUILD_RALLY_COOLDOWN_MS - Date.now());
  const skillTree = {
    cap: GUILD_SPECIALIZATION_CAP,
    activeCount: activeSpecializations.length,
    respecGoldCost: GUILD_SKILL_RESPEC_GOLD_COST,
    respecCount: guild.passives.respecCount,
    core: GUILD_CORE_SKILLS.map((entry) => ({ ...entry, isCore: true, unlocked: true })),
    specializations: GUILD_SPECIALIZATIONS.map((entry) => {
      const isActive = activeSpecializations.includes(entry.key);
      return {
        ...entry,
        isCore: false,
        unlocked: isActive,
        everUnlocked: everUnlockedSkills.includes(entry.key),
        isActive,
        canActivate: !isActive && activeSpecializations.length < GUILD_SPECIALIZATION_CAP,
        canSwapIn: !isActive && activeSpecializations.length >= GUILD_SPECIALIZATION_CAP,
      };
    }),
    rally: {
      specializationActive: specializationEffects.rallyAvailable,
      bonusPct: Math.round(specializationEffects.rallyBonusPct * 100),
      goldCost: GUILD_RALLY_GOLD_COST,
      cooldownMs: GUILD_RALLY_COOLDOWN_MS,
      ready: rallyReady,
      cooldownRemainingMs: rallyCooldownRemaining,
      canTrigger: specializationEffects.rallyAvailable && rallyCooldownRemaining <= 0,
    },
  };
  const armoryItems = Object.entries(guild.armory.items).filter(([, quantity]) => asInt(quantity) > 0).map(([itemId, quantity]) => ({ itemId, label: labelFromItemId(itemId), quantity: asInt(quantity) }));
  const viewerMember = memberProfiles.find((entry) => entry.userInternalId === viewerInternalId) ?? null;
  const viewerRole = organization.roles.find((entry) => entry.roleKey === viewerMember?.roleKey);

  const activePlan = normalizeGuildQuestPlan(guild.adventuring.currentQuest);
  const activeTemplate = getGuildQuestTemplate(activePlan.questKey);
  const assignedInternalIds = new Set(Object.values(activePlan.assignments).map((entry) => asRecord(entry).userInternalId).filter(Boolean));
  const availablePool = memberProfiles.filter((member) => !assignedInternalIds.has(member.userInternalId));
  const templateBoard = GUILD_QUESTS.map((entry) => ({
    key: entry.key,
    displayName: entry.displayName,
    summary: entry.summary,
    planningHours: entry.planningHours,
    requiredMembers: entry.requiredMembers,
    slots: entry.slots.map((slot) => ({ ...slot })),
    reputationReward: entry.reputationReward,
    treasuryGoldReward: entry.treasuryGoldReward,
    memberGoldReward: entry.memberGoldReward,
    canPlan: !activeTemplate && memberCount >= entry.requiredMembers,
    blockedReason: activeTemplate ? "Another guild quest is already in planning." : memberCount < entry.requiredMembers ? `Requires ${entry.requiredMembers} members.` : null,
  }));

  let currentPlan = null;
  if (activeTemplate && activePlan.plannedAt && activePlan.readyAt) {
    const slots = activeTemplate.slots.map((slot) => {
      const assigned = asRecord(activePlan.assignments[slot.slotKey]);
      const assignedMember = memberProfiles.find((member) => member.userInternalId === assigned.userInternalId) ?? null;
      return {
        slotKey: slot.slotKey,
        label: slot.label,
        focus: slot.focus,
        assignedMember: assignedMember ? {
          userInternalId: assignedMember.userInternalId,
          publicId: assignedMember.publicId,
          displayName: assignedMember.displayName,
          roleDisplayName: assignedMember.roleDisplayName,
          level: assignedMember.level,
          status: assignedMember.status,
          location: assignedMember.location,
          isOkay: assignedMember.isQuestReady,
          unavailableReason: assignedMember.questBlockReason,
        } : null,
      };
    });
    const planningComplete = Date.now() >= activePlan.readyAt;
    const allSlotsFilled = slots.every((slot) => slot.assignedMember);
    const everyoneOkay = slots.every((slot) => !slot.assignedMember || slot.assignedMember.isOkay);
    const blockedReason = !allSlotsFilled
      ? "Every required role must be filled before the quest can go live."
      : !planningComplete
        ? "Planning time has not finished yet."
        : !everyoneOkay
          ? "All assigned members must be available, not jailed, not hospitalized, and not travelling."
          : null;
    currentPlan = {
      questKey: activeTemplate.key,
      displayName: activeTemplate.displayName,
      summary: activeTemplate.summary,
      planningHours: activeTemplate.planningHours,
      plannedAt: activePlan.plannedAt,
      readyAt: activePlan.readyAt,
      plannedBy: {
        publicId: activePlan.plannedByPublicId,
        displayName: activePlan.plannedByName || "Unknown planner",
      },
      slots,
      planningComplete,
      allSlotsFilled,
      everyoneOkay,
      canInitiate: Boolean(viewerRole?.permissions?.includes("declare_operations")) && allSlotsFilled && planningComplete && everyoneOkay,
      canCancel: Boolean(viewerRole?.permissions?.includes("declare_operations")),
      canPlanAgain: Boolean(viewerRole?.permissions?.includes("declare_operations")) && activePlan.previousCrew.length === activeTemplate.requiredMembers,
      blockedReason,
    };
  }

  const questHistory = guild.adventuring.history.slice(0, 10).map((entry) => ({
    questKey: String(entry.questKey ?? entry.dungeonKey ?? "unknown"),
    displayName: String(entry.displayName ?? "Unnamed operation"),
    summary: String(entry.summary ?? "No operation summary recorded."),
    outcome: String(entry.outcome ?? "failure") === "success" ? "success" : "failure",
    createdAt: asInt(entry.createdAt, Date.now()),
    reputationGain: asInt(entry.reputationGain),
    treasuryGoldGain: asInt(entry.treasuryGoldGain),
    participantPublicIds: Array.isArray(entry.participantPublicIds) ? entry.participantPublicIds.map((value) => asInt(value)).filter(Boolean) : [],
  }));

  return {
    metadata,
    publicProfile: guild.publicProfile,
    memberDetails: memberProfiles.map(({ battleTotal, workingStats, academyProfile, isQuestReady, questBlockReason, ...member }) => member),
    questMemberPool: availablePool.map((member) => ({
      userInternalId: member.userInternalId,
      publicId: member.publicId,
      displayName: member.displayName,
      roleDisplayName: member.roleDisplayName,
      level: member.level,
      status: member.status,
      location: member.location,
      isQuestReady: member.isQuestReady,
      questBlockReason: member.questBlockReason,
    })),
    warRoom: { readiness: round1(readiness), warRating, doctrine: guild.wars.doctrine, activeWars: guild.wars.activeWars.map((entry) => ({ target: String(entry.target ?? "Unknown rival"), status: String(entry.status ?? "Forming"), startedAt: asInt(entry.startedAt, Date.now()) })), recentHistory: warHistory },
    dungeonBoard,
    guildQuestBoard: {
      templates: templateBoard,
      currentPlan,
      history: questHistory,
    },
    guildPassives: { reputation, totalEarned: Math.max(asInt(guild.passives.totalEarned), reputation), totalSpent: totalSkillCostSpent, availablePoints, dailyRenown, activeSpecializationCount: activeSpecializations.length, specializationCap: GUILD_SPECIALIZATION_CAP, respecGoldCost: GUILD_SKILL_RESPEC_GOLD_COST, respecCount: guild.passives.respecCount },
    baseEffects,
    academyContract: guildAcademyContract,
    skillTree,
    armory: { items: armoryItems },
    settingsView: { invitePolicy: guild.settings.invitePolicy, warDoctrine: guild.settings.warDoctrine, publicProfile: guild.publicProfile },
    viewerPermissions: viewerRole?.permissions ?? [],
  };
};

const ROMAN_NUMERALS = ["0", "I", "II", "III", "IV", "V", "VI", "VII", "VIII", "IX", "X"];
const romanRank = (value) => ROMAN_NUMERALS[Math.max(1, Math.min(10, asInt(value, 1)))] ?? "I";
const getRankFromScore = (score) => Math.max(1, Math.min(10, Math.ceil(asInt(score, 1) / 10)));
const formatGoldDelta = (value) => `${value >= 0 ? "+" : "-"}${Math.abs(asInt(value)).toLocaleString("en-GB")} gold`;

function buildConsortiumHazardState(organization, derived) {
  const performance = asRecord(derived.performance);
  const health = asRecord(derived.healthMetrics);
  const logistics = asRecord(asRecord(organization.metadata).logistics);
  const score = asInt(performance.score, 0);
  const weakMetrics = Object.values(health).filter((entry) => asInt(asRecord(entry).value, 0) < 50).map((entry) => asRecord(entry).label ?? "strained operation");
  const routePressure = asInt(logistics.activeRouteCount, 0) > Math.max(1, asInt(derived.employeeCapacity, 1)) ? "overextended logistics" : null;
  const causes = [routePressure, ...weakMetrics, score < 45 ? "thin company performance" : null].filter(Boolean);
  const level = score < 35 ? "Critical" : score < 55 ? "High" : score < 75 ? "Guarded" : "Low";
  const effects = {
    Low: "Routes are controlled; normal contract and sourcing cadence is expected.",
    Guarded: "Output is workable, but exposed lanes and weak staffing can shave margin.",
    High: "Route outcomes, payroll rhythm, and contract quality are under pressure.",
    Critical: "Expect bad logistics outcomes without escort coverage, better staffing, or route reduction.",
  }[level];
  const fixes = level === "Low"
    ? ["Keep preferred roles staffed", "Advance company rank", "Convert surplus into safer route capacity"]
    : ["Assign escorts or request guild assistance", "Fill preferred employee roles", "Reduce active route exposure", "Improve city standing and base support"];
  return { level, causes: causes.length ? causes : ["routine operating pressure"], effects, fixes };
}

function buildConsortiumOverview(organization, derived) {
  const score = asInt(derived.performance?.score, 0);
  const rank = getRankFromScore(score);
  const unlocked = getUnlockedPassives(derived.template.key, derived.stars);
  const benefits = [
    ...unlocked.slice(0, 4).map((entry) => entry.effectSummary),
    `+${asInt(derived.academyContract?.businessStudies?.consortiumYieldPct, 0)}% company yield from Business Studies`,
    `+${asInt(derived.academyContract?.businessStudies?.routePerformancePct, 0)}% route performance from education`,
  ].filter((entry) => entry && !String(entry).startsWith("+0%"));
  const nextRank = Math.min(10, rank + 1);
  return {
    companyType: { key: derived.template.key, name: derived.template.displayName, summary: derived.template.description, strengths: derived.template.rolesFlavor ?? [] },
    rank: { value: rank, label: `Rank ${romanRank(rank)}`, nextLabel: rank >= 10 ? "Rank X cap" : `Rank ${romanRank(nextRank)}`, progressScore: score, nextRequires: rank >= 10 ? ["Maximum company rank reached"] : [`Reach performance score ${nextRank * 10}`, "Keep employee roles staffed", "Complete contracts or logistics routes"] },
    treasury: normalizeTreasury(organization.treasury),
    dailyProfitLoss: { label: formatGoldDelta((asInt(derived.totalDailyGeneration, 0) * 45) - Math.max(0, asInt(organization.members?.length, 0) * 12)), pointsGenerated: asInt(derived.totalDailyGeneration, 0), cadence: "daily company pulse" },
    employees: { count: organization.members.length, capacity: derived.employeeCapacity, preferredSlotsFilled: asInt(derived.performance?.filledPreferredSlots, 0) },
    activeContracts: asInt(asRecord(asRecord(organization.metadata).contracts).activeCount, 0),
    activeRoutes: asInt(asRecord(asRecord(organization.metadata).logistics).activeRouteCount, 0),
    hazard: buildConsortiumHazardState(organization, derived),
    currentBenefits: benefits.length ? benefits : ["No unlocked passives yet; improve rank and staffing."],
    nextSteps: score < 55 ? ["Assign employees to preferred roles", "Launch a safer logistics route", "Request a guild escort for dangerous work"] : ["Push advancement rank", "Redeem active company rewards", "Use logistics output to feed markets and crafting"],
    sections: ["Overview", "Employees", "Contracts", "Logistics", "Assets", "Finance", "Advancement"],
  };
}

function buildGuildAssistanceOpportunities(organization, derived) {
  const reputation = asInt(derived.guildPassives?.reputation, 0);
  const thresholdMultiplier = computeGuildSpecializationEffects(asRecord(derived.metadata?.guild?.passives).activeSpecializations ?? []).diplomacyThresholdMultiplier;
  const ruinThreshold = Math.round(150 * thresholdMultiplier);
  const wardThreshold = Math.round(300 * thresholdMultiplier);
  return [
    { key: "convoy_defense", label: "Convoy Defense", summary: "Escort consortium freight through dangerous lanes; piercing or bludgeoning protection improves readiness.", guildReward: "+reputation, treasury gold, operation history, gear reward bundles", consortiumReward: "hazard reduction, better route stability, and safer item cargo movement", recommendedReputation: 0, available: true, rewardCategory: "convoy gear and materials" },
    { key: "ruin_escort", label: "Ruin Escort", summary: "Guard relic brokers, surveyors, or salvage crews in contested sites; magical protection and field consumables are recommended.", guildReward: "+prestige, expedition payout quality, and relic gear chances", consortiumReward: "safer retrieval, stronger contract completion, and better relic stock", recommendedReputation: ruinThreshold, available: reputation >= ruinThreshold, rewardCategory: "relic gear and manuals" },
    { key: "ward_suppression", label: "Ward Suppression", summary: "Contain unstable arcane routes before cargo crews enter; magical reduction and Ward Chalk are called out.", guildReward: "+city standing, operation record, and ward supply bundles", consortiumReward: "reduced route losses and steadier arcane cargo", recommendedReputation: wardThreshold, available: reputation >= wardThreshold, rewardCategory: "ward gear and consumables" },
  ];
}

function buildConsortiumAssistanceOpportunities(organization, derived) {
  const hazard = buildConsortiumHazardState(organization, derived);
  return [
    { key: "guild_convoy_defense", label: "Hire Guild: Convoy Defense", summary: "Use a guild escort to raise cover on exposed logistics operations and protect marketable item cargo.", guildReward: "reputation, payout, and gear bundle chances", consortiumReward: "higher route success, lower losses, and safer marketplace supply", available: hazard.level !== "Low", rewardCategory: "escort gear" },
    { key: "dangerous_retrieval", label: "Guild Retrieval Work", summary: "Post dangerous recovery work that employees should not handle alone; hidden-site loot can feed crafting and listings.", guildReward: "operation history, money, and expedition loot", consortiumReward: "contract completion, hazard reduction, and recovered stock", available: true, rewardCategory: "site loot" },
    { key: "route_security", label: "Route Security Sweep", summary: "Ask a guild to clear bandit pressure or ward trouble before launch; threat type hints now inform gear prep.", guildReward: "prestige, city standing, and combat supply rewards", consortiumReward: "safer routes and more stable trade flow", available: true, rewardCategory: "combat supplies" },
  ];
}

function buildGuildOverview(organization, derived) {
  const currentPlan = derived.guildQuestBoard?.currentPlan ?? null;
  const activeWar = derived.warRoom?.activeWars?.[0] ?? null;
  const activeSpecializationKeys = derived.skillTree?.specializations?.filter((entry) => entry.isActive).map((entry) => entry.displayName) ?? [];
  const gains = [
    `+${asInt(derived.guildPassives?.dailyRenown, 0)} daily renown`,
    `Readiness ${asInt(derived.warRoom?.readiness, 0)}%`,
    `+${asInt(derived.academyContract?.adventuringSurvival?.guildReadinessPct, 0)}% readiness from survival education`,
    activeSpecializationKeys.length ? `Active specializations: ${activeSpecializationKeys.join(", ")}` : "No specializations active yet",
    "Armory and base effects apply to operations where eligible",
  ].filter((entry) => !String(entry).startsWith("+0%"));
  return {
    identity: { name: organization.name, tag: organization.tag, publicId: organization.publicId, statusText: organization.statusText },
    currentGains: gains,
    currentFocus: {
      activeOperation: currentPlan ? currentPlan.displayName : null,
      activeAdventure: currentPlan ? currentPlan.summary : null,
      rivalry: activeWar ? `${activeWar.target}: ${activeWar.status}` : "No declared rivalry",
      consortiumAssistance: buildGuildAssistanceOpportunities(organization, derived).find((entry) => entry.available)?.label ?? null,
      readinessState: asInt(derived.warRoom?.readiness, 0) >= 70 ? "Ready" : "Needs assignments",
      specializations: `${asInt(derived.guildPassives?.activeSpecializationCount, 0)} / ${asInt(derived.guildPassives?.specializationCap, GUILD_SPECIALIZATION_CAP)} active`,
    },
    nextSteps: currentPlan ? ["Fill all operation slots", "Check participant condition", "Initiate when ready"] : ["Plan an operation", "Stock the armory", "Offer assistance to a consortium route"],
    sections: ["Headquarters", "Members", "War / Rivalries", "Operations", "Specializations", "Armory", "Base", "Settings / Charter"],
  };
}

const refreshGuildView = async (client, user, organization) => {
  if (!organization || organization.type !== "guild") return { organization };
  const derived = await buildGuildState(client, organization, user.internalId);
  return {
    organization: {
      ...organization,
      metadata: derived.metadata,
      publicProfile: derived.publicProfile,
      memberDetails: derived.memberDetails,
      warRoom: derived.warRoom,
      dungeonBoard: derived.dungeonBoard,
      guildQuestBoard: derived.guildQuestBoard,
      questMemberPool: derived.questMemberPool,
      guildPassives: derived.guildPassives,
      baseMechanicalEffects: derived.baseEffects,
      academyContract: derived.academyContract,
      skillTree: derived.skillTree,
      armory: derived.armory,
      settingsView: derived.settingsView,
      viewerPermissions: derived.viewerPermissions,
      guildOverview: buildGuildOverview(organization, derived),
      assistanceOpportunities: buildGuildAssistanceOpportunities(organization, derived),
      layoutSections: ["Headquarters", "Members", "War / Rivalries", "Operations", "Specializations", "Armory", "Base", "Settings / Charter"],
    },
  };
};
const getCompanyAgeDays = (createdAt) => Math.max(1, Math.floor((Date.now() - Number(createdAt ?? Date.now())) / (24 * MS_HOUR)) + 1);
const getRoleDisplayName = (organization, roleKey) => organization.roles.find((entry) => entry.roleKey === roleKey)?.displayName ?? titleCase(roleKey);
const pickBestPosition = (template, workingStats, usedCounts = {}) => {
  const scored = listConsortiumPositions(template.key).filter((entry) => entry.key !== "director").map((entry) => ({ entry, score: scorePosition(entry, workingStats), remaining: Math.max(0, (entry.slotCount ?? 0) - (usedCounts[entry.key] ?? 0)) })).sort((left, right) => (right.remaining === left.remaining ? right.score - left.score : right.remaining - left.remaining));
  return scored.find((entry) => entry.remaining > 0)?.entry.key ?? scored[0]?.entry.key ?? null;
};
const buildConsortiumState = async (client, organization, viewerInternalId = null) => {
  const template = getConsortiumTypeDefinition(organization.consortiumTypeKey);
  if (!template) return null;
  const metadata = normalizeManagement(organization, template);
  const baseEffects = await getOrganizationBaseEffectsForOrg(client, organization);
  const memberProfiles = [];
  for (const member of organization.members) {
    const state = await findPlayerStateByUserInternalId(client, member.userInternalId);
    memberProfiles.push({ member, workingStats: normalizeWorkingStats(state?.workingStats), academyProfile: deriveAcademyProfile(state) });
  }
  const positionCounts = {};
  const positions = { ...metadata.management.positions };
  positions[organization.founderInternalId] = "director";
  for (const profile of memberProfiles) {
    if (profile.member.roleKey === "director") continue;
    const current = typeof positions[profile.member.userInternalId] === "string" ? positions[profile.member.userInternalId] : null;
    const valid = current && getConsortiumPositionDefinition(template.key, current) ? current : null;
    if (valid) positionCounts[valid] = (positionCounts[valid] ?? 0) + 1;
  }
  for (const profile of memberProfiles) {
    if (profile.member.roleKey === "director") continue;
    const current = typeof positions[profile.member.userInternalId] === "string" ? positions[profile.member.userInternalId] : null;
    if (current && getConsortiumPositionDefinition(template.key, current)) continue;
    const assigned = pickBestPosition(template, profile.workingStats, positionCounts);
    if (assigned) { positions[profile.member.userInternalId] = assigned; positionCounts[assigned] = (positionCounts[assigned] ?? 0) + 1; }
  }
  const employeeCapacity = 1 + listConsortiumPositions(template.key).reduce((sum, entry) => sum + (entry.slotCount ?? 0), 0) - 1 + Math.min(3, Math.floor((metadata.management.outreach.level ?? 0) / 2));
  const memberViews = memberProfiles.map(({ member, workingStats, academyProfile }) => {
    const positionKey = member.roleKey === "director" ? "director" : positions[member.userInternalId] ?? null;
    const position = positionKey ? getConsortiumPositionDefinition(template.key, positionKey) : null;
    const workerEfficiencyPct = Number(asRecord(academyProfile).businessStudies?.workerEfficiencyPct ?? 0);
    const rawContribution = position ? scorePosition(position, workingStats) * (1 + (workerEfficiencyPct / 100)) : 0;
    const normalizedContribution = clamp(rawContribution / 75, 0, 1.4);
    return { ...member, roleDisplayName: getRoleDisplayName(organization, member.roleKey), positionKey, positionDisplayName: position?.displayName ?? "Unassigned", workingStats, academyProfile, contributionScore: round1(rawContribution), normalizedContribution, position };
  });
  const totalSlots = listConsortiumPositions(template.key).reduce((sum, entry) => sum + (entry.slotCount ?? 0), 0);
  const filledPreferredSlots = listConsortiumPositions(template.key).reduce((sum, entry) => sum + Math.min(entry.slotCount ?? 0, memberViews.filter((member) => member.positionKey === entry.key).length), 0);
  const overstaff = Math.max(0, memberViews.length - employeeCapacity);
  const treasury = normalizeTreasury(organization.treasury);
  const pendingApplications = metadata.management.applications;
  let popularity = 24 + Math.min(18, (metadata.management.outreach.level ?? 0) * 5) + Math.min(12, pendingApplications.length * 3) + Math.min(10, memberViews.length * 2);
  let efficiency = 24 + Math.min(14, filledPreferredSlots * 2) + Math.min(12, treasury.gold / 5000);
  let environment = 28 + Math.min(14, treasury.gold / Math.max(1500, memberViews.length * 1500));
  const baseFx = asRecord(baseEffects).effects ?? {};
  popularity += Number(baseFx.logisticsRewardPct ?? 0) * 0.2;
  efficiency += Number(baseFx.routeEfficiencyPct ?? 0) * 0.9;
  environment += Number(baseFx.logisticsLossMitigationPct ?? 0) * 0.45;
  for (const member of memberViews) {
    if (!member.position) continue;
    popularity += member.normalizedContribution * member.position.metricImpact.popularity;
    efficiency += member.normalizedContribution * member.position.metricImpact.efficiency;
    environment += member.normalizedContribution * member.position.metricImpact.environment;
  }
  const academyBusinessYieldPct = memberViews.length ? round1(memberViews.reduce((sum, member) => sum + Number(asRecord(member.academyProfile).businessStudies?.consortiumYieldPct ?? 0), 0) / memberViews.length) : 0;
  const academyBusinessTreasuryPct = memberViews.length ? round1(memberViews.reduce((sum, member) => sum + Number(asRecord(member.academyProfile).businessStudies?.treasuryEfficiencyPct ?? 0), 0) / memberViews.length) : 0;
  const academyBusinessRoutePct = memberViews.length ? round1(memberViews.reduce((sum, member) => sum + Number(asRecord(member.academyProfile).businessStudies?.routePerformancePct ?? 0), 0) / memberViews.length) : 0;
  const academyBusinessCompletionPct = memberViews.length ? round1(memberViews.reduce((sum, member) => sum + Number(asRecord(member.academyProfile).businessStudies?.trackCompletionPct ?? 0), 0) / memberViews.length) : 0;
  const academyBusinessCompletedCourses = memberViews.length ? round1(memberViews.reduce((sum, member) => sum + Number(asRecord(member.academyProfile).businessStudies?.completedCourses ?? 0), 0) / memberViews.length) : 0;
  popularity += academyBusinessYieldPct * 0.25;
  efficiency += (academyBusinessYieldPct * 0.55) + (academyBusinessTreasuryPct * 0.45);
  environment += academyBusinessRoutePct * 0.45;
  popularity = clamp(popularity - (overstaff * 4));
  efficiency = clamp(efficiency - (overstaff * 8));
  environment = clamp(environment - (overstaff * 10));
  const averageMetric = (popularity + efficiency + environment) / 3;
  const averageContribution = memberViews.length ? memberViews.reduce((sum, member) => sum + member.normalizedContribution, 0) / memberViews.length : 0;
  const performanceScore = round1(((memberViews.length / Math.max(1, employeeCapacity)) * 20) + ((filledPreferredSlots / Math.max(1, totalSlots)) * 20) + (averageContribution * 25) + ((averageMetric / 100) * 35));
  const stars = deriveConsortiumStarsFromPerformance(performanceScore);
  const baseDailyGain = getDailyConsortiumPointsForStars(stars);
  const healthBonus = averageMetric >= 90 ? 2 : averageMetric >= 70 ? 1 : 0;
  const employeeDetails = memberViews.map((member) => {
    const contributionBonus = member.normalizedContribution >= 0.9 ? 2 : member.normalizedContribution >= 0.55 ? 1 : 0;
    const personalDailyGain = baseDailyGain + healthBonus + contributionBonus + Number(member.position?.cpModifier ?? (member.roleKey === "director" ? 2 : 0));
    return { ...member, dailyCpGain: personalDailyGain };
  });
  const totalDailyGenerationBase = employeeDetails.reduce((sum, member) => sum + member.dailyCpGain, 0);
  const totalDailyGeneration = Math.max(totalDailyGenerationBase, Math.round(totalDailyGenerationBase * (1 + (academyBusinessYieldPct / 100))));
  const consortiumAcademyContract = {
    source: "education",
    businessStudies: {
      averageTrackCompletionPct: academyBusinessCompletionPct,
      averageCompletedCourses: academyBusinessCompletedCourses,
      requiredCourses: BUSINESS_STUDIES_COURSES.length,
      consortiumYieldPct: academyBusinessYieldPct,
      workerEfficiencyPct: memberViews.length ? round1(memberViews.reduce((sum, member) => sum + Number(asRecord(member.academyProfile).businessStudies?.workerEfficiencyPct ?? 0), 0) / memberViews.length) : 0,
      treasuryEfficiencyPct: academyBusinessTreasuryPct,
      routePerformancePct: academyBusinessRoutePct,
    },
  };
  const strongestMetric = Object.entries({ popularity, efficiency, environment }).sort((left, right) => right[1] - left[1])[0]?.[0] ?? "efficiency";
  const weakestMetric = Object.entries({ popularity, efficiency, environment }).sort((left, right) => left[1] - right[1])[0]?.[0] ?? "environment";
  const healthMetrics = Object.fromEntries(Object.entries(HEALTH_METRICS).map(([key, meta]) => [key, { key, label: meta.label, meaning: meta.meaning, value: round1({ popularity, efficiency, environment }[key]), rating: ({ popularity, efficiency, environment }[key]) >= 75 ? "Strong" : ({ popularity, efficiency, environment }[key]) >= 50 ? "Stable" : "Strained" }]));
  const performance = { score: performanceScore, starRating: stars, employeeCapacity, employeeCount: memberViews.length, filledPreferredSlots, totalSlots, companyDailyGeneration: totalDailyGeneration, summary: `${template.displayName} is currently led by ${HEALTH_METRICS[strongestMetric].label.toLowerCase()} while ${HEALTH_METRICS[weakestMetric].label.toLowerCase()} remains the weak seam. Business Studies link: +${academyBusinessYieldPct}% company yield.` };
  metadata.management.positions = positions;
  metadata.management.health = { popularity: round1(popularity), efficiency: round1(efficiency), environment: round1(environment), lastComputedAt: Date.now() };
  metadata.management.performance = { ...performance, lastComputedAt: Date.now() };
  const viewerDetails = employeeDetails.find((entry) => entry.userInternalId === viewerInternalId) ?? null;
  return { baseEffects, template, metadata, healthMetrics, performance, stars, baseDailyGain, employeeDetails, viewerDetails, applications: pendingApplications, employeeCapacity, totalDailyGeneration, academyContract: consortiumAcademyContract };
};
const buildDirectoryEntry = (organization, derived, viewerInternalId) => ({ internalId: organization.internalId, publicId: organization.publicId, name: organization.name, type: organization.type, description: organization.description, statusText: organization.statusText, consortiumTypeKey: organization.consortiumTypeKey, consortiumTypeName: organization.consortiumTypeName, starRating: derived.stars, employeeCapacity: derived.employeeCapacity, employeeCount: organization.members.length, treasury: normalizeTreasury(organization.treasury), healthMetrics: derived.healthMetrics, performanceSummary: derived.performance.summary, director: organization.members.find((entry) => entry.roleKey === "director") ?? organization.members[0] ?? null, pendingApplications: derived.applications.length, viewerHasPendingApplication: derived.applications.some((entry) => entry.applicantInternalId === viewerInternalId) });
const persistConsortiumMetadata = async (client, organization, derived, patch = {}) => updateOrganizationDetails(client, organization.internalId, { ...patch, metadata: { ...derived.metadata }, passiveBonusSummary: buildPassiveSummary(derived.template) });
const refreshConsortiumView = async (client, user, organization) => {
  if (!organization || organization.type !== "consortium") return { organization, consortiumProgress: null };
  const derived = await buildConsortiumState(client, organization, user.internalId);
  const progressEntry = getProgressEntry((await getRuntimeForUser(client, user)).runtimeState, derived.template.key, organization.internalId);
  const consortiumPoints = { consortiumTypeKey: derived.template.key, organizationInternalId: organization.internalId, scope: "type", points: progressEntry.points, totalEarned: progressEntry.totalEarned, totalSpent: progressEntry.totalSpent, lastClaimedAt: progressEntry.lastClaimedAt, dailyGain: derived.viewerDetails?.dailyCpGain ?? derived.baseDailyGain };
  return {
    organization: { ...organization, tag: null, treasury: normalizeTreasury(organization.treasury), metadata: derived.metadata, starRating: derived.stars, consortiumType: derived.template, rolesFlavor: derived.template.rolesFlavor, memberRoleKey: derived.viewerDetails?.roleKey ?? null, rewardLadder: derived.template.rewards, unlockedPassives: getUnlockedPassives(derived.template.key, derived.stars), redeemableActives: getActiveRewards(derived.template.key, derived.stars, consortiumPoints.points), consortiumPoints, healthMetrics: derived.healthMetrics, performance: derived.performance, academyContract: derived.academyContract, baseMechanicalEffects: derived.baseEffects, employeeCapacity: derived.employeeCapacity, companyDailyGeneration: derived.totalDailyGeneration, positions: listConsortiumPositions(derived.template.key), applications: derived.applications, memberDetails: derived.employeeDetails, yourDetails: derived.viewerDetails, companyAgeDays: getCompanyAgeDays(organization.createdAt), companyOverview: buildConsortiumOverview(organization, derived), assistanceOpportunities: buildConsortiumAssistanceOpportunities(organization, derived), layoutSections: ["Overview", "Employees", "Contracts", "Logistics", "Assets", "Finance", "Advancement"] },
    consortiumProgress: consortiumPoints,
  };
};
const applyRecoveryReduction = (runtimeState, reductionMs) => { const condition = runtimeState.player.condition ?? { type: "normal", until: null, reason: null }; if (condition.type === "hospitalized" && typeof condition.until === "number") { runtimeState.player.condition = { ...condition, until: Math.max(Date.now(), condition.until - reductionMs) }; return true; } return false; };
const addHealth = (runtimeState, amount) => { const stats = runtimeState.player.stats ?? {}; runtimeState.player.stats = { ...stats, health: Math.min(Number(stats.maxHealth ?? 100), Number(stats.health ?? 0) + amount) }; };
const grantInventoryItem = (runtimeState, itemId, quantity) => { runtimeState.player.inventory = { ...(runtimeState.player.inventory ?? {}), [itemId]: Number(runtimeState.player.inventory?.[itemId] ?? 0) + quantity }; };
const applyRewardEffect = ({ organization, template, reward, runtimeState }) => {
  const now = Date.now(); const treasury = normalizeTreasury(organization.treasury);
  switch (reward.rewardKey) {
    case "price_pulse": return { summary: "Price Pulse: Metals are currently showing the strongest legal vendor spread in Nexis." };
    case "rumor_pull": return { summary: "Rumor Pull: A licensed rumor broker flagged river toll corruption near the western freight corridor." };
    case "dossier": return { summary: "Dossier: A refined intel packet highlighted a vulnerable trade route and a cash-heavy contract origin." };
    case "network_leak": return { summary: "Network Leak: A higher-tier market leak exposed a rival consortium's strained supply channel." };
    case "forge_cache": case "reagent_cache": case "supply_crate": case "cloth_cache": case "curated_cache": case "motherlode": { const rewardItem = chooseRandomReward(reward.poolKey); if (!rewardItem) throw new HttpError(400, "Reward pool unavailable.", "CONSORTIUM_REWARD_POOL_UNAVAILABLE"); grantInventoryItem(runtimeState, rewardItem.itemId, rewardItem.quantity); return { summary: `${reward.displayName} delivered ${rewardItem.label} x${rewardItem.quantity}.`, grantedItem: rewardItem }; }
    case "field_treatment": { const reduced = applyRecoveryReduction(runtimeState, 30 * 60 * 1000); if (!reduced) addHealth(runtimeState, 25); return { summary: reduced ? "Recovery time reduced by 30 minutes." : "Recovered 25 life immediately." }; }
    case "recovery_protocol": { const reduced = applyRecoveryReduction(runtimeState, 60 * 60 * 1000); if (!reduced) addHealth(runtimeState, 40); return { summary: reduced ? "Recovery time reduced by 1 hour." : "Recovered 40 life immediately." }; }
    case "emergency_intervention": { const reduced = applyRecoveryReduction(runtimeState, 4 * MS_HOUR); if (!reduced) { const stats = runtimeState.player.stats ?? {}; runtimeState.player.stats = { ...stats, health: Number(stats.maxHealth ?? 100) }; } return { summary: reduced ? "Emergency support cut recovery by 4 hours." : "Life fully restored within current rules." }; }
    case "credit_line": treasury.gold += 5000; return { summary: "Treasury received a controlled 5,000 gold credit injection.", treasury };
    default: appendActiveEffect(runtimeState, template.key, { rewardKey: reward.rewardKey, displayName: reward.displayName, effectSummary: reward.effectSummary, grantedAt: now, charges: 1 }); return { summary: reward.effectSummary };
  }
};
export async function getOrganizationByPublicIdForUser(user, type, publicIdInput) {
  return withTransaction(async (client) => {
    const publicId = normalizeOrganizationPublicId(publicIdInput, type);
    const organization = await findOrganizationByPublicId(client, publicId);
    if (!organization || organization.type !== type) throw new HttpError(404,       `${type === "guild" ? "Guild" : "Consortium"} record unavailable.`, "ORG_NOT_FOUND");
    return type === "guild"
      ? refreshGuildView(client, user, organization)
      : refreshConsortiumView(client, user, organization);
  });
}

export async function getMyOrganization(user, type) {
  return withTransaction(async (client) => {
    const organization = await findOrganizationForUserByType(client, user.internalId, type);
    const hydrated = type === "guild" ? await refreshGuildView(client, user, organization) : await refreshConsortiumView(client, user, organization);
    if (type !== "consortium") {
      return hydrated;
    }

    const directory = [];
    const consortiums = await listOrganizationsByType(client, "consortium");
    for (const entry of consortiums) {
      directory.push(buildDirectoryEntry(entry, await buildConsortiumState(client, entry, user.internalId), user.internalId));
    }

    return {
      ...hydrated,
      consortiumTemplates: listConsortiumTypes(),
      directory,
    };
  });
}

export async function createOrganizationForUser(user, payload) {
  const type = String(payload?.type ?? ""); if (type !== "guild" && type !== "consortium") throw new HttpError(400, "Organization type must be guild or consortium.", "ORG_TYPE_REQUIRED");
  return withTransaction(async (client) => {
    const existing = await findOrganizationForUserByType(client, user.internalId, type); if (existing) throw new HttpError(409, `You already operate a ${type}.`, "ORG_ALREADY_EXISTS");
    const { runtimeState } = await getRuntimeForUser(client, user); const name = normalizeName(payload?.name, type === "guild" ? "Guild name" : "Consortium name"); const template = type === "consortium" ? getConsortiumTypeDefinition(payload?.consortiumTypeKey) : null; if (type === "consortium" && !template) throw new HttpError(400, "Valid consortium type is required.", "CONSORTIUM_TYPE_REQUIRED");
    // Education hard-gate: Civic Fundamentals -> consortium founding only. Guild founding shares this
    // function but is intentionally NOT gated here -- the design doc's gate is specific to consortiums.
    if (type === "consortium" && !hasCompletedCourse(runtimeState, "civic-fundamentals")) throw new HttpError(403, "Civic Fundamentals is required before founding a consortium.", "EDUCATION_LOCKED");
    const cost = type === "guild" ? getGuildFoundationCost(runtimeState) : getConsortiumFoundationCost(runtimeState, template); if (runtimeState.player.gold < cost) throw new HttpError(400, `Not enough gold to found this ${type}.`, "ORG_FUNDS_REQUIRED");
    runtimeState.player.gold -= cost; runtimeState.player.currencies = { ...runtimeState.player.currencies, gold: runtimeState.player.gold };
    const organization = await createOrganization(client, { internalId: `org_${crypto.randomUUID()}`, publicId: await allocateNextPublicNumericId(client, type, getFirstOrganizationPublicId(type)), type, name, tag: type === "guild" ? normalizeTag(payload?.tag) : null, founderInternalId: user.internalId, founderPublicId: user.publicId, description: type === "guild" ? "A live guild charter with public doctrine, internal command, dungeons, passives, and an armory instead of vague promises." : template.description, statusText: type === "guild" ? "Recruiting" : "Operational", consortiumTypeKey: template?.key ?? null, consortiumTypeName: template?.displayName ?? null, passiveBonusSummary: template ? buildPassiveSummary(template) : "", creationCost: cost, treasury: { copper: 0, silver: 0, gold: 0, platinum: 0 }, metadata: type === "consortium" ? { companyStyle: true, rewardTiers: template.rewards.map((entry) => entry.starTier), rolesFlavor: template.rolesFlavor, management: { positions: {}, applications: [], outreach: { level: 0, campaignsLaunched: 0, lastRunAt: null }, health: {}, performance: {} } } : { guild: { publicProfile: { headline: `${name} moves quietly, cuts deeply, and recruits with standards.`, recruitmentStatus: "Recruiting disciplined members", doctrine: "Strike clean, vanish cleaner.", territory: "Nexis City", diplomacy: "Open to respectful accords, allergic to clowns.", publicNotice: "Visitors see the banner. Members see the machinery." }, passives: { reputation: 120, totalEarned: 120, totalSpent: 0, everUnlocked: [], activeSpecializations: [], respecCount: 0, lastRespecAt: null, rally: { active: false, activatedAt: null, expiresAt: null, lastTriggeredAt: null } }, wars: { doctrine: "Precision Strikes", activeWars: [], history: [] }, adventuring: { lastRunAt: null, currentQuest: null, lastCrew: [], history: [] }, armory: { items: {} }, settings: { invitePolicy: "Officer Approval", warDoctrine: "Precision Strikes" } } } });
    const roles = type === "guild" ? buildGuildRoles() : buildConsortiumRoles(template); await replaceOrganizationRoles(client, organization.internalId, roles); await addOrganizationMember(client, organization.internalId, { userInternalId: user.internalId, userPublicId: user.publicId, displayName: founderDisplayName(user), roleKey: roles[0].roleKey }); await insertOrganizationLog(client, organization.internalId, { actorInternalId: user.internalId, actorPublicId: user.publicId, actionType: "organization_created", summary: { type, name: organization.name, publicId: organization.publicId, creationCost: cost, consortiumTypeKey: template?.key ?? null } });
    let hydratedOrganization = await findOrganizationByInternalId(client, organization.internalId);
    if (type === "consortium") { const derived = await buildConsortiumState(client, hydratedOrganization, user.internalId); hydratedOrganization = await persistConsortiumMetadata(client, hydratedOrganization, derived); syncMembershipSummary(runtimeState, hydratedOrganization, template, derived.stars, roles[0].roleKey); setProgressEntry(runtimeState, template.key, getProgressEntry(runtimeState, template.key, hydratedOrganization.internalId)); }
    else syncGuildMembershipSummary(runtimeState, hydratedOrganization, roles[0].roleKey);
    const playerState = await upsertPlayerRuntimeState(client, user.internalId, runtimeState); const result = type === "guild" ? await refreshGuildView(client, user, hydratedOrganization) : await refreshConsortiumView(client, user, hydratedOrganization); return { ...result, playerState };
  });
}

export async function addOrganizationMemberForUser(user, organizationInternalId, payload) {
  return withTransaction(async (client) => {
    const organization = await findOrganizationByInternalId(client, organizationInternalId); if (!organization || organization.type !== "consortium") throw new HttpError(404, "Consortium record unavailable.", "CONSORTIUM_NOT_FOUND");
    const actorMember = ensureMember(organization, user.internalId); ensurePermission(organization, actorMember, "manage_members");
    const targetUser = await findUserByPublicId(client, normalizePublicId(payload?.publicId)); if (!targetUser) throw new HttpError(404, "Target citizen record unavailable.", "TARGET_USER_NOT_FOUND"); if (targetUser.internalId === user.internalId) throw new HttpError(400, "You are already the director.", "CONSORTIUM_MEMBER_INVALID");
    if (await findOrganizationForUserByType(client, targetUser.internalId, "consortium")) throw new HttpError(409, "That citizen already belongs to a consortium.", "CONSORTIUM_MEMBER_EXISTS");
    const employeeRole = organization.roles.find((entry) => entry.roleKey === "employee") ?? organization.roles[organization.roles.length - 1]; await addOrganizationMember(client, organization.internalId, { userInternalId: targetUser.internalId, userPublicId: targetUser.publicId, displayName: founderDisplayName(targetUser), roleKey: employeeRole.roleKey }); await insertOrganizationLog(client, organization.internalId, { actorInternalId: user.internalId, actorPublicId: user.publicId, actionType: "member_added", summary: { targetPublicId: targetUser.publicId, targetName: founderDisplayName(targetUser), roleKey: employeeRole.roleKey } });
    let refreshed = await findOrganizationByInternalId(client, organization.internalId); refreshed = await persistConsortiumMetadata(client, refreshed, await buildConsortiumState(client, refreshed, user.internalId)); return refreshConsortiumView(client, user, refreshed);
  });
}

export async function applyToConsortiumForUser(user, organizationInternalId, payload) {
  return withTransaction(async (client) => {
    const organization = await findOrganizationByInternalId(client, organizationInternalId); if (!organization || organization.type !== "consortium") throw new HttpError(404, "Consortium record unavailable.", "CONSORTIUM_NOT_FOUND"); if (await findOrganizationForUserByType(client, user.internalId, "consortium")) throw new HttpError(409, "You already belong to a consortium.", "CONSORTIUM_MEMBER_EXISTS");
    const template = getConsortiumTypeDefinition(organization.consortiumTypeKey); const metadata = normalizeManagement(organization, template); if (metadata.management.applications.some((entry) => entry.applicantInternalId === user.internalId)) throw new HttpError(409, "You already have a pending application with this consortium.", "CONSORTIUM_APPLICATION_EXISTS");
    const { playerState } = await getRuntimeForUser(client, user); metadata.management.applications.unshift({ applicantInternalId: user.internalId, applicantPublicId: user.publicId, applicantName: founderDisplayName(user), note: sanitizeApplicationNote(payload?.note), submittedAt: Date.now(), workingStats: normalizeWorkingStats(playerState.workingStats) });
    await updateOrganizationDetails(client, organization.internalId, { metadata }); await insertOrganizationLog(client, organization.internalId, { actorInternalId: user.internalId, actorPublicId: user.publicId, actionType: "consortium_application_submitted", summary: { applicantPublicId: user.publicId } });
    return { ok: true };
  });
}

export async function reviewConsortiumApplicationForUser(user, organizationInternalId, payload) {
  return withTransaction(async (client) => {
    const organization = await findOrganizationByInternalId(client, organizationInternalId); if (!organization || organization.type !== "consortium") throw new HttpError(404, "Consortium record unavailable.", "CONSORTIUM_NOT_FOUND"); const actorMember = ensureMember(organization, user.internalId); ensurePermission(organization, actorMember, "manage_members");
    const template = getConsortiumTypeDefinition(organization.consortiumTypeKey); const metadata = normalizeManagement(organization, template); const applicantPublicId = normalizePublicId(payload?.applicantPublicId); const decision = String(payload?.decision ?? "").toLowerCase(); const application = metadata.management.applications.find((entry) => Number(entry.applicantPublicId) === applicantPublicId); if (!application) throw new HttpError(404, "Application record unavailable.", "CONSORTIUM_APPLICATION_NOT_FOUND");
    metadata.management.applications = metadata.management.applications.filter((entry) => Number(entry.applicantPublicId) !== applicantPublicId);
    let updated = organization;
    if (decision === "accept") { const targetUser = await findUserByPublicId(client, applicantPublicId); if (!targetUser) throw new HttpError(404, "Applicant record unavailable.", "TARGET_USER_NOT_FOUND"); if (await findOrganizationForUserByType(client, targetUser.internalId, "consortium")) throw new HttpError(409, "Applicant already joined another consortium.", "CONSORTIUM_MEMBER_EXISTS"); const employeeRole = organization.roles.find((entry) => entry.roleKey === "employee") ?? organization.roles[organization.roles.length - 1]; await addOrganizationMember(client, organization.internalId, { userInternalId: targetUser.internalId, userPublicId: targetUser.publicId, displayName: founderDisplayName(targetUser), roleKey: employeeRole.roleKey }); updated = await findOrganizationByInternalId(client, organization.internalId); const derived = await buildConsortiumState(client, { ...updated, metadata: { ...updated.metadata, ...metadata } }, user.internalId); updated = await persistConsortiumMetadata(client, updated, derived); const { runtimeState } = await getRuntimeForUser(client, targetUser); syncMembershipSummary(runtimeState, updated, template, derived.stars, employeeRole.roleKey); await upsertPlayerRuntimeState(client, targetUser.internalId, runtimeState); await insertOrganizationLog(client, organization.internalId, { actorInternalId: user.internalId, actorPublicId: user.publicId, actionType: "consortium_application_accepted", summary: { applicantPublicId } }); }
    else { updated = await updateOrganizationDetails(client, organization.internalId, { metadata }); await insertOrganizationLog(client, organization.internalId, { actorInternalId: user.internalId, actorPublicId: user.publicId, actionType: "consortium_application_rejected", summary: { applicantPublicId } }); }
    return refreshConsortiumView(client, user, updated);
  });
}

export async function assignConsortiumPositionForUser(user, organizationInternalId, payload) {
  return withTransaction(async (client) => {
    const organization = await findOrganizationByInternalId(client, organizationInternalId); if (!organization || organization.type !== "consortium") throw new HttpError(404, "Consortium record unavailable.", "CONSORTIUM_NOT_FOUND"); const actorMember = ensureMember(organization, user.internalId); ensurePermission(organization, actorMember, "manage_members"); const targetPublicId = normalizePublicId(payload?.publicId); const positionKey = String(payload?.positionKey ?? "").trim(); const targetMember = organization.members.find((entry) => entry.publicId === targetPublicId); if (!targetMember) throw new HttpError(404, "Employee record unavailable.", "CONSORTIUM_MEMBER_NOT_FOUND"); if (targetMember.roleKey === "director" && positionKey !== "director") throw new HttpError(400, "The director slot is fixed for now.", "CONSORTIUM_POSITION_DIRECTOR_LOCKED"); if (!getConsortiumPositionDefinition(organization.consortiumTypeKey, positionKey)) throw new HttpError(400, "Position is invalid for this consortium type.", "CONSORTIUM_POSITION_INVALID"); const template = getConsortiumTypeDefinition(organization.consortiumTypeKey); const metadata = normalizeManagement(organization, template); metadata.management.positions[targetMember.userInternalId] = positionKey; const updated = await persistConsortiumMetadata(client, organization, await buildConsortiumState(client, { ...organization, metadata: { ...organization.metadata, ...metadata } }, user.internalId)); await insertOrganizationLog(client, organization.internalId, { actorInternalId: user.internalId, actorPublicId: user.publicId, actionType: "consortium_position_assigned", summary: { targetPublicId, positionKey } }); return refreshConsortiumView(client, user, updated); });
}

export async function removeConsortiumMemberForUser(user, organizationInternalId, payload) {
  return withTransaction(async (client) => {
    const organization = await findOrganizationByInternalId(client, organizationInternalId); if (!organization || organization.type !== "consortium") throw new HttpError(404, "Consortium record unavailable.", "CONSORTIUM_NOT_FOUND"); const actorMember = ensureMember(organization, user.internalId); ensurePermission(organization, actorMember, "manage_members"); const targetPublicId = normalizePublicId(payload?.publicId); const targetMember = organization.members.find((entry) => entry.publicId === targetPublicId); if (!targetMember || targetMember.roleKey === "director") throw new HttpError(400, "Only non-director employees can be removed in this pass.", "CONSORTIUM_MEMBER_REMOVE_INVALID"); await removeOrganizationMember(client, organization.internalId, targetMember.userInternalId); const template = getConsortiumTypeDefinition(organization.consortiumTypeKey); const metadata = normalizeManagement(organization, template); delete metadata.management.positions[targetMember.userInternalId]; const updated = await persistConsortiumMetadata(client, await findOrganizationByInternalId(client, organization.internalId), await buildConsortiumState(client, { ...(await findOrganizationByInternalId(client, organization.internalId)), metadata: { ...organization.metadata, ...metadata } }, user.internalId)); const targetUser = await findUserByPublicId(client, targetPublicId); if (targetUser) { const { runtimeState } = await getRuntimeForUser(client, targetUser); clearMembershipSummary(runtimeState); await upsertPlayerRuntimeState(client, targetUser.internalId, runtimeState); } await insertOrganizationLog(client, organization.internalId, { actorInternalId: user.internalId, actorPublicId: user.publicId, actionType: "consortium_member_removed", summary: { targetPublicId } }); return refreshConsortiumView(client, user, updated); });
}

export async function depositConsortiumTreasuryForUser(user, organizationInternalId, payload) {
  return withTransaction(async (client) => {
    const organization = await findOrganizationByInternalId(client, organizationInternalId); if (!organization || organization.type !== "consortium") throw new HttpError(404, "Consortium record unavailable.", "CONSORTIUM_NOT_FOUND"); const actorMember = ensureMember(organization, user.internalId); ensurePermission(organization, actorMember, "manage_treasury"); const amount = asInt(payload?.gold); if (amount <= 0) throw new HttpError(400, "Deposit amount must be greater than zero.", "CONSORTIUM_TREASURY_AMOUNT_INVALID"); const { runtimeState } = await getRuntimeForUser(client, user); if (Number(runtimeState.player.gold ?? 0) < amount) throw new HttpError(400, "Not enough gold for that treasury deposit.", "CONSORTIUM_TREASURY_FUNDS_REQUIRED"); runtimeState.player.gold -= amount; runtimeState.player.currencies = { ...runtimeState.player.currencies, gold: runtimeState.player.gold }; const playerState = await upsertPlayerRuntimeState(client, user.internalId, runtimeState); const updated = await persistConsortiumMetadata(client, organization, await buildConsortiumState(client, { ...organization, treasury: { ...normalizeTreasury(organization.treasury), gold: normalizeTreasury(organization.treasury).gold + amount } }, user.internalId), { treasury: { gold: normalizeTreasury(organization.treasury).gold + amount } }); await insertOrganizationLog(client, organization.internalId, { actorInternalId: user.internalId, actorPublicId: user.publicId, actionType: "consortium_treasury_deposit", summary: { gold: amount } }); return { ...(await refreshConsortiumView(client, user, updated)), playerState }; });
}

export async function runConsortiumOutreachForUser(user, organizationInternalId) {
  return withTransaction(async (client) => {
    const organization = await findOrganizationByInternalId(client, organizationInternalId); if (!organization || organization.type !== "consortium") throw new HttpError(404, "Consortium record unavailable.", "CONSORTIUM_NOT_FOUND"); const actorMember = ensureMember(organization, user.internalId); ensurePermission(organization, actorMember, "recruit_members"); const template = getConsortiumTypeDefinition(organization.consortiumTypeKey); const metadata = normalizeManagement(organization, template); const treasury = normalizeTreasury(organization.treasury); if (treasury.gold < 2500) throw new HttpError(400, "Treasury needs at least 2,500 gold for outreach.", "CONSORTIUM_OUTREACH_FUNDS_REQUIRED"); if (metadata.management.outreach.lastRunAt && Date.now() - metadata.management.outreach.lastRunAt < 6 * MS_HOUR) throw new HttpError(409, "Outreach is already running. Let the posters dry first.", "CONSORTIUM_OUTREACH_COOLDOWN"); metadata.management.outreach = { level: Math.min(6, asInt(metadata.management.outreach.level) + 1), campaignsLaunched: asInt(metadata.management.outreach.campaignsLaunched) + 1, lastRunAt: Date.now() }; const updated = await persistConsortiumMetadata(client, organization, await buildConsortiumState(client, { ...organization, treasury: { ...treasury, gold: treasury.gold - 2500 }, metadata: { ...organization.metadata, ...metadata } }, user.internalId), { treasury: { gold: treasury.gold - 2500 }, statusText: "Outreach campaign underway" }); await insertOrganizationLog(client, organization.internalId, { actorInternalId: user.internalId, actorPublicId: user.publicId, actionType: "consortium_outreach_launched", summary: { goldSpent: 2500, outreachLevel: metadata.management.outreach.level } }); return refreshConsortiumView(client, user, updated); });
}

export async function claimDailyConsortiumPointsForUser(user, organizationInternalId) {
  return withTransaction(async (client) => {
    const organization = await findOrganizationByInternalId(client, organizationInternalId); if (!organization || organization.type !== "consortium") throw new HttpError(404, "Consortium record unavailable.", "CONSORTIUM_NOT_FOUND"); const template = getConsortiumTypeDefinition(organization.consortiumTypeKey); const member = ensureMember(organization, user.internalId); const { runtimeState } = await getRuntimeForUser(client, user); const derived = await buildConsortiumState(client, organization, user.internalId); const progressEntry = getProgressEntry(runtimeState, template.key, organization.internalId); if (sameUtcDay(progressEntry.lastClaimedAt, Date.now())) throw new HttpError(409, "Daily Consortium Points already claimed today.", "CONSORTIUM_POINTS_ALREADY_CLAIMED"); const dailyGain = derived.viewerDetails?.dailyCpGain ?? getDailyConsortiumPointsForStars(derived.stars); const updatedProgress = { ...progressEntry, organizationInternalId: organization.internalId, points: progressEntry.points + dailyGain, totalEarned: progressEntry.totalEarned + dailyGain, lastClaimedAt: Date.now() }; setProgressEntry(runtimeState, template.key, updatedProgress); syncMembershipSummary(runtimeState, organization, template, derived.stars, member.roleKey); const playerState = await upsertPlayerRuntimeState(client, user.internalId, runtimeState); await insertOrganizationLog(client, organization.internalId, { actorInternalId: user.internalId, actorPublicId: user.publicId, actionType: "consortium_points_claimed", summary: { consortiumTypeKey: template.key, stars: derived.stars, dailyGain, pointsAfter: updatedProgress.points } }); return { ...(await refreshConsortiumView(client, user, organization)), playerState, grant: dailyGain }; });
}

export async function redeemConsortiumRewardForUser(user, organizationInternalId, payload) {
  return withTransaction(async (client) => {
    const organization = await findOrganizationByInternalId(client, organizationInternalId); if (!organization || organization.type !== "consortium") throw new HttpError(404, "Consortium record unavailable.", "CONSORTIUM_NOT_FOUND"); const template = getConsortiumTypeDefinition(organization.consortiumTypeKey); const reward = getRewardByKey(template.key, String(payload?.rewardKey ?? "").trim()); if (!reward || reward.mode !== "active") throw new HttpError(400, "That consortium reward cannot be redeemed.", "CONSORTIUM_REWARD_INVALID"); const member = ensureMember(organization, user.internalId); const { runtimeState } = await getRuntimeForUser(client, user); const derived = await buildConsortiumState(client, organization, user.internalId); if (derived.stars < reward.starTier) throw new HttpError(400, `This reward unlocks at ${reward.starTier}?.`, "CONSORTIUM_REWARD_LOCKED"); const progressEntry = getProgressEntry(runtimeState, template.key, organization.internalId); const cost = Number(reward.pointCost ?? 0); if (progressEntry.points < cost) throw new HttpError(400, `You need ${cost - progressEntry.points} more Consortium Points.`, "CONSORTIUM_POINTS_REQUIRED"); const rewardResult = applyRewardEffect({ organization, template, reward, runtimeState }); setProgressEntry(runtimeState, template.key, { ...progressEntry, organizationInternalId: organization.internalId, points: progressEntry.points - cost, totalSpent: progressEntry.totalSpent + cost }); syncMembershipSummary(runtimeState, organization, template, derived.stars, member.roleKey); const playerState = await upsertPlayerRuntimeState(client, user.internalId, runtimeState); const updatedOrganization = rewardResult.treasury ? await updateOrganizationDetails(client, organization.internalId, { treasury: rewardResult.treasury }) : organization; await insertOrganizationLog(client, organization.internalId, { actorInternalId: user.internalId, actorPublicId: user.publicId, actionType: "consortium_reward_redeemed", summary: { consortiumTypeKey: template.key, rewardKey: reward.rewardKey, rewardName: reward.displayName, pointCost: cost, result: rewardResult.summary, grantedItem: rewardResult.grantedItem ?? null } }); return { ...(await refreshConsortiumView(client, user, updatedOrganization)), playerState, rewardResult }; });
}

export async function planGuildQuestForUser(user, organizationInternalId, payload) {
  return withTransaction(async (client) => {
    const organization = await findOrganizationByInternalId(client, organizationInternalId);
    if (!organization || organization.type !== "guild") throw new HttpError(404, "Guild record unavailable.", "GUILD_NOT_FOUND");
    const actorMember = ensureMember(organization, user.internalId);
    ensurePermission(organization, actorMember, "declare_operations");
    const quest = getGuildQuestTemplate(String(payload?.questKey ?? "").trim());
    if (!quest) throw new HttpError(400, "Guild quest unavailable.", "GUILD_QUEST_INVALID");
    const metadata = normalizeGuildMetadata(organization);
    if (metadata.guild.adventuring.currentQuest?.questKey) throw new HttpError(409, "Another guild quest is already in planning.", "GUILD_QUEST_ALREADY_PLANNED");
    if (organization.members.length < quest.requiredMembers) throw new HttpError(400, `Requires ${quest.requiredMembers} guild members.`, "GUILD_QUEST_MEMBERS_REQUIRED");
    metadata.guild.adventuring.currentQuest = {
      questKey: quest.key,
      plannedAt: Date.now(),
      readyAt: Date.now() + (quest.planningHours * MS_HOUR),
      plannedByPublicId: user.publicId,
      plannedByName: founderDisplayName(user),
      assignments: {},
      previousCrew: [],
    };
    const updated = await updateOrganizationDetails(client, organization.internalId, { metadata, statusText: `Planning ${quest.displayName}` });
    await insertOrganizationLog(client, organization.internalId, { actorInternalId: user.internalId, actorPublicId: user.publicId, actionType: "guild_quest_planned", summary: { questKey: quest.key, displayName: quest.displayName, planningHours: quest.planningHours } });
    return refreshGuildView(client, user, updated);
  });
}

export async function assignGuildQuestMemberForUser(user, organizationInternalId, payload) {
  return withTransaction(async (client) => {
    const organization = await findOrganizationByInternalId(client, organizationInternalId);
    if (!organization || organization.type !== "guild") throw new HttpError(404, "Guild record unavailable.", "GUILD_NOT_FOUND");
    const actorMember = ensureMember(organization, user.internalId);
    ensurePermission(organization, actorMember, "declare_operations");
    const metadata = normalizeGuildMetadata(organization);
    const currentQuest = normalizeGuildQuestPlan(metadata.guild.adventuring.currentQuest);
    const quest = getGuildQuestTemplate(currentQuest.questKey);
    if (!quest) throw new HttpError(409, "No guild quest is currently being planned.", "GUILD_QUEST_NOT_PLANNED");
    const slotKey = String(payload?.slotKey ?? "").trim();
    const slot = quest.slots.find((entry) => entry.slotKey === slotKey);
    if (!slot) throw new HttpError(400, "Quest slot unavailable.", "GUILD_QUEST_SLOT_INVALID");
    const targetPublicId = normalizePublicId(payload?.publicId);
    const targetMember = organization.members.find((entry) => entry.publicId === targetPublicId);
    if (!targetMember) throw new HttpError(404, "That citizen is not in your guild.", "GUILD_QUEST_MEMBER_NOT_FOUND");
    const duplicateSlot = Object.entries(currentQuest.assignments).find(([key, entry]) => key !== slotKey && asRecord(entry).userInternalId === targetMember.userInternalId);
    if (duplicateSlot) throw new HttpError(409, "That member is already assigned to another role in this quest.", "GUILD_QUEST_MEMBER_ALREADY_ASSIGNED");
    currentQuest.assignments[slotKey] = {
      userInternalId: targetMember.userInternalId,
      publicId: targetMember.publicId,
      displayName: targetMember.displayName,
      roleKey: targetMember.roleKey,
    };
    metadata.guild.adventuring.currentQuest = currentQuest;
    const updated = await updateOrganizationDetails(client, organization.internalId, { metadata });
    await insertOrganizationLog(client, organization.internalId, { actorInternalId: user.internalId, actorPublicId: user.publicId, actionType: "guild_quest_member_assigned", summary: { questKey: quest.key, slotKey, targetPublicId } });
    return refreshGuildView(client, user, updated);
  });
}

export async function cancelGuildQuestForUser(user, organizationInternalId) {
  return withTransaction(async (client) => {
    const organization = await findOrganizationByInternalId(client, organizationInternalId);
    if (!organization || organization.type !== "guild") throw new HttpError(404, "Guild record unavailable.", "GUILD_NOT_FOUND");
    const actorMember = ensureMember(organization, user.internalId);
    ensurePermission(organization, actorMember, "declare_operations");
    const metadata = normalizeGuildMetadata(organization);
    const currentQuest = normalizeGuildQuestPlan(metadata.guild.adventuring.currentQuest);
    const quest = getGuildQuestTemplate(currentQuest.questKey);
    if (!quest) throw new HttpError(409, "No guild quest is currently being planned.", "GUILD_QUEST_NOT_PLANNED");
    metadata.guild.adventuring.currentQuest = null;
    const updated = await updateOrganizationDetails(client, organization.internalId, { metadata, statusText: "Recruiting" });
    await insertOrganizationLog(client, organization.internalId, { actorInternalId: user.internalId, actorPublicId: user.publicId, actionType: "guild_quest_cancelled", summary: { questKey: quest.key } });
    return refreshGuildView(client, user, updated);
  });
}

export async function replanGuildQuestForUser(user, organizationInternalId) {
  return withTransaction(async (client) => {
    const organization = await findOrganizationByInternalId(client, organizationInternalId);
    if (!organization || organization.type !== "guild") throw new HttpError(404, "Guild record unavailable.", "GUILD_NOT_FOUND");
    const actorMember = ensureMember(organization, user.internalId);
    ensurePermission(organization, actorMember, "declare_operations");
    const metadata = normalizeGuildMetadata(organization);
    if (metadata.guild.adventuring.currentQuest?.questKey) throw new HttpError(409, "Finish or cancel the current quest plan first.", "GUILD_QUEST_ALREADY_PLANNED");
    const lastHistory = metadata.guild.adventuring.history[0];
    const quest = getGuildQuestTemplate(lastHistory?.questKey);
    const lastCrew = Array.isArray(metadata.guild.adventuring.lastCrew) ? metadata.guild.adventuring.lastCrew : [];
    if (!quest || !lastCrew.length) throw new HttpError(400, "No recent guild quest crew is available to plan again.", "GUILD_QUEST_REPLAN_UNAVAILABLE");
    const assignments = {};
    lastCrew.forEach((entry) => {
      const row = asRecord(entry);
      const slotKey = String(row.slotKey ?? "");
      if (!slotKey) return;
      assignments[slotKey] = {
        userInternalId: row.userInternalId,
        publicId: asInt(row.publicId),
        displayName: String(row.displayName ?? ""),
        roleKey: String(row.roleKey ?? "member"),
      };
    });
    metadata.guild.adventuring.currentQuest = {
      questKey: quest.key,
      plannedAt: Date.now(),
      readyAt: Date.now() + (quest.planningHours * MS_HOUR),
      plannedByPublicId: user.publicId,
      plannedByName: founderDisplayName(user),
      assignments,
      previousCrew: lastCrew.map((entry) => asInt(asRecord(entry).publicId)).filter(Boolean),
    };
    const updated = await updateOrganizationDetails(client, organization.internalId, { metadata, statusText: `Planning ${quest.displayName} again` });
    await insertOrganizationLog(client, organization.internalId, { actorInternalId: user.internalId, actorPublicId: user.publicId, actionType: "guild_quest_replanned", summary: { questKey: quest.key } });
    return refreshGuildView(client, user, updated);
  });
}

export async function initiateGuildQuestForUser(user, organizationInternalId) {
  return withTransaction(async (client) => {
    const organization = await findOrganizationByInternalId(client, organizationInternalId);
    if (!organization || organization.type !== "guild") throw new HttpError(404, "Guild record unavailable.", "GUILD_NOT_FOUND");
    const actorMember = ensureMember(organization, user.internalId);
    ensurePermission(organization, actorMember, "declare_operations");
    const derived = await buildGuildState(client, organization, user.internalId);
    const currentPlan = derived.guildQuestBoard?.currentPlan;
    if (!currentPlan) throw new HttpError(409, "No guild quest is currently being planned.", "GUILD_QUEST_NOT_PLANNED");
    if (!currentPlan.canInitiate) throw new HttpError(400, currentPlan.blockedReason ?? "Guild quest is not ready to initiate.", "GUILD_QUEST_NOT_READY");
    const quest = getGuildQuestTemplate(currentPlan.questKey);
    if (!quest) throw new HttpError(400, "Guild quest unavailable.", "GUILD_QUEST_INVALID");
    const metadata = derived.metadata;
    const memberProfiles = [];
    for (const slot of currentPlan.slots) {
      const assigned = slot.assignedMember;
      if (!assigned) {
        memberProfiles.push(null);
        continue;
      }
      const member = organization.members.find((entry) => entry.userInternalId === assigned.userInternalId);
      if (!member) {
        memberProfiles.push(null);
        continue;
      }
      const state = await findPlayerStateByUserInternalId(client, member.userInternalId);
      memberProfiles.push({
        ...member,
        displayName: assigned.displayName,
        level: Number(state?.level ?? 1),
        battleTotal: Number(state?.battleStats?.strength ?? 0) + Number(state?.battleStats?.defense ?? 0) + Number(state?.battleStats?.speed ?? 0) + Number(state?.battleStats?.dexterity ?? 0),
        workingStats: normalizeWorkingStats(state?.workingStats),
      });
    }
    const participants = memberProfiles.filter(Boolean);
    const specializationEffects = computeGuildSpecializationEffects(metadata.guild.passives.activeSpecializations);
    const guildBaseFx = asRecord(derived.baseEffects).effects ?? {};
    const baseQuestPowerPct = Number(guildBaseFx.questPowerPct ?? 0);
    const baseDungeonFlat = Number(guildBaseFx.dungeonPowerFlat ?? 0);
    const rally = metadata.guild.passives.rally;
    const rallyConsumed = Boolean(rally.active && Number(rally.expiresAt ?? 0) > Date.now());
    const successScoreBase = round1(currentPlan.slots.reduce((sum, slot) => {
      const assigned = participants.find((member) => member.userInternalId === slot.assignedMember?.userInternalId);
      return sum + (assigned ? getGuildQuestFocusScore(slot.focus, assigned) : 0);
    }, 0) + (Number(derived.warRoom?.readiness ?? 0) * 0.8) + specializationEffects.successFlat + specializationEffects.successCountBoost + (baseDungeonFlat * 0.75));
    let successScore = round1(successScoreBase * specializationEffects.successMultiplier * (1 + (baseQuestPowerPct / 100)));
    if (rallyConsumed) {
      successScore = round1(successScore * (1 + specializationEffects.rallyBonusPct));
      metadata.guild.passives.rally = { ...rally, active: false };
    }
    const succeeded = successScore >= quest.powerFloor;
    const failureFloor = specializationEffects.failurePayoutFloor ?? null;
    const reputationFailurePct = failureFloor ?? 0.38;
    const treasuryFailurePct = failureFloor ?? 0.22;
    const memberFailurePct = failureFloor ?? 0.35;
    const reputationMultiplier = specializationEffects.reputationMultiplier(false);
    const reputationGain = Math.round((succeeded ? quest.reputationReward : Math.max(35, Math.round(quest.reputationReward * reputationFailurePct))) * reputationMultiplier);
    const treasuryGoldGain = succeeded
      ? Math.round(quest.treasuryGoldReward * specializationEffects.treasuryGoldMultiplier)
      : Math.max(400, Math.round(quest.treasuryGoldReward * treasuryFailurePct));
    const memberGoldGain = succeeded
      ? Math.round(quest.memberGoldReward * specializationEffects.memberGoldMultiplier)
      : Math.max(100, Math.round(quest.memberGoldReward * memberFailurePct));
    for (const member of participants) {
      const targetUser = await findUserByPublicId(client, member.publicId);
      if (!targetUser) continue;
      const { runtimeState } = await getRuntimeForUser(client, targetUser);
      runtimeState.player.gold = Number(runtimeState.player.gold ?? 0) + memberGoldGain;
      runtimeState.player.currencies = { ...(runtimeState.player.currencies ?? {}), gold: runtimeState.player.gold };
      if (specializationEffects.medicalRecoveryReductionPct > 0) applyRecoveryReductionPct(runtimeState, specializationEffects.medicalRecoveryReductionPct);
      await upsertPlayerRuntimeState(client, targetUser.internalId, runtimeState);
    }
    metadata.guild.adventuring.lastRunAt = Date.now();
    metadata.guild.adventuring.lastCrew = currentPlan.slots.map((slot) => ({
      slotKey: slot.slotKey,
      userInternalId: slot.assignedMember?.userInternalId ?? null,
      publicId: slot.assignedMember?.publicId ?? null,
      displayName: slot.assignedMember?.displayName ?? "",
      roleKey: organization.members.find((entry) => entry.userInternalId === slot.assignedMember?.userInternalId)?.roleKey ?? "member",
    }));
    metadata.guild.adventuring.currentQuest = null;
    metadata.guild.adventuring.history = [{
      questKey: quest.key,
      displayName: quest.displayName,
      summary: succeeded
        ? `${quest.displayName} concluded successfully and the guild returned with profit, reputation, and fewer excuses than usual.`
        : `${quest.displayName} went poorly, but the guild still dragged home lessons, bruises, and a reduced payout.`,
      outcome: succeeded ? "success" : "failure",
      createdAt: Date.now(),
      reputationGain,
      treasuryGoldGain,
      participantPublicIds: participants.map((member) => member.publicId),
    }, ...metadata.guild.adventuring.history].slice(0, 12);
    metadata.guild.passives.reputation += reputationGain;
    metadata.guild.passives.totalEarned += reputationGain;
    if (succeeded) {
      metadata.guild.armory.items.raid_token = asInt(metadata.guild.armory.items.raid_token) + 1;
      metadata.guild.armory.items.guild_cache = asInt(metadata.guild.armory.items.guild_cache) + 1;
    }
    const updated = await updateOrganizationDetails(client, organization.internalId, {
      treasury: { gold: normalizeTreasury(organization.treasury).gold + treasuryGoldGain },
      metadata,
      statusText: succeeded ? `${quest.displayName} completed` : `${quest.displayName} failed`,
    });
    await insertOrganizationLog(client, organization.internalId, {
      actorInternalId: user.internalId,
      actorPublicId: user.publicId,
      actionType: "guild_quest_initiated",
      summary: { questKey: quest.key, succeeded, successScore, reputationGain, treasuryGoldGain, memberGoldGain, rallyConsumed, participants: participants.map((member) => member.publicId) },
    });
    return refreshGuildView(client, user, updated);
  });
}

export async function updateGuildSettingsForUser(user, organizationInternalId, payload) {
  return withTransaction(async (client) => {
    const organization = await findOrganizationByInternalId(client, organizationInternalId);
    if (!organization || organization.type !== "guild") throw new HttpError(404, "Guild record unavailable.", "GUILD_NOT_FOUND");
    const actorMember = ensureMember(organization, user.internalId);
    ensurePermission(organization, actorMember, "declare_operations");
    const metadata = normalizeGuildMetadata(organization);
    metadata.guild.publicProfile = {
      headline: String(payload?.headline ?? metadata.guild.publicProfile.headline).trim().slice(0, 120),
      recruitmentStatus: String(payload?.recruitmentStatus ?? metadata.guild.publicProfile.recruitmentStatus).trim().slice(0, 80),
      doctrine: String(payload?.doctrine ?? metadata.guild.publicProfile.doctrine).trim().slice(0, 120),
      territory: String(payload?.territory ?? metadata.guild.publicProfile.territory).trim().slice(0, 80),
      diplomacy: String(payload?.diplomacy ?? metadata.guild.publicProfile.diplomacy).trim().slice(0, 120),
      publicNotice: String(payload?.publicNotice ?? metadata.guild.publicProfile.publicNotice).trim().slice(0, 220),
    };
    metadata.guild.settings = {
      invitePolicy: String(payload?.invitePolicy ?? metadata.guild.settings.invitePolicy).trim().slice(0, 60),
      warDoctrine: String(payload?.warDoctrine ?? metadata.guild.settings.warDoctrine).trim().slice(0, 60),
    };
    metadata.guild.wars.doctrine = metadata.guild.settings.warDoctrine;
    const updated = await updateOrganizationDetails(client, organization.internalId, { description: metadata.guild.publicProfile.headline, statusText: metadata.guild.publicProfile.recruitmentStatus, metadata });
    await insertOrganizationLog(client, organization.internalId, { actorInternalId: user.internalId, actorPublicId: user.publicId, actionType: "guild_settings_updated", summary: { recruitmentStatus: metadata.guild.publicProfile.recruitmentStatus, warDoctrine: metadata.guild.settings.warDoctrine } });
    return refreshGuildView(client, user, updated);
  });
}

export async function recruitGuildMemberForUser(user, organizationInternalId, payload) {
  return withTransaction(async (client) => {
    const organization = await findOrganizationByInternalId(client, organizationInternalId);
    if (!organization || organization.type !== "guild") throw new HttpError(404, "Guild record unavailable.", "GUILD_NOT_FOUND");
    const actorMember = ensureMember(organization, user.internalId);
    ensurePermission(organization, actorMember, "recruit_members");
    const targetPublicId = normalizePublicId(payload?.publicId);
    const targetUser = await findUserByPublicId(client, targetPublicId);
    if (!targetUser) throw new HttpError(404, "Target citizen record unavailable.", "TARGET_USER_NOT_FOUND");
    if (targetUser.internalId === user.internalId) throw new HttpError(400, "You already run this guild, dramatic as that would be.", "GUILD_MEMBER_INVALID");
    if (await findOrganizationForUserByType(client, targetUser.internalId, "guild")) throw new HttpError(409, "That citizen already belongs to a guild.", "GUILD_MEMBER_EXISTS");
    const memberRole = organization.roles.find((entry) => entry.roleKey === "member") ?? organization.roles[organization.roles.length - 1];
    await addOrganizationMember(client, organization.internalId, { userInternalId: targetUser.internalId, userPublicId: targetUser.publicId, displayName: founderDisplayName(targetUser), roleKey: memberRole.roleKey });
    const { runtimeState } = await getRuntimeForUser(client, targetUser);
    syncGuildMembershipSummary(runtimeState, organization, memberRole.roleKey);
    await upsertPlayerRuntimeState(client, targetUser.internalId, runtimeState);
    const metadata = normalizeGuildMetadata(await findOrganizationByInternalId(client, organization.internalId));
    const recruitReputationBase = 45;
    const recruitMultiplier = computeGuildSpecializationEffects(metadata.guild.passives.activeSpecializations).reputationMultiplier(true);
    const recruitReputationGain = Math.round(recruitReputationBase * recruitMultiplier);
    metadata.guild.passives.reputation += recruitReputationGain;
    metadata.guild.passives.totalEarned += recruitReputationGain;
    const updated = await updateOrganizationDetails(client, organization.internalId, { metadata });
    await insertOrganizationLog(client, organization.internalId, { actorInternalId: user.internalId, actorPublicId: user.publicId, actionType: "guild_member_recruited", summary: { targetPublicId, reputationGain: recruitReputationGain } });
    return refreshGuildView(client, user, updated);
  });
}

// Activates a specialization into an open slot (activeSpecializations.length < GUILD_SPECIALIZATION_CAP).
// First-time activation of a key costs guild skill points; re-activating something the guild already
// paid for (i.e. it's still in everUnlocked from an earlier stint, just currently benched) is free of
// points -- but note it can only ever get benched via swapGuildSkillForUser(), which is the gold-gated
// action, so this alone can never be used to cycle specializations for free. Leader/officer only
// (declare_operations), enforced server-side below -- a plain "member" role lacks that permission and
// ensurePermission() throws a 403.
export async function unlockGuildSkillForUser(user, organizationInternalId, payload) {
  return withTransaction(async (client) => {
    const organization = await findOrganizationByInternalId(client, organizationInternalId);
    if (!organization || organization.type !== "guild") throw new HttpError(404, "Guild record unavailable.", "GUILD_NOT_FOUND");
    const actorMember = ensureMember(organization, user.internalId);
    ensurePermission(organization, actorMember, "declare_operations");
    const skillKey = String(payload?.skillKey ?? "").trim();
    const node = findGuildSpecialization(skillKey);
    if (!node) throw new HttpError(400, "Guild specialization unavailable.", "GUILD_SKILL_INVALID");
    const metadata = normalizeGuildMetadata(organization);
    const passives = metadata.guild.passives;
    if (passives.activeSpecializations.includes(skillKey)) throw new HttpError(409, "That specialization is already active.", "GUILD_SKILL_EXISTS");
    if (passives.activeSpecializations.length >= GUILD_SPECIALIZATION_CAP) throw new HttpError(409, `Only ${GUILD_SPECIALIZATION_CAP} specializations can be active at once. Swap one out first.`, "GUILD_SKILL_CAP_REACHED");
    const alreadyLearned = passives.everUnlocked.includes(skillKey);
    if (!alreadyLearned) {
      const availablePoints = Math.max(0, Math.floor(passives.reputation / 120) - passives.totalSpent);
      if (availablePoints < node.pointCost) throw new HttpError(400, "Not enough guild skill points.", "GUILD_SKILL_POINTS_REQUIRED");
      passives.everUnlocked = [...passives.everUnlocked, node.key];
      passives.totalSpent += node.pointCost;
    }
    passives.activeSpecializations = [...passives.activeSpecializations, node.key];
    const updated = await updateOrganizationDetails(client, organization.internalId, { passiveBonusSummary: passives.activeSpecializations.map(getGuildSkillSummary).join(", "), metadata });
    await insertOrganizationLog(client, organization.internalId, { actorInternalId: user.internalId, actorPublicId: user.publicId, actionType: "guild_skill_unlocked", summary: { skillKey, wasAlreadyLearned: alreadyLearned } });
    return refreshGuildView(client, user, updated);
  });
}

// Swaps one active specialization for another -- the only way to change your active loadout once you
// (or a future purchase) fill it. Costs GUILD_SKILL_RESPEC_GOLD_COST from the guild treasury every time,
// which is what makes this a real decision instead of a free daily toggle; if the incoming specialization
// was never learned before, its point cost is charged on top. Leader/officer only (declare_operations).
export async function swapGuildSkillForUser(user, organizationInternalId, payload) {
  return withTransaction(async (client) => {
    const organization = await findOrganizationByInternalId(client, organizationInternalId);
    if (!organization || organization.type !== "guild") throw new HttpError(404, "Guild record unavailable.", "GUILD_NOT_FOUND");
    const actorMember = ensureMember(organization, user.internalId);
    ensurePermission(organization, actorMember, "declare_operations");
    const activateKey = String(payload?.activateKey ?? "").trim();
    const deactivateKey = String(payload?.deactivateKey ?? "").trim();
    const activateNode = findGuildSpecialization(activateKey);
    if (!activateNode) throw new HttpError(400, "Guild specialization unavailable.", "GUILD_SKILL_INVALID");
    const metadata = normalizeGuildMetadata(organization);
    const passives = metadata.guild.passives;
    if (!passives.activeSpecializations.includes(deactivateKey)) throw new HttpError(400, "That specialization is not currently active.", "GUILD_SKILL_NOT_ACTIVE");
    if (passives.activeSpecializations.includes(activateKey)) throw new HttpError(409, "That specialization is already active.", "GUILD_SKILL_EXISTS");
    const treasury = normalizeTreasury(organization.treasury);
    if (treasury.gold < GUILD_SKILL_RESPEC_GOLD_COST) throw new HttpError(400, `Swapping specializations costs ${GUILD_SKILL_RESPEC_GOLD_COST.toLocaleString("en-GB")} gold from the guild treasury.`, "GUILD_SKILL_RESPEC_FUNDS_REQUIRED");
    const alreadyLearned = passives.everUnlocked.includes(activateKey);
    if (!alreadyLearned) {
      const availablePoints = Math.max(0, Math.floor(passives.reputation / 120) - passives.totalSpent);
      if (availablePoints < activateNode.pointCost) throw new HttpError(400, "Not enough guild skill points for the incoming specialization.", "GUILD_SKILL_POINTS_REQUIRED");
      passives.everUnlocked = [...passives.everUnlocked, activateNode.key];
      passives.totalSpent += activateNode.pointCost;
    }
    passives.activeSpecializations = [...passives.activeSpecializations.filter((entry) => entry !== deactivateKey), activateKey];
    passives.respecCount += 1;
    passives.lastRespecAt = Date.now();
    const updated = await updateOrganizationDetails(client, organization.internalId, {
      treasury: { gold: treasury.gold - GUILD_SKILL_RESPEC_GOLD_COST },
      passiveBonusSummary: passives.activeSpecializations.map(getGuildSkillSummary).join(", "),
      metadata,
    });
    await insertOrganizationLog(client, organization.internalId, { actorInternalId: user.internalId, actorPublicId: user.publicId, actionType: "guild_skill_respec", summary: { activateKey, deactivateKey, goldCost: GUILD_SKILL_RESPEC_GOLD_COST } });
    return refreshGuildView(client, user, updated);
  });
}

// Leader/officer-triggered guild-wide buff (the Chaining branch's Strike Cadence node): follows the same
// treasury-cost + cooldown pattern as runConsortiumOutreachForUser() rather than inventing a new
// action-resolution system. Requires "strike_cadence" to currently be an active specialization. The
// resulting bonus is consumed by the next guild quest or dungeon delve initiation (see
// initiateGuildQuestForUser()/launchGuildDungeonForUser()).
export async function triggerGuildRallyForUser(user, organizationInternalId) {
  return withTransaction(async (client) => {
    const organization = await findOrganizationByInternalId(client, organizationInternalId);
    if (!organization || organization.type !== "guild") throw new HttpError(404, "Guild record unavailable.", "GUILD_NOT_FOUND");
    const actorMember = ensureMember(organization, user.internalId);
    ensurePermission(organization, actorMember, "declare_operations");
    const metadata = normalizeGuildMetadata(organization);
    const passives = metadata.guild.passives;
    if (!passives.activeSpecializations.includes("strike_cadence")) throw new HttpError(400, "Strike Cadence is not an active specialization.", "GUILD_RALLY_INACTIVE");
    const cooldownRemaining = Number(passives.rally.lastTriggeredAt ?? 0) + GUILD_RALLY_COOLDOWN_MS - Date.now();
    if (cooldownRemaining > 0) throw new HttpError(409, "Strike Cadence is still cooling down.", "GUILD_RALLY_COOLDOWN");
    const treasury = normalizeTreasury(organization.treasury);
    if (treasury.gold < GUILD_RALLY_GOLD_COST) throw new HttpError(400, `Strike Cadence costs ${GUILD_RALLY_GOLD_COST.toLocaleString("en-GB")} gold from the guild treasury.`, "GUILD_RALLY_FUNDS_REQUIRED");
    const now = Date.now();
    passives.rally = { active: true, activatedAt: now, expiresAt: now + GUILD_RALLY_WINDOW_MS, lastTriggeredAt: now };
    const updated = await updateOrganizationDetails(client, organization.internalId, { treasury: { gold: treasury.gold - GUILD_RALLY_GOLD_COST }, metadata });
    await insertOrganizationLog(client, organization.internalId, { actorInternalId: user.internalId, actorPublicId: user.publicId, actionType: "guild_rally_triggered", summary: { goldCost: GUILD_RALLY_GOLD_COST, expiresAt: passives.rally.expiresAt } });
    return refreshGuildView(client, user, updated);
  });
}

export async function depositGuildArmoryForUser(user, organizationInternalId, payload) {
  return withTransaction(async (client) => {
    const organization = await findOrganizationByInternalId(client, organizationInternalId);
    if (!organization || organization.type !== "guild") throw new HttpError(404, "Guild record unavailable.", "GUILD_NOT_FOUND");
    const actorMember = ensureMember(organization, user.internalId);
    if (!["guildmaster", "officer", "member"].includes(actorMember.roleKey)) throw new HttpError(403, "Only guild members may use the armory.", "GUILD_ARMORY_PERMISSION_DENIED");
    const itemId = String(payload?.itemId ?? "").trim();
    const quantity = asInt(payload?.quantity);
    if (!itemId || quantity <= 0) throw new HttpError(400, "Item and quantity are required.", "GUILD_ARMORY_ITEM_REQUIRED");
    const { runtimeState } = await getRuntimeForUser(client, user);
    const currentQty = asInt(runtimeState.player.inventory?.[itemId]);
    if (currentQty < quantity) throw new HttpError(400, "You do not have enough of that item to deposit.", "GUILD_ARMORY_FUNDS_REQUIRED");
    runtimeState.player.inventory = { ...(runtimeState.player.inventory ?? {}), [itemId]: currentQty - quantity };
    if (runtimeState.player.inventory[itemId] <= 0) delete runtimeState.player.inventory[itemId];
    const playerState = await upsertPlayerRuntimeState(client, user.internalId, runtimeState);
    const metadata = normalizeGuildMetadata(organization);
    const depositMultiplier = computeGuildSpecializationEffects(metadata.guild.passives.activeSpecializations).armoryDepositMultiplier;
    const creditedQuantity = Math.round(quantity * depositMultiplier);
    metadata.guild.armory.items[itemId] = asInt(metadata.guild.armory.items[itemId]) + creditedQuantity;
    const updated = await updateOrganizationDetails(client, organization.internalId, { metadata });
    await insertOrganizationLog(client, organization.internalId, { actorInternalId: user.internalId, actorPublicId: user.publicId, actionType: "guild_armory_deposit", summary: { itemId, quantity, creditedQuantity } });
    return { ...(await refreshGuildView(client, user, updated)), playerState };
  });
}

export async function withdrawGuildArmoryForUser(user, organizationInternalId, payload) {
  return withTransaction(async (client) => {
    const organization = await findOrganizationByInternalId(client, organizationInternalId);
    if (!organization || organization.type !== "guild") throw new HttpError(404, "Guild record unavailable.", "GUILD_NOT_FOUND");
    const actorMember = ensureMember(organization, user.internalId);
    ensurePermission(organization, actorMember, "manage_treasury");
    const itemId = String(payload?.itemId ?? "").trim();
    const quantity = asInt(payload?.quantity);
    if (!itemId || quantity <= 0) throw new HttpError(400, "Item and quantity are required.", "GUILD_ARMORY_ITEM_REQUIRED");
    const metadata = normalizeGuildMetadata(organization);
    const storedQty = asInt(metadata.guild.armory.items[itemId]);
    if (storedQty < quantity) throw new HttpError(400, "Guild armory does not hold that many.", "GUILD_ARMORY_STOCK_REQUIRED");
    metadata.guild.armory.items[itemId] = storedQty - quantity;
    if (metadata.guild.armory.items[itemId] <= 0) delete metadata.guild.armory.items[itemId];
    const updated = await updateOrganizationDetails(client, organization.internalId, { metadata });
    const { runtimeState } = await getRuntimeForUser(client, user);
    runtimeState.player.inventory = { ...(runtimeState.player.inventory ?? {}), [itemId]: asInt(runtimeState.player.inventory?.[itemId]) + quantity };
    const playerState = await upsertPlayerRuntimeState(client, user.internalId, runtimeState);
    await insertOrganizationLog(client, organization.internalId, { actorInternalId: user.internalId, actorPublicId: user.publicId, actionType: "guild_armory_withdraw", summary: { itemId, quantity } });
    return { ...(await refreshGuildView(client, user, updated)), playerState };
  });
}

export async function launchGuildDungeonForUser(user, organizationInternalId, payload) {
  return withTransaction(async (client) => {
    const organization = await findOrganizationByInternalId(client, organizationInternalId);
    if (!organization || organization.type !== "guild") throw new HttpError(404, "Guild record unavailable.", "GUILD_NOT_FOUND");
    const actorMember = ensureMember(organization, user.internalId);
    ensurePermission(organization, actorMember, "declare_operations");
    const dungeonKey = String(payload?.dungeonKey ?? "").trim();
    const dungeon = GUILD_DUNGEONS.find((entry) => entry.key === dungeonKey);
    if (!dungeon) throw new HttpError(400, "Dungeon operation unavailable.", "GUILD_DUNGEON_INVALID");
    const derived = await buildGuildState(client, organization, user.internalId);
    if (derived.memberDetails.length < dungeon.minMembers) throw new HttpError(400, `Requires ${dungeon.minMembers} members.`, "GUILD_DUNGEON_MEMBERS_REQUIRED");
    const lastRunAt = Number(derived.metadata.guild.adventuring.lastRunAt ?? 0);
    if (Date.now() - lastRunAt < dungeon.cooldownHours * MS_HOUR) throw new HttpError(409, "Guild adventuring is still on cooldown.", "GUILD_DUNGEON_COOLDOWN");
    const guildBaseFx = asRecord(derived.baseEffects).effects ?? {};
    const metadata = derived.metadata;
    const specializationEffects = computeGuildSpecializationEffects(metadata.guild.passives.activeSpecializations);
    const rally = metadata.guild.passives.rally;
    const rallyConsumed = Boolean(rally.active && Number(rally.expiresAt ?? 0) > Date.now());
    const successRatingBase = derived.memberDetails.reduce((sum, member) => sum + member.level, 0) + specializationEffects.successFlat + specializationEffects.successCountBoost + (derived.warRoom.readiness / 4) + Number(guildBaseFx.dungeonPowerFlat ?? 0);
    let successRating = round1(successRatingBase * specializationEffects.successMultiplier * (1 + (Number(guildBaseFx.questPowerPct ?? 0) / 100)));
    if (rallyConsumed) {
      successRating = round1(successRating * (1 + specializationEffects.rallyBonusPct));
      metadata.guild.passives.rally = { ...rally, active: false };
    }
    const succeeded = successRating >= dungeon.recommendedPower;
    const failureFloor = specializationEffects.failurePayoutFloor;
    const reputationGain = Math.round((succeeded ? dungeon.reputationReward : Math.max(25, Math.round(dungeon.reputationReward * (failureFloor ?? 0.35)))) * specializationEffects.reputationMultiplier(false));
    const goldGain = succeeded
      ? Math.round(dungeon.goldReward * specializationEffects.treasuryGoldMultiplier)
      : Math.max(150, Math.round(dungeon.goldReward * (failureFloor ?? 0.25)));
    metadata.guild.adventuring.lastRunAt = Date.now();
    metadata.guild.adventuring.history = [{ dungeonKey, displayName: dungeon.displayName, summary: succeeded ? `${dungeon.displayName} was cleared cleanly.` : `${dungeon.displayName} turned ugly, but the guild still learned something.`, createdAt: Date.now() }, ...metadata.guild.adventuring.history].slice(0, 8);
    metadata.guild.passives.reputation += reputationGain;
    metadata.guild.passives.totalEarned += reputationGain;
    if (succeeded) {
      metadata.guild.armory.items.raid_token = asInt(metadata.guild.armory.items.raid_token) + 1;
    }
    if (specializationEffects.medicalRecoveryReductionPct > 0) {
      for (const member of organization.members) {
        const targetUser = await findUserByPublicId(client, member.publicId);
        if (!targetUser) continue;
        const { runtimeState } = await getRuntimeForUser(client, targetUser);
        if (applyRecoveryReductionPct(runtimeState, specializationEffects.medicalRecoveryReductionPct)) {
          await upsertPlayerRuntimeState(client, targetUser.internalId, runtimeState);
        }
      }
    }
    const updated = await updateOrganizationDetails(client, organization.internalId, { treasury: { gold: normalizeTreasury(organization.treasury).gold + goldGain }, metadata, statusText: succeeded ? "Dungeon success recorded" : "Recovering after a rough delve" });
    await insertOrganizationLog(client, organization.internalId, { actorInternalId: user.internalId, actorPublicId: user.publicId, actionType: "guild_dungeon_launched", summary: { dungeonKey, succeeded, reputationGain, goldGain, rallyConsumed } });
    return refreshGuildView(client, user, updated);
  });
}

export { listConsortiumTypes };
