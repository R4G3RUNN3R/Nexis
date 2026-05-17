import { query, withTransaction } from "../db/pool.js";
import { HttpError } from "../lib/errors.js";
import { buildMutableRuntimeState } from "../lib/runtimePlayerState.js";
import {
  createDefaultPlayerState,
  findPlayerStateByUserInternalId,
  upsertPlayerRuntimeState,
} from "../repositories/playerStateRepository.js";
import { getCityDefinition, getCityOccupancyCandidates, isValidCityId, normalizeCityId } from "../data/cityData.js";
import { getAcademyById, getCityAcademy, getCityContract, getCityContracts } from "../data/cityLoopData.js";
import { resolveTravelForRuntimeState } from "./travelService.js";

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

function ensureContractState(runtimeState) {
  const player = asRecord(runtimeState.player);
  const existing = asRecord(player.cityContracts);
  const records = asRecord(existing.records);
  player.cityContracts = {
    ...existing,
    records: { ...records },
  };
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

function getContractRecord(runtimeState, contractId) {
  return asRecord(ensureContractState(runtimeState).records[contractId]);
}

function setContractRecord(runtimeState, contractId, record) {
  const state = ensureContractState(runtimeState);
  state.records[contractId] = { ...record };
}

function getContractStatus(record) {
  return record.status === "active" || record.status === "completed" || record.status === "claimed"
    ? record.status
    : "available";
}

function getCompletedCourses(runtimeState) {
  const education = asRecord(runtimeState.education);
  const completedCourses = asArray(education.completedCourses).filter((entry) => typeof entry === "string");
  const legacyCompleted = Object.entries(asRecord(education.completed))
    .filter(([, value]) => value === true || asRecord(value).completed === true)
    .map(([courseId]) => courseId);
  return Array.from(new Set([...completedCourses, ...legacyCompleted]));
}

function hasCompletedCourses(runtimeState, requiredCourses) {
  const completed = new Set(getCompletedCourses(runtimeState));
  return requiredCourses.every((courseId) => completed.has(courseId));
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
    for (const item of items) {
      const itemId = typeof item.itemId === "string" ? item.itemId : "";
      if (!itemId) continue;
      const quantity = Math.max(1, Math.floor(asNumber(item.quantity, 1)));
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
    state.records[contractId] = {
      ...record,
      visitedCityId: normalizeCityId(visitCityId),
      visitedCityAt: now,
    };
    changed = true;
  }

  return changed;
}

async function loadRuntimeState(client, user) {
  await createDefaultPlayerState(client, user.internalId);
  const playerState = await findPlayerStateByUserInternalId(client, user.internalId);
  if (!playerState) {
    throw new HttpError(404, "Player state unavailable.", "PLAYER_STATE_NOT_FOUND");
  }

  const runtimeState = buildMutableRuntimeState(user, playerState);
  const travelResolution = resolveTravelForRuntimeState(runtimeState);
  let changed = travelResolution.changed;
  changed = touchContractProgress(runtimeState) || changed;

  if (changed) {
    const nextPlayerState = await upsertPlayerRuntimeState(client, user.internalId, runtimeState);
    return {
      playerState: nextPlayerState,
      runtimeState: buildMutableRuntimeState(user, nextPlayerState),
    };
  }

  return { playerState, runtimeState };
}

function serializeContract(contract, runtimeState) {
  const record = getContractRecord(runtimeState, contract.id);
  const status = getContractStatus(record);
  const currentCityId = getCurrentCityId(runtimeState);
  const inContractCity = currentCityId === normalizeCityId(contract.cityId);
  const inTransit = isInTransit(runtimeState);
  const completion = asRecord(contract.completion);
  const visitCityId = typeof completion.visitCityId === "string" ? normalizeCityId(completion.visitCityId, "") : null;
  const visitComplete = !visitCityId || Boolean(record.visitedCityAt);
  const staminaCost = Math.max(0, Math.floor(asNumber(completion.staminaCost, 0)));
  const enoughStamina = getStamina(runtimeState) >= staminaCost;

  const canAccept = status === "available" && !inTransit && inContractCity;
  const canComplete = status === "active" && !inTransit && inContractCity && visitComplete && enoughStamina;
  const canClaim = status === "completed";

  let blockedReason = null;
  if (status === "claimed") blockedReason = "Rewards have already been claimed.";
  else if (status === "completed") blockedReason = "Contract complete. Claim the rewards.";
  else if (status === "active" && !visitComplete) blockedReason = `Visit ${completion.visitLabel ?? "the required city"}, then return to ${getCityDefinition(contract.cityId).name}.`;
  else if (status === "active" && !enoughStamina) blockedReason = `You need ${staminaCost} stamina to finish this contract.`;
  else if (inTransit) blockedReason = "Finish your current travel before handling local contracts.";
  else if (!inContractCity) blockedReason = `Travel to ${getCityDefinition(contract.cityId).name} to work this contract.`;

  return {
    id: contract.id,
    cityId: contract.cityId,
    title: contract.title,
    type: contract.type,
    summary: contract.summary,
    risk: contract.risk,
    requirementLabel: contract.requirementLabel,
    completion: {
      staminaCost,
      note: typeof completion.note === "string" ? completion.note : null,
      visitCityId,
      visitLabel: typeof completion.visitLabel === "string" ? completion.visitLabel : null,
      visitComplete,
    },
    reward: contract.reward,
    status,
    acceptedAt: typeof record.acceptedAt === "number" ? record.acceptedAt : null,
    completedAt: typeof record.completedAt === "number" ? record.completedAt : null,
    claimedAt: typeof record.claimedAt === "number" ? record.claimedAt : null,
    visitedCityAt: typeof record.visitedCityAt === "number" ? record.visitedCityAt : null,
    canAccept,
    canComplete,
    canClaim,
    blockedReason,
  };
}

function serializeContractsForCity(cityId, runtimeState) {
  const normalizedCityId = normalizeCityId(cityId, "");
  if (!normalizedCityId || !isValidCityId(normalizedCityId)) {
    throw new HttpError(400, "City unavailable.", "CITY_INVALID");
  }
  const city = getCityDefinition(normalizedCityId);
  return {
    city: {
      id: city.id,
      name: city.name,
      role: city.role,
    },
    currentCityId: getCurrentCityId(runtimeState),
    contracts: getCityContracts(normalizedCityId).map((contract) => serializeContract(contract, runtimeState)),
  };
}

function assertContractAction(contract, runtimeState, action) {
  const serialized = serializeContract(contract, runtimeState);
  if (action === "accept" && !serialized.canAccept) {
    throw new HttpError(409, serialized.blockedReason ?? "This contract cannot be accepted right now.", "CITY_CONTRACT_ACCEPT_BLOCKED");
  }
  if (action === "complete" && !serialized.canComplete) {
    throw new HttpError(409, serialized.blockedReason ?? "This contract cannot be completed right now.", "CITY_CONTRACT_COMPLETE_BLOCKED");
  }
  if (action === "claim" && !serialized.canClaim) {
    throw new HttpError(409, serialized.blockedReason ?? "This contract cannot be claimed right now.", "CITY_CONTRACT_CLAIM_BLOCKED");
  }
  return serialized;
}

function consumeStamina(runtimeState, amount) {
  if (!amount) return;
  const player = runtimeState.player;
  player.stats = { ...asRecord(player.stats) };
  player.stats.stamina = Math.max(0, Math.floor(asNumber(player.stats.stamina, 0) - amount));
}

function serializeAcademy(academy, runtimeState, now = Date.now()) {
  const state = ensureAcademyState(runtimeState);
  const currentCityId = getCurrentCityId(runtimeState);
  const inAcademyCity = currentCityId === normalizeCityId(academy.cityId);
  const inTransit = isInTransit(runtimeState);
  const activeStudy = asRecord(state.activeStudy);
  const activeForThisAcademy = activeStudy.academyId === academy.id;
  const completedRecord = asRecord(state.completed[academy.id]);
  const isCompleted = Boolean(completedRecord.completedAt);
  const missingCourses = getMissingCourses(runtimeState, academy.requiredCourses ?? []);
  const hasCourses = missingCourses.length === 0;
  const endsAt = activeForThisAcademy ? asNumber(activeStudy.endsAt, 0) : null;
  const startedAt = activeForThisAcademy ? asNumber(activeStudy.startedAt, 0) : null;
  const durationMs = Math.max(1000, asNumber(academy.durationMs, 5 * 60 * 1000));
  const readyToComplete = activeForThisAcademy && endsAt && now >= endsAt;

  let lockReason = null;
  if (isCompleted) lockReason = "You have completed this academy primer.";
  else if (inTransit) lockReason = "Finish your current travel before starting academy study.";
  else if (!inAcademyCity) lockReason = `Travel to ${getCityDefinition(academy.cityId).name} to study here.`;
  else if (missingCourses.length) lockReason = academy.lockReason;
  else if (activeStudy.academyId && !activeForThisAcademy) lockReason = "Finish your active academy study before starting another.";
  else if (activeForThisAcademy && !readyToComplete) lockReason = "Study is underway. Return when the timer is complete.";

  return {
    id: academy.id,
    cityId: academy.cityId,
    name: academy.name,
    theme: academy.theme,
    entryRequirements: academy.entryRequirements,
    requiredCourses: academy.requiredCourses ?? [],
    missingCourses,
    lockReason,
    durationMs,
    progressionSupports: academy.progressionSupports,
    reward: academy.reward,
    isCompleted,
    completedAt: typeof completedRecord.completedAt === "number" ? completedRecord.completedAt : null,
    activeStudy: activeForThisAcademy
      ? {
          academyId: academy.id,
          cityId: academy.cityId,
          startedAt,
          endsAt,
          readyToComplete: Boolean(readyToComplete),
          progressPercent: Math.max(0, Math.min(100, Math.round(((now - startedAt) / durationMs) * 100))),
        }
      : null,
    canStart: !isCompleted && !inTransit && inAcademyCity && hasCourses && !activeStudy.academyId,
    canComplete: Boolean(activeForThisAcademy && inAcademyCity && readyToComplete),
  };
}

export async function getCityPeopleForUser(user, cityId) {
  const normalizedCityId = normalizeCityId(cityId, "");
  if (!normalizedCityId || !isValidCityId(normalizedCityId)) {
    throw new HttpError(400, "City unavailable.", "CITY_INVALID");
  }

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
    city: {
      id: city.id,
      name: city.name,
      role: city.role,
      peopleLabel: city.peopleLabel,
    },
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
    setContractRecord(runtimeState, contract.id, {
      status: "active",
      cityId: contract.cityId,
      acceptedAt: now,
    });
    const playerState = await upsertPlayerRuntimeState(client, user.internalId, runtimeState);
    return {
      playerState,
      ...serializeContractsForCity(contract.cityId, buildMutableRuntimeState(user, playerState)),
      message: `${contract.title} accepted.`,
    };
  });
}

export async function completeCityContractForUser(user, contractId) {
  return withTransaction(async (client) => {
    const { runtimeState } = await loadRuntimeState(client, user);
    const contract = getCityContract(contractId);
    if (!contract) throw new HttpError(404, "Local contract not found.", "CITY_CONTRACT_NOT_FOUND");

    const serialized = assertContractAction(contract, runtimeState, "complete");
    const now = Date.now();
    consumeStamina(runtimeState, serialized.completion.staminaCost);
    const record = getContractRecord(runtimeState, contract.id);
    setContractRecord(runtimeState, contract.id, {
      ...record,
      status: "completed",
      completedAt: now,
    });
    const playerState = await upsertPlayerRuntimeState(client, user.internalId, runtimeState);
    return {
      playerState,
      ...serializeContractsForCity(contract.cityId, buildMutableRuntimeState(user, playerState)),
      message: `${contract.title} completed. Claim the rewards when ready.`,
    };
  });
}

export async function claimCityContractForUser(user, contractId) {
  return withTransaction(async (client) => {
    const { runtimeState } = await loadRuntimeState(client, user);
    const contract = getCityContract(contractId);
    if (!contract) throw new HttpError(404, "Local contract not found.", "CITY_CONTRACT_NOT_FOUND");

    assertContractAction(contract, runtimeState, "claim");
    const now = Date.now();
    applyReward(runtimeState, contract.reward, now);
    const record = getContractRecord(runtimeState, contract.id);
    setContractRecord(runtimeState, contract.id, {
      ...record,
      status: "claimed",
      claimedAt: now,
    });
    const player = runtimeState.player;
    player.counters = {
      ...asRecord(player.counters),
      cityContractsCompleted: Math.max(0, Math.floor(asNumber(player.counters?.cityContractsCompleted, 0) + 1)),
      firstCityContractCompletedAt: player.counters?.firstCityContractCompletedAt ?? now,
    };
    if (contract.chronicle) {
      addLegacyEntry(runtimeState, {
        id: `city_contract_${contract.id}_${now}`,
        title: contract.chronicle.title,
        summary: contract.chronicle.summary,
        kind: "city_contract",
        awardedAt: now,
      });
    }
    const playerState = await upsertPlayerRuntimeState(client, user.internalId, runtimeState);
    return {
      playerState,
      ...serializeContractsForCity(contract.cityId, buildMutableRuntimeState(user, playerState)),
      message: `${contract.title} rewards claimed.`,
    };
  });
}

export async function getCityAcademyForUser(user, cityId) {
  return withTransaction(async (client) => {
    const { playerState, runtimeState } = await loadRuntimeState(client, user);
    const normalizedCityId = normalizeCityId(cityId, "");
    if (!normalizedCityId || !isValidCityId(normalizedCityId)) {
      throw new HttpError(400, "City unavailable.", "CITY_INVALID");
    }
    return {
      playerState,
      city: getCityDefinition(normalizedCityId),
      currentCityId: getCurrentCityId(runtimeState),
      academy: serializeAcademy(getCityAcademy(normalizedCityId), runtimeState),
    };
  });
}

export async function startCityAcademyForUser(user, academyId) {
  return withTransaction(async (client) => {
    const { runtimeState } = await loadRuntimeState(client, user);
    const academy = getAcademyById(academyId);
    if (!academy) throw new HttpError(404, "City academy not found.", "CITY_ACADEMY_NOT_FOUND");
    const serialized = serializeAcademy(academy, runtimeState);
    if (!serialized.canStart) {
      throw new HttpError(409, serialized.lockReason ?? "This academy cannot be started right now.", "CITY_ACADEMY_START_BLOCKED");
    }

    const now = Date.now();
    const state = ensureAcademyState(runtimeState);
    state.activeStudy = {
      academyId: academy.id,
      cityId: academy.cityId,
      startedAt: now,
      endsAt: now + academy.durationMs,
    };
    runtimeState.player.counters = {
      ...asRecord(runtimeState.player.counters),
      academyEnrollments: Math.max(0, Math.floor(asNumber(runtimeState.player.counters?.academyEnrollments, 0) + 1)),
      firstAcademyEnrollmentAt: runtimeState.player.counters?.firstAcademyEnrollmentAt ?? now,
    };
    addLegacyEntry(runtimeState, {
      id: `academy_enrollment_${academy.id}_${now}`,
      title: academy.chronicle.title,
      summary: academy.chronicle.summary,
      kind: "academy",
      awardedAt: now,
    });

    const playerState = await upsertPlayerRuntimeState(client, user.internalId, runtimeState);
    const nextRuntimeState = buildMutableRuntimeState(user, playerState);
    return {
      playerState,
      city: getCityDefinition(academy.cityId),
      currentCityId: getCurrentCityId(nextRuntimeState),
      academy: serializeAcademy(academy, nextRuntimeState),
      message: `${academy.name} study started.`,
    };
  });
}

export async function completeCityAcademyForUser(user, academyId) {
  return withTransaction(async (client) => {
    const { runtimeState } = await loadRuntimeState(client, user);
    const academy = getAcademyById(academyId);
    if (!academy) throw new HttpError(404, "City academy not found.", "CITY_ACADEMY_NOT_FOUND");
    const serialized = serializeAcademy(academy, runtimeState);
    if (!serialized.canComplete) {
      throw new HttpError(409, serialized.lockReason ?? "This academy study is not ready to complete.", "CITY_ACADEMY_COMPLETE_BLOCKED");
    }

    const now = Date.now();
    applyReward(runtimeState, academy.reward, now);
    const state = ensureAcademyState(runtimeState);
    state.completed[academy.id] = {
      academyId: academy.id,
      cityId: academy.cityId,
      completedAt: now,
    };
    state.activeStudy = null;
    runtimeState.player.counters = {
      ...asRecord(runtimeState.player.counters),
      academyPrimersCompleted: Math.max(0, Math.floor(asNumber(runtimeState.player.counters?.academyPrimersCompleted, 0) + 1)),
      firstAcademyCompletionAt: runtimeState.player.counters?.firstAcademyCompletionAt ?? now,
    };
    addLegacyEntry(runtimeState, {
      id: `academy_completion_${academy.id}_${now}`,
      title: academy.chronicle.completionTitle,
      summary: academy.chronicle.completionSummary,
      kind: "academy",
      awardedAt: now,
    });

    const playerState = await upsertPlayerRuntimeState(client, user.internalId, runtimeState);
    const nextRuntimeState = buildMutableRuntimeState(user, playerState);
    return {
      playerState,
      city: getCityDefinition(academy.cityId),
      currentCityId: getCurrentCityId(nextRuntimeState),
      academy: serializeAcademy(academy, nextRuntimeState),
      message: `${academy.name} primer completed.`,
    };
  });
}
