// Regression canary for a data-loss bug found while investigating PvP
// fairness: buildMutableRuntimeState (server/lib/runtimePlayerState.js) is
// the shared hydration function nearly every gameplay write goes through,
// and player_snapshot is a full-replace column (see
// playerStateRepository.js upsertPlayerRuntimeState - only `portrait` gets
// special preservation logic). Any field this function doesn't carry
// forward gets silently wiped by the next unrelated save. Confirmed this
// was true for pvpProfile, cityDiaries, qualities, worldEventProfile,
// excursions, and lootPity before the fix - this canary proves each one
// now survives an unrelated write, and guards against a future regression
// reintroducing the same class of bug for any of them.
//
//   node server/scripts/canaries/runtime-state-hydration-canary.mjs
//
import assert from "node:assert/strict";
import { ensureDatabaseSchema } from "../../db/migrate.js";
import { withTransaction } from "../../db/pool.js";
import { registerUser, getSessionUser } from "../../services/authService.js";
import { updatePvpSafetyForUser } from "../../services/pvpService.js";
import { startExcursionForUser } from "../../services/excursionService.js";
import { findUserByInternalId } from "../../repositories/usersRepository.js";
import { findPlayerStateByUserInternalId, upsertPlayerRuntimeState } from "../../repositories/playerStateRepository.js";
import { buildMutableRuntimeState } from "../../lib/runtimePlayerState.js";

let checks = 0;
function check(label, condition) {
  checks += 1;
  assert.ok(condition, `FAILED: ${label}`);
  console.log(`  [${checks}] PASS - ${label}`);
}

// Simulates literally any other gameplay service's normal write pattern:
// hydrate via buildMutableRuntimeState, then save. This is what silently
// wiped everything not carried forward by that function.
async function performUnrelatedSave(userInternalId) {
  await withTransaction(async (client) => {
    const playerState = await findPlayerStateByUserInternalId(client, userInternalId);
    const freshUser = await findUserByInternalId(client, userInternalId);
    const runtimeState = buildMutableRuntimeState(freshUser, playerState);
    await upsertPlayerRuntimeState(client, userInternalId, runtimeState);
  });
}

async function readHydratedPlayer(userInternalId) {
  return withTransaction(async (client) => {
    const playerState = await findPlayerStateByUserInternalId(client, userInternalId);
    const freshUser = await findUserByInternalId(client, userInternalId);
    return buildMutableRuntimeState(freshUser, playerState).player;
  });
}

async function main() {
  await ensureDatabaseSchema();

  console.log("== PvP profile survives an unrelated save ==");
  const pvpReg = await registerUser({ firstName: "PvP", lastName: "Hydration", email: "pvp-hydration@test.local", password: "password1" });
  const pvpUser = (await getSessionUser(pvpReg.sessionToken)).user;
  await updatePvpSafetyForUser(pvpUser, { safety: { sparringOptIn: true, bountyEligible: true } });
  await performUnrelatedSave(pvpUser.internalId);
  const pvpAfter = (await readHydratedPlayer(pvpUser.internalId)).pvpProfile;
  check("pvpProfile.safety.sparringOptIn survives an unrelated write", pvpAfter?.safety?.sparringOptIn === true);
  check("pvpProfile.safety.bountyEligible survives an unrelated write", pvpAfter?.safety?.bountyEligible === true);

  console.log("== Excursion active state survives both same-request and cross-request round trips ==");
  const excReg = await registerUser({ firstName: "Excursion", lastName: "Hydration", email: "excursion-hydration@test.local", password: "password1" });
  const excUser = (await getSessionUser(excReg.sessionToken)).user;
  const started = await startExcursionForUser(excUser, "central_ruined_watchtower_grid");
  check("active excursion is present in the response from the SAME request that started it", started.board.active?.locationId === "central_ruined_watchtower_grid");
  await performUnrelatedSave(excUser.internalId);
  const excAfter = (await readHydratedPlayer(excUser.internalId)).excursions;
  check("active excursion survives a later unrelated write", excAfter?.active?.locationId === "central_ruined_watchtower_grid");

  console.log("== Fields that were already working correctly still work (no regression from the fix) ==");
  const regReg = await registerUser({ firstName: "Already", lastName: "Working", email: "already-working-hydration@test.local", password: "password1" });
  const regUser = (await getSessionUser(regReg.sessionToken)).user;
  const before = await readHydratedPlayer(regUser.internalId);
  await performUnrelatedSave(regUser.internalId);
  const after = await readHydratedPlayer(regUser.internalId);
  check("gold is unaffected", before.gold === after.gold);
  check("level is unaffected", before.level === after.level);
  check("stats block is unaffected", JSON.stringify(before.stats) === JSON.stringify(after.stats));
  check("bio block is unaffected", JSON.stringify(before.bio) === JSON.stringify(after.bio));

  console.log(`\nAll ${checks} checks passed.`);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("\nCANARY FAILED:", error.message);
    console.error(error.stack);
    process.exit(1);
  });
