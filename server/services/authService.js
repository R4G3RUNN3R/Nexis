import bcrypt from "bcryptjs";
import crypto from "node:crypto";
import { PASSWORD_RESET_TTL_MINUTES, SESSION_TTL_HOURS } from "../config/env.js";
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
  findUserByPublicId,
  updateUserPasswordHash,
} from "../repositories/usersRepository.js";
import {
  createPasswordResetToken,
  findPasswordResetTokenByHash,
  invalidatePasswordResetTokensForUser,
  markPasswordResetTokenUsed,
} from "../repositories/passwordResetRepository.js";
import { sendPasswordResetEmail } from "./emailService.js";
import {
  allocatePlayerPublicId,
  formatPlayerPublicId,
  reserveMigratedPlayerPublicId,
} from "./publicIdService.js";
import { buildMutableRuntimeState } from "../lib/runtimePlayerState.js";
import { ensureChronicleEntitlement } from "./chronicleService.js";
import { resolveTravelForRuntimeState } from "./travelService.js";
import { upsertPlayerRuntimeState } from "../repositories/playerStateRepository.js";
import { resolveLiveWorldForRuntimeState } from "./liveWorldService.js";

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

function parseMigratedPublicId(value) {
  return Number.isInteger(value) ? value : null;
}

function validateLoginInput({ email, password }) {
  if (!normalizeEmail(email)) {
    throw new HttpError(400, "Email is required.", "EMAIL_REQUIRED");
  }
  if (!String(password || "")) {
    throw new HttpError(400, "Password is required.", "PASSWORD_REQUIRED");
  }
}

export async function registerUser({ firstName, lastName, email, password, existingPublicId }) {
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

    const migratedPublicId = parseMigratedPublicId(existingPublicId);
    if (migratedPublicId !== null) {
      const existingPublicIdUser = await findUserByPublicId(client, migratedPublicId);
      if (existingPublicIdUser) {
        throw new HttpError(
          409,
          "That public ID is already in use.",
          "PUBLIC_ID_CONFLICT",
        );
      }
    }

    const publicId =
      migratedPublicId !== null
        ? await reserveMigratedPlayerPublicId(client, migratedPublicId)
        : await allocatePlayerPublicId(client);
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

export async function loginUser({ email, password }) {
  validateLoginInput({ email, password });
  const normalizedEmail = normalizeEmail(email);

  return withTransaction(async (client) => {
    const authUser = await findAuthUserByEmail(client, normalizedEmail);
    if (!authUser) {
      throw new HttpError(401, "No account found with that email.", "ACCOUNT_NOT_FOUND");
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
