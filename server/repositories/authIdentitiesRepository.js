function mapIdentityRow(row) {
  if (!row) return null;
  return {
    id: Number(row.id),
    userInternalId: row.user_internal_id,
    provider: row.provider,
    providerSubject: row.provider_subject,
    providerEmail: row.provider_email,
    providerEmailVerified: Boolean(row.provider_email_verified),
    createdAt: new Date(row.created_at).getTime(),
    lastLoginAt: row.last_login_at ? new Date(row.last_login_at).getTime() : null,
  };
}

export async function findIdentityByProviderSubject(client, provider, providerSubject) {
  const result = await client.query(
    `
      SELECT id, user_internal_id, provider, provider_subject, provider_email, provider_email_verified, created_at, last_login_at
      FROM user_auth_identities
      WHERE provider = $1 AND provider_subject = $2
    `,
    [provider, providerSubject],
  );

  return mapIdentityRow(result.rows[0]);
}

export async function findIdentityByUserAndProvider(client, userInternalId, provider) {
  const result = await client.query(
    `
      SELECT id, user_internal_id, provider, provider_subject, provider_email, provider_email_verified, created_at, last_login_at
      FROM user_auth_identities
      WHERE user_internal_id = $1 AND provider = $2
    `,
    [userInternalId, provider],
  );

  return mapIdentityRow(result.rows[0]);
}

export async function createIdentity(
  client,
  { userInternalId, provider, providerSubject, providerEmail, providerEmailVerified },
) {
  const result = await client.query(
    `
      INSERT INTO user_auth_identities (
        user_internal_id, provider, provider_subject, provider_email, provider_email_verified, last_login_at
      )
      VALUES ($1, $2, $3, $4, $5, NOW())
      RETURNING id, user_internal_id, provider, provider_subject, provider_email, provider_email_verified, created_at, last_login_at
    `,
    [userInternalId, provider, providerSubject, providerEmail, Boolean(providerEmailVerified)],
  );

  return mapIdentityRow(result.rows[0]);
}

export async function touchIdentityLogin(client, provider, providerSubject) {
  await client.query(
    `
      UPDATE user_auth_identities
      SET last_login_at = NOW()
      WHERE provider = $1 AND provider_subject = $2
    `,
    [provider, providerSubject],
  );
}

export async function listIdentitiesForUser(client, userInternalId) {
  const result = await client.query(
    `
      SELECT id, user_internal_id, provider, provider_subject, provider_email, provider_email_verified, created_at, last_login_at
      FROM user_auth_identities
      WHERE user_internal_id = $1
      ORDER BY created_at ASC
    `,
    [userInternalId],
  );

  return result.rows.map(mapIdentityRow);
}
