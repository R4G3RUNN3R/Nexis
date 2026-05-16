import { updateOrganizationDetails } from "./organizationRepository.js";

const asRecord = (value) => (value && typeof value === "object" && !Array.isArray(value) ? value : {});
const asInt = (value, fallback = 0) => (Number.isFinite(Number(value)) ? Math.max(0, Math.floor(Number(value))) : fallback);

function normalizeWorker(worker) {
  const entry = asRecord(worker);
  return {
    userInternalId: typeof entry.userInternalId === "string" ? entry.userInternalId : "",
    publicId: asInt(entry.publicId),
    displayName: typeof entry.displayName === "string" ? entry.displayName : "Unknown employee",
    roleKey: typeof entry.roleKey === "string" ? entry.roleKey : "employee",
    assignmentRole: typeof entry.assignmentRole === "string" ? entry.assignmentRole : "operator",
    assignedAt: typeof entry.assignedAt === "number" ? entry.assignedAt : Date.now(),
    workingStats: asRecord(entry.workingStats),
    battleStats: asRecord(entry.battleStats),
  };
}

function normalizeEscortContract(contract) {
  const entry = asRecord(contract);
  const mode = typeof entry.mode === "string" ? entry.mode : "none";
  return {
    mode,
    status: typeof entry.status === "string" ? entry.status : mode === "guild_contract" ? "placeholder_attached" : "unassigned",
    guildOrganizationInternalId: typeof entry.guildOrganizationInternalId === "string" ? entry.guildOrganizationInternalId : null,
    guildPublicId: asInt(entry.guildPublicId, 0) || null,
    guildName: typeof entry.guildName === "string" ? entry.guildName : null,
    coverageRating: Number.isFinite(Number(entry.coverageRating)) ? Math.max(0, Math.round(Number(entry.coverageRating))) : 0,
    notes: typeof entry.notes === "string" ? entry.notes : null,
    attachedAt: typeof entry.attachedAt === "number" ? entry.attachedAt : null,
  };
}

function normalizeOutcome(outcome) {
  const entry = asRecord(outcome);
  return {
    result: typeof entry.result === "string" ? entry.result : null,
    resolvedAt: typeof entry.resolvedAt === "number" ? entry.resolvedAt : null,
    summary: typeof entry.summary === "string" ? entry.summary : null,
    goldReturned: Number.isFinite(Number(entry.goldReturned)) ? Math.floor(Number(entry.goldReturned)) : null,
    treasuryDeltaGold: Number.isFinite(Number(entry.treasuryDeltaGold)) ? Math.floor(Number(entry.treasuryDeltaGold)) : null,
    lossAppliedGold: Number.isFinite(Number(entry.lossAppliedGold)) ? Math.floor(Number(entry.lossAppliedGold)) : 0,
    lossSummary: typeof entry.lossSummary === "string" ? entry.lossSummary : null,
    dangerTriggered: Array.isArray(entry.dangerTriggered) ? entry.dangerTriggered.map((value) => String(value)) : [],
    escortContribution: typeof entry.escortContribution === "string" ? entry.escortContribution : null,
    crewContribution: typeof entry.crewContribution === "string" ? entry.crewContribution : null,
    resolutionScore: Number.isFinite(Number(entry.resolutionScore)) ? Math.floor(Number(entry.resolutionScore)) : null,
  };
}

function normalizeOperation(operation) {
  const entry = asRecord(operation);
  return {
    internalId: typeof entry.internalId === "string" ? entry.internalId : "",
    templateKey: typeof entry.templateKey === "string" ? entry.templateKey : "",
    displayName: typeof entry.displayName === "string" ? entry.displayName : "Logistics Operation",
    routeType: typeof entry.routeType === "string" ? entry.routeType : "caravan",
    lane: typeof entry.lane === "string" ? entry.lane : "local",
    riskLevel: typeof entry.riskLevel === "string" ? entry.riskLevel : "low",
    upfrontCostGold: asInt(entry.upfrontCostGold),
    durationHours: asInt(entry.durationHours),
    rewardRange: {
      minGold: asInt(asRecord(entry.rewardRange).minGold),
      maxGold: asInt(asRecord(entry.rewardRange).maxGold),
    },
    dangerProfile: {
      summary: typeof asRecord(entry.dangerProfile).summary === "string" ? asRecord(entry.dangerProfile).summary : null,
      tags: Array.isArray(asRecord(entry.dangerProfile).tags) ? asRecord(entry.dangerProfile).tags.map((value) => String(value)) : [],
    },
    state: typeof entry.state === "string" ? entry.state : "draft",
    statusText: typeof entry.statusText === "string" ? entry.statusText : "Draft assembled",
    createdAt: typeof entry.createdAt === "number" ? entry.createdAt : Date.now(),
    updatedAt: typeof entry.updatedAt === "number" ? entry.updatedAt : Date.now(),
    startedAt: typeof entry.startedAt === "number" ? entry.startedAt : null,
    expectedOutcomeAt: typeof entry.expectedOutcomeAt === "number" ? entry.expectedOutcomeAt : null,
    assignedWorkers: Array.isArray(entry.assignedWorkers) ? entry.assignedWorkers.map(normalizeWorker).filter((worker) => worker.userInternalId) : [],
    escortContract: normalizeEscortContract(entry.escortContract),
    outcome: normalizeOutcome(entry.outcome),
  };
}

export function readConsortiumLogisticsState(organization) {
  const metadata = asRecord(organization?.metadata);
  const logistics = asRecord(metadata.logistics);
  return {
    version: asInt(logistics.version, 1),
    operations: Array.isArray(logistics.operations) ? logistics.operations.map(normalizeOperation).filter((operation) => operation.internalId) : [],
  };
}

export async function saveConsortiumLogisticsState(client, organization, logisticsState, patch = {}) {
  const metadata = asRecord(organization?.metadata);
  return updateOrganizationDetails(client, organization.internalId, {
    ...patch,
    metadata: {
      ...metadata,
      logistics: {
        version: asInt(logisticsState?.version, 1),
        operations: Array.isArray(logisticsState?.operations) ? logisticsState.operations.map(normalizeOperation) : [],
      },
    },
  });
}
