import { Router } from "express";
import { requireSession } from "../middleware/requireSession.js";
import { getExcursionBoard, startExcursion } from "../controllers/excursionController.js";

const router = Router();

router.get("/excursions", requireSession, getExcursionBoard);
router.post("/excursions/:locationId/start", requireSession, startExcursion);

export default router;
