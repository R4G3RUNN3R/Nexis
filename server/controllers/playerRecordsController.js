import { acknowledgeProgressionForUser, getRecordsForUser } from "../services/playerRecordsApiService.js";

export async function getPlayerRecords(req, res, next) {
  try {
    const result = await getRecordsForUser(req.auth.user, { category: req.query?.category ?? null, limit: req.query?.limit ?? 120 });
    res.status(200).json(result);
  } catch (error) { next(error); }
}

export async function acknowledgeProgressionEvent(req, res, next) {
  try {
    const result = await acknowledgeProgressionForUser(req.auth.user, req.params.eventId || req.body?.eventId || "all");
    res.status(200).json(result);
  } catch (error) { next(error); }
}
