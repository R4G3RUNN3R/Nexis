import { loginUser, registerUser, requestPasswordReset, resetPassword } from "../services/authService.js";

export async function postRegister(req, res, next) {
  try {
    const result = await registerUser(req.body ?? {});
    res.status(201).json(result);
  } catch (error) {
    next(error);
  }
}

export async function postLogin(req, res, next) {
  try {
    const result = await loginUser(req.body ?? {});
    res.status(200).json(result);
  } catch (error) {
    next(error);
  }
}

export async function getMe(req, res) {
  res.status(200).json({
    user: req.auth.user,
    playerState: req.auth.playerState,
  });
}

export async function postForgotPassword(req, res, next) {
  try {
    const result = await requestPasswordReset(req.body ?? {});
    res.status(200).json(result);
  } catch (error) {
    next(error);
  }
}

export async function postResetPassword(req, res, next) {
  try {
    const result = await resetPassword(req.body ?? {});
    res.status(200).json(result);
  } catch (error) {
    next(error);
  }
}
