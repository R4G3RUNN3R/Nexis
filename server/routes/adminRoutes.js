import { Router } from "express";
import { requireSession } from "../middleware/requireSession.js";
import { requireStaffOrAdmin } from "../middleware/requireRole.js";
import { adminMutationRateLimit } from "../middleware/rateLimit.js";
import {
  getAdminAuditLogController,
  getAdminPlayerDetails,
  getAdminPlayerSearch,
  postAdminPlayerAction,
  postAdminOneShotTokenGrant,
} from "../controllers/adminController.js";

const router = Router();

router.get("/admin/players", requireSession, requireStaffOrAdmin, getAdminPlayerSearch);
router.get("/admin/audit-logs", requireSession, requireStaffOrAdmin, getAdminAuditLogController);
// Admin hotfix: route param is the player's PUBLIC ID (e.g. "1000000" or
// "P1000000"), resolved server-side to the authoritative internal user via
// resolveAdminTargetUser() - never a client-submitted internal-shaped ID.
router.get("/admin/players/:targetPublicId", requireSession, requireStaffOrAdmin, getAdminPlayerDetails);
router.post(
  "/admin/players/:targetPublicId/actions",
  requireSession,
  requireStaffOrAdmin,
  adminMutationRateLimit,
  postAdminPlayerAction,
);
router.post(
  "/admin/players/:targetPublicId/one-shot-tokens",
  requireSession,
  requireStaffOrAdmin,
  adminMutationRateLimit,
  postAdminOneShotTokenGrant,
);

export default router;
