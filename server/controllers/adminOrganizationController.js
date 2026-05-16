import {
  getAdminOrganizationBaseState,
  reassignOrganizationLeadershipByAdmin,
  triggerOrganizationBaseSweepByAdmin,
} from "../services/adminOrganizationService.js";

export async function postAdminOrganizationLeadershipController(req, res, next) {
  try {
    const result = await reassignOrganizationLeadershipByAdmin(req.auth.user, {
      organizationPublicId: req.params.organizationPublicId,
      nextLeaderPublicId: req.body?.nextLeaderPublicId,
      reason: req.body?.reason,
    });
    res.status(200).json(result);
  } catch (error) {
    next(error);
  }
}

export async function postAdminOrganizationBaseSweepController(req, res, next) {
  try {
    const result = await triggerOrganizationBaseSweepByAdmin(req.auth.user);
    res.status(200).json(result);
  } catch (error) {
    next(error);
  }
}

export async function getAdminOrganizationBaseStateController(req, res, next) {
  try {
    const result = await getAdminOrganizationBaseState(req.auth.user, req.params.organizationPublicId);
    res.status(200).json(result);
  } catch (error) {
    next(error);
  }
}
