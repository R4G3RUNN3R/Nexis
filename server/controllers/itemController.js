import {
  equipItemForUser,
  getItemInventoryForUser,
  unequipItemForUser,
  useItemForUser,
} from "../services/itemService.js";

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

export async function useItem(req, res, next) {
  try {
    sendJson(res, await useItemForUser(req.auth.user, req.body?.itemId, req.body?.quantity ?? 1));
  } catch (error) {
    next(error);
  }
}
