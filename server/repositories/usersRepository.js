import { normalizeEntityType, normalizePrivilegeRole } from "../lib/userIdentity.js";

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
    createdAt: new Date(row.created_at).getTime(),
  };
}

export async function findAuthUserByEmail(client, email) {
  const result = await client.query(
    `
      SELECT internal_id, public_id, username, email, first_name, last_name, entity_type, privilege_role, password_hash, created_at
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

export async function findUserByInternalId(client, internalId) {
  const result = await client.query(
    `
      SELECT internal_id, public_id, username, email, first_name, last_name, entity_type, privilege_role, created_at
      FROM users
      WHERE internal_id = $1
    `,
    [internalId],
  );

  return mapUserRow(result.rows[0]);
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
