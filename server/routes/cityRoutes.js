import { Router } from "express";
import { requireSession } from "../middleware/requireSession.js";
import {
  acceptCityContract,
  claimCityContract,
  completeCityAcademy,
  completeCityContract,
  getCityAcademy,
  getCityContracts,
  getCityPeople,
  refreshCityContract,
  startCityAcademy,
} from "../controllers/cityController.js";

const router = Router();

router.get("/cities/:cityId/people", requireSession, getCityPeople);
router.get("/cities/:cityId/contracts", requireSession, getCityContracts);
router.post("/cities/contracts/:contractId/accept", requireSession, acceptCityContract);
router.post("/cities/contracts/:contractId/complete", requireSession, completeCityContract);
router.post("/cities/contracts/:contractId/claim", requireSession, claimCityContract);
router.post("/cities/contracts/:contractId/refresh", requireSession, refreshCityContract);
router.get("/cities/:cityId/academy", requireSession, getCityAcademy);
router.post("/cities/academies/:academyId/start", requireSession, startCityAcademy);
router.post("/cities/academies/:academyId/complete", requireSession, completeCityAcademy);

export default router;
