import bcrypt from "bcryptjs";
import crypto from "node:crypto";
import { GOOGLE_PENDING_REGISTRATION_TTL_MINUTES, PASSWORD_RESET_TTL_MINUTES, SESSION_TTL_HOURS } from "../config/env.js";
import { query, withTransaction } from "../db/pool.js";
import { HttpError } from "../lib/errors.js";
import {
  createDefaultPlayerState,
  findPlayerStateByUserInternalId,
} from "../repositories/playerStateRepository.js";
import {
  createSession,
  deleteSessionsByUserInternalId,
  findSessionUserByTokenHash,
  touchSession,
} from "../repositories/sessionsRepository.js";
import {
  createUser,
  findAuthUserByEmail,
  findUserByInternalId,
  findUserByPublicId,
  updateUserPasswordHash,
} from "../repositories/usersRepository.js";
import {
  createPasswordResetToken,
  findPasswordResetTokenByHash,
  invalidatePasswordResetTokensForUser,
  markPasswordResetTokenUsed,
} from "../repositories/passwordResetRepository.js";
import {
  createIdentity,
  findIdentityByProviderSubject,
  findIdentityByUserAndProvider,
  listIdentitiesForUser,
  touchIdentityLogin,
} from "../repositories/authIdentitiesRepository.js";
import {
  createPendingRegistration,
  deletePendingRegistration,
  findPendingRegistrationByTokenHash,
} from "../repositories/googlePendingRegistrationsRepository.js";
import { sendPasswordResetEmail } from "./emailService.js";
import {
  allocatePlayerPublicId,
  assertValidMigratedPublicId,
  formatPlayerPublicId,
  reserveMigratedPlayerPublicId,
} from "./publicIdService.js";
import { verifyGoogleCredential } from "./googleAuthService.js";
import { buildMutableRuntimeState } from "../lib/runtimePlayerState.js";
import { ensureChronicleEntitlement } from "./chronicleService.js";
import { resolveTravelForRuntimeState } from "./travelService.js";
import { upsertPlayerRuntimeState } from "../repositories/playerStateRepository.js";
import { resolveLiveWorldForRuntimeState } from "./liveWorldService.js";
import { normalizeProgressionState } from "./progressionService.js";

function normalizeEmail(email) {
  return String(email || "").trim().toLowerCase();
}

function normalizeName(value) {
  return String(value || "").trim();
}

function makeInternalUserId() {
  return `usr_${crypto.randomUUID()}`;
}

function makeSessionToken() {
  const token = crypto.randomBytes(32).toString("hex");
  return {
    plain: token,
    hash: crypto.createHash("sha256").update(token).digest("hex"),
  };
}

function makeResetToken() {
  const token = crypto.randomBytes(32).toString("hex");
  return {
    plain: token,
    hash: crypto.createHash("sha256").update(token).digest("hex"),
  };
}

function mapApiUser(user) {
  return {
    email: user.email,
    username: user.username,
    firstName: user.firstName,
    lastName: user.lastName,
    publicId: user.publicId,
    publicPlayerId: formatPlayerPublicId(user.publicId),
    internalId: user.internalId,
    internalPlayerId: user.internalId,
    entityType: user.entityType ?? "player",
    privilegeRole: user.privilegeRole ?? "player",
    createdAt: user.createdAt,
  };
}

function makeClientPlayerId(publicId) {
  return `plr_${String(publicId).padStart(6, "0")}`;
}

export function mapPublicApiUser(user) {
  const mapped = mapApiUser(user);
  return {
    email: mapped.email,
    username: mapped.username,
    firstName: mapped.firstName,
    lastName: mapped.lastName,
    publicId: mapped.publicId,
    publicPlayerId: mapped.publicPlayerId,
    internalPlayerId: makeClientPlayerId(mapped.publicId),
    entityType: mapped.entityType,
    privilegeRole: mapped.privilegeRole,
    createdAt: mapped.createdAt,
  };
}

async function loadPlayerState(client, internalId) {
  return findPlayerStateByUserInternalId(client, internalId);
}

function withResolvedRuntimeState(playerState, runtimeState) {
  return {
    ...playerState,
    runtimeState,
  };
}

async function resolvePlayerStateForResponse(client, user, playerState) {
  const runtimeState = buildMutableRuntimeState(user, playerState);
  const travelResolution = resolveTravelForRuntimeState(runtimeState);
  const chronicleResolution = ensureChronicleEntitlement(runtimeState);
  normalizeProgressionState(runtimeState);
  const liveWorldResolution = resolveLiveWorldForRuntimeState(runtimeState, user);
  const currentRuntimePlayer = playerState?.runtimeState?.player ?? {};
  const accountAgeChanged =
    currentRuntimePlayer.createdAt !== runtimeState.player.createdAt ||
    currentRuntimePlayer.daysPlayed !== runtimeState.player.daysPlayed ||
    currentRuntimePlayer.ageLabel !== runtimeState.player.ageLabel;

  if (travelResolution.changed || chronicleResolution.changed || liveWorldResolution.changed || accountAgeChanged) {
    return upsertPlayerRuntimeState(client, user.internalId, runtimeState);
  }

  return withResolvedRuntimeState(playerState, runtimeState);
}

function validateRegisterInput({ firstName, lastName, email, password }) {
  if (!normalizeName(firstName)) {
    throw new HttpError(400, "First name is required.", "FIRST_NAME_REQUIRED");
  }
  if (!normalizeName(lastName)) {
    throw new HttpError(400, "Last name is required.", "LAST_NAME_REQUIRED");
  }
  if (!normalizeEmail(email)) {
    throw new HttpError(400, "Email is required.", "EMAIL_REQUIRED");
  }
  if (String(password || "").length < 6) {
    throw new HttpError(400, "Password must be at least 6 characters.", "PASSWORD_TOO_SHORT");
  }
}

function validateLoginInput({ email, password }) {
  if (!normalizeEmail(email)) {
    throw new HttpError(400, "Email is required.", "EMAIL_REQUIRED");
  }
  if (!String(password || "")) {
    throw new HttpError(400, "Password is required.", "PASSWORD_REQUIRED");
  }
}

function validateCharacterName({ firstName, lastName }) {
  if (!normalizeName(firstName)) {
    throw new HttpError(400, "First name is required.", "FIRST_NAME_REQUIRED");
  }
  if (!normalizeName(lastName)) {
    throw new HttpError(400, "Last name is required.", "LAST_NAME_REQUIRED");
  }
}

// Public registration DTO — deliberately excludes existingPublicId. Even if a
// client sends that field (curl, devtools, a custom client), it is never
// read here, so it cannot influence allocation. Every public account gets
// the next sequential ID from the allocator; there is no way to request a
// specific one. See createMigratedPlayerAccount below for the only other
// (non-HTTP-reachable) way a specific public ID can be assigned.
export async function registerUser({ firstName, lastName, email, password }) {
  validateRegisterInput({ firstName, lastName, email, password });
  const normalizedEmail = normalizeEmail(email);
  const normalizedFirstName = normalizeName(firstName);
  const normalizedLastName = normalizeName(lastName);

  return withTransaction(async (client) => {
    const existing = await findAuthUserByEmail(client, normalizedEmail);
    if (existing) {
      throw new HttpError(
        409,
        "An account with this email already exists.",
        "ACCOUNT_EXISTS",
      );
    }

    const publicId = await allocatePlayerPublicId(client);
    const passwordHash = await bcrypt.hash(password, 10);
    const user = await createUser(client, {
      internalId: makeInternalUserId(),
      publicId,
      username: normalizedEmail,
      email: normalizedEmail,
      firstName: normalizedFirstName,
      lastName: normalizedLastName,
      passwordHash,
    });

    await createDefaultPlayerState(client, user.internalId);
    const playerState = await resolvePlayerStateForResponse(client, user, await loadPlayerState(client, user.internalId));

    const sessionToken = makeSessionToken();
    const expiresAt = new Date(Date.now() + SESSION_TTL_HOURS * 60 * 60 * 1000);
    await createSession(client, {
      tokenHash: sessionToken.hash,
      userInternalId: user.internalId,
      expiresAt,
    });

    return {
      user: mapPublicApiUser(user),
      playerState,
      sessionToken: sessionToken.plain,
      sessionExpiresAt: expiresAt.toISOString(),
    };
  });
}

// Internal-only migration path. Not imported by any controller or route —
// intentionally unreachable from public HTTP. For a future offline
// migration script or admin tool that needs to recreate an account at a
// specific legacy public ID. reserveMigratedPlayerPublicId performs its own
// strict safe-integer/range validation, so even a misused internal caller
// cannot corrupt the allocator with an unsafe or absurd value.
export async function createMigratedPlayerAccount({ firstName, lastName, email, password, existingPublicId }) {
  validateRegisterInput({ firstName, lastName, email, password });
  assertValidMigratedPublicId(existingPublicId);
  const normalizedEmail = normalizeEmail(email);
  const normalizedFirstName = normalizeName(firstName);
  const normalizedLastName = normalizeName(lastName);

  return withTransaction(async (client) => {
    const existing = await findAuthUserByEmail(client, normalizedEmail);
    if (existing) {
      throw new HttpError(409, "An account with this email already exists.", "ACCOUNT_EXISTS");
    }

    const existingPublicIdUser = await findUserByPublicId(client, existingPublicId);
    if (existingPublicIdUser) {
      throw new HttpError(409, "That public ID is already in use.", "PUBLIC_ID_CONFLICT");
    }

    const publicId = await reserveMigratedPlayerPublicId(client, existingPublicId);
    const passwordHash = await bcrypt.hash(password, 10);
    const user = await createUser(client, {
      internalId: makeInternalUserId(),
      publicId,
      username: normalizedEmail,
      email: normalizedEmail,
      firstName: normalizedFirstName,
      lastName: normalizedLastName,
      passwordHash,
    });

    await createDefaultPlayerState(client, user.internalId);
    const playerState = await resolvePlayerStateForResponse(client, user, await loadPlayerState(client, user.internalId));

    return {
      user: mapPublicApiUser(user),
      playerState,
    };
  });
}

export async function loginUser({ email, password }) {
  validateLoginInput({ email, password });
  const normalizedEmail = normalizeEmail(email);

  return withTransaction(async (client) => {
    const authUser = await findAuthUserByEmail(client, normalizedEmail);
    if (!authUser) {
      throw new HttpError(401, "No account found with that email.", "ACCOUNT_NOT_FOUND");
    }

    if (authUser.deactivatedAt) {
      throw new HttpError(403, "This account has been closed.", "ACCOUNT_DEACTIVATED");
    }

    if (!authUser.passwordHash) {
      // Google-only account: never had a password, never gets a fake one.
      // bcrypt.compare against a null/non-bcrypt hash is not something to
      // rely on failing safely, so this is checked explicitly first.
      throw new HttpError(
        401,
        "This account signs in with Google. Continue with Google, or use \"Forgot password\" to set one.",
        "GOOGLE_LOGIN_REQUIRED",
      );
    }

    const passwordValid = await bcrypt.compare(password, authUser.passwordHash);
    if (!passwordValid) {
      throw new HttpError(401, "Incorrect password.", "INVALID_PASSWORD");
    }

    const sessionToken = makeSessionToken();
    const expiresAt = new Date(Date.now() + SESSION_TTL_HOURS * 60 * 60 * 1000);
    await createSession(client, {
      tokenHash: sessionToken.hash,
      userInternalId: authUser.internalId,
      expiresAt,
    });
    const playerState = await resolvePlayerStateForResponse(client, authUser, await loadPlayerState(client, authUser.internalId));

    return {
      user: mapPublicApiUser(authUser),
      playerState,
      sessionToken: sessionToken.plain,
      sessionExpiresAt: expiresAt.toISOString(),
    };
  });
}

export async function getSessionUser(sessionToken) {
  if (!sessionToken) return null;
  const tokenHash = crypto.createHash("sha256").update(sessionToken).digest("hex");
  const result = await findSessionUserByTokenHash({ query }, tokenHash);

  if (!result) return null;

  // A deactivated account may still hold a live, not-yet-expired session
  // token from a device other than the one that closed it - closeAccountForUser
  // already deletes every session in the same transaction as the closure, so
  // this is mainly belt-and-suspenders for a session that predates that call.
  if (result.user.deactivatedAt) return null;

  await touchSession({ query }, tokenHash);
  const playerState = await resolvePlayerStateForResponse(
    { query },
    result.user,
    await loadPlayerState({ query }, result.user.internalId),
  );

  return {
    user: mapApiUser(result.user),
    playerState,
  };
}

const GOOGLE_PROVIDER = "google";

// Entry point for POST /api/auth/google. Verifies the credential first (this
// is the only place callers can influence anything - sub/email/emailVerified
// below all come from the verified payload, never from a parallel client
// field), then branches into exactly one of three outcomes:
//   - a Google identity already linked here -> log in immediately
//   - no identity, but the email already has a password account -> refuse
//     to auto-link, tell the caller to authenticate first (ACCOUNT_LINK_REQUIRED)
//   - neither -> hold a short-lived pending registration and ask the caller
//     to confirm a character name via completeGoogleRegistration
export async function beginGoogleAuth({ credential }) {
  const identity = await verifyGoogleCredential(credential);

  return withTransaction(async (client) => {
    const existingIdentity = await findIdentityByProviderSubject(client, GOOGLE_PROVIDER, identity.subject);
    if (existingIdentity) {
      const user = await findUserByInternalId(client, existingIdentity.userInternalId);
      if (!user) {
        throw new HttpError(500, "This Google account's linked Nexis account could not be loaded.", "GOOGLE_IDENTITY_ORPHANED");
      }

      await touchIdentityLogin(client, GOOGLE_PROVIDER, identity.subject);

      const sessionToken = makeSessionToken();
      const expiresAt = new Date(Date.now() + SESSION_TTL_HOURS * 60 * 60 * 1000);
      await createSession(client, { tokenHash: sessionToken.hash, userInternalId: user.internalId, expiresAt });
      const playerState = await resolvePlayerStateForResponse(client, user, await loadPlayerState(client, user.internalId));

      return {
        status: "returning",
        user: mapPublicApiUser(user),
        playerState,
        sessionToken: sessionToken.plain,
        sessionExpiresAt: expiresAt.toISOString(),
      };
    }

    const existingEmailUser = await findAuthUserByEmail(client, identity.email);
    if (existingEmailUser) {
      // Deliberately not linked automatically on email match alone - email
      // match doesn't prove control of the existing account. The caller
      // must authenticate with the current password, or link Google while
      // already signed in (see linkGoogleIdentityToCurrentUser).
      throw new HttpError(
        409,
        "An account with this email already exists. Sign in with your password, then link Google from your account.",
        "ACCOUNT_LINK_REQUIRED",
      );
    }

    const pendingToken = makeSessionToken();
    const expiresAt = new Date(Date.now() + GOOGLE_PENDING_REGISTRATION_TTL_MINUTES * 60 * 1000);
    await createPendingRegistration(client, {
      tokenHash: pendingToken.hash,
      providerSubject: identity.subject,
      providerEmail: identity.email,
      providerEmailVerified: identity.emailVerified,
      suggestedFirstName: identity.firstName,
      suggestedLastName: identity.lastName,
      expiresAt,
    });

    return {
      status: "registration_required",
      pendingToken: pendingToken.plain,
      suggestedFirstName: identity.firstName,
      suggestedLastName: identity.lastName,
      email: identity.email,
      expiresAt: expiresAt.toISOString(),
    };
  });
}

// Entry point for POST /api/auth/google/complete-registration. firstName/
// lastName are the one thing the player is explicitly allowed to choose for
// themselves (their in-game character name) - everything identity-related
// (provider_subject/provider_email/provider_email_verified) comes only from
// the pending record this references, which was itself populated only from
// a verified Google credential in beginGoogleAuth. The client cannot resupply
// or override those fields here.
export async function completeGoogleRegistration({ pendingToken, firstName, lastName }) {
  if (!String(pendingToken || "").trim()) {
    throw new HttpError(400, "This Google sign-up session is missing or expired. Please try Continue with Google again.", "GOOGLE_PENDING_TOKEN_REQUIRED");
  }
  validateCharacterName({ firstName, lastName });
  const normalizedFirstName = normalizeName(firstName);
  const normalizedLastName = normalizeName(lastName);
  const tokenHash = crypto.createHash("sha256").update(String(pendingToken).trim()).digest("hex");

  return withTransaction(async (client) => {
    const pending = await findPendingRegistrationByTokenHash(client, tokenHash);
    if (!pending) {
      throw new HttpError(
        400,
        "This Google sign-up link is invalid or has expired. Please try Continue with Google again.",
        "GOOGLE_PENDING_TOKEN_INVALID",
      );
    }

    // Re-check both invariants at creation time, not just at the start of
    // the flow - another request could have raced this one to completion
    // using the same Google identity or email in the interim.
    const existingIdentity = await findIdentityByProviderSubject(client, GOOGLE_PROVIDER, pending.providerSubject);
    if (existingIdentity) {
      await deletePendingRegistration(client, tokenHash);
      throw new HttpError(409, "This Google account is already linked to a Nexis account. Please sign in instead.", "GOOGLE_IDENTITY_ALREADY_LINKED");
    }
    const existingEmailUser = await findAuthUserByEmail(client, pending.providerEmail);
    if (existingEmailUser) {
      await deletePendingRegistration(client, tokenHash);
      throw new HttpError(
        409,
        "An account with this email already exists. Sign in with your password, then link Google from your account.",
        "ACCOUNT_LINK_REQUIRED",
      );
    }

    const publicId = await allocatePlayerPublicId(client);
    const user = await createUser(client, {
      internalId: makeInternalUserId(),
      publicId,
      username: pending.providerEmail,
      email: pending.providerEmail,
      firstName: normalizedFirstName,
      lastName: normalizedLastName,
      passwordHash: null,
    });

    await createIdentity(client, {
      userInternalId: user.internalId,
      provider: GOOGLE_PROVIDER,
      providerSubject: pending.providerSubject,
      providerEmail: pending.providerEmail,
      providerEmailVerified: pending.providerEmailVerified,
    });

    await createDefaultPlayerState(client, user.internalId);
    const playerState = await resolvePlayerStateForResponse(client, user, await loadPlayerState(client, user.internalId));

    const sessionToken = makeSessionToken();
    const expiresAt = new Date(Date.now() + SESSION_TTL_HOURS * 60 * 60 * 1000);
    await createSession(client, { tokenHash: sessionToken.hash, userInternalId: user.internalId, expiresAt });

    await deletePendingRegistration(client, tokenHash);

    return {
      status: "created",
      user: mapPublicApiUser(user),
      playerState,
      sessionToken: sessionToken.plain,
      sessionExpiresAt: expiresAt.toISOString(),
    };
  });
}

// Entry point for POST /api/auth/google/link. Requires an already-valid
// Nexis session (enforced by requireSession at the route level - userInternalId
// here comes from that session, never from the request body). Only ever
// inserts into user_auth_identities; never touches users - gameplay state,
// public ID, privilege role, and email are untouched by design, matching
// "not without an explicit separate process."
export async function linkGoogleIdentityToCurrentUser({ userInternalId, credential }) {
  const identity = await verifyGoogleCredential(credential);

  return withTransaction(async (client) => {
    const existingForUser = await findIdentityByUserAndProvider(client, userInternalId, GOOGLE_PROVIDER);
    if (existingForUser) {
      throw new HttpError(409, "This account already has a linked Google identity.", "GOOGLE_ALREADY_LINKED");
    }

    const existingForSubject = await findIdentityByProviderSubject(client, GOOGLE_PROVIDER, identity.subject);
    if (existingForSubject) {
      throw new HttpError(409, "This Google account is already linked to a different Nexis account.", "GOOGLE_IDENTITY_TAKEN");
    }

    const created = await createIdentity(client, {
      userInternalId,
      provider: GOOGLE_PROVIDER,
      providerSubject: identity.subject,
      providerEmail: identity.email,
      providerEmailVerified: identity.emailVerified,
    });

    return {
      linked: true,
      provider: GOOGLE_PROVIDER,
      providerEmail: created.providerEmail,
      linkedAt: created.createdAt,
    };
  });
}

// Entry point for GET /api/auth/identities. Never returns provider_subject
// (the raw Google sub) to the client - there is no legitimate frontend need
// for it, so it isn't exposed.
export async function listAuthIdentitiesForUser(userInternalId) {
  const rows = await listIdentitiesForUser({ query }, userInternalId);
  return rows.map((row) => ({
    provider: row.provider,
    providerEmail: row.providerEmail,
    linkedAt: row.createdAt,
    lastLoginAt: row.lastLoginAt,
  }));
}

export async function requestPasswordReset({ email }) {
  const normalizedEmail = normalizeEmail(email);
  if (!normalizedEmail) {
    throw new HttpError(400, "Email is required.", "EMAIL_REQUIRED");
  }

  const result = await withTransaction(async (client) => {
    const authUser = await findAuthUserByEmail(client, normalizedEmail);
    if (!authUser) {
      return { delivered: true };
    }

    const resetToken = makeResetToken();
    const expiresAt = new Date(Date.now() + PASSWORD_RESET_TTL_MINUTES * 60 * 1000);

    await invalidatePasswordResetTokensForUser(client, authUser.internalId);
    await createPasswordResetToken(client, {
      tokenHash: resetToken.hash,
      userInternalId: authUser.internalId,
      expiresAt,
    });

    return {
      delivered: true,
      email: authUser.email,
      firstName: authUser.firstName,
      resetToken: resetToken.plain,
    };
  });

  if ("resetToken" in result && typeof result.resetToken === "string") {
    await sendPasswordResetEmail({
      email: result.email,
      firstName: result.firstName,
      resetToken: result.resetToken,
    });
  }

  return { delivered: true };
}

export async function resetPassword({ token, password }) {
  if (!String(token || "").trim()) {
    throw new HttpError(400, "Reset token is required.", "RESET_TOKEN_REQUIRED");
  }
  if (String(password || "").length < 6) {
    throw new HttpError(400, "Password must be at least 6 characters.", "PASSWORD_TOO_SHORT");
  }

  const tokenHash = crypto.createHash("sha256").update(String(token).trim()).digest("hex");

  return withTransaction(async (client) => {
    const resetRecord = await findPasswordResetTokenByHash(client, tokenHash);
    if (!resetRecord || resetRecord.used_at) {
      throw new HttpError(400, "This password reset link is invalid or expired.", "RESET_TOKEN_INVALID");
    }

    const passwordHash = await bcrypt.hash(password, 10);
    await updateUserPasswordHash(client, resetRecord.user_internal_id, passwordHash);
    await markPasswordResetTokenUsed(client, tokenHash);
    await invalidatePasswordResetTokensForUser(client, resetRecord.user_internal_id);
    await deleteSessionsByUserInternalId(client, resetRecord.user_internal_id);

    return { reset: true };
  });
}
