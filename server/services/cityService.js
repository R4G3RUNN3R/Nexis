import { query } from "../db/pool.js";
import { HttpError } from "../lib/errors.js";
import { getCityDefinition, getCityOccupancyCandidates, isValidCityId, normalizeCityId } from "../data/cityData.js";

function asRecord(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : {};
}

function asNumber(value, fallback = 0) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : fallback;
}

function formatDisplayName(row) {
  const first = typeof row.first_name === "string" ? row.first_name.trim() : "";
  const last = typeof row.last_name === "string" ? row.last_name.trim() : "";
  return `${first} ${last}`.trim() || "Unnamed Citizen";
}

function mapOccupantRow(row, requestingUser) {
  const snapshot = asRecord(row.player_snapshot);
  const current = asRecord(snapshot.current);
  const title = typeof snapshot.title === "string" && snapshot.title.trim() ? snapshot.title.trim() : "Citizen";
  const publicId = Number(row.public_id);
  return {
    publicId,
    displayName: formatDisplayName(row),
    title,
    level: Math.max(1, Math.floor(asNumber(row.level ?? snapshot.level, 1))),
    currentCityId: normalizeCityId(row.current_city_id),
    isSelf: requestingUser?.publicId === publicId,
  };
}

export async function getCityPeopleForUser(user, cityId) {
  const normalizedCityId = normalizeCityId(cityId, "");
  if (!normalizedCityId || !isValidCityId(normalizedCityId)) {
    throw new HttpError(400, "City unavailable.", "CITY_INVALID");
  }

  const city = getCityDefinition(normalizedCityId);
  const candidates = getCityOccupancyCandidates(normalizedCityId);
  const result = await query(
    `
      SELECT
        u.public_id,
        u.first_name,
        u.last_name,
        ps.level,
        ps.player_snapshot,
        COALESCE(
          NULLIF(ps.travel_state->>'currentCityId', ''),
          NULLIF(ps.player_snapshot->'current'->>'currentCityId', ''),
          'nexis'
        ) AS current_city_id
      FROM users u
      INNER JOIN player_state ps ON ps.user_internal_id = u.internal_id
      WHERE COALESCE(
          NULLIF(ps.travel_state->>'currentCityId', ''),
          NULLIF(ps.player_snapshot->'current'->>'currentCityId', ''),
          'nexis'
        ) = ANY($1::text[])
        AND COALESCE(ps.travel_state->>'status', 'idle') <> 'in_transit'
      ORDER BY COALESCE(ps.level, 1) DESC, u.created_at DESC
      LIMIT 30
    `,
    [candidates],
  );

  return {
    city: {
      id: city.id,
      name: city.name,
      role: city.role,
      peopleLabel: city.peopleLabel,
    },
    people: result.rows.map((row) => mapOccupantRow(row, user)),
  };
}
