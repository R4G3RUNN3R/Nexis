import { Router } from "express";
import { requireSession } from "../middleware/requireSession.js";
import { equipItem, getItemInventory, unequipItem, useItem } from "../controllers/itemController.js";

const router = Router();

router.get("/items/inventory", requireSession, getItemInventory);
router.post("/items/equip", requireSession, equipItem);
router.post("/items/unequip", requireSession, unequipItem);
router.post("/items/use", requireSession, useItem);

export default router;
