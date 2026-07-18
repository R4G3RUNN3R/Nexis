// Regression canary for legal city-market selling. It caught a bug where
// sellCityMarketItemForUser referenced `now` before declaring it, causing
// legal trade sales to fail before persistence.
//
//   unset DATABASE_URL && node server/scripts/canaries/city-market-sell-canary.mjs
//
import assert from "node:assert/strict";
import { ensureDatabaseSchema } from "../../db/migrate.js";
import { withTransaction } from "../../db/pool.js";
import { registerUser, getSessionUser } from "../../services/authService.js";
import { sellCityMarketItemForUser } from "../../services/cityEconomyService.js";
import { findPlayerStateByUserInternalId, upsertPlayerRuntimeState } from "../../repositories/playerStateRepository.js";
import { buildMutableRuntimeState } from "../../lib/runtimePlayerState.js";

let checks = 0;
function check(label, condition) {
  checks += 1;
  assert.ok(condition, `FAILED: ${label}`);
  console.log(`  [${checks}] PASS - ${label}`);
}

async function seedTradeGood(user) {
  await withTransaction(async (client) => {
    const playerState = await findPlayerStateByUserInternalId(client, user.internalId);
    const runtimeState = buildMutableRuntimeState(user, playerState);
    runtimeState.player.inventory = { ...(runtimeState.player.inventory ?? {}), wild_herb: 2 };
    runtimeState.player.gold = 100;
    runtimeState.player.currencies = { ...(runtimeState.player.currencies ?? {}), gold: 100 };
    await upsertPlayerRuntimeState(client, user.internalId, runtimeState);
  });
}

async function main() {
  await ensureDatabaseSchema();
  const now = Date.now();
  const registration = await registerUser({
    firstName: "Market",
    lastName: "Seller",
    email: `city-market-sell-${now}@test.local`,
    password: "password1",
  });
  const { user } = await getSessionUser(registration.sessionToken);
  await seedTradeGood(user);

  const result = await sellCityMarketItemForUser(user, "nexis", "wild_herb", 1);
  const player = result.playerState.runtimeState.player;

  check("legal city-market sell returns a success message", /Sold/.test(result.message ?? ""));
  check("selling removes exactly one item", player.inventory?.wild_herb === 1);
  check("selling increases gold", player.gold > 100);
  check("selling increments cityMarketSales", player.counters?.cityMarketSales === 1);
  check("selling records firstCityMarketSaleAt", typeof player.counters?.firstCityMarketSaleAt === "number");
  check("selling records lastCityMarketSaleAt", typeof player.counters?.lastCityMarketSaleAt === "number");

  console.log(`\nAll ${checks} city-market sell checks passed.`);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("\nCANARY FAILED:", error.message);
    console.error(error.stack);
    process.exit(1);
  });
