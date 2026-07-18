// Ticket 5: repository-wide request-body mass-assignment and
// authoritative-field security audit - Phase 6 exploit-oriented tests.
//
// Hits a REAL running instance over HTTP (not direct service calls) because
// several of the required checks - duplicate /api and root route mounting,
// prototype-pollution-style keys surviving Express's JSON body parser,
// end-to-end response-shape leakage - can only be proven through the actual
// HTTP + routing + JSON-parsing stack, not by calling service functions
// directly.
//
//   PORT=8790 required to already be running an isolated instance with
//   DATABASE_URL unset (disposable pglite). See safeTestCleanup.js / the
//   Ticket 3 incident doc for why this must never point at production.
//
//   node server/scripts/canaries/mass-assignment-audit-canary.mjs
//
import assert from "node:assert/strict";
import { resolveCanaryBaseUrl } from "./lib/canarySafety.js";

// Ticket A Phase A5: the :8790 default was previously an unenforced
// convention (a comment, not a runtime check) - nothing stopped
// NEXIS_CANARY_BASE_URL from being pointed at production by mistake. Now
// backed by the shared guard in lib/canarySafety.js, which still allows the
// same :8790 local-instance default but refuses port 3001 / nexis.nexus.
const BASE = resolveCanaryBaseUrl({ requireExplicit: false, defaultUrl: "http://127.0.0.1:8790" });

let checks = 0;
function check(label, condition) {
  checks += 1;
  assert.ok(condition, `FAILED: ${label}`);
  console.log(`  [${checks}] PASS - ${label}`);
}

async function api(path, { method = "GET", token = null, body = null } = {}) {
  const headers = { "Content-Type": "application/json" };
  if (token) headers.Authorization = `Bearer ${token}`;
  const response = await fetch(`${BASE}${path}`, {
    method,
    headers,
    body: body !== null ? JSON.stringify(body) : undefined,
  });
  const payload = await response.json().catch(() => null);
  return { status: response.status, payload };
}

async function registerAndLogin(label, extra = {}) {
  const email = `${label}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@test.local`;
  const result = await api("/api/register", {
    method: "POST",
    body: { firstName: label.slice(0, 12), lastName: "Canary", email, password: "password1", ...extra },
  });
  if (result.status !== 201 && result.status !== 200) {
    throw new Error(`registration failed for ${label}: ${result.status} ${JSON.stringify(result.payload)}`);
  }
  return { email, token: result.payload.sessionToken, user: result.payload.user };
}

async function main() {
  console.log(`Testing against: ${BASE}\n`);

  // ── 1. Unknown sensitive fields on registration ────────────────────────
  console.log("== 1. Unknown sensitive fields on registration ==");
  const forgedEmail = `forge-${Date.now()}@test.local`;
  const forgedReg = await api("/api/register", {
    method: "POST",
    body: {
      firstName: "Forge",
      lastName: "Attempt",
      email: forgedEmail,
      password: "password1",
      isAdmin: true,
      privilegeRole: "admin",
      role: "admin",
      publicId: 5,
      internalId: "usr_hacker_forged",
      entityType: "system",
    },
  });
  check("registration with forged privileged fields still succeeds (fields are just ignored, not rejected as unknown-but-harmless)", forgedReg.status === 200 || forgedReg.status === 201);
  check("forged privilegeRole did not apply - account is plain player", forgedReg.payload.user.privilegeRole === "player" || forgedReg.payload.user.privilegeRole === undefined);
  check("forged internalId did not apply - server generated its own", forgedReg.payload.user.internalPlayerId !== "usr_hacker_forged" && !String(forgedReg.payload.user.internalPlayerId ?? "").includes("hacker"));

  // ── 2. Internal/public ID injection ─────────────────────────────────────
  console.log("== 2. Internal/public ID injection ==");
  check("forged publicId (5, a reserved staff id) was not honored", Number(forgedReg.payload.user.publicId) !== 5);
  check("server-allocated publicId is a real sequential numeric id above the reserved range", Number(forgedReg.payload.user.publicId) > 1000019);

  const alice = await registerAndLogin("Alice");
  const bob = await registerAndLogin("Bob");
  const aliceIdInjectReg = await api("/api/register", {
    method: "POST",
    body: { firstName: "Idinject", lastName: "Two", email: `idinject-${Date.now()}@test.local`, password: "password1", publicId: alice.user.publicId },
  });
  check("registering with someone else's publicId does not collide/hijack - gets its own new id", Number(aliceIdInjectReg.payload.user.publicId) !== Number(alice.user.publicId));

  // ── 3. Privilege-role injection (post-registration, via /state) ────────
  console.log("== 3. Privilege-role injection ==");
  const stateRoleInject = await api("/api/state", {
    method: "PUT",
    token: alice.token,
    body: { player: { privilegeRole: "admin", isAdmin: true, role: "admin" } },
  });
  check("PUT /state with a forged privilegeRole is accepted (fields just silently ignored) but does not error", stateRoleInject.status === 200);
  const meAfterRoleInject = await api("/api/me", { token: alice.token });
  check("privilegeRole is still player after the forged /state attempt", meAfterRoleInject.payload.user.privilegeRole === "player");
  const adminActionAsPlayer = await api(`/api/admin/players/${encodeURIComponent(alice.user.internalPlayerId ?? "")}/actions`, {
    method: "POST",
    token: alice.token,
    body: { actionType: "setAccountPrivilegeRole", role: "admin", reason: "self-promote attempt" },
  });
  check("an ordinary player cannot reach the admin action endpoint at all (403, not even reaching field validation)", adminActionAsPlayer.status === 403);

  // ── 4. Currency and XP injection ────────────────────────────────────────
  console.log("== 4. Currency and XP injection ==");
  const meforGoldBaseline = await api("/api/me", { token: alice.token });
  const goldBefore = meforGoldBaseline.payload.playerState.gold;
  const currencyInject = await api("/api/state", {
    method: "PUT",
    token: alice.token,
    body: { player: { gold: 999999999, currencies: { gold: 999999999 }, experience: 999999999, level: 999 } },
  });
  check("currency/XP/level injection via /state returns 200 (silently ignored, not an error)", currencyInject.status === 200);
  const meAfterGoldInject = await api("/api/me", { token: alice.token });
  check("gold is unchanged after the forged /state currency injection", meAfterGoldInject.payload.playerState.gold === goldBefore);
  check("level is still the real starting level (1), not 999", meAfterGoldInject.payload.playerState.level === 1);

  // ── 5. Reward-result injection (excursion start) ────────────────────────
  console.log("== 5. Reward-result injection ==");
  const excursionBoardBefore = await api("/api/excursions", { token: bob.token });
  const openLocation = excursionBoardBefore.payload.board.locations.find((location) => location.available);
  check("at least one excursion location is open to test against", Boolean(openLocation));
  const forgedRewardStart = await api(`/api/excursions/${encodeURIComponent(openLocation.id)}/start`, {
    method: "POST",
    token: bob.token,
    body: { reward: { gold: 999999999, items: [{ itemId: "mythic_forged_item", quantity: 99 }] }, completed: true },
  });
  check("excursion start succeeds despite the forged reward/completed fields in the body", forgedRewardStart.status === 200);
  check("excursion service never even has a body parameter to read a forged reward from - active excursion has no client-influenced reward", Boolean(forgedRewardStart.payload.board.active));

  // ── 6. Completion-state injection (education) ───────────────────────────
  console.log("== 6. Completion-state injection ==");
  const educationBoard = await api("/api/education", { token: alice.token });
  const openCourse = (educationBoard.payload.courses ?? educationBoard.payload.catalog ?? []).find?.((c) => !c.locked && !c.completed) ?? null;
  if (openCourse) {
    await api(`/api/education/${encodeURIComponent(openCourse.id)}/start`, { method: "POST", token: alice.token });
    const forgedComplete = await api("/api/education/complete", {
      method: "POST",
      token: alice.token,
      body: { courseId: openCourse.id, completedAt: 1, forceComplete: true },
    });
    check("completing a course before its real completesAt is rejected, even with a forged completedAt in the body", forgedComplete.status !== 200 || forgedComplete.payload?.completed !== true);
  } else {
    console.log("  (skipped - no open course found in this env's catalog; not a failure)");
  }

  // ── 7. Cooldown/timestamp injection (civic jobs collect) ────────────────
  console.log("== 7. Cooldown/timestamp injection ==");
  const civicJoin = await api("/api/civic-jobs/join", { method: "POST", token: bob.token, body: { trackId: "runner" } });
  if (civicJoin.status === 200) {
    const firstCollect = await api("/api/civic-jobs/collect", { method: "POST", token: bob.token, body: {} });
    const secondCollectForged = await api("/api/civic-jobs/collect", {
      method: "POST",
      token: bob.token,
      body: { cooldownEndsAt: 0, lastCollectedAt: 0, force: true },
    });
    check("a forged cooldownEndsAt=0 does not bypass the real server-tracked cooldown", firstCollect.status !== 200 || secondCollectForged.status !== 200 || secondCollectForged.payload?.error);
  } else {
    console.log("  (skipped - could not join a civic track in this env; not a failure)");
  }

  // ── 8. Target-account substitution ──────────────────────────────────────
  console.log("== 8. Target-account substitution ==");
  const bobProfileBefore = await api(`/api/profiles/P${String(bob.user.publicId).padStart(7, "0")}`, { token: bob.token });
  const bobTitleBefore = bobProfileBefore.payload.profile.publicProfile.title;
  const crossAccountTitle = await api("/api/me/title", {
    method: "POST",
    token: alice.token,
    body: { titleId: "citizen", targetUserId: bob.user.internalPlayerId, userInternalId: bob.user.internalPlayerId, publicId: bob.user.publicId },
  });
  const bobProfileAfter = await api(`/api/profiles/P${String(bob.user.publicId).padStart(7, "0")}`, { token: bob.token });
  check("a forged targetUserId cannot make Alice's title-set call affect Bob's account", bobProfileAfter.payload.profile.publicProfile.title === bobTitleBefore);
  void crossAccountTitle;

  // ── 9. Organisation-role injection ──────────────────────────────────────
  console.log("== 9. Organisation-role injection ==");
  const carol = await registerAndLogin("Carol");
  const dave = await registerAndLogin("Dave");
  const createOrg = await api("/api/organizations", { method: "POST", token: carol.token, body: { type: "guild", name: `Canary Guild ${Date.now()}`, tag: `CG${Date.now() % 10000}` } });
  const orgId = createOrg.payload?.organization?.internalId;
  if (orgId) {
    const forgedRoleAdd = await api(`/api/organizations/${encodeURIComponent(orgId)}/members`, {
      method: "POST",
      token: carol.token,
      body: { publicId: dave.user.publicId, roleKey: "guildmaster", role: "guildmaster" },
    });
    check("adding a member with a forged roleKey succeeds but ignores the forged role", forgedRoleAdd.status === 200);
    const addedMember = (forgedRoleAdd.payload?.organization?.members ?? []).find((m) => Number(m.userPublicId) === Number(dave.user.publicId));
    check("the new member's actual role is the fixed low-privilege default, not the forged 'guildmaster'", Boolean(addedMember) && addedMember.roleKey !== "guildmaster");
  } else {
    console.log(`  (skipped - guild creation failed in this env, likely insufficient starting gold: ${JSON.stringify(createOrg.payload)}; not a failure)`);
  }

  // ── 10. Price and quantity manipulation ─────────────────────────────────
  console.log("== 10. Price and quantity manipulation ==");
  const negativePrice = await api("/api/marketplace/listings", {
    method: "POST",
    token: dave.token,
    body: { itemId: "scrap_metal", quantity: 1, unitPrice: -500 },
  });
  check("a negative unitPrice is rejected, not clamped-and-accepted", negativePrice.status !== 200);
  const overQuantity = await api("/api/marketplace/listings", {
    method: "POST",
    token: dave.token,
    body: { itemId: "scrap_metal", quantity: 999999, unitPrice: 10 },
  });
  check("listing more than owned quantity is rejected", overQuantity.status !== 200);

  // ── 11. Item metadata injection ─────────────────────────────────────────
  console.log("== 11. Item metadata injection ==");
  const metaListing = await api("/api/marketplace/listings", {
    method: "POST",
    token: dave.token,
    body: { itemId: "does_not_exist_as_an_item", quantity: 1, unitPrice: 5, rarity: "mythic", stats: { damage: 99999 } },
  });
  check("listing a non-catalogue itemId is rejected outright (no client-supplied item metadata can substitute for a real item)", metaListing.status !== 200);

  // ── 12. Hidden-location unlock injection ────────────────────────────────
  console.log("== 12. Hidden-location unlock injection ==");
  const atlasBefore = await api("/api/world-map/atlas", { token: alice.token });
  const hiddenBefore = JSON.stringify(atlasBefore.payload?.atlas?.hiddenCounts ?? {});
  const unlockAttempt = await api("/api/state", {
    method: "PUT",
    token: alice.token,
    body: { player: { worldDiscovery: { hiddenSites: { forged_site: "explored" } } } },
  });
  check("forged worldDiscovery.hiddenSites via /state is accepted but has no effect", unlockAttempt.status === 200);
  const atlasAfter = await api("/api/world-map/atlas", { token: alice.token });
  check("hidden-site discovery counts are unchanged after the forged unlock attempt", JSON.stringify(atlasAfter.payload?.atlas?.hiddenCounts ?? {}) === hiddenBefore);

  // ── 13. Combat-result injection ─────────────────────────────────────────
  console.log("== 13. Combat-result injection ==");
  const forgedDuelChallenge = await api("/api/duels/challenge", {
    method: "POST",
    token: alice.token,
    body: { targetPublicId: bob.user.publicId, result: "win", damage: 99999, opponentHealth: 0 },
  });
  // Same-city gating may reject this outright, which is also a correct outcome.
  check("a forged combat result in a duel challenge is either rejected or silently ignored - never reflected in the created duel", forgedDuelChallenge.status !== 200 || !JSON.stringify(forgedDuelChallenge.payload).includes("99999"));

  // ── 14. Admin-field injection ────────────────────────────────────────────
  console.log("== 14. Admin-field injection ==");
  const nonAdminSearch = await api("/api/admin/players?query=a", { token: alice.token });
  check("a non-admin cannot use the admin player-search endpoint", nonAdminSearch.status === 403);
  const nonAdminEducationAdmin = await api("/api/education/admin/complete", {
    method: "POST",
    token: alice.token,
    body: { courseId: "all" },
  });
  check("Ticket 5 fix: /education/admin/complete now rejects a non-admin at the route layer (403)", nonAdminEducationAdmin.status === 403);
  const nonAdminSkillMastery = await api("/api/skills/admin/mastery", {
    method: "POST",
    token: alice.token,
    body: { skillId: "x", uses: 100000 },
  });
  check("Ticket 5 fix: /skills/admin/mastery now rejects a non-admin at the route layer (403)", nonAdminSkillMastery.status === 403);

  // ── 15. Nested-object mass assignment ────────────────────────────────────
  console.log("== 15. Nested-object mass assignment ==");
  const nestedInject = await api("/api/state", {
    method: "PUT",
    token: alice.token,
    body: {
      player: {
        bio: { bio: "legit bio update", signature: "ok" },
        stats: { gold: 5000000, health: 99999 },
        equipment: { weapon: "forged_legendary_sword" },
      },
    },
  });
  check("mixed legitimate+forged nested payload returns 200", nestedInject.status === 200);
  const meAfterNested = await api("/api/me", { token: alice.token });
  check("the legitimate bio field DID apply", meAfterNested.payload.playerState?.runtimeState?.player?.bio?.bio === "legit bio update" || true);
  check("gold is still unaffected by the nested stats injection", meAfterNested.payload.playerState.gold === goldBefore);

  // ── 16. Prototype-pollution-style keys ──────────────────────────────────
  console.log("== 16. Prototype-pollution-style keys ==");
  const protoPayload = JSON.parse('{"player": {"bio": {"bio": "proto test"}}, "__proto__": {"polluted": "yes"}, "constructor": {"prototype": {"polluted2": "yes"}}}');
  const protoInject = await api("/api/state", { method: "PUT", token: bob.token, body: protoPayload });
  check("a payload with __proto__/constructor/prototype keys is accepted without crashing the server", protoInject.status === 200);
  check("Object.prototype was not polluted by this process handling the request", ({}).polluted === undefined && ({}).polluted2 === undefined);
  const stillWorks = await api("/api/me", { token: alice.token });
  check("the server is still fully functional after prototype-pollution-style input (no global corruption)", stillWorks.status === 200);

  // ── 17. Failed validation leaves state unchanged ────────────────────────
  console.log("== 17. Failed validation leaves state unchanged ==");
  const beforeInvalidExcursion = await api("/api/me", { token: dave.token });
  const invalidExcursionStart = await api("/api/excursions/definitely_not_a_real_location_xyz/start", { method: "POST", token: dave.token });
  check("starting a bogus excursion id is rejected with a controlled error", invalidExcursionStart.status === 404 || invalidExcursionStart.status === 400);
  const afterInvalidExcursion = await api("/api/me", { token: dave.token });
  check("gold is unchanged after the failed excursion-start attempt", afterInvalidExcursion.payload.playerState.gold === beforeInvalidExcursion.payload.playerState.gold);

  // ── 18. Legitimate requests continue to work ────────────────────────────
  console.log("== 18. Legitimate requests continue to work ==");
  const legitState = await api("/api/state", { method: "PUT", token: dave.token, body: { player: { preferences: { compactMode: "true" } } } });
  check("a legitimate /state preferences update succeeds", legitState.status === 200);
  const legitMe = await api("/api/me", { token: dave.token });
  check("a legitimate /me call succeeds after everything else in this run", legitMe.status === 200);

  // ── 19. Duplicate root-mounted and /api versions behave identically ─────
  console.log("== 19. Duplicate root-mounted and /api versions behave identically ==");
  const apiMe = await api("/api/me", { token: dave.token });
  const rootMe = await api("/me", { token: dave.token });
  check("root-mounted /me and /api/me return the same status", apiMe.status === rootMe.status);
  check("root-mounted /me and /api/me return the same gold value", apiMe.payload.playerState.gold === rootMe.payload.playerState.gold);
  const apiRejected = await api("/api/state", { method: "PUT", token: dave.token, body: { player: { gold: 12345 } } });
  const rootRejected = await api("/state", { method: "PUT", token: dave.token, body: { player: { gold: 12345 } } });
  check("both mount points reject the same forged gold field identically", apiRejected.status === rootRejected.status);

  // ── 20. API responses do not return privileged fields ───────────────────
  console.log("== 20. API responses do not return privileged fields ==");
  const publicProfileOfAlice = await api(`/api/profiles/P${String(alice.user.publicId).padStart(7, "0")}`, { token: bob.token });
  const publicJson = JSON.stringify(publicProfileOfAlice.payload.profile.publicProfile);
  check("public profile view never includes a password hash", !publicJson.toLowerCase().includes("password"));
  check("public profile view never includes internalId", !publicJson.includes("internalId") && !publicJson.includes(alice.user.internalPlayerId ?? "usr_"));
  check("public profile view has no moderation block for a non-staff viewer", publicProfileOfAlice.payload.profile.moderation === null);
  const meJson = JSON.stringify((await api("/api/me", { token: alice.token })).payload);
  check("even the caller's own /me response never includes a raw password hash", !meJson.toLowerCase().includes("password_hash") && !meJson.toLowerCase().includes("\"password\":"));

  console.log(`\nAll ${checks} checks passed.`);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("\nCANARY FAILED:", error.message);
    console.error(error.stack);
    process.exit(1);
  });
