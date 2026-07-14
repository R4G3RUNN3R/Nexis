import {
  cancelTravelForUser,
  getTravelOptionsForUser,
  getTravelStateForUser,
  startTravelForUser,
} from "../services/travelService.js";

export async function getTravelState(req, res, next) {
  try {
    const result = await getTravelStateForUser(req.auth.user);
    res.status(200).json(result);
  } catch (error) {
    next(error);
  }
}

export async function getTravelOptions(req, res, next) {
  try {
    const result = await getTravelOptionsForUser(req.auth.user, { destinationCityId: req.query?.destinationCityId });
    res.status(200).json(result);
  } catch (error) {
    next(error);
  }
}

export async function postStartTravel(req, res, next) {
  try {
    const result = await startTravelForUser(req.auth.user, req.body ?? {});
    res.status(200).json(result);
  } catch (error) {
    next(error);
  }
}

export async function postCancelTravel(req, res, next) {
  try {
    const result = await cancelTravelForUser(req.auth.user);
    res.status(200).json(result);
  } catch (error) {
    next(error);
  }
}
