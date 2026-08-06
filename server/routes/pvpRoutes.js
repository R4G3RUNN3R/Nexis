import { Router } from "express";
import { requireSession } from "../middleware/requireSession.js";
import { cancelBountyWrit, getPvpHub, issueBountyWrit, updatePvpSafety } from "../controllers/pvpController.js";

const router = Router();

router.get("/pvp", requireSession, getPvpHub);
router.post("/pvp/safety", requireSession, updatePvpSafety);
router.post("/pvp/bounties", requireSession, issueBountyWrit);
router.post("/pvp/bounties/cancel", requireSession, cancelBountyWrit);

export default router;
