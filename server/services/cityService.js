import { query, withTransaction } from "../db/pool.js";
import { HttpError } from "../lib/errors.js";
import { buildMutableRuntimeState } from "../lib/runtimePlayerState.js";
import {
  createDefaultPlayerState,
  findPlayerStateByUserInternalId,
  upsertPlayerRuntimeState,
} from "../repositories/playerStateRepository.js";
import { getCityDefinition, getCityOccupancyCandidates, isValidCityId, normalizeCityId } from "../data/cityData.js";
import { getAcademyById, getCityAcademies, getCityAcademy, getCityContract, getCityContracts } from "../data/cityLoopData.js";
import { resolveTravelForRuntimeState } from "./travelService.js";
import { resolveNpcCombatWithRewards } from "./combatService.js";
import { unlockSkill } from "./skillService.js";

const CITY_STANDING_TIERS = [
  { value: 0, label: "New Arrival" },
  { value: 2, label: "Known Hand" },
  { value: 4, label: "Trusted Local" },
  { value: 8, label: "City Fixture" },
];

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

function formatDisplayName(row) {
  const first = typeof row.first_name === "string" ? row.first_name.trim() : "";
  const last = typeof row.last_name === "string" ? row.last_name.trim() : "";
  return `${first} ${last}`.trim() || "Unnamed Citizen";
}

function mapOccupantRow(row, requestingUser) {
  const snapshot = asRecord(row.player_snapshot);
  const title = typeof snapshot.title === "string" && snapshot.title.trim() ? snapshot.title.trim() : "Citizen";
  const publicId = Number(row.public_id);
  return {
    publicId,
    displayName: formatDisplayName(row),
    title,
    level: Math.max(1, Math.floor(asNumber(row.level ?? snapshot.level, 1))),
    currentCityId: normalizeCityId(row.current_city_id),
    isSelf: requestingUser?.publicId === publicId,
    sharesGuild: Boolean(row.shares_guild),
    sharesConsortium: Boolean(row.shares_consortium),
  };
}

function cloneTravelState(runtimeState) {
  const travel = asRecord(runtimeState.travel);
  const currentCityId = normalizeCityId(travel.currentCityId, "nexis");
  return {
    status: travel.status === "in_transit" ? "in_transit" : "idle",
    currentCityId,
  };
}

function getCurrentCityId(runtimeState) {
  const travel = cloneTravelState(runtimeState);
  const current = asRecord(runtimeState.player?.current);
  return normalizeCityId(travel.currentCityId ?? current.currentCityId, "nexis");
}

function isInTransit(runtimeState) {
  return cloneTravelState(runtimeState).status === "in_transit";
}

function getStandingTier(value) {
  const standing = Math.max(0, Math.floor(asNumber(value, 0)));
  let current = CITY_STANDING_TIERS[0];
  let next = null;
  for (const tier of CITY_STANDING_TIERS) {
    if (standing >= tier.value) current = tier;
    else if (!next) next = tier;
  }
  return { current, next };
}

function ensureContractState(runtimeState) {
  const player = asRecord(runtimeState.player);
  const existing = asRecord(player.cityContracts);
  const records = asRecord(existing.records);
  player.cityContracts = { ...existing, records: { ...records } };
  runtimeState.player = player;
  return player.cityContracts;
}

function ensureAcademyState(runtimeState) {
  const player = asRecord(runtimeState.player);
  const existing = asRecord(player.cityAcademy);
  const activeStudy = asRecord(existing.activeStudy);
  const completed = asRecord(existing.completed);
  player.cityAcademy = {
    ...existing,
    activeStudy: activeStudy.academyId ? { ...activeStudy } : null,
    completed: { ...completed },
    unlocks: asArray(existing.unlocks).filter((entry) => typeof entry === "string"),
  };
  runtimeState.player = player;
  return player.cityAcademy;
}

function ensureCityStandingState(runtimeState) {
  const player = asRecord(runtimeState.player);
  const standing = asRecord(player.cityStanding);
  player.cityStanding = { ...standing };
  runtimeState.player = player;
  return player.cityStanding;
}

function getCityStanding(runtimeState, cityId) {
  const normalizedCityId = normalizeCityId(cityId);
  const standingState = ensureCityStandingState(runtimeState);
  const existing = asRecord(standingState[normalizedCityId]);
  const value = Math.max(0, Math.floor(asNumber(existing.value, existing.standing ?? 0)));
  const tiers = getStandingTier(value);
  return {
    cityId: normalizedCityId,
    value,
    tier: tiers.current.label,
    nextTierAt: tiers.next?.value ?? null,
    nextTierLabel: tiers.next?.label ?? null,
    contractCompletions: Math.max(0, Math.floor(asNumber(existing.contractCompletions, 0))),
    academyStagesCompleted: Math.max(0, Math.floor(asNumber(existing.academyStagesCompleted, 0))),
    updatedAt: typeof existing.updatedAt === "number" ? existing.updatedAt : null,
  };
}

function setCityStanding(runtimeState, cityId, standingRecord) {
  const standingState = ensureCityStandingState(runtimeState);
  standingState[normalizeCityId(cityId)] = { ...standingRecord };
}

function addCityStanding(runtimeState, cityId, amount, now, source) {
  const current = getCityStanding(runtimeState, cityId);
  const next = {
    ...current,
    value: Math.max(0, Math.floor(current.value + asNumber(amount, 0))),
    contractCompletions: current.contractCompletions + (source === "contract" ? 1 : 0),
    academyStagesCompleted: current.academyStagesCompleted + (source === "academy" ? 1 : 0),
    updatedAt: now,
  };
  const tier = getStandingTier(next.value);
  next.tier = tier.current.label;
  next.nextTierAt = tier.next?.value ?? null;
  next.nextTierLabel = tier.next?.label ?? null;
  setCityStanding(runtimeState, cityId, next);
  return next;
}

function getContractRecord(runtimeState, contractId) {
  return asRecord(ensureContractState(runtimeState).records[contractId]);
}

function setContractRecord(runtimeState, contractId, record) {
  const state = ensureContractState(runtimeState);
  state.records[contractId] = { ...record };
}

function getContractStatus(record) {
  return record.status === "active" || record.status === "completed" || record.status === "claimed" ? record.status : "available";
}

function getCompletedCourses(runtimeState) {
  const education = asRecord(runtimeState.education);
  const completedCourses = asArray(education.completedCourses).filter((entry) => typeof entry === "string");
  const legacyCompleted = Object.entries(asRecord(education.completed))
    .filter(([, value]) => value === true || asRecord(value).completed === true)
    .map(([courseId]) => courseId);
  return Array.from(new Set([...completedCourses, ...legacyCompleted]));
}

function getMissingCourses(runtimeState, requiredCourses) {
  const completed = new Set(getCompletedCourses(runtimeState));
  return requiredCourses.filter((courseId) => !completed.has(courseId));
}

function getStamina(runtimeState) {
  return asNumber(runtimeState.player?.stats?.stamina, 0);
}

function addLegacyEntry(runtimeState, entry) {
  const legacy = asRecord(runtimeState.legacy);
  const visibleEntries = asArray(legacy.visibleEntries);
  if (visibleEntries.some((current) => asRecord(current).id === entry.id)) {
    runtimeState.legacy = legacy;
    return;
  }
  legacy.visibleEntries = [entry, ...visibleEntries].slice(0, 50);
  runtimeState.legacy = legacy;
}

function applyReward(runtimeState, reward, now) {
  const player = runtimeState.player;
  const gold = Math.max(0, Math.floor(asNumber(player.gold, 500) + asNumber(reward.gold, 0)));
  player.gold = gold;
  player.currencies = { ...asRecord(player.currencies), gold };
  player.experience = Math.max(0, Math.floor(asNumber(player.experience, 0) + asNumber(reward.experience, 0)));

  const items = asArray(reward.items);
  if (items.length) {
    player.inventory = { ...asRecord(player.inventory) };
    for (const rewardItem of items) {
      const itemId = typeof rewardItem.itemId === "string" ? rewardItem.itemId : "";
      if (!itemId) continue;
      const quantity = Math.max(1, Math.floor(asNumber(rewardItem.quantity, 1)));
      player.inventory[itemId] = Math.max(0, Math.floor(asNumber(player.inventory[itemId], 0) + quantity));
    }
  }

  if (reward.workingStats) {
    player.workingStats = { ...asRecord(player.workingStats) };
    for (const [stat, amount] of Object.entries(asRecord(reward.workingStats))) {
      player.workingStats[stat] = Math.max(0, Math.floor(asNumber(player.workingStats[stat], 0) + asNumber(amount, 0)));
    }
  }

  if (reward.battleStats) {
    player.battleStats = { ...asRecord(player.battleStats) };
    for (const [stat, amount] of Object.entries(asRecord(reward.battleStats))) {
      player.battleStats[stat] = Math.max(0, Math.floor(asNumber(player.battleStats[stat], 0) + asNumber(amount, 0)));
    }
  }

  const academyState = ensureAcademyState(runtimeState);
  for (const flag of asArray(reward.flags).filter((entry) => typeof entry === "string")) {
    academyState.unlocks = Array.from(new Set([...academyState.unlocks, flag]));
  }

  for (const skillId of asArray(reward.skills).filter((entry) => typeof entry === "string")) {
    unlockSkill(runtimeState, skillId, "academy", now);
  }

  player.counters = { ...asRecord(player.counters), lastCityGameplayRewardAt: now };
}

function touchContractProgress(runtimeState, now = Date.now()) {
  const currentCityId = getCurrentCityId(runtimeState);
  const state = ensureContractState(runtimeState);
  let changed = false;

  for (const [contractId, rawRecord] of Object.entries(state.records)) {
    const record = asRecord(rawRecord);
    if (record.status !== "active") continue;
    const contract = getCityContract(contractId);
    const visitCityId = contract?.completion?.visitCityId;
    if (!visitCityId || record.visitedCityAt || normalizeCityId(visitCityId, "") !== currentCityId) continue;
    state.records[contractId] = { ...record, visitedCityId: normalizeCityId(visitCityId), visitedCityAt: now };
    changed = true;
  }

  return changed;
}

async function loadRuntimeState(client, user) {
  await createDefaultPlayerState(client, user.internalId);
  const playerState = await findPlayerStateByUserInternalId(client, user.internalId);
  if (!playerState) throw new HttpError(404, "Player state unavailable.", "PLAYER_STATE_NOT_FOUND");

  const runtimeState = buildMutableRuntimeState(user, playerState);
  const travelResolution = resolveTravelForRuntimeState(runtimeState);
  let changed = travelResolution.changed;
  changed = touchContractProgress(runtimeState) || changed;

  if (changed) {
    const nextPlayerState = await upsertPlayerRuntimeState(client, user.internalId, runtimeState);
    return { playerState: nextPlayerState, runtimeState: buildMutableRuntimeState(user, nextPlayerState) };
  }

  return { playerState, runtimeState };
}

function serializeContract(contract, runtimeState, now = Date.now()) {
  const record = getContractRecord(runtimeState, contract.id);
  const status = getContractStatus(record);
  const currentCityId = getCurrentCityId(runtimeState);
  const inContractCity = currentCityId === normalizeCityId(contract.cityId);
  const inTransit = isInTransit(runtimeState);
  const cityStanding = getCityStanding(runtimeState, contract.cityId);
  const completion = asRecord(contract.completion);
  const visitCityId = typeof completion.visitCityId === "string" ? normalizeCityId(completion.visitCityId, "") : null;
  const visitComplete = !visitCityId || Boolean(record.visitedCityAt);
  const staminaCost = Math.max(0, Math.floor(asNumber(completion.staminaCost, 0)));
  const enoughStamina = getStamina(runtimeState) >= staminaCost;
  const minimumStanding = Math.max(0, Math.floor(asNumber(contract.minimumStanding, 0)));
  const standingLocked = cityStanding.value < minimumStanding;
  const refreshAvailableAt = typeof record.refreshAvailableAt === "number" ? record.refreshAvailableAt : null;
  const canRefresh = status === "claimed" && refreshAvailableAt !== null && now >= refreshAvailableAt;

  const canAccept = status === "available" && !inTransit && inContractCity && !standingLocked;
  const canComplete = status === "active" && !inTransit && inContractCity && visitComplete && enoughStamina;
  const canClaim = status === "completed";

  let blockedReason = null;
  if (status === "claimed") {
    blockedReason = canRefresh
      ? "This contract can be renewed from the local board."
      : `Board refresh opens ${refreshAvailableAt ? new Date(refreshAvailableAt).toLocaleString("en-US", { timeZone: "UTC" }) + " UTC" : "soon"}.`;
  } else if (status === "completed") blockedReason = "Contract complete. Claim the rewards.";
  else if (status === "active" && !visitComplete) blockedReason = `Visit ${completion.visitLabel ?? "the required city"}, then return to ${getCityDefinition(contract.cityId).name}.`;
  else if (status === "active" && !enoughStamina) blockedReason = `You need ${staminaCost} stamina to finish this contract.`;
  else if (inTransit) blockedReason = "Finish your current travel before handling local contracts.";
  else if (!inContractCity) blockedReason = `Travel to ${getCityDefinition(contract.cityId).name} to work this contract.`;
  else if (standingLocked) blockedReason = `Requires ${minimumStanding} ${getCityDefinition(contract.cityId).name} standing. Current standing: ${cityStanding.value}.`;

  return {
    id: contract.id,
    cityId: contract.cityId,
    title: contract.title,
    type: contract.type,
    summary: contract.summary,
    risk: contract.risk,
    requirementLabel: contract.requirementLabel,
    minimumStanding,
    standingReward: Math.max(0, Math.floor(asNumber(contract.standingReward, 1))),
    completion: {
      staminaCost,
      note: typeof completion.note === "string" ? completion.note : null,
      visitCityId,
      visitLabel: typeof completion.visitLabel === "string" ? completion.visitLabel : null,
      visitComplete,
    },
    combat: contract.combat ? {
      enabled: true,
      opponentId: contract.combat.opponentId,
      label: contract.combat.label ?? "Contract encounter",
      summary: contract.combat.summary ?? "This contract can trigger a live combat check.",
    } : null,
    reward: contract.reward,
    status: standingLocked && status === "available" ? "locked" : status,
    acceptedAt: typeof record.acceptedAt === "number" ? record.acceptedAt : null,
    completedAt: typeof record.completedAt === "number" ? record.completedAt : null,
    claimedAt: typeof record.claimedAt === "number" ? record.claimedAt : null,
    visitedCityAt: typeof record.visitedCityAt === "number" ? record.visitedCityAt : null,
    refreshAvailableAt,
    runs: Math.max(0, Math.floor(asNumber(record.runs, 0))),
    canAccept,
    canComplete,
    canClaim,
    canRefresh,
    blockedReason,
  };
}

function serializeContractsForCity(cityId, runtimeState, now = Date.now()) {
  const normalizedCityId = normalizeCityId(cityId, "");
  if (!normalizedCityId || !isValidCityId(normalizedCityId)) throw new HttpError(400, "City unavailable.", "CITY_INVALID");
  const city = getCityDefinition(normalizedCityId);
  return {
    city: { id: city.id, name: city.name, role: city.role },
    currentCityId: getCurrentCityId(runtimeState),
    standing: getCityStanding(runtimeState, normalizedCityId),
    contracts: getCityContracts(normalizedCityId).map((contract) => serializeContract(contract, runtimeState, now)),
  };
}

function assertContractAction(contract, runtimeState, action) {
  const serialized = serializeContract(contract, runtimeState);
  if (action === "accept" && !serialized.canAccept) throw new HttpError(409, serialized.blockedReason ?? "This contract cannot be accepted right now.", "CITY_CONTRACT_ACCEPT_BLOCKED");
  if (action === "complete" && !serialized.canComplete) throw new HttpError(409, serialized.blockedReason ?? "This contract cannot be completed right now.", "CITY_CONTRACT_COMPLETE_BLOCKED");
  if (action === "claim" && !serialized.canClaim) throw new HttpError(409, serialized.blockedReason ?? "This contract cannot be claimed right now.", "CITY_CONTRACT_CLAIM_BLOCKED");
  if (action === "refresh" && !serialized.canRefresh) throw new HttpError(409, serialized.blockedReason ?? "This contract cannot be renewed yet.", "CITY_CONTRACT_REFRESH_BLOCKED");
  return serialized;
}

function consumeStamina(runtimeState, amount) {
  if (!amount) return;
  const player = runtimeState.player;
  player.stats = { ...asRecord(player.stats) };
  player.stats.stamina = Math.max(0, Math.floor(asNumber(player.stats.stamina, 0) - amount));
}

function getCompletedStageRecords(runtimeState, academy) {
  const academyState = ensureAcademyState(runtimeState);
  const completedRecord = asRecord(academyState.completed[academy.id]);
  const stages = { ...asRecord(completedRecord.stages) };
  if (completedRecord.completedAt && academy.stages?.[0]?.id && !stages[academy.stages[0].id]) {
    stages[academy.stages[0].id] = { academyId: academy.id, stageId: academy.stages[0].id, cityId: academy.cityId, completedAt: completedRecord.completedAt };
  }
  return stages;
}

function getAcademyStageStatus(academy, stage, index, runtimeState, now = Date.now()) {
  const academyState = ensureAcademyState(runtimeState);
  const completedStages = getCompletedStageRecords(runtimeState, academy);
  const activeStudy = asRecord(academyState.activeStudy);
  const currentCityId = getCurrentCityId(runtimeState);
  const inAcademyCity = currentCityId === normalizeCityId(academy.cityId);
  const inTransit = isInTransit(runtimeState);
  const cityStanding = getCityStanding(runtimeState, academy.cityId);
  const previousStage = index > 0 ? academy.stages[index - 1] : null;
  const previousComplete = !previousStage || Boolean(completedStages[previousStage.id]);
  const missingCourses = getMissingCourses(runtimeState, stage.requiredCourses ?? []);
  const standingMissing = Math.max(0, Math.floor(asNumber(stage.requiredStanding, 0)) - cityStanding.value);
  const completedRecord = asRecord(completedStages[stage.id]);
  const isCompleted = Boolean(completedRecord.completedAt);
  const activeForStage = activeStudy.academyId === academy.id && activeStudy.stageId === stage.id;
  const anyActive = Boolean(activeStudy.academyId);
  const startedAt = activeForStage ? asNumber(activeStudy.startedAt, 0) : null;
  const endsAt = activeForStage ? asNumber(activeStudy.endsAt, 0) : null;
  const durationMs = Math.max(1000, asNumber(stage.durationMs, 5 * 60 * 1000));
  const readyToComplete = Boolean(activeForStage && endsAt && now >= endsAt && inAcademyCity);

  let status = "available";
  if (isCompleted) status = "completed";
  else if (activeForStage) status = "active";
  else if (!previousComplete || missingCourses.length || standingMissing > 0 || !inAcademyCity || inTransit || anyActive) status = "locked";

  let lockReason = null;
  if (isCompleted) lockReason = "This stage is complete.";
  else if (activeForStage && !inAcademyCity) lockReason = `Return to ${getCityDefinition(academy.cityId).name} to complete this study.`;
  else if (activeForStage && !readyToComplete) lockReason = "Study is underway. Stay local and return when the timer is complete.";
  else if (!previousComplete) lockReason = `Complete ${previousStage.title} first.`;
  else if (inTransit) lockReason = "Finish travel before starting academy study.";
  else if (!inAcademyCity) lockReason = `Travel to ${getCityDefinition(academy.cityId).name} to study here.`;
  else if (missingCourses.length) lockReason = academy.lockReason;
  else if (standingMissing > 0) lockReason = `Earn ${standingMissing} more ${getCityDefinition(academy.cityId).name} standing from local contracts.`;
  else if (anyActive && !activeForStage) lockReason = "Finish your active academy study before starting another stage.";

  return {
    id: stage.id,
    title: stage.title,
    summary: stage.summary,
    durationMs,
    requiredCourses: stage.requiredCourses ?? [],
    missingCourses,
    requiredStanding: Math.max(0, Math.floor(asNumber(stage.requiredStanding, 0))),
    standingMissing,
    entryRequirements: stage.entryRequirements ?? [],
    reward: stage.reward,
    standingReward: Math.max(0, Math.floor(asNumber(stage.standingReward, 0))),
    status,
    lockReason,
    completedAt: typeof completedRecord.completedAt === "number" ? completedRecord.completedAt : null,
    activeStudy: activeForStage ? { academyId: academy.id, stageId: stage.id, cityId: academy.cityId, startedAt, endsAt, readyToComplete, progressPercent: Math.max(0, Math.min(100, Math.round(((now - startedAt) / durationMs) * 100))) } : null,
    canStart: status === "available" && !isCompleted && !anyActive,
    canComplete: readyToComplete,
  };
}

function serializeAcademy(academy, runtimeState, now = Date.now()) {
  const stageRows = academy.stages.map((stage, index) => getAcademyStageStatus(academy, stage, index, runtimeState, now));
  const currentStage = stageRows.find((stage) => stage.status === "active") ?? stageRows.find((stage) => stage.status !== "completed") ?? null;
  const completedStages = stageRows.filter((stage) => stage.status === "completed");
  const isCompleted = completedStages.length === stageRows.length;
  const activeStage = stageRows.find((stage) => stage.activeStudy);
  const firstStage = stageRows[0];

  return {
    id: academy.id,
    cityId: academy.cityId,
    name: academy.name,
    theme: academy.theme,
    entryRequirements: currentStage?.entryRequirements ?? firstStage?.entryRequirements ?? [],
    requiredCourses: currentStage?.requiredCourses ?? firstStage?.requiredCourses ?? [],
    missingCourses: currentStage?.missingCourses ?? [],
    lockReason: currentStage?.lockReason ?? (isCompleted ? "All stages complete." : null),
    durationMs: currentStage?.durationMs ?? firstStage?.durationMs ?? 5 * 60 * 1000,
    progressionSupports: academy.progressionSupports,
    reward: currentStage?.reward ?? {},
    standing: getCityStanding(runtimeState, academy.cityId),
    stages: stageRows,
    currentStageId: currentStage?.id ?? null,
    isCompleted,
    completedAt: isCompleted ? completedStages[completedStages.length - 1]?.completedAt ?? null : null,
    activeStudy: activeStage?.activeStudy ?? null,
    canStart: Boolean(currentStage?.canStart),
    canComplete: Boolean(currentStage?.canComplete),
  };
}

export async function getCityPeopleForUser(user, cityId) {
  const normalizedCityId = normalizeCityId(cityId, "");
  if (!normalizedCityId || !isValidCityId(normalizedCityId)) throw new HttpError(400, "City unavailable.", "CITY_INVALID");

  const city = getCityDefinition(normalizedCityId);
  const candidates = getCityOccupancyCandidates(normalizedCityId);
  const result = await query(
    `
      WITH viewer_orgs AS (
        SELECT om.organization_internal_id, o.type AS organization_type
        FROM organization_members om
        INNER JOIN organizations o ON o.internal_id = om.organization_internal_id
        WHERE om.user_internal_id = $2
      ),
      city_people AS (
        SELECT
          u.internal_id,
          u.public_id,
          u.first_name,
          u.last_name,
          u.created_at,
          ps.level,
          ps.player_snapshot,
          COALESCE(
            NULLIF(ps.travel_state->>'currentCityId', ''),
            NULLIF(ps.player_snapshot->'current'->>'currentCityId', ''),
            'nexis'
          ) AS current_city_id
        FROM users u
        INNER JOIN player_state ps ON ps.user_internal_id = u.internal_id
        WHERE COALESCE(
            NULLIF(ps.travel_state->>'currentCityId', ''),
            NULLIF(ps.player_snapshot->'current'->>'currentCityId', ''),
            'nexis'
          ) = ANY($1::text[])
          AND COALESCE(ps.travel_state->>'status', 'idle') <> 'in_transit'
      )
      SELECT
        cp.*,
        EXISTS (
          SELECT 1
          FROM organization_members om
          INNER JOIN viewer_orgs vo ON vo.organization_internal_id = om.organization_internal_id
          WHERE om.user_internal_id = cp.internal_id AND vo.organization_type = 'guild'
        ) AS shares_guild,
        EXISTS (
          SELECT 1
          FROM organization_members om
          INNER JOIN viewer_orgs vo ON vo.organization_internal_id = om.organization_internal_id
          WHERE om.user_internal_id = cp.internal_id AND vo.organization_type = 'consortium'
        ) AS shares_consortium
      FROM city_people cp
      ORDER BY COALESCE(cp.level, 1) DESC, cp.created_at DESC
      LIMIT 30
    `,
    [candidates, user.internalId],
  );

  const people = result.rows.map((row) => mapOccupantRow(row, user));
  return {
    city: { id: city.id, name: city.name, role: city.role, peopleLabel: city.peopleLabel },
    population: {
      visibleCount: people.length,
      listLimit: 30,
      peopleLabel: city.peopleLabel,
      guildmatesVisible: people.filter((person) => person.sharesGuild).length,
      consortiumMembersVisible: people.filter((person) => person.sharesConsortium).length,
    },
    people,
  };
}

export async function getCityContractsForUser(user, cityId) {
  return withTransaction(async (client) => {
    const { playerState, runtimeState } = await loadRuntimeState(client, user);
    return { playerState, ...serializeContractsForCity(cityId, runtimeState) };
  });
}

export async function acceptCityContractForUser(user, contractId) {
  return withTransaction(async (client) => {
    const { runtimeState } = await loadRuntimeState(client, user);
    const contract = getCityContract(contractId);
    if (!contract) throw new HttpError(404, "Local contract not found.", "CITY_CONTRACT_NOT_FOUND");

    assertContractAction(contract, runtimeState, "accept");
    const now = Date.now();
    const previous = getContractRecord(runtimeState, contract.id);
    setContractRecord(runtimeState, contract.id, { status: "active", cityId: contract.cityId, acceptedAt: now, runs: Math.max(0, Math.floor(asNumber(previous.runs, 0))) });
    const playerState = await upsertPlayerRuntimeState(client, user.internalId, runtimeState);
    return { playerState, ...serializeContractsForCity(contract.cityId, buildMutableRuntimeState(user, playerState)), message: `${contract.title} accepted.` };
  });
}

export async function completeCityContractForUser(user, contractId) {
  return withTransaction(async (client) => {
    const { runtimeState } = await loadRuntimeState(client, user);
    const contract = getCityContract(contractId);
    if (!contract) throw new HttpError(404, "Local contract not found.", "CITY_CONTRACT_NOT_FOUND");

    const serialized = assertContractAction(contract, runtimeState, "complete");
    const now = Date.now();
    let combat = null;
    if (contract.combat?.opponentId) {
      combat = resolveNpcCombatWithRewards(runtimeState, contract.combat.opponentId, { context: "city_contract", now, playerName: user.firstName || "You", bonusSkillXp: 1 });
      if (combat.winner !== "player") {
        const playerState = await upsertPlayerRuntimeState(client, user.internalId, runtimeState);
        return {
          playerState,
          ...serializeContractsForCity(contract.cityId, buildMutableRuntimeState(user, playerState)),
          combat,
          message: `${contract.title} is still active. ${contract.combat.label ?? "The contract encounter"} pushed you back.`,
        };
      }
    }
    consumeStamina(runtimeState, serialized.completion.staminaCost);
    const record = getContractRecord(runtimeState, contract.id);
    setContractRecord(runtimeState, contract.id, { ...record, status: "completed", completedAt: now, combatResolvedAt: combat ? now : record.combatResolvedAt ?? null });
    const playerState = await upsertPlayerRuntimeState(client, user.internalId, runtimeState);
    return { playerState, ...serializeContractsForCity(contract.cityId, buildMutableRuntimeState(user, playerState)), combat, message: `${contract.title} completed. Claim the rewards when ready.` };
  });
}

export async function claimCityContractForUser(user, contractId) {
  return withTransaction(async (client) => {
    const { runtimeState } = await loadRuntimeState(client, user);
    const contract = getCityContract(contractId);
    if (!contract) throw new HttpError(404, "Local contract not found.", "CITY_CONTRACT_NOT_FOUND");

    assertContractAction(contract, runtimeState, "claim");
    const now = Date.now();
    const record = getContractRecord(runtimeState, contract.id);
    const runs = Math.max(0, Math.floor(asNumber(record.runs, 0))) + 1;
    applyReward(runtimeState, contract.reward, now);
    addCityStanding(runtimeState, contract.cityId, contract.standingReward ?? 1, now, "contract");
    setContractRecord(runtimeState, contract.id, {
      ...record,
      status: "claimed",
      claimedAt: now,
      refreshAvailableAt: now + Math.max(60 * 1000, asNumber(contract.refreshMs, 20 * 60 * 1000)),
      runs,
    });
    const player = runtimeState.player;
    player.counters = {
      ...asRecord(player.counters),
      cityContractsCompleted: Math.max(0, Math.floor(asNumber(player.counters?.cityContractsCompleted, 0) + 1)),
      firstCityContractCompletedAt: player.counters?.firstCityContractCompletedAt ?? now,
    };
    if (contract.chronicle && (runs === 1 || contract.minimumStanding > 0)) {
      addLegacyEntry(runtimeState, { id: `city_contract_${contract.id}_${runs}`, title: contract.chronicle.title, summary: contract.chronicle.summary, kind: "city_contract", awardedAt: now });
    }
    const playerState = await upsertPlayerRuntimeState(client, user.internalId, runtimeState);
    return { playerState, ...serializeContractsForCity(contract.cityId, buildMutableRuntimeState(user, playerState)), message: `${contract.title} rewards claimed. Local standing increased.` };
  });
}

export async function refreshCityContractForUser(user, contractId) {
  return withTransaction(async (client) => {
    const { runtimeState } = await loadRuntimeState(client, user);
    const contract = getCityContract(contractId);
    if (!contract) throw new HttpError(404, "Local contract not found.", "CITY_CONTRACT_NOT_FOUND");

    assertContractAction(contract, runtimeState, "refresh");
    const now = Date.now();
    const record = getContractRecord(runtimeState, contract.id);
    setContractRecord(runtimeState, contract.id, { status: "available", cityId: contract.cityId, refreshedAt: now, lastClaimedAt: record.claimedAt ?? null, runs: Math.max(0, Math.floor(asNumber(record.runs, 0))) });
    const playerState = await upsertPlayerRuntimeState(client, user.internalId, runtimeState);
    return { playerState, ...serializeContractsForCity(contract.cityId, buildMutableRuntimeState(user, playerState)), message: `${contract.title} renewed on the local board.` };
  });
}

export async function getCityAcademyForUser(user, cityId) {
  return withTransaction(async (client) => {
    const { playerState, runtimeState } = await loadRuntimeState(client, user);
    const normalizedCityId = normalizeCityId(cityId, "");
    if (!normalizedCityId || !isValidCityId(normalizedCityId)) throw new HttpError(400, "City unavailable.", "CITY_INVALID");
    const academies = getCityAcademies(normalizedCityId).map((academy) => serializeAcademy(academy, runtimeState));
    return { playerState, city: getCityDefinition(normalizedCityId), currentCityId: getCurrentCityId(runtimeState), academy: academies[0] ?? serializeAcademy(getCityAcademy(normalizedCityId), runtimeState), academies };
  });
}

export async function startCityAcademyForUser(user, academyId) {
  return withTransaction(async (client) => {
    const { runtimeState } = await loadRuntimeState(client, user);
    const academy = getAcademyById(academyId);
    if (!academy) throw new HttpError(404, "City academy not found.", "CITY_ACADEMY_NOT_FOUND");
    const serialized = serializeAcademy(academy, runtimeState);
    const stage = serialized.stages.find((entry) => entry.id === serialized.currentStageId);
    if (!stage?.canStart) throw new HttpError(409, stage?.lockReason ?? serialized.lockReason ?? "This academy stage cannot be started right now.", "CITY_ACADEMY_START_BLOCKED");

    const now = Date.now();
    const state = ensureAcademyState(runtimeState);
    state.activeStudy = { academyId: academy.id, stageId: stage.id, cityId: academy.cityId, startedAt: now, endsAt: now + stage.durationMs };
    runtimeState.player.counters = {
      ...asRecord(runtimeState.player.counters),
      academyEnrollments: Math.max(0, Math.floor(asNumber(runtimeState.player.counters?.academyEnrollments, 0) + 1)),
      firstAcademyEnrollmentAt: runtimeState.player.counters?.firstAcademyEnrollmentAt ?? now,
    };
    addLegacyEntry(runtimeState, { id: `academy_start_${academy.id}_${stage.id}_${now}`, title: `${academy.name}: ${stage.title}`, summary: `Started ${stage.title} in ${getCityDefinition(academy.cityId).name}.`, kind: "academy", awardedAt: now });

    const playerState = await upsertPlayerRuntimeState(client, user.internalId, runtimeState);
    const nextRuntimeState = buildMutableRuntimeState(user, playerState);
    const academies = getCityAcademies(academy.cityId).map((entry) => serializeAcademy(entry, nextRuntimeState));
    return { playerState, city: getCityDefinition(academy.cityId), currentCityId: getCurrentCityId(nextRuntimeState), academy: serializeAcademy(academy, nextRuntimeState), academies, message: `${academy.name}: ${stage.title} started.` };
  });
}

export async function completeCityAcademyForUser(user, academyId) {
  return withTransaction(async (client) => {
    const { runtimeState } = await loadRuntimeState(client, user);
    const academy = getAcademyById(academyId);
    if (!academy) throw new HttpError(404, "City academy not found.", "CITY_ACADEMY_NOT_FOUND");
    const serialized = serializeAcademy(academy, runtimeState);
    const stage = serialized.stages.find((entry) => entry.activeStudy);
    if (!stage?.canComplete) throw new HttpError(409, stage?.lockReason ?? serialized.lockReason ?? "This academy study is not ready to complete.", "CITY_ACADEMY_COMPLETE_BLOCKED");

    const now = Date.now();
    applyReward(runtimeState, stage.reward, now);
    addCityStanding(runtimeState, academy.cityId, stage.standingReward ?? 2, now, "academy");
    const completedStages = getCompletedStageRecords(runtimeState, academy);
    const state = ensureAcademyState(runtimeState);
    const completed = asRecord(state.completed[academy.id]);
    completedStages[stage.id] = { academyId: academy.id, stageId: stage.id, cityId: academy.cityId, completedAt: now };
    const allComplete = academy.stages.every((academyStage) => completedStages[academyStage.id]);
    state.completed[academy.id] = { ...completed, academyId: academy.id, cityId: academy.cityId, stages: completedStages, completedAt: allComplete ? now : completed.completedAt ?? null };
    state.activeStudy = null;
    runtimeState.player.counters = {
      ...asRecord(runtimeState.player.counters),
      academyStagesCompleted: Math.max(0, Math.floor(asNumber(runtimeState.player.counters?.academyStagesCompleted, 0) + 1)),
      academyPrimersCompleted: stage.id === "primer"
        ? Math.max(0, Math.floor(asNumber(runtimeState.player.counters?.academyPrimersCompleted, 0) + 1))
        : Math.max(0, Math.floor(asNumber(runtimeState.player.counters?.academyPrimersCompleted, 0))),
      firstAcademyCompletionAt: runtimeState.player.counters?.firstAcademyCompletionAt ?? now,
    };
    const sourceStage = academy.stages.find((academyStage) => academyStage.id === stage.id);
    addLegacyEntry(runtimeState, { id: `academy_completion_${academy.id}_${stage.id}`, title: sourceStage?.chronicle?.title ?? stage.title, summary: sourceStage?.chronicle?.summary ?? `Completed ${stage.title} in ${academy.name}.`, kind: "academy", awardedAt: now });

    const playerState = await upsertPlayerRuntimeState(client, user.internalId, runtimeState);
    const nextRuntimeState = buildMutableRuntimeState(user, playerState);
    const academies = getCityAcademies(academy.cityId).map((entry) => serializeAcademy(entry, nextRuntimeState));
    return { playerState, city: getCityDefinition(academy.cityId), currentCityId: getCurrentCityId(nextRuntimeState), academy: serializeAcademy(academy, nextRuntimeState), academies, message: `${academy.name}: ${stage.title} completed.` };
  });
}
