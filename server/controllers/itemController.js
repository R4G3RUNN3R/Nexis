import {
  destroyItemForUser,
  equipItemForUser,
  getItemInventoryForUser,
  removeWornItemForUser,
  sendItemForUser,
  unequipItemForUser,
  useItemForUser,
  wearItemForUser,
} from "../services/itemService.js";
import {
  craftRecipeForUser,
  equipLoadoutForUser,
  getCraftingForUser,
  getLoadoutsForUser,
  repairEquipmentForUser,
  salvageItemForUser,
  saveLoadoutForUser,
} from "../services/itemAdvancedService.js";

function sendJson(res, payload) {
  res.json({ ok: true, ...payload });
}

export async function getItemInventory(req, res, next) {
  try {
    sendJson(res, await getItemInventoryForUser(req.auth.user));
  } catch (error) {
    next(error);
  }
}

export async function equipItem(req, res, next) {
  try {
    sendJson(res, await equipItemForUser(req.auth.user, req.body?.itemId, req.body?.slot ?? null));
  } catch (error) {
    next(error);
  }
}

export async function unequipItem(req, res, next) {
  try {
    sendJson(res, await unequipItemForUser(req.auth.user, req.body?.slot));
  } catch (error) {
    next(error);
  }
}

export async function wearItem(req, res, next) {
  try {
    sendJson(res, await wearItemForUser(req.auth.user, req.body?.itemId, req.body?.slot ?? null));
  } catch (error) {
    next(error);
  }
}

export async function removeWornItem(req, res, next) {
  try {
    sendJson(res, await removeWornItemForUser(req.auth.user, req.body?.slot));
  } catch (error) {
    next(error);
  }
}

export async function sendItem(req, res, next) {
  try {
    sendJson(res, await sendItemForUser(req.auth.user, req.body?.itemId, req.body?.targetPublicId, req.body?.quantity ?? 1));
  } catch (error) {
    next(error);
  }
}

export async function destroyItem(req, res, next) {
  try {
    sendJson(res, await destroyItemForUser(req.auth.user, req.body?.itemId, req.body?.quantity ?? 1, req.body?.confirmation ?? false));
  } catch (error) {
    next(error);
  }
}

export async function useItem(req, res, next) {
  try {
    sendJson(res, await useItemForUser(req.auth.user, req.body?.itemId, req.body?.quantity ?? 1));
  } catch (error) {
    next(error);
  }
}

export async function getCrafting(req, res, next) {
  try {
    sendJson(res, await getCraftingForUser(req.auth.user));
  } catch (error) {
    next(error);
  }
}

export async function craftRecipe(req, res, next) {
  try {
    sendJson(res, await craftRecipeForUser(req.auth.user, req.params.recipeId));
  } catch (error) {
    next(error);
  }
}

export async function salvageItem(req, res, next) {
  try {
    sendJson(res, await salvageItemForUser(req.auth.user, req.body?.itemId, req.body?.quantity ?? 1));
  } catch (error) {
    next(error);
  }
}

export async function repairEquipment(req, res, next) {
  try {
    sendJson(res, await repairEquipmentForUser(req.auth.user, req.body?.slot));
  } catch (error) {
    next(error);
  }
}

export async function getLoadouts(req, res, next) {
  try {
    sendJson(res, await getLoadoutsForUser(req.auth.user));
  } catch (error) {
    next(error);
  }
}

export async function saveLoadout(req, res, next) {
  try {
    sendJson(res, await saveLoadoutForUser(req.auth.user, req.params.slot, req.body?.label ?? null));
  } catch (error) {
    next(error);
  }
}

export async function equipLoadout(req, res, next) {
  try {
    sendJson(res, await equipLoadoutForUser(req.auth.user, req.params.slot));
  } catch (error) {
    next(error);
  }
}
