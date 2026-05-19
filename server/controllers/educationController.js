import { adminCompleteEducationForUser, cancelEducationForUser, completeEducationForUser, getEducationForUser, startEducationForUser } from "../services/educationService.js";

export async function getEducation(req, res, next) { try { res.status(200).json(await getEducationForUser(req.auth.user)); } catch (error) { next(error); } }
export async function startEducation(req, res, next) { try { res.status(200).json(await startEducationForUser(req.auth.user, req.params.courseId)); } catch (error) { next(error); } }
export async function cancelEducation(req, res, next) { try { res.status(200).json(await cancelEducationForUser(req.auth.user)); } catch (error) { next(error); } }
export async function completeEducation(req, res, next) { try { res.status(200).json(await completeEducationForUser(req.auth.user, req.body?.courseId ?? null)); } catch (error) { next(error); } }
export async function adminCompleteEducation(req, res, next) { try { res.status(200).json(await adminCompleteEducationForUser(req.auth.user, req.body ?? {})); } catch (error) { next(error); } }
