import crypto from "node:crypto";
import { withTransaction } from "../db/pool.js";
import { HttpError } from "../lib/errors.js";
import {
  getConsortiumLogisticsTemplate,
  listConsortiumEscortModes,
  listConsortiumLogisticsTemplates,
} from "../data/consortiumLogistics.js";
import {
  findOrganizationByInternalId,
  findOrganizationByPublicId,
  insertOrganizationLog,
  updateOrganizationDetails,
} from "../repositories/organizationRepository.js";
import {
  readConsortiumLogisticsState,
  saveConsortiumLogisticsState,
} from "../repositories/consortiumLogisticsRepository.js";
import {
  createDefaultPlayerState,
  findPlayerStateByUserInternalId,
} from "../repositories/playerStateRepository.js";
import { getOrganizationBaseEffectsForOrg } from "./organizationBaseEffectService.js";

const MS_HOUR = 60 * 60 * 1000;
const asRecord = (value) => (value && typeof value === "object" && !Array.isArray(value) ? value : {});
const asInt = (value, fallback = 0) => (Number.isFinite(Number(value)) ? Math.max(0, Math.floor(Number(value))) : fallback);
const clamp = (value, min = 0, max = 100) => Math.max(min, Math.min(max, Number(value) || 0));

const OUTCOME_LABELS = {
  strong_success: "Strong Success",
  success: "Success",
  partial_success: "Partial Success",
  failure: "Failure",
  severe_failure: "Severe Failure",
};

function normalizeTreasury(value) {
  const treasury = asRecord(value);
  return {
    copper: asInt(treasury.copper),
    silver: asInt(treasury.silver),
    gold: asInt(treasury.gold),
    platinum: asInt(treasury.platinum),
  };
}

function ensureConsortium(organization) {
  if (!organization || organization.type !== "consortium") {
    throw new HttpError(404, "Consortium record unavailable.", "CONSORTIUM_NOT_FOUND");
  }
  return organization;
}

function ensureMember(organization, userInternalId) {
  const member = organization.members.find((entry) => entry.userInternalId === userInternalId);
  if (!member) {
    throw new HttpError(403, "You are not part of this consortium.", "CONSORTIUM_MEMBERSHIP_REQUIRED");
  }
  return member;
}

function getRolePermissions(organization, roleKey) {
  return organization.roles.find((entry) => entry.roleKey === roleKey)?.permissions ?? [];
}

function ensurePermission(organization, member, permission) {
  if (!getRolePermissions(organization, member.roleKey).includes(permission)) {
    throw new HttpError(403, "You do not have permission for consortium logistics.", "CONSORTIUM_PERMISSION_DENIED");
  }
}

function deterministicNumber(seed) {
  return parseInt(crypto.createHash("sha256").update(String(seed)).digest("hex").slice(0, 8), 16);
}

function deterministicPercent(seed) {
  return deterministicNumber(seed) % 100;
}

function deterministicRange(seed, min, max) {
  const lower = Math.min(min, max);
  const upper = Math.max(min, max);
  return lower + (deterministicNumber(seed) % (upper - lower + 1));
}

function deterministicFloat(seed, min, max) {
  const ratio = (deterministicNumber(seed) % 10000) / 10000;
  return min + ((max - min) * ratio);
}

function titleCaseDanger(tag) {
  return String(tag ?? "")
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function formatDangerList(tags) {
  if (!tags?.length) return "routine lane pressure";
  if (tags.length === 1) return titleCaseDanger(tags[0]);
  if (tags.length === 2) return `${titleCaseDanger(tags[0])} and ${titleCaseDanger(tags[1])}`;
  return `${tags.slice(0, -1).map(titleCaseDanger).join(", ")}, and ${titleCaseDanger(tags[tags.length - 1])}`;
}

function normalizeEscortContractForScoring(operation) {
  const escortContract = { ...asRecord(operation.escortContract) };
  if (escortContract.mode === "internal_team") {
    escortContract.coverageRating = computeInternalEscortCoverage(operation.assignedWorkers ?? []);
    escortContract.status = escortContract.coverageRating > 0 ? "internal_cover" : "understaffed_internal_cover";
  }
  return escortContract;
}

function createBlankOutcome() {
  return {
    result: null,
    resolvedAt: null,
    summary: null,
    goldReturned: null,
    treasuryDeltaGold: null,
    lossAppliedGold: 0,
    lossSummary: null,
    dangerTriggered: [],
    escortContribution: null,
    crewContribution: null,
    resolutionScore: null,
  };
}

function ensureMutableOperation(operation) {
  if (operation.state === "resolved") {
    throw new HttpError(400, "Resolved logistics operations can no longer be edited.", "CONSORTIUM_LOGISTICS_OPERATION_RESOLVED");
  }
}

async function buildWorkerPool(client, organization) {
  const workers = [];
  for (const member of organization.members) {
    await createDefaultPlayerState(client, member.userInternalId);
    const playerState = await findPlayerStateByUserInternalId(client, member.userInternalId);
    const workingStats = asRecord(playerState?.workingStats);
    const battleStats = asRecord(playerState?.battleStats);
    const workingScore = asInt(workingStats.manualLabor) + asInt(workingStats.intelligence) + asInt(workingStats.endurance);
    const battleScore = asInt(battleStats.strength) + asInt(battleStats.defense) + asInt(battleStats.speed) + asInt(battleStats.dexterity);
    workers.push({
      userInternalId: member.userInternalId,
      publicId: member.publicId,
      displayName: member.displayName,
      roleKey: member.roleKey,
      workingStats,
      battleStats,
      workingScore,
      battleScore,
    });
  }
  return workers;
}

function getDangerPressure(template) {
  const riskWeight = {
    low: 18,
    medium: 28,
    high: 40,
    severe: 52,
  }[template.riskLevel] ?? 24;
  return riskWeight + (template.dangerTags.length * 4) + (template.routeType === "ship" ? 6 : 0);
}

function computeInternalEscortCoverage(assignedWorkers) {
  if (!assignedWorkers.length) return 0;
  const totalBattle = assignedWorkers.reduce((sum, worker) => sum + asInt(asRecord(worker.battleStats).strength) + asInt(asRecord(worker.battleStats).defense) + asInt(asRecord(worker.battleStats).speed) + asInt(asRecord(worker.battleStats).dexterity), 0);
  return clamp(Math.round(totalBattle / (assignedWorkers.length * 4.5)), 0, 100);
}

function computeSuccessPreview(template, assignedWorkers, escortContract) {
  const totalWorking = assignedWorkers.reduce((sum, worker) => sum + asInt(asRecord(worker.workingStats).manualLabor) + asInt(asRecord(worker.workingStats).intelligence) + asInt(asRecord(worker.workingStats).endurance), 0);
  const totalBattle = assignedWorkers.reduce((sum, worker) => sum + asInt(asRecord(worker.battleStats).strength) + asInt(asRecord(worker.battleStats).defense) + asInt(asRecord(worker.battleStats).speed) + asInt(asRecord(worker.battleStats).dexterity), 0);
  const escortScore = asInt(escortContract.coverageRating);
  const dangerPressure = getDangerPressure(template);
  const workerCoverage = clamp(Math.round((assignedWorkers.length / Math.max(1, template.recommendedWorkers)) * 100), 0, 150);
  const workingLift = totalWorking / Math.max(1, template.recommendedWorkingScore);
  const battleLift = totalBattle / Math.max(1, template.recommendedBattleScore);
  const successOdds = clamp(
    Math.round(
      24
      + (workerCoverage * 0.12)
      + (workingLift * 23)
      + (battleLift * 20)
      + (escortScore * 0.34)
      - (dangerPressure * 0.58),
    ),
    5,
    96,
  );
  return {
    successOdds,
    totalWorking,
    totalBattle,
    escortScore,
    dangerPressure,
    workerCoverage,
    workingLift,
    battleLift,
  };
}

function getOutcomeKeyFromScore(score) {
  if (score >= 82) return "strong_success";
  if (score >= 62) return "success";
  if (score >= 44) return "partial_success";
  if (score >= 24) return "failure";
  return "severe_failure";
}

function computeTriggeredDangers(template, preview, outcomeKey, seed) {
  const scoredTags = template.dangerTags.map((tag) => {
    const threatScore = deterministicPercent(`${seed}:${tag}:threat`)
      + Math.round(preview.dangerPressure * 0.72)
      + ({
        strong_success: -22,
        success: -10,
        partial_success: 6,
        failure: 20,
        severe_failure: 34,
      }[outcomeKey] ?? 0)
      - Math.round(preview.escortScore * 0.42)
      - Math.round(preview.totalBattle * 0.09)
      - Math.round(preview.totalWorking * 0.05);
    return { tag, threatScore };
  }).sort((left, right) => right.threatScore - left.threatScore);

  let triggered = scoredTags.filter((entry) => entry.threatScore >= 68).map((entry) => entry.tag);
  const minCount = {
    strong_success: 0,
    success: 0,
    partial_success: 1,
    failure: 1,
    severe_failure: 2,
  }[outcomeKey] ?? 0;
  const maxCount = {
    strong_success: 1,
    success: 1,
    partial_success: 2,
    failure: 3,
    severe_failure: template.dangerTags.length,
  }[outcomeKey] ?? template.dangerTags.length;

  if (triggered.length < minCount) {
    const fallback = scoredTags.slice(0, minCount).map((entry) => entry.tag);
    triggered = [...new Set([...triggered, ...fallback])];
  }

  return triggered.slice(0, maxCount);
}

function rollGoldReturn(template, outcomeKey, seed) {
  if (outcomeKey === 'strong_success') {
    const ratio = deterministicFloat(`${seed}:reward`, 0.88, 1.0);
    return Math.round(template.rewardRange.minGold + ((template.rewardRange.maxGold - template.rewardRange.minGold) * ratio));
  }
  if (outcomeKey === 'success') {
    const ratio = deterministicFloat(`${seed}:reward`, 0.52, 0.78);
    return Math.round(template.rewardRange.minGold + ((template.rewardRange.maxGold - template.rewardRange.minGold) * ratio));
  }
  if (outcomeKey === 'partial_success') {
    return Math.round(template.rewardRange.minGold * deterministicFloat(`${seed}:reward`, 0.4, 0.82));
  }
  if (outcomeKey === 'failure') {
    return Math.round(template.rewardRange.minGold * deterministicFloat(`${seed}:reward`, 0.0, 0.18));
  }
  return 0;
}

function computeExtraLoss(template, outcomeKey, triggeredDangers, seed) {
  if (outcomeKey === "strong_success" || outcomeKey === "success") return 0;
  if (outcomeKey === "partial_success") {
    return Math.round((template.upfrontCostGold * deterministicFloat(`${seed}:loss`, 0.03, 0.12)) + (triggeredDangers.length * 25));
  }
  if (outcomeKey === "failure") {
    return Math.round((template.upfrontCostGold * deterministicFloat(`${seed}:loss`, 0.18, 0.38)) + (triggeredDangers.length * 60) + (template.routeType === "ship" ? 120 : 0));
  }
  return Math.round((template.upfrontCostGold * deterministicFloat(`${seed}:loss`, 0.45, 0.72)) + (triggeredDangers.length * 110) + (template.routeType === "ship" ? 240 : 120));
}

function describeCrewContribution(template, preview) {
  if (preview.workerCoverage < 60) {
    return "Crew coverage fell short of the route brief and left the cargo lane thinly held.";
  }
  if (preview.workingLift >= 1.2 && preview.battleLift >= 1.1) {
    return "Crew logistics discipline and security readiness both beat the route brief comfortably.";
  }
  if (preview.workingLift >= 1.15) {
    return "Crew handling and route discipline kept the freight moving cleanly through pressure points.";
  }
  if (preview.battleLift >= 1.15) {
    return "Crew security discipline mattered; the lane did not get to bully them for free.";
  }
  if (preview.workingLift >= 0.9 && preview.battleLift >= 0.9) {
    return "Crew performance stayed close to the route brief, without much spare margin.";
  }
  return "Crew readiness trailed the route brief and the lane made them pay for that optimism.";
}

function describeEscortContribution(escortContract, preview, triggeredDangers) {
  if (escortContract.mode === "guild_contract") {
    if (preview.escortScore >= 70) {
      return `${escortContract.guildName ?? "Guild escort"} supplied ${preview.escortScore} cover and materially reduced route losses.`;
    }
    return `${escortContract.guildName ?? "Guild escort"} supplied ${preview.escortScore} cover, but the lane still leaked pressure through the screen.`;
  }
  if (escortContract.mode === "internal_team") {
    if (preview.escortScore >= 60) {
      return `Internal escort cover rated ${preview.escortScore} and did real work when danger tags started barking.`;
    }
    return `Internal escort cover rated ${preview.escortScore}; the team helped, but not enough to make the route feel civilised.`;
  }
  if (triggeredDangers.length) {
    return "No escort cover was in place when the route met resistance.";
  }
  return "No escort cover was fielded, but this lane did not punish that gamble too harshly.";
}

function buildLossSummary(outcomeKey, lossAppliedGold, triggeredDangers) {
  if (!lossAppliedGold) return null;
  const dangerText = formatDangerList(triggeredDangers);
  if (outcomeKey === "partial_success") {
    return `Repairs, delays, and spoilage shaved ${lossAppliedGold.toLocaleString("en-GB")} gold off the return after ${dangerText}.`;
  }
  if (outcomeKey === "failure") {
    return `The consortium ate ${lossAppliedGold.toLocaleString("en-GB")} gold in replacement cost and damage claims after ${dangerText}.`;
  }
  return `The route collapsed under ${dangerText}, forcing ${lossAppliedGold.toLocaleString("en-GB")} gold into losses and emergency recovery.`;
}

function buildOutcomeSummary(template, outcomeKey, triggeredDangers, goldReturned, treasuryDeltaGold) {
  const dangerText = triggeredDangers.length ? formatDangerList(triggeredDangers) : "route pressure";
  const treasuryText = `${treasuryDeltaGold >= 0 ? "+" : "-"}${Math.abs(treasuryDeltaGold).toLocaleString("en-GB")} gold`;
  if (outcomeKey === "strong_success") {
    return `${template.displayName} outperformed the lane, beat ${dangerText}, and landed ${goldReturned.toLocaleString("en-GB")} gold in returns (${treasuryText}).`;
  }
  if (outcomeKey === "success") {
    return `${template.displayName} completed cleanly, absorbed ${dangerText}, and returned ${goldReturned.toLocaleString("en-GB")} gold (${treasuryText}).`;
  }
  if (outcomeKey === "partial_success") {
    return `${template.displayName} limped through ${dangerText} and still returned ${goldReturned.toLocaleString("en-GB")} gold (${treasuryText}).`;
  }
  if (outcomeKey === "failure") {
    return `${template.displayName} was broken by ${dangerText}; salvage was poor and treasury settled at ${treasuryText}.`;
  }
  return `${template.displayName} collapsed under ${dangerText}; recovery costs overwhelmed the run (${treasuryText}).`;
}


function applyLaunchCostReduction(baseCost, baseEffects) {
  const pct = clamp(Number(asRecord(baseEffects).effects?.launchCostReductionPct ?? 0), 0, 15);
  const discounted = Math.max(0, Math.round(baseCost * (1 - (pct / 100))));
  return { discountedCost: discounted, discountPct: Number(pct.toFixed(2)), discountGold: Math.max(0, baseCost - discounted) };
}

function applyRewardModifier(goldReturned, baseEffects) {
  const pct = clamp(Number(asRecord(baseEffects).effects?.logisticsRewardPct ?? 0), 0, 18);
  return { modified: Math.round(goldReturned * (1 + (pct / 100))), pct: Number(pct.toFixed(2)) };
}

function applyLossMitigation(lossGold, baseEffects) {
  const pct = clamp(Number(asRecord(baseEffects).effects?.logisticsLossMitigationPct ?? 0), 0, 18);
  return { modified: Math.max(0, Math.round(lossGold * (1 - (pct / 100)))), pct: Number(pct.toFixed(2)) };
}

function settleOperationOutcome(template, operation, treasury, baseEffects) {
  const escortContract = normalizeEscortContractForScoring(operation);
  const preview = computeSuccessPreview(template, operation.assignedWorkers ?? [], escortContract);
  const seed = `${operation.internalId}|${operation.startedAt ?? operation.createdAt}|${template.key}|${(operation.assignedWorkers ?? []).map((worker) => worker.publicId).sort().join(",")}|${escortContract.mode}|${escortContract.guildPublicId ?? "none"}|${escortContract.coverageRating}`;
  const chaos = deterministicRange(`${seed}:chaos`, -12, 12);
  const disciplineShift = deterministicRange(`${seed}:discipline`, -6, 8);
  const routeEfficiencyPct = clamp(Number(asRecord(baseEffects).effects?.routeEfficiencyPct ?? 0), 0, 14);
  const finalScore = clamp(Math.round(preview.successOdds + chaos + disciplineShift + (routeEfficiencyPct * 0.65) - (template.dangerTags.length > 3 ? 3 : 0)), 0, 100);
  const outcomeKey = getOutcomeKeyFromScore(finalScore);
  const triggeredDangers = computeTriggeredDangers(template, preview, outcomeKey, seed);
  const baseGoldReturned = rollGoldReturn(template, outcomeKey, seed);
  const rewardAdj = applyRewardModifier(baseGoldReturned, baseEffects);
  const goldReturned = rewardAdj.modified;
  const rawLossGoldBase = computeExtraLoss(template, outcomeKey, triggeredDangers, seed);
  const lossAdj = applyLossMitigation(rawLossGoldBase, baseEffects);
  const rawLossGold = lossAdj.modified;

  const nextTreasury = normalizeTreasury(treasury);
  nextTreasury.gold += goldReturned;
  const lossAppliedGold = Math.min(nextTreasury.gold, rawLossGold);
  nextTreasury.gold -= lossAppliedGold;
  const treasuryDeltaGold = goldReturned - lossAppliedGold;
  const crewContribution = describeCrewContribution(template, preview);
  const escortContribution = describeEscortContribution(escortContract, preview, triggeredDangers);
  const summary = buildOutcomeSummary(template, outcomeKey, triggeredDangers, goldReturned, treasuryDeltaGold);

  return {
    treasury: nextTreasury,
    operationPatch: {
      state: "resolved",
      statusText: `${OUTCOME_LABELS[outcomeKey]} resolved`,
      updatedAt: Date.now(),
      escortContract,
      outcome: {
        result: outcomeKey,
        resolvedAt: Date.now(),
        summary,
        goldReturned,
        treasuryDeltaGold,
        lossAppliedGold,
        lossSummary: buildLossSummary(outcomeKey, lossAppliedGold, triggeredDangers),
        dangerTriggered: triggeredDangers,
        escortContribution,
        crewContribution,
        resolutionScore: finalScore,
        baseEffectSummary: {
          routeEfficiencyPct,
          rewardBoostPct: rewardAdj.pct,
          lossMitigationPct: lossAdj.pct,
        },
      },
    },
  };
}

async function resolveDueOperations(client, organization) {
  const consortium = ensureConsortium(organization);
  const logisticsState = readConsortiumLogisticsState(consortium);
  const now = Date.now();
  const dueOperations = logisticsState.operations.filter((operation) => operation.state === "active" && operation.expectedOutcomeAt && operation.expectedOutcomeAt <= now);
  if (!dueOperations.length) return consortium;

  let treasury = normalizeTreasury(consortium.treasury);
  const baseEffects = await getOrganizationBaseEffectsForOrg(client, consortium);
  const resolutionLogs = [];

  logisticsState.operations = logisticsState.operations.map((operation) => {
    if (!(operation.state === "active" && operation.expectedOutcomeAt && operation.expectedOutcomeAt <= now)) {
      return operation;
    }

    const template = getConsortiumLogisticsTemplate(operation.templateKey);
    if (!template) {
      return {
        ...operation,
        state: "resolved",
        statusText: "Severe Failure resolved",
        updatedAt: now,
        outcome: {
          ...createBlankOutcome(),
          result: "severe_failure",
          resolvedAt: now,
          summary: "The route template vanished out from under this operation, which is not a sign of competent quartermastering.",
          treasuryDeltaGold: 0,
          lossAppliedGold: 0,
          resolutionScore: 0,
        },
      };
    }

    const settled = settleOperationOutcome(template, operation, treasury, baseEffects);
    treasury = settled.treasury;
    const resolvedOperation = {
      ...operation,
      ...settled.operationPatch,
    };
    resolutionLogs.push({
      operationInternalId: resolvedOperation.internalId,
      templateKey: resolvedOperation.templateKey,
      result: resolvedOperation.outcome.result,
      goldReturned: resolvedOperation.outcome.goldReturned,
      treasuryDeltaGold: resolvedOperation.outcome.treasuryDeltaGold,
      lossAppliedGold: resolvedOperation.outcome.lossAppliedGold,
      dangerTriggered: resolvedOperation.outcome.dangerTriggered,
      escortMode: resolvedOperation.escortContract.mode,
      escortCoverage: resolvedOperation.escortContract.coverageRating,
      guildOrganizationInternalId: resolvedOperation.escortContract.guildOrganizationInternalId ?? null,
      guildPublicId: resolvedOperation.escortContract.guildPublicId ?? null,
      guildName: resolvedOperation.escortContract.guildName ?? null,
      summary: resolvedOperation.outcome.summary,
      baseEffectSummary: resolvedOperation.outcome.baseEffectSummary ?? null,
    });
    return resolvedOperation;
  });

  const updated = await saveConsortiumLogisticsState(client, consortium, logisticsState, {
    treasury,
    statusText: resolutionLogs.length === 1 ? `Resolved ${resolutionLogs[0].templateKey}` : `Resolved ${resolutionLogs.length} logistics operations`,
  });

  for (const entry of resolutionLogs) {
    await insertOrganizationLog(client, updated.internalId, {
      actorInternalId: null,
      actorPublicId: null,
      actionType: "consortium_logistics_resolved",
      summary: entry,
    });

    if (entry.escortMode === "guild_contract" && entry.guildOrganizationInternalId) {
      const guild = await findOrganizationByInternalId(client, entry.guildOrganizationInternalId);
      if (guild && guild.type === "guild") {
        const rewardGold = Math.max(120, Math.round(120 + (asInt(entry.escortCoverage, 0) * 8) + Math.max(0, asInt(entry.treasuryDeltaGold, 0) * 0.05)));
        const reputationGain = Math.max(12, Math.round(12 + (asInt(entry.escortCoverage, 0) / 4) + (entry.result === "strong_success" ? 15 : entry.result === "success" ? 8 : 0)));
        const guildTreasury = normalizeTreasury(guild.treasury);
        guildTreasury.gold += rewardGold;
        const metadata = asRecord(guild.metadata);
        const assistance = asRecord(metadata.assistance);
        const history = Array.isArray(assistance.history) ? assistance.history : [];
        const nextAssistance = {
          ...assistance,
          reputation: asInt(assistance.reputation, 0) + reputationGain,
          completed: asInt(assistance.completed, 0) + 1,
          history: [{ consortiumPublicId: updated.publicId, operationInternalId: entry.operationInternalId, result: entry.result, reputationGain, rewardGold, completedAt: now }, ...history].slice(0, 40),
        };
        await updateOrganizationDetails(client, guild.internalId, {
          treasury: guildTreasury,
          metadata: { ...metadata, assistance: nextAssistance },
          statusText: `Assisted ${updated.name} logistics`,
        });
        await insertOrganizationLog(client, guild.internalId, {
          actorInternalId: null,
          actorPublicId: null,
          actionType: "guild_consortium_assistance_resolved",
          summary: { consortiumPublicId: updated.publicId, operationInternalId: entry.operationInternalId, result: entry.result, reputationGain, rewardGold, hazardReduction: asInt(entry.escortCoverage, 0) },
        });
      }
    }
  }

  return updated;
}

function enrichOperation(operation, workerPool) {
  const template = getConsortiumLogisticsTemplate(operation.templateKey);
  if (!template) return null;
  const assignedWorkers = operation.assignedWorkers.map((worker) => {
    const latest = workerPool.find((entry) => entry.userInternalId === worker.userInternalId);
    return latest
      ? { ...worker, displayName: latest.displayName, roleKey: latest.roleKey, workingStats: latest.workingStats, battleStats: latest.battleStats }
      : worker;
  });
  const escortContract = normalizeEscortContractForScoring({ ...operation, assignedWorkers });
  const preview = computeSuccessPreview(template, assignedWorkers, escortContract);
  return {
    ...operation,
    template,
    assignedWorkers,
    escortContract,
    preview,
    canLaunch: operation.state === "draft",
    canManageAssignments: operation.state === "draft" || operation.state === "active",
  };
}

export async function buildConsortiumLogisticsBoard(client, organization, viewerUserInternalId) {
  const consortium = ensureConsortium(organization);
  const member = ensureMember(consortium, viewerUserInternalId);
  const workerPool = await buildWorkerPool(client, consortium);
  const logisticsState = readConsortiumLogisticsState(consortium);
  const operations = logisticsState.operations
    .map((operation) => enrichOperation(operation, workerPool))
    .filter(Boolean);

  const baseEffects = await getOrganizationBaseEffectsForOrg(client, consortium);

  return {
    templates: listConsortiumLogisticsTemplates(),
    operations,
    workerPool,
    escortModes: listConsortiumEscortModes(),
    canManageOperations: getRolePermissions(consortium, member.roleKey).includes("manage_contracts"),
    summary: {
      draftCount: operations.filter((operation) => operation.state === "draft").length,
      activeCount: operations.filter((operation) => operation.state === "active").length,
      resolvedCount: operations.filter((operation) => operation.state === "resolved").length,
      escortLinkedCount: operations.filter((operation) => operation.escortContract.mode === "guild_contract").length,
    },
    baseMechanicalEffects: baseEffects,
    placeholderNotice: "Guild escort links already change route outcomes. Negotiation, pricing, and full contract workflow come in the next pass.",
  };
}

export async function getConsortiumLogisticsBoardForUser(user, organizationInternalId) {
  return withTransaction(async (client) => {
    let organization = ensureConsortium(await findOrganizationByInternalId(client, organizationInternalId));
    ensureMember(organization, user.internalId);
    organization = await resolveDueOperations(client, organization);
    return {
      logistics: await buildConsortiumLogisticsBoard(client, organization, user.internalId),
    };
  });
}

export async function createConsortiumLogisticsOperationForUser(user, organizationInternalId, payload) {
  return withTransaction(async (client) => {
    let organization = ensureConsortium(await findOrganizationByInternalId(client, organizationInternalId));
    organization = await resolveDueOperations(client, organization);
    const member = ensureMember(organization, user.internalId);
    ensurePermission(organization, member, "manage_contracts");

    const template = getConsortiumLogisticsTemplate(payload?.templateKey);
    if (!template) {
      throw new HttpError(400, "A valid logistics route template is required.", "CONSORTIUM_LOGISTICS_TEMPLATE_REQUIRED");
    }

    const logisticsState = readConsortiumLogisticsState(organization);
    const treasury = normalizeTreasury(organization.treasury);
    const baseEffects = await getOrganizationBaseEffectsForOrg(client, organization);
    const launchCost = applyLaunchCostReduction(template.upfrontCostGold, baseEffects);
    const mode = payload?.mode === "launch" ? "launch" : "draft";
    if (mode === "launch" && treasury.gold < launchCost.discountedCost) {
      throw new HttpError(400, "Consortium treasury cannot cover this route launch cost.", "CONSORTIUM_LOGISTICS_FUNDS_REQUIRED");
    }

    const now = Date.now();
    const operation = {
      internalId: `logop_${crypto.randomUUID()}`,
      templateKey: template.key,
      displayName: template.displayName,
      routeType: template.routeType,
      lane: template.lane,
      riskLevel: template.riskLevel,
      upfrontCostGold: launchCost.discountedCost,
      durationHours: template.durationHours,
      rewardRange: { ...template.rewardRange },
      dangerProfile: {
        summary: template.dangerProfile,
        tags: [...template.dangerTags],
      },
      state: mode === "launch" ? "active" : "draft",
      statusText: mode === "launch" ? "Operation launched" : "Draft assembled",
      createdAt: now,
      updatedAt: now,
      startedAt: mode === "launch" ? now : null,
      expectedOutcomeAt: mode === "launch" ? now + (template.durationHours * MS_HOUR) : null,
      assignedWorkers: [],
      escortContract: {
        mode: "none",
        status: "unassigned",
        guildOrganizationInternalId: null,
        guildPublicId: null,
        guildName: null,
        coverageRating: 0,
        notes: null,
        attachedAt: null,
      },
      outcome: createBlankOutcome(),
    };

    logisticsState.operations = [operation, ...logisticsState.operations].slice(0, 18);
    if (mode === "launch") {
      treasury.gold -= launchCost.discountedCost;
    }

    const updated = await saveConsortiumLogisticsState(client, organization, logisticsState, {
      treasury,
      statusText: mode === "launch" ? `Launching ${template.displayName}` : `Drafting ${template.displayName}`,
    });

    await insertOrganizationLog(client, organization.internalId, {
      actorInternalId: user.internalId,
      actorPublicId: user.publicId,
      actionType: "consortium_logistics_created",
      summary: {
        operationInternalId: operation.internalId,
        templateKey: template.key,
        mode,
        upfrontCostGold: launchCost.discountedCost,
        launchCostBaseGold: template.upfrontCostGold,
        launchCostDiscountGold: launchCost.discountGold,
        launchCostDiscountPct: launchCost.discountPct,
      },
    });

    return {
      logistics: await buildConsortiumLogisticsBoard(client, updated, user.internalId),
      operationId: operation.internalId,
    };
  });
}

export async function assignConsortiumLogisticsWorkerForUser(user, organizationInternalId, operationInternalId, payload) {
  return withTransaction(async (client) => {
    let organization = ensureConsortium(await findOrganizationByInternalId(client, organizationInternalId));
    organization = await resolveDueOperations(client, organization);
    const member = ensureMember(organization, user.internalId);
    ensurePermission(organization, member, "manage_contracts");

    const logisticsState = readConsortiumLogisticsState(organization);
    const operation = logisticsState.operations.find((entry) => entry.internalId === operationInternalId);
    if (!operation) {
      throw new HttpError(404, "Logistics operation unavailable.", "CONSORTIUM_LOGISTICS_OPERATION_NOT_FOUND");
    }
    ensureMutableOperation(operation);

    const targetPublicId = asInt(payload?.publicId);
    const action = payload?.action === "remove" ? "remove" : "assign";
    const targetMember = organization.members.find((entry) => entry.publicId === targetPublicId);
    if (!targetMember) {
      throw new HttpError(404, "Assigned worker must be a consortium employee.", "CONSORTIUM_LOGISTICS_WORKER_NOT_FOUND");
    }

    if (action === "remove") {
      operation.assignedWorkers = operation.assignedWorkers.filter((entry) => entry.userInternalId !== targetMember.userInternalId);
    } else {
      await createDefaultPlayerState(client, targetMember.userInternalId);
      const playerState = await findPlayerStateByUserInternalId(client, targetMember.userInternalId);
      const snapshot = {
        userInternalId: targetMember.userInternalId,
        publicId: targetMember.publicId,
        displayName: targetMember.displayName,
        roleKey: targetMember.roleKey,
        assignmentRole: typeof payload?.assignmentRole === "string" && payload.assignmentRole ? payload.assignmentRole : "operator",
        assignedAt: Date.now(),
        workingStats: asRecord(playerState?.workingStats),
        battleStats: asRecord(playerState?.battleStats),
      };
      operation.assignedWorkers = [
        ...operation.assignedWorkers.filter((entry) => entry.userInternalId !== targetMember.userInternalId),
        snapshot,
      ].slice(0, 6);
    }

    if (operation.escortContract?.mode === "internal_team") {
      operation.escortContract = {
        ...operation.escortContract,
        coverageRating: computeInternalEscortCoverage(operation.assignedWorkers),
        status: operation.assignedWorkers.length ? "internal_cover" : "understaffed_internal_cover",
      };
    }

    operation.updatedAt = Date.now();
    const updated = await saveConsortiumLogisticsState(client, organization, logisticsState);
    await insertOrganizationLog(client, organization.internalId, {
      actorInternalId: user.internalId,
      actorPublicId: user.publicId,
      actionType: action === "remove" ? "consortium_logistics_worker_removed" : "consortium_logistics_worker_assigned",
      summary: {
        operationInternalId,
        targetPublicId,
        assignmentRole: payload?.assignmentRole ?? null,
      },
    });

    return {
      logistics: await buildConsortiumLogisticsBoard(client, updated, user.internalId),
      operationId: operationInternalId,
    };
  });
}

export async function setConsortiumLogisticsEscortForUser(user, organizationInternalId, operationInternalId, payload) {
  return withTransaction(async (client) => {
    let organization = ensureConsortium(await findOrganizationByInternalId(client, organizationInternalId));
    organization = await resolveDueOperations(client, organization);
    const member = ensureMember(organization, user.internalId);
    ensurePermission(organization, member, "manage_contracts");

    const logisticsState = readConsortiumLogisticsState(organization);
    const operation = logisticsState.operations.find((entry) => entry.internalId === operationInternalId);
    if (!operation) {
      throw new HttpError(404, "Logistics operation unavailable.", "CONSORTIUM_LOGISTICS_OPERATION_NOT_FOUND");
    }
    ensureMutableOperation(operation);

    const mode = String(payload?.mode ?? "none");
    if (!listConsortiumEscortModes().some((entry) => entry.key === mode)) {
      throw new HttpError(400, "Valid escort mode is required.", "CONSORTIUM_LOGISTICS_ESCORT_MODE_REQUIRED");
    }

    if (mode === "none") {
      operation.escortContract = {
        mode: "none",
        status: "unassigned",
        guildOrganizationInternalId: null,
        guildPublicId: null,
        guildName: null,
        coverageRating: 0,
        notes: null,
        attachedAt: null,
      };
    } else if (mode === "internal_team") {
      operation.escortContract = {
        mode,
        status: operation.assignedWorkers.length ? "internal_cover" : "understaffed_internal_cover",
        guildOrganizationInternalId: null,
        guildPublicId: null,
        guildName: null,
        coverageRating: computeInternalEscortCoverage(operation.assignedWorkers),
        notes: "Escort coverage is currently being provided by assigned consortium staff.",
        attachedAt: Date.now(),
      };
    } else {
      const guildPublicId = asInt(payload?.guildPublicId);
      if (!guildPublicId) {
        throw new HttpError(400, "Guild public ID is required for contract escort scaffolding.", "CONSORTIUM_LOGISTICS_GUILD_REQUIRED");
      }
      const guild = await findOrganizationByPublicId(client, guildPublicId);
      if (!guild || guild.type !== "guild") {
        throw new HttpError(404, "Guild escort target unavailable.", "CONSORTIUM_LOGISTICS_GUILD_NOT_FOUND");
      }
      const guildMetadata = asRecord(guild.metadata);
      const guildState = asRecord(guildMetadata.guild);
      const passives = asRecord(guildState.passives);
      const readiness = Math.round((asInt(passives.reputation, 0) / 12) + (guild.members.length * 8));
      operation.escortContract = {
        mode,
        status: "contract_attached",
        guildOrganizationInternalId: guild.internalId,
        guildPublicId: guild.publicId,
        guildName: guild.name,
        coverageRating: clamp(readiness, 10, 100),
        notes: typeof payload?.notes === "string" && payload.notes.trim() ? payload.notes.trim().slice(0, 160) : `Escort contract linked to ${guild.name}.`,
        attachedAt: Date.now(),
      };
    }

    operation.updatedAt = Date.now();
    const updated = await saveConsortiumLogisticsState(client, organization, logisticsState);
    await insertOrganizationLog(client, organization.internalId, {
      actorInternalId: user.internalId,
      actorPublicId: user.publicId,
      actionType: "consortium_logistics_escort_set",
      summary: {
        operationInternalId,
        mode: operation.escortContract.mode,
        guildPublicId: operation.escortContract.guildPublicId,
        coverageRating: operation.escortContract.coverageRating,
      },
    });

    return {
      logistics: await buildConsortiumLogisticsBoard(client, updated, user.internalId),
      operationId: operationInternalId,
    };
  });
}
