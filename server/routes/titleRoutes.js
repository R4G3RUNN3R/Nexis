import { Router } from "express";
import { getOwnTitles, postEquipTitle, postUnequipTitle } from "../controllers/titleController.js";
import { requireSession } from "../middleware/requireSession.js";

const router = Router();

router.get("/me/titles", requireSession, getOwnTitles);
router.post("/me/titles/equip", requireSession, postEquipTitle);
router.post("/me/titles/unequip", requireSession, postUnequipTitle);

export default router;
