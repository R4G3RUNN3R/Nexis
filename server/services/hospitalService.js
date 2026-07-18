import { withTransaction } from "../db/pool.js";
import { HttpError } from "../lib/errors.js";
import { buildMutableRuntimeState } from "../lib/runtimePlayerState.js";
import { createDefaultPlayerState, findPlayerStateByUserInternalId, upsertPlayerRuntimeState } from "../repositories/playerStateRepository.js";

function asRecord(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : {};
}

// Ticket A: hospitalization previously had no server-side implementation
// at all - the client's PlayerContext.hospitalizeFor() mutated only local
// React state persisted to localStorage, so any client could forge, extend,
// shorten, or clear its own hospital status at will, and the server-side
// eligibility gates that assume player.condition is trustworthy (civic/
// labor job requireNotHospitalized checks) were consequently unenforced.
// This is the first real write path for player.condition outside the
// admin "clear condition" action.
//
// Hard ceiling matches the brief this was written against ("hospital
// outcomes should normally range from 1-6 hours... exceptionally reckless
// choices may exceed that only when clearly warned") - 6 hours is the
// normal cap, 24 hours is an absolute safety ceiling no caller can exceed
// regardless of what it computes, so a bug in a future caller's own
// duration math can never produce an effectively-permanent hospitalization.
const NORMAL_MAX_DURATION_MS = 6 * 60 * 60 * 1000;
const ABSOLUTE_MAX_DURATION_MS = 24 * 60 * 60 * 1000;
const MIN_DURATION_MS = 60 * 1000;

async function loadRuntimeStateForUpdate(client, user) {
  await createDefaultPlayerState(client, user.internalId);
  const playerState = await findPlayerStateByUserInternalId(client, user.internalId, { forUpdate: true });
  if (!playerState) throw new HttpError(404, "Player state unavailable.", "PLAYER_STATE_NOT_FOUND");
  return { playerState, runtimeState: buildMutableRuntimeState(user, playerState) };
}

export function getHospitalStatus(runtimeState) {
  const player = asRecord(runtimeState.player);
  const condition = asRecord(player.condition);
  if (condition.type !== "hospitalized") return { hospitalized: false, until: null, reason: null };
  return { hospitalized: true, until: typeof condition.until === "number" ? condition.until : null, reason: condition.reason ?? null };
}

// durationMs must always be computed by the CALLER from server-side game
// data/rules (combat outcome, one-shot outcome table, etc.) - this
// function never reads anything from an HTTP request body, and clamps
// whatever it's given defensively even so, since it is the last line of
// defense before player.condition is written.
//
// If the player is already hospitalized, the new stay EXTENDS the
// existing one (until = max(existing, now + duration)) rather than
// replacing it - a second, lesser consequence landing on an already-
// hospitalized player should never shorten their remaining time.
export async function applyHospitalStay(client, user, { durationMs, reason, allowExceedNormalCap = false }) {
  const requested = Math.floor(Number(durationMs));
  if (!Number.isFinite(requested) || requested <= 0) {
    throw new HttpError(500, "Invalid hospital duration.", "HOSPITAL_DURATION_INVALID");
  }
  const cap = allowExceedNormalCap ? ABSOLUTE_MAX_DURATION_MS : NORMAL_MAX_DURATION_MS;
  const clamped = Math.min(cap, Math.max(MIN_DURATION_MS, requested));

  const { runtimeState } = await loadRuntimeStateForUpdate(client, user);
  const player = asRecord(runtimeState.player);
  const now = Date.now();
  const existing = asRecord(player.condition);
  const existingUntil = existing.type === "hospitalized" && typeof existing.until === "number" ? existing.until : 0;
  const until = Math.max(existingUntil, now + clamped);

  player.condition = { type: "hospitalized", until, reason: typeof reason === "string" && reason.trim() ? reason.trim().slice(0, 200) : "Hospitalized." };
  runtimeState.player = player;

  const playerState = await upsertPlayerRuntimeState(client, user.internalId, runtimeState);
  return { playerState, runtimeState, hospital: getHospitalStatus(runtimeState) };
}

// Convenience wrapper for callers that don't already have an open
// transaction/client - mirrors the get*ForUser shape used across the
// codebase (e.g. getPvpHubForUser).
export async function applyHospitalStayForUser(user, options) {
  return withTransaction((client) => applyHospitalStay(client, user, options));
}
