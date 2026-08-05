import { Router } from "express";
import { requireSession } from "../middleware/requireSession.js";
import { getSearchResults } from "../controllers/searchController.js";

const router = Router();
router.get("/search", requireSession, getSearchResults);
export default router;
