import { withTransaction } from "../db/pool.js";
import { HttpError } from "../lib/errors.js";
import { buildMutableRuntimeState } from "../lib/runtimePlayerState.js";
import {
  createDefaultPlayerState,
  findPlayerStateByUserInternalId,
  upsertPlayerRuntimeState,
} from "../repositories/playerStateRepository.js";
import { findOrganizationForUserByType } from "../repositories/organizationRepository.js";
import {
  CIVIC_JOB_TRACKS,
  CONSORTIUM_CIVIC_POLICY,
  createTrackProgress,
  defaultCivicEmploymentState,
  getActiveCivicJobPassives,
  getCivicSpendOptions,
  getCivicTrack,
  getCurrentRank,
  getNextRank,
  getRequiredPointsForRank,
  getRuleFailure,
  getShiftCooldownRemaining,
  isConsortiumMember,
  normalizeCivicEmploymentState,
} from "../data/civicJobsData.js";

function asRecord(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : {};
}

function asNumber(value, fallback = 0) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return fallback;
  return numeric;
}

function asWholeNumber(value, fallback = 0) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return fallback;
  return Math.max(0, Math.floor(numeric));
}

function getPolicy(runtimeState, authoritativeConsortiumMembership = null) {
  const consortiumBlocked =
    typeof authoritativeConsortiumMembership === "boolean"
      ? authoritativeConsortiumMembership
      : isConsortiumMember(runtimeState);
  return {
    consortiumBlocked,
    rule: CONSORTIUM_CIVIC_POLICY.mode,
    blockedReason: consortiumBlocked ? CONSORTIUM_CIVIC_POLICY.blockedReason : null,
  };
}

function applyPolicy(runtimeState, authoritativeConsortiumMembership = null) {
  const civicEmployment = normalizeCivicEmploymentState(runtimeState.civicEmployment);
  const policy = getPolicy(runtimeState, authoritativeConsortiumMembership);
  let changed = false;

  if (policy.consortiumBlocked && civicEmployment.activeTrackId) {
    civicEmployment.activeTrackId = null;
    changed = true;
  }

  runtimeState.civicEmployment = civicEmployment;
  return { civicEmployment, policy, changed };
}

async function loadRuntimeState(client, user) {
  await createDefaultPlayerState(client, user.internalId);
  const playerState = await findPlayerStateByUserInternalId(client, user.internalId);
  if (!playerState) {
    throw new HttpError(404, "Player state unavailable.", "PLAYER_STATE_NOT_FOUND");
  }

  const runtimeState = buildMutableRuntimeState(user, playerState);
  const authoritativeConsortiumMembership = Boolean(
    await findOrganizationForUserByType(client, user.internalId, "consortium"),
  );
  const policyState = applyPolicy(runtimeState, authoritativeConsortiumMembership);
  if (policyState.changed) {
    const updatedPlayerState = await upsertPlayerRuntimeState(client, user.internalId, runtimeState);
    return {
      playerState: updatedPlayerState,
      runtimeState: buildMutableRuntimeState(user, updatedPlayerState),
      civicEmployment: normalizeCivicEmploymentState(runtimeState.civicEmployment),
      policy: policyState.policy,
    };
  }

  return {
    playerState,
    runtimeState,
    civicEmployment: policyState.civicEmployment,
    policy: policyState.policy,
  };
}

async function persistRuntimeState(client, user, runtimeState) {
  const playerState = await upsertPlayerRuntimeState(client, user.internalId, runtimeState);
  const nextRuntimeState = buildMutableRuntimeState(user, playerState);
  const authoritativeConsortiumMembership = Boolean(
    await findOrganizationForUserByType(client, user.internalId, "consortium"),
  );
  const policyState = applyPolicy(nextRuntimeState, authoritativeConsortiumMembership);
  return {
    playerState,
    runtimeState: nextRuntimeState,
    civicEmployment: policyState.civicEmployment,
    policy: policyState.policy,
  };
}

function responsePayload(result, extra = {}) {
  return {
    playerState: result.playerState,
    civicEmployment: result.civicEmployment,
    civicPolicy: result.policy,
    tracks: CIVIC_JOB_TRACKS,
    passives: getActiveCivicJobPassives(result.civicEmployment),
    ...extra,
  };
}

function ensurePolicyAllowsActions(policy) {
  if (policy.consortiumBlocked) {
    throw new HttpError(409, policy.blockedReason, "CIVIC_BLOCKED_BY_CONSORTIUM");
  }
}

function addWorkingStatGain(runtimeState, key, amount) {
  if (!amount) return;
  const workingStats = asRecord(runtimeState.player.workingStats);
  const currentValue = asNumber(workingStats[key], 0);
  workingStats[key] = Math.max(0, Math.floor(currentValue + amount));
  runtimeState.player.workingStats = workingStats;
}

function addBattleStatGain(runtimeState, key, amount) {
  if (!amount) return;
  const battleStats = asRecord(runtimeState.player.battleStats);
  const currentValue = asNumber(battleStats[key], 0);
  battleStats[key] = Math.max(0, Math.floor(currentValue + amount));
  runtimeState.player.battleStats = battleStats;
}

function addInventoryItem(runtimeState, itemId, quantity) {
  const qty = asWholeNumber(quantity, 0);
  if (!itemId || qty <= 0) return;
  const inventory = asRecord(runtimeState.player.inventory);
  inventory[itemId] = asWholeNumber(inventory[itemId], 0) + qty;
  runtimeState.player.inventory = inventory;
}

function addGold(runtimeState, amount) {
  if (!amount) return;
  const player = asRecord(runtimeState.player);
  const currentGold = Math.max(0, Math.floor(asNumber(player.gold, 0)));
  const nextGold = currentGold + Math.max(0, Math.floor(amount));
  player.gold = nextGold;
  const currencies = asRecord(player.currencies);
  currencies.gold = nextGold;
  player.currencies = currencies;
  runtimeState.player = player;
}

export async function getCivicJobsForUser(user) {
  return withTransaction(async (client) => {
    const result = await loadRuntimeState(client, user);
    return responsePayload(result);
  });
}

export async function joinCivicTrackForUser(user, payload) {
  return withTransaction(async (client) => {
    const result = await loadRuntimeState(client, user);
    ensurePolicyAllowsActions(result.policy);

    const trackId = String(payload?.trackId ?? "").trim();
    const track = getCivicTrack(trackId);
    if (!track) {
      throw new HttpError(400, "That civic job is unavailable.", "CIVIC_TRACK_INVALID");
    }

    const civicEmployment = normalizeCivicEmploymentState(result.runtimeState.civicEmployment ?? defaultCivicEmploymentState());
    if (civicEmployment.activeTrackId && civicEmployment.activeTrackId !== track.id) {
      throw new HttpError(409, "You can only hold one civic job at a time.", "CIVIC_ONE_JOB_ONLY");
    }

    const entryFailure = getRuleFailure(track.entryRule, result.runtimeState);
    if (entryFailure) {
      throw new HttpError(409, entryFailure, "CIVIC_ENTRY_BLOCKED");
    }

    const now = Date.now();
    civicEmployment.trackProgress = {
      ...civicEmployment.trackProgress,
      [track.id]: civicEmployment.trackProgress[track.id] ?? createTrackProgress(now),
    };
    civicEmployment.activeTrackId = track.id;
    result.runtimeState.civicEmployment = civicEmployment;

    const updated = await persistRuntimeState(client, user, result.runtimeState);
    return responsePayload(updated, {
      message: `Joined ${track.name}.`,
      action: "joined",
    });
  });
}

export async function resignCivicTrackForUser(user) {
  return withTransaction(async (client) => {
    const result = await loadRuntimeState(client, user);
    const civicEmployment = normalizeCivicEmploymentState(result.runtimeState.civicEmployment ?? defaultCivicEmploymentState());
    const activeTrackId = civicEmployment.activeTrackId;
    if (!activeTrackId) {
      throw new HttpError(409, "No active civic job to resign from.", "CIVIC_NOT_EMPLOYED");
    }

    civicEmployment.activeTrackId = null;
    result.runtimeState.civicEmployment = civicEmployment;

    const updated = await persistRuntimeState(client, user, result.runtimeState);
    const track = getCivicTrack(activeTrackId);
    return responsePayload(updated, {
      message: `Resigned from ${track?.name ?? "city employment"}. Stored rank and job points are preserved.`,
      action: "resigned",
    });
  });
}

export async function collectCivicBenefitsForUser(user) {
  return withTransaction(async (client) => {
    const result = await loadRuntimeState(client, user);
    ensurePolicyAllowsActions(result.policy);

    const civicEmployment = normalizeCivicEmploymentState(result.runtimeState.civicEmployment ?? defaultCivicEmploymentState());
    const activeTrackId = civicEmployment.activeTrackId;
    if (!activeTrackId) {
      throw new HttpError(409, "No active civic job selected.", "CIVIC_NOT_EMPLOYED");
    }

    const track = getCivicTrack(activeTrackId);
    if (!track) {
      throw new HttpError(409, "Your active civic job is invalid.", "CIVIC_TRACK_INVALID");
    }

    const progress = civicEmployment.trackProgress[activeTrackId] ?? createTrackProgress(Date.now());
    const cooldownRemainingMs = getShiftCooldownRemaining(progress);
    if (cooldownRemainingMs > 0) {
      throw new HttpError(409, "Daily civic collection is still on cooldown.", "CIVIC_COOLDOWN_ACTIVE");
    }

    const currentRank = getCurrentRank(track, progress);
    addGold(result.runtimeState, currentRank.dailyGold);

    for (const [statKey, amount] of Object.entries(asRecord(currentRank.workingStatGains))) {
      addWorkingStatGain(result.runtimeState, statKey, asNumber(amount, 0));
    }

    const nextProgress = {
      ...progress,
      jobPoints: Math.max(0, Math.floor(asNumber(progress.jobPoints, 0) + asNumber(currentRank.dailyJobPoints, 0))),
      shiftsWorked: Math.max(0, Math.floor(asNumber(progress.shiftsWorked, 0) + 1)),
      lastShiftAt: Date.now(),
    };

    civicEmployment.trackProgress = {
      ...civicEmployment.trackProgress,
      [activeTrackId]: nextProgress,
    };
    result.runtimeState.civicEmployment = civicEmployment;

    const updated = await persistRuntimeState(client, user, result.runtimeState);

    return responsePayload(updated, {
      action: "collected",
      collection: {
        trackId: track.id,
        trackName: track.name,
        rank: currentRank.rank,
        rankTitle: currentRank.title,
        dailyGold: currentRank.dailyGold,
        dailyJobPoints: currentRank.dailyJobPoints,
        workingStatGains: currentRank.workingStatGains,
        promotions: [],
      },
      message: "Daily civic benefits collected.",
    });
  });
}

export async function promoteCivicTrackForUser(user) {
  return withTransaction(async (client) => {
    const result = await loadRuntimeState(client, user);
    ensurePolicyAllowsActions(result.policy);

    const civicEmployment = normalizeCivicEmploymentState(result.runtimeState.civicEmployment ?? defaultCivicEmploymentState());
    const activeTrackId = civicEmployment.activeTrackId;
    if (!activeTrackId) {
      throw new HttpError(409, "No active civic job selected.", "CIVIC_NOT_EMPLOYED");
    }

    const track = getCivicTrack(activeTrackId);
    if (!track) {
      throw new HttpError(409, "Your active civic job is invalid.", "CIVIC_TRACK_INVALID");
    }

    const progress = civicEmployment.trackProgress[activeTrackId] ?? createTrackProgress(Date.now());
    const nextRank = getNextRank(track, progress);
    if (!nextRank) {
      throw new HttpError(409, "Maximum civic rank already reached.", "CIVIC_MAX_RANK");
    }

    const requiredPoints = getRequiredPointsForRank(nextRank.rank);
    if (progress.jobPoints < requiredPoints) {
      throw new HttpError(
        409,
        `Promotion requires ${requiredPoints} ${track.name} JP.`,
        "CIVIC_PROMOTION_POINTS_REQUIRED",
      );
    }

    const blockedReason = getRuleFailure(nextRank.requirementRule, result.runtimeState);
    if (blockedReason) {
      throw new HttpError(409, blockedReason, "CIVIC_PROMOTION_REQUIREMENT_BLOCKED");
    }

    const nextProgress = {
      ...progress,
      rank: nextRank.rank,
      jobPoints: Math.max(0, progress.jobPoints - requiredPoints),
    };

    civicEmployment.trackProgress = {
      ...civicEmployment.trackProgress,
      [activeTrackId]: nextProgress,
    };
    result.runtimeState.civicEmployment = civicEmployment;

    const updated = await persistRuntimeState(client, user, result.runtimeState);
    return responsePayload(updated, {
      action: "promoted",
      message: `Promoted to ${nextRank.title}. ${requiredPoints} JP spent.`,
      promotion: {
        trackId: track.id,
        trackName: track.name,
        newRank: nextRank.rank,
        newTitle: nextRank.title,
        spentJobPoints: requiredPoints,
      },
    });
  });
}

export async function spendCivicJobPointsForUser(user, payload) {
  return withTransaction(async (client) => {
    const result = await loadRuntimeState(client, user);

    const trackId = String(payload?.trackId ?? "").trim();
    const optionId = String(payload?.optionId ?? "").trim();
    if (!trackId || !optionId) {
      throw new HttpError(400, "Track and spend option are required.", "CIVIC_SPEND_INPUT_INVALID");
    }

    const track = getCivicTrack(trackId);
    if (!track) {
      throw new HttpError(400, "That civic job is unavailable.", "CIVIC_TRACK_INVALID");
    }

    const civicEmployment = normalizeCivicEmploymentState(result.runtimeState.civicEmployment ?? defaultCivicEmploymentState());
    const progress = civicEmployment.trackProgress[trackId];
    if (!progress) {
      throw new HttpError(409, "No saved progress exists for that civic job.", "CIVIC_TRACK_PROGRESS_MISSING");
    }

    const spendOptions = getCivicSpendOptions(trackId);
    const selectedOption = spendOptions.find((entry) => entry.id === optionId);
    if (!selectedOption) {
      throw new HttpError(400, "Invalid civic spend option.", "CIVIC_SPEND_OPTION_INVALID");
    }

    const cost = asWholeNumber(selectedOption.costJobPoints, 0);
    if (progress.jobPoints < cost) {
      throw new HttpError(409, `Requires ${cost} ${track.name} JP.`, "CIVIC_SPEND_POINTS_REQUIRED");
    }

    const nextProgress = {
      ...progress,
      jobPoints: Math.max(0, progress.jobPoints - cost),
    };

    let grantedItem = null;
    const effect = asRecord(selectedOption.effect);
    if (effect.kind === "battle_stat") {
      const stat = String(effect.stat ?? "");
      const amount = asWholeNumber(effect.amount, 0);
      if (!["strength", "defense", "speed", "dexterity"].includes(stat) || amount <= 0) {
        throw new HttpError(500, "Configured battle stat reward is invalid.", "CIVIC_SPEND_EFFECT_INVALID");
      }
      addBattleStatGain(result.runtimeState, stat, amount);
    } else if (effect.kind === "working_stat") {
      const stat = String(effect.stat ?? "");
      const amount = asWholeNumber(effect.amount, 0);
      if (!["manualLabor", "intelligence", "endurance"].includes(stat) || amount <= 0) {
        throw new HttpError(500, "Configured working stat reward is invalid.", "CIVIC_SPEND_EFFECT_INVALID");
      }
      addWorkingStatGain(result.runtimeState, stat, amount);
    } else if (effect.kind === "inventory_roll") {
      const pool = Array.isArray(effect.pool) ? effect.pool.filter((entry) => typeof entry?.itemId === "string") : [];
      if (pool.length === 0) {
        throw new HttpError(500, "Configured inventory reward pool is empty.", "CIVIC_SPEND_EFFECT_INVALID");
      }
      const selectedItem = pool[Math.floor(Math.random() * pool.length)];
      const itemId = String(selectedItem.itemId);
      const quantity = Math.max(1, asWholeNumber(selectedItem.quantity, 1));
      addInventoryItem(result.runtimeState, itemId, quantity);
      grantedItem = {
        itemId,
        quantity,
        label: String(selectedItem.label ?? itemId),
      };
    } else {
      throw new HttpError(500, "Unknown civic spend effect configured.", "CIVIC_SPEND_EFFECT_INVALID");
    }

    civicEmployment.trackProgress = {
      ...civicEmployment.trackProgress,
      [trackId]: nextProgress,
    };
    result.runtimeState.civicEmployment = civicEmployment;

    const updated = await persistRuntimeState(client, user, result.runtimeState);
    return responsePayload(updated, {
      action: "spent",
      message: grantedItem
        ? `${selectedOption.label} purchased. Received ${grantedItem.label}.`
        : `${selectedOption.label} purchased successfully.`,
      spendResult: {
        trackId,
        optionId,
        label: selectedOption.label,
        spentJobPoints: cost,
        grantedItem,
      },
    });
  });
}