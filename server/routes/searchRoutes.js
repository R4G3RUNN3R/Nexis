import { Router } from "express";
import { requireSession } from "../middleware/requireSession.js";
import { getSearchResults } from "../controllers/searchController.js";
import { getAdvancedSearchAccessStatus, getAdvancedSearchResults } from "../controllers/advancedSearchController.js";

const router = Router();
router.get("/search/advanced/access", requireSession, getAdvancedSearchAccessStatus);
router.get("/search/advanced", requireSession, getAdvancedSearchResults);
router.get("/search", requireSession, getSearchResults);
export default router;
