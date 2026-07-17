import { Router } from "express";
import { requireSession } from "../middleware/requireSession.js";
import { getCommandBriefController } from "../controllers/playerGuideController.js";

const router = Router();

router.get("/guide/command-brief", requireSession, getCommandBriefController);

export default router;
