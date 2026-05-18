import { Router } from "express";
import { requireSession } from "../middleware/requireSession.js";
import {
  acceptCityContract,
  buyBlackMarketItem,
  buyCityMarketItem,
  claimCityContract,
  completeCityAcademy,
  completeCityContract,
  getBlackMarket,
  getCityAcademy,
  getCityContracts,
  getCityMarket,
  getCityPeople,
  getCitySpecials,
  refreshCityContract,
  sellBlackMarketItem,
  sellCityMarketItem,
  startCityAcademy,
  useCitySpecial,
} from "../controllers/cityController.js";

const router = Router();

router.get("/cities/:cityId/people", requireSession, getCityPeople);
router.get("/cities/:cityId/market", requireSession, getCityMarket);
router.post("/cities/:cityId/market/:itemId/buy", requireSession, buyCityMarketItem);
router.post("/cities/:cityId/market/:itemId/sell", requireSession, sellCityMarketItem);
router.get("/cities/:cityId/specials", requireSession, getCitySpecials);
router.post("/cities/specials/:specialId/use", requireSession, useCitySpecial);
router.get("/cities/:cityId/black-market", requireSession, getBlackMarket);
router.post("/cities/:cityId/black-market/:itemId/buy", requireSession, buyBlackMarketItem);
router.post("/cities/:cityId/black-market/:itemId/sell", requireSession, sellBlackMarketItem);
router.get("/cities/:cityId/contracts", requireSession, getCityContracts);
router.post("/cities/contracts/:contractId/accept", requireSession, acceptCityContract);
router.post("/cities/contracts/:contractId/complete", requireSession, completeCityContract);
router.post("/cities/contracts/:contractId/claim", requireSession, claimCityContract);
router.post("/cities/contracts/:contractId/refresh", requireSession, refreshCityContract);
router.get("/cities/:cityId/academy", requireSession, getCityAcademy);
router.post("/cities/academies/:academyId/start", requireSession, startCityAcademy);
router.post("/cities/academies/:academyId/complete", requireSession, completeCityAcademy);

export default router;
