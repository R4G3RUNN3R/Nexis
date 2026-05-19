import { Router } from "express";
import { requireSession } from "../middleware/requireSession.js";
import { adminSetSkillMastery, completeSkillLearning, getSkills, learnSkill, slotSkill } from "../controllers/skillController.js";

const router = Router();

router.get("/skills", requireSession, getSkills);
router.post("/skills/learn", requireSession, learnSkill);
router.post("/skills/complete-learning", requireSession, completeSkillLearning);
router.post("/skills/slot", requireSession, slotSkill);
router.post("/skills/admin/mastery", requireSession, adminSetSkillMastery);

export default router;
