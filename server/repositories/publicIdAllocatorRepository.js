function getAllocatorStep(entityType) {
  return entityType === "guild" || entityType === "consortium" ? 2 : 1;
}

async function getObservedNextNumericId(client, entityType, firstNumericId, step) {
  if (entityType === "player") {
    const result = await client.query("SELECT COALESCE(MAX(public_id), ($1::int - $2::int)) + $2::int AS next_id FROM users", [firstNumericId, step]);
    return Number(result.rows[0]?.next_id ?? firstNumericId);
  }

  if (entityType === "guild" || entityType === "consortium") {
    const result = await client.query(
      "SELECT COALESCE(MAX(public_id), ($2::int - $3::int)) + $3::int AS next_id FROM organizations WHERE type = $1",
      [entityType, firstNumericId, step],
    );
    return Number(result.rows[0]?.next_id ?? firstNumericId);
  }

  return firstNumericId;
}

export async function allocateNextPublicNumericId(client, entityType, firstNumericId) {
  const step = getAllocatorStep(entityType);
  await client.query(
    `
      INSERT INTO public_id_allocators (entity_type, next_numeric_id)
      VALUES ($1, $2)
      ON CONFLICT (entity_type) DO NOTHING
    `,
    [entityType, firstNumericId],
  );

  const result = await client.query(
    `
      SELECT next_numeric_id
      FROM public_id_allocators
      WHERE entity_type = $1
      FOR UPDATE
    `,
    [entityType],
  );

  const observedNext = await getObservedNextNumericId(client, entityType, firstNumericId, step);
  const current = Math.max(
    firstNumericId,
    Number(result.rows[0]?.next_numeric_id ?? firstNumericId),
    observedNext,
  );

  await client.query(
    `
      UPDATE public_id_allocators
      SET next_numeric_id = $2,
          updated_at = NOW()
      WHERE entity_type = $1
    `,
    [entityType, current + step],
  );

  return current;
}

export async function reservePublicNumericId(client, entityType, desiredNumericId, firstNumericId) {
  const step = getAllocatorStep(entityType);
  await client.query(
    `
      INSERT INTO public_id_allocators (entity_type, next_numeric_id)
      VALUES ($1, $2)
      ON CONFLICT (entity_type) DO NOTHING
    `,
    [entityType, firstNumericId],
  );

  const result = await client.query(
    `
      SELECT next_numeric_id
      FROM public_id_allocators
      WHERE entity_type = $1
      FOR UPDATE
    `,
    [entityType],
  );

  const observedNext = await getObservedNextNumericId(client, entityType, firstNumericId, step);
  const current = Math.max(
    firstNumericId,
    Number(result.rows[0]?.next_numeric_id ?? firstNumericId),
    observedNext,
  );
  const nextNumericId = Math.max(current, desiredNumericId + step);

  await client.query(
    `
      UPDATE public_id_allocators
      SET next_numeric_id = $2,
          updated_at = NOW()
      WHERE entity_type = $1
    `,
    [entityType, nextNumericId],
  );

  return desiredNumericId;
}
