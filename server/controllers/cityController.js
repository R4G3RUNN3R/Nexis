import { getCityPeopleForUser } from "../services/cityService.js";

export async function getCityPeople(req, res, next) {
  try {
    const result = await getCityPeopleForUser(req.auth.user, req.params.cityId);
    res.status(200).json(result);
  } catch (error) {
    next(error);
  }
}
