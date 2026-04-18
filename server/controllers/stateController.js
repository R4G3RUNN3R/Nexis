import { syncRuntimeState } from "../services/stateService.js";

export async function putRuntimeState(req, res, next) {
  try {
    const playerState = await syncRuntimeState(req.auth.user.internalPlayerId, req.body ?? {});
    res.status(200).json({ playerState });
  } catch (error) {
    next(error);
  }
}
