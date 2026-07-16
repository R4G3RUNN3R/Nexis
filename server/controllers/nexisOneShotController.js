import { advanceOneShotForUser, getOneShotHubForUser, startOneShotForUser } from "../services/nexisOneShotService.js";

export async function getOneShotHub(req, res, next) {
  try {
    res.status(200).json(await getOneShotHubForUser(req.auth.user));
  } catch (error) {
    next(error);
  }
}

export async function startOneShot(req, res, next) {
  try {
    res.status(200).json(await startOneShotForUser(req.auth.user, req.body ?? {}));
  } catch (error) {
    next(error);
  }
}

export async function chooseOneShotOption(req, res, next) {
  try {
    res.status(200).json(await advanceOneShotForUser(req.auth.user, req.params.sessionId, req.body ?? {}));
  } catch (error) {
    next(error);
  }
}
