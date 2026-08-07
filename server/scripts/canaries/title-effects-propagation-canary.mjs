// Fix: an equipped title's name and stat effects reached the Profile page
// correctly (profileService.js) but silently never reached the main app
// state - GET /api/me (server/services/authService.js's
// resolvePlayerStateForResponse) always overwrote player.title with the OLD
// prestige system's label, and the frontend's runtimeStateCache.ts always
// cached the unboosted stats/workingStats/battleStats even though the
// server was already sending the boosted effective* fields. Separately,
// duelService.js's buildPlayerOpponent() (the DEFENDING side of a duel)
// read raw stats/battleStats directly, never effectiveStats/
// effectiveBattleStats the way combatService.js's buildPlayerCombatant()
// (used by arena/adventure/duel-challenger) already correctly did.
//
//   unset DATABASE_URL && node server/scripts/canaries/title-effects-propagation-canary.mjs
//
import assert from "node:assert/strict";
import { ensureDatabaseSchema } from "../../db/migrate.js";
import { withTransaction } from "../../db/pool.js";
import { registerUser, getSessionUser, loginUser } from "../../services/authService.js";
import { equipTitleForUser } from "../../services/titleService.js";
import { challengeDuelForUser, respondToDuelForUser } from "../../services/duelService.js";
import { findPlayerStateByUserInternalId, upsertPlayerRuntimeState } from "../../repositories/playerStateRepository.js";
import { findUserByInternalId } from "../../repositories/usersRepository.js";
import { buildMutableRuntimeState } from "../../lib/runtimePlayerState.js";

let checks = 0;
function check(label, condition) {
  checks += 1;
  assert.ok(condition, `FAILED: ${label}`);
  console.log(`  [${checks}] PASS - ${label}`);
}

async function freshUser(tag) {
  const registration = await registerUser({
    firstName: "TitleFx",
    lastName: tag,
    email: `title-fx-${tag.toLowerCase()}-${Date.now()}@test.local`,
    password: "password1",
  });
  const { user } = await getSessionUser(registration.sessionToken);
  return { user, sessionToken: registration.sessionToken };
}

// Grants + equips "Warlord's Mark" (+2% strength, +2% defense, cosmetic-free
// real stat title) by seeding grantedTitleIds directly - bypasses the
// organic "win 400 real fights" requirement, same trick the earlier
// account-actions/absolute canaries use to reach an otherwise-gated state.
async function grantAndEquipWarlordsMark(user) {
  await withTransaction(async (client) => {
    const playerState = await findPlayerStateByUserInternalId(client, user.internalId);
    const dbUser = await findUserByInternalId(client, user.internalId);
    const runtimeState = buildMutableRuntimeState(dbUser, playerState);
    runtimeState.player.titles = {
      ...runtimeState.player.titles,
      grantedTitleIds: [...(runtimeState.player.titles?.grantedTitleIds ?? []), "warlords-mark"],
    };
    // Warlord's Mark is a +2% (not flat) bonus - a fresh player's starting
    // strength/defense (~10) rounds 2% straight back to zero, which would
    // make the "boosted stat differs from raw stat" check below a false
    // negative on the fix, not a true one. Bump base stats so 2% is a
    // measurable integer delta - this only exercises computeEffectiveBattleStats'
    // math, unrelated to what's being fixed here.
    runtimeState.player.battleStats = {
      ...runtimeState.player.battleStats,
      strength: 1000,
      defense: 1000,
    };
    await upsertPlayerRuntimeState(client, user.internalId, runtimeState);
  });
  const dbUser = await withTransaction((client) => findUserByInternalId(client, user.internalId));
  const equipResult = await equipTitleForUser(dbUser, "warlords-mark");
  return equipResult;
}

async function main() {
  await ensureDatabaseSchema();

  // --- Fix 1: GET /api/me (authService.js) reflects the equipped title, ---
  // --- not just the stale prestige label -----------------------------------
  {
    const { user } = await freshUser("Auth");
    const beforeEquip = await getSessionUser((await freshUser("AuthControl")).sessionToken);
    check(
      "control: a fresh account's /api/me title is a plain string (prestige default)",
      typeof beforeEquip.playerState.runtimeState.player.title === "string" && beforeEquip.playerState.runtimeState.player.title !== "Warlord's Mark",
    );

    const equip = await grantAndEquipWarlordsMark(user);
    check("equip succeeds", equip.equippedTitle?.id === "warlords-mark");

    // Re-fetch via getSessionUser - the exact function GET /api/me's
    // controller relies on (authService.js's resolvePlayerStateForResponse).
    // A fresh login is needed to get a session token to re-fetch through,
    // since equipTitleForUser() doesn't return one itself.
    const dbUser = await withTransaction((client) => findUserByInternalId(client, user.internalId));
    const relogin = await loginUser({ email: dbUser.email, password: "password1" });
    const refetched = await getSessionUser(relogin.sessionToken);
    check(
      "GET /api/me now reflects the equipped NEW-system title, not the old prestige label",
      refetched.playerState.runtimeState.player.title === "Warlord's Mark",
    );
    check(
      "GET /api/me's equippedTitle field is also present and correct",
      refetched.playerState.runtimeState.player.equippedTitle?.id === "warlords-mark",
    );
  }

  // --- Fix 2 (data premise for the frontend cache fix): GET /api/me's -----
  // --- effectiveWorkingStats/effectiveBattleStats are boosted and differ ---
  // --- from the raw stats the old cache logic used to keep exclusively ----
  {
    const { user } = await freshUser("Stats");
    await grantAndEquipWarlordsMark(user);
    const dbUser = await withTransaction((client) => findUserByInternalId(client, user.internalId));
    const relogin = await loginUser({ email: dbUser.email, password: "password1" });
    const session = await getSessionUser(relogin.sessionToken);
    const player = session.playerState.runtimeState.player;

    check("raw battleStats.strength is present", typeof player.battleStats.strength === "number");
    check("effectiveBattleStats.strength is present", typeof player.effectiveBattleStats.strength === "number");
    check(
      "effectiveBattleStats.strength is measurably higher than raw battleStats.strength (Warlord's Mark +2%)",
      player.effectiveBattleStats.strength > player.battleStats.strength,
    );
    check(
      "effectiveBattleStats.defense is measurably higher than raw battleStats.defense (Warlord's Mark +2%)",
      player.effectiveBattleStats.defense > player.battleStats.defense,
    );
  }

  // --- Fix 3: duelService.js's defending side now uses effective stats ----
  {
    const { user: challenger, sessionToken: challengerToken } = await freshUser("Challenger");
    const { user: defender } = await freshUser("Defender");
    void challengerToken;

    await grantAndEquipWarlordsMark(defender);
    const defenderDbUser = await withTransaction((client) => findUserByInternalId(client, defender.internalId));

    // Confirm, right before the duel resolves, that the defender's runtime
    // state (the exact object buildPlayerOpponent() now reads from) carries
    // a real, measurable boost - this is the precise data dependency the
    // duelService.js fix relies on.
    const defenderStateBeforeDuel = await withTransaction((client) => findPlayerStateByUserInternalId(client, defender.internalId));
    const defenderRuntimeBeforeDuel = buildMutableRuntimeState(defenderDbUser, defenderStateBeforeDuel);
    check(
      "defender's effectiveBattleStats.strength is boosted going into the duel",
      defenderRuntimeBeforeDuel.player.effectiveBattleStats.strength > defenderRuntimeBeforeDuel.player.battleStats.strength,
    );

    const challengerDbUser = await withTransaction((client) => findUserByInternalId(client, challenger.internalId));
    const challengeResult = await challengeDuelForUser(challengerDbUser, { targetPublicId: defenderDbUser.publicId });
    const duelId = challengeResult.duels?.outgoing?.[0]?.id;
    check("duel challenge was created", Boolean(duelId));

    const respondResult = await respondToDuelForUser(defenderDbUser, duelId, { action: "accept" });
    check("duel resolves without error when the defender has a stat title equipped", respondResult !== undefined);
  }

  console.log(`\nAll ${checks} title-effect-propagation checks passed.`);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("\nCANARY FAILED:", error.message);
    console.error(error.stack);
    process.exit(1);
  });
