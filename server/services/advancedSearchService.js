import { withTransaction } from "../db/pool.js";
import { HttpError } from "../lib/errors.js";
import { createDefaultPlayerState, findPlayerStateByUserInternalId } from "../repositories/playerStateRepository.js";
import { buildMutableRuntimeState } from "../lib/runtimePlayerState.js";
import { listCitizensAdvanced } from "../repositories/usersRepository.js";
import { DONOR_TIERS } from "../data/chronicleData.js";

// Matches formatPlayerPublicId() in src/lib/publicIds.ts. See the same note
// in searchService.js - results here are rendered directly with no
// client-side formatting pass.
function playerProfileRoute(publicId) {
  return `/profile/P${String(publicId).padStart(7, "0")}`;
}

const CONDITION_LABELS = { normal: "Okay", hospitalized: "Hospital", jailed: "Jail" };
const CONDITION_VALUES = new Set(Object.keys(CONDITION_LABELS));
const SORT_VALUES = new Set(["level", "days", "lastAction"]);
const LAST_ACTION_WINDOWS = { day: 1, week: 7, month: 30 };

function getDonorTier(runtimeState) {
  const key = typeof runtimeState.legacy?.donorTier === "string" ? runtimeState.legacy.donorTier : "tier_0";
  return DONOR_TIERS.find((tier) => tier.key === key) ?? DONOR_TIERS[0];
}

async function loadRequesterDonorTier(client, user) {
  await createDefaultPlayerState(client, user.internalId);
  const playerState = await findPlayerStateByUserInternalId(client, user.internalId);
  const runtimeState = buildMutableRuntimeState(user, playerState);
  return getDonorTier(runtimeState);
}

export async function getAdvancedSearchAccess(user) {
  return withTransaction(async (client) => {
    const donorTier = await loadRequesterDonorTier(client, user);
    return { allowed: donorTier.key !== "tier_0", donorTier: donorTier.key };
  });
}

function parseIntOrNull(value) {
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : null;
}

export async function runAdvancedSearch(user, query) {
  return withTransaction(async (client) => {
    const donorTier = await loadRequesterDonorTier(client, user);
    if (donorTier.key === "tier_0") {
      throw new HttpError(403, "Advanced search is a donator perk.", "ADVANCED_SEARCH_LOCKED");
    }

    const filters = {
      name: typeof query.name === "string" ? query.name.trim().slice(0, 60) : "",
      faction: typeof query.faction === "string" ? query.faction.trim().slice(0, 60) : "",
      property: typeof query.property === "string" ? query.property.trim().slice(0, 60) : "",
      condition: CONDITION_VALUES.has(query.condition) ? query.condition : "",
      levelMin: parseIntOrNull(query.levelMin),
      levelMax: parseIntOrNull(query.levelMax),
      daysMin: parseIntOrNull(query.daysMin),
      daysMax: parseIntOrNull(query.daysMax),
      lastActionWithinDays: LAST_ACTION_WINDOWS[query.lastAction] ?? null,
      sortBy: SORT_VALUES.has(query.sortBy) ? query.sortBy : "level",
      sortDir: query.sortDir === "asc" ? "asc" : "desc",
    };

    const rows = await listCitizensAdvanced(client, filters, query.limit);
    return {
      donorTier: donorTier.key,
      results: rows.map((row) => ({
        publicId: row.publicId,
        name: row.name,
        level: row.level,
        propertyId: row.propertyId,
        conditionType: row.conditionType,
        conditionLabel: CONDITION_LABELS[row.conditionType] ?? "Okay",
        factionName: row.factionName,
        factionTag: row.factionTag,
        factionRoute: row.factionPublicId ? `/guilds/G${row.factionPublicId}` : null,
        daysOld: Math.max(0, Math.floor((Date.now() - row.createdAt) / 86400000)),
        lastSeenAt: row.lastSeenAt,
        to: playerProfileRoute(row.publicId),
      })),
    };
  });
}
