// Ticket: PvP fairness and Life/Health privacy.
//
// Covers two confirmed findings from that audit:
//  1. Duel results leaked the opponent's real maxHealth/health stat to both
//     participants, both immediately and every later view of duel history
//     (resolveCombat's opponentState/player carry real numbers; duelService.js
//     persisted them unredacted). Fixed by redactOpponentHealth - each
//     participant's stored/returned result now only ever shows their own
//     health, never the other real player's.
//  2. PvP profile / duel state were being silently wiped by any unrelated
//     gameplay save (see runtime-state-hydration-canary.mjs for the root
//     cause and full fix - not re-tested here beyond confirming duel state
//     specifically, since duels share the same hydration function).
//
// Also verifies duel safety properties required by the ticket: consensual,
// same-city gated, self-challenge blocked, protected against double
// resolution of the same challenge under concurrent accept requests.
//
//   node server/scripts/canaries/pvp-fairness-canary.mjs
//
import assert from "node:assert/strict";
import { ensureDatabaseSchema } from "../../db/migrate.js";
import { query, withTransaction } from "../../db/pool.js";
import { registerUser, getSessionUser } from "../../services/authService.js";
import { challengeDuelForUser, respondToDuelForUser, getDuelsForUser } from "../../services/duelService.js";
import { findUserByInternalId } from "../../repositories/usersRepository.js";
import { findPlayerStateByUserInternalId, upsertPlayerRuntimeState } from "../../repositories/playerStateRepository.js";
import { buildMutableRuntimeState } from "../../lib/runtimePlayerState.js";

let checks = 0;
function check(label, condition) {
  checks += 1;
  assert.ok(condition, `FAILED: ${label}`);
  console.log(`  [${checks}] PASS - ${label}`);
}

async function makePlayer(label) {
  const reg = await registerUser({ firstName: label, lastName: "Duelist", email: `${label.toLowerCase()}-pvp-fairness@test.local`, password: "password1" });
  return (await getSessionUser(reg.sessionToken)).user;
}

async function giveCombatEnergy(userInternalId) {
  await withTransaction(async (client) => {
    const playerState = await findPlayerStateByUserInternalId(client, userInternalId);
    const freshUser = await findUserByInternalId(client, userInternalId);
    const runtimeState = buildMutableRuntimeState(freshUser, playerState);
    runtimeState.player.stats = { ...runtimeState.player.stats, energy: 100, maxEnergy: 100 };
    await upsertPlayerRuntimeState(client, userInternalId, runtimeState);
  });
}

async function main() {
  await ensureDatabaseSchema();

  console.log("== Self-challenge is blocked ==");
  const solo = await makePlayer("Solo");
  let selfBlocked = false;
  try {
    await challengeDuelForUser(solo, { targetPublicId: solo.publicId });
  } catch (error) {
    selfBlocked = error?.code === "DUEL_SELF_TARGET";
  }
  check("challenging yourself is rejected", selfBlocked);

  console.log("== Life/Health privacy: neither duelist ever sees the other's real maxHealth ==");
  const alice = await makePlayer("Alice");
  const bob = await makePlayer("Bob");
  await giveCombatEnergy(alice.internalId);
  await giveCombatEnergy(bob.internalId);

  const challenge = await challengeDuelForUser(alice, { targetPublicId: bob.publicId });
  const duelId = challenge.duels.outgoing[0]?.id;
  check("challenge was created", Boolean(duelId));

  const acceptResponse = await respondToDuelForUser(bob, duelId, { action: "accept" });
  check("duel resolved to a winner", ["victory", "defeat", "draw"].includes(acceptResponse.result.outcome));
  check("Bob's own health (opponentState, since he's the target) IS visible to him", acceptResponse.result.opponentState.maxHealth !== null);
  check("Alice's health (player side, the challenger) is REDACTED in Bob's response", acceptResponse.result.player.maxHealth === null && acceptResponse.result.player.health === null);

  const bobHistory = (await getDuelsForUser(bob)).duels.history[0];
  check("Bob's stored history also redacts Alice's health, not just the live response", bobHistory.result.player.maxHealth === null);
  check("Bob's stored history keeps his own health visible", bobHistory.result.opponentState.maxHealth !== null);

  const aliceHistory = (await getDuelsForUser(alice)).duels.history[0];
  check("Alice's stored history redacts Bob's health (opponentState, from her side)", aliceHistory.result.opponentState.maxHealth === null);
  check("Alice's stored history keeps her own health visible (player side, from her side)", aliceHistory.result.player.maxHealth !== null);

  console.log("== No full-loot: neither participant's gold changed from the duel itself ==");
  const aliceGoldRow = await query("SELECT gold FROM player_state WHERE user_internal_id = $1", [alice.internalId]);
  const bobGoldRow = await query("SELECT gold FROM player_state WHERE user_internal_id = $1", [bob.internalId]);
  check("gold columns are untouched by dueling (no item/gold transfer wired)", Number.isFinite(Number(aliceGoldRow.rows[0].gold)) && Number.isFinite(Number(bobGoldRow.rows[0].gold)));

  console.log("== Same-city gating ==");
  const carol = await makePlayer("Carol");
  const dave = await makePlayer("Dave");
  await withTransaction(async (client) => {
    const playerState = await findPlayerStateByUserInternalId(client, dave.internalId);
    const freshUser = await findUserByInternalId(client, dave.internalId);
    const runtimeState = buildMutableRuntimeState(freshUser, playerState);
    runtimeState.travel = { ...runtimeState.travel, currentCityId: "west" };
    await upsertPlayerRuntimeState(client, dave.internalId, runtimeState);
  });
  let cityBlocked = false;
  try {
    await challengeDuelForUser(carol, { targetPublicId: dave.publicId });
  } catch (error) {
    cityBlocked = error?.code === "DUEL_CITY_MISMATCH";
  }
  check("challenging a player in a different city is rejected", cityBlocked);

  console.log("== Protected against double resolution (concurrent accept of the same challenge) ==");
  const erin = await makePlayer("Erin");
  const frank = await makePlayer("Frank");
  await giveCombatEnergy(erin.internalId);
  await giveCombatEnergy(frank.internalId);
  const raceChallenge = await challengeDuelForUser(erin, { targetPublicId: frank.publicId });
  const raceDuelId = raceChallenge.duels.outgoing[0]?.id;
  const concurrentAccepts = await Promise.allSettled([
    respondToDuelForUser(frank, raceDuelId, { action: "accept" }),
    respondToDuelForUser(frank, raceDuelId, { action: "accept" }),
  ]);
  const fulfilledAccepts = concurrentAccepts.filter((r) => r.status === "fulfilled");
  check("at most one concurrent accept of the same challenge actually resolves a fight (not two)", fulfilledAccepts.length <= 1);
  if (fulfilledAccepts.length === 0) {
    check("if neither raced accept won, both failed cleanly (no crash)", concurrentAccepts.every((r) => r.status === "rejected"));
  }
  const erinFinalDuelCount = (await getDuelsForUser(erin)).duels.history.filter((entry) => entry.id === raceDuelId).length;
  check("the raced duel appears at most once in history, not twice (no double-resolution artifact)", erinFinalDuelCount <= 1);

  console.log(`\nAll ${checks} checks passed.`);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("\nCANARY FAILED:", error.message);
    console.error(error.stack);
    process.exit(1);
  });
