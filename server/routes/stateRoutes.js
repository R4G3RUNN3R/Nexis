import { Router } from "express";
import { requireSession } from "../middleware/requireSession.js";
import { putRuntimeState } from "../controllers/stateController.js";

const router = Router();

router.put("/state", requireSession, putRuntimeState);

export default router;
