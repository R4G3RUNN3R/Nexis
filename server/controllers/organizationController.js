import {
  addOrganizationMemberForUser,
  applyToConsortiumForUser,
  assignConsortiumPositionForUser,
  claimDailyConsortiumPointsForUser,
  createOrganizationForUser,
  depositConsortiumTreasuryForUser,
  getMyOrganization,
  listConsortiumTypes,
  redeemConsortiumRewardForUser,
  removeConsortiumMemberForUser,
  reviewConsortiumApplicationForUser,
  runConsortiumOutreachForUser,
} from "../services/organizationService.js";

const wrap = (handler) => async (req, res, next) => {
  try { await handler(req, res); } catch (error) { next(error); }
};

export const getMyOrganizationController = wrap(async (req, res) => { res.status(200).json(await getMyOrganization(req.auth.user, req.query.type)); });
export const postOrganizationController = wrap(async (req, res) => { res.status(201).json(await createOrganizationForUser(req.auth.user, req.body ?? {})); });
export const postConsortiumClaimPointsController = wrap(async (req, res) => { res.status(200).json(await claimDailyConsortiumPointsForUser(req.auth.user, req.params.organizationId)); });
export const postConsortiumRedeemController = wrap(async (req, res) => { res.status(200).json(await redeemConsortiumRewardForUser(req.auth.user, req.params.organizationId, req.body ?? {})); });
export const postOrganizationMemberController = wrap(async (req, res) => { res.status(200).json(await addOrganizationMemberForUser(req.auth.user, req.params.organizationId, req.body ?? {})); });
export const postConsortiumApplyController = wrap(async (req, res) => { res.status(200).json(await applyToConsortiumForUser(req.auth.user, req.params.organizationId, req.body ?? {})); });
export const postConsortiumApplicationReviewController = wrap(async (req, res) => { res.status(200).json(await reviewConsortiumApplicationForUser(req.auth.user, req.params.organizationId, req.body ?? {})); });
export const postConsortiumPositionController = wrap(async (req, res) => { res.status(200).json(await assignConsortiumPositionForUser(req.auth.user, req.params.organizationId, req.body ?? {})); });
export const postConsortiumMemberRemoveController = wrap(async (req, res) => { res.status(200).json(await removeConsortiumMemberForUser(req.auth.user, req.params.organizationId, req.body ?? {})); });
export const postConsortiumTreasuryDepositController = wrap(async (req, res) => { res.status(200).json(await depositConsortiumTreasuryForUser(req.auth.user, req.params.organizationId, req.body ?? {})); });
export const postConsortiumOutreachController = wrap(async (req, res) => { res.status(200).json(await runConsortiumOutreachForUser(req.auth.user, req.params.organizationId)); });
export const getConsortiumTemplatesController = wrap(async (_req, res) => { res.status(200).json({ consortiumTemplates: listConsortiumTypes() }); });
