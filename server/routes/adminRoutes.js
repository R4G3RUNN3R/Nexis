import { Router } from "express";
import { requireSession } from "../middleware/requireSession.js";
import { requireStaffOrAdmin } from "../middleware/requireRole.js";
import { adminMutationRateLimit } from "../middleware/rateLimit.js";
import {
  getAdminAuditLogController,
  getAdminPlayerDetails,
  getAdminPlayerSearch,
  postAdminPlayerAction,
} from "../controllers/adminController.js";

const router = Router();

router.get("/admin/players", requireSession, requireStaffOrAdmin, getAdminPlayerSearch);
router.get("/admin/audit-logs", requireSession, requireStaffOrAdmin, getAdminAuditLogController);
router.get("/admin/players/:targetInternalId", requireSession, requireStaffOrAdmin, getAdminPlayerDetails);
router.post(
  "/admin/players/:targetInternalId/actions",
  requireSession,
  requireStaffOrAdmin,
  adminMutationRateLimit,
  postAdminPlayerAction,
);

export default router;
