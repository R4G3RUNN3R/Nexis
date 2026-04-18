export async function allocateNextPublicNumericId(client, entityType, firstNumericId) {
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

  const current = Math.max(
    firstNumericId,
    Number(result.rows[0]?.next_numeric_id ?? firstNumericId),
  );

  await client.query(
    `
      UPDATE public_id_allocators
      SET next_numeric_id = $2,
          updated_at = NOW()
      WHERE entity_type = $1
    `,
    [entityType, current + 1],
  );

  return current;
}

export async function reservePublicNumericId(client, entityType, desiredNumericId, firstNumericId) {
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

  const current = Math.max(
    firstNumericId,
    Number(result.rows[0]?.next_numeric_id ?? firstNumericId),
  );
  const nextNumericId = Math.max(current, desiredNumericId + 1);

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
