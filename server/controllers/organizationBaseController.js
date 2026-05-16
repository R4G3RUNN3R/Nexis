import {
  acquireOrganizationBaseForUser,
  getOrganizationBaseOwnershipForUser,
} from "../services/organizationBaseOwnershipService.js";

const wrap = (handler) => async (req, res, next) => {
  try {
    await handler(req, res);
  } catch (error) {
    next(error);
  }
};

export const getOrganizationBaseController = wrap(async (req, res) => {
  const payload = await getOrganizationBaseOwnershipForUser(req.auth.user, req.params.organizationId);
  res.status(200).json(payload);
});

export const postOrganizationBaseAcquireController = wrap(async (req, res) => {
  const payload = await acquireOrganizationBaseForUser(req.auth.user, req.params.organizationId, req.body ?? {});
  res.status(200).json(payload);
});
