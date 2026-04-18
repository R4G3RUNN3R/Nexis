import bcrypt from "bcryptjs";
import crypto from "node:crypto";
import { SESSION_TTL_HOURS } from "../config/env.js";
import { query, withTransaction } from "../db/pool.js";
import { HttpError } from "../lib/errors.js";
import { getReservedIdentityMeta } from "../lib/userIdentity.js";
import {
  createDefaultPlayerState,
  findPlayerStateByUserInternalId,
} from "../repositories/playerStateRepository.js";
import {
  createSession,
  findSessionUserByTokenHash,
  touchSession,
} from "../repositories/sessionsRepository.js";
import {
  createUser,
  findAuthUserByEmail,
  findUserByPublicId,
} from "../repositories/usersRepository.js";
import {
  allocatePlayerPublicId,
  formatPlayerPublicId,
  reserveMigratedPlayerPublicId,
} from "./publicIdService.js";

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
    entityType: user.entityType,
    privilegeRole: user.privilegeRole,
    createdAt: user.createdAt,
  };
}

async function loadPlayerState(client, internalId) {
  return findPlayerStateByUserInternalId(client, internalId);
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

function getReservedIdentityDefaults(publicId) {
  const reserved = getReservedIdentityMeta(publicId);
  return {
    entityType: reserved?.entityType ?? "player",
    privilegeRole: reserved?.defaultPrivilegeRole ?? "player",
  };
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
    const reservedDefaults = getReservedIdentityDefaults(publicId);
    const user = await createUser(client, {
      internalId: makeInternalUserId(),
      publicId,
      username: normalizedEmail,
      email: normalizedEmail,
      firstName: normalizedFirstName,
      lastName: normalizedLastName,
      passwordHash,
      entityType: reservedDefaults.entityType,
      privilegeRole: reservedDefaults.privilegeRole,
    });

    await createDefaultPlayerState(client, user.internalId);
    const playerState = await loadPlayerState(client, user.internalId);

    const sessionToken = makeSessionToken();
    const expiresAt = new Date(Date.now() + SESSION_TTL_HOURS * 60 * 60 * 1000);
    await createSession(client, {
      tokenHash: sessionToken.hash,
      userInternalId: user.internalId,
      expiresAt,
    });

    return {
      user: mapApiUser(user),
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
    const playerState = await loadPlayerState(client, authUser.internalId);

    return {
      user: mapApiUser(authUser),
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
  const playerState = await loadPlayerState({ query }, result.user.internalId);

  return {
    user: mapApiUser(result.user),
    playerState,
  };
}
