import { Router } from "express";
import { requireSession } from "../middleware/requireSession.js";
import { getArenaCombat, sparArenaOpponent } from "../controllers/arenaCombatController.js";

const router = Router();

router.get("/arena/combat", requireSession, getArenaCombat);
router.post("/arena/combat/spar/:opponentId", requireSession, sparArenaOpponent);

export default router;
