import { getWorldProgressionForUser } from "../services/worldProgressionService.js";

export async function getWorldProgression(req, res, next) {
  try {
    res.status(200).json(await getWorldProgressionForUser(req.auth.user));
  } catch (error) {
    next(error);
  }
}
