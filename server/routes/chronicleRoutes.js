import { Router } from "express";
import { requireSession } from "../middleware/requireSession.js";
import {
  getChronicleStatus,
  postChronicleChoice,
  postDonorTier,
  postOpenMonthlyChronicle,
} from "../controllers/chronicleController.js";

const router = Router();

router.get("/legacy/chronicle", requireSession, getChronicleStatus);
router.post("/legacy/chronicle/open", requireSession, postOpenMonthlyChronicle);
router.post("/legacy/chronicle/choice", requireSession, postChronicleChoice);
router.post("/legacy/donor-tier", requireSession, postDonorTier);

export default router;
