export async function createEmailChangeToken(client, { tokenHash, userInternalId, newEmail, expiresAt }) {
  await client.query(
    `
      INSERT INTO email_change_tokens (
        token_hash,
        user_internal_id,
        new_email,
        expires_at
      )
      VALUES ($1, $2, $3, $4)
    `,
    [tokenHash, userInternalId, newEmail, expiresAt],
  );
}

export async function findEmailChangeTokenByHash(client, tokenHash) {
  const result = await client.query(
    `
      SELECT token_hash, user_internal_id, new_email, created_at, expires_at, used_at
      FROM email_change_tokens
      WHERE token_hash = $1
        AND expires_at > NOW()
    `,
    [tokenHash],
  );

  return result.rows[0] ?? null;
}

export async function markEmailChangeTokenUsed(client, tokenHash) {
  await client.query(
    `
      UPDATE email_change_tokens
      SET used_at = NOW()
      WHERE token_hash = $1
    `,
    [tokenHash],
  );
}

export async function invalidateEmailChangeTokensForUser(client, userInternalId) {
  await client.query(
    `
      UPDATE email_change_tokens
      SET used_at = NOW()
      WHERE user_internal_id = $1
        AND used_at IS NULL
    `,
    [userInternalId],
  );
}
