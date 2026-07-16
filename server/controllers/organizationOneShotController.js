import { getOrganizationOneShotBoardForUser, resolveOrganizationOneShotForUser, signUpOrganizationOneShotForUser } from "../services/organizationOneShotService.js";

export async function getOrganizationOneShots(req, res, next) {
  try {
    res.status(200).json(await getOrganizationOneShotBoardForUser(req.auth.user, req.params.organizationId));
  } catch (error) {
    next(error);
  }
}

export async function signUpOrganizationOneShot(req, res, next) {
  try {
    res.status(200).json(await signUpOrganizationOneShotForUser(req.auth.user, req.params.organizationId, req.params.campaignId));
  } catch (error) {
    next(error);
  }
}

export async function resolveOrganizationOneShot(req, res, next) {
  try {
    res.status(200).json(await resolveOrganizationOneShotForUser(req.auth.user, req.params.organizationId, req.params.campaignId));
  } catch (error) {
    next(error);
  }
}
