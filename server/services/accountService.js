import bcrypt from "bcryptjs";
import crypto from "node:crypto";
import { PASSWORD_RESET_TTL_MINUTES } from "../config/env.js";
import { NAME_CHANGE_COOLDOWN_DAYS, NAME_CHANGE_GOLD_COST, NAME_MAX_LENGTH, NAME_MIN_LENGTH, NAME_PATTERN } from "../config/accountConfig.js";
import { withTransaction } from "../db/pool.js";
import { HttpError } from "../lib/errors.js";
import { buildMutableRuntimeState } from "../lib/runtimePlayerState.js";
import { createDefaultPlayerState, findPlayerStateByUserInternalId, upsertPlayerRuntimeState } from "../repositories/playerStateRepository.js";
import { deleteSessionsByUserInternalId } from "../repositories/sessionsRepository.js";
import {
  findAuthUserByEmail,
  findUserByInternalId,
  isUniqueViolation,
  updateUserDeactivatedAt,
  updateUserEmail,
  updateUserNameIfCooldownElapsed,
  updateUserPasswordHash,
} from "../repositories/usersRepository.js";
import {
  createEmailChangeToken,
  findEmailChangeTokenByHash,
  invalidateEmailChangeTokensForUser,
  markEmailChangeTokenUsed,
} from "../repositories/emailChangeRepository.js";
import { sendEmailChangeConfirmation } from "./emailService.js";

function asRecord(value) { return value && typeof value === "object" && !Array.isArray(value) ? value : {}; }
function normalizeEmail(email) { return String(email || "").trim().toLowerCase(); }

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function makeChangeToken() {
  const token = crypto.randomBytes(32).toString("hex");
  return { plain: token, hash: crypto.createHash("sha256").update(token).digest("hex") };
}

// Settings page "change my password while logged in". Distinct from
// authService.js's resetPassword (forgot-password token flow) - this one
// requires proving knowledge of the current password, unless the account
// has none (Google-only), in which case this becomes "set a password" for
// the first time rather than "change" one.
export async function changePasswordForUser({ userInternalId, currentPassword, newPassword }) {
  if (String(newPassword || "").length < 6) {
    throw new HttpError(400, "Password must be at least 6 characters.", "PASSWORD_TOO_SHORT");
  }
  return withTransaction(async (client) => {
    const user = await findUserByInternalId(client, userInternalId, { forUpdate: true });
    if (!user) throw new HttpError(404, "Account not found.", "ACCOUNT_NOT_FOUND");

    if (user.passwordHash) {
      if (!String(currentPassword || "")) {
        throw new HttpError(400, "Current password is required.", "CURRENT_PASSWORD_REQUIRED");
      }
      const valid = await bcrypt.compare(currentPassword, user.passwordHash);
      if (!valid) throw new HttpError(401, "Current password is incorrect.", "INVALID_CURRENT_PASSWORD");
    }

    const passwordHash = await bcrypt.hash(newPassword, 10);
    await updateUserPasswordHash(client, userInternalId, passwordHash);
    // Matches resetPassword's precedent: a password change invalidates every
    // existing session, including the one making this request - the caller
    // is expected to log the player out and prompt a fresh login afterward.
    await deleteSessionsByUserInternalId(client, userInternalId);
    return { changed: true, wasSetForFirstTime: !user.passwordHash };
  });
}

// Step 1 of change-email: best-effort collision check, creates a token,
// sends a confirmation link. The real enforcement point is confirmEmailChangeForUser
// (the users.email UNIQUE constraint), not this check - a second account
// could still claim the target address between request and confirm.
export async function requestEmailChangeForUser({ userInternalId, newEmail }) {
  const normalized = normalizeEmail(newEmail);
  if (!normalized || !EMAIL_PATTERN.test(normalized)) {
    throw new HttpError(400, "A valid email address is required.", "EMAIL_INVALID");
  }

  const prepared = await withTransaction(async (client) => {
    const user = await findUserByInternalId(client, userInternalId);
    if (!user) throw new HttpError(404, "Account not found.", "ACCOUNT_NOT_FOUND");
    if (normalized === user.email) {
      throw new HttpError(400, "That is already your current email.", "EMAIL_UNCHANGED");
    }
    const existing = await findAuthUserByEmail(client, normalized);
    if (existing) throw new HttpError(409, "That email is already in use.", "EMAIL_ALREADY_IN_USE");

    const changeToken = makeChangeToken();
    const expiresAt = new Date(Date.now() + PASSWORD_RESET_TTL_MINUTES * 60 * 1000);
    await invalidateEmailChangeTokensForUser(client, userInternalId);
    await createEmailChangeToken(client, { tokenHash: changeToken.hash, userInternalId, newEmail: normalized, expiresAt });
    return { firstName: user.firstName, changeToken: changeToken.plain };
  });

  await sendEmailChangeConfirmation({ email: normalized, firstName: prepared.firstName, confirmToken: prepared.changeToken });
  return { requested: true };
}

// Step 2: the token itself is the credential (same pattern as password
// reset) - can be called from an unauthenticated confirmation page.
export async function confirmEmailChangeForUser({ token }) {
  if (!String(token || "").trim()) {
    throw new HttpError(400, "Confirmation token is required.", "CONFIRM_TOKEN_REQUIRED");
  }
  const tokenHash = crypto.createHash("sha256").update(String(token).trim()).digest("hex");

  return withTransaction(async (client) => {
    const record = await findEmailChangeTokenByHash(client, tokenHash);
    if (!record || record.used_at) {
      throw new HttpError(400, "This email confirmation link is invalid or expired.", "EMAIL_CHANGE_TOKEN_INVALID");
    }

    // Must be caught immediately with nothing else queried in between: a
    // thrown error here poisons the rest of this transaction (withTransaction
    // has no savepoints), so the only safe move is to re-throw right away and
    // let the enclosing ROLLBACK (which always succeeds regardless of
    // transaction state) clean up - never run another query after this catch.
    let updatedUser;
    try {
      updatedUser = await updateUserEmail(client, record.user_internal_id, record.new_email);
    } catch (error) {
      if (isUniqueViolation(error)) throw new HttpError(409, "That email is already in use.", "EMAIL_ALREADY_IN_USE");
      throw error;
    }
    if (!updatedUser) throw new HttpError(404, "Account not found.", "ACCOUNT_NOT_FOUND");

    await markEmailChangeTokenUsed(client, tokenHash);
    await invalidateEmailChangeTokensForUser(client, record.user_internal_id);
    // Deliberately does not kill sessions - unlike a password change, an
    // email change alone shouldn't force every device to log back in.
    return { confirmed: true, email: updatedUser.email };
  });
}

// Cooldown-gated rename with a gold cost. Cooldown is checked via an atomic
// conditional UPDATE first (Ticket A discipline) - only debits gold if that
// succeeds, and the whole thing is one transaction, so a cooldown pass
// followed by insufficient gold rolls back the name change too, not just
// the gold debit.
export async function changeNameForUser(user, { firstName, lastName }) {
  const trimmedFirst = String(firstName || "").trim();
  const trimmedLast = String(lastName || "").trim();
  for (const [label, value] of [["First name", trimmedFirst], ["Last name", trimmedLast]]) {
    if (value.length < NAME_MIN_LENGTH || value.length > NAME_MAX_LENGTH) {
      throw new HttpError(400, `${label} must be ${NAME_MIN_LENGTH}-${NAME_MAX_LENGTH} characters.`, "NAME_LENGTH_INVALID");
    }
    if (!NAME_PATTERN.test(value)) {
      throw new HttpError(400, `${label} may only contain letters, hyphens, spaces, and apostrophes.`, "NAME_CHARSET_INVALID");
    }
  }

  return withTransaction(async (client) => {
    const updatedUser = await updateUserNameIfCooldownElapsed(client, user.internalId, trimmedFirst, trimmedLast, NAME_CHANGE_COOLDOWN_DAYS);
    if (!updatedUser) {
      throw new HttpError(409, `You can only change your name once every ${NAME_CHANGE_COOLDOWN_DAYS} days.`, "NAME_CHANGE_COOLDOWN_ACTIVE");
    }

    await createDefaultPlayerState(client, user.internalId);
    const playerState = await findPlayerStateByUserInternalId(client, user.internalId, { forUpdate: true });
    if (!playerState) throw new HttpError(404, "Player state unavailable.", "PLAYER_STATE_NOT_FOUND");
    const runtimeState = buildMutableRuntimeState(user, playerState);
    const gold = Math.max(0, Math.floor(Number(runtimeState.player.gold ?? 0)));
    if (gold < NAME_CHANGE_GOLD_COST) {
      throw new HttpError(409, `Renaming costs ${NAME_CHANGE_GOLD_COST} gold; you have ${gold}.`, "NAME_CHANGE_GOLD_INSUFFICIENT");
    }
    runtimeState.player.gold = gold - NAME_CHANGE_GOLD_COST;
    runtimeState.player.currencies = { ...asRecord(runtimeState.player.currencies), gold: runtimeState.player.gold };
    const playerStateResult = await upsertPlayerRuntimeState(client, user.internalId, runtimeState);

    return { user: updatedUser, playerState: playerStateResult, goldSpent: NAME_CHANGE_GOLD_COST };
  });
}

// Soft-deactivate only - every FK elsewhere is ON DELETE CASCADE, so a hard
// delete would silently corrupt other players' guild rosters, marketplace
// listings, etc. Accounts with a password must re-enter it as confirmation;
// Google-only accounts have nothing to check here (the frontend requires
// typing a literal confirmation phrase instead - a UX gate, not a security
// boundary, since there's no secondary secret to verify server-side).
export async function closeAccountForUser({ userInternalId, password }) {
  return withTransaction(async (client) => {
    const user = await findUserByInternalId(client, userInternalId, { forUpdate: true });
    if (!user) throw new HttpError(404, "Account not found.", "ACCOUNT_NOT_FOUND");

    if (user.passwordHash) {
      if (!String(password || "")) throw new HttpError(400, "Password confirmation is required.", "PASSWORD_REQUIRED");
      const valid = await bcrypt.compare(password, user.passwordHash);
      if (!valid) throw new HttpError(401, "Password is incorrect.", "INVALID_PASSWORD");
    }

    // Conditional UPDATE is idempotent against a double-submit - a second
    // close-account click while the first is still processing sees zero
    // rows back and is treated as already-done, not an error.
    await updateUserDeactivatedAt(client, userInternalId);
    await deleteSessionsByUserInternalId(client, userInternalId);
    return { closed: true };
  });
}
