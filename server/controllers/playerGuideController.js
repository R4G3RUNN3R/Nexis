import { getPlayerCommandBrief } from "../services/playerGuideService.js";

export async function getCommandBriefController(req, res, next) {
  try {
    const result = await getPlayerCommandBrief(req.auth.user);
    res.status(200).json(result);
  } catch (error) {
    next(error);
  }
}
