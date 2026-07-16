import { withTransaction } from "../db/pool.js";
import { HttpError } from "../lib/errors.js";
import { buildMutableRuntimeState } from "../lib/runtimePlayerState.js";
import { createDefaultPlayerState, findPlayerStateByUserInternalId, upsertPlayerRuntimeState } from "../repositories/playerStateRepository.js";
import { CITY_DIARIES, QUALITY_DEFINITIONS, WORLD_EVENT_TEMPLATES } from "../data/worldProgressionData.js";

function asRecord(value) { return value && typeof value === "object" && !Array.isArray(value) ? value : {}; }
function asArray(value) { return Array.isArray(value) ? value : []; }

async function loadRuntimeState(client, user) {
  await createDefaultPlayerState(client, user.internalId);
  const playerState = await findPlayerStateByUserInternalId(client, user.internalId);
  if (!playerState) throw new HttpError(404, "Player state unavailable.", "PLAYER_STATE_NOT_FOUND");
  return { playerState, runtimeState: buildMutableRuntimeState(user, playerState) };
}

export function ensureWorldProgressionState(runtimeState) {
  const player = asRecord(runtimeState.player);
  const diaries = asRecord(player.cityDiaries);
  const qualities = asRecord(player.qualities);
  const eventProfile = asRecord(player.worldEventProfile);
  player.cityDiaries = {
    completedTaskIds: Array.from(new Set(asArray(diaries.completedTaskIds).filter((entry) => typeof entry === "string"))),
    claimedTierIds: Array.from(new Set(asArray(diaries.claimedTierIds).filter((entry) => typeof entry === "string"))),
    lastUpdatedAt: typeof diaries.lastUpdatedAt === "number" ? diaries.lastUpdatedAt : null,
  };
  player.qualities = {
    earned: Array.from(new Set(asArray(qualities.earned).filter((entry) => typeof entry === "string"))),
    lastUpdatedAt: typeof qualities.lastUpdatedAt === "number" ? qualities.lastUpdatedAt : null,
  };
  player.worldEventProfile = {
    seenEventIds: Array.from(new Set(asArray(eventProfile.seenEventIds).filter((entry) => typeof entry === "string"))),
    completedEventIds: Array.from(new Set(asArray(eventProfile.completedEventIds).filter((entry) => typeof entry === "string"))),
    lastUpdatedAt: typeof eventProfile.lastUpdatedAt === "number" ? eventProfile.lastUpdatedAt : null,
  };
  runtimeState.player = player;
  return { cityDiaries: player.cityDiaries, qualities: player.qualities, worldEventProfile: player.worldEventProfile };
}

function summarizeDiary(diary, progress) {
  const claimed = new Set(progress.claimedTierIds);
  const completedTasks = new Set(progress.completedTaskIds);
  return {
    ...diary,
    tiers: diary.tiers.map((tier) => ({
      ...tier,
      completedTaskCount: tier.tasks.filter((task) => completedTasks.has(`${tier.id}:${task}`)).length,
      taskCount: tier.tasks.length,
      claimed: claimed.has(tier.id),
    })),
  };
}

export async function getWorldProgressionForUser(user) {
  return withTransaction(async (client) => {
    const { playerState, runtimeState } = await loadRuntimeState(client, user);
    const progress = ensureWorldProgressionState(runtimeState);
    await upsertPlayerRuntimeState(client, user.internalId, runtimeState);
    return {
      playerState,
      cityDiaries: CITY_DIARIES.map((diary) => summarizeDiary(diary, progress.cityDiaries)),
      qualities: QUALITY_DEFINITIONS.map((quality) => ({ ...quality, earned: progress.qualities.earned.includes(quality.id) })),
      worldEvents: WORLD_EVENT_TEMPLATES.map((event) => ({
        ...event,
        seen: progress.worldEventProfile.seenEventIds.includes(event.id),
        completed: progress.worldEventProfile.completedEventIds.includes(event.id),
      })),
      progress,
    };
  });
}
