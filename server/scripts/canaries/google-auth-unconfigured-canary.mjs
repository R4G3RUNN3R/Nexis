// Companion to google-auth-canary.mjs, covering ticket scenario 21: safe
// behavior when GOOGLE_CLIENT_ID is absent. Must be run WITHOUT the env var
// set (the live server's actual current state):
//
//   node server/scripts/canaries/google-auth-unconfigured-canary.mjs
//
import assert from "node:assert/strict";
import { ensureDatabaseSchema } from "../../db/migrate.js";
import { isGoogleAuthConfigured } from "../../services/googleAuthService.js";
import { beginGoogleAuth, loginUser, registerUser } from "../../services/authService.js";
import { GOOGLE_CLIENT_ID } from "../../config/env.js";

let checks = 0;
function check(label, condition) {
  checks += 1;
  assert.ok(condition, `FAILED: ${label}`);
  console.log(`  [${checks}] PASS - ${label}`);
}

async function main() {
  if (GOOGLE_CLIENT_ID) {
    console.error("This canary must be run WITHOUT GOOGLE_CLIENT_ID set - it tests the unconfigured state.");
    process.exit(2);
  }

  await ensureDatabaseSchema();

  check("GOOGLE_CLIENT_ID is unset", !GOOGLE_CLIENT_ID);
  check("isGoogleAuthConfigured() correctly reports false", !isGoogleAuthConfigured());

  let rejectedCleanly = false;
  try {
    await beginGoogleAuth({ credential: "irrelevant-because-unconfigured" });
  } catch (error) {
    rejectedCleanly = error?.code === "GOOGLE_AUTH_NOT_CONFIGURED" && error?.status === 503;
  }
  check("Google auth entry point returns a controlled 503 config error, not a crash", rejectedCleanly);

  const passwordUser = await registerUser({
    firstName: "Unaffected",
    lastName: "ByGoogle",
    email: "unaffected-by-google@test.local",
    password: "password1",
  });
  check("password registration still works with Google fully unconfigured", passwordUser.user.email === "unaffected-by-google@test.local");

  const passwordLogin = await loginUser({ email: "unaffected-by-google@test.local", password: "password1" });
  check("password login still works with Google fully unconfigured", passwordLogin.user.publicId === passwordUser.user.publicId);

  console.log(`\nAll ${checks} checks passed. (Frontend note: GoogleAuthButton fetches /api/auth/google/config`);
  console.log(`and renders nothing when { configured: false } - see src/components/auth/GoogleAuthButton.tsx.)`);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("\nCANARY FAILED:", error.message);
    console.error(error.stack);
    process.exit(1);
  });
