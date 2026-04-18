import { Router } from "express";
import { requireSession } from "../middleware/requireSession.js";
import {
  getConsortiumTemplatesController,
  getMyOrganizationController,
  postConsortiumApplicationReviewController,
  postConsortiumApplyController,
  postConsortiumClaimPointsController,
  postConsortiumMemberRemoveController,
  postConsortiumOutreachController,
  postConsortiumPositionController,
  postConsortiumRedeemController,
  postConsortiumTreasuryDepositController,
  postOrganizationController,
  postOrganizationMemberController,
} from "../controllers/organizationController.js";

const router = Router();
router.get("/organizations/mine", requireSession, getMyOrganizationController);
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
export default router;
