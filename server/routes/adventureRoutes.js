import { Router } from "express";
import { requireSession } from "../middleware/requireSession.js";
import { getAdventureBoard, startAdventure } from "../controllers/adventureController.js";

const router = Router();

router.get("/adventures", requireSession, getAdventureBoard);
router.post("/adventures/:adventureId/start", requireSession, startAdventure);

export default router;
