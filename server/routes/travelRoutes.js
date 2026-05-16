import { Router } from "express";
import { requireSession } from "../middleware/requireSession.js";
import { getTravelState, postCancelTravel, postStartTravel } from "../controllers/travelController.js";

const router = Router();

router.get("/travel", requireSession, getTravelState);
router.post("/travel/start", requireSession, postStartTravel);
router.post("/travel/cancel", requireSession, postCancelTravel);

export default router;
