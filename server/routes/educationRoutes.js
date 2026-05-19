import { Router } from "express";
import { requireSession } from "../middleware/requireSession.js";
import { adminCompleteEducation, cancelEducation, completeEducation, getEducation, startEducation } from "../controllers/educationController.js";

const router = Router();
router.get("/education", requireSession, getEducation);
router.post("/education/:courseId/start", requireSession, startEducation);
router.post("/education/complete", requireSession, completeEducation);
router.post("/education/cancel", requireSession, cancelEducation);
router.post("/education/admin/complete", requireSession, adminCompleteEducation);
export default router;
