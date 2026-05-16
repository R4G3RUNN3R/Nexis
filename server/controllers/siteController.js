import { getPendingRankings } from "../services/siteService.js";

export async function getSiteRankings(_req, res, next) {
  try {
    const result = await getPendingRankings();
    res.status(200).json(result);
  } catch (error) {
    next(error);
  }
}
