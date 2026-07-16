import { Router } from "express";
import { requireSession } from "../middleware/requireSession.js";
import { chooseOneShotOption, getOneShotHub, startOneShot } from "../controllers/nexisOneShotController.js";

const router = Router();

router.get("/one-shots", requireSession, getOneShotHub);
router.post("/one-shots/start", requireSession, startOneShot);
router.post("/one-shots/:sessionId/choose", requireSession, chooseOneShotOption);

export default router;
