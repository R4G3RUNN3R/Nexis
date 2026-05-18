import { Router } from "express";
import { requireSession } from "../middleware/requireSession.js";
import { challengeDuel, getDuels, respondToDuel } from "../controllers/duelController.js";

const router = Router();

router.get("/duels", requireSession, getDuels);
router.post("/duels/challenge", requireSession, challengeDuel);
router.post("/duels/:duelId/respond", requireSession, respondToDuel);

export default router;
