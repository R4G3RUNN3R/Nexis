import crypto from "node:crypto";
import { PLAYER_PUBLIC_ID_BASE, RESERVED_PLAYER_PUBLIC_ID_COUNT } from "../config/env.js";
import { withTransaction } from "../db/pool.js";
import { HttpError } from "../lib/errors.js";
import { buildMutableRuntimeState } from "../lib/runtimePlayerState.js";
import {
  addOrganizationMember,
  createOrganization,
  findOrganizationByInternalId,
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

const FIRST_ORGANIZATION_PUBLIC_ID = PLAYER_PUBLIC_ID_BASE + RESERVED_PLAYER_PUBLIC_ID_COUNT;
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
  { roleKey: "guildmaster", displayName: "Guildmaster", rankOrder: 1, permissions: ["manage_members", "manage_treasury", "declare_operations"], isSystemRole: true },
  { roleKey: "officer", displayName: "Officer", rankOrder: 2, permissions: ["recruit_members", "view_logs"], isSystemRole: true },
  { roleKey: "member", displayName: "Member", rankOrder: 3, permissions: ["participate"], isSystemRole: true },
];
const buildConsortiumRoles = (template) => [
  { roleKey: "director", displayName: "Director", rankOrder: 1, permissions: ["manage_members", "manage_treasury", "manage_contracts", "recruit_members", "view_logs"], isSystemRole: true },
  { roleKey: "specialist", displayName: titleCase(template.rolesFlavor[1] ?? "Specialist"), rankOrder: 2, permissions: ["recruit_members", "view_logs"], isSystemRole: true },
  { roleKey: "employee", displayName: titleCase(template.rolesFlavor[2] ?? "Employee"), rankOrder: 3, permissions: ["participate"], isSystemRole: true },
];
const ensureMember = (organization, userInternalId) => { const member = organization.members.find((entry) => entry.userInternalId === userInternalId); if (!member) throw new HttpError(403, "You are not part of this consortium.", "CONSORTIUM_MEMBERSHIP_REQUIRED"); return member; };
const ensurePermission = (organization, member, permission) => { const role = organization.roles.find((entry) => entry.roleKey === member.roleKey); if (!role || !role.permissions.includes(permission)) throw new HttpError(403, "You do not have permission for that consortium action.", "CONSORTIUM_PERMISSION_DENIED"); };
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
  const memberProfiles = await Promise.all(organization.members.map(async (member) => {
    const state = await findPlayerStateByUserInternalId(client, member.userInternalId);
    return { member, workingStats: normalizeWorkingStats(state?.workingStats) };
  }));
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
  const memberViews = memberProfiles.map(({ member, workingStats }) => {
    const positionKey = member.roleKey === "director" ? "director" : positions[member.userInternalId] ?? null;
    const position = positionKey ? getConsortiumPositionDefinition(template.key, positionKey) : null;
    const rawContribution = position ? scorePosition(position, workingStats) : 0;
    const normalizedContribution = clamp(rawContribution / 75, 0, 1.4);
    return { ...member, roleDisplayName: getRoleDisplayName(organization, member.roleKey), positionKey, positionDisplayName: position?.displayName ?? "Unassigned", workingStats, contributionScore: round1(rawContribution), normalizedContribution, position };
  });
  const totalSlots = listConsortiumPositions(template.key).reduce((sum, entry) => sum + (entry.slotCount ?? 0), 0);
  const filledPreferredSlots = listConsortiumPositions(template.key).reduce((sum, entry) => sum + Math.min(entry.slotCount ?? 0, memberViews.filter((member) => member.positionKey === entry.key).length), 0);
  const overstaff = Math.max(0, memberViews.length - employeeCapacity);
  const treasury = normalizeTreasury(organization.treasury);
  const pendingApplications = metadata.management.applications;
  let popularity = 24 + Math.min(18, (metadata.management.outreach.level ?? 0) * 5) + Math.min(12, pendingApplications.length * 3) + Math.min(10, memberViews.length * 2);
  let efficiency = 24 + Math.min(14, filledPreferredSlots * 2) + Math.min(12, treasury.gold / 5000);
  let environment = 28 + Math.min(14, treasury.gold / Math.max(1500, memberViews.length * 1500));
  for (const member of memberViews) {
    if (!member.position) continue;
    popularity += member.normalizedContribution * member.position.metricImpact.popularity;
    efficiency += member.normalizedContribution * member.position.metricImpact.efficiency;
    environment += member.normalizedContribution * member.position.metricImpact.environment;
  }
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
  const totalDailyGeneration = employeeDetails.reduce((sum, member) => sum + member.dailyCpGain, 0);
  const strongestMetric = Object.entries({ popularity, efficiency, environment }).sort((left, right) => right[1] - left[1])[0]?.[0] ?? "efficiency";
  const weakestMetric = Object.entries({ popularity, efficiency, environment }).sort((left, right) => left[1] - right[1])[0]?.[0] ?? "environment";
  const healthMetrics = Object.fromEntries(Object.entries(HEALTH_METRICS).map(([key, meta]) => [key, { key, label: meta.label, meaning: meta.meaning, value: round1({ popularity, efficiency, environment }[key]), rating: ({ popularity, efficiency, environment }[key]) >= 75 ? "Strong" : ({ popularity, efficiency, environment }[key]) >= 50 ? "Stable" : "Strained" }]));
  const performance = { score: performanceScore, starRating: stars, employeeCapacity, employeeCount: memberViews.length, filledPreferredSlots, totalSlots, companyDailyGeneration: totalDailyGeneration, summary: `${template.displayName} is currently led by ${HEALTH_METRICS[strongestMetric].label.toLowerCase()} while ${HEALTH_METRICS[weakestMetric].label.toLowerCase()} remains the weak seam.` };
  metadata.management.positions = positions;
  metadata.management.health = { popularity: round1(popularity), efficiency: round1(efficiency), environment: round1(environment), lastComputedAt: Date.now() };
  metadata.management.performance = { ...performance, lastComputedAt: Date.now() };
  const viewerDetails = employeeDetails.find((entry) => entry.userInternalId === viewerInternalId) ?? null;
  return { template, metadata, healthMetrics, performance, stars, baseDailyGain, employeeDetails, viewerDetails, applications: pendingApplications, employeeCapacity, totalDailyGeneration };
};
const buildDirectoryEntry = (organization, derived, viewerInternalId) => ({ internalId: organization.internalId, publicId: organization.publicId, name: organization.name, type: organization.type, description: organization.description, statusText: organization.statusText, consortiumTypeKey: organization.consortiumTypeKey, consortiumTypeName: organization.consortiumTypeName, starRating: derived.stars, employeeCapacity: derived.employeeCapacity, employeeCount: organization.members.length, treasury: normalizeTreasury(organization.treasury), healthMetrics: derived.healthMetrics, performanceSummary: derived.performance.summary, director: organization.members.find((entry) => entry.roleKey === "director") ?? organization.members[0] ?? null, pendingApplications: derived.applications.length, viewerHasPendingApplication: derived.applications.some((entry) => entry.applicantInternalId === viewerInternalId) });
const persistConsortiumMetadata = async (client, organization, derived, patch = {}) => updateOrganizationDetails(client, organization.internalId, { ...patch, metadata: { ...derived.metadata }, passiveBonusSummary: buildPassiveSummary(derived.template) });
const refreshConsortiumView = async (client, user, organization) => {
  if (!organization || organization.type !== "consortium") return { organization, consortiumProgress: null };
  const derived = await buildConsortiumState(client, organization, user.internalId);
  const progressEntry = getProgressEntry((await getRuntimeForUser(client, user)).runtimeState, derived.template.key, organization.internalId);
  const consortiumPoints = { consortiumTypeKey: derived.template.key, organizationInternalId: organization.internalId, scope: "type", points: progressEntry.points, totalEarned: progressEntry.totalEarned, totalSpent: progressEntry.totalSpent, lastClaimedAt: progressEntry.lastClaimedAt, dailyGain: derived.viewerDetails?.dailyCpGain ?? derived.baseDailyGain };
  return {
    organization: { ...organization, tag: null, treasury: normalizeTreasury(organization.treasury), metadata: derived.metadata, starRating: derived.stars, consortiumType: derived.template, rolesFlavor: derived.template.rolesFlavor, memberRoleKey: derived.viewerDetails?.roleKey ?? null, rewardLadder: derived.template.rewards, unlockedPassives: getUnlockedPassives(derived.template.key, derived.stars), redeemableActives: getActiveRewards(derived.template.key, derived.stars, consortiumPoints.points), consortiumPoints, healthMetrics: derived.healthMetrics, performance: derived.performance, employeeCapacity: derived.employeeCapacity, companyDailyGeneration: derived.totalDailyGeneration, positions: listConsortiumPositions(derived.template.key), applications: derived.applications, memberDetails: derived.employeeDetails, yourDetails: derived.viewerDetails, companyAgeDays: getCompanyAgeDays(organization.createdAt) },
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
export async function getMyOrganization(user, type) {
  return withTransaction(async (client) => {
    const organization = await findOrganizationForUserByType(client, user.internalId, type);
    const hydrated = await refreshConsortiumView(client, user, organization);
    const directory = type === "consortium" ? await Promise.all((await listOrganizationsByType(client, "consortium")).map(async (entry) => buildDirectoryEntry(entry, await buildConsortiumState(client, entry, user.internalId), user.internalId))) : [];
    return { ...hydrated, consortiumTemplates: listConsortiumTypes(), directory };
  });
}

export async function createOrganizationForUser(user, payload) {
  const type = String(payload?.type ?? ""); if (type !== "guild" && type !== "consortium") throw new HttpError(400, "Organization type must be guild or consortium.", "ORG_TYPE_REQUIRED");
  return withTransaction(async (client) => {
    const existing = await findOrganizationForUserByType(client, user.internalId, type); if (existing) throw new HttpError(409, `You already operate a ${type}.`, "ORG_ALREADY_EXISTS");
    const { runtimeState } = await getRuntimeForUser(client, user); const name = normalizeName(payload?.name, type === "guild" ? "Guild name" : "Consortium name"); const template = type === "consortium" ? getConsortiumTypeDefinition(payload?.consortiumTypeKey) : null; if (type === "consortium" && !template) throw new HttpError(400, "Valid consortium type is required.", "CONSORTIUM_TYPE_REQUIRED");
    const cost = type === "guild" ? getGuildFoundationCost(runtimeState) : getConsortiumFoundationCost(runtimeState, template); if (runtimeState.player.gold < cost) throw new HttpError(400, `Not enough gold to found this ${type}.`, "ORG_FUNDS_REQUIRED");
    runtimeState.player.gold -= cost; runtimeState.player.currencies = { ...runtimeState.player.currencies, gold: runtimeState.player.gold };
    const organization = await createOrganization(client, { internalId: `org_${crypto.randomUUID()}`, publicId: await allocateNextPublicNumericId(client, type, FIRST_ORGANIZATION_PUBLIC_ID), type, name, tag: type === "guild" ? normalizeTag(payload?.tag) : null, founderInternalId: user.internalId, founderPublicId: user.publicId, description: type === "guild" ? "Social and combat organization scaffold for raids, wars, and strongholds." : template.description, statusText: type === "guild" ? "Recruiting" : "Operational", consortiumTypeKey: template?.key ?? null, consortiumTypeName: template?.displayName ?? null, passiveBonusSummary: template ? buildPassiveSummary(template) : "", creationCost: cost, treasury: { copper: 0, silver: 0, gold: 0, platinum: 0 }, metadata: type === "consortium" ? { companyStyle: true, rewardTiers: template.rewards.map((entry) => entry.starTier), rolesFlavor: template.rolesFlavor, management: { positions: {}, applications: [], outreach: { level: 0, campaignsLaunched: 0, lastRunAt: null }, health: {}, performance: {} } } : { futureWarfare: true } });
    const roles = type === "guild" ? buildGuildRoles() : buildConsortiumRoles(template); await replaceOrganizationRoles(client, organization.internalId, roles); await addOrganizationMember(client, organization.internalId, { userInternalId: user.internalId, userPublicId: user.publicId, displayName: founderDisplayName(user), roleKey: roles[0].roleKey }); await insertOrganizationLog(client, organization.internalId, { actorInternalId: user.internalId, actorPublicId: user.publicId, actionType: "organization_created", summary: { type, name: organization.name, publicId: organization.publicId, creationCost: cost, consortiumTypeKey: template?.key ?? null } });
    let hydratedOrganization = await findOrganizationByInternalId(client, organization.internalId);
    if (type === "consortium") { const derived = await buildConsortiumState(client, hydratedOrganization, user.internalId); hydratedOrganization = await persistConsortiumMetadata(client, hydratedOrganization, derived); syncMembershipSummary(runtimeState, hydratedOrganization, template, derived.stars, roles[0].roleKey); setProgressEntry(runtimeState, template.key, getProgressEntry(runtimeState, template.key, hydratedOrganization.internalId)); }
    else runtimeState.guild = hydratedOrganization;
    const playerState = await upsertPlayerRuntimeState(client, user.internalId, runtimeState); const result = await refreshConsortiumView(client, user, hydratedOrganization); return { ...result, playerState };
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

export { listConsortiumTypes };
