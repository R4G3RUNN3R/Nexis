import { Router } from "express";
import { requireSession } from "../middleware/requireSession.js";
import {
  craftRecipe,
  destroyItem,
  equipItem,
  equipLoadout,
  getCrafting,
  getItemInventory,
  getLoadouts,
  removeWornItem,
  repairEquipment,
  salvageItem,
  saveLoadout,
  sendItem,
  unequipItem,
  useItem,
  wearItem,
} from "../controllers/itemController.js";

const router = Router();

router.get("/items/inventory", requireSession, getItemInventory);
router.post("/items/equip", requireSession, equipItem);
router.post("/items/unequip", requireSession, unequipItem);
router.post("/items/wear", requireSession, wearItem);
router.post("/items/remove-worn", requireSession, removeWornItem);
router.post("/items/use", requireSession, useItem);
router.post("/items/send", requireSession, sendItem);
router.post("/items/destroy", requireSession, destroyItem);
router.get("/items/crafting", requireSession, getCrafting);
router.post("/items/crafting/:recipeId/craft", requireSession, craftRecipe);
router.post("/items/salvage", requireSession, salvageItem);
router.post("/items/repair", requireSession, repairEquipment);
router.get("/items/loadouts", requireSession, getLoadouts);
router.post("/items/loadouts/:slot/save", requireSession, saveLoadout);
router.post("/items/loadouts/:slot/equip", requireSession, equipLoadout);

export default router;
