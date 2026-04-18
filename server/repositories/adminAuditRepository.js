export async function insertAdminAuditLog(
  client,
  { actor, target, actionType, reason, beforeSummary, afterSummary },
) {
  await client.query(
    `
      INSERT INTO admin_action_logs (
        actor_internal_id,
        actor_public_id,
        target_internal_id,
        target_public_id,
        action_type,
        reason,
        before_summary,
        after_summary
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb, $8::jsonb)
    `,
    [
      actor.internalId,
      actor.publicId,
      target.internalId,
      target.publicId,
      actionType,
      reason,
      JSON.stringify(beforeSummary ?? {}),
      JSON.stringify(afterSummary ?? {}),
    ],
  );
}
