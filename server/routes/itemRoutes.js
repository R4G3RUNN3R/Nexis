import { Router } from "express";
import { requireSession } from "../middleware/requireSession.js";
import {
  craftRecipe,
  equipItem,
  equipLoadout,
  getCrafting,
  getItemInventory,
  getLoadouts,
  repairEquipment,
  salvageItem,
  saveLoadout,
  unequipItem,
  useItem,
} from "../controllers/itemController.js";

const router = Router();

router.get("/items/inventory", requireSession, getItemInventory);
router.post("/items/equip", requireSession, equipItem);
router.post("/items/unequip", requireSession, unequipItem);
router.post("/items/use", requireSession, useItem);
router.get("/items/crafting", requireSession, getCrafting);
router.post("/items/crafting/:recipeId/craft", requireSession, craftRecipe);
router.post("/items/salvage", requireSession, salvageItem);
router.post("/items/repair", requireSession, repairEquipment);
router.get("/items/loadouts", requireSession, getLoadouts);
router.post("/items/loadouts/:slot/save", requireSession, saveLoadout);
router.post("/items/loadouts/:slot/equip", requireSession, equipLoadout);

export default router;
