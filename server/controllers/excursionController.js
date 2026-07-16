import { getExcursionBoardForUser, startExcursionForUser } from "../services/excursionService.js";

export async function getExcursionBoard(req, res, next) {
  try {
    res.status(200).json({ ok: true, ...(await getExcursionBoardForUser(req.auth.user)) });
  } catch (error) {
    next(error);
  }
}

export async function startExcursion(req, res, next) {
  try {
    res.status(200).json({ ok: true, ...(await startExcursionForUser(req.auth.user, req.params.locationId)) });
  } catch (error) {
    next(error);
  }
}
