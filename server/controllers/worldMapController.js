import { getWorldAtlasForUser } from "../services/worldMapService.js";
export async function getWorldAtlas(req, res, next) { try { res.status(200).json(await getWorldAtlasForUser(req.auth.user)); } catch (error) { next(error); } }
