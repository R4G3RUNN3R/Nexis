import { Router } from "express";
import { requireSession } from "../middleware/requireSession.js";
import { getWorldProgression } from "../controllers/worldProgressionController.js";

const router = Router();

router.get("/world-progression", requireSession, getWorldProgression);

export default router;
