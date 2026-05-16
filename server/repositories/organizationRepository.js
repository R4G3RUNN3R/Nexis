function mapOrganizationRow(row) {
  if (!row) return null;

  return {
    internalId: row.internal_id,
    publicId: Number(row.public_id),
    type: row.type,
    name: row.name,
    tag: row.tag ?? null,
    founderInternalId: row.founder_internal_id,
    founderPublicId: Number(row.founder_public_id),
    description: row.description,
    statusText: row.status_text,
    consortiumTypeKey: row.consortium_type_key,
    consortiumTypeName: row.consortium_type_name,
    passiveBonusSummary: row.passive_bonus_summary,
    creationCost: Number(row.creation_cost ?? 0),
    treasury: row.treasury ?? { copper: 0, silver: 0, gold: 0, platinum: 0 },
    metadata: row.metadata ?? {},
    createdAt: row.created_at ? new Date(row.created_at).getTime() : Date.now(),
    updatedAt: row.updated_at ? new Date(row.updated_at).getTime() : Date.now(),
  };
}

function mapRoleRow(row) {
  return {
    roleKey: row.role_key,
    displayName: row.display_name,
    rankOrder: Number(row.rank_order ?? 0),
    permissions: Array.isArray(row.permissions) ? row.permissions : [],
    isSystemRole: Boolean(row.is_system_role),
  };
}

function mapMemberRow(row) {
  return {
    userInternalId: row.user_internal_id,
    publicId: Number(row.user_public_id),
    displayName: row.display_name,
    roleKey: row.role_key,
    joinedAt: row.joined_at ? new Date(row.joined_at).getTime() : Date.now(),
  };
}

function mapLogRow(row) {
  return {
    actionType: row.action_type,
    actorInternalId: row.actor_internal_id,
    actorPublicId: row.actor_public_id == null ? null : Number(row.actor_public_id),
    summary: row.summary ?? {},
    createdAt: row.created_at ? new Date(row.created_at).getTime() : Date.now(),
  };
}

async function hydrateOrganization(client, row) {
  const organization = mapOrganizationRow(row);
  if (!organization) return null;

  const rolesResult = await client.query(
    `
      SELECT role_key, display_name, rank_order, permissions, is_system_role
      FROM organization_roles
      WHERE organization_internal_id = $1
      ORDER BY rank_order ASC
    `,
    [organization.internalId],
  );
  const membersResult = await client.query(
    `
      SELECT user_internal_id, user_public_id, display_name, role_key, joined_at
      FROM organization_members
      WHERE organization_internal_id = $1
      ORDER BY joined_at ASC
    `,
    [organization.internalId],
  );
  const logsResult = await client.query(
    `
      SELECT action_type, actor_internal_id, actor_public_id, summary, created_at
      FROM organization_logs
      WHERE organization_internal_id = $1
      ORDER BY created_at DESC
      LIMIT 20
    `,
    [organization.internalId],
  );

  return {
    ...organization,
    roles: rolesResult.rows.map(mapRoleRow),
    members: membersResult.rows.map(mapMemberRow),
    logs: logsResult.rows.map(mapLogRow),
  };
}

export async function findOrganizationForUserByType(client, userInternalId, type) {
  const result = await client.query(
    `
      SELECT o.*
      FROM organizations o
      JOIN organization_members m
        ON m.organization_internal_id = o.internal_id
      WHERE m.user_internal_id = $1
        AND o.type = $2
      ORDER BY o.created_at ASC
      LIMIT 1
    `,
    [userInternalId, type],
  );

  return hydrateOrganization(client, result.rows[0]);
}

export async function findOrganizationByInternalId(client, organizationInternalId) {
  const result = await client.query(`SELECT * FROM organizations WHERE internal_id = $1 LIMIT 1`, [organizationInternalId]);
  return hydrateOrganization(client, result.rows[0]);
}

export async function findOrganizationByPublicId(client, publicId) {
  const result = await client.query(`SELECT * FROM organizations WHERE public_id = $1 LIMIT 1`, [publicId]);
  return hydrateOrganization(client, result.rows[0]);
}

export async function createOrganization(client, organization) {
  const result = await client.query(
    `
      INSERT INTO organizations (
        internal_id,
        public_id,
        type,
        name,
        tag,
        founder_internal_id,
        founder_public_id,
        description,
        status_text,
        consortium_type_key,
        consortium_type_name,
        passive_bonus_summary,
        creation_cost,
        treasury,
        metadata
      )
      VALUES (
        $1,
        $2,
        $3,
        $4,
        $5,
        $6,
        $7,
        $8,
        $9,
        $10,
        $11,
        $12,
        $13,
        $14::jsonb,
        $15::jsonb
      )
      RETURNING *
    `,
    [
      organization.internalId,
      organization.publicId,
      organization.type,
      organization.name,
      organization.tag ?? null,
      organization.founderInternalId,
      organization.founderPublicId,
      organization.description ?? "",
      organization.statusText ?? "",
      organization.consortiumTypeKey ?? null,
      organization.consortiumTypeName ?? null,
      organization.passiveBonusSummary ?? "",
      organization.creationCost ?? 0,
      JSON.stringify(organization.treasury ?? {}),
      JSON.stringify(organization.metadata ?? {}),
    ],
  );

  return mapOrganizationRow(result.rows[0]);
}

export async function updateOrganizationDetails(client, organizationInternalId, patch) {
  const current = await client.query(`SELECT * FROM organizations WHERE internal_id = $1 LIMIT 1`, [organizationInternalId]);
  const existing = mapOrganizationRow(current.rows[0]);
  if (!existing) return null;

  const treasury = patch.treasury ? { ...existing.treasury, ...patch.treasury } : existing.treasury;
  const metadata = patch.metadata ? { ...existing.metadata, ...patch.metadata } : existing.metadata;

  const result = await client.query(
    `
      UPDATE organizations
      SET
        description = $2,
        status_text = $3,
        passive_bonus_summary = $4,
        treasury = $5::jsonb,
        metadata = $6::jsonb,
        updated_at = NOW()
      WHERE internal_id = $1
      RETURNING *
    `,
    [
      organizationInternalId,
      patch.description ?? existing.description,
      patch.statusText ?? existing.statusText,
      patch.passiveBonusSummary ?? existing.passiveBonusSummary,
      JSON.stringify(treasury),
      JSON.stringify(metadata),
    ],
  );

  return hydrateOrganization(client, result.rows[0]);
}

export async function replaceOrganizationRoles(client, organizationInternalId, roles) {
  await client.query(`DELETE FROM organization_roles WHERE organization_internal_id = $1`, [organizationInternalId]);

  for (const role of roles) {
    await client.query(
      `
        INSERT INTO organization_roles (
          organization_internal_id,
          role_key,
          display_name,
          rank_order,
          permissions,
          is_system_role
        )
        VALUES ($1, $2, $3, $4, $5::jsonb, $6)
      `,
      [
        organizationInternalId,
        role.roleKey,
        role.displayName,
        role.rankOrder,
        JSON.stringify(role.permissions ?? []),
        role.isSystemRole ?? true,
      ],
    );
  }
}

export async function addOrganizationMember(client, organizationInternalId, member) {
  await client.query(
    `
      INSERT INTO organization_members (
        organization_internal_id,
        user_internal_id,
        user_public_id,
        display_name,
        role_key
      )
      VALUES ($1, $2, $3, $4, $5)
      ON CONFLICT (organization_internal_id, user_internal_id) DO UPDATE SET
        user_public_id = EXCLUDED.user_public_id,
        display_name = EXCLUDED.display_name,
        role_key = EXCLUDED.role_key
    `,
    [organizationInternalId, member.userInternalId, member.userPublicId, member.displayName, member.roleKey],
  );
}

export async function insertOrganizationLog(client, organizationInternalId, logEntry) {
  await client.query(
    `
      INSERT INTO organization_logs (
        organization_internal_id,
        actor_internal_id,
        actor_public_id,
        action_type,
        summary
      )
      VALUES ($1, $2, $3, $4, $5::jsonb)
    `,
    [
      organizationInternalId,
      logEntry.actorInternalId ?? null,
      logEntry.actorPublicId ?? null,
      logEntry.actionType,
      JSON.stringify(logEntry.summary ?? {}),
    ],
  );
}


export async function listOrganizationsByType(client, type) {
  const result = await client.query(
    `SELECT * FROM organizations WHERE type = $1 ORDER BY created_at DESC`,
    [type],
  );

  const organizations = [];
  for (const row of result.rows) {
    organizations.push(await hydrateOrganization(client, row));
  }
  return organizations;
}

export async function removeOrganizationMember(client, organizationInternalId, userInternalId) {
  await client.query(
    `DELETE FROM organization_members WHERE organization_internal_id = $1 AND user_internal_id = $2`,
    [organizationInternalId, userInternalId],
  );
}

export async function updateOrganizationMemberRole(client, organizationInternalId, userInternalId, roleKey) {
  await client.query(
    `
      UPDATE organization_members
      SET role_key = $3
      WHERE organization_internal_id = $1
        AND user_internal_id = $2
    `,
    [organizationInternalId, userInternalId, roleKey],
  );
}
