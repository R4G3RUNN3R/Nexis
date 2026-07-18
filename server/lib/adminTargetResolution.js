import { HttpError } from "./errors.js";
import { findUserByPublicId } from "../repositories/usersRepository.js";

// Admin hotfix: canonical target-resolution contract for the Admin Panel.
//
// Root cause this closes: AdminInlineControls.tsx's quick-action buttons
// (Fill/Set/Reduce, rendered next to gameplay bars like Energy) submitted
// player.internalId as the admin-action target - but PlayerContext.tsx
// populates player.internalId from activeAccount.internalPlayerId, which
// authService.js's mapPublicApiUser() deliberately sets to a synthetic
// "plr_<publicId>" placeholder at login/register time, never the real
// database internal_id. The backend correctly (from its own narrow view)
// found no user row for that placeholder and returned "Target player not
// found." for every admin's own quick actions.
//
// Fix: the browser only ever submits the public player ID (already
// legitimately known to the client, already displayed everywhere in the
// UI as "P1234567") - never any form of "internal ID". The server resolves
// that public ID to the authoritative internal ID itself, on every
// request, from the database - never trusting a client-submitted value as
// if it already were the internal ID.

const PUBLIC_ID_PATTERN = /^P?(\d{7})$/i;

// Accepts "P1000000", "1000000", or a bare number - the same shapes
// already used by searchUsers()'s exact-match branch and profile routes.
export function normalizeAdminTargetPublicId(rawValue) {
  const raw = String(rawValue ?? "").trim();
  if (!raw) {
    throw new HttpError(400, "Target player ID is required.", "ADMIN_TARGET_REQUIRED");
  }
  const match = PUBLIC_ID_PATTERN.exec(raw);
  if (!match) {
    throw new HttpError(400, "Target player ID is malformed.", "ADMIN_TARGET_INVALID");
  }
  return Number.parseInt(match[1], 10);
}

// The one place that turns a client-submitted public ID into an
// authoritative user row. Every admin mutation that targets a specific
// player (resource stats, token grants, and any future action) must route
// through this, not hand-roll another lookup.
export async function resolveAdminTargetUser(client, rawTargetPublicId) {
  const publicId = normalizeAdminTargetPublicId(rawTargetPublicId);
  const user = await findUserByPublicId(client, publicId);
  if (!user) {
    throw new HttpError(404, "Target player not found.", "TARGET_NOT_FOUND");
  }
  return user;
}
