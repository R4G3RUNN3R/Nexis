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
  const title = typeof snapshot.title === "string" && snapshot.title.trim() ? snapshot.title.trim() : "Citizen";
  const publicId = Number(row.public_id);
  return {
    publicId,
    displayName: formatDisplayName(row),
    title,
    level: Math.max(1, Math.floor(asNumber(row.level ?? snapshot.level, 1))),
    currentCityId: normalizeCityId(row.current_city_id),
    isSelf: requestingUser?.publicId === publicId,
    sharesGuild: Boolean(row.shares_guild),
    sharesConsortium: Boolean(row.shares_consortium),
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
      WITH viewer_orgs AS (
        SELECT om.organization_internal_id, o.type AS organization_type
        FROM organization_members om
        INNER JOIN organizations o ON o.internal_id = om.organization_internal_id
        WHERE om.user_internal_id = $2
      ),
      city_people AS (
        SELECT
          u.internal_id,
          u.public_id,
          u.first_name,
          u.last_name,
          u.created_at,
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
      )
      SELECT
        cp.*,
        EXISTS (
          SELECT 1
          FROM organization_members om
          INNER JOIN viewer_orgs vo ON vo.organization_internal_id = om.organization_internal_id
          WHERE om.user_internal_id = cp.internal_id AND vo.organization_type = 'guild'
        ) AS shares_guild,
        EXISTS (
          SELECT 1
          FROM organization_members om
          INNER JOIN viewer_orgs vo ON vo.organization_internal_id = om.organization_internal_id
          WHERE om.user_internal_id = cp.internal_id AND vo.organization_type = 'consortium'
        ) AS shares_consortium
      FROM city_people cp
      ORDER BY COALESCE(cp.level, 1) DESC, cp.created_at DESC
      LIMIT 30
    `,
    [candidates, user.internalId],
  );

  const people = result.rows.map((row) => mapOccupantRow(row, user));

  return {
    city: {
      id: city.id,
      name: city.name,
      role: city.role,
      peopleLabel: city.peopleLabel,
    },
    population: {
      visibleCount: people.length,
      listLimit: 30,
      peopleLabel: city.peopleLabel,
      guildmatesVisible: people.filter((person) => person.sharesGuild).length,
      consortiumMembersVisible: people.filter((person) => person.sharesConsortium).length,
    },
    people,
  };
}
