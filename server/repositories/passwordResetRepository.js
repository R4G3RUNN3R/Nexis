export async function createPasswordResetToken(client, { tokenHash, userInternalId, expiresAt }) {
  await client.query(
    `
      INSERT INTO password_reset_tokens (
        token_hash,
        user_internal_id,
        expires_at
      )
      VALUES ($1, $2, $3)
    `,
    [tokenHash, userInternalId, expiresAt],
  );
}

export async function findPasswordResetTokenByHash(client, tokenHash) {
  const result = await client.query(
    `
      SELECT token_hash, user_internal_id, created_at, expires_at, used_at
      FROM password_reset_tokens
      WHERE token_hash = $1
        AND expires_at > NOW()
    `,
    [tokenHash],
  );

  return result.rows[0] ?? null;
}

export async function markPasswordResetTokenUsed(client, tokenHash) {
  await client.query(
    `
      UPDATE password_reset_tokens
      SET used_at = NOW()
      WHERE token_hash = $1
    `,
    [tokenHash],
  );
}

export async function invalidatePasswordResetTokensForUser(client, userInternalId) {
  await client.query(
    `
      UPDATE password_reset_tokens
      SET used_at = NOW()
      WHERE user_internal_id = $1
        AND used_at IS NULL
    `,
    [userInternalId],
  );
}
