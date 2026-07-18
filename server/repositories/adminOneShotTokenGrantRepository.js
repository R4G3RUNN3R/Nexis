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
// overwritten. A repeated submission with the same idempotencyKey (a
// dropped-response retry, a double-click) returns the ORIGINAL recorded
// result instead of granting a second time.
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
      throw new HttpError(409, "This token grant has already been submitted.", "ADMIN_TOKEN_GRANT_ALREADY_SUBMITTED");
    }
    throw error;
  }
}
