import { withTransaction } from "../db/pool.js";
import { assertAdministrator } from "../lib/adminAccess.js";
import { HttpError } from "../lib/errors.js";
import { buildMutableRuntimeState } from "../lib/runtimePlayerState.js";
import { insertAdminAuditLog } from "../repositories/adminAuditRepository.js";
import {
  findOrganizationByPublicId,
  insertOrganizationLog,
  updateOrganizationMemberRole,
} from "../repositories/organizationRepository.js";
import {
  createDefaultPlayerState,
  findPlayerStateByUserInternalId,
  upsertPlayerRuntimeState,
} from "../repositories/playerStateRepository.js";
import { findUserByInternalId, findUserByPublicId } from "../repositories/usersRepository.js";
import { runOrganizationBaseLifecycleSweep } from "./organizationBaseSafetyService.js";
import { getOrganizationBaseOwnershipByPublicIdForAdmin } from "./organizationBaseOwnershipService.js";

const asRecord = (value) => (value && typeof value === "object" && !Array.isArray(value) ? value : {});
const asInt = (value, fallback = 0) => {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return fallback;
  return Math.max(0, Math.floor(numeric));
};

function normalizeOrganizationPublicId(value) {
  const raw = String(value ?? "").trim();
  const match = raw.match(/^[GC]?(\d+)$/i);
  if (!match) {
    throw new HttpError(400, "Organization public ID is invalid.", "ORG_PUBLIC_ID_INVALID");
  }
  return Number(match[1]);
}

function normalizePlayerPublicId(value) {
  const raw = String(value ?? "").trim();
  const match = raw.match(/^P?(\d{7})$/i);
  if (!match) {
    throw new HttpError(400, "A valid player public ID is required.", "PLAYER_ID_REQUIRED");
  }
  return Number.parseInt(match[1], 10);
}

function requireReason(reason) {
  const normalized = String(reason ?? "").trim();
  if (normalized.length < 3) {
    throw new HttpError(400, "A short reason is required.", "ADMIN_REASON_REQUIRED");
  }
  return normalized;
}

async function resolveActor(client, actorUser) {
  const internalId =
    typeof actorUser?.internalId === "string" && actorUser.internalId
      ? actorUser.internalId
      : typeof actorUser?.internalPlayerId === "string" && actorUser.internalPlayerId
        ? actorUser.internalPlayerId
        : null;

  let actor = internalId ? await findUserByInternalId(client, internalId) : null;
  if (!actor && typeof actorUser?.publicId === "number") {
    actor = await findUserByPublicId(client, actorUser.publicId);
  }
  if (!actor) {
    throw new HttpError(400, "Administrator identity is unavailable.", "ADMIN_IDENTITY_MISSING");
  }
  return actor;
}

function getLeaderRoleKey(organization) {
  return organization.type === "guild" ? "guildmaster" : "director";
}

function getFallbackRoleKey(organization) {
  if (organization.type === "guild") {
    if (organization.roles.some((entry) => entry.roleKey === "officer")) return "officer";
    if (organization.roles.some((entry) => entry.roleKey === "member")) return "member";
  } else {
    if (organization.roles.some((entry) => entry.roleKey === "specialist")) return "specialist";
    if (organization.roles.some((entry) => entry.roleKey === "employee")) return "employee";
  }

  const leaderRoleKey = getLeaderRoleKey(organization);
  const fallback = organization.roles.find((entry) => entry.roleKey !== leaderRoleKey);
  return fallback?.roleKey ?? leaderRoleKey;
}

async function updateMembershipSnapshot(client, user, organization, roleKey) {
  await createDefaultPlayerState(client, user.internalId);
  const state = await findPlayerStateByUserInternalId(client, user.internalId);
  if (!state) return;

  const runtime = buildMutableRuntimeState(user, state);
  if (organization.type === "guild") {
    runtime.guild = {
      membership: {
        organizationInternalId: organization.internalId,
        publicId: organization.publicId,
        name: organization.name,
        tag: organization.tag,
        roleKey,
        statusText: organization.statusText,
      },
    };
  } else {
    const membership = asRecord(runtime.consortium.membership);
    runtime.consortium = {
      ...asRecord(runtime.consortium),
      membership: {
        organizationInternalId: organization.internalId,
        publicId: organization.publicId,
        name: organization.name,
        consortiumTypeKey: organization.consortiumTypeKey ?? membership.consortiumTypeKey ?? null,
        consortiumTypeName: organization.consortiumTypeName ?? membership.consortiumTypeName ?? null,
        roleKey,
        starRating: asInt(membership.starRating),
        treasury: asRecord(organization.treasury),
      },
    };
  }

  await upsertPlayerRuntimeState(client, user.internalId, runtime);
}

export async function reassignOrganizationLeadershipByAdmin(actorUser, payload = {}) {
  assertAdministrator(actorUser);
  const reason = requireReason(payload.reason);

  return withTransaction(async (client) => {
    const actor = await resolveActor(client, actorUser);
    const organizationPublicId = normalizeOrganizationPublicId(payload.organizationPublicId);
    const nextLeaderPublicId = normalizePlayerPublicId(payload.nextLeaderPublicId);

    const organization = await findOrganizationByPublicId(client, organizationPublicId);
    if (!organization) {
      throw new HttpError(404, "Organization not found.", "ORG_NOT_FOUND");
    }

    const nextLeader = organization.members.find((entry) => entry.publicId === nextLeaderPublicId);
    if (!nextLeader) {
      throw new HttpError(404, "Target member is not part of this organization.", "ORG_MEMBER_NOT_FOUND");
    }

    const leaderRoleKey = getLeaderRoleKey(organization);
    const fallbackRoleKey = getFallbackRoleKey(organization);
    const currentLeader = organization.members.find((entry) => entry.roleKey === leaderRoleKey) ?? null;

    if (nextLeader.roleKey === leaderRoleKey) {
      return {
        ok: true,
        organizationPublicId: organization.publicId,
        message: "Target member already holds leadership role.",
      };
    }

    if (currentLeader) {
      await updateOrganizationMemberRole(client, organization.internalId, currentLeader.userInternalId, fallbackRoleKey);
    }
    await updateOrganizationMemberRole(client, organization.internalId, nextLeader.userInternalId, leaderRoleKey);

    const updatedOrganization = await findOrganizationByPublicId(client, organizationPublicId);
    const nextLeaderUser = await findUserByPublicId(client, nextLeaderPublicId);
    const previousLeaderUser = currentLeader ? await findUserByPublicId(client, currentLeader.publicId) : null;

    if (nextLeaderUser && updatedOrganization) {
      await updateMembershipSnapshot(client, nextLeaderUser, updatedOrganization, leaderRoleKey);
    }
    if (previousLeaderUser && updatedOrganization) {
      await updateMembershipSnapshot(client, previousLeaderUser, updatedOrganization, fallbackRoleKey);
    }

    await insertOrganizationLog(client, organization.internalId, {
      actorInternalId: actor.internalId,
      actorPublicId: actor.publicId,
      actionType: "leadership_reassigned_admin",
      summary: {
        reason,
        previousLeaderPublicId: currentLeader?.publicId ?? null,
        nextLeaderPublicId,
        leaderRoleKey,
        fallbackRoleKey,
      },
    });

    if (nextLeaderUser) {
      await insertAdminAuditLog(client, {
        actor,
        target: nextLeaderUser,
        actionType: "reassignOrganizationLeadership",
        reason,
        beforeSummary: {
          organizationPublicId: organization.publicId,
          previousLeaderPublicId: currentLeader?.publicId ?? null,
          previousRole: nextLeader.roleKey,
        },
        afterSummary: {
          organizationPublicId: organization.publicId,
          nextLeaderPublicId,
          assignedRole: leaderRoleKey,
        },
      });
    }

    return {
      ok: true,
      organizationPublicId: organization.publicId,
      organizationType: organization.type,
      previousLeaderPublicId: currentLeader?.publicId ?? null,
      nextLeaderPublicId,
      leaderRoleKey,
      fallbackRoleKey,
      reason,
    };
  });
}

export async function triggerOrganizationBaseSweepByAdmin(actorUser) {
  assertAdministrator(actorUser);

  const actor = await withTransaction(async (client) => resolveActor(client, actorUser));
  const result = await runOrganizationBaseLifecycleSweep({ actorInternalId: actor.internalId });
  return {
    ok: true,
    actorPublicId: actor.publicId,
    ...result,
  };
}


export async function getAdminOrganizationBaseState(actorUser, organizationPublicId) {
  assertAdministrator(actorUser);
  return getOrganizationBaseOwnershipByPublicIdForAdmin(organizationPublicId);
}
