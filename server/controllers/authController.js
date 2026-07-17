import {
  beginGoogleAuth,
  completeGoogleRegistration,
  linkGoogleIdentityToCurrentUser,
  listAuthIdentitiesForUser,
  loginUser,
  mapPublicApiUser,
  registerUser,
  requestPasswordReset,
  resetPassword,
} from "../services/authService.js";
import { isGoogleAuthConfigured } from "../services/googleAuthService.js";
import { GOOGLE_CLIENT_ID } from "../config/env.js";

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
    user: mapPublicApiUser(req.auth.user),
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

// Public, unauthenticated, non-secret config - a Google client ID is meant
// to ship inside frontend JS. Lets the client decide whether to render the
// Google button at all, satisfying "fail safely when not configured."
export function getGoogleAuthConfig(_req, res) {
  const configured = isGoogleAuthConfigured();
  res.status(200).json({
    configured,
    clientId: configured ? GOOGLE_CLIENT_ID : null,
  });
}

export async function postGoogleAuth(req, res, next) {
  try {
    const result = await beginGoogleAuth({ credential: req.body?.credential });
    res.status(result.status === "returning" ? 200 : 202).json(result);
  } catch (error) {
    next(error);
  }
}

export async function postGoogleCompleteRegistration(req, res, next) {
  try {
    const result = await completeGoogleRegistration({
      pendingToken: req.body?.pendingToken,
      firstName: req.body?.firstName,
      lastName: req.body?.lastName,
    });
    res.status(201).json(result);
  } catch (error) {
    next(error);
  }
}

export async function postGoogleLink(req, res, next) {
  try {
    const result = await linkGoogleIdentityToCurrentUser({
      userInternalId: req.auth.user.internalId,
      credential: req.body?.credential,
    });
    res.status(200).json(result);
  } catch (error) {
    next(error);
  }
}

export async function getAuthIdentities(req, res, next) {
  try {
    const identities = await listAuthIdentitiesForUser(req.auth.user.internalId);
    res.status(200).json({ identities });
  } catch (error) {
    next(error);
  }
}
