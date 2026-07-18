import { Router } from "express";
import { requireSession } from "../middleware/requireSession.js";
import { requireStaffOrAdmin } from "../middleware/requireRole.js";
import { adminCompleteEducation, cancelEducation, completeEducation, getEducation, startEducation } from "../controllers/educationController.js";

const router = Router();
router.get("/education", requireSession, getEducation);
router.post("/education/:courseId/start", requireSession, startEducation);
router.post("/education/complete", requireSession, completeEducation);
router.post("/education/cancel", requireSession, cancelEducation);
// adminCompleteEducationForUser already re-checks staff-or-admin itself
// (educationService.js's isAdmin()); this route-level gate is a Ticket 5
// defense-in-depth addition so a non-privileged request is rejected before
// it reaches the service at all, matching the pattern in adminRoutes.js.
router.post("/education/admin/complete", requireSession, requireStaffOrAdmin, adminCompleteEducation);
export default router;
