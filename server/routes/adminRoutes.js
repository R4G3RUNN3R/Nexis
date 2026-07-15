import { Router } from "express";
import { requireSession } from "../middleware/requireSession.js";
import {
  getAdminAuditLogController,
  getAdminPlayerDetails,
  getAdminPlayerSearch,
  postAdminPlayerAction,
} from "../controllers/adminController.js";

const router = Router();

router.get("/admin/players", requireSession, getAdminPlayerSearch);
router.get("/admin/audit-logs", requireSession, getAdminAuditLogController);
router.get("/admin/players/:targetInternalId", requireSession, getAdminPlayerDetails);
router.post("/admin/players/:targetInternalId/actions", requireSession, postAdminPlayerAction);

export default router;
