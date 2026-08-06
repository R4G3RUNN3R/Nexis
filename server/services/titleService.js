import { withTransaction } from "../db/pool.js";
import { HttpError } from "../lib/errors.js";
import { buildMutableRuntimeState } from "../lib/runtimePlayerState.js";
import {
  createDefaultPlayerState,
  findPlayerStateByUserInternalId,
  upsertPlayerRuntimeState,
} from "../repositories/playerStateRepository.js";
import { findUserByInternalId, findUserByPublicId } from "../repositories/usersRepository.js";
import { LEGACY_ACHIEVEMENTS } from "../data/legacyAchievementsData.js";
import {
  ABSOLUTE_TITLE_ID,
  TITLE_DEFINITIONS,
  describeTitleEffects,
  getTitleDefinition,
  isTitleVisibleToUser,
  normalizeTitlesState,
} from "../data/titlesData.js";
import { ABSOLUTE_OWNER_PUBLIC_ID } from "../lib/adminAccess.js";
import { evaluateLegacyAchievementsForRuntime } from "./achievementService.js";
import { addPlayerRecord } from "./playerRecordsService.js";

function asRecord(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : {};
}

function asNumber(value, fallback = 0) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : fallback;
}

function getCompletedAcademyCount(runtimeState) {
  // Mirrors the exact computation server/services/liveWorldService.js already
  // uses for its "academy-graduate" prestige title (Object.keys(...completed).length),
  // so "how many academies has this player finished" stays defined in one
  // consistent way across both title systems.
  return Object.keys(asRecord(asRecord(asRecord(runtimeState.player).cityAcademy).completed)).length;
}

function isAchievementAwarded(runtimeState, achievementId) {
  const awarded = asRecord(asRecord(asRecord(runtimeState.legacy).achievements).awarded);
  return Boolean(awarded[achievementId]);
}

function isUnlockConditionMet(unlock, runtimeState) {
  const player = asRecord(runtimeState.player);
  const counters = asRecord(player.counters);

  switch (unlock?.type) {
    case "achievement":
      return isAchievementAwarded(runtimeState, unlock.achievementId);
    case "counter":
      return asNumber(counters[unlock.key], 0) >= asNumber(unlock.threshold, Infinity);
    case "academyCount":
      return getCompletedAcademyCount(runtimeState) >= asNumber(unlock.threshold, Infinity);
    case "allAchievements": {
      const awarded = asRecord(asRecord(asRecord(runtimeState.legacy).achievements).awarded);
      return Object.keys(awarded).length >= LEGACY_ACHIEVEMENTS.length;
    }
    case "exclusiveGrant":
    default:
      // Exclusive titles (The Absolute) are never organically "unlocked" -
      // they only ever enter grantedTitleIds via the narrow grant function
      // below, which isTitleEarned checks first.
      return false;
  }
}

export function isTitleEarned(title, runtimeState, titlesState) {
  if (titlesState.grantedTitleIds.includes(title.id)) return true;
  return isUnlockConditionMet(title.unlock, runtimeState);
}

function serializeTitleCatalog(runtimeState, user, titlesState) {
  // A title is included only if it is visible to this account at all (the
  // exclusivity/allowlist check - this is what keeps The Absolute out of
  // every other player's list) and, separately, is not flagged hidden for
  // anyone who isn't its owner.
  return TITLE_DEFINITIONS.filter((title) => isTitleVisibleToUser(title, user?.publicId))
    .filter((title) => !title.hidden || title.exclusiveToPublicId === user?.publicId)
    .map((title) => ({
      id: title.id,
      name: title.name,
      kind: title.kind,
      description: title.description,
      flavor: title.flavor,
      effects: describeTitleEffects(title),
      earned: isTitleEarned(title, runtimeState, titlesState),
      equipped: titlesState.equippedTitleId === title.id,
    }));
}

async function loadOwnRuntime(client, viewerUser) {
  if (!viewerUser?.internalId) {
    throw new HttpError(401, "Authentication required.", "AUTH_REQUIRED");
  }
  const user = await findUserByInternalId(client, viewerUser.internalId);
  if (!user) throw new HttpError(404, "Citizen record unavailable.", "PROFILE_NOT_FOUND");
  await createDefaultPlayerState(client, user.internalId);
  const playerState = await findPlayerStateByUserInternalId(client, user.internalId);
  if (!playerState) throw new HttpError(404, "Citizen record unavailable.", "PROFILE_STATE_NOT_FOUND");
  const runtimeState = buildMutableRuntimeState(user, playerState);
  return { user, playerState, runtimeState };
}

export async function getTitlesForUser(viewerUser) {
  return withTransaction(async (client) => {
    const { user, runtimeState } = await loadOwnRuntime(client, viewerUser);
    evaluateLegacyAchievementsForRuntime(runtimeState, user);
    const titlesState = normalizeTitlesState(runtimeState.player.titles);
    const nextPlayerState = await upsertPlayerRuntimeState(client, user.internalId, runtimeState);
    return {
      playerState: nextPlayerState,
      titles: serializeTitleCatalog(runtimeState, user, titlesState),
      equippedTitle: runtimeState.player.equippedTitle,
    };
  });
}

export async function equipTitleForUser(viewerUser, titleId) {
  const id = String(titleId ?? "").trim();
  if (!id) throw new HttpError(400, "A title ID is required.", "TITLE_ID_REQUIRED");

  return withTransaction(async (client) => {
    const { user, runtimeState } = await loadOwnRuntime(client, viewerUser);
    evaluateLegacyAchievementsForRuntime(runtimeState, user);

    const title = getTitleDefinition(id);
    if (!title) throw new HttpError(404, "Unknown title.", "TITLE_NOT_FOUND");

    // Server-side spoofing guard: no forged request can equip an
    // exclusive title (The Absolute) on any account other than the one
    // it is locked to, regardless of what titleId the client sends.
    if (!isTitleVisibleToUser(title, user.publicId)) {
      throw new HttpError(403, "That title is not available on this account.", "TITLE_EXCLUSIVE_FORBIDDEN");
    }

    const titlesState = normalizeTitlesState(runtimeState.player.titles);
    if (!isTitleEarned(title, runtimeState, titlesState)) {
      throw new HttpError(409, "That title has not been earned yet.", "TITLE_NOT_EARNED");
    }

    runtimeState.player.titles = { ...titlesState, equippedTitleId: title.id };
    addPlayerRecord(runtimeState, {
      category: "progression",
      summary: `Title equipped: ${title.name}.`,
      detail: { titleId: title.id, kind: title.kind },
      source: "titles",
      route: "/profile",
    });

    const nextPlayerState = await upsertPlayerRuntimeState(client, user.internalId, runtimeState);
    const nextRuntimeState = buildMutableRuntimeState(user, nextPlayerState);
    const nextTitlesState = normalizeTitlesState(nextRuntimeState.player.titles);
    return {
      playerState: nextPlayerState,
      titles: serializeTitleCatalog(nextRuntimeState, user, nextTitlesState),
      equippedTitle: nextRuntimeState.player.equippedTitle,
      message: `Title set to ${title.name}.`,
    };
  });
}

export async function unequipTitleForUser(viewerUser) {
  return withTransaction(async (client) => {
    const { user, runtimeState } = await loadOwnRuntime(client, viewerUser);
    evaluateLegacyAchievementsForRuntime(runtimeState, user);

    const titlesState = normalizeTitlesState(runtimeState.player.titles);
    runtimeState.player.titles = { ...titlesState, equippedTitleId: null };
    addPlayerRecord(runtimeState, {
      category: "progression",
      summary: "Title unequipped.",
      source: "titles",
      route: "/profile",
    });

    const nextPlayerState = await upsertPlayerRuntimeState(client, user.internalId, runtimeState);
    const nextRuntimeState = buildMutableRuntimeState(user, nextPlayerState);
    const nextTitlesState = normalizeTitlesState(nextRuntimeState.player.titles);
    return {
      playerState: nextPlayerState,
      titles: serializeTitleCatalog(nextRuntimeState, user, nextTitlesState),
      equippedTitle: nextRuntimeState.player.equippedTitle,
      message: "Title cleared.",
    };
  });
}

// Narrow, explicit, logged grant mechanism for The Absolute. Deliberately
// takes NO target parameter - it can only ever look up and grant the one
// allowlisted account (public ID 1,000,000 / ABSOLUTE_OWNER_PUBLIC_ID,
// "Hennet Uthellien" per server/lib/userIdentity.js). There is no code path
// from here to any other account, so this cannot be reused as a general
// "grant a title" tool even by an administrator.
export async function grantAbsoluteTitleToAllowlistedAccount({ actor = "manual-seed" } = {}) {
  return withTransaction(async (client) => {
    const user = await findUserByPublicId(client, ABSOLUTE_OWNER_PUBLIC_ID);
    if (!user) {
      throw new HttpError(
        404,
        `No account exists with public ID ${ABSOLUTE_OWNER_PUBLIC_ID}. The Absolute was not granted.`,
        "ABSOLUTE_TARGET_NOT_FOUND",
      );
    }
    // Defense in depth: even though findUserByPublicId was called with the
    // constant itself, re-assert it on the returned row before granting.
    if (user.publicId !== ABSOLUTE_OWNER_PUBLIC_ID) {
      throw new HttpError(403, "Refusing to grant The Absolute outside the allowlisted account.", "ABSOLUTE_GRANT_FORBIDDEN");
    }

    await createDefaultPlayerState(client, user.internalId);
    const playerState = await findPlayerStateByUserInternalId(client, user.internalId);
    const runtimeState = buildMutableRuntimeState(user, playerState);
    const titlesState = normalizeTitlesState(runtimeState.player.titles);

    if (titlesState.grantedTitleIds.includes(ABSOLUTE_TITLE_ID)) {
      return { alreadyGranted: true, publicId: user.publicId, internalId: user.internalId };
    }

    const now = Date.now();
    runtimeState.player.titles = {
      ...titlesState,
      grantedTitleIds: [...titlesState.grantedTitleIds, ABSOLUTE_TITLE_ID],
      grantLog: [...titlesState.grantLog, { titleId: ABSOLUTE_TITLE_ID, grantedAt: now, actor }],
    };
    addPlayerRecord(runtimeState, {
      category: "admin",
      summary: "The Absolute granted via the one-off allowlisted seed action.",
      detail: { titleId: ABSOLUTE_TITLE_ID, actor, publicId: user.publicId },
      source: "title-seed",
      route: "/profile",
      timestamp: now,
    });

    await upsertPlayerRuntimeState(client, user.internalId, runtimeState);

    // eslint-disable-next-line no-console
    console.log(
      `[titles] Granted "${ABSOLUTE_TITLE_ID}" to publicId=${user.publicId} internalId=${user.internalId} actor=${actor} at=${new Date(now).toISOString()}`,
    );

    return { alreadyGranted: false, publicId: user.publicId, internalId: user.internalId, grantedAt: now };
  });
}
