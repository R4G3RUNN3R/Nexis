import { getAdminAuditLog, getAdminPlayer, grantOneShotTokenForUser, performAdminAction, searchAdminPlayers } from "../services/adminService.js";

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
    const target = await getAdminPlayer(req.auth.user, req.params.targetPublicId);
    res.status(200).json({ target });
  } catch (error) {
    next(error);
  }
}

export async function postAdminPlayerAction(req, res, next) {
  try {
    const result = await performAdminAction(req.auth.user, req.params.targetPublicId, req.body?.actionType, req.body ?? {});
    res.status(200).json(result);
  } catch (error) {
    next(error);
  }
}

export async function postAdminOneShotTokenGrant(req, res, next) {
  try {
    const result = await grantOneShotTokenForUser(req.auth.user, req.params.targetPublicId, req.body ?? {});
    res.status(200).json(result);
  } catch (error) {
    next(error);
  }
}

export async function getAdminAuditLogController(req, res, next) {
  try {
    const targetInternalId = typeof req.query.targetInternalId === "string" && req.query.targetInternalId.trim()
      ? req.query.targetInternalId.trim()
      : null;
    const entries = await getAdminAuditLog(req.auth.user, { targetInternalId, limit: req.query.limit });
    res.status(200).json({ entries });
  } catch (error) {
    next(error);
  }
}
