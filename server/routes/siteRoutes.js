import { Router } from "express";
import { getSiteRankings, getSiteStaff } from "../controllers/siteController.js";

const router = Router();

router.get("/site/rankings", getSiteRankings);
router.get("/site/staff", getSiteStaff);

export default router;
