// Regression canary for the Settings-page account actions: change password,
// change email (request/confirm), change name (gold + cooldown), close
// account (soft-deactivate), and Navigation settings' sidebarLinks sanitizer.
//
//   unset DATABASE_URL && node server/scripts/canaries/settings-account-actions-canary.mjs
//
import assert from "node:assert/strict";
import { ensureDatabaseSchema } from "../../db/migrate.js";
import { withTransaction } from "../../db/pool.js";
import { registerUser, getSessionUser, loginUser } from "../../services/authService.js";
import {
  changeNameForUser,
  changePasswordForUser,
  closeAccountForUser,
  confirmEmailChangeForUser,
  requestEmailChangeForUser,
} from "../../services/accountService.js";
import { syncRuntimeState } from "../../services/stateService.js";
import { findPlayerStateByUserInternalId, upsertPlayerRuntimeState } from "../../repositories/playerStateRepository.js";
import { buildMutableRuntimeState } from "../../lib/runtimePlayerState.js";
import { createEmailChangeToken, findEmailChangeTokenByHash } from "../../repositories/emailChangeRepository.js";
import crypto from "node:crypto";

let checks = 0;
function check(label, condition) {
  checks += 1;
  assert.ok(condition, `FAILED: ${label}`);
  console.log(`  [${checks}] PASS - ${label}`);
}

async function freshUser(tag) {
  const now = Date.now();
  const registration = await registerUser({
    firstName: "Settings",
    lastName: tag,
    email: `settings-${tag.toLowerCase()}-${now}@test.local`,
    password: "password1",
  });
  const { user } = await getSessionUser(registration.sessionToken);
  return { user, email: registration.user.email, sessionToken: registration.sessionToken };
}

async function grantGold(userInternalId, amount) {
  await withTransaction(async (client) => {
    const playerState = await findPlayerStateByUserInternalId(client, userInternalId);
    const user = await (await import("../../repositories/usersRepository.js")).findUserByInternalId(client, userInternalId);
    const runtimeState = buildMutableRuntimeState(user, playerState);
    runtimeState.player.gold = amount;
    runtimeState.player.currencies = { ...(runtimeState.player.currencies ?? {}), gold: amount };
    await upsertPlayerRuntimeState(client, userInternalId, runtimeState);
  });
}

async function main() {
  await ensureDatabaseSchema();

  // --- change password ---
  {
    const { user, email } = await freshUser("Password");
    let rejected = false;
    try {
      await changePasswordForUser({ userInternalId: user.internalId, currentPassword: "wrong", newPassword: "newpassword1" });
    } catch (error) {
      rejected = error.code === "INVALID_CURRENT_PASSWORD";
    }
    check("wrong current password is rejected", rejected);

    const result = await changePasswordForUser({ userInternalId: user.internalId, currentPassword: "password1", newPassword: "newpassword1" });
    check("correct current password succeeds", result.changed === true);
    check("not a first-time set (account already had a password)", result.wasSetForFirstTime === false);

    const relogin = await loginUser({ email, password: "newpassword1" });
    check("can log in with the new password", relogin.user.email === email);

    let oldPasswordRejected = false;
    try {
      await loginUser({ email, password: "password1" });
    } catch (error) {
      oldPasswordRejected = error.code === "INVALID_PASSWORD";
    }
    check("old password no longer works", oldPasswordRejected);
  }

  // --- change name: cooldown + gold ---
  {
    const { user } = await freshUser("Namer");
    await grantGold(user.internalId, 10000);

    let insufficientRejected = false;
    const poorUser = (await freshUser("Poor")).user;
    try {
      await changeNameForUser(poorUser, { firstName: "Rich", lastName: "Wannabe" });
    } catch (error) {
      insufficientRejected = error.code === "NAME_CHANGE_GOLD_INSUFFICIENT";
    }
    check("insufficient gold is rejected", insufficientRejected);

    let charsetRejected = false;
    try {
      await changeNameForUser(user, { firstName: "Name123", lastName: "Test" });
    } catch (error) {
      charsetRejected = error.code === "NAME_CHARSET_INVALID";
    }
    check("invalid charset (digits) is rejected", charsetRejected);

    const result = await changeNameForUser(user, { firstName: "Renamed", lastName: "Person" });
    check("valid rename succeeds", result.user.firstName === "Renamed" && result.user.lastName === "Person");
    check("gold spent matches the configured cost", result.goldSpent === 2500);

    let cooldownRejected = false;
    try {
      await changeNameForUser(user, { firstName: "Again", lastName: "Nope" });
    } catch (error) {
      cooldownRejected = error.code === "NAME_CHANGE_COOLDOWN_ACTIVE";
    }
    check("second rename inside cooldown is rejected", cooldownRejected);

    // Concurrent double-submit: both requests race the same conditional
    // UPDATE - exactly one should win, gold debited exactly once.
    const { user: raceUser } = await freshUser("Racer");
    await grantGold(raceUser.internalId, 10000);
    const [first, second] = await Promise.allSettled([
      changeNameForUser(raceUser, { firstName: "First", lastName: "Winner" }),
      changeNameForUser(raceUser, { firstName: "Second", lastName: "Loser" }),
    ]);
    const succeeded = [first, second].filter((entry) => entry.status === "fulfilled");
    check("exactly one of two concurrent renames succeeds", succeeded.length === 1);
    const finalGold = await withTransaction(async (client) => {
      const ps = await findPlayerStateByUserInternalId(client, raceUser.internalId);
      const u = await (await import("../../repositories/usersRepository.js")).findUserByInternalId(client, raceUser.internalId);
      return buildMutableRuntimeState(u, ps).player.gold;
    });
    check("gold debited exactly once under the race (not twice, not zero times)", finalGold === 7500);
  }

  // --- change email: request/confirm, collision, expiry ---
  {
    const { user: userA, email: emailA } = await freshUser("EmailA");
    const { email: emailB } = await freshUser("EmailB");

    let collisionRejected = false;
    try {
      await requestEmailChangeForUser({ userInternalId: userA.internalId, newEmail: emailB });
    } catch (error) {
      collisionRejected = error.code === "EMAIL_ALREADY_IN_USE";
    }
    check("requesting an in-use email is rejected at request time", collisionRejected);

    // requestEmailChangeForUser also sends mail (SMTP likely unconfigured in
    // this environment) - exercise confirmEmailChangeForUser directly via a
    // hand-crafted token instead, the same way the real request step would
    // have produced one, so this canary doesn't depend on SMTP being set up.
    const plainToken = crypto.randomBytes(32).toString("hex");
    const tokenHash = crypto.createHash("sha256").update(plainToken).digest("hex");
    const newEmail = `settings-emailc-${Date.now()}@test.local`;
    await withTransaction((client) => createEmailChangeToken(client, {
      tokenHash,
      userInternalId: userA.internalId,
      newEmail,
      expiresAt: new Date(Date.now() + 60 * 60 * 1000),
    }));

    const confirmed = await confirmEmailChangeForUser({ token: plainToken });
    check("confirming a valid token changes the email", confirmed.email === newEmail);

    let reuseRejected = false;
    try {
      await confirmEmailChangeForUser({ token: plainToken });
    } catch (error) {
      reuseRejected = error.code === "EMAIL_CHANGE_TOKEN_INVALID";
    }
    check("reusing an already-confirmed token is rejected", reuseRejected);

    let expiredRejected = false;
    const expiredPlain = crypto.randomBytes(32).toString("hex");
    const expiredHash = crypto.createHash("sha256").update(expiredPlain).digest("hex");
    await withTransaction((client) => createEmailChangeToken(client, {
      tokenHash: expiredHash,
      userInternalId: userA.internalId,
      newEmail: `settings-expired-${Date.now()}@test.local`,
      expiresAt: new Date(Date.now() - 60 * 1000),
    }));
    try {
      await confirmEmailChangeForUser({ token: expiredPlain });
    } catch (error) {
      expiredRejected = error.code === "EMAIL_CHANGE_TOKEN_INVALID";
    }
    check("an expired token is rejected", expiredRejected);
    check("(sanity) findEmailChangeTokenByHash correctly excludes the expired row", await withTransaction((client) => findEmailChangeTokenByHash(client, expiredHash)) === null);
  }

  // --- close account ---
  {
    const { user, email } = await freshUser("Closer");
    const closeResult = await closeAccountForUser({ userInternalId: user.internalId, password: "password1" });
    check("close account succeeds with correct password", closeResult.closed === true);

    let loginRejected = false;
    try {
      await loginUser({ email, password: "password1" });
    } catch (error) {
      loginRejected = error.code === "ACCOUNT_DEACTIVATED";
    }
    check("login after closure is rejected with ACCOUNT_DEACTIVATED specifically", loginRejected);

    const secondClose = await closeAccountForUser({ userInternalId: user.internalId, password: "password1" });
    check("closing an already-closed account is idempotent, not an error", secondClose.closed === true);
  }

  // --- Navigation settings: sanitizeSidebarLinks via the real syncRuntimeState path ---
  {
    const { user } = await freshUser("Navigator");
    const result = await syncRuntimeState(user.internalId, {
      player: {
        ui: {
          sidebarLinks: {
            character: ["life-paths", "not-a-real-route", "life-paths", "housing"],
            realm: ["arena"],
            notASection: ["should-be-ignored"],
          },
        },
      },
    });
    const savedLinks = result.runtimeState.player.ui.sidebarLinks;
    check("unknown route keys are dropped", !savedLinks.character.includes("not-a-real-route"));
    check("duplicate keys are deduped", savedLinks.character.filter((k) => k === "life-paths").length === 1);
    check("valid keys are kept in order", savedLinks.character[0] === "life-paths" && savedLinks.character[1] === "housing");
    check("a section with no array in the payload is left unset (falls back to canonical order client-side)", !("orders" in savedLinks));
    check("an unrecognized top-level section key is silently dropped, not stored", !("notASection" in savedLinks));

    // Mass-assignment regression: extra unrelated fields in the same payload
    // must not leak through to gold/privilegeRole/etc.
    const goldBefore = result.runtimeState.player.gold;
    const probe = await syncRuntimeState(user.internalId, {
      player: { gold: 999999999, privilegeRole: "admin", ui: { sidebarLinks: { realm: ["hospital"] } } },
    });
    check("gold cannot be mass-assigned through the state-sync path", probe.runtimeState.player.gold === goldBefore);
    check("privilegeRole is not part of player runtime state and cannot be mass-assigned", probe.runtimeState.player.privilegeRole === undefined);
  }

  console.log(`\nAll ${checks} settings/account-action checks passed.`);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("\nCANARY FAILED:", error.message);
    console.error(error.stack);
    process.exit(1);
  });
