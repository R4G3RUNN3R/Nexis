import { Router } from "express";
import { requireSession } from "../middleware/requireSession.js";
import { buyListing, cancelListing, createListing, getMarketplace } from "../controllers/marketplaceController.js";
const router = Router();
router.get("/marketplace", requireSession, getMarketplace);
router.post("/marketplace/listings", requireSession, createListing);
router.post("/marketplace/listings/:listingId/buy", requireSession, buyListing);
router.post("/marketplace/listings/:listingId/cancel", requireSession, cancelListing);
export default router;
