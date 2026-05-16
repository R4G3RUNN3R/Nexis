const DAY_MS = 24 * 60 * 60 * 1000;

const asInt = (value, fallback = 0) => {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return fallback;
  return Math.max(0, Math.floor(numeric));
};

const asRecord = (value) => (value && typeof value === "object" && !Array.isArray(value) ? value : {});

function mapBaseRow(row) {
  if (!row) return null;
  return {
    id: Number(row.id),
    organizationInternalId: row.organization_internal_id,
    ownershipMode: row.ownership_mode,
    propertyKey: row.property_key,
    status: row.status,
    monthlyUpkeepGold: asInt(row.monthly_upkeep_gold),
    periodDueGold: asInt(row.period_due_gold),
    periodPaidGold: asInt(row.period_paid_gold),
    periodStartedAt: row.period_started_at ? new Date(row.period_started_at).getTime() : Date.now(),
    nextReviewAt: row.next_review_at ? new Date(row.next_review_at).getTime() : Date.now(),
    confiscatedAt: row.confiscated_at ? new Date(row.confiscated_at).getTime() : null,
    buybackUntil: row.buyback_until ? new Date(row.buyback_until).getTime() : null,
    debtGoldAtConfiscation: row.debt_gold_at_confiscation == null ? null : asInt(row.debt_gold_at_confiscation),
    leaderInternalId: row.leader_internal_id ?? null,
    metadata: asRecord(row.metadata),
    createdAt: row.created_at ? new Date(row.created_at).getTime() : Date.now(),
    updatedAt: row.updated_at ? new Date(row.updated_at).getTime() : Date.now(),
  };
}

function mapStorageRow(row) {
  if (!row) return null;
  return {
    organizationInternalId: row.organization_internal_id,
    itemId: row.item_id,
    quantity: asInt(row.quantity),
  };
}

function mapAuctionRow(row) {
  if (!row) return null;
  return {
    id: Number(row.id),
    baseId: Number(row.base_id),
    organizationInternalId: row.organization_internal_id,
    status: row.status,
    opensAt: row.opens_at ? new Date(row.opens_at).getTime() : Date.now(),
    closesAt: row.closes_at ? new Date(row.closes_at).getTime() : Date.now() + DAY_MS,
    openingBidGold: asInt(row.opening_bid_gold),
    currentBidGold: asInt(row.current_bid_gold),
    currentBidderInternalId: row.current_bidder_internal_id ?? null,
    debtGoldAtConfiscation: asInt(row.debt_gold_at_confiscation),
    metadata: asRecord(row.metadata),
    createdAt: row.created_at ? new Date(row.created_at).getTime() : Date.now(),
    updatedAt: row.updated_at ? new Date(row.updated_at).getTime() : Date.now(),
  };
}

export async function findOrganizationBaseByOrganizationInternalId(client, organizationInternalId) {
  const result = await client.query(
    `
      SELECT *
      FROM organization_bases
      WHERE organization_internal_id = $1
      LIMIT 1
    `,
    [organizationInternalId],
  );
  return mapBaseRow(result.rows[0]);
}

export async function listDueOrganizationBaseReviews(client, nowDate = new Date()) {
  const result = await client.query(
    `
      SELECT *
      FROM organization_bases
      WHERE status = 'active'
        AND next_review_at <= $1
      ORDER BY next_review_at ASC
    `,
    [nowDate],
  );

  return result.rows.map(mapBaseRow);
}

export async function listExpiredOrganizationBaseBuybacks(client, nowDate = new Date()) {
  const result = await client.query(
    `
      SELECT *
      FROM organization_bases
      WHERE status = 'confiscated'
        AND buyback_until IS NOT NULL
        AND buyback_until <= $1
      ORDER BY buyback_until ASC
    `,
    [nowDate],
  );

  return result.rows.map(mapBaseRow);
}

export async function listOrganizationBaseStorage(client, organizationInternalId) {
  const result = await client.query(
    `
      SELECT organization_internal_id, item_id, quantity
      FROM organization_base_storage
      WHERE organization_internal_id = $1
      ORDER BY item_id ASC
    `,
    [organizationInternalId],
  );

  return result.rows.map(mapStorageRow);
}

export async function clearOrganizationBaseStorage(client, organizationInternalId) {
  await client.query(
    `DELETE FROM organization_base_storage WHERE organization_internal_id = $1`,
    [organizationInternalId],
  );
}

export async function recordOrganizationBaseEvent(client, entry) {
  await client.query(
    `
      INSERT INTO organization_base_events (
        organization_internal_id,
        base_id,
        actor_internal_id,
        event_type,
        summary
      )
      VALUES ($1, $2, $3, $4, $5::jsonb)
    `,
    [
      entry.organizationInternalId,
      entry.baseId ?? null,
      entry.actorInternalId ?? null,
      entry.eventType,
      JSON.stringify(entry.summary ?? {}),
    ],
  );
}

export async function recordOrganizationBasePayment(client, entry) {
  await client.query(
    `
      INSERT INTO organization_base_payments (
        base_id,
        organization_internal_id,
        source,
        amount_gold,
        summary
      )
      VALUES ($1, $2, $3, $4, $5::jsonb)
    `,
    [
      entry.baseId,
      entry.organizationInternalId,
      entry.source,
      asInt(entry.amountGold),
      JSON.stringify(entry.summary ?? {}),
    ],
  );
}

export async function updateOrganizationBaseFinancials(client, baseId, patch) {
  const result = await client.query(
    `
      UPDATE organization_bases
      SET
        period_due_gold = $2,
        period_paid_gold = $3,
        period_started_at = $4,
        next_review_at = $5,
        status = $6,
        confiscated_at = $7,
        buyback_until = $8,
        debt_gold_at_confiscation = $9,
        leader_internal_id = $10,
        metadata = $11::jsonb,
        updated_at = NOW()
      WHERE id = $1
      RETURNING *
    `,
    [
      baseId,
      asInt(patch.periodDueGold),
      asInt(patch.periodPaidGold),
      patch.periodStartedAt,
      patch.nextReviewAt,
      patch.status,
      patch.confiscatedAt ?? null,
      patch.buybackUntil ?? null,
      patch.debtGoldAtConfiscation == null ? null : asInt(patch.debtGoldAtConfiscation),
      patch.leaderInternalId ?? null,
      JSON.stringify(asRecord(patch.metadata)),
    ],
  );

  return mapBaseRow(result.rows[0]);
}

export async function findOpenAuctionByBaseId(client, baseId) {
  const result = await client.query(
    `
      SELECT *
      FROM organization_base_auctions
      WHERE base_id = $1
        AND status = 'open'
      ORDER BY created_at DESC
      LIMIT 1
    `,
    [baseId],
  );
  return mapAuctionRow(result.rows[0]);
}

export async function createOrganizationBaseAuction(client, payload) {
  const result = await client.query(
    `
      INSERT INTO organization_base_auctions (
        base_id,
        organization_internal_id,
        status,
        opens_at,
        closes_at,
        opening_bid_gold,
        current_bid_gold,
        current_bidder_internal_id,
        debt_gold_at_confiscation,
        metadata,
        updated_at
      )
      VALUES ($1, $2, 'open', $3, $4, $5, $6, $7, $8, $9::jsonb, NOW())
      RETURNING *
    `,
    [
      payload.baseId,
      payload.organizationInternalId,
      payload.opensAt,
      payload.closesAt,
      asInt(payload.openingBidGold),
      asInt(payload.currentBidGold, asInt(payload.openingBidGold)),
      payload.currentBidderInternalId ?? null,
      asInt(payload.debtGoldAtConfiscation),
      JSON.stringify(asRecord(payload.metadata)),
    ],
  );

  return mapAuctionRow(result.rows[0]);
}

export async function markOrganizationBaseAuctionState(client, auctionId, status, metadata = {}) {
  const result = await client.query(
    `
      UPDATE organization_base_auctions
      SET
        status = $2,
        metadata = $3::jsonb,
        updated_at = NOW()
      WHERE id = $1
      RETURNING *
    `,
    [auctionId, status, JSON.stringify(asRecord(metadata))],
  );
  return mapAuctionRow(result.rows[0]);
}

function mapEventRow(row) {
  return {
    id: Number(row.id),
    organizationInternalId: row.organization_internal_id,
    baseId: row.base_id == null ? null : Number(row.base_id),
    actorInternalId: row.actor_internal_id ?? null,
    eventType: row.event_type,
    summary: asRecord(row.summary),
    createdAt: row.created_at ? new Date(row.created_at).getTime() : Date.now(),
  };
}

export async function createOrganizationBase(client, payload) {
  const result = await client.query(
    `
      INSERT INTO organization_bases (
        organization_internal_id,
        ownership_mode,
        property_key,
        status,
        monthly_upkeep_gold,
        period_due_gold,
        period_paid_gold,
        period_started_at,
        next_review_at,
        confiscated_at,
        buyback_until,
        debt_gold_at_confiscation,
        leader_internal_id,
        metadata,
        updated_at
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NULL, NULL, NULL, $10, $11::jsonb, NOW())
      RETURNING *
    `,
    [
      payload.organizationInternalId,
      payload.ownershipMode,
      payload.propertyKey,
      payload.status ?? "active",
      asInt(payload.monthlyUpkeepGold),
      asInt(payload.periodDueGold),
      asInt(payload.periodPaidGold),
      payload.periodStartedAt,
      payload.nextReviewAt,
      payload.leaderInternalId ?? null,
      JSON.stringify(asRecord(payload.metadata)),
    ],
  );

  return mapBaseRow(result.rows[0]);
}

export async function listOrganizationBaseEvents(client, organizationInternalId, limit = 25) {
  const safeLimit = Math.max(1, Math.min(200, asInt(limit, 25)));
  const result = await client.query(
    `
      SELECT id, organization_internal_id, base_id, actor_internal_id, event_type, summary, created_at
      FROM organization_base_events
      WHERE organization_internal_id = $1
      ORDER BY created_at DESC
      LIMIT $2
    `,
    [organizationInternalId, safeLimit],
  );

  return result.rows.map(mapEventRow);
}

export async function listActiveOrganizationBases(client) {
  const result = await client.query(
    `
      SELECT *
      FROM organization_bases
      WHERE status = 'active'
      ORDER BY next_review_at ASC
    `,
  );
  return result.rows.map(mapBaseRow);
}

export async function findOrganizationBaseByOrganizationInternalIdForUpdate(client, organizationInternalId) {
  const result = await client.query(
    `
      SELECT *
      FROM organization_bases
      WHERE organization_internal_id = $1
      LIMIT 1
      FOR UPDATE
    `,
    [organizationInternalId],
  );

  return mapBaseRow(result.rows[0]);
}

export async function findOrganizationBaseById(client, baseId) {
  const result = await client.query(
    `
      SELECT *
      FROM organization_bases
      WHERE id = $1
      LIMIT 1
    `,
    [baseId],
  );
  return mapBaseRow(result.rows[0]);
}

export async function findOrganizationBaseByIdForUpdate(client, baseId) {
  const result = await client.query(
    `
      SELECT *
      FROM organization_bases
      WHERE id = $1
      LIMIT 1
      FOR UPDATE
    `,
    [baseId],
  );
  return mapBaseRow(result.rows[0]);
}

export async function transferOrganizationBaseOwnership(client, baseId, nextOrganizationInternalId, patch = {}) {
  const result = await client.query(
    `
      UPDATE organization_bases
      SET
        organization_internal_id = $2,
        status = $3,
        period_due_gold = $4,
        period_paid_gold = $5,
        period_started_at = $6,
        next_review_at = $7,
        confiscated_at = $8,
        buyback_until = $9,
        debt_gold_at_confiscation = $10,
        leader_internal_id = $11,
        metadata = $12::jsonb,
        updated_at = NOW()
      WHERE id = $1
      RETURNING *
    `,
    [
      baseId,
      nextOrganizationInternalId,
      patch.status ?? "active",
      asInt(patch.periodDueGold),
      asInt(patch.periodPaidGold),
      patch.periodStartedAt ?? new Date(),
      patch.nextReviewAt ?? new Date(),
      patch.confiscatedAt ?? null,
      patch.buybackUntil ?? null,
      patch.debtGoldAtConfiscation == null ? null : asInt(patch.debtGoldAtConfiscation),
      patch.leaderInternalId ?? null,
      JSON.stringify(asRecord(patch.metadata)),
    ],
  );

  return mapBaseRow(result.rows[0]);
}

export async function listOpenOrganizationBaseAuctions(client, options = {}) {
  const clauses = ["a.status = 'open'"];
  const values = [];

  if (typeof options.organizationType === "string" && options.organizationType.trim()) {
    values.push(options.organizationType.trim());
    clauses.push(`o.type = $${values.length}`);
  }

  const result = await client.query(
    `
      SELECT a.*
      FROM organization_base_auctions a
      JOIN organizations o ON o.internal_id = a.organization_internal_id
      WHERE ${clauses.join(" AND ")}
      ORDER BY a.closes_at ASC, a.id ASC
    `,
    values,
  );

  return result.rows.map(mapAuctionRow);
}

export async function listClosableOrganizationBaseAuctions(client, nowDate = new Date()) {
  const result = await client.query(
    `
      SELECT *
      FROM organization_base_auctions
      WHERE status = 'open'
        AND closes_at <= $1
      ORDER BY closes_at ASC, id ASC
    `,
    [nowDate],
  );

  return result.rows.map(mapAuctionRow);
}

export async function findOrganizationBaseAuctionByIdForUpdate(client, auctionId) {
  const result = await client.query(
    `
      SELECT *
      FROM organization_base_auctions
      WHERE id = $1
      LIMIT 1
      FOR UPDATE
    `,
    [auctionId],
  );

  return mapAuctionRow(result.rows[0]);
}

export async function updateOrganizationBaseAuctionBid(client, auctionId, patch = {}) {
  const sets = [];
  const values = [auctionId];

  if (Object.prototype.hasOwnProperty.call(patch, "currentBidGold")) {
    values.push(asInt(patch.currentBidGold));
    sets.push(`current_bid_gold = $${values.length}`);
  }
  if (Object.prototype.hasOwnProperty.call(patch, "currentBidderInternalId")) {
    values.push(patch.currentBidderInternalId ?? null);
    sets.push(`current_bidder_internal_id = $${values.length}`);
  }
  if (Object.prototype.hasOwnProperty.call(patch, "closesAt")) {
    values.push(patch.closesAt ?? null);
    sets.push(`closes_at = $${values.length}`);
  }
  if (Object.prototype.hasOwnProperty.call(patch, "metadata")) {
    values.push(JSON.stringify(asRecord(patch.metadata)));
    sets.push(`metadata = $${values.length}::jsonb`);
  }

  if (!sets.length) {
    const current = await client.query(
      `SELECT * FROM organization_base_auctions WHERE id = $1 LIMIT 1`,
      [auctionId],
    );
    return mapAuctionRow(current.rows[0]);
  }

  const result = await client.query(
    `
      UPDATE organization_base_auctions
      SET ${sets.join(", ")},
          updated_at = NOW()
      WHERE id = $1
      RETURNING *
    `,
    values,
  );

  return mapAuctionRow(result.rows[0]);
}

export async function deleteOrganizationBaseById(client, baseId) {
  await client.query(
    "DELETE FROM organization_bases WHERE id = $1",
    [baseId],
  );
}

export async function findOrganizationBaseStorageItemForUpdate(client, organizationInternalId, itemId) {
  const result = await client.query(
    `
      SELECT organization_internal_id, item_id, quantity
      FROM organization_base_storage
      WHERE organization_internal_id = $1 AND item_id = $2
      FOR UPDATE
    `,
    [organizationInternalId, itemId],
  );

  const row = result.rows[0];
  if (!row) return null;
  return mapStorageRow(row);
}

export async function upsertOrganizationBaseStorageItem(client, organizationInternalId, itemId, quantityDelta) {
  const delta = asInt(quantityDelta);
  if (delta <= 0) {
    return findOrganizationBaseStorageItemForUpdate(client, organizationInternalId, itemId);
  }

  const result = await client.query(
    `
      INSERT INTO organization_base_storage (organization_internal_id, item_id, quantity, updated_at)
      VALUES ($1, $2, $3, NOW())
      ON CONFLICT (organization_internal_id, item_id)
      DO UPDATE SET quantity = organization_base_storage.quantity + EXCLUDED.quantity, updated_at = NOW()
      RETURNING organization_internal_id, item_id, quantity
    `,
    [organizationInternalId, itemId, delta],
  );

  return mapStorageRow(result.rows[0]);
}

export async function decrementOrganizationBaseStorageItem(client, organizationInternalId, itemId, quantity) {
  const needed = asInt(quantity);
  if (needed <= 0) {
    return findOrganizationBaseStorageItemForUpdate(client, organizationInternalId, itemId);
  }

  const result = await client.query(
    `
      UPDATE organization_base_storage
      SET quantity = quantity - $3, updated_at = NOW()
      WHERE organization_internal_id = $1
        AND item_id = $2
        AND quantity >= $3
      RETURNING organization_internal_id, item_id, quantity
    `,
    [organizationInternalId, itemId, needed],
  );

  return mapStorageRow(result.rows[0] ?? null);
}
