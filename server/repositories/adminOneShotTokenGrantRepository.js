import { HttpError } from "../lib/errors.js";

function isUniqueViolation(error) {
  return Boolean(error && (error.code === "23505" || String(error.message ?? "").includes("unique")));
}

function mapRow(row) {
  return {
    id: Number(row.id),
    operationId: row.operation_id,
    idempotencyKey: row.idempotency_key,
    actorInternalId: row.actor_internal_id,
    actorPublicId: Number(row.actor_public_id),
    targetInternalId: row.target_internal_id,
    targetPublicId: Number(row.target_public_id),
    tokenType: row.token_type,
    quantity: Number(row.quantity),
    reason: row.reason,
    beforeBalance: Number(row.before_balance),
    afterBalance: Number(row.after_balance),
    createdAt: row.created_at ? new Date(row.created_at).getTime() : null,
  };
}

// Admin hotfix: DB-enforced idempotency for staff-granted one-shot tokens,
// mirroring Ticket A's one_shot_completions / player_entitlement_consumptions
// pattern - a real row with a unique constraint on idempotencyKey, not an
// application-level check against something that can be blindly
// overwritten. The caller (adminService.js's grantOneShotTokenForUser) is
// responsible for deciding replay vs. conflict: this function only finds
// the recorded row, it never assumes a matching key means a matching
// request - two requests can share a key and still differ in actor,
// target, token type, quantity, or reason, which must be rejected rather
// than silently replayed.
export async function findGrantByIdempotencyKey(client, idempotencyKey) {
  const result = await client.query(
    `SELECT * FROM admin_one_shot_token_grants WHERE idempotency_key = $1`,
    [idempotencyKey],
  );
  return result.rows[0] ? mapRow(result.rows[0]) : null;
}

export async function recordTokenGrant(client, {
  operationId,
  idempotencyKey,
  actorInternalId,
  actorPublicId,
  targetInternalId,
  targetPublicId,
  tokenType,
  quantity,
  reason,
  beforeBalance,
  afterBalance,
}) {
  try {
    const result = await client.query(
      `
        INSERT INTO admin_one_shot_token_grants (
          operation_id, idempotency_key, actor_internal_id, actor_public_id,
          target_internal_id, target_public_id, token_type, quantity, reason,
          before_balance, after_balance
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
        RETURNING *
      `,
      [
        operationId,
        idempotencyKey,
        actorInternalId,
        actorPublicId,
        targetInternalId,
        targetPublicId,
        tokenType,
        quantity,
        reason,
        beforeBalance,
        afterBalance,
      ],
    );
    return mapRow(result.rows[0]);
  } catch (error) {
    if (isUniqueViolation(error)) {
      // Internal signal only - a genuinely concurrent request already won
      // the race for this idempotencyKey (this transaction is now
      // unusable and will be rolled back by withTransaction). The caller
      // catches this specific code and re-resolves replay-vs-conflict in
      // a fresh transaction against the winner's row; it is never
      // returned to the client as-is.
      throw new HttpError(409, "This token grant has already been submitted.", "ADMIN_TOKEN_GRANT_ALREADY_SUBMITTED");
    }
    throw error;
  }
}
