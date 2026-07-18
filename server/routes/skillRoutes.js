import { Router } from "express";
import { requireSession } from "../middleware/requireSession.js";
import { requireAdministrator } from "../middleware/requireRole.js";
import { adminSetSkillMastery, adminUnlockAllSkills, completeSkillLearning, getSkills, learnSkill, slotSkill } from "../controllers/skillController.js";

const router = Router();

router.get("/skills", requireSession, getSkills);
router.post("/skills/learn", requireSession, learnSkill);
router.post("/skills/complete-learning", requireSession, completeSkillLearning);
router.post("/skills/slot", requireSession, slotSkill);
// adminSetSkillMasteryForUser/adminUnlockAllSkillsForUser already re-check
// admin (not just staff) themselves via skillService.js's isAdminUser();
// requireAdministrator here is a Ticket 5 defense-in-depth addition matching
// that same stricter bar, so a non-admin request never reaches the service.
router.post("/skills/admin/mastery", requireSession, requireAdministrator, adminSetSkillMastery);
router.post("/skills/admin/unlock-all", requireSession, requireAdministrator, adminUnlockAllSkills);

export default router;
