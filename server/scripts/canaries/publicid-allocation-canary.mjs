// Ticket-specific canary: public registration must never be able to choose,
// reserve, or advance the player public-ID allocator. Run with DATABASE_URL
// unset to exercise this against an isolated in-memory database.
//
//   node server/scripts/canaries/publicid-allocation-canary.mjs
//
import assert from "node:assert/strict";
import { ensureDatabaseSchema } from "../../db/migrate.js";
import { query, withTransaction } from "../../db/pool.js";
import { registerUser, createMigratedPlayerAccount } from "../../services/authService.js";
import { FIRST_PLAYER_NUMERIC_ID } from "../../config/env.js";

async function getAllocatorState() {
  const result = await query("SELECT next_numeric_id FROM public_id_allocators WHERE entity_type = 'player'");
  return Number(result.rows[0]?.next_numeric_id);
}

async function countUsers() {
  const result = await query("SELECT COUNT(*)::int AS count FROM users");
  return Number(result.rows[0]?.count ?? 0);
}

let checks = 0;
function check(label, condition) {
  checks += 1;
  assert.ok(condition, `FAILED: ${label}`);
  console.log(`  [${checks}] PASS - ${label}`);
}

async function main() {
  await ensureDatabaseSchema();

  console.log("== 1. Normal registration allocates sequential IDs ==");
  const before1 = await getAllocatorState();
  const a = await registerUser({ firstName: "A", lastName: "One", email: "a1@test.local", password: "password1" });
  const b = await registerUser({ firstName: "B", lastName: "Two", email: "b2@test.local", password: "password1" });
  check("first registration gets allocator's starting value", a.user.publicId === before1);
  check("second registration is exactly +1", b.user.publicId === a.user.publicId + 1);

  console.log("== 2. existingPublicId in request body is ignored ==");
  const beforeAllocator = await getAllocatorState();
  const evil = await registerUser({
    firstName: "Evil",
    lastName: "Attacker",
    email: "evil@test.local",
    password: "password1",
    existingPublicId: 9000000,
  });
  check("attacker did NOT get the requested ID", evil.user.publicId !== 9000000);
  check("attacker got the normal sequential ID instead", evil.user.publicId === beforeAllocator);
  check("allocator only advanced by 1, not to 9000000+", (await getAllocatorState()) === beforeAllocator + 1);

  console.log("== 3. publicId / playerId fields in body also ignored ==");
  const beforeAllocator2 = await getAllocatorState();
  const evil2 = await registerUser({
    firstName: "Evil",
    lastName: "Two",
    email: "evil2@test.local",
    password: "password1",
    publicId: 8000000,
    playerId: 7000000,
  });
  check("stray publicId/playerId fields have zero effect", evil2.user.publicId === beforeAllocator2);

  console.log("== 4. Invalid values (negative, zero, fractional, string, huge) never mutate allocator ==");
  const beforeAllocator3 = await getAllocatorState();
  const badValues = [-5, 0, 1.5, "123", 99999999999999, Number.MAX_SAFE_INTEGER, NaN, Infinity];
  let counter = 0;
  for (const badValue of badValues) {
    counter += 1;
    const result = await registerUser({
      firstName: "Bad",
      lastName: String(counter),
      email: `bad${counter}@test.local`,
      password: "password1",
      existingPublicId: badValue,
    });
    check(`existingPublicId=${badValue} produces normal sequential allocation`, result.user.publicId === beforeAllocator3 + counter - 1);
  }
  check("allocator advanced by exactly badValues.length, no jumps", (await getAllocatorState()) === beforeAllocator3 + badValues.length);

  console.log("== 5. Failed registration (duplicate email) does not advance the allocator ==");
  const beforeAllocator4 = await getAllocatorState();
  let duplicateRejected = false;
  try {
    await registerUser({ firstName: "Dup", lastName: "Licate", email: "a1@test.local", password: "password1" });
  } catch (error) {
    duplicateRejected = error?.code === "ACCOUNT_EXISTS";
  }
  check("duplicate email registration is rejected", duplicateRejected);
  check("allocator unchanged after failed registration", (await getAllocatorState()) === beforeAllocator4);

  console.log("== 6. Concurrent registrations receive distinct sequential IDs ==");
  const beforeAllocator5 = await getAllocatorState();
  const concurrentResults = await Promise.all(
    Array.from({ length: 8 }, (_, i) =>
      registerUser({ firstName: "Conc", lastName: String(i), email: `conc${i}@test.local`, password: "password1" }),
    ),
  );
  const ids = concurrentResults.map((r) => r.user.publicId);
  const uniqueIds = new Set(ids);
  check("8 concurrent registrations produced 8 unique IDs", uniqueIds.size === 8);
  check("all IDs are within the expected contiguous range", ids.every((id) => id >= beforeAllocator5 && id < beforeAllocator5 + 8));

  console.log("== 7. Transaction rollback on forced failure does not leak an ID ==");
  const beforeAllocator6 = await getAllocatorState();
  let rolledBack = false;
  try {
    await withTransaction(async () => {
      throw new Error("forced failure for canary");
    });
  } catch {
    rolledBack = true;
  }
  check("forced transaction failure throws as expected", rolledBack);
  check("allocator unchanged after unrelated forced rollback", (await getAllocatorState()) === beforeAllocator6);

  console.log("== 8. Migration path (createMigratedPlayerAccount) is internal-only, validates strictly ==");
  const migrated = await createMigratedPlayerAccount({
    firstName: "Legacy",
    lastName: "Player",
    email: "legacy@test.local",
    password: "password1",
    existingPublicId: FIRST_PLAYER_NUMERIC_ID + 500,
  });
  check("internal migration function honors an explicit valid ID", migrated.user.publicId === FIRST_PLAYER_NUMERIC_ID + 500);

  let rejectedUnsafe = false;
  try {
    await createMigratedPlayerAccount({
      firstName: "Bad",
      lastName: "Migration",
      email: "badmigration@test.local",
      password: "password1",
      existingPublicId: 1.5,
    });
  } catch (error) {
    rejectedUnsafe = error?.code === "INVALID_MIGRATED_PUBLIC_ID";
  }
  check("internal migration function rejects non-safe-integer input", rejectedUnsafe);

  let rejectedConflict = false;
  try {
    await createMigratedPlayerAccount({
      firstName: "Conflict",
      lastName: "Test",
      email: "conflict@test.local",
      password: "password1",
      existingPublicId: FIRST_PLAYER_NUMERIC_ID + 500,
    });
  } catch (error) {
    rejectedConflict = error?.code === "PUBLIC_ID_CONFLICT";
  }
  check("internal migration function rejects an already-used ID", rejectedConflict);

  console.log("== 9. Public API never exposes internal fields ==");
  check("response has no internalId leak", !("internalId" in a.user));

  console.log("== 10. Final integrity check ==");
  const totalUsers = await countUsers();
  const allUsersResult = await query("SELECT public_id FROM users");
  const allPublicIds = allUsersResult.rows.map((row) => Number(row.public_id));
  check("public_id UNIQUE constraint holds - no duplicates among all created users", new Set(allPublicIds).size === allPublicIds.length);
  console.log(`  (${totalUsers} total users created during canary run)`);

  console.log(`\nAll ${checks} checks passed.`);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("\nCANARY FAILED:", error.message);
    console.error(error.stack);
    process.exit(1);
  });
