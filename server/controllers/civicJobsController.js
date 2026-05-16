import {
  collectCivicBenefitsForUser,
  getCivicJobsForUser,
  joinCivicTrackForUser,
  promoteCivicTrackForUser,
  resignCivicTrackForUser,
  spendCivicJobPointsForUser,
} from "../services/civicJobsService.js";

export async function getCivicJobs(req, res, next) {
  try {
    const result = await getCivicJobsForUser(req.auth.user);
    res.status(200).json(result);
  } catch (error) {
    next(error);
  }
}

export async function postJoinCivicTrack(req, res, next) {
  try {
    const result = await joinCivicTrackForUser(req.auth.user, req.body ?? {});
    res.status(200).json(result);
  } catch (error) {
    next(error);
  }
}

export async function postCollectCivicBenefits(req, res, next) {
  try {
    const result = await collectCivicBenefitsForUser(req.auth.user);
    res.status(200).json(result);
  } catch (error) {
    next(error);
  }
}

export async function postResignCivicTrack(req, res, next) {
  try {
    const result = await resignCivicTrackForUser(req.auth.user);
    res.status(200).json(result);
  } catch (error) {
    next(error);
  }
}

export async function postPromoteCivicTrack(req, res, next) {
  try {
    const result = await promoteCivicTrackForUser(req.auth.user);
    res.status(200).json(result);
  } catch (error) {
    next(error);
  }
}

export async function postSpendCivicJobPoints(req, res, next) {
  try {
    const result = await spendCivicJobPointsForUser(req.auth.user, req.body ?? {});
    res.status(200).json(result);
  } catch (error) {
    next(error);
  }
}