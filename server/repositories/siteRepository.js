import { FIRST_PLAYER_NUMERIC_ID } from "../config/env.js";

const PUBLIC_TEST_EMAIL_PATTERN = /@nexis\.local$/i;
const NON_PUBLIC_NAME_PATTERN = /\b(test|tester|debug|verify|verifier|quest|founder|runner|round|flow|endtoend|profile|jobs|civic)\b/i;

function isPublicFacingPlayer(row) {
  const email = String(row.email ?? "");
  const username = String(row.username ?? "");
  const fullName = `${String(row.first_name ?? "")} ${String(row.last_name ?? "")}`.trim();
  if (PUBLIC_TEST_EMAIL_PATTERN.test(email)) return false;
  if (NON_PUBLIC_NAME_PATTERN.test(username)) return false;
  if (NON_PUBLIC_NAME_PATTERN.test(fullName)) return false;
  return true;
}

function isPublicFacingOrganization(row) {
  const email = String(row.founder_email ?? "");
  const username = String(row.founder_username ?? "");
  const name = String(row.name ?? "");
  if (PUBLIC_TEST_EMAIL_PATTERN.test(email)) return false;
  if (NON_PUBLIC_NAME_PATTERN.test(username)) return false;
  if (NON_PUBLIC_NAME_PATTERN.test(name)) return false;
  return true;
}

export async function listPendingRankings(client, limit = 6) {
  const result = await client.query(
    `
      SELECT
        u.public_id,
        u.username,
        u.email,
        u.first_name,
        u.last_name,
        GREATEST(COALESCE(ps.level, 1), 1) AS level,
        COALESCE((ps.battle_stats ->> 'strength')::numeric, 0)
          + COALESCE((ps.battle_stats ->> 'defense')::numeric, 0)
          + COALESCE((ps.battle_stats ->> 'speed')::numeric, 0)
          + COALESCE((ps.battle_stats ->> 'dexterity')::numeric, 0) AS battle_score,
        COALESCE((ps.working_stats ->> 'manualLabor')::numeric, 0)
          + COALESCE((ps.working_stats ->> 'intelligence')::numeric, 0)
          + COALESCE((ps.working_stats ->> 'endurance')::numeric, 0) AS working_score,
        ps.updated_at
      FROM users u
      INNER JOIN player_state ps
        ON ps.user_internal_id = u.internal_id
      WHERE u.public_id >= $1
        AND COALESCE(u.entity_type, 'player') = 'player'
        AND COALESCE(u.privilege_role, 'player') = 'player'
      ORDER BY
        GREATEST(COALESCE(ps.level, 1), 1) DESC,
        (
          COALESCE((ps.battle_stats ->> 'strength')::numeric, 0)
          + COALESCE((ps.battle_stats ->> 'defense')::numeric, 0)
          + COALESCE((ps.battle_stats ->> 'speed')::numeric, 0)
          + COALESCE((ps.battle_stats ->> 'dexterity')::numeric, 0)
          + COALESCE((ps.working_stats ->> 'manualLabor')::numeric, 0)
          + COALESCE((ps.working_stats ->> 'intelligence')::numeric, 0)
          + COALESCE((ps.working_stats ->> 'endurance')::numeric, 0)
        ) DESC,
        ps.updated_at DESC
      LIMIT $2
    `,
    [FIRST_PLAYER_NUMERIC_ID, limit],
  );

  return result.rows.filter(isPublicFacingPlayer).slice(0, limit).map((row) => ({
    publicId: Number(row.public_id),
    firstName: row.first_name,
    lastName: row.last_name,
    level: Number(row.level ?? 1),
    battleScore: Math.round(Number(row.battle_score ?? 0)),
    workingScore: Math.round(Number(row.working_score ?? 0)),
    updatedAt: row.updated_at ? new Date(row.updated_at).getTime() : Date.now(),
  }));
}

export async function listGuildRankings(client, limit = 6) {
  const result = await client.query(
    `
      SELECT
        o.public_id,
        o.name,
        o.tag,
        fu.username AS founder_username,
        fu.email AS founder_email,
        COALESCE((o.metadata -> 'guild' -> 'passives' ->> 'reputation')::numeric, 0) AS reputation_total,
        COALESCE(m.member_count, 0) AS member_count,
        o.updated_at
      FROM organizations o
      LEFT JOIN users fu
        ON fu.internal_id = o.founder_internal_id
      LEFT JOIN (
        SELECT organization_internal_id, COUNT(*)::int AS member_count
        FROM organization_members
        GROUP BY organization_internal_id
      ) m
        ON m.organization_internal_id = o.internal_id
      WHERE o.type = 'guild'
      ORDER BY reputation_total DESC, member_count DESC, o.updated_at DESC
      LIMIT $1
    `,
    [limit],
  );

  return result.rows
    .filter((row) => Number(row.reputation_total ?? 0) > 0 && isPublicFacingOrganization(row))
    .map((row) => ({
      publicId: Number(row.public_id),
      name: String(row.name ?? "Unnamed Guild"),
      tag: row.tag ? String(row.tag) : null,
      reputationTotal: Math.round(Number(row.reputation_total ?? 0)),
      memberCount: Number(row.member_count ?? 0),
      updatedAt: row.updated_at ? new Date(row.updated_at).getTime() : Date.now(),
    }));
}

export async function listConsortiumRankings(client, limit = 6) {
  const result = await client.query(
    `
      SELECT
        o.public_id,
        o.name,
        fu.username AS founder_username,
        fu.email AS founder_email,
        o.consortium_type_name,
        COALESCE((o.treasury ->> 'gold')::numeric, 0) AS earnings_total,
        COALESCE((o.metadata -> 'management' -> 'performance' ->> 'starRating')::numeric, 0) AS stars,
        COALESCE(m.member_count, 0) AS member_count,
        o.updated_at
      FROM organizations o
      LEFT JOIN users fu
        ON fu.internal_id = o.founder_internal_id
      LEFT JOIN (
        SELECT organization_internal_id, COUNT(*)::int AS member_count
        FROM organization_members
        GROUP BY organization_internal_id
      ) m
        ON m.organization_internal_id = o.internal_id
      WHERE o.type = 'consortium'
      ORDER BY earnings_total DESC, stars DESC, member_count DESC, o.updated_at DESC
      LIMIT $1
    `,
    [limit],
  );

  return result.rows
    .filter((row) => Number(row.earnings_total ?? 0) > 0 && isPublicFacingOrganization(row))
    .map((row) => ({
      publicId: Number(row.public_id),
      name: String(row.name ?? "Unnamed Consortium"),
      consortiumTypeName: row.consortium_type_name ? String(row.consortium_type_name) : "Consortium",
      earningsTotal: Math.round(Number(row.earnings_total ?? 0)),
      stars: Math.round(Number(row.stars ?? 0)),
      memberCount: Number(row.member_count ?? 0),
      updatedAt: row.updated_at ? new Date(row.updated_at).getTime() : Date.now(),
    }));
}
