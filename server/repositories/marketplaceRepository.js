function mapListingRow(row) {
  if (!row) return null;
  return {
    id: Number(row.id),
    sellerInternalId: row.seller_internal_id,
    sellerPublicId: Number(row.seller_public_id),
    sellerName: row.seller_name,
    itemId: row.item_id,
    quantity: Number(row.quantity),
    unitPrice: Number(row.unit_price),
    cityId: row.city_id,
    status: row.status,
    buyerInternalId: row.buyer_internal_id ?? null,
    buyerPublicId: row.buyer_public_id ? Number(row.buyer_public_id) : null,
    createdAt: row.created_at ? new Date(row.created_at).getTime() : null,
    expiresAt: row.expires_at ? new Date(row.expires_at).getTime() : null,
    soldAt: row.sold_at ? new Date(row.sold_at).getTime() : null,
    cancelledAt: row.cancelled_at ? new Date(row.cancelled_at).getTime() : null,
  };
}
export async function createMarketplaceListing(client, input) {
  const result = await client.query(
    `INSERT INTO marketplace_listings (seller_internal_id, seller_public_id, seller_name, item_id, quantity, unit_price, city_id, expires_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, NOW() + INTERVAL '7 days') RETURNING *`,
    [input.sellerInternalId, input.sellerPublicId, input.sellerName, input.itemId, input.quantity, input.unitPrice, input.cityId],
  );
  return mapListingRow(result.rows[0]);
}
export async function findMarketplaceListingById(client, listingId, options = {}) {
  const sql = `SELECT * FROM marketplace_listings WHERE id = $1${options.forUpdate ? " FOR UPDATE" : ""}`;
  const result = await client.query(sql, [listingId]);
  return mapListingRow(result.rows[0]);
}
export async function listMarketplaceListings(client, filters = {}) {
  const where = ["status = 'active'", "expires_at > NOW()"];
  const params = [];
  function add(value, clause) { params.push(value); where.push(clause.replace("?", `$${params.length}`)); }
  if (filters.cityId) add(filters.cityId, "city_id = ?");
  if (filters.itemId) add(filters.itemId, "item_id = ?");
  const result = await client.query(`SELECT * FROM marketplace_listings WHERE ${where.join(" AND ")} ORDER BY unit_price ASC, created_at DESC LIMIT 80`, params);
  return result.rows.map(mapListingRow);
}
export async function updateMarketplaceListingStatus(client, listingId, status, fields = {}) {
  const result = await client.query(
    `UPDATE marketplace_listings SET status = $2, buyer_internal_id = $3, buyer_public_id = $4, sold_at = $5, cancelled_at = $6, updated_at = NOW() WHERE id = $1 RETURNING *`,
    [listingId, status, fields.buyerInternalId ?? null, fields.buyerPublicId ?? null, fields.soldAt ? new Date(fields.soldAt) : null, fields.cancelledAt ? new Date(fields.cancelledAt) : null],
  );
  return mapListingRow(result.rows[0]);
}
export async function expireOldMarketplaceListings(client) {
  await client.query(`UPDATE marketplace_listings SET status = 'expired', updated_at = NOW() WHERE status = 'active' AND expires_at <= NOW()`);
}
