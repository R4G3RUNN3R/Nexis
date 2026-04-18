import { Router } from "express";
import { requireSession } from "../middleware/requireSession.js";
import { getAdminPlayerDetails, getAdminPlayerSearch, postAdminPlayerAction } from "../controllers/adminController.js";

const router = Router();

router.get("/admin/players", requireSession, getAdminPlayerSearch);
router.get("/admin/players/:targetInternalId", requireSession, getAdminPlayerDetails);
router.post("/admin/players/:targetInternalId/actions", requireSession, postAdminPlayerAction);

export default router;
