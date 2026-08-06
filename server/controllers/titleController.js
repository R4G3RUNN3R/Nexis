import { equipTitleForUser, getTitlesForUser, unequipTitleForUser } from "../services/titleService.js";

export async function getOwnTitles(req, res, next) {
  try {
    const result = await getTitlesForUser(req.auth?.user ?? null);
    res.status(200).json(result);
  } catch (error) {
    next(error);
  }
}

export async function postEquipTitle(req, res, next) {
  try {
    const result = await equipTitleForUser(req.auth?.user ?? null, req.body?.titleId ?? null);
    res.status(200).json(result);
  } catch (error) {
    next(error);
  }
}

export async function postUnequipTitle(req, res, next) {
  try {
    const result = await unequipTitleForUser(req.auth?.user ?? null);
    res.status(200).json(result);
  } catch (error) {
    next(error);
  }
}
