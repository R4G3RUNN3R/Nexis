import { getCityBoardForUser } from "../services/cityBoardService.js";
export async function getCityBoard(req, res, next) { try { res.status(200).json(await getCityBoardForUser(req.auth.user, req.params.cityId)); } catch (error) { next(error); } }
