import {
  changeNameForUser,
  changePasswordForUser,
  closeAccountForUser,
  confirmEmailChangeForUser,
  requestEmailChangeForUser,
} from "../services/accountService.js";

export async function postChangePassword(req, res, next) {
  try {
    const result = await changePasswordForUser({
      userInternalId: req.auth.user.internalId,
      currentPassword: req.body?.currentPassword,
      newPassword: req.body?.newPassword,
    });
    res.status(200).json(result);
  } catch (error) {
    next(error);
  }
}

export async function postRequestEmailChange(req, res, next) {
  try {
    const result = await requestEmailChangeForUser({
      userInternalId: req.auth.user.internalId,
      newEmail: req.body?.newEmail,
    });
    res.status(200).json(result);
  } catch (error) {
    next(error);
  }
}

// Deliberately not behind requireSession - the confirmation token itself is
// the credential (same pattern as POST /reset-password), so a player can
// confirm an email change from a fresh browser/device that never logged in.
export async function postConfirmEmailChange(req, res, next) {
  try {
    const result = await confirmEmailChangeForUser({ token: req.body?.token });
    res.status(200).json(result);
  } catch (error) {
    next(error);
  }
}

export async function postChangeName(req, res, next) {
  try {
    const result = await changeNameForUser(req.auth.user, {
      firstName: req.body?.firstName,
      lastName: req.body?.lastName,
    });
    res.status(200).json(result);
  } catch (error) {
    next(error);
  }
}

export async function postCloseAccount(req, res, next) {
  try {
    const result = await closeAccountForUser({
      userInternalId: req.auth.user.internalId,
      password: req.body?.password,
    });
    res.status(200).json(result);
  } catch (error) {
    next(error);
  }
}
