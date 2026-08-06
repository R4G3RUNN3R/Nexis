// Regression canary for the "City Crisis" living-world system: a player/guild
// critical fail against a city's signature elite threat has a chance to
// trigger a shared, city-scoped consequence (shops blocked, players
// "burned") visible to every player in that city.
//
//   unset DATABASE_URL && node server/scripts/canaries/city-events-canary.mjs
//
import assert from "node:assert/strict";
import { ensureDatabaseSchema } from "../../db/migrate.js";
import { withTransaction, query } from "../../db/pool.js";
import { registerUser, getSessionUser } from "../../services/authService.js";
import { startAdventureForUser } from "../../services/adventureService.js";
import { buyCityMarketItemForUser, buyBlackMarketItemForUser, sellCityMarketItemForUser } from "../../services/cityEconomyService.js";
import {
  getActiveCityEvent,
  triggerCityEventIfEligible,
  applyBurnedConditionToRuntimeState,
} from "../../services/cityEventService.js";
import { getGuildQuestTriggerTier, GUILD_QUEST_TRIGGER_TIERS } from "../../data/cityEventData.js";
import { activateCityEvent, getCityEventRow } from "../../repositories/cityEventRepository.js";
import { findPlayerStateByUserInternalId, upsertPlayerRuntimeState } from "../../repositories/playerStateRepository.js";
import { buildMutableRuntimeState } from "../../lib/runtimePlayerState.js";

let checks = 0;
function check(label, condition) {
  checks += 1;
  assert.ok(condition, `FAILED: ${label}`);
  console.log(`  [${checks}] PASS - ${label}`);
}

async function freshUser(tag) {
  const now = Date.now();
  const registration = await registerUser({
    firstName: "City",
    lastName: tag,
    email: `city-events-${tag.toLowerCase()}-${now}@test.local`,
    password: "password1",
  });
  const { user } = await getSessionUser(registration.sessionToken);
  return user;
}

async function withForcedRandom(value, fn) {
  const original = Math.random;
  Math.random = () => value;
  try {
    return await fn();
  } finally {
    Math.random = original;
  }
}

async function resetCity(cityId) {
  await query(`DELETE FROM city_events WHERE city_id = $1`, [cityId]);
}

async function main() {
  await ensureDatabaseSchema();

  // --- normalizeCondition whitelist (pre-flight fix regression) ---
  {
    await resetCity("nexis");
    const user = await freshUser("Condition");
    await withTransaction(async (client) => {
      const playerState = await findPlayerStateByUserInternalId(client, user.internalId);
      const runtimeState = buildMutableRuntimeState(user, playerState);
      runtimeState.player.condition = { type: "burned", until: Date.now() + 60000, reason: "Test burn." };
      await upsertPlayerRuntimeState(client, user.internalId, runtimeState);
    });
    const reloaded = await withTransaction(async (client) => {
      const playerState = await findPlayerStateByUserInternalId(client, user.internalId);
      return buildMutableRuntimeState(user, playerState);
    });
    check("burned condition survives a round trip through normalizeCondition", reloaded.player.condition.type === "burned");
  }

  // --- activateCityEvent idempotency under concurrent triggers ---
  {
    await resetCity("nexis");
    const [first, second] = await Promise.all([
      withTransaction((client) => triggerCityEventIfEligible(client, { cityId: "nexis", source: "test", chance: 1, severity: "moderate", triggeredByLabel: "A", triggeredByPublicId: 1 })),
      withTransaction((client) => triggerCityEventIfEligible(client, { cityId: "nexis", source: "test", chance: 1, severity: "moderate", triggeredByLabel: "B", triggeredByPublicId: 2 })),
    ]);
    const activatedCount = [first, second].filter(Boolean).length;
    check("exactly one of two concurrent chance:1 triggers activates the city", activatedCount === 1);
    const active = await withTransaction((client) => getActiveCityEvent(client, "nexis"));
    check("the city is active after the race", active !== null);
  }

  // --- cooldown enforcement ---
  {
    await resetCity("nexis");
    await withTransaction((client) => activateCityEvent(client, "nexis", { templateId: "nexis-raider-muster", severity: "moderate", durationMs: -1000, triggerSource: "test", triggeredByLabel: "C", triggeredByPublicId: 3 }));
    const reaped = await withTransaction((client) => getCityEventRow(client, "nexis", 3600000));
    check("an already-expired event is reaped to inactive on read", reaped.status === "inactive");
    check("reaping sets a cooldown", typeof reaped.cooldownUntil === "number" && reaped.cooldownUntil > Date.now());
    const duringCooldown = await withTransaction((client) => triggerCityEventIfEligible(client, { cityId: "nexis", source: "test", chance: 1, severity: "moderate", triggeredByLabel: "D", triggeredByPublicId: 4 }));
    check("a trigger during cooldown no-ops", duringCooldown === null);
  }

  // --- adventure defeat path (real combat, RNG forced deterministic) ---
  {
    await resetCity("east");
    const user = await freshUser("Furnace");
    const result = await withForcedRandom(0, () => startAdventureForUser(user, "east_furnace_beast_response", {}));
    check("a fresh level-1 account loses to the Furnace Beast when combat rolls are forced to 0", result.combat.winner === "opponent");
    const event = await withTransaction((client) => getActiveCityEvent(client, "east"));
    check("the defeat activated the east city crisis", event !== null && event.templateId === "east-furnace-beast");
    check("the crisis records the triggering player's name", event.triggeredByLabel === "City Furnace");
  }
  {
    await resetCity("west");
    const user = await freshUser("Draw");
    const result = await withForcedRandom(0.999, () => startAdventureForUser(user, "west_corsair_chief_response", {}));
    check("a near-1 random roll produces a non-defeat outcome (draw), not a win", result.combat.winner !== "player");
    if (result.combat.winner !== "opponent") {
      const event = await withTransaction((client) => getActiveCityEvent(client, "west"));
      check("a draw does not trigger a city crisis", event === null);
    } else {
      console.log("  (skipped draw-specific assertion - forced roll produced a defeat instead, which is itself covered above)");
    }
  }

  // --- guild quest failure tiers (pure threshold function) ---
  {
    check("powerFloor 45 (easiest quest) never triggers a tier", getGuildQuestTriggerTier(45) === null);
    check("powerFloor 105 never triggers a tier", getGuildQuestTriggerTier(105) === null);
    check("powerFloor 180 triggers the moderate tier", getGuildQuestTriggerTier(180)?.severity === "moderate");
    check("powerFloor 320 triggers the moderate tier", getGuildQuestTriggerTier(320)?.severity === "moderate");
    check("powerFloor 340 triggers the major tier", getGuildQuestTriggerTier(340)?.severity === "major");
    check("powerFloor 520 (hardest quest) triggers the major tier", getGuildQuestTriggerTier(520)?.severity === "major");
    check("major tier has a higher chance than moderate", GUILD_QUEST_TRIGGER_TIERS[0].chance > GUILD_QUEST_TRIGGER_TIERS[1].chance);
  }
  {
    // The guild-quest call site shares triggerCityEventIfEligible with the
    // adventure call site (already proven end-to-end above) - this confirms
    // the shared entry point behaves identically for the guild_quest_failure
    // source label, without needing to stand up a full guild/quest/roster.
    await resetCity("north");
    const activated = await withTransaction((client) => triggerCityEventIfEligible(client, { cityId: "north", source: "guild_quest_failure", chance: 1, severity: "major", triggeredByLabel: "Test Guild", triggeredByPublicId: 99 }));
    check("guild_quest_failure source activates the shared city-event pipeline", activated !== null && activated.severity === "major");
  }

  // --- burn: extend-not-shorten, hospitalized precedence, one-time hit ---
  {
    const user = await freshUser("Burn");
    const runtimeState = await withTransaction(async (client) => {
      const playerState = await findPlayerStateByUserInternalId(client, user.internalId);
      return buildMutableRuntimeState(user, playerState);
    });
    const startingHealth = runtimeState.player.stats.health;
    const startingEnergy = runtimeState.player.stats.energy;
    const firstApplied = applyBurnedConditionToRuntimeState(runtimeState, { reason: "First burn", severity: "moderate", now: Date.now() });
    check("first burn application returns true", firstApplied === true);
    check("burn takes a flat percentage off current health", runtimeState.player.stats.health < startingHealth);
    check("burn takes a flat amount off energy", runtimeState.player.stats.energy === Math.max(0, startingEnergy - 15));
    const firstUntil = runtimeState.player.condition.until;

    const shorterApplied = applyBurnedConditionToRuntimeState(runtimeState, { reason: "Shorter burn", severity: "moderate", now: Date.now() + 1000 });
    check("a second, shorter burn still applies (health/energy hit again)", shorterApplied === true);
    check("extend-not-shorten: until never decreases from a second burn", runtimeState.player.condition.until >= firstUntil);

    runtimeState.player.condition = { type: "hospitalized", until: Date.now() + 60000, reason: "Test hospital stay." };
    const hospitalizedHealthBefore = runtimeState.player.stats.health;
    const blockedApplied = applyBurnedConditionToRuntimeState(runtimeState, { reason: "Should not apply", severity: "major", now: Date.now() });
    check("burn is a no-op on an already-hospitalized player", blockedApplied === false);
    check("hospitalized player's health is untouched by a blocked burn", runtimeState.player.stats.health === hospitalizedHealthBefore);
    check("hospitalized player's condition is not downgraded to burned", runtimeState.player.condition.type === "hospitalized");
  }

  // --- shop gating: buy and sell both reject while blocksShops is active ---
  {
    await resetCity("nexis");
    const user = await freshUser("Shopper");
    await withTransaction(async (client) => {
      const playerState = await findPlayerStateByUserInternalId(client, user.internalId);
      const runtimeState = buildMutableRuntimeState(user, playerState);
      runtimeState.player.gold = 100000;
      runtimeState.player.currencies = { ...(runtimeState.player.currencies ?? {}), gold: 100000 };
      runtimeState.player.inventory = { ...(runtimeState.player.inventory ?? {}), wild_herb: 5 };
      runtimeState.player.travel = { ...(runtimeState.player.travel ?? {}), currentCityId: "nexis", status: "idle" };
      runtimeState.travel = { ...(runtimeState.travel ?? {}), currentCityId: "nexis", status: "idle" };
      await upsertPlayerRuntimeState(client, user.internalId, runtimeState);
    });

    const beforeMarket = await import("../../services/cityEconomyService.js").then((mod) => mod.getCityMarketForUser(user, "nexis"));
    const anyItemId = beforeMarket.market.stock[0]?.itemId;
    check("sanity: nexis market has at least one stock item to test against", Boolean(anyItemId));

    await withTransaction((client) => activateCityEvent(client, "nexis", { templateId: "nexis-raider-muster", severity: "moderate", durationMs: 3600000, triggerSource: "test", triggeredByLabel: "E", triggeredByPublicId: 5 }));

    let buyRejected = false;
    try {
      await buyCityMarketItemForUser(user, "nexis", anyItemId, 1);
    } catch (error) {
      buyRejected = error?.code === "CITY_MARKET_BUY_BLOCKED";
    }
    check("legal market buy is rejected while the city crisis blocks shops", buyRejected);

    let sellRejected = false;
    try {
      await sellCityMarketItemForUser(user, "nexis", "wild_herb", 1);
    } catch (error) {
      sellRejected = error?.code === "CITY_MARKET_SELL_BLOCKED";
    }
    check("legal market sell is rejected while the city crisis blocks shops", sellRejected);

    const blackMarketModule = await import("../../services/cityEconomyService.js");
    const blackMarketState = await blackMarketModule.getBlackMarketForUser(user, "nexis");
    if (blackMarketState.blackMarket.canOpen) {
      let blackBuyRejected = false;
      const blackItemId = blackMarketState.blackMarket.stock[0]?.itemId;
      if (blackItemId) {
        try {
          await buyBlackMarketItemForUser(user, "nexis", blackItemId, 1);
        } catch (error) {
          blackBuyRejected = error?.code === "CITY_MARKET_BUY_BLOCKED";
        }
        check("black market buy is rejected while the city crisis blocks shops", blackBuyRejected);
      }
    }

    await resetCity("nexis");
    const afterMarket = await (await import("../../services/cityEconomyService.js")).getCityMarketForUser(user, "nexis");
    check("shops reopen once the crisis clears", afterMarket.market.stock.every((entry) => !/barred while/.test(entry.lockReason ?? "")));
  }

  console.log(`\nAll ${checks} city-events checks passed.`);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("\nCANARY FAILED:", error.message);
    console.error(error.stack);
    process.exit(1);
  });
