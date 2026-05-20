import { access, mkdir, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import { withTransaction } from "../db/pool.js";
import { HttpError } from "../lib/errors.js";
import { buildMutableRuntimeState } from "../lib/runtimePlayerState.js";
import { createDefaultPlayerState, findPlayerStateByUserInternalId } from "../repositories/playerStateRepository.js";
import { findUserByPublicId, findUserByInternalId } from "../repositories/usersRepository.js";
import { findOrganizationForUserByType } from "../repositories/organizationRepository.js";
import { resolveTravelForRuntimeState } from "./travelService.js";
import { upsertPlayerRuntimeState } from "../repositories/playerStateRepository.js";
import { resolvePrestigeState, setPrestigeTitle } from "./liveWorldService.js";

const PROFILE_IMAGE_DIR = path.join(process.cwd(), ".data", "profile-images");
const PROFILE_IMAGE_KEY_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._-]*$/;

function asRecord(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : {};
}

function normalizePublicId(publicId) {
  const match = /^P?(\d{7})$/i.exec(String(publicId ?? "").trim());
  if (!match) {
    throw new HttpError(400, "Citizen record unavailable.", "PROFILE_ID_INVALID");
  }
  return Number.parseInt(match[1], 10);
}

function buildLastAction(runtimeState) {
  const currentTravel = asRecord(runtimeState.travel);
  if (currentTravel.status === "in_transit") {
    return { isOnline: false, lastActionAt: currentTravel.departureAt ?? null, label: "Travelling by caravan" };
  }
  return { isOnline: false, lastActionAt: null, label: "Recently active" };
}

function buildTravelSummary(runtimeState) {
  const currentTravel = asRecord(runtimeState.travel);
  if (currentTravel.status === "in_transit") {
    return `Travelling by caravan to ${String(currentTravel.destinationCityId ?? "unknown").toUpperCase()}`;
  }
  return typeof runtimeState.player.current?.currentCityId === "string"
    ? `In ${String(runtimeState.player.current.currentCityId).toUpperCase()}`
    : "In Nexis City";
}

const DAY_MS = 24 * 60 * 60 * 1000;

function formatAccountAge(createdAt) {
  const numericCreatedAt = Number(createdAt);
  if (!Number.isFinite(numericCreatedAt) || numericCreatedAt <= 0) return "Today";
  const daysPlayed = Math.max(0, Math.floor((Date.now() - numericCreatedAt) / DAY_MS));
  if (daysPlayed <= 0) return "Today";
  if (daysPlayed === 1) return "1 day";
  return `${daysPlayed} days`;
}

function sanitizeProfileImageKey(value) {
  return typeof value === "string" && PROFILE_IMAGE_KEY_PATTERN.test(value) ? value : null;
}

function resolveProfileImageUrl(imageKey) {
  const safeKey = sanitizeProfileImageKey(imageKey);
  return safeKey ? `/api/profile-images/${encodeURIComponent(safeKey)}` : null;
}

function readPortrait(runtimeState) {
  const portrait = asRecord(runtimeState.player.portrait);
  const imageKey = sanitizeProfileImageKey(portrait.imageKey);
  return {
    imageUrl: resolveProfileImageUrl(imageKey),
    hasCustomImage: Boolean(imageKey),
  };
}

function detectProfileImageExtension(file) {
  const buffer = file?.buffer;
  if (!Buffer.isBuffer(buffer) || buffer.length < 12) {
    throw new HttpError(400, "Profile image upload is invalid.", "PROFILE_IMAGE_INVALID");
  }

  if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
    return ".jpg";
  }

  if (
    buffer[0] === 0x89 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x4e &&
    buffer[3] === 0x47 &&
    buffer[4] === 0x0d &&
    buffer[5] === 0x0a &&
    buffer[6] === 0x1a &&
    buffer[7] === 0x0a
  ) {
    return ".png";
  }

  if (
    buffer.subarray(0, 4).toString("ascii") === "RIFF" &&
    buffer.subarray(8, 12).toString("ascii") === "WEBP"
  ) {
    return ".webp";
  }

  throw new HttpError(400, "Profile image must be PNG, JPEG, or WEBP.", "PROFILE_IMAGE_TYPE_INVALID");
}

function buildLegacyEntries(runtimeState) {
  const legacy = asRecord(runtimeState.legacy);
  const entries = Array.isArray(legacy.visibleEntries) ? legacy.visibleEntries : [];
  return entries
    .map((entry, index) => {
      const record = asRecord(entry);
      return {
        id: typeof record.id === "string" ? record.id : `legacy_${index + 1}`,
        title: typeof record.title === "string" ? record.title : "Legacy Entry",
        summary: typeof record.summary === "string" ? record.summary : "A remembered Chronicle consequence remains recorded here.",
        kind: typeof record.kind === "string" ? record.kind : "chronicle",
        awardedAt: typeof record.awardedAt === "number" ? record.awardedAt : Date.now(),
      };
    })
    .slice(0, 24);
}

function buildProfileResponse(viewerUser, targetUser, playerState, organizationSummary) {
  const runtimeState = buildMutableRuntimeState(targetUser, playerState);
  resolveTravelForRuntimeState(runtimeState);
  const prestige = resolvePrestigeState(runtimeState);
  const bio = asRecord(runtimeState.player.bio);
  const entityType = targetUser.entityType ?? "player";
  const privilegeRole = targetUser.privilegeRole ?? "player";
  const isSelf = Boolean(viewerUser && viewerUser.internalId === targetUser.internalId);
  const canModerate = Boolean(viewerUser && viewerUser.privilegeRole && viewerUser.privilegeRole !== "player");

  return {
    viewer: {
      mode: isSelf ? "self" : canModerate ? "staff" : "public",
      canModerate,
      isSelf,
    },
    publicProfile: {
      name: `${targetUser.firstName}${targetUser.lastName ? ` ${targetUser.lastName}` : ""}`.trim(),
      publicId: targetUser.publicId,
      title: prestige.currentTitle?.label ?? runtimeState.player.title ?? "",
      prestige,
      entityType,
      level: playerState.level ?? 1,
      rank: typeof runtimeState.player.rank === "string" && runtimeState.player.rank ? runtimeState.player.rank : null,
      ageLabel: formatAccountAge(targetUser.createdAt),
      createdAt: targetUser.createdAt,
      life: {
        current: Number(runtimeState.player.stats?.health ?? 100),
        max: Number(runtimeState.player.stats?.maxHealth ?? 100),
      },
      lastAction: buildLastAction(runtimeState),
      status: {
        label: runtimeState.player.condition?.type === "normal" ? "Available" : String(runtimeState.player.condition?.type ?? "Available"),
        condition: runtimeState.player.condition,
      },
      guild: organizationSummary.guild,
      consortium: organizationSummary.consortium,
      job: typeof runtimeState.player.current?.job === "string" ? runtimeState.player.current.job : null,
      property: {
        propertyId: typeof runtimeState.player.property?.current === "string" ? runtimeState.player.property.current : "shack",
      },
      travel: {
        summary: buildTravelSummary(runtimeState),
      },
      portrait: readPortrait(runtimeState),
      bio: {
        bio: typeof bio.bio === "string" ? bio.bio : null,
        signature: typeof bio.signature === "string" ? bio.signature : null,
        reservedNote: typeof bio.reservedNote === "string" ? bio.reservedNote : null,
      },
      counters: null,
      legacyEntries: buildLegacyEntries(runtimeState),
    },
    selfProfile: isSelf
      ? {
          currencies: runtimeState.player.currencies,
          workingStats: runtimeState.player.workingStats,
          battleStats: runtimeState.player.battleStats,
          inventoryCount: Object.values(runtimeState.player.inventory ?? {}).reduce((sum, value) => sum + Number(value ?? 0), 0),
          inventoryTypes: Object.keys(runtimeState.player.inventory ?? {}).length,
        }
      : null,
    moderation: canModerate
      ? {
          email: targetUser.email,
          internalId: targetUser.internalId,
          entityType,
          privilegeRole,
          reservedIdentityName: null,
        }
      : null,
  };
}

export async function getProfileForViewer(viewerUser, publicIdValue) {
  return withTransaction(async (client) => {
    const publicId = normalizePublicId(publicIdValue);
    const targetUser = await findUserByPublicId(client, publicId);
    if (!targetUser) {
      throw new HttpError(404, "Citizen record unavailable.", "PROFILE_NOT_FOUND");
    }

    await createDefaultPlayerState(client, targetUser.internalId);
    const playerState = await findPlayerStateByUserInternalId(client, targetUser.internalId);
    if (!playerState) {
      throw new HttpError(404, "Citizen record unavailable.", "PROFILE_STATE_NOT_FOUND");
    }

    const viewer = viewerUser?.internalId ? await findUserByInternalId(client, viewerUser.internalId) : null;
    const guild = await findOrganizationForUserByType(client, targetUser.internalId, "guild");
    const consortium = await findOrganizationForUserByType(client, targetUser.internalId, "consortium");

    return buildProfileResponse(viewer, targetUser, playerState, {
      guild: guild ? { publicId: Number(guild.publicId), name: String(guild.name) } : null,
      consortium: consortium ? { publicId: Number(consortium.publicId), name: String(consortium.name) } : null,
    });
  });
}

export async function updateOwnProfileImage(viewerUser, file) {
  if (!viewerUser?.internalId) {
    throw new HttpError(401, "Authentication required.", "AUTH_REQUIRED");
  }

  if (!file) {
    throw new HttpError(400, "Select an image before uploading.", "PROFILE_IMAGE_REQUIRED");
  }

  const extension = detectProfileImageExtension(file);

  const result = await withTransaction(async (client) => {
    const user = await findUserByInternalId(client, viewerUser.internalId);
    if (!user) {
      throw new HttpError(404, "Citizen record unavailable.", "PROFILE_NOT_FOUND");
    }

    await createDefaultPlayerState(client, user.internalId);
    const playerState = await findPlayerStateByUserInternalId(client, user.internalId);
    if (!playerState) {
      throw new HttpError(404, "Citizen record unavailable.", "PROFILE_STATE_NOT_FOUND");
    }

    const runtimeState = buildMutableRuntimeState(user, playerState);
    const previousPortrait = asRecord(runtimeState.player.portrait);
    const previousImageKey = sanitizeProfileImageKey(previousPortrait.imageKey);
    const imageKey = `${user.internalId}-${Date.now()}${extension}`;
    const imagePath = path.join(PROFILE_IMAGE_DIR, imageKey);

    await mkdir(PROFILE_IMAGE_DIR, { recursive: true });
    await writeFile(imagePath, file.buffer);

    runtimeState.player.portrait = {
      imageKey,
      mimeType: file.mimetype,
      updatedAt: Date.now(),
    };

    await upsertPlayerRuntimeState(client, user.internalId, runtimeState);

    return {
      imageKey,
      previousImageKey,
    };
  });

  // Keep prior portrait files in place for now so stale in-flight requests do not
  // 404 during replacement. Cleanup can be handled later with a retention job.
  return {
    imageUrl: resolveProfileImageUrl(result.imageKey),
  };
}

export async function resolveProfileImagePath(imageKey) {
  const safeKey = sanitizeProfileImageKey(imageKey);
  if (!safeKey) {
    throw new HttpError(404, "Profile image not found.", "PROFILE_IMAGE_NOT_FOUND");
  }

  const imagePath = path.join(PROFILE_IMAGE_DIR, safeKey);
  await access(imagePath).catch(() => {
    throw new HttpError(404, "Profile image not found.", "PROFILE_IMAGE_NOT_FOUND");
  });

  return imagePath;
}


export async function updateOwnPrestigeTitle(viewerUser, titleId) {
  if (!viewerUser?.internalId) {
    throw new HttpError(401, "Authentication required.", "AUTH_REQUIRED");
  }

  return withTransaction(async (client) => {
    const user = await findUserByInternalId(client, viewerUser.internalId);
    if (!user) throw new HttpError(404, "Citizen record unavailable.", "PROFILE_NOT_FOUND");
    await createDefaultPlayerState(client, user.internalId);
    const playerState = await findPlayerStateByUserInternalId(client, user.internalId);
    if (!playerState) throw new HttpError(404, "Citizen record unavailable.", "PROFILE_STATE_NOT_FOUND");

    const runtimeState = buildMutableRuntimeState(user, playerState);
    const result = setPrestigeTitle(runtimeState, titleId);
    if (!result.ok) throw new HttpError(409, result.message, "PROFILE_TITLE_LOCKED");
    runtimeState.player.title = result.prestige.currentTitle?.label ?? runtimeState.player.title;
    const nextPlayerState = await upsertPlayerRuntimeState(client, user.internalId, runtimeState);
    return { playerState: nextPlayerState, prestige: result.prestige, message: result.message };
  });
}
