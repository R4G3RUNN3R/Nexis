import { normalizeEntityType, normalizePrivilegeRole } from "../lib/userIdentity.js";

function isUniqueViolation(error) {
  return Boolean(error && (error.code === "23505" || String(error.message ?? "").includes("unique")));
}

function mapUserRow(row) {
  if (!row) return null;

  const publicId = Number(row.public_id);
  return {
    internalId: row.internal_id,
    publicId,
    username: row.username,
    email: row.email,
    firstName: row.first_name,
    lastName: row.last_name,
    entityType: normalizeEntityType(row.entity_type, publicId),
    privilegeRole: normalizePrivilegeRole(row.privilege_role, publicId),
    deactivatedAt: row.deactivated_at ? new Date(row.deactivated_at).getTime() : null,
    createdAt: new Date(row.created_at).getTime(),
  };
}

export async function findAuthUserByEmail(client, email) {
  const result = await client.query(
    `
      SELECT internal_id, public_id, username, email, first_name, last_name, entity_type, privilege_role, password_hash, deactivated_at, created_at
      FROM users
      WHERE email = $1
    `,
    [email],
  );

  const row = result.rows[0];
  if (!row) return null;

  return {
    ...mapUserRow(row),
    passwordHash: row.password_hash,
  };
}

export async function findUserByInternalId(client, internalId, { forUpdate = false } = {}) {
  const result = await client.query(
    `
      SELECT internal_id, public_id, username, email, first_name, last_name, entity_type, privilege_role, password_hash, name_changed_at, deactivated_at, created_at
      FROM users
      WHERE internal_id = $1
      ${forUpdate ? "FOR UPDATE" : ""}
    `,
    [internalId],
  );

  const row = result.rows[0];
  if (!row) return null;
  return {
    ...mapUserRow(row),
    passwordHash: row.password_hash,
    nameChangedAt: row.name_changed_at ? new Date(row.name_changed_at).getTime() : null,
  };
}

export async function findUserByPublicId(client, publicId) {
  const result = await client.query(
    `
      SELECT internal_id, public_id, username, email, first_name, last_name, entity_type, privilege_role, created_at
      FROM users
      WHERE public_id = $1
    `,
    [publicId],
  );

  return mapUserRow(result.rows[0]);
}

export async function createUser(
  client,
  { internalId, publicId, username, email, firstName, lastName, passwordHash, entityType, privilegeRole },
) {
  const result = await client.query(
    `
      INSERT INTO users (
        internal_id,
        public_id,
        username,
        email,
        first_name,
        last_name,
        entity_type,
        privilege_role,
        password_hash
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      RETURNING internal_id, public_id, username, email, first_name, last_name, entity_type, privilege_role, created_at
    `,
    [
      internalId,
      publicId,
      username,
      email,
      firstName,
      lastName,
      normalizeEntityType(entityType, publicId),
      normalizePrivilegeRole(privilegeRole, publicId),
      passwordHash,
    ],
  );

  return mapUserRow(result.rows[0]);
}

export async function updateUserPrivilegeRole(client, internalId, privilegeRole) {
  const result = await client.query(
    `
      UPDATE users
      SET privilege_role = $2
      WHERE internal_id = $1
      RETURNING internal_id, public_id, username, email, first_name, last_name, entity_type, privilege_role, created_at
    `,
    [internalId, privilegeRole],
  );

  return mapUserRow(result.rows[0]);
}

export async function updateUserPasswordHash(client, internalId, passwordHash) {
  const result = await client.query(
    `
      UPDATE users
      SET password_hash = $2
      WHERE internal_id = $1
      RETURNING internal_id, public_id, username, email, first_name, last_name, entity_type, privilege_role, created_at
    `,
    [internalId, passwordHash],
  );

  return mapUserRow(result.rows[0]);
}

// Atomic conditional UPDATE (Ticket A discipline, not read-then-write): only
// succeeds if the 30-day cooldown has actually elapsed at the moment of the
// UPDATE, so two concurrent rename requests from the same account can't both
// succeed and double-charge gold - accountService.js checks this returned
// null before ever debiting gold, and only debits if a row came back.
export async function updateUserNameIfCooldownElapsed(client, internalId, firstName, lastName, cooldownDays) {
  const result = await client.query(
    `
      UPDATE users
      SET first_name = $2, last_name = $3, name_changed_at = NOW()
      WHERE internal_id = $1
        AND (name_changed_at IS NULL OR name_changed_at <= NOW() - ($4 || ' days')::interval)
      RETURNING internal_id, public_id, username, email, first_name, last_name, entity_type, privilege_role, created_at
    `,
    [internalId, firstName, lastName, cooldownDays],
  );

  return mapUserRow(result.rows[0]);
}

// Atomic conditional UPDATE: idempotent against a double-submit (a second
// close-account click while the first is still in flight sees zero rows and
// is treated as already-done by the caller, not an error).
export async function updateUserDeactivatedAt(client, internalId) {
  const result = await client.query(
    `
      UPDATE users
      SET deactivated_at = NOW()
      WHERE internal_id = $1 AND deactivated_at IS NULL
      RETURNING internal_id, public_id, username, email, first_name, last_name, entity_type, privilege_role, created_at
    `,
    [internalId],
  );

  return mapUserRow(result.rows[0]);
}

// Plain UPDATE - the users.email UNIQUE constraint is the real race-safety
// boundary here (Postgres rejects a concurrent collision atomically at the
// index level), not an application-level check-then-write.
//
// Deliberately does NOT catch the unique-violation itself: withTransaction
// (server/db/pool.js) is a flat BEGIN/COMMIT/ROLLBACK with no savepoints, so
// once any statement inside a transaction errors, Postgres poisons the whole
// transaction until ROLLBACK - any further query on that same client would
// fail with "current transaction is aborted". The caller must make this the
// LAST statement it runs before either succeeding or handling the error (see
// confirmEmailChangeForUser in accountService.js, which catches immediately
// here and re-throws as HttpError so the poisoned state never encounters
// another query before the enclosing withTransaction's own ROLLBACK, which
// always succeeds regardless of transaction state).
export async function updateUserEmail(client, internalId, email) {
  const result = await client.query(
    `
      UPDATE users
      SET email = $2
      WHERE internal_id = $1
      RETURNING internal_id, public_id, username, email, first_name, last_name, entity_type, privilege_role, created_at
    `,
    [internalId, email],
  );
  return mapUserRow(result.rows[0]);
}

export { isUniqueViolation };

export async function searchUsers(client, queryText, limit = 20) {
  const term = String(queryText ?? "").trim();
  if (!term) return [];

  const publicIdMatch = /^P?(\d{7})$/i.exec(term);
  if (publicIdMatch) {
    const exact = await findUserByPublicId(client, Number.parseInt(publicIdMatch[1], 10));
    return exact ? [exact] : [];
  }

  const normalizedTerm = `%${term.toLowerCase()}%`;
  const numericTerm = term.replace(/[^0-9]/g, "");
  const result = await client.query(
    `
      SELECT internal_id, public_id, username, email, first_name, last_name, entity_type, privilege_role, created_at
      FROM users
      WHERE LOWER(first_name || ' ' || last_name) LIKE $1
         OR LOWER(username) LIKE $1
         OR CAST(public_id AS TEXT) LIKE $2
      ORDER BY created_at DESC
      LIMIT $3
    `,
    [normalizedTerm, `%${numericTerm}%`, limit],
  );

  return result.rows.map(mapUserRow);
}

export async function listStaffUsers(client) {
  const result = await client.query(
    `
      SELECT internal_id, public_id, username, email, first_name, last_name, entity_type, privilege_role, created_at
      FROM users
      WHERE privilege_role IN ('staff', 'admin')
      ORDER BY privilege_role = 'admin' DESC, created_at ASC
    `,
  );

  return result.rows.map(mapUserRow);
}

const ADVANCED_SEARCH_SORT_COLUMNS = {
  level: "ps.level",
  days: "u.created_at",
  lastAction: "sess.last_seen_at",
};

// Donator-only citizen directory (Torn's "advanced search"). Filters run as
// real SQL predicates rather than an in-JS scan since this queries the full
// user population, not a small pre-filtered set like searchUsers() above.
// property/condition live inside player_state.player_snapshot (see
// runtimePlayerState.js) rather than as their own columns; "faction" is
// resolved through a guild-only membership join since organization_members
// has no type filter of its own (a row could belong to a guild or a
// consortium). "Last action" reads auth_sessions.last_seen_at, the same
// column auth_sessions already maintains on every session touch.
export async function listCitizensAdvanced(client, filters, limit = 25) {
  const where = [];
  const values = [];

  function addParam(value) {
    values.push(value);
    return `$${values.length}`;
  }

  if (filters.name) {
    const p = addParam(`%${filters.name.toLowerCase()}%`);
    where.push(`(LOWER(u.first_name || ' ' || u.last_name) LIKE ${p} OR LOWER(u.username) LIKE ${p})`);
  }
  if (filters.faction) {
    const p = addParam(`%${filters.faction.toLowerCase()}%`);
    where.push(`(LOWER(guild.name) LIKE ${p} OR LOWER(guild.tag) LIKE ${p})`);
  }
  if (filters.property) {
    const p = addParam(filters.property);
    where.push(`COALESCE(ps.player_snapshot->'property'->>'current', 'shack') = ${p}`);
  }
  if (filters.condition) {
    const p = addParam(filters.condition);
    where.push(`COALESCE(ps.player_snapshot->'condition'->>'type', 'normal') = ${p}`);
  }
  if (Number.isFinite(filters.levelMin)) {
    where.push(`ps.level >= ${addParam(filters.levelMin)}`);
  }
  if (Number.isFinite(filters.levelMax)) {
    where.push(`ps.level <= ${addParam(filters.levelMax)}`);
  }
  if (Number.isFinite(filters.daysMin)) {
    where.push(`EXTRACT(EPOCH FROM (NOW() - u.created_at)) / 86400 >= ${addParam(filters.daysMin)}`);
  }
  if (Number.isFinite(filters.daysMax)) {
    where.push(`EXTRACT(EPOCH FROM (NOW() - u.created_at)) / 86400 <= ${addParam(filters.daysMax)}`);
  }
  if (Number.isFinite(filters.lastActionWithinDays)) {
    const p = addParam(filters.lastActionWithinDays);
    where.push(`sess.last_seen_at IS NOT NULL AND sess.last_seen_at >= NOW() - (${p} || ' days')::interval`);
  }

  const sortColumn = ADVANCED_SEARCH_SORT_COLUMNS[filters.sortBy] ?? ADVANCED_SEARCH_SORT_COLUMNS.level;
  const sortDir = filters.sortDir === "asc" ? "ASC" : "DESC";
  const limitParam = addParam(Math.max(1, Math.min(50, Number(limit) || 25)));

  const result = await client.query(
    `
      SELECT
        u.public_id, u.first_name, u.last_name, u.created_at,
        ps.level,
        ps.player_snapshot->'property'->>'current' AS property_id,
        ps.player_snapshot->'condition'->>'type' AS condition_type,
        guild.name AS faction_name, guild.tag AS faction_tag, guild.public_id AS faction_public_id,
        sess.last_seen_at
      FROM users u
      JOIN player_state ps ON ps.user_internal_id = u.internal_id
      LEFT JOIN (
        SELECT om.user_internal_id, o.name, o.tag, o.public_id
        FROM organization_members om
        JOIN organizations o ON o.internal_id = om.organization_internal_id
        WHERE o.type = 'guild'
      ) guild ON guild.user_internal_id = u.internal_id
      LEFT JOIN LATERAL (
        SELECT MAX(last_seen_at) AS last_seen_at
        FROM auth_sessions
        WHERE user_internal_id = u.internal_id
      ) sess ON true
      ${where.length ? `WHERE ${where.join(" AND ")}` : ""}
      ORDER BY ${sortColumn} ${sortDir} NULLS LAST
      LIMIT ${limitParam}
    `,
    values,
  );

  return result.rows.map((row) => ({
    publicId: Number(row.public_id),
    name: `${row.first_name}${row.last_name ? ` ${row.last_name}` : ""}`.trim(),
    level: Number(row.level),
    propertyId: row.property_id ?? "shack",
    conditionType: row.condition_type ?? "normal",
    factionName: row.faction_name ?? null,
    factionTag: row.faction_tag ?? null,
    factionPublicId: row.faction_public_id !== null && row.faction_public_id !== undefined ? Number(row.faction_public_id) : null,
    createdAt: new Date(row.created_at).getTime(),
    lastSeenAt: row.last_seen_at ? new Date(row.last_seen_at).getTime() : null,
  }));
}
