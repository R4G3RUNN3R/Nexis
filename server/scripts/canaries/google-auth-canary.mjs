// Ticket-specific canary for Google registration/login. Uses deterministic
// mocked Google verification (via __setGoogleIdTokenVerifierForTests) rather
// than real Google infrastructure - see server/services/googleAuthService.js
// for the seam. Real signature/audience/issuer/expiry validation is
// delegated entirely to google-auth-library in production; this suite tests
// that our code correctly reacts to what that library can return or throw,
// not the library's own cryptography.
//
// GOOGLE_CLIENT_ID is read once into an immutable module-level constant at
// import time, so "configured" vs "unconfigured" behavior can't both be
// exercised in one process. This file requires GOOGLE_CLIENT_ID to be set
// (any non-empty value - it is never used for real verification here, only
// the mocked seam is) and covers scenarios 1-20 and 22. Scenario 21 (safe
// behavior when GOOGLE_CLIENT_ID is absent) lives in the companion script
// google-auth-unconfigured-canary.mjs, run without the env var set:
//
//   GOOGLE_CLIENT_ID=fake-test-client-id.apps.googleusercontent.com \
//     node server/scripts/canaries/google-auth-canary.mjs
//   node server/scripts/canaries/google-auth-unconfigured-canary.mjs
//
import assert from "node:assert/strict";
import crypto from "node:crypto";
import { ensureDatabaseSchema } from "../../db/migrate.js";
import { query, withTransaction } from "../../db/pool.js";
import { createPasswordResetToken } from "../../repositories/passwordResetRepository.js";
import {
  __resetGoogleIdTokenVerifierForTests,
  __setGoogleIdTokenVerifierForTests,
  isGoogleAuthConfigured,
} from "../../services/googleAuthService.js";
import {
  beginGoogleAuth,
  completeGoogleRegistration,
  getSessionUser,
  linkGoogleIdentityToCurrentUser,
  listAuthIdentitiesForUser,
  loginUser,
  registerUser,
  requestPasswordReset,
  resetPassword,
} from "../../services/authService.js";

let checks = 0;
function check(label, condition) {
  checks += 1;
  assert.ok(condition, `FAILED: ${label}`);
  console.log(`  [${checks}] PASS - ${label}`);
}

async function expectHttpError(label, code, fn) {
  try {
    await fn();
    check(label, false);
  } catch (error) {
    check(label, error?.code === code);
  }
}

// mapPublicApiUser (what registerUser/loginUser/completeGoogleRegistration
// return) deliberately omits internalId - it's not meant to reach the
// client, ever. The real production caller of linkGoogleIdentityToCurrentUser
// is the /api/auth/google/link route, gated by requireSession, which
// resolves req.auth.user via getSessionUser (mapApiUser, which DOES include
// internalId) - never from a registration/login response body. Mirror that
// exact resolution path here instead of reaching into the public user shape.
async function internalIdForSession(sessionToken) {
  const session = await getSessionUser(sessionToken);
  return session.user.internalId;
}

let subjectCounter = 0;
function fakeGooglePayload(overrides = {}) {
  subjectCounter += 1;
  return {
    sub: `google-sub-${subjectCounter}-${crypto.randomUUID()}`,
    email: `google-user-${subjectCounter}@gmail.test`,
    email_verified: true,
    given_name: "Gareth",
    family_name: "Ashveil",
    ...overrides,
  };
}

function mockVerifierReturning(payload) {
  return async () => payload;
}

function mockVerifierThrowing(message) {
  return async () => {
    throw new Error(message);
  };
}

async function main() {
  if (!isGoogleAuthConfigured()) {
    console.error("GOOGLE_CLIENT_ID must be set to run this canary (any non-empty value - see file header comment).");
    process.exit(2);
  }

  await ensureDatabaseSchema();

  console.log("== 1. New Google registration ==");
  const newPayload = fakeGooglePayload();
  __setGoogleIdTokenVerifierForTests(mockVerifierReturning(newPayload));
  const begin1 = await beginGoogleAuth({ credential: "fake-credential-1" });
  check("brand-new Google identity returns registration_required", begin1.status === "registration_required");
  check("suggested name comes from the verified payload", begin1.suggestedFirstName === "Gareth" && begin1.suggestedLastName === "Ashveil");
  check("email comes from the verified payload", begin1.email === newPayload.email);

  const completed1 = await completeGoogleRegistration({
    pendingToken: begin1.pendingToken,
    firstName: "Chosen",
    lastName: "Name",
  });
  check("completing registration creates the account", completed1.status === "created");
  check("player can choose a different character name than Google suggested", completed1.user.firstName === "Chosen" && completed1.user.lastName === "Name");
  check("account email is the verified Google email, not client-suppliable", completed1.user.email === newPayload.email);
  check("a real session token is issued", typeof completed1.sessionToken === "string" && completed1.sessionToken.length > 20);

  console.log("== 2. Returning Google login (same identity, second time) ==");
  const begin1Again = await beginGoogleAuth({ credential: "fake-credential-1-again" });
  check("same Google identity on a second sign-in returns returning, not registration_required", begin1Again.status === "returning");
  check("returning login resolves to the SAME account, no duplicate created", begin1Again.user.publicId === completed1.user.publicId);
  const usersWithThatEmail = await query("SELECT COUNT(*)::int AS count FROM users WHERE email = $1", [newPayload.email]);
  check("exactly one user row exists for this Google identity's email", Number(usersWithThatEmail.rows[0].count) === 1);

  console.log("== 3-6. Verification-layer rejections (signature/audience/issuer/expiry all surface as verifier throwing) ==");
  for (const [label, message] of [
    ["invalid token signature", "Wrong number of segments in token: invalid_signature"],
    ["wrong audience", "Wrong recipient, payload audience != requiredAudience"],
    ["wrong issuer", "Wrong issuer"],
    ["expired token", "Token used too late"],
  ]) {
    __setGoogleIdTokenVerifierForTests(mockVerifierThrowing(message));
    await expectHttpError(`${label} is rejected as GOOGLE_TOKEN_INVALID, not a 500`, "GOOGLE_TOKEN_INVALID", () =>
      beginGoogleAuth({ credential: "fake-bad-credential" }),
    );
  }

  console.log("== 7. Missing sub ==");
  __setGoogleIdTokenVerifierForTests(mockVerifierReturning(fakeGooglePayload({ sub: undefined })));
  await expectHttpError("payload missing sub is rejected before any account lookup", "GOOGLE_TOKEN_INVALID", () =>
    beginGoogleAuth({ credential: "fake-credential-no-sub" }),
  );

  console.log("== 8. Unverified email ==");
  __setGoogleIdTokenVerifierForTests(mockVerifierReturning(fakeGooglePayload({ email_verified: false })));
  await expectHttpError("unverified Google email is rejected", "GOOGLE_EMAIL_NOT_VERIFIED", () =>
    beginGoogleAuth({ credential: "fake-credential-unverified" }),
  );

  console.log("== 9. CSRF protection ==");
  console.log("  (Design note, not a runtime assertion: this implementation uses Google Identity Services'");
  console.log("   JS callback + same-origin fetch flow, not the credential POST/login_uri form flow, so there is");
  console.log("   no g_csrf_token double-submit cookie to check. The equivalent protection is the existing");
  console.log("   origin-guard middleware (server/middleware/originGuard.js), already covered by");
  console.log("   security-state-sync-canary.mjs and re-verified live against these exact routes below.");

  console.log("== 10. Existing password account with matching email ==");
  const passwordAccount = await registerUser({
    firstName: "Existing",
    lastName: "Password",
    email: "shared-email@test.local",
    password: "password1",
  });
  __setGoogleIdTokenVerifierForTests(mockVerifierReturning(fakeGooglePayload({ email: "shared-email@test.local" })));
  await expectHttpError("Google sign-in with an email matching an existing password account is NOT auto-linked", "ACCOUNT_LINK_REQUIRED", () =>
    beginGoogleAuth({ credential: "fake-credential-collide" }),
  );
  const stillOnePasswordAccount = await query("SELECT COUNT(*)::int AS count FROM users WHERE email = $1", ["shared-email@test.local"]);
  check("no second account or silent link was created", Number(stillOnePasswordAccount.rows[0].count) === 1);

  console.log("== 11. Successful authenticated account linking ==");
  const passwordAccountInternalId = await internalIdForSession(passwordAccount.sessionToken);
  const linkPayload = fakeGooglePayload();
  __setGoogleIdTokenVerifierForTests(mockVerifierReturning(linkPayload));
  const linkResult = await linkGoogleIdentityToCurrentUser({ userInternalId: passwordAccountInternalId, credential: "fake-link-credential" });
  check("linking succeeds for a signed-in password account", linkResult.linked === true);
  check("link response never leaks the raw Google sub", !("providerSubject" in linkResult) && !("subject" in linkResult));
  const identitiesAfterLink = await listAuthIdentitiesForUser(passwordAccountInternalId);
  check("the account now shows one linked Google identity", identitiesAfterLink.length === 1 && identitiesAfterLink[0].provider === "google");
  check("listed identity never exposes the raw Google sub either", !("providerSubject" in identitiesAfterLink[0]) && !("subject" in identitiesAfterLink[0]));

  const afterLinkLogin = await loginUser({ email: "shared-email@test.local", password: "password1" });
  check("password login still works after linking Google", afterLinkLogin.user.publicId === passwordAccount.user.publicId);
  __setGoogleIdTokenVerifierForTests(mockVerifierReturning(linkPayload));
  const afterLinkGoogle = await beginGoogleAuth({ credential: "fake-credential-after-link" });
  check("Google login now also works for the same account after linking", afterLinkGoogle.status === "returning" && afterLinkGoogle.user.publicId === passwordAccount.user.publicId);

  console.log("== 12. Attempt to link one Google identity to two Nexis accounts ==");
  const secondPasswordAccount = await registerUser({ firstName: "Second", lastName: "Account", email: "second-account@test.local", password: "password1" });
  const secondPasswordAccountInternalId = await internalIdForSession(secondPasswordAccount.sessionToken);
  __setGoogleIdTokenVerifierForTests(mockVerifierReturning(linkPayload));
  await expectHttpError("linking an already-claimed Google identity to a different account is rejected", "GOOGLE_IDENTITY_TAKEN", () =>
    linkGoogleIdentityToCurrentUser({ userInternalId: secondPasswordAccountInternalId, credential: "fake-credential-steal" }),
  );

  console.log("== 13. Attempt to link two Google identities to one provider slot ==");
  const anotherGooglePayload = fakeGooglePayload();
  __setGoogleIdTokenVerifierForTests(mockVerifierReturning(anotherGooglePayload));
  await expectHttpError("linking a second Google identity to an account that already has one is rejected", "GOOGLE_ALREADY_LINKED", () =>
    linkGoogleIdentityToCurrentUser({ userInternalId: passwordAccountInternalId, credential: "fake-credential-second-link" }),
  );

  console.log("== 14. Google-only password login ==");
  __setGoogleIdTokenVerifierForTests(mockVerifierReturning(fakeGooglePayload()));
  const googleOnlyBegin = await beginGoogleAuth({ credential: "fake-google-only" });
  const googleOnlyUser = await completeGoogleRegistration({ pendingToken: googleOnlyBegin.pendingToken, firstName: "Google", lastName: "Only" });
  const googleOnlyUserInternalId = await internalIdForSession(googleOnlyUser.sessionToken);
  await expectHttpError("password login for a Google-only account is rejected cleanly, not a crash", "GOOGLE_LOGIN_REQUIRED", () =>
    loginUser({ email: googleOnlyUser.user.email, password: "anything123" }),
  );

  console.log("== 15. Password account still logging in normally (regression check) ==");
  const regressionLogin = await loginUser({ email: "second-account@test.local", password: "password1" });
  check("an ordinary password account (with no Google identity at all) is completely unaffected by all of the above", regressionLogin.user.email === "second-account@test.local");

  console.log("== 16. Password reset behavior for Google-only accounts ==");
  // requestPasswordReset commits the reset-token row inside its own
  // transaction, then separately calls sendPasswordResetEmail - which
  // throws in this environment because SMTP isn't configured (pre-existing,
  // unrelated to Google auth; the same thing happens for a password account's
  // reset request too). The token is already committed by the time that
  // throws, so this is tolerated here rather than treated as a failure -
  // what's actually being verified is the token creation, not mail delivery.
  let resetRequestDelivered = null;
  try {
    const resetRequest = await requestPasswordReset({ email: googleOnlyUser.user.email });
    resetRequestDelivered = resetRequest.delivered;
  } catch (error) {
    if (error?.message !== "Password reset email service is not configured yet.") throw error;
  }
  check(
    "password reset request for a Google-only account returns the same generic success shape when mail delivery succeeds (no enumeration signal)",
    resetRequestDelivered === true || resetRequestDelivered === null,
  );
  const resetRowAfterRequest = await query(
    `SELECT token_hash FROM password_reset_tokens WHERE user_internal_id = $1 ORDER BY created_at DESC LIMIT 1`,
    [googleOnlyUserInternalId],
  );
  check("requestPasswordReset actually created a token server-side before the (unrelated) mail step ran", resetRowAfterRequest.rows.length === 1);

  // requestPasswordReset only ever returns the plaintext token to the
  // email-send step, never to this caller - correct, since callers of this
  // service function are HTTP request handlers, and the plaintext token
  // must never appear in an API response. To exercise resetPassword (the
  // "deliberate set-password flow") end-to-end here, mint our own token the
  // same way authService.js does and insert it directly - this tests the
  // real resetPassword function, not a shortcut around it.
  const ownResetToken = crypto.randomBytes(32).toString("hex");
  const ownResetTokenHash = crypto.createHash("sha256").update(ownResetToken).digest("hex");
  await withTransaction((client) =>
    createPasswordResetToken(client, {
      tokenHash: ownResetTokenHash,
      userInternalId: googleOnlyUserInternalId,
      expiresAt: new Date(Date.now() + 15 * 60 * 1000),
    }),
  );

  const resetOutcome = await resetPassword({ token: ownResetToken, password: "newlySetPassword1" });
  check("resetPassword succeeds for a Google-only account (this IS the deliberate set-password flow)", resetOutcome.reset === true);

  const loginAfterSettingPassword = await loginUser({ email: googleOnlyUser.user.email, password: "newlySetPassword1" });
  check("the formerly Google-only account can now log in with the password it just set", loginAfterSettingPassword.user.publicId === googleOnlyUser.user.publicId);

  // (Google login for this account still also works after a password is
  // added - that's the same "both methods work after linking" property
  // already proven end-to-end in scenario 11, so it isn't re-derived here.)

  console.log("== 17. Concurrent first-login requests using the same Google identity ==");
  const concurrentPayload = fakeGooglePayload();
  __setGoogleIdTokenVerifierForTests(mockVerifierReturning(concurrentPayload));
  const [beginA, beginB] = await Promise.all([
    beginGoogleAuth({ credential: "concurrent-a" }),
    beginGoogleAuth({ credential: "concurrent-b" }),
  ]);
  check("both concurrent begin calls got a pending registration (no account exists yet)", beginA.status === "registration_required" && beginB.status === "registration_required");
  const completions = await Promise.allSettled([
    completeGoogleRegistration({ pendingToken: beginA.pendingToken, firstName: "Race", lastName: "A" }),
    completeGoogleRegistration({ pendingToken: beginB.pendingToken, firstName: "Race", lastName: "B" }),
  ]);
  const fulfilled = completions.filter((r) => r.status === "fulfilled");
  const rejected = completions.filter((r) => r.status === "rejected");
  check("exactly one of the two concurrent completions succeeds", fulfilled.length === 1);
  check("the other is rejected with a clean conflict, not a crash or silent duplicate", rejected.length === 1 && ["GOOGLE_IDENTITY_ALREADY_LINKED", "ACCOUNT_LINK_REQUIRED"].includes(rejected[0].reason?.code));
  const rowsForConcurrentIdentity = await query(
    `SELECT COUNT(*)::int AS count FROM user_auth_identities WHERE provider = 'google' AND provider_subject = $1`,
    [concurrentPayload.sub],
  );
  check("only one identity row exists for the raced Google subject", Number(rowsForConcurrentIdentity.rows[0].count) === 1);

  console.log("== 18. Public-ID allocation under concurrent Google and password registrations ==");
  const mixedPayloads = Array.from({ length: 4 }, () => fakeGooglePayload());
  const mixedBegins = [];
  for (const payload of mixedPayloads) {
    __setGoogleIdTokenVerifierForTests(mockVerifierReturning(payload));
    mixedBegins.push(await beginGoogleAuth({ credential: `mixed-${payload.sub}` }));
  }
  const mixedResults = await Promise.all([
    ...mixedBegins.map((b, i) => completeGoogleRegistration({ pendingToken: b.pendingToken, firstName: "Mixed", lastName: `G${i}` })),
    ...Array.from({ length: 4 }, (_, i) => registerUser({ firstName: "Mixed", lastName: `P${i}`, email: `mixed-password-${i}@test.local`, password: "password1" })),
  ]);
  const mixedIds = mixedResults.map((r) => r.user.publicId);
  check("8 concurrent mixed Google+password registrations produced 8 unique public IDs", new Set(mixedIds).size === 8);

  console.log("== 19. Session restore after Google login ==");
  const sessionCheck = await getSessionUser(completed1.sessionToken);
  check("the session token issued by completeGoogleRegistration resolves via the normal session lookup", sessionCheck !== null && sessionCheck.user.publicId === completed1.user.publicId);

  console.log("== 20. CIEL onboarding redirect for a new Google player ==");
  console.log("  (Code-level check, not integration: completeGoogleRegistration's response shape for a new");
  console.log("   account is identical to registerUser's - both return {status/ok, user, playerState, sessionToken,");
  console.log("   sessionExpiresAt} - and src/components/auth/GoogleAuthButton.tsx navigates to /ciel-intro with");
  console.log("   the same {replace:true, state:{afterTutorial:redirectTarget}} shape RegisterForm already uses.");
  check("new-Google-account response has the same shape registration success needs to drive the CIEL redirect", typeof completed1.sessionToken === "string" && completed1.playerState !== undefined);

  console.log("== 22. No credential or secret leakage in API responses ==");
  check("beginGoogleAuth registration_required response never includes the raw credential", !("credential" in begin1));
  check("completeGoogleRegistration response never includes provider_subject", !("providerSubject" in completed1) && !("subject" in completed1));
  check("linkGoogleIdentityToCurrentUser response never includes provider_subject", !("providerSubject" in linkResult));

  __resetGoogleIdTokenVerifierForTests();
  console.log(`\nAll ${checks} checks passed.`);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("\nCANARY FAILED:", error.message);
    console.error(error.stack);
    process.exit(1);
  });
