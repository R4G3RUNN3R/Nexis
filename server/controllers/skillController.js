import { getSkillsForUser, slotSkillForUser } from "../services/skillService.js";

export async function getSkills(req, res, next) {
  try {
    const result = await getSkillsForUser(req.auth.user);
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
