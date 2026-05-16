import {
  acquireOrganizationBaseForUser,
  getOrganizationBaseOwnershipForUser,
  sellbackOrganizationPlotForUser,
} from "../services/organizationBaseOwnershipService.js";
import {
  addOrganizationMemberForUser,
  assignGuildQuestMemberForUser,
  applyToConsortiumForUser,
  cancelGuildQuestForUser,
  assignConsortiumPositionForUser,
  claimDailyConsortiumPointsForUser,
  createOrganizationForUser,
  depositConsortiumTreasuryForUser,
  depositGuildArmoryForUser,
  getMyOrganization,
  getOrganizationByPublicIdForUser,
  initiateGuildQuestForUser,
  listConsortiumTypes,
  launchGuildDungeonForUser,
  planGuildQuestForUser,
  recruitGuildMemberForUser,
  redeemConsortiumRewardForUser,
  replanGuildQuestForUser,
  removeConsortiumMemberForUser,
  reviewConsortiumApplicationForUser,
  runConsortiumOutreachForUser,
  unlockGuildSkillForUser,
  updateGuildSettingsForUser,
  withdrawGuildArmoryForUser,
} from "../services/organizationService.js";
import {
  assignConsortiumLogisticsWorkerForUser,
  createConsortiumLogisticsOperationForUser,
  getConsortiumLogisticsBoardForUser,
  setConsortiumLogisticsEscortForUser,
} from "../services/consortiumLogisticsService.js";
import { buybackOrganizationBaseForUser, payOrganizationBaseUpkeepForUser } from "../services/organizationBaseSafetyService.js";
import { cancelOrganizationMainBuildForUser, startOrganizationMainBuildForUser } from "../services/organizationBaseConstructionService.js";
import { cancelOrganizationRoomBuildForUser, removeOrganizationBaseRoomForUser, startOrganizationRoomBuildForUser } from "../services/organizationBaseRoomService.js";
import { listOrganizationBaseAuctionsForUser, placeOrganizationBaseAuctionBidForUser } from "../services/organizationBaseAuctionService.js";

const wrap = (handler) => async (req, res, next) => {
  try { await handler(req, res); } catch (error) { next(error); }
};

export const getOrganizationByPublicIdController = wrap(async (req, res) => {
  const payload = await getOrganizationByPublicIdForUser(req.auth.user, req.query.type, req.params.publicId);
  if (req.query.type === "guild") {
    res.status(200).json({ organization: payload.organization ?? null });
    return;
  }

  res.status(200).json(payload);
});

export const getMyOrganizationController = wrap(async (req, res) => {
  const payload = await getMyOrganization(req.auth.user, req.query.type);
  if (req.query.type === "guild") {
    res.status(200).json({ organization: payload.organization ?? null });
    return;
  }

  res.status(200).json(payload);
});
export const postOrganizationController = wrap(async (req, res) => { res.status(201).json(await createOrganizationForUser(req.auth.user, req.body ?? {})); });
export const postConsortiumClaimPointsController = wrap(async (req, res) => { res.status(200).json(await claimDailyConsortiumPointsForUser(req.auth.user, req.params.organizationId)); });
export const postConsortiumRedeemController = wrap(async (req, res) => { res.status(200).json(await redeemConsortiumRewardForUser(req.auth.user, req.params.organizationId, req.body ?? {})); });
export const postOrganizationMemberController = wrap(async (req, res) => { res.status(200).json(await addOrganizationMemberForUser(req.auth.user, req.params.organizationId, req.body ?? {})); });
export const postConsortiumApplyController = wrap(async (req, res) => { res.status(200).json(await applyToConsortiumForUser(req.auth.user, req.params.organizationId, req.body ?? {})); });
export const postConsortiumApplicationReviewController = wrap(async (req, res) => { res.status(200).json(await reviewConsortiumApplicationForUser(req.auth.user, req.params.organizationId, req.body ?? {})); });
export const postConsortiumPositionController = wrap(async (req, res) => { res.status(200).json(await assignConsortiumPositionForUser(req.auth.user, req.params.organizationId, req.body ?? {})); });
export const postConsortiumMemberRemoveController = wrap(async (req, res) => { res.status(200).json(await removeConsortiumMemberForUser(req.auth.user, req.params.organizationId, req.body ?? {})); });
export const postConsortiumTreasuryDepositController = wrap(async (req, res) => { res.status(200).json(await depositConsortiumTreasuryForUser(req.auth.user, req.params.organizationId, req.body ?? {})); });
export const postConsortiumOutreachController = wrap(async (req, res) => { res.status(200).json(await runConsortiumOutreachForUser(req.auth.user, req.params.organizationId)); });
export const getConsortiumTemplatesController = wrap(async (_req, res) => { res.status(200).json({ consortiumTemplates: listConsortiumTypes() }); });
export const postGuildSettingsController = wrap(async (req, res) => { res.status(200).json(await updateGuildSettingsForUser(req.auth.user, req.params.organizationId, req.body ?? {})); });
export const postGuildRecruitController = wrap(async (req, res) => { res.status(200).json(await recruitGuildMemberForUser(req.auth.user, req.params.organizationId, req.body ?? {})); });
export const postGuildSkillUnlockController = wrap(async (req, res) => { res.status(200).json(await unlockGuildSkillForUser(req.auth.user, req.params.organizationId, req.body ?? {})); });
export const postGuildArmoryDepositController = wrap(async (req, res) => { res.status(200).json(await depositGuildArmoryForUser(req.auth.user, req.params.organizationId, req.body ?? {})); });
export const postGuildArmoryWithdrawController = wrap(async (req, res) => { res.status(200).json(await withdrawGuildArmoryForUser(req.auth.user, req.params.organizationId, req.body ?? {})); });
export const postGuildDungeonLaunchController = wrap(async (req, res) => { res.status(200).json(await launchGuildDungeonForUser(req.auth.user, req.params.organizationId, req.body ?? {})); });
export const postGuildQuestPlanController = wrap(async (req, res) => { res.status(200).json(await planGuildQuestForUser(req.auth.user, req.params.organizationId, req.body ?? {})); });
export const postGuildQuestAssignController = wrap(async (req, res) => { res.status(200).json(await assignGuildQuestMemberForUser(req.auth.user, req.params.organizationId, req.body ?? {})); });
export const postGuildQuestCancelController = wrap(async (req, res) => { res.status(200).json(await cancelGuildQuestForUser(req.auth.user, req.params.organizationId)); });
export const postGuildQuestInitiateController = wrap(async (req, res) => { res.status(200).json(await initiateGuildQuestForUser(req.auth.user, req.params.organizationId)); });
export const postGuildQuestReplanController = wrap(async (req, res) => { res.status(200).json(await replanGuildQuestForUser(req.auth.user, req.params.organizationId)); });
export const getConsortiumLogisticsController = wrap(async (req, res) => { res.status(200).json(await getConsortiumLogisticsBoardForUser(req.auth.user, req.params.organizationId)); });
export const postConsortiumLogisticsCreateController = wrap(async (req, res) => { res.status(201).json(await createConsortiumLogisticsOperationForUser(req.auth.user, req.params.organizationId, req.body ?? {})); });
export const postConsortiumLogisticsAssignController = wrap(async (req, res) => { res.status(200).json(await assignConsortiumLogisticsWorkerForUser(req.auth.user, req.params.organizationId, req.params.operationId, req.body ?? {})); });
export const postConsortiumLogisticsEscortController = wrap(async (req, res) => { res.status(200).json(await setConsortiumLogisticsEscortForUser(req.auth.user, req.params.organizationId, req.params.operationId, req.body ?? {})); });
export const getOrganizationBaseController = wrap(async (req, res) => { res.status(200).json(await getOrganizationBaseOwnershipForUser(req.auth.user, req.params.organizationId)); });
export const postOrganizationBaseAcquireController = wrap(async (req, res) => { res.status(200).json(await acquireOrganizationBaseForUser(req.auth.user, req.params.organizationId, req.body ?? {})); });

export const postOrganizationBasePayController = wrap(async (req, res) => { res.status(200).json(await payOrganizationBaseUpkeepForUser(req.auth.user, req.params.organizationId, req.body ?? {})); });

export const postOrganizationBaseBuybackController = wrap(async (req, res) => { res.status(200).json(await buybackOrganizationBaseForUser(req.auth.user, req.params.organizationId)); });

export const postOrganizationBaseSellbackController = wrap(async (req, res) => { res.status(200).json(await sellbackOrganizationPlotForUser(req.auth.user, req.params.organizationId)); });

export const postOrganizationMainBuildStartController = wrap(async (req, res) => { res.status(200).json(await startOrganizationMainBuildForUser(req.auth.user, req.params.organizationId, req.body ?? {})); });

export const postOrganizationMainBuildCancelController = wrap(async (req, res) => { res.status(200).json(await cancelOrganizationMainBuildForUser(req.auth.user, req.params.organizationId, req.body ?? {})); });

export const postOrganizationRoomBuildStartController = wrap(async (req, res) => { res.status(200).json(await startOrganizationRoomBuildForUser(req.auth.user, req.params.organizationId, req.body ?? {})); });

export const postOrganizationRoomBuildCancelController = wrap(async (req, res) => { res.status(200).json(await cancelOrganizationRoomBuildForUser(req.auth.user, req.params.organizationId, req.body ?? {})); });

export const postOrganizationRoomRemoveController = wrap(async (req, res) => { res.status(200).json(await removeOrganizationBaseRoomForUser(req.auth.user, req.params.organizationId, req.body ?? {})); });

export const getOrganizationBaseAuctionsController = wrap(async (req, res) => {
  res.status(200).json(await listOrganizationBaseAuctionsForUser(req.auth.user, { organizationType: req.query.type ?? null }));
});

export const postOrganizationBaseAuctionBidController = wrap(async (req, res) => {
  res.status(200).json(await placeOrganizationBaseAuctionBidForUser(req.auth.user, req.params.organizationId, req.params.auctionId, req.body ?? {}));
});
