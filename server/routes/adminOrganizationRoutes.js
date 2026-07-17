import { Router } from "express";
import { requireSession } from "../middleware/requireSession.js";
import { requireStaffOrAdmin } from "../middleware/requireRole.js";
import { adminMutationRateLimit } from "../middleware/rateLimit.js";
import {
  getAdminOrganizationBaseStateController,
  postAdminOrganizationBaseSweepController,
  postAdminOrganizationLeadershipController,
} from "../controllers/adminOrganizationController.js";

const router = Router();

router.post(
  "/admin/organizations/:organizationPublicId/leadership",
  requireSession,
  requireStaffOrAdmin,
  adminMutationRateLimit,
  postAdminOrganizationLeadershipController,
);
router.post(
  "/admin/organizations/base-safety/sweep",
  requireSession,
  requireStaffOrAdmin,
  adminMutationRateLimit,
  postAdminOrganizationBaseSweepController,
);
router.get(
  "/admin/organizations/:organizationPublicId/base-state",
  requireSession,
  requireStaffOrAdmin,
  getAdminOrganizationBaseStateController,
);

export default router;
