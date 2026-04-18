import { getAdminPlayer, performAdminAction, searchAdminPlayers } from "../services/adminService.js";

export async function getAdminPlayerSearch(req, res, next) {
  try {
    const results = await searchAdminPlayers(req.auth.user, req.query.q ?? "");
    res.status(200).json({ results });
  } catch (error) {
    next(error);
  }
}

export async function getAdminPlayerDetails(req, res, next) {
  try {
    const target = await getAdminPlayer(req.auth.user, req.params.targetInternalId);
    res.status(200).json({ target });
  } catch (error) {
    next(error);
  }
}

export async function postAdminPlayerAction(req, res, next) {
  try {
    const result = await performAdminAction(req.auth.user, req.params.targetInternalId, req.body?.actionType, req.body ?? {});
    res.status(200).json(result);
  } catch (error) {
    next(error);
  }
}
