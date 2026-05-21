import { Router } from "express";
import { requireSession } from "../middleware/requireSession.js";
import { acknowledgeProgressionEvent, getPlayerRecords } from "../controllers/playerRecordsController.js";

const router = Router();
router.get("/records", requireSession, getPlayerRecords);
router.post("/progression-events/:eventId/ack", requireSession, acknowledgeProgressionEvent);
router.post("/progression-events/ack", requireSession, acknowledgeProgressionEvent);
export default router;
