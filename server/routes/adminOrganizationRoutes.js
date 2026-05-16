import { Router } from "express";
import { requireSession } from "../middleware/requireSession.js";
import {
  getAdminOrganizationBaseStateController,
  postAdminOrganizationBaseSweepController,
  postAdminOrganizationLeadershipController,
} from "../controllers/adminOrganizationController.js";

const router = Router();

router.post(
  "/admin/organizations/:organizationPublicId/leadership",
  requireSession,
  postAdminOrganizationLeadershipController,
);
router.post(
  "/admin/organizations/base-safety/sweep",
  requireSession,
  postAdminOrganizationBaseSweepController,
);
router.get(
  "/admin/organizations/:organizationPublicId/base-state",
  requireSession,
  getAdminOrganizationBaseStateController,
);

export default router;
