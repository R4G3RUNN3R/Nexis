import {
  adminSetSkillMasteryForUser,
  completeSkillLearningForUser,
  getSkillsForUser,
  learnSkillForUser,
  slotSkillForUser,
} from "../services/skillService.js";

export async function getSkills(req, res, next) {
  try {
    const result = await getSkillsForUser(req.auth.user);
    res.status(200).json(result);
  } catch (error) {
    next(error);
  }
}

export async function learnSkill(req, res, next) {
  try {
    const result = await learnSkillForUser(req.auth.user, req.body);
    res.status(200).json(result);
  } catch (error) {
    next(error);
  }
}

export async function completeSkillLearning(req, res, next) {
  try {
    const result = await completeSkillLearningForUser(req.auth.user, req.body);
    res.status(200).json(result);
  } catch (error) {
    next(error);
  }
}

export async function slotSkill(req, res, next) {
  try {
    const result = await slotSkillForUser(req.auth.user, req.body);
    res.status(200).json(result);
  } catch (error) {
    next(error);
  }
}

export async function adminSetSkillMastery(req, res, next) {
  try {
    const result = await adminSetSkillMasteryForUser(req.auth.user, req.body);
    res.status(200).json(result);
  } catch (error) {
    next(error);
  }
}
