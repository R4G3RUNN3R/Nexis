// Profile page redesign: viewer-role visibility fix for "The Absolute" title.
//
// server/services/profileService.js's buildProfileResponse() used to put
// runtimeState.player.equippedTitle straight onto the wire with zero
// viewer-identity check, on a route (GET /api/profiles/:publicId) that works
// even fully logged out. The Absolute's MUTATION paths (equip/earn/grant)
// were already correctly locked to the one allowlisted account
// (exclusiveToPublicId, checked via isTitleVisibleToUser in titleService.js)
// - but that only protects who can make it appear, never who is allowed to
// merely SEE it once equipped. This canary proves the DISPLAY fix: only the
// title's owner or a staff/admin viewer should ever see "The Absolute" in a
// profile response; every other viewer (including fully anonymous) must not.
//
// Boots its own in-process server via createApp() against disposable
// pglite - never touches production, never creates production accounts.
// The "Hennet"-equivalent fixture below is a throwaway pglite-only account
// seeded by this canary at the reserved public ID The Absolute is allowlisted
// to (1,000,000) - it is NOT the real production account and uses a
// randomly-generated password that only ever exists for this run.
//
//   node server/scripts/canaries/absolute-title-visibility-canary.mjs
//
import assert from "node:assert/strict";
import crypto from "node:crypto";
import { createApp } from "../../app.js";
import { ensureDatabaseSchema } from "../../db/migrate.js";
import { withTransaction, closePool } from "../../db/pool.js";
import { registerUser } from "../../services/authService.js";
import { createUser, findUserByPublicId } from "../../repositories/usersRepository.js";
import { createDefaultPlayerState, findPlayerStateByUserInternalId, upsertPlayerRuntimeState } from "../../repositories/playerStateRepository.js";
import { buildMutableRuntimeState } from "../../lib/runtimePlayerState.js";
import { grantAbsoluteTitleToAllowlistedAccount } from "../../services/titleService.js";
import { ABSOLUTE_OWNER_PUBLIC_ID } from "../../lib/adminAccess.js";
import bcrypt from "bcryptjs";

if (process.env.DATABASE_URL) {
  throw new Error("This canary must run with DATABASE_URL unset (disposable pglite only) - refusing to start.");
}

const PORT = 8918;
const BASE = `http://127.0.0.1:${PORT}`;

let checks = 0;
let failures = 0;
function check(label, condition) {
  checks += 1;
  if (condition) {
    console.log(`  [${checks}] PASS - ${label}`);
  } else {
    failures += 1;
    console.log(`  [${checks}] FAIL - ${label}`);
  }
}

async function api(path, { method = "GET", token = null, body = null } = {}) {
  const headers = {};
  if (token) headers.Authorization = `Bearer ${token}`;
  if (body !== null) headers["Content-Type"] = "application/json";
  const response = await fetch(`${BASE}${path}`, {
    method,
    headers,
    body: body !== null ? JSON.stringify(body) : undefined,
  });
  const payload = await response.json().catch(() => null);
  return { status: response.status, payload };
}

let userSeq = 0;
async function makeUser(label, { privilegeRole = "player" } = {}) {
  userSeq += 1;
  const email = `absolutecanary.${label}.${userSeq}.${Date.now()}@nexis.local`;
  const reg = await registerUser({ firstName: "Absolute", lastName: label, email, password: "TestPass123!" });
  // registerUser's response internalId is the privacy-sanitized synthetic
  // "plr_<publicId>" placeholder (see authService.js's mapPublicApiUser),
  // not the real DB internal_id - must re-fetch the real row via publicId
  // before updating privilege_role, or the UPDATE silently matches nothing.
  const user = await withTransaction((client) => findUserByPublicId(client, reg.user.publicId));
  if (privilegeRole !== "player") {
    await withTransaction((client) => client.query(`UPDATE users SET privilege_role = $1 WHERE internal_id = $2`, [privilegeRole, user.internalId]));
  }
  const login = await api("/api/login", { method: "POST", body: { email, password: "TestPass123!" } });
  return { user, token: login.payload.sessionToken };
}

// Seeds a throwaway pglite-only account at the reserved public ID The
// Absolute is allowlisted to - deliberately, not as a side effect - so this
// canary is fully self-contained like every other disposable-instance
// canary. Never run against a real database (DATABASE_URL is required to be
// unset above); a real production Hennet account is never touched by this.
async function seedAbsoluteOwnerFixture() {
  const password = crypto.randomBytes(16).toString("hex");
  const internalId = `usr_${crypto.randomUUID()}`;
  const passwordHash = await bcrypt.hash(password, 10);

  await withTransaction(async (client) => {
    await createUser(client, {
      internalId,
      publicId: ABSOLUTE_OWNER_PUBLIC_ID,
      username: "AbsoluteCanaryFixture",
      email: `absolutecanary.owner.${Date.now()}@nexis.local`,
      firstName: "Hennet",
      lastName: "CanaryFixture",
      passwordHash,
    });
    await createDefaultPlayerState(client, internalId);
  });

  const user = await withTransaction((client) => findUserByPublicId(client, ABSOLUTE_OWNER_PUBLIC_ID));
  const login = await api("/api/login", { method: "POST", body: { email: user.email, password } });
  return { user, token: login.payload.sessionToken };
}

async function equipAbsoluteTitle(internalId) {
  await withTransaction(async (client) => {
    const playerState = await findPlayerStateByUserInternalId(client, internalId);
    const user = await findUserByPublicId(client, ABSOLUTE_OWNER_PUBLIC_ID);
    const runtimeState = buildMutableRuntimeState(user, playerState);
    runtimeState.player.titles = { ...runtimeState.player.titles, equippedTitleId: "the_absolute" };
    await upsertPlayerRuntimeState(client, internalId, runtimeState);
  });
}

async function runTests() {
  await ensureDatabaseSchema();
  const app = createApp();
  const server = app.listen(PORT);
  await new Promise((resolve) => server.once("listening", resolve));

  try {
    await runAllChecks();
  } finally {
    await new Promise((resolve) => server.close(resolve));
    await closePool();
  }

  console.log(`\n${checks - failures}/${checks} checks passed.`);
  if (failures > 0) console.log(`${failures} FAILED.`);
  process.exit(failures > 0 ? 1 : 0);
}

async function runAllChecks() {
  const { user: absoluteOwner, token: absoluteOwnerToken } = await seedAbsoluteOwnerFixture();

  const grantResult = await grantAbsoluteTitleToAllowlistedAccount({ actor: "canary" });
  check("grant script targets the seeded fixture account", grantResult.publicId === ABSOLUTE_OWNER_PUBLIC_ID);
  check("grant script is not already-granted on first run", grantResult.alreadyGranted !== true);

  const secondGrant = await grantAbsoluteTitleToAllowlistedAccount({ actor: "canary" });
  check("grant script is idempotent - second call reports already-granted", secondGrant.alreadyGranted === true);

  await equipAbsoluteTitle(absoluteOwner.internalId);

  const publicIdParam = `P${String(ABSOLUTE_OWNER_PUBLIC_ID).padStart(7, "0")}`;

  const { token: playerToken } = await makeUser("player", { privilegeRole: "player" });
  const { token: staffToken } = await makeUser("staff", { privilegeRole: "staff" });

  const anonymousView = await api(`/api/profiles/${publicIdParam}`);
  check("anonymous viewer: request succeeds", anonymousView.status === 200);
  check(
    "anonymous viewer: does NOT see The Absolute in title",
    !String(anonymousView.payload?.profile?.publicProfile?.title ?? "").includes("Absolute"),
  );
  check(
    "anonymous viewer: equippedTitle is null, not leaked",
    anonymousView.payload?.profile?.publicProfile?.equippedTitle === null,
  );

  const playerView = await api(`/api/profiles/${publicIdParam}`, { token: playerToken });
  check(
    "player-role viewer: does NOT see The Absolute in title",
    !String(playerView.payload?.profile?.publicProfile?.title ?? "").includes("Absolute"),
  );
  check(
    "player-role viewer: equippedTitle is null, not leaked",
    playerView.payload?.profile?.publicProfile?.equippedTitle === null,
  );

  const staffView = await api(`/api/profiles/${publicIdParam}`, { token: staffToken });
  check(
    "staff-role viewer: DOES see The Absolute in title",
    String(staffView.payload?.profile?.publicProfile?.title ?? "").includes("Absolute"),
  );
  check(
    "staff-role viewer: equippedTitle.name is The Absolute",
    staffView.payload?.profile?.publicProfile?.equippedTitle?.name === "The Absolute",
  );

  const selfView = await api(`/api/profiles/${publicIdParam}`, { token: absoluteOwnerToken });
  check(
    "self-view (owner logged in): DOES see The Absolute regardless of own role",
    String(selfView.payload?.profile?.publicProfile?.title ?? "").includes("Absolute"),
  );
  check(
    "self-view: selfProfile stat block is present (own-view data unaffected by the display fix)",
    typeof selfView.payload?.profile?.selfProfile?.battleStats?.strength === "number",
  );
  check(
    "self-view: The Absolute's +100000 flat stat effect is actually applied to combat stats",
    selfView.payload?.profile?.selfProfile?.battleStats?.strength >= 100000,
  );
  check(
    "self-view: The Absolute's +100000 flat stat effect is actually applied to working stats",
    selfView.payload?.profile?.selfProfile?.workingStats?.intelligence >= 100000,
  );
}

runTests().catch((error) => {
  console.error("CANARY FAILED:", error);
  process.exit(1);
});
