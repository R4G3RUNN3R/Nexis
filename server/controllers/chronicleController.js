import { getChronicleStatusForUser, openMonthlyChronicleForUser, setDonorTierForUser, submitChronicleChoiceForUser } from "../services/chronicleService.js";
import { withTransaction } from "../db/pool.js";
import { findUserByPublicId } from "../repositories/usersRepository.js";
import { HttpError } from "../lib/errors.js";

function normalizePublicId(value) {
  const match = /^P?(\d{7})$/i.exec(String(value ?? "").trim());
  return match ? Number.parseInt(match[1], 10) : null;
}

export async function getChronicleStatus(req, res, next) {
  try {
    const result = await getChronicleStatusForUser(req.auth.user);
    res.status(200).json(result);
  } catch (error) {
    next(error);
  }
}

export async function postOpenMonthlyChronicle(req, res, next) {
  try {
    const result = await openMonthlyChronicleForUser(req.auth.user);
    res.status(200).json(result);
  } catch (error) {
    next(error);
  }
}

export async function postChronicleChoice(req, res, next) {
  try {
    const result = await submitChronicleChoiceForUser(req.auth.user, req.body ?? {});
    res.status(200).json(result);
  } catch (error) {
    next(error);
  }
}

export async function postDonorTier(req, res, next) {
  try {
    const targetPublicId = normalizePublicId(req.body?.targetPublicId);
    const targetUser = targetPublicId
      ? await withTransaction(async (client) => findUserByPublicId(client, targetPublicId))
      : req.auth.user;
    if (!targetUser) {
      throw new HttpError(404, "Target citizen unavailable.", "DONOR_TARGET_NOT_FOUND");
    }
    const result = await setDonorTierForUser(req.auth.user, targetUser, req.body ?? {});
    res.status(200).json(result);
  } catch (error) {
    next(error);
  }
}
