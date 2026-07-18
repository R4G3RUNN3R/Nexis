import { HttpError } from "../lib/errors.js";

function isUniqueViolation(error) {
  return Boolean(error && (error.code === "23505" || String(error.message ?? "").includes("unique")));
}

// Ticket A: records a one-shot completion (personal: organizationInternalId
// null; group: organizationInternalId set). Backed by the
// one_shot_completions unique indexes - idx_one_shot_completions_personal
// (user, campaign) and idx_one_shot_completions_org (organization,
// campaign) - so a concurrent or retried completion request for the same
// campaign is rejected by the database itself, not just an
// application-level "already completed" check against a JSONB blob that
// gets blindly overwritten on every unrelated player_state/organizations
// write. sessionId is also globally unique, so a retried request carrying
// the exact same sessionId (client timeout + retry, not a genuinely new
// attempt) returns the original result instead of erroring.
//
// Returns { created: true, row } on a fresh completion, or
// { created: false, row } if this exact sessionId already has a row
// (idempotent replay). Throws ONE_SHOT_ALREADY_COMPLETED (409) if the
// (user-or-org, campaign) pair is already completed under a different
// sessionId.
export async function recordOneShotCompletion(client, { userInternalId, organizationInternalId = null, campaignId, sessionId, outcomeKey, metadata = {} }) {
  const existingBySession = await client.query(
    `SELECT id, user_internal_id, organization_internal_id, campaign_id, session_id, outcome_key, completed_at, metadata
       FROM one_shot_completions WHERE session_id = $1`,
    [sessionId],
  );
  if (existingBySession.rows[0]) {
    return { created: false, row: mapRow(existingBySession.rows[0]) };
  }

  try {
    const result = await client.query(
      `INSERT INTO one_shot_completions (user_internal_id, organization_internal_id, campaign_id, session_id, outcome_key, metadata)
         VALUES ($1, $2, $3, $4, $5, $6::jsonb)
         RETURNING id, user_internal_id, organization_internal_id, campaign_id, session_id, outcome_key, completed_at, metadata`,
      [userInternalId, organizationInternalId, campaignId, sessionId, outcomeKey, JSON.stringify(metadata)],
    );
    return { created: true, row: mapRow(result.rows[0]) };
  } catch (error) {
    if (isUniqueViolation(error)) {
      throw new HttpError(409, "This one-shot campaign has already been completed.", "ONE_SHOT_ALREADY_COMPLETED");
    }
    throw error;
  }
}

export async function findOneShotCompletion(client, { userInternalId = null, organizationInternalId = null, campaignId }) {
  if (organizationInternalId) {
    const result = await client.query(
      `SELECT id, user_internal_id, organization_internal_id, campaign_id, session_id, outcome_key, completed_at, metadata
         FROM one_shot_completions WHERE organization_internal_id = $1 AND campaign_id = $2`,
      [organizationInternalId, campaignId],
    );
    return result.rows[0] ? mapRow(result.rows[0]) : null;
  }
  const result = await client.query(
    `SELECT id, user_internal_id, organization_internal_id, campaign_id, session_id, outcome_key, completed_at, metadata
       FROM one_shot_completions WHERE user_internal_id = $1 AND campaign_id = $2 AND organization_internal_id IS NULL`,
    [userInternalId, campaignId],
  );
  return result.rows[0] ? mapRow(result.rows[0]) : null;
}

function mapRow(row) {
  return {
    id: Number(row.id),
    userInternalId: row.user_internal_id,
    organizationInternalId: row.organization_internal_id ?? null,
    campaignId: row.campaign_id,
    sessionId: row.session_id,
    outcomeKey: row.outcome_key,
    completedAt: row.completed_at ? new Date(row.completed_at).getTime() : null,
    metadata: row.metadata ?? {},
  };
}
