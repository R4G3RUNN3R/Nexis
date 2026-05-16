import { Router } from "express";
import { requireSession } from "../middleware/requireSession.js";
import {
  getCivicJobs,
  postCollectCivicBenefits,
  postJoinCivicTrack,
  postPromoteCivicTrack,
  postResignCivicTrack,
  postSpendCivicJobPoints,
} from "../controllers/civicJobsController.js";

const router = Router();

router.get("/civic-jobs", requireSession, getCivicJobs);
router.post("/civic-jobs/join", requireSession, postJoinCivicTrack);
router.post("/civic-jobs/collect", requireSession, postCollectCivicBenefits);
router.post("/civic-jobs/resign", requireSession, postResignCivicTrack);
router.post("/civic-jobs/promote", requireSession, postPromoteCivicTrack);
router.post("/civic-jobs/spend", requireSession, postSpendCivicJobPoints);

export default router;