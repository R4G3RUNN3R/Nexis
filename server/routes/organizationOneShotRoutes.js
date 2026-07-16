import { Router } from "express";
import { requireSession } from "../middleware/requireSession.js";
import { getOrganizationOneShots, resolveOrganizationOneShot, signUpOrganizationOneShot } from "../controllers/organizationOneShotController.js";

const router = Router();

router.get("/organizations/:organizationId/one-shots", requireSession, getOrganizationOneShots);
router.post("/organizations/:organizationId/one-shots/:campaignId/signup", requireSession, signUpOrganizationOneShot);
router.post("/organizations/:organizationId/one-shots/:campaignId/resolve", requireSession, resolveOrganizationOneShot);

export default router;
