import { Router } from "express";
import { requireSession } from "../middleware/requireSession.js";
import { getCityBoard } from "../controllers/cityBoardController.js";
const router = Router();
router.get("/city-board", requireSession, getCityBoard);
router.get("/city-board/:cityId", requireSession, getCityBoard);
export default router;
