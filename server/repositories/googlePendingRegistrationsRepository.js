function mapPendingRow(row) {
  if (!row) return null;
  return {
    tokenHash: row.token_hash,
    providerSubject: row.provider_subject,
    providerEmail: row.provider_email,
    providerEmailVerified: Boolean(row.provider_email_verified),
    suggestedFirstName: row.suggested_first_name,
    suggestedLastName: row.suggested_last_name,
    createdAt: new Date(row.created_at).getTime(),
    expiresAt: new Date(row.expires_at).getTime(),
  };
}

export async function createPendingRegistration(
  client,
  { tokenHash, providerSubject, providerEmail, providerEmailVerified, suggestedFirstName, suggestedLastName, expiresAt },
) {
  // Opportunistic cleanup of expired rows on every write - this table only
  // ever holds short-lived (minutes) records, no dedicated sweep job needed.
  await client.query(`DELETE FROM google_pending_registrations WHERE expires_at < NOW()`);

  await client.query(
    `
      INSERT INTO google_pending_registrations (
        token_hash, provider_subject, provider_email, provider_email_verified,
        suggested_first_name, suggested_last_name, expires_at
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7)
    `,
    [tokenHash, providerSubject, providerEmail, Boolean(providerEmailVerified), suggestedFirstName, suggestedLastName, expiresAt],
  );
}

export async function findPendingRegistrationByTokenHash(client, tokenHash) {
  const result = await client.query(
    `
      SELECT token_hash, provider_subject, provider_email, provider_email_verified,
             suggested_first_name, suggested_last_name, created_at, expires_at
      FROM google_pending_registrations
      WHERE token_hash = $1 AND expires_at > NOW()
    `,
    [tokenHash],
  );

  return mapPendingRow(result.rows[0]);
}

export async function deletePendingRegistration(client, tokenHash) {
  await client.query(`DELETE FROM google_pending_registrations WHERE token_hash = $1`, [tokenHash]);
}
