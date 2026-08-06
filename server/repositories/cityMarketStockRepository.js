const asInt = (value, fallback = 0) => {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return fallback;
  return Math.max(0, Math.floor(numeric));
};

function mapStockRow(row) {
  if (!row) return null;
  return {
    marketType: row.market_type,
    cityId: row.city_id,
    itemId: row.item_id,
    remainingQuantity: asInt(row.remaining_quantity),
    totalQuantity: asInt(row.total_quantity),
    updatedAt: row.updated_at ? new Date(row.updated_at).getTime() : Date.now(),
  };
}

// Idempotent: only seeds the row the first time this (marketType, cityId, itemId) is ever seen.
// Later calls with a different defaultQuantity are no-ops for existing rows on purpose — an item's
// global cap is fixed at first-seed time, not silently rewritten by later reads.
export async function ensureCityMarketStockRow(client, marketType, cityId, itemId, defaultQuantity = 5000) {
  const seed = asInt(defaultQuantity, 5000);
  await client.query(
    `
      INSERT INTO city_market_stock (market_type, city_id, item_id, remaining_quantity, total_quantity)
      VALUES ($1, $2, $3, $4, $4)
      ON CONFLICT (market_type, city_id, item_id) DO NOTHING
    `,
    [marketType, cityId, itemId, seed],
  );
}

export async function getCityMarketStock(client, marketType, cityId, itemId, defaultQuantity = 5000) {
  await ensureCityMarketStockRow(client, marketType, cityId, itemId, defaultQuantity);
  const result = await client.query(
    `SELECT * FROM city_market_stock WHERE market_type = $1 AND city_id = $2 AND item_id = $3`,
    [marketType, cityId, itemId],
  );
  return mapStockRow(result.rows[0]);
}

// Batch read for serializing an entire market screen without one round trip per stock line.
export async function listCityMarketStock(client, marketType, cityId, itemIds, defaultQuantity = 5000) {
  const uniqueItemIds = Array.from(new Set(itemIds.filter((itemId) => typeof itemId === "string" && itemId)));
  for (const itemId of uniqueItemIds) {
    await ensureCityMarketStockRow(client, marketType, cityId, itemId, defaultQuantity);
  }
  if (!uniqueItemIds.length) return {};
  const result = await client.query(
    `SELECT * FROM city_market_stock WHERE market_type = $1 AND city_id = $2 AND item_id = ANY($3::text[])`,
    [marketType, cityId, uniqueItemIds],
  );
  const map = {};
  for (const row of result.rows) {
    const mapped = mapStockRow(row);
    map[mapped.itemId] = mapped;
  }
  return map;
}

// Atomic conditional decrement: only succeeds (returns the row) if enough stock remains at the
// moment of the UPDATE, so two concurrent buyers racing the last units can't both succeed.
// Returns null when there isn't enough remaining stock.
export async function decrementCityMarketStock(client, marketType, cityId, itemId, quantity, defaultQuantity = 5000) {
  const needed = asInt(quantity);
  if (needed <= 0) return getCityMarketStock(client, marketType, cityId, itemId, defaultQuantity);
  await ensureCityMarketStockRow(client, marketType, cityId, itemId, defaultQuantity);
  const result = await client.query(
    `
      UPDATE city_market_stock
      SET remaining_quantity = remaining_quantity - $4, updated_at = NOW()
      WHERE market_type = $1 AND city_id = $2 AND item_id = $3 AND remaining_quantity >= $4
      RETURNING *
    `,
    [marketType, cityId, itemId, needed],
  );
  return mapStockRow(result.rows[0] ?? null);
}
