// Read-side companion to insertAdminAuditLog(). Powers the Admin Panel's
// "Admin Logs" tab (moderation/action history) — a plain read, so unlike the
// mutation paths above it does not require a reason and does not itself
// write a new audit row. Callers are expected to gate access with
// assertStaffOrAdmin() before calling this (see adminService.getAdminAuditLog).
export async function listAdminAuditLogs(client, { targetInternalId = null, limit = 50 } = {}) {
  const numericLimit = Number(limit);
  const cappedLimit = Math.max(1, Math.min(200, Number.isFinite(numericLimit) ? Math.floor(numericLimit) : 50));

  const params = [];
  let whereClause = "";
  if (targetInternalId) {
    params.push(targetInternalId);
    whereClause = `WHERE l.target_internal_id = $${params.length}`;
  }
  params.push(cappedLimit);

  const result = await client.query(
    `
      SELECT
        l.id,
        l.actor_internal_id,
        l.actor_public_id,
        l.target_internal_id,
        l.target_public_id,
        l.action_type,
        l.reason,
        l.before_summary,
        l.after_summary,
        l.created_at,
        actor.first_name AS actor_first_name,
        actor.last_name AS actor_last_name,
        target.first_name AS target_first_name,
        target.last_name AS target_last_name
      FROM admin_action_logs l
      LEFT JOIN users actor ON actor.internal_id = l.actor_internal_id
      LEFT JOIN users target ON target.internal_id = l.target_internal_id
      ${whereClause}
      ORDER BY l.created_at DESC, l.id DESC
      LIMIT $${params.length}
    `,
    params,
  );

  return result.rows.map((row) => ({
    id: Number(row.id),
    actorInternalId: row.actor_internal_id,
    actorPublicId: Number(row.actor_public_id),
    actorDisplayName: `${row.actor_first_name ?? ""}${row.actor_last_name ? ` ${row.actor_last_name}` : ""}`.trim() || null,
    targetInternalId: row.target_internal_id,
    targetPublicId: Number(row.target_public_id),
    targetDisplayName: `${row.target_first_name ?? ""}${row.target_last_name ? ` ${row.target_last_name}` : ""}`.trim() || null,
    actionType: row.action_type,
    reason: row.reason,
    beforeSummary: row.before_summary ?? {},
    afterSummary: row.after_summary ?? {},
    createdAt: new Date(row.created_at).getTime(),
  }));
}

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
