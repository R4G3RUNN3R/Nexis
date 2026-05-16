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
const GUILD_SKILL_TREE = [
  { key: "banner_discipline", displayName: "Banner Discipline", tier: 1, pointCost: 1, effectSummary: "Members earn reputation more steadily from guild actions.", prerequisites: [] },
  { key: "quartermaster_cache", displayName: "Quartermaster Cache", tier: 1, pointCost: 1, effectSummary: "Guild armory deposits and dungeon spoils come in a little cleaner.", prerequisites: [] },
  { key: "dungeon_cunning", displayName: "Dungeon Cunning", tier: 2, pointCost: 2, effectSummary: "Dungeon runs gain stronger success odds and reputation payouts.", prerequisites: ["banner_discipline"] },
  { key: "war_college", displayName: "War College", tier: 2, pointCost: 2, effectSummary: "Improves war readiness and member combat coordination.", prerequisites: ["banner_discipline"] },
  { key: "shadow_logistics", displayName: "Shadow Logistics", tier: 3, pointCost: 3, effectSummary: "Treasury discipline and operation support both improve.", prerequisites: ["quartermaster_cache", "dungeon_cunning"] },
  { key: "sovereign_doctrine", displayName: "Sovereign Doctrine", tier: 4, pointCost: 4, effectSummary: "A capstone doctrine that sharpens readiness, reputation flow, and guild prestige.", prerequisites: ["war_college", "shadow_logistics"] },
];
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
      passives: {
        reputation: asInt(passives.reputation),
        totalEarned: asInt(passives.totalEarned),
        totalSpent: asInt(passives.totalSpent),
        unlockedSkills: Array.isArray(passives.unlockedSkills) ? passives.unlockedSkills.filter((entry) => typeof entry === "string") : [],
      },
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
const getGuildSkillSummary = (skillKey) => GUILD_SKILL_TREE.find((entry) => entry.key === skillKey)?.effectSummary ?? titleCase(skillKey);
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
  const unlockedSkills = guild.passives.unlockedSkills;
  const skillBonus = unlockedSkills.length * 6;
  const academyReadinessPct = memberCount ? round1(memberProfiles.reduce((sum, member) => sum + Number(asRecord(member.academyProfile).adventuringSurvival?.guildReadinessPct ?? 0), 0) / memberCount) : 0;
  const academySurvivalPct = memberCount ? round1(memberProfiles.reduce((sum, member) => sum + Number(asRecord(member.academyProfile).adventuringSurvival?.operationSurvivalPct ?? 0), 0) / memberCount) : 0;
  const academyBattleEdgePct = memberCount ? round1(memberProfiles.reduce((sum, member) => sum + Number(asRecord(member.academyProfile).adventuringSurvival?.battleEdgePct ?? 0), 0) / memberCount) : 0;
  const academyTrackCompletionPct = memberCount ? round1(memberProfiles.reduce((sum, member) => sum + Number(asRecord(member.academyProfile).adventuringSurvival?.trackCompletionPct ?? 0), 0) / memberCount) : 0;
  const academyTrackCompletedCourses = memberCount ? round1(memberProfiles.reduce((sum, member) => sum + Number(asRecord(member.academyProfile).adventuringSurvival?.completedCourses ?? 0), 0) / memberCount) : 0;
  const readinessBase = 26 + (combinedBattle / Math.max(1, memberCount * 18)) + (averageLevel * 2) + skillBonus;
  const readiness = clamp(readinessBase * (1 + (academyReadinessPct / 100)) * (1 + (Number(asRecord(baseEffects).effects?.questPowerPct ?? 0) / 300)), 0, 220);
  const warRating = round1((((combinedBattle * (1 + (academyBattleEdgePct / 100))) / Math.max(1, memberCount))) + (readiness * 1.6) + Number(asRecord(baseEffects).effects?.dungeonPowerFlat ?? 0));
  const reputation = guild.passives.reputation;
  const totalSkillCostSpent = unlockedSkills.reduce((sum, key) => sum + Number(GUILD_SKILL_TREE.find((entry) => entry.key === key)?.pointCost ?? 0), 0);
  const totalPointsEarned = Math.max(asInt(guild.passives.totalEarned), Math.floor(reputation / 120));
  const availablePoints = Math.max(0, totalPointsEarned - totalSkillCostSpent);
  const dailyRenownBase = (memberCount * 6) + averageLevel + (skillBonus / 2);
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
  const skillTree = GUILD_SKILL_TREE.map((entry) => ({
    ...entry,
    unlocked: unlockedSkills.includes(entry.key),
  }));
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
    guildPassives: { reputation, totalEarned: Math.max(asInt(guild.passives.totalEarned), reputation), totalSpent: totalSkillCostSpent, availablePoints, dailyRenown },
    baseEffects,
    academyContract: guildAcademyContract,
    skillTree,
    armory: { items: armoryItems },
    settingsView: { invitePolicy: guild.settings.invitePolicy, warDoctrine: guild.settings.warDoctrine, publicProfile: guild.publicProfile },
    viewerPermissions: viewerRole?.permissions ?? [],
  };
};
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
    organization: { ...organization, tag: null, treasury: normalizeTreasury(organization.treasury), metadata: derived.metadata, starRating: derived.stars, consortiumType: derived.template, rolesFlavor: derived.template.rolesFlavor, memberRoleKey: derived.viewerDetails?.roleKey ?? null, rewardLadder: derived.template.rewards, unlockedPassives: getUnlockedPassives(derived.template.key, derived.stars), redeemableActives: getActiveRewards(derived.template.key, derived.stars, consortiumPoints.points), consortiumPoints, healthMetrics: derived.healthMetrics, performance: derived.performance, academyContract: derived.academyContract, baseMechanicalEffects: derived.baseEffects, employeeCapacity: derived.employeeCapacity, companyDailyGeneration: derived.totalDailyGeneration, positions: listConsortiumPositions(derived.template.key), applications: derived.applications, memberDetails: derived.employeeDetails, yourDetails: derived.viewerDetails, companyAgeDays: getCompanyAgeDays(organization.createdAt) },
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
    const cost = type === "guild" ? getGuildFoundationCost(runtimeState) : getConsortiumFoundationCost(runtimeState, template); if (runtimeState.player.gold < cost) throw new HttpError(400, `Not enough gold to found this ${type}.`, "ORG_FUNDS_REQUIRED");
    runtimeState.player.gold -= cost; runtimeState.player.currencies = { ...runtimeState.player.currencies, gold: runtimeState.player.gold };
    const organization = await createOrganization(client, { internalId: `org_${crypto.randomUUID()}`, publicId: await allocateNextPublicNumericId(client, type, getFirstOrganizationPublicId(type)), type, name, tag: type === "guild" ? normalizeTag(payload?.tag) : null, founderInternalId: user.internalId, founderPublicId: user.publicId, description: type === "guild" ? "A live guild charter with public doctrine, internal command, dungeons, passives, and an armory instead of vague promises." : template.description, statusText: type === "guild" ? "Recruiting" : "Operational", consortiumTypeKey: template?.key ?? null, consortiumTypeName: template?.displayName ?? null, passiveBonusSummary: template ? buildPassiveSummary(template) : "", creationCost: cost, treasury: { copper: 0, silver: 0, gold: 0, platinum: 0 }, metadata: type === "consortium" ? { companyStyle: true, rewardTiers: template.rewards.map((entry) => entry.starTier), rolesFlavor: template.rolesFlavor, management: { positions: {}, applications: [], outreach: { level: 0, campaignsLaunched: 0, lastRunAt: null }, health: {}, performance: {} } } : { guild: { publicProfile: { headline: `${name} moves quietly, cuts deeply, and recruits with standards.`, recruitmentStatus: "Recruiting disciplined members", doctrine: "Strike clean, vanish cleaner.", territory: "Nexis City", diplomacy: "Open to respectful accords, allergic to clowns.", publicNotice: "Visitors see the banner. Members see the machinery." }, passives: { reputation: 120, totalEarned: 120, totalSpent: 0, unlockedSkills: [] }, wars: { doctrine: "Precision Strikes", activeWars: [], history: [] }, adventuring: { lastRunAt: null, currentQuest: null, lastCrew: [], history: [] }, armory: { items: {} }, settings: { invitePolicy: "Officer Approval", warDoctrine: "Precision Strikes" } } } });
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
    const skillBoost = metadata.guild.passives.unlockedSkills.length * 10;
    const guildBaseFx = asRecord(derived.baseEffects).effects ?? {};
    const baseQuestPowerPct = Number(guildBaseFx.questPowerPct ?? 0);
    const baseDungeonFlat = Number(guildBaseFx.dungeonPowerFlat ?? 0);
    const successScoreBase = round1(currentPlan.slots.reduce((sum, slot) => {
      const assigned = participants.find((member) => member.userInternalId === slot.assignedMember?.userInternalId);
      return sum + (assigned ? getGuildQuestFocusScore(slot.focus, assigned) : 0);
    }, 0) + (Number(derived.warRoom?.readiness ?? 0) * 0.8) + skillBoost + (baseDungeonFlat * 0.75));
    const successScore = round1(successScoreBase * (1 + (baseQuestPowerPct / 100)));
    const succeeded = successScore >= quest.powerFloor;
    const reputationGain = succeeded ? quest.reputationReward : Math.max(35, Math.round(quest.reputationReward * 0.38));
    const treasuryGoldGain = succeeded ? quest.treasuryGoldReward : Math.max(400, Math.round(quest.treasuryGoldReward * 0.22));
    const memberGoldGain = succeeded ? quest.memberGoldReward : Math.max(100, Math.round(quest.memberGoldReward * 0.35));
    for (const member of participants) {
      const targetUser = await findUserByPublicId(client, member.publicId);
      if (!targetUser) continue;
      const { runtimeState } = await getRuntimeForUser(client, targetUser);
      runtimeState.player.gold = Number(runtimeState.player.gold ?? 0) + memberGoldGain;
      runtimeState.player.currencies = { ...(runtimeState.player.currencies ?? {}), gold: runtimeState.player.gold };
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
      summary: { questKey: quest.key, succeeded, successScore, reputationGain, treasuryGoldGain, memberGoldGain, participants: participants.map((member) => member.publicId) },
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
    metadata.guild.passives.reputation += 45;
    metadata.guild.passives.totalEarned += 45;
    const updated = await updateOrganizationDetails(client, organization.internalId, { metadata });
    await insertOrganizationLog(client, organization.internalId, { actorInternalId: user.internalId, actorPublicId: user.publicId, actionType: "guild_member_recruited", summary: { targetPublicId } });
    return refreshGuildView(client, user, updated);
  });
}

export async function unlockGuildSkillForUser(user, organizationInternalId, payload) {
  return withTransaction(async (client) => {
    const organization = await findOrganizationByInternalId(client, organizationInternalId);
    if (!organization || organization.type !== "guild") throw new HttpError(404, "Guild record unavailable.", "GUILD_NOT_FOUND");
    const actorMember = ensureMember(organization, user.internalId);
    ensurePermission(organization, actorMember, "declare_operations");
    const skillKey = String(payload?.skillKey ?? "").trim();
    const node = GUILD_SKILL_TREE.find((entry) => entry.key === skillKey);
    if (!node) throw new HttpError(400, "Guild skill unavailable.", "GUILD_SKILL_INVALID");
    const metadata = normalizeGuildMetadata(organization);
    const unlockedSkills = metadata.guild.passives.unlockedSkills;
    if (unlockedSkills.includes(skillKey)) throw new HttpError(409, "Guild skill already unlocked.", "GUILD_SKILL_EXISTS");
    const missingPrereq = node.prerequisites.find((entry) => !unlockedSkills.includes(entry));
    if (missingPrereq) throw new HttpError(400, `Requires ${titleCase(missingPrereq.replace(/_/g, " "))} first.`, "GUILD_SKILL_PREREQ");
    const availablePoints = Math.max(0, Math.floor(metadata.guild.passives.reputation / 120) - unlockedSkills.reduce((sum, key) => sum + Number(GUILD_SKILL_TREE.find((entry) => entry.key === key)?.pointCost ?? 0), 0));
    if (availablePoints < node.pointCost) throw new HttpError(400, "Not enough guild skill points.", "GUILD_SKILL_POINTS_REQUIRED");
    metadata.guild.passives.unlockedSkills = [...unlockedSkills, node.key];
    metadata.guild.passives.totalSpent += node.pointCost;
    const updated = await updateOrganizationDetails(client, organization.internalId, { passiveBonusSummary: metadata.guild.passives.unlockedSkills.map(getGuildSkillSummary).join(", "), metadata });
    await insertOrganizationLog(client, organization.internalId, { actorInternalId: user.internalId, actorPublicId: user.publicId, actionType: "guild_skill_unlocked", summary: { skillKey } });
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
    metadata.guild.armory.items[itemId] = asInt(metadata.guild.armory.items[itemId]) + quantity;
    const updated = await updateOrganizationDetails(client, organization.internalId, { metadata });
    await insertOrganizationLog(client, organization.internalId, { actorInternalId: user.internalId, actorPublicId: user.publicId, actionType: "guild_armory_deposit", summary: { itemId, quantity } });
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
    const successRatingBase = derived.memberDetails.reduce((sum, member) => sum + member.level, 0) + (derived.guildPassives.availablePoints * 4) + (derived.warRoom.readiness / 4) + Number(guildBaseFx.dungeonPowerFlat ?? 0);
    const successRating = round1(successRatingBase * (1 + (Number(guildBaseFx.questPowerPct ?? 0) / 100)));
    const succeeded = successRating >= dungeon.recommendedPower;
    const reputationGain = succeeded ? dungeon.reputationReward : Math.max(25, Math.round(dungeon.reputationReward * 0.35));
    const goldGain = succeeded ? dungeon.goldReward : Math.max(150, Math.round(dungeon.goldReward * 0.25));
    const metadata = derived.metadata;
    metadata.guild.adventuring.lastRunAt = Date.now();
    metadata.guild.adventuring.history = [{ dungeonKey, displayName: dungeon.displayName, summary: succeeded ? `${dungeon.displayName} was cleared cleanly.` : `${dungeon.displayName} turned ugly, but the guild still learned something.`, createdAt: Date.now() }, ...metadata.guild.adventuring.history].slice(0, 8);
    metadata.guild.passives.reputation += reputationGain;
    metadata.guild.passives.totalEarned += reputationGain;
    if (succeeded) {
      metadata.guild.armory.items.raid_token = asInt(metadata.guild.armory.items.raid_token) + 1;
    }
    const updated = await updateOrganizationDetails(client, organization.internalId, { treasury: { gold: normalizeTreasury(organization.treasury).gold + goldGain }, metadata, statusText: succeeded ? "Dungeon success recorded" : "Recovering after a rough delve" });
    await insertOrganizationLog(client, organization.internalId, { actorInternalId: user.internalId, actorPublicId: user.publicId, actionType: "guild_dungeon_launched", summary: { dungeonKey, succeeded, reputationGain, goldGain } });
    return refreshGuildView(client, user, updated);
  });
}

export { listConsortiumTypes };
