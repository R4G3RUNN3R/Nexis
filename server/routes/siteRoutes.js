import { Router } from "express";
import { getSiteRankings } from "../controllers/siteController.js";

const router = Router();

router.get("/site/rankings", getSiteRankings);

export default router;
