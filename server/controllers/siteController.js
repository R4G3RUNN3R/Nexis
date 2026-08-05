import { getPendingRankings, getStaffRoster } from "../services/siteService.js";

export async function getSiteRankings(_req, res, next) {
  try {
    const result = await getPendingRankings();
    res.status(200).json(result);
  } catch (error) {
    next(error);
  }
}

export async function getSiteStaff(_req, res, next) {
  try {
    const result = await getStaffRoster();
    res.status(200).json(result);
  } catch (error) {
    next(error);
  }
}
