import { Router } from "express";
import { requireSession } from "../middleware/requireSession.js";
import { getCityPeople } from "../controllers/cityController.js";

const router = Router();

router.get("/cities/:cityId/people", requireSession, getCityPeople);

export default router;
