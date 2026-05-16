import { Router } from "express";
import { requireSession } from "../middleware/requireSession.js";
import {
  getChronicleStatus,
  getLegacyAchievements,
  postChronicleChoice,
  postDonorTier,
  postLegacyPerkRank,
  postOpenMonthlyChronicle,
} from "../controllers/chronicleController.js";

const router = Router();

router.get("/legacy/chronicle", requireSession, getChronicleStatus);
router.post("/legacy/chronicle/open", requireSession, postOpenMonthlyChronicle);
router.post("/legacy/chronicle/choice", requireSession, postChronicleChoice);
router.post("/legacy/donor-tier", requireSession, postDonorTier);
router.get("/legacy/achievements", requireSession, getLegacyAchievements);
router.post("/legacy/perks/rank", requireSession, postLegacyPerkRank);

export default router;
