function mapEventRow(row) {
  if (!row) return null;
  return {
    cityId: row.city_id,
    status: row.status,
    templateId: row.template_id,
    severity: row.severity,
    triggerSource: row.trigger_source,
    startedAt: row.started_at ? new Date(row.started_at).getTime() : null,
    expiresAt: row.expires_at ? new Date(row.expires_at).getTime() : null,
    cooldownUntil: row.cooldown_until ? new Date(row.cooldown_until).getTime() : null,
    triggeredByLabel: row.triggered_by_label,
    triggeredByPublicId: row.triggered_by_public_id === null ? null : Number(row.triggered_by_public_id),
    updatedAt: row.updated_at ? new Date(row.updated_at).getTime() : Date.now(),
  };
}

// Idempotent: only seeds the row the first time this cityId is ever seen.
export async function ensureCityEventRow(client, cityId) {
  await client.query(
    `
      INSERT INTO city_events (city_id, status)
      VALUES ($1, 'inactive')
      ON CONFLICT (city_id) DO NOTHING
    `,
    [cityId],
  );
}

// Atomic conditional activation: only succeeds (returns the row) if the city is
// currently inactive and not on cooldown at the moment of the UPDATE, so two
// concurrent triggers (e.g. an adventure defeat and a guild quest failure
// landing in the same city within milliseconds of each other) can't both
// activate a crisis. Returns null when another crisis is already active or
// the city is still cooling down from the last one — callers must treat that
// as a silent no-op, never an error.
export async function activateCityEvent(client, cityId, { templateId, severity, durationMs, triggerSource, triggeredByLabel, triggeredByPublicId }) {
  await ensureCityEventRow(client, cityId);
  const result = await client.query(
    `
      UPDATE city_events
      SET status = 'active', template_id = $2, severity = $3, trigger_source = $4,
          started_at = NOW(), expires_at = NOW() + ($5 || ' milliseconds')::interval,
          cooldown_until = NULL, triggered_by_label = $6, triggered_by_public_id = $7, updated_at = NOW()
      WHERE city_id = $1 AND status = 'inactive' AND (cooldown_until IS NULL OR cooldown_until <= NOW())
      RETURNING *
    `,
    [cityId, templateId, severity, triggerSource, Math.max(0, Math.floor(Number(durationMs) || 0)), triggeredByLabel ?? null, triggeredByPublicId ?? null],
  );
  return mapEventRow(result.rows[0] ?? null);
}

// Reap-on-read: first runs a conditional UPDATE that flips active -> inactive
// and starts the cooldown, but ONLY when expires_at has actually passed — a
// no-match UPDATE (the common case, an active-but-not-yet-expired or already-
// inactive row) takes no row lock and costs about the same as the SELECT
// below. Whichever player next interacts with a given city reaps its own
// expiry; no cron/background worker needed.
export async function getCityEventRow(client, cityId, cooldownMs) {
  await ensureCityEventRow(client, cityId);
  await client.query(
    `
      UPDATE city_events
      SET status = 'inactive', cooldown_until = NOW() + ($2 || ' milliseconds')::interval, updated_at = NOW()
      WHERE city_id = $1 AND status = 'active' AND expires_at <= NOW()
    `,
    [cityId, Math.max(0, Math.floor(Number(cooldownMs) || 0))],
  );
  const result = await client.query(`SELECT * FROM city_events WHERE city_id = $1`, [cityId]);
  return mapEventRow(result.rows[0] ?? null);
}
