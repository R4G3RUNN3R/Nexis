import { Router } from "express";
import { requireSession } from "../middleware/requireSession.js";
import {
  getConsortiumLogisticsController,
  getConsortiumTemplatesController,
  getMyOrganizationController,
  getOrganizationBaseAuctionsController,
  getOrganizationBaseController,
  getOrganizationByPublicIdController,
  postGuildArmoryDepositController,
  postGuildArmoryWithdrawController,
  postGuildDungeonLaunchController,
  postGuildQuestAssignController,
  postGuildQuestCancelController,
  postGuildQuestInitiateController,
  postGuildQuestPlanController,
  postGuildQuestReplanController,
  postGuildRecruitController,
  postGuildSettingsController,
  postGuildSkillUnlockController,
  postConsortiumApplicationReviewController,
  postConsortiumApplyController,
  postConsortiumClaimPointsController,
  postConsortiumLogisticsAssignController,
  postConsortiumLogisticsCreateController,
  postConsortiumLogisticsEscortController,
  postConsortiumMemberRemoveController,
  postConsortiumOutreachController,
  postConsortiumPositionController,
  postConsortiumRedeemController,
  postConsortiumTreasuryDepositController,
  postOrganizationBaseAcquireController,
  postOrganizationBaseAuctionBidController,
  postOrganizationBaseBuybackController,
  postOrganizationBasePayController,
  postOrganizationBaseSellbackController,
  postOrganizationController,
  postOrganizationMainBuildCancelController,
  postOrganizationMainBuildStartController,
  postOrganizationRoomBuildCancelController,
  postOrganizationRoomBuildStartController,
  postOrganizationRoomRemoveController,
  postOrganizationMemberController,
} from "../controllers/organizationController.js";

const router = Router();
router.get("/organizations/mine", requireSession, getMyOrganizationController);
router.get("/organizations/public/:publicId", requireSession, getOrganizationByPublicIdController);
router.get("/organizations/consortium-templates", requireSession, getConsortiumTemplatesController);
router.post("/organizations", requireSession, postOrganizationController);
router.post("/organizations/:organizationId/members", requireSession, postOrganizationMemberController);
router.post("/organizations/:organizationId/consortiums/apply", requireSession, postConsortiumApplyController);
router.post("/organizations/:organizationId/consortiums/applications/review", requireSession, postConsortiumApplicationReviewController);
router.post("/organizations/:organizationId/consortiums/positions", requireSession, postConsortiumPositionController);
router.post("/organizations/:organizationId/consortiums/members/remove", requireSession, postConsortiumMemberRemoveController);
router.post("/organizations/:organizationId/consortiums/treasury/deposit", requireSession, postConsortiumTreasuryDepositController);
router.post("/organizations/:organizationId/consortiums/outreach", requireSession, postConsortiumOutreachController);
router.post("/organizations/:organizationId/consortiums/claim-points", requireSession, postConsortiumClaimPointsController);
router.post("/organizations/:organizationId/consortiums/redeem", requireSession, postConsortiumRedeemController);
router.get("/organizations/:organizationId/consortiums/logistics", requireSession, getConsortiumLogisticsController);
router.post("/organizations/:organizationId/consortiums/logistics", requireSession, postConsortiumLogisticsCreateController);
router.post("/organizations/:organizationId/consortiums/logistics/:operationId/workers", requireSession, postConsortiumLogisticsAssignController);
router.post("/organizations/:organizationId/consortiums/logistics/:operationId/escort", requireSession, postConsortiumLogisticsEscortController);
router.post("/organizations/:organizationId/guilds/settings", requireSession, postGuildSettingsController);
router.post("/organizations/:organizationId/guilds/members", requireSession, postGuildRecruitController);
router.post("/organizations/:organizationId/guilds/skills/unlock", requireSession, postGuildSkillUnlockController);
router.post("/organizations/:organizationId/guilds/armory/deposit", requireSession, postGuildArmoryDepositController);
router.post("/organizations/:organizationId/guilds/armory/withdraw", requireSession, postGuildArmoryWithdrawController);
router.post("/organizations/:organizationId/guilds/adventures/launch", requireSession, postGuildDungeonLaunchController);
router.post("/organizations/:organizationId/guilds/quests/plan", requireSession, postGuildQuestPlanController);
router.post("/organizations/:organizationId/guilds/quests/assign", requireSession, postGuildQuestAssignController);
router.post("/organizations/:organizationId/guilds/quests/cancel", requireSession, postGuildQuestCancelController);
router.post("/organizations/:organizationId/guilds/quests/initiate", requireSession, postGuildQuestInitiateController);
router.post("/organizations/:organizationId/guilds/quests/replan", requireSession, postGuildQuestReplanController);
router.get("/organizations/base/auctions", requireSession, getOrganizationBaseAuctionsController);
router.get("/organizations/:organizationId/base", requireSession, getOrganizationBaseController);
router.post("/organizations/:organizationId/base/acquire", requireSession, postOrganizationBaseAcquireController);
router.post("/organizations/:organizationId/base/pay", requireSession, postOrganizationBasePayController);
router.post("/organizations/:organizationId/base/buyback", requireSession, postOrganizationBaseBuybackController);
router.post("/organizations/:organizationId/base/sellback", requireSession, postOrganizationBaseSellbackController);
router.post("/organizations/:organizationId/base/construction/start", requireSession, postOrganizationMainBuildStartController);
router.post("/organizations/:organizationId/base/construction/cancel", requireSession, postOrganizationMainBuildCancelController);
router.post("/organizations/:organizationId/base/rooms/start", requireSession, postOrganizationRoomBuildStartController);
router.post("/organizations/:organizationId/base/rooms/cancel", requireSession, postOrganizationRoomBuildCancelController);
router.post("/organizations/:organizationId/base/rooms/remove", requireSession, postOrganizationRoomRemoveController);
router.post("/organizations/:organizationId/base/auctions/:auctionId/bid", requireSession, postOrganizationBaseAuctionBidController);

export default router;
