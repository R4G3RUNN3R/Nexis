import { cancelBountyWritForUser, getPvpHubForUser, issueBountyWritForUser, updatePvpSafetyForUser } from "../services/pvpService.js";

export async function getPvpHub(req, res, next) {
  try {
    res.status(200).json(await getPvpHubForUser(req.auth.user));
  } catch (error) {
    next(error);
  }
}

export async function updatePvpSafety(req, res, next) {
  try {
    res.status(200).json(await updatePvpSafetyForUser(req.auth.user, req.body ?? {}));
  } catch (error) {
    next(error);
  }
}

export async function issueBountyWrit(req, res, next) {
  try {
    res.status(200).json(await issueBountyWritForUser(req.auth.user, req.body ?? {}));
  } catch (error) {
    next(error);
  }
}

export async function cancelBountyWrit(req, res, next) {
  try {
    res.status(200).json(await cancelBountyWritForUser(req.auth.user, req.body ?? {}));
  } catch (error) {
    next(error);
  }
}
