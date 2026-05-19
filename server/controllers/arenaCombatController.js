import { getArenaCombatForUser, sparArenaOpponentForUser } from "../services/arenaCombatService.js";

export async function getArenaCombat(req, res, next) {
  try {
    const result = await getArenaCombatForUser(req.auth.user);
    res.status(200).json(result);
  } catch (error) {
    next(error);
  }
}

export async function sparArenaOpponent(req, res, next) {
  try {
    const result = await sparArenaOpponentForUser(req.auth.user, req.params.opponentId, req.body?.combatItemId ?? null);
    res.status(200).json(result);
  } catch (error) {
    next(error);
  }
}
