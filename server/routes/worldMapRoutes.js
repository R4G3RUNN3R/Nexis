import { Router } from "express";
import { requireSession } from "../middleware/requireSession.js";
import { getWorldAtlas } from "../controllers/worldMapController.js";
const router = Router();
router.get("/world-map/atlas", requireSession, getWorldAtlas);
export default router;
