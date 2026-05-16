import { findUserByInternalId } from "./usersRepository.js";

export async function createSession(client, { tokenHash, userInternalId, expiresAt }) {
  await client.query(
    `
      INSERT INTO auth_sessions (
        token_hash,
        user_internal_id,
        expires_at
      )
      VALUES ($1, $2, $3)
    `,
    [tokenHash, userInternalId, expiresAt],
  );
}

export async function findSessionRecordByTokenHash(client, tokenHash) {
  const result = await client.query(
    `
      SELECT token_hash, user_internal_id, expires_at, last_seen_at
      FROM auth_sessions
      WHERE token_hash = $1
        AND expires_at > NOW()
    `,
    [tokenHash],
  );

  return result.rows[0] ?? null;
}

export async function touchSession(client, tokenHash) {
  await client.query(
    `
      UPDATE auth_sessions
      SET last_seen_at = NOW()
      WHERE token_hash = $1
    `,
    [tokenHash],
  );
}

export async function deleteSessionsByUserInternalId(client, userInternalId) {
  await client.query(
    `
      DELETE FROM auth_sessions
      WHERE user_internal_id = $1
    `,
    [userInternalId],
  );
}

export async function findSessionUserByTokenHash(client, tokenHash) {
  const session = await findSessionRecordByTokenHash(client, tokenHash);
  if (!session) return null;

  const user = await findUserByInternalId(client, session.user_internal_id);
  if (!user) return null;

  return {
    session,
    user,
  };
}

export async function findLatestSessionActivityByUserInternalId(client, userInternalId) {
  const result = await client.query(
    `
      SELECT last_seen_at, expires_at
      FROM auth_sessions
      WHERE user_internal_id = $1
      ORDER BY last_seen_at DESC NULLS LAST, created_at DESC
      LIMIT 1
    `,
    [userInternalId],
  );

  const row = result.rows[0];
  if (!row) return null;

  return {
    lastSeenAt: row.last_seen_at ? new Date(row.last_seen_at).getTime() : null,
    expiresAt: row.expires_at ? new Date(row.expires_at).getTime() : null,
  };
}
