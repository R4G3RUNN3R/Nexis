import { challengeDuelForUser, getDuelsForUser, respondToDuelForUser } from "../services/duelService.js";

export async function getDuels(req, res, next) {
  try {
    const result = await getDuelsForUser(req.auth.user);
    res.status(200).json(result);
  } catch (error) {
    next(error);
  }
}

export async function challengeDuel(req, res, next) {
  try {
    const result = await challengeDuelForUser(req.auth.user, req.body);
    res.status(200).json(result);
  } catch (error) {
    next(error);
  }
}

export async function respondToDuel(req, res, next) {
  try {
    const result = await respondToDuelForUser(req.auth.user, req.params.duelId, req.body);
    res.status(200).json(result);
  } catch (error) {
    next(error);
  }
}
