import { withTransaction } from "../db/pool.js";
import { HttpError } from "../lib/errors.js";
import { isStaffOrAdmin } from "../lib/adminAccess.js";
import { buildMutableRuntimeState } from "../lib/runtimePlayerState.js";
import { getReservedIdentityMeta } from "../lib/userIdentity.js";
import { findOrganizationForUserByType } from "../repositories/organizationRepository.js";
import { createDefaultPlayerState, findPlayerStateByUserInternalId } from "../repositories/playerStateRepository.js";
import { findLatestSessionActivityByUserInternalId } from "../repositories/sessionsRepository.js";
import { findUserByPublicId } from "../repositories/usersRepository.js";

function normalizePublicId(value) {
  const text = String(value ?? "").trim().toUpperCase();
  const match = /^P?(\d{7})$/.exec(text);
  if (!match) {
    throw new HttpError(400, "Invalid public profile identifier.", "INVALID_PROFILE_ID");
  }
  return Number.parseInt(match[1], 10);
}

function formatRelativeAge(timestamp) {
  const diffMs = Math.max(0, Date.now() - timestamp);
  const totalDays = Math.max(0, Math.floor(diffMs / 86400000));
  if (totalDays >= 365) {
    const years = Math.floor(totalDays / 365);
    const days = totalDays % 365;
    return days > 0 ? `${years}y ${days}d` : `${years}y`;
  }
  return `${totalDays}d`;
}

function formatLastAction(timestamp) {
  if (!timestamp) return "No recent activity";
  const diffMs = Math.max(0, Date.now() - timestamp);
  const diffMinutes = Math.floor(diffMs / 60000);
  if (diffMinutes < 1) return "just now";
  if (diffMinutes < 60) return `${diffMinutes}m ago`;
  const diffHours = Math.floor(diffMinutes / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  const diffDays = Math.floor(diffHours / 24);
  return `${diffDays}d ago`;
}

function buildTravelSummary(currentTravel) {
  if (typeof currentTravel === "string" && currentTravel.trim()) {
    return currentTravel.trim();
  }
  return "In Nexis City";
}

function buildStatusLabel(runtimePlayer) {
  if (runtimePlayer.condition?.type === "hospitalized") return "Hospitalized";
  if (runtimePlayer.condition?.type === "jailed") return "Jailed";
  if (runtimePlayer.current?.travel) return "Traveling";
  if (runtimePlayer.current?.job) return "Working";
  if (runtimePlayer.current?.education?.name) return "Studying";
  return "Idle";
}

function summarizeOrganization(organization) {
  if (!organization) return null;
  return {
    name: organization.name,
    tag: organization.tag,
    publicId: organization.publicId,
    type: organization.type,
  };
}

function buildBio(runtimePlayer, reservedIdentity) {
  const bio = typeof runtimePlayer.bio === "string" && runtimePlayer.bio.trim() ? runtimePlayer.bio.trim() : null;
  const signature = typeof runtimePlayer.signature === "string" && runtimePlayer.signature.trim() ? runtimePlayer.signature.trim() : null;
  const reservedNote = reservedIdentity?.entityType === "npc" ? `${reservedIdentity.displayName} is a reserved Nexis identity.` : null;
  return {
    bio,
    signature,
    reservedNote,
  };
}

export async function getProfileView(viewerUser, publicIdParam) {
  const publicId = normalizePublicId(publicIdParam);

  return withTransaction(async (client) => {
    const targetUser = await findUserByPublicId(client, publicId);
    if (!targetUser) {
      throw new HttpError(404, "Citizen record unavailable.", "PROFILE_NOT_FOUND");
    }

    await createDefaultPlayerState(client, targetUser.internalId);
    const playerState = await findPlayerStateByUserInternalId(client, targetUser.internalId);
    if (!playerState) {
      throw new HttpError(404, "Citizen record unavailable.", "PROFILE_STATE_NOT_FOUND");
    }

    const runtimeState = buildMutableRuntimeState(targetUser, playerState);
    const runtimePlayer = runtimeState.player;
    const reservedIdentity = getReservedIdentityMeta(targetUser.publicId);
    const guild = await findOrganizationForUserByType(client, targetUser.internalId, "guild");
    const consortium = await findOrganizationForUserByType(client, targetUser.internalId, "consortium");
    const latestSession = await findLatestSessionActivityByUserInternalId(client, targetUser.internalId);

    const isSelf = Boolean(viewerUser && viewerUser.internalId === targetUser.internalId);
    const canModerate = Boolean(viewerUser && isStaffOrAdmin(viewerUser));
    const viewerMode = isSelf ? "self" : canModerate ? "staff" : "public";
    const lastActionAt = latestSession?.lastSeenAt ?? playerState.updatedAt ?? targetUser.createdAt;
    const isOnline = Boolean(latestSession?.lastSeenAt && Date.now() - latestSession.lastSeenAt <= 5 * 60 * 1000);
    const meaningfulRank = typeof runtimePlayer.rank === "string" && runtimePlayer.rank && runtimePlayer.rank !== "0" ? runtimePlayer.rank : null;

    return {
      viewer: {
        mode: viewerMode,
        canModerate,
        isSelf,
      },
      publicProfile: {
        internalId: targetUser.internalId,
        name: `${targetUser.firstName}${targetUser.lastName ? ` ${targetUser.lastName}` : ""}`.trim(),
        publicId: targetUser.publicId,
        title: typeof runtimePlayer.title === "string" ? runtimePlayer.title : "",
        entityType: targetUser.entityType,
        level: Number(playerState.level ?? runtimePlayer.level ?? 1),
        rank: meaningfulRank,
        ageLabel: formatRelativeAge(targetUser.createdAt),
        createdAt: targetUser.createdAt,
        life: {
          current: Number(runtimePlayer.stats?.health ?? 0),
          max: Number(runtimePlayer.stats?.maxHealth ?? 0),
        },
        lastAction: {
          isOnline,
          lastActionAt,
          label: isOnline ? "Online" : formatLastAction(lastActionAt),
        },
        status: {
          label: buildStatusLabel(runtimePlayer),
          condition: runtimePlayer.condition,
        },
        guild: summarizeOrganization(guild),
        consortium: summarizeOrganization(consortium),
        job: runtimePlayer.current?.job ?? null,
        property: {
          propertyId: runtimePlayer.property?.current ?? "shack",
        },
        travel: {
          summary: buildTravelSummary(runtimePlayer.current?.travel),
        },
        bio: buildBio(runtimePlayer, reservedIdentity),
        counters: null,
      },
      selfProfile: isSelf ? {
        currencies: runtimePlayer.currencies,
        workingStats: runtimePlayer.workingStats,
        battleStats: runtimePlayer.battleStats,
        inventoryCount: Object.values(runtimePlayer.inventory ?? {}).reduce((total, value) => total + Number(value ?? 0), 0),
        inventoryTypes: Object.keys(runtimePlayer.inventory ?? {}).length,
      } : null,
      moderation: canModerate ? {
        email: targetUser.email,
        internalId: targetUser.internalId,
        entityType: targetUser.entityType,
        privilegeRole: targetUser.privilegeRole,
        reservedIdentityName: reservedIdentity?.displayName ?? null,
      } : null,
    };
  });
}
