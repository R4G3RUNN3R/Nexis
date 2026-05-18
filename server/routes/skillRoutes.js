import { Router } from "express";
import { requireSession } from "../middleware/requireSession.js";
import { getSkills, slotSkill } from "../controllers/skillController.js";

const router = Router();

router.get("/skills", requireSession, getSkills);
router.post("/skills/slot", requireSession, slotSkill);

export default router;
