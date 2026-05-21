import { getAdventureBoardForUser, startAdventureForUser } from "../services/adventureService.js";

export async function getAdventureBoard(req, res, next) {
  try {
    res.status(200).json(await getAdventureBoardForUser(req.auth.user));
  } catch (error) {
    next(error);
  }
}

export async function startAdventure(req, res, next) {
  try {
    res.status(200).json(await startAdventureForUser(req.auth.user, req.params.adventureId, req.body ?? {}));
  } catch (error) {
    next(error);
  }
}
