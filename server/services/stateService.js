import { withTransaction } from "../db/pool.js";
import {
  createDefaultPlayerState,
  findPlayerStateByUserInternalId,
  upsertPlayerRuntimeState,
} from "../repositories/playerStateRepository.js";
import { HttpError } from "../lib/errors.js";
import { findUserByInternalId } from "../repositories/usersRepository.js";
import { buildMutableRuntimeState } from "../lib/runtimePlayerState.js";

function asRecord(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : null;
}

// These two sets are DIAGNOSTIC ONLY - they feed the console.warn in
// collectBlockedClientFields below and enforce nothing by themselves. The
// real security boundary is buildAllowedClientPatch(): it builds `patch`
// field-by-field from a fixed allowlist (currently bio/preferences/ui only),
// so anything absent from these sets is *already* excluded from the merge,
// not "unblocked". Do not add a new sensitive field here expecting it to be
// protected - protection means keeping it out of buildAllowedClientPatch,
// full stop. (Ticket 5 audit, 2026-07-18: this ambiguity was flagged as a
// maintainability trap, not an active vulnerability - buildAllowedClientPatch
// was independently confirmed to allowlist correctly.)
const DIAGNOSTIC_BLOCKED_TOP_LEVEL_FIELDS = new Set([
  "jobs",
  "education",
  "arena",
  "timers",
  "guild",
  "consortium",
  "travel",
  "civicEmployment",
  "legacy",
]);

const DIAGNOSTIC_BLOCKED_PLAYER_FIELDS = new Set([
  "gold",
  "currencies",
  "experience",
  "level",
  "rank",
  "stats",
  "workingStats",
  "battleStats",
  "inventory",
  "equipment",
  "visualEquipment",
  "equipmentMaintenance",
  "equipmentLoadouts",
  "crafting",
  "itemBuffs",
  "itemEnhancements",
  "property",
  "current",
  "condition",
  "lifePath",
  "cityContracts",
  "cityAcademy",
  "cityStanding",
  "citySpecials",
  "skills",
  "arenaCombat",
  "duels",
  "worldLoops",
  "notifications",
  "worldDiscovery",
  "worldEvents",
  "prestige",
  "shadow",
  "progressionEvents",
  "records",
  "rareManualEligibility",
  "dmosOneShots",
  "pvpProfile",
  "qualities",
  "worldEventProfile",
]);

function sanitizePlainText(value, maxLength = 600) {
  if (typeof value !== "string") return null;
  return value.replace(/[\u0000-\u001f\u007f]/g, "").trim().slice(0, maxLength);
}

function sanitizeStringRecord(value, allowedKeys, maxLength = 600) {
  const record = asRecord(value) ?? {};
  return Object.fromEntries(
    allowedKeys
      .map((key) => [key, sanitizePlainText(record[key], maxLength)])
      .filter(([, entry]) => entry !== null),
  );
}

const CIEL_TUTORIAL_STRING_FIELDS = [
  "introSeenAt",
  "introCompletedAt",
  "skippedAt",
  "spotlightCompletedAt",
  "spotlightSkippedAt",
  "lastStepId",
];
const CIEL_TUTORIAL_STEPS = new Set(["identity", "orders", "activity", "quick-actions", "readiness", "ciel-feed", "records"]);

function sanitizeCielTutorial(value) {
  const record = asRecord(value);
  if (!record) return null;

  const tutorial = { version: 1 };
  for (const key of CIEL_TUTORIAL_STRING_FIELDS) {
    const cleaned = sanitizePlainText(record[key], 80);
    if (cleaned) tutorial[key] = cleaned;
  }

  if (record.spotlightPending === "true" || record.spotlightPending === "false") {
    tutorial.spotlightPending = record.spotlightPending;
  }

  if (Array.isArray(record.completedStepIds)) {
    tutorial.completedStepIds = record.completedStepIds
      .filter((entry) => typeof entry === "string" && CIEL_TUTORIAL_STEPS.has(entry))
      .slice(0, 12);
  }

  return tutorial;
}

function collectBlockedClientFields(payload) {
  const blocked = [];
  for (const key of Object.keys(payload)) {
    if (DIAGNOSTIC_BLOCKED_TOP_LEVEL_FIELDS.has(key)) blocked.push(key);
  }

  const player = asRecord(payload.player) ?? {};
  for (const key of Object.keys(player)) {
    if (DIAGNOSTIC_BLOCKED_PLAYER_FIELDS.has(key)) blocked.push(`player.${key}`);
  }

  return blocked;
}

function buildAllowedClientPatch(payload) {
  const payloadPlayer = asRecord(payload.player) ?? {};
  const patch = {};

  if (Object.prototype.hasOwnProperty.call(payloadPlayer, "bio")) {
    const bio = sanitizeStringRecord(payloadPlayer.bio, ["bio", "signature", "reservedNote"], 500);
    if (Object.keys(bio).length) patch.bio = bio;
  }

  if (Object.prototype.hasOwnProperty.call(payloadPlayer, "preferences")) {
    const preferences = sanitizeStringRecord(payloadPlayer.preferences, ["compactMode", "reducedMotion", "lastHelpTopic"], 80);
    if (Object.keys(preferences).length) patch.preferences = preferences;
  }

  if (Object.prototype.hasOwnProperty.call(payloadPlayer, "ui")) {
    const payloadUi = asRecord(payloadPlayer.ui) ?? {};
    const ui = sanitizeStringRecord(payloadUi, ["dismissedGuideAt", "lastCommandBriefAt"], 80);
    if (Object.prototype.hasOwnProperty.call(payloadUi, "cielTutorial")) {
      const tutorial = sanitizeCielTutorial(payloadUi.cielTutorial);
      if (tutorial) {
        ui.cielTutorial = tutorial;
      }
    }
    if (Object.keys(ui).length) patch.ui = ui;
  }

  return patch;
}

function mergeRuntimeState(existingRuntime, payload) {
  const existingPlayer = asRecord(existingRuntime.player) ?? {};
  const allowedPlayerPatch = buildAllowedClientPatch(payload);
  const nextPlayer = {
    ...existingPlayer,
    ...allowedPlayerPatch,
  };

  if (allowedPlayerPatch.ui) {
    nextPlayer.ui = {
      ...(asRecord(existingPlayer.ui) ?? {}),
      ...allowedPlayerPatch.ui,
    };
  }

  return {
    ...existingRuntime,
    player: nextPlayer,
  };
}

export async function syncRuntimeState(userInternalId, runtimeState) {
  const payload = asRecord(runtimeState);
  if (!payload) {
    throw new HttpError(400, "Runtime state payload is required.", "RUNTIME_STATE_REQUIRED");
  }

  return withTransaction(async (client) => {
    await createDefaultPlayerState(client, userInternalId);
    const user = await findUserByInternalId(client, userInternalId);
    const existingPlayerState = await findPlayerStateByUserInternalId(client, userInternalId);
    const existingRuntime = user && existingPlayerState
      ? buildMutableRuntimeState(user, existingPlayerState)
      : {};

    const blockedFields = collectBlockedClientFields(payload);
    if (blockedFields.length) {
      console.warn("[state-sync] rejected client-owned fields", {
        userInternalId,
        fields: blockedFields.slice(0, 30),
        extraCount: Math.max(0, blockedFields.length - 30),
      });
    }

    const mergedPayload = mergeRuntimeState(existingRuntime, payload);
    return upsertPlayerRuntimeState(client, userInternalId, mergedPayload);
  });
}
