import { Router } from "express";
import { requireSession } from "../middleware/requireSession.js";
import { putRuntimeState } from "../controllers/stateController.js";
import { stateSyncRateLimit } from "../middleware/rateLimit.js";

const router = Router();

router.put("/state", requireSession, stateSyncRateLimit, putRuntimeState);

export default router;
