import { Router } from "express";
import { requireSession } from "../middleware/requireSession.js";
import {
  getTravelOptions,
  getTravelState,
  postCancelTravel,
  postStartTravel,
} from "../controllers/travelController.js";

const router = Router();

router.get("/travel", requireSession, getTravelState);
router.get("/travel/options", requireSession, getTravelOptions);
router.post("/travel/start", requireSession, postStartTravel);
router.post("/travel/cancel", requireSession, postCancelTravel);

export default router;
