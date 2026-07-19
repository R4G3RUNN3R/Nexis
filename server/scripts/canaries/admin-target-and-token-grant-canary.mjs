// Admin Panel hotfix: target-resolution fix + one-shot token grant
// controls. 33 named regression cases per the ticket brief.
//
// Root cause closed: AdminInlineControls.tsx's inline quick-action
// buttons (Fill/Set/Reduce, rendered next to gameplay bars) submitted
// PlayerContext's player.internalId as the admin-action target -
// authService.js's mapPublicApiUser() (used by both register and login
// responses) deliberately replaces the real database internal_id with a
// synthetic "plr_<publicId>" placeholder for privacy, so every admin's
// own quick actions failed with "Target player not found." Fixed by
// making every admin player-targeting endpoint accept only the public
// ID, resolved server-side via server/lib/adminTargetResolution.js -
// never trusting a client-submitted internal-shaped ID.
//
// Boots its own in-process server via createApp() against disposable
// pglite - never touches production, never creates production accounts.
//
//   node server/scripts/canaries/admin-target-and-token-grant-canary.mjs
//
import assert from "node:assert/strict";
import crypto from "node:crypto";
import { createApp } from "../../app.js";
import { ensureDatabaseSchema } from "../../db/migrate.js";
import { withTransaction, closePool } from "../../db/pool.js";
import { registerUser } from "../../services/authService.js";
import { findUserByPublicId } from "../../repositories/usersRepository.js";
import { startOneShotForUser, advanceOneShotForUser } from "../../services/nexisOneShotService.js";
import { getOneShotCampaign } from "../../data/nexisOneShotData.js";

if (process.env.DATABASE_URL) {
  throw new Error("This canary must run with DATABASE_URL unset (disposable pglite only) - refusing to start.");
}

const PORT = 8917;
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

let userSeq = 0;
async function makeUser(label, { privilegeRole = "player" } = {}) {
  userSeq += 1;
  const email = `admincanary.${label}.${userSeq}.${Date.now()}@nexis.local`;
  const reg = await registerUser({ firstName: "Admin", lastName: label, email, password: "TestPass123!" });
  const user = await withTransaction((client) => findUserByPublicId(client, reg.user.publicId));
  if (privilegeRole !== "player") {
    await withTransaction((client) => client.query(`UPDATE users SET privilege_role = $1 WHERE internal_id = $2`, [privilegeRole, user.internalId]));
  }
  const login = await api("/api/login", { method: "POST", body: { email, password: "TestPass123!" } });
  return { user, token: login.payload.sessionToken };
}

async function grantOneShotTokens(user, { sealed = 0, patronBound = 0 } = {}) {
  await withTransaction(async (client) => {
    const { findPlayerStateByUserInternalId, upsertPlayerRuntimeState } = await import("../../repositories/playerStateRepository.js");
    const { buildMutableRuntimeState } = await import("../../lib/runtimePlayerState.js");
    const playerState = await findPlayerStateByUserInternalId(client, user.internalId);
    const runtimeState = buildMutableRuntimeState(user, playerState);
    const current = runtimeState.player.dmosOneShots ?? {};
    runtimeState.player.dmosOneShots = { ...current, tokens: { ...(current.tokens ?? {}), sealed, patronBound, lifetimeSpent: 0 } };
    await upsertPlayerRuntimeState(client, user.internalId, runtimeState);
  });
}

// buildMutableRuntimeState() reads player.stats from player_snapshot's
// nested runtimeState.player (see playerStateRepository.js's
// mapPlayerStateRow), NOT from player_state's top-level "stats" column -
// that column is legacy/creation-default only. Test fixtures must go
// through the same hydrate-mutate-upsert round trip real code uses,
// never a raw UPDATE of the top-level stats column (which
// buildMutableRuntimeState silently ignores).
async function setPlayerStat(user, statKey, value) {
  await withTransaction(async (client) => {
    const { findPlayerStateByUserInternalId, upsertPlayerRuntimeState } = await import("../../repositories/playerStateRepository.js");
    const { buildMutableRuntimeState } = await import("../../lib/runtimePlayerState.js");
    const playerState = await findPlayerStateByUserInternalId(client, user.internalId);
    const runtimeState = buildMutableRuntimeState(user, playerState);
    runtimeState.player.stats = { ...runtimeState.player.stats, [statKey]: value };
    await upsertPlayerRuntimeState(client, user.internalId, runtimeState);
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
    // Cleanup must run on every exit path - a mid-test throw must not leak
    // the HTTP listener or the underlying pglite/pool connection. Previously
    // this only ran after a fully successful pass, so any thrown error (or,
    // separately, a slow/lock-contended on-disk pglite directory reused
    // across many prior canary runs from this same repo checkout) left the
    // process with an open handle and nothing forcing it to exit.
    await new Promise((resolve) => server.close(resolve));
    await closePool();
  }

  console.log(`\n${checks - failures}/${checks} checks passed.`);
  if (failures > 0) console.log(`${failures} FAILED.`);
  // Exit explicitly with the real result rather than relying on the event
  // loop draining naturally - guarantees termination regardless of any
  // handle a dependency might still be holding, while still preserving 0 on
  // a full pass and 1 on any failure.
  process.exit(failures > 0 ? 1 : 0);
}

async function runAllChecks() {
  const { token: adminToken, user: adminUser } = await makeUser("admin", { privilegeRole: "admin" });
  const { token: staffToken } = await makeUser("staffonly", { privilegeRole: "staff" });
  const { token: playerToken } = await makeUser("plainplayer");
  const { user: targetUser } = await makeUser("target");
  const targetPublicId = String(targetUser.publicId);

  console.log("== 1. Staff searches by public player ID ==");
  {
    const search = await api(`/api/admin/players?q=${encodeURIComponent(targetPublicId)}`, { token: adminToken });
    check("search by exact public ID returns the target", search.status === 200 && search.payload.results.length === 1 && search.payload.results[0].publicId === targetUser.publicId);
  }

  console.log("== 2. Selecting a search result preserves its public ID ==");
  {
    const search = await api(`/api/admin/players?q=${encodeURIComponent(targetPublicId)}`, { token: adminToken });
    const result = search.payload.results[0];
    const details = await api(`/api/admin/players/${encodeURIComponent(String(result.publicId))}`, { token: adminToken });
    check("details loaded via the search result's publicId resolve to the same account", details.status === 200 && details.payload.target.user.publicId === targetUser.publicId);
  }

  console.log("== 3. Admin refills Energy ==");
  {
    await setPlayerStat(targetUser, "energy", 10);
    const result = await api(`/api/admin/players/${targetPublicId}/actions`, { method: "POST", token: adminToken, body: { actionType: "fillEnergy", reason: "canary" } });
    check("fillEnergy succeeds via public-ID resolution", result.status === 200);
    check("energy is now at max", result.payload.target.player.stats.energy === result.payload.target.player.stats.maxEnergy);
  }

  console.log("== 4. Admin sets Energy to a valid value ==");
  {
    const result = await api(`/api/admin/players/${targetPublicId}/actions`, { method: "POST", token: adminToken, body: { actionType: "setResourceStat", stat: "energy", value: 42, reason: "canary" } });
    check("setResourceStat succeeds", result.status === 200 && result.payload.target.player.stats.energy === 42);
  }

  console.log("== 5. Admin refills Health ==");
  {
    await setPlayerStat(targetUser, "health", 10);
    const result = await api(`/api/admin/players/${targetPublicId}/actions`, { method: "POST", token: adminToken, body: { actionType: "fillHealth", reason: "canary" } });
    check("fillHealth succeeds", result.status === 200 && result.payload.target.player.stats.health === result.payload.target.player.stats.maxHealth);
  }

  console.log("== 6. Admin refills Stamina ==");
  {
    await setPlayerStat(targetUser, "stamina", 1);
    const result = await api(`/api/admin/players/${targetPublicId}/actions`, { method: "POST", token: adminToken, body: { actionType: "fillStamina", reason: "canary" } });
    check("fillStamina succeeds", result.status === 200 && result.payload.target.player.stats.stamina === result.payload.target.player.stats.maxStamina);
  }

  console.log("== 7. Public ID resolves to the correct internal player ==");
  {
    const details = await api(`/api/admin/players/${targetPublicId}`, { token: adminToken });
    check("resolved internalId matches the real database row", details.payload.target.user.internalId === targetUser.internalId);
  }

  console.log("== 8. Unknown public ID returns not found ==");
  {
    const result = await api(`/api/admin/players/9999999`, { token: adminToken });
    check("unknown public ID is a controlled 404", result.status === 404 && result.payload.code === "TARGET_NOT_FOUND");
  }

  console.log("== 9. Empty target fails validation ==");
  {
    // Route requires a path segment, so an empty target manifests as
    // hitting the collection route instead - exercise the resolver
    // directly with an explicitly empty string via the details endpoint's
    // param-shaped equivalent (whitespace-only, which still reaches the resolver).
    const result = await api(`/api/admin/players/${encodeURIComponent("   ")}`, { token: adminToken });
    check("whitespace-only target fails validation, not a lookup", result.status === 400 && result.payload.code === "ADMIN_TARGET_REQUIRED");
  }

  console.log("== 10. Malformed target fails validation ==");
  {
    const result = await api(`/api/admin/players/${encodeURIComponent("usr_not-a-public-id")}`, { token: adminToken });
    check("internal-ID-shaped target is rejected as malformed, not silently misresolved", result.status === 400 && result.payload.code === "ADMIN_TARGET_INVALID");
  }

  console.log("== 11. Non-staff receives 401 or 403 ==");
  {
    const noAuth = await api(`/api/admin/players?q=${targetPublicId}`);
    check("no token -> 401", noAuth.status === 401);
    const plainPlayer = await api(`/api/admin/players?q=${targetPublicId}`, { token: playerToken });
    check("plain player token -> 403", plainPlayer.status === 403);
  }

  console.log("== 12. Unsupported state fields cannot be changed ==");
  {
    const before = await api(`/api/admin/players/${targetPublicId}`, { token: adminToken });
    const result = await api(`/api/admin/players/${targetPublicId}/actions`, { method: "POST", token: adminToken, body: { actionType: "setEntityTypeDirectly", reason: "canary", entityType: "system" } });
    check("unsupported actionType is rejected, not silently applied", result.status === 400 && result.payload.code === "UNSUPPORTED_ADMIN_ACTION");
    const after = await api(`/api/admin/players/${targetPublicId}`, { token: adminToken });
    check("target entityType unchanged", before.payload.target.user.entityType === after.payload.target.user.entityType);
  }

  console.log("== 13. Admin adds one tradeable one-shot token ==");
  {
    const result = await api(`/api/admin/players/${targetPublicId}/one-shot-tokens`, { method: "POST", token: adminToken, body: { tokenType: "tradeable", quantity: 1, reason: "canary", idempotencyKey: crypto.randomUUID() } });
    check("single tradeable grant succeeds", result.status === 200 && result.payload.grant.after - result.payload.grant.before === 1);
  }

  console.log("== 14. Admin adds multiple tradeable one-shot tokens ==");
  {
    const before = await api(`/api/admin/players/${targetPublicId}`, { token: adminToken });
    const result = await api(`/api/admin/players/${targetPublicId}/one-shot-tokens`, { method: "POST", token: adminToken, body: { tokenType: "tradeable", quantity: 7, reason: "canary", idempotencyKey: crypto.randomUUID() } });
    check("multi-quantity tradeable grant succeeds", result.status === 200);
    check("balance increased by exactly 7", result.payload.grant.after === before.payload.target.player.oneShotTokens.tradeable + 7);
  }

  console.log("== 15. Admin adds one donor one-shot token ==");
  {
    const result = await api(`/api/admin/players/${targetPublicId}/one-shot-tokens`, { method: "POST", token: adminToken, body: { tokenType: "donor", quantity: 1, reason: "canary", idempotencyKey: crypto.randomUUID() } });
    check("single donor grant succeeds", result.status === 200 && result.payload.grant.after - result.payload.grant.before === 1);
  }

  console.log("== 16. Admin adds multiple donor one-shot tokens ==");
  {
    const before = await api(`/api/admin/players/${targetPublicId}`, { token: adminToken });
    const result = await api(`/api/admin/players/${targetPublicId}/one-shot-tokens`, { method: "POST", token: adminToken, body: { tokenType: "donor", quantity: 4, reason: "canary", idempotencyKey: crypto.randomUUID() } });
    check("multi-quantity donor grant succeeds", result.status === 200);
    check("donor balance increased by exactly 4", result.payload.grant.after === before.payload.target.player.oneShotTokens.donor + 4);
  }

  console.log("== 17. Tradeable and donor balances remain separate ==");
  {
    const details = await api(`/api/admin/players/${targetPublicId}`, { token: adminToken });
    check("tradeable is 8 (1+7)", details.payload.target.player.oneShotTokens.tradeable === 8);
    check("donor is 5 (1+4)", details.payload.target.player.oneShotTokens.donor === 5);
  }

  console.log("== 18. Donor grant does not change donor tier ==");
  {
    const detailsBefore = await withTransaction(async (client) => {
      const { findPlayerStateByUserInternalId } = await import("../../repositories/playerStateRepository.js");
      const { buildMutableRuntimeState } = await import("../../lib/runtimePlayerState.js");
      const playerState = await findPlayerStateByUserInternalId(client, targetUser.internalId);
      return buildMutableRuntimeState(targetUser, playerState).legacy?.donorTier ?? null;
    });
    await api(`/api/admin/players/${targetPublicId}/one-shot-tokens`, { method: "POST", token: adminToken, body: { tokenType: "donor", quantity: 2, reason: "canary", idempotencyKey: crypto.randomUUID() } });
    const detailsAfter = await withTransaction(async (client) => {
      const { findPlayerStateByUserInternalId } = await import("../../repositories/playerStateRepository.js");
      const { buildMutableRuntimeState } = await import("../../lib/runtimePlayerState.js");
      const playerState = await findPlayerStateByUserInternalId(client, targetUser.internalId);
      return buildMutableRuntimeState(targetUser, playerState).legacy?.donorTier ?? null;
    });
    check("legacy.donorTier is unchanged by a donor token grant", detailsBefore === detailsAfter);
  }

  console.log("== 19. Donor grant does not reset monthly entitlement history ==");
  {
    const { consumeMonthlyEntitlement, getCurrentEntitlementPeriodKey } = await import("../../services/entitlementService.js");
    const periodKey = getCurrentEntitlementPeriodKey();
    await withTransaction((client) => consumeMonthlyEntitlement(client, targetUser, { entitlementKey: "canary-entitlement", sessionId: `canary-${Date.now()}`, periodKey }));
    await api(`/api/admin/players/${targetPublicId}/one-shot-tokens`, { method: "POST", token: adminToken, body: { tokenType: "donor", quantity: 1, reason: "canary", idempotencyKey: crypto.randomUUID() } });
    const stillConsumed = await withTransaction(async (client) => {
      const { hasConsumedMonthlyEntitlement } = await import("../../services/entitlementService.js");
      return hasConsumedMonthlyEntitlement(client, targetUser, { entitlementKey: "canary-entitlement", periodKey });
    });
    check("monthly entitlement consumption record survives an unrelated donor token grant", stillConsumed === true);
  }

  console.log("== 20. Tradeable token remains tradeable (no new restriction introduced) ==");
  {
    // "Tradeable" here means: the sealed counter stays a plain counter
    // consumeToken() can spend from - this grant path adds no flag, tag,
    // or lock that would prevent existing consumption logic from using it.
    const { findUserByPublicId: findUser } = await import("../../repositories/usersRepository.js");
    const tokenHolder = await makeUser("tradeconsume");
    await grantOneShotTokens(tokenHolder.user, { sealed: 1, patronBound: 0 });
    const started = await startOneShotForUser(tokenHolder.user, {});
    check("a sealed token granted through this feature can still start a one-shot the normal way", Boolean(started.session));
  }

  console.log("== 21. Donor token cannot be traded ==");
  {
    // No marketplace/trade code path references dmosOneShots tokens at
    // all today (confirmed via source search) - this asserts that
    // remains true, i.e. this ticket did not introduce one.
    const fs = await import("node:fs");
    const marketplaceSource = fs.readFileSync(new URL("../../services/marketplaceService.js", import.meta.url), "utf8");
    check("marketplaceService.js has no reference to dmosOneShots tokens (no trading path exists)", !marketplaceSource.includes("dmosOneShots") && !marketplaceSource.includes("patronBound"));
  }

  console.log("== 22-25. Invalid quantities rejected ==");
  {
    const zero = await api(`/api/admin/players/${targetPublicId}/one-shot-tokens`, { method: "POST", token: adminToken, body: { tokenType: "tradeable", quantity: 0, reason: "canary", idempotencyKey: crypto.randomUUID() } });
    check("zero quantity fails", zero.status === 400);
    const negative = await api(`/api/admin/players/${targetPublicId}/one-shot-tokens`, { method: "POST", token: adminToken, body: { tokenType: "tradeable", quantity: -3, reason: "canary", idempotencyKey: crypto.randomUUID() } });
    check("negative quantity fails", negative.status === 400);
    const fractional = await api(`/api/admin/players/${targetPublicId}/one-shot-tokens`, { method: "POST", token: adminToken, body: { tokenType: "tradeable", quantity: 2.5, reason: "canary", idempotencyKey: crypto.randomUUID() } });
    check("fractional quantity fails", fractional.status === 400);
    const excessive = await api(`/api/admin/players/${targetPublicId}/one-shot-tokens`, { method: "POST", token: adminToken, body: { tokenType: "tradeable", quantity: 500, reason: "canary", idempotencyKey: crypto.randomUUID() } });
    check("excessive quantity fails", excessive.status === 400);
  }

  console.log("== 26. Duplicate retry does not grant twice ==");
  {
    // Follow-up correction items 1-2: identical retry returns the
    // original result and applies no additional grant.
    const key = crypto.randomUUID();
    const first = await api(`/api/admin/players/${targetPublicId}/one-shot-tokens`, { method: "POST", token: adminToken, body: { tokenType: "tradeable", quantity: 3, reason: "canary", idempotencyKey: key } });
    const retry = await api(`/api/admin/players/${targetPublicId}/one-shot-tokens`, { method: "POST", token: adminToken, body: { tokenType: "tradeable", quantity: 3, reason: "canary", idempotencyKey: key } });
    check("[1] first grant succeeds", first.status === 200 && first.payload.grant.replay === false);
    check("[1] identical retry returns the same operationId, replay=true", retry.status === 200 && retry.payload.grant.operationId === first.payload.grant.operationId && retry.payload.grant.replay === true);
    check("[2] retry did not increase the balance further", retry.payload.grant.after === first.payload.grant.after);
  }

  console.log("== 27. Idempotency conflict correction (follow-up ticket, 11 required cases) ==");
  {
    // Reusable fixture: one admin, one target, one baseline grant to
    // conflict against. Every sub-case below reuses conflictKey with
    // exactly one field changed from this baseline, per the ticket's
    // explicit "do not compare only the target or quantity" instruction.
    const { user: conflictTarget } = await makeUser("conflicttarget");
    const conflictTargetPublicId = String(conflictTarget.publicId);
    const { token: secondAdminToken, user: secondAdminUser } = await makeUser("secondadmin", { privilegeRole: "admin" });
    const conflictKey = crypto.randomUUID();
    const baseline = { tokenType: "tradeable", quantity: 2, reason: "baseline reason" };

    const baselineResult = await api(`/api/admin/players/${conflictTargetPublicId}/one-shot-tokens`, {
      method: "POST", token: adminToken, body: { ...baseline, idempotencyKey: conflictKey },
    });
    check("baseline grant succeeds", baselineResult.status === 200 && baselineResult.payload.grant.replay === false);
    const baselineOperationId = baselineResult.payload.grant.operationId;
    const balanceAfterBaseline = baselineResult.payload.grant.after;

    console.log("  -- [3] same key, different quantity --");
    {
      const conflicting = await api(`/api/admin/players/${conflictTargetPublicId}/one-shot-tokens`, {
        method: "POST", token: adminToken, body: { ...baseline, quantity: 5, idempotencyKey: conflictKey },
      });
      check("[3] different quantity with the same key returns 409 IDEMPOTENCY_KEY_CONFLICT", conflicting.status === 409 && conflicting.payload.code === "IDEMPOTENCY_KEY_CONFLICT");
    }

    console.log("  -- [4] same key, different token type --");
    {
      const conflicting = await api(`/api/admin/players/${conflictTargetPublicId}/one-shot-tokens`, {
        method: "POST", token: adminToken, body: { ...baseline, tokenType: "donor", idempotencyKey: conflictKey },
      });
      check("[4] different token type with the same key returns 409 IDEMPOTENCY_KEY_CONFLICT", conflicting.status === 409 && conflicting.payload.code === "IDEMPOTENCY_KEY_CONFLICT");
    }

    console.log("  -- [5] same key, different target --");
    {
      const { user: otherTarget } = await makeUser("otherconflicttarget");
      const conflicting = await api(`/api/admin/players/${String(otherTarget.publicId)}/one-shot-tokens`, {
        method: "POST", token: adminToken, body: { ...baseline, idempotencyKey: conflictKey },
      });
      check("[5] different target with the same key returns 409 IDEMPOTENCY_KEY_CONFLICT", conflicting.status === 409 && conflicting.payload.code === "IDEMPOTENCY_KEY_CONFLICT");
    }

    console.log("  -- [6] same key, different actor --");
    {
      const conflicting = await api(`/api/admin/players/${conflictTargetPublicId}/one-shot-tokens`, {
        method: "POST", token: secondAdminToken, body: { ...baseline, idempotencyKey: conflictKey },
      });
      check("[6] different staff actor with the same key returns 409 IDEMPOTENCY_KEY_CONFLICT", conflicting.status === 409 && conflicting.payload.code === "IDEMPOTENCY_KEY_CONFLICT");
    }

    console.log("  -- [7] same key, different normalized reason --");
    {
      const conflicting = await api(`/api/admin/players/${conflictTargetPublicId}/one-shot-tokens`, {
        method: "POST", token: adminToken, body: { ...baseline, reason: "a completely different reason", idempotencyKey: conflictKey },
      });
      check("[7] different reason with the same key returns 409 IDEMPOTENCY_KEY_CONFLICT", conflicting.status === 409 && conflicting.payload.code === "IDEMPOTENCY_KEY_CONFLICT");
      // Whitespace-only differences ARE the same normalized reason -
      // requireReason() trims before storing/comparing - so this must
      // replay, not conflict.
      const whitespaceVariant = await api(`/api/admin/players/${conflictTargetPublicId}/one-shot-tokens`, {
        method: "POST", token: adminToken, body: { ...baseline, reason: `  ${baseline.reason}  `, idempotencyKey: conflictKey },
      });
      check("[7] a reason differing only by surrounding whitespace still replays (normalized comparison)", whitespaceVariant.status === 200 && whitespaceVariant.payload.grant.replay === true);
    }

    console.log("  -- identical retry after all the conflicts above still replays cleanly --");
    {
      const stillReplays = await api(`/api/admin/players/${conflictTargetPublicId}/one-shot-tokens`, {
        method: "POST", token: adminToken, body: { ...baseline, idempotencyKey: conflictKey },
      });
      check("baseline key still replays the original operation after every conflicting attempt", stillReplays.status === 200 && stillReplays.payload.grant.operationId === baselineOperationId && stillReplays.payload.grant.replay === true);
    }

    console.log("  -- [11] conflicts left the balance unchanged beyond the original grant --");
    {
      const details = await api(`/api/admin/players/${conflictTargetPublicId}`, { token: adminToken });
      check("[11] tradeable balance reflects ONLY the baseline grant, none of the 4 rejected conflicts", details.payload.target.player.oneShotTokens.tradeable === balanceAfterBaseline);
      check("[11] donor balance is untouched (the token-type conflict never applied)", details.payload.target.player.oneShotTokens.donor === 0);
    }

    console.log("  -- [10] conflicts created no additional admin audit entries --");
    {
      const grantRows = await withTransaction(async (client) => {
        const result = await client.query(`SELECT count(*) AS count FROM admin_one_shot_token_grants WHERE target_internal_id = $1`, [conflictTarget.internalId]);
        return Number(result.rows[0].count);
      });
      check("[10] exactly one admin_one_shot_token_grants row exists for this target (no row created by any conflict)", grantRows === 1);
      const auditLog = await api(`/api/admin/audit-logs?targetInternalId=${encodeURIComponent(conflictTarget.internalId)}&limit=20`, { token: adminToken });
      const grantEntries = auditLog.payload.entries.filter((entry) => entry.actionType === "grantOneShotToken");
      check("[10] exactly one admin_action_logs grantOneShotToken entry exists (conflicts never reach the audit-insert step)", grantEntries.length === 1);
    }

    console.log("  -- [8] concurrent IDENTICAL requests create exactly one grant --");
    {
      const raceKey = crypto.randomUUID();
      const identicalPayload = { tokenType: "tradeable", quantity: 4, reason: "race identical", idempotencyKey: raceKey };
      const results = await Promise.all([
        api(`/api/admin/players/${conflictTargetPublicId}/one-shot-tokens`, { method: "POST", token: adminToken, body: identicalPayload }),
        api(`/api/admin/players/${conflictTargetPublicId}/one-shot-tokens`, { method: "POST", token: adminToken, body: identicalPayload }),
      ]);
      check("[8] both concurrent identical requests succeed (one create, one replay)", results.every((r) => r.status === 200));
      const operationIds = new Set(results.map((r) => r.payload.grant.operationId));
      check("[8] both requests report the SAME operationId - only one grant was created", operationIds.size === 1);
      check("[8] exactly one of the two reports replay:false (the winner)", results.filter((r) => r.payload.grant.replay === false).length === 1);
      const rowCount = await withTransaction(async (client) => {
        const result = await client.query(`SELECT count(*) AS count FROM admin_one_shot_token_grants WHERE idempotency_key = $1`, [raceKey]);
        return Number(result.rows[0].count);
      });
      check("[8] exactly one admin_one_shot_token_grants row exists for the race key", rowCount === 1);
    }

    console.log("  -- [9] concurrent CONFLICTING requests create one grant and one 409 conflict --");
    {
      const raceKey2 = crypto.randomUUID();
      const balanceBeforeRace = (await api(`/api/admin/players/${conflictTargetPublicId}`, { token: adminToken })).payload.target.player.oneShotTokens.tradeable;
      const results = await Promise.all([
        api(`/api/admin/players/${conflictTargetPublicId}/one-shot-tokens`, { method: "POST", token: adminToken, body: { tokenType: "tradeable", quantity: 6, reason: "race a", idempotencyKey: raceKey2 } }),
        api(`/api/admin/players/${conflictTargetPublicId}/one-shot-tokens`, { method: "POST", token: adminToken, body: { tokenType: "tradeable", quantity: 9, reason: "race b (conflicting quantity)", idempotencyKey: raceKey2 } }),
      ]);
      const succeeded = results.filter((r) => r.status === 200);
      const conflicted = results.filter((r) => r.status === 409);
      check("[9] exactly one of the two concurrent conflicting requests succeeds", succeeded.length === 1);
      check("[9] exactly one of the two concurrent conflicting requests gets 409 IDEMPOTENCY_KEY_CONFLICT", conflicted.length === 1 && conflicted[0].payload.code === "IDEMPOTENCY_KEY_CONFLICT");
      const rowCount = await withTransaction(async (client) => {
        const result = await client.query(`SELECT count(*) AS count FROM admin_one_shot_token_grants WHERE idempotency_key = $1`, [raceKey2]);
        return Number(result.rows[0].count);
      });
      check("[9] exactly one admin_one_shot_token_grants row exists for the race key (no partial/duplicate row)", rowCount === 1);
      const balanceAfterRace = (await api(`/api/admin/players/${conflictTargetPublicId}`, { token: adminToken })).payload.target.player.oneShotTokens.tradeable;
      check("[9] final balance reflects exactly ONE of the two quantities (6 or 9), never both, never neither", balanceAfterRace === balanceBeforeRace + 6 || balanceAfterRace === balanceBeforeRace + 9);
    }
  }

  console.log("== 28. Concurrent grants produce the correct final balance ==");
  {
    const { user: raceTargetUser } = await makeUser("racetarget");
    const raceTargetPublicId = String(raceTargetUser.publicId);
    const results = await Promise.all([
      api(`/api/admin/players/${raceTargetPublicId}/one-shot-tokens`, { method: "POST", token: adminToken, body: { tokenType: "tradeable", quantity: 5, reason: "race-a", idempotencyKey: crypto.randomUUID() } }),
      api(`/api/admin/players/${raceTargetPublicId}/one-shot-tokens`, { method: "POST", token: adminToken, body: { tokenType: "tradeable", quantity: 3, reason: "race-b", idempotencyKey: crypto.randomUUID() } }),
    ]);
    check("both concurrent grants (different idempotency keys) succeed", results.every((r) => r.status === 200));
    const details = await api(`/api/admin/players/${raceTargetPublicId}`, { token: adminToken });
    check("final balance reflects BOTH grants (5+3=8), no lost update", details.payload.target.player.oneShotTokens.tradeable === 8);
  }

  console.log("== 29. Concurrent resource and token updates preserve unrelated state ==");
  {
    const { user: raceTarget2 } = await makeUser("racetarget2");
    const raceTarget2PublicId = String(raceTarget2.publicId);
    await setPlayerStat(raceTarget2, "energy", 5);
    const results = await Promise.all([
      api(`/api/admin/players/${raceTarget2PublicId}/actions`, { method: "POST", token: adminToken, body: { actionType: "fillEnergy", reason: "canary" } }),
      api(`/api/admin/players/${raceTarget2PublicId}/one-shot-tokens`, { method: "POST", token: adminToken, body: { tokenType: "donor", quantity: 6, reason: "canary", idempotencyKey: crypto.randomUUID() } }),
    ]);
    check("both concurrent operations succeed", results.every((r) => r.status === 200));
    const details = await api(`/api/admin/players/${raceTarget2PublicId}`, { token: adminToken });
    check("energy fill landed", details.payload.target.player.stats.energy === details.payload.target.player.stats.maxEnergy);
    check("token grant landed, unrelated to the energy fill", details.payload.target.player.oneShotTokens.donor === 6);
  }

  console.log("== 30. Audit record contains actor, target, type, quantity, reason, and operation ID ==");
  {
    const key = crypto.randomUUID();
    const grant = await api(`/api/admin/players/${targetPublicId}/one-shot-tokens`, { method: "POST", token: adminToken, body: { tokenType: "donor", quantity: 1, reason: "audit-check-reason", idempotencyKey: key } });
    const auditRow = await withTransaction(async (client) => {
      const result = await client.query(`SELECT * FROM admin_one_shot_token_grants WHERE idempotency_key = $1`, [key]);
      return result.rows[0];
    });
    check("admin_one_shot_token_grants row exists", Boolean(auditRow));
    check("row records actor", auditRow?.actor_internal_id === adminUser.internalId);
    check("row records target", auditRow?.target_internal_id === targetUser.internalId);
    check("row records token type", auditRow?.token_type === "donor");
    check("row records quantity", Number(auditRow?.quantity) === 1);
    check("row records reason", auditRow?.reason === "audit-check-reason");
    check("row records operation_id matching the API response", auditRow?.operation_id === grant.payload.grant.operationId);

    const auditLogEntries = await api(`/api/admin/audit-logs?targetInternalId=${encodeURIComponent(targetUser.internalId)}&limit=5`, { token: adminToken });
    const grantEntry = auditLogEntries.payload.entries.find((entry) => entry.actionType === "grantOneShotToken");
    check("existing admin_action_logs audit trail also has a grantOneShotToken entry", Boolean(grantEntry));
  }

  console.log("== 31. Normal player routes cannot grant either token type ==");
  {
    const selfGrantAttempt = await api(`/api/admin/players/${targetPublicId}/one-shot-tokens`, { method: "POST", token: playerToken, body: { tokenType: "tradeable", quantity: 1, reason: "canary", idempotencyKey: crypto.randomUUID() } });
    check("plain player cannot hit the token grant endpoint", selfGrantAttempt.status === 403);
    const staffOnlyAttempt = await api(`/api/admin/players/${targetPublicId}/one-shot-tokens`, { method: "POST", token: staffToken, body: { tokenType: "tradeable", quantity: 1, reason: "canary", idempotencyKey: crypto.randomUUID() } });
    check("staff-only (non-admin) cannot grant tokens either", staffOnlyAttempt.status === 403 && staffOnlyAttempt.payload.code === "ADMIN_REQUIRED");
    const fs = await import("node:fs");
    const oneShotRoutesSource = fs.readFileSync(new URL("../../routes/nexisOneShotRoutes.js", import.meta.url), "utf8");
    check("the player-facing one-shot routes file has no token-grant endpoint", !oneShotRoutesSource.includes("one-shot-tokens") && !oneShotRoutesSource.includes("grantOneShotToken"));
  }

  console.log("== 32. Existing one-shot access remains unchanged ==");
  {
    const { user: oneShotUser } = await makeUser("oneshotflow");
    await grantOneShotTokens(oneShotUser, { sealed: 3, patronBound: 0 });
    const startResult = await startOneShotForUser(oneShotUser, {});
    check("starting a personal one-shot still works after the admin hotfix", Boolean(startResult.session));
    const campaign = getOneShotCampaign(startResult.session.campaignId);
    const openingChoiceId = campaign.scenes[campaign.startSceneId].choices[0].id;
    const advanced = await advanceOneShotForUser(oneShotUser, startResult.session.id, { choiceId: openingChoiceId });
    check("advancing a personal one-shot still works", Boolean(advanced.session));
  }

  console.log("== 33. Existing Chronicle data remains unchanged ==");
  {
    const { user: chronicleUser } = await makeUser("chronicledata");
    const fixedTimestamp = 1700000000000;
    const fakeHistory = [{ id: "canary_fixture_1", campaignId: "fixture-campaign", title: "Fixture Entry", completedAt: fixedTimestamp }];
    await withTransaction(async (client) => {
      const { findPlayerStateByUserInternalId, upsertPlayerRuntimeState } = await import("../../repositories/playerStateRepository.js");
      const { buildMutableRuntimeState } = await import("../../lib/runtimePlayerState.js");
      const playerState = await findPlayerStateByUserInternalId(client, chronicleUser.internalId);
      const runtimeState = buildMutableRuntimeState(chronicleUser, playerState);
      runtimeState.player.dmosOneShots = { ...(runtimeState.player.dmosOneShots ?? {}), history: fakeHistory };
      await upsertPlayerRuntimeState(client, chronicleUser.internalId, runtimeState);
    });
    // Perform a REAL unrelated admin mutation (drain energy first so the
    // fill actually changes something) and confirm the Chronicle history
    // array is untouched. Compared field-by-field, not via raw
    // JSON.stringify equality - JSONB round-tripping does not preserve
    // object key insertion order, so a naive string comparison here would
    // false-positive-fail on semantically identical data.
    await setPlayerStat(chronicleUser, "energy", 10);
    const actionResult = await api(`/api/admin/players/${String(chronicleUser.publicId)}/actions`, { method: "POST", token: adminToken, body: { actionType: "fillEnergy", reason: "canary" } });
    check("the unrelated admin action actually mutated something (energy filled)", actionResult.status === 200 && actionResult.payload.target.player.stats.energy === actionResult.payload.target.player.stats.maxEnergy);
    const afterHistory = await withTransaction(async (client) => {
      const { findPlayerStateByUserInternalId } = await import("../../repositories/playerStateRepository.js");
      const { buildMutableRuntimeState } = await import("../../lib/runtimePlayerState.js");
      const playerState = await findPlayerStateByUserInternalId(client, chronicleUser.internalId);
      return buildMutableRuntimeState(chronicleUser, playerState).player.dmosOneShots?.history ?? [];
    });
    const entriesMatch = afterHistory.length === fakeHistory.length
      && fakeHistory.every((expected, index) => {
        const actual = afterHistory[index] ?? {};
        return actual.id === expected.id && actual.campaignId === expected.campaignId && actual.title === expected.title && actual.completedAt === expected.completedAt;
      });
    check("Chronicle/one-shot history array survives an unrelated admin action untouched", entriesMatch);
  }

  console.log("== 34. \"Select Self\" target-identity fix (follow-up ticket, 8 required cases) ==");
  {
    const fs = await import("node:fs");
    const adminPageSource = fs.readFileSync(new URL("../../../src/pages/Admin.tsx", import.meta.url), "utf8");
    const adminInlineSource = fs.readFileSync(new URL("../../../src/components/admin/AdminInlineControls.tsx", import.meta.url), "utf8");

    console.log("  -- [1] Select Self submits the canonical public player ID --");
    const selectSelfMatch = adminPageSource.match(/onClick=\{\(\) => activeAccount && loadTarget\((.*?)\)\}>Select Self</);
    check("[1] Select Self's onClick handler is present", Boolean(selectSelfMatch));
    const selectSelfArgument = selectSelfMatch ? selectSelfMatch[1] : "";
    check("[1] Select Self submits String(activeAccount.publicId) - the same canonical public-ID target every other admin call uses", selectSelfArgument === "String(activeAccount.publicId)");

    console.log("  -- [2] Select Self never submits activeAccount.internalPlayerId --");
    check("[2] the synthetic-placeholder-producing internalPlayerId no longer appears in Select Self's handler", !selectSelfArgument.includes("internalPlayerId"));

    console.log("  -- [3] Search selection and Select Self use the identical target format --");
    check(
      "[3] the search-result button (loadTarget(String(result.publicId))) and Select Self (loadTarget(String(activeAccount.publicId))) both submit String(<...>.publicId)",
      adminPageSource.includes("loadTarget(String(result.publicId))") && selectSelfArgument === "String(activeAccount.publicId)",
    );

    console.log("  -- [6] no admin-target call site in the Admin Panel UI submits an internal identifier --");
    const targetCallSites = [
      ...[...adminPageSource.matchAll(/loadTarget\(([^)]*)\)/g)].map((m) => m[1]),
      ...[...adminPageSource.matchAll(/postAdminPlayerAction\(serverSessionToken,\s*([^,]*),/g)].map((m) => m[1]),
      ...[...adminPageSource.matchAll(/postAdminOneShotTokenGrant\(serverSessionToken,\s*([^,]*),/g)].map((m) => m[1]),
    ];
    check("[6] found admin-target call sites to audit in Admin.tsx", targetCallSites.length >= 3);
    check(
      "[6] none of Admin.tsx's admin-target call sites submit .internalId or internalPlayerId - public ID only",
      targetCallSites.length > 0 && !targetCallSites.some((arg) => arg.includes(".internalId") || arg.includes("internalPlayerId")),
    );
    const inlineCallSites = [...adminInlineSource.matchAll(/postAdminPlayerAction\(serverSessionToken,\s*([^,]*),/g)].map((m) => m[1]);
    check("[6] found the AdminInlineControls.tsx admin-target call site", inlineCallSites.length > 0);
    check(
      "[6] AdminInlineControls.tsx's admin-target call site also submits no internal identifier",
      inlineCallSites.length > 0 && !inlineCallSites.some((arg) => arg.includes(".internalId") || arg.includes("internalPlayerId")),
    );
    // selected.user.internalId IS legitimately read elsewhere in Admin.tsx (the
    // Admin Logs tab's targetInternalId query param) - that value was already
    // authoritatively resolved server-side and returned to this same
    // authorized session, so it is a read-only audit-log filter, not a
    // client-synthesized target-resolution submission. Confirm it's the only
    // other .internalId usage left in the file, so this exception stays scoped.
    const allInternalIdUsages = [...adminPageSource.matchAll(/selected\?\.user\.internalId|selected\.user\.internalId/g)];
    check(
      "[6] the only other selected.user.internalId usage in Admin.tsx is the read-only audit-log scope filter, not a mutation target",
      allInternalIdUsages.length === 2 && adminPageSource.includes("targetInternalId: scope === \"target\" ? selected?.user.internalId ?? null : null"),
    );

    console.log("  -- [4] resource actions work after Select Self (self-targeting via public ID) --");
    {
      await setPlayerStat(adminUser, "energy", 3);
      const selfDetails = await api(`/api/admin/players/${String(adminUser.publicId)}`, { token: adminToken });
      check("[4] self-target resolves via public ID exactly as Select Self now submits it", selfDetails.status === 200 && selfDetails.payload.target.user.internalId === adminUser.internalId);
      const selfFill = await api(`/api/admin/players/${String(adminUser.publicId)}/actions`, { method: "POST", token: adminToken, body: { actionType: "fillEnergy", reason: "select-self canary" } });
      check("[4] fillEnergy succeeds when an admin targets their own public ID (the Select Self flow)", selfFill.status === 200 && selfFill.payload.target.player.stats.energy === selfFill.payload.target.player.stats.maxEnergy);
    }

    console.log("  -- [5] token controls work after Select Self (self-targeting via public ID) --");
    {
      const before = await api(`/api/admin/players/${String(adminUser.publicId)}`, { token: adminToken });
      const selfGrant = await api(`/api/admin/players/${String(adminUser.publicId)}/one-shot-tokens`, { method: "POST", token: adminToken, body: { tokenType: "tradeable", quantity: 1, reason: "select-self canary", idempotencyKey: crypto.randomUUID() } });
      check("[5] token grant succeeds when an admin targets their own public ID (the Select Self flow)", selfGrant.status === 200 && selfGrant.payload.grant.after === before.payload.target.player.oneShotTokens.tradeable + 1);
    }

    console.log("  -- [7] the exact synthetic plr_<publicId> placeholder shape (the original bug's fingerprint) is still rejected --");
    {
      const synthetic = `plr_${String(adminUser.publicId).padStart(6, "0")}`;
      const result = await api(`/api/admin/players/${encodeURIComponent(synthetic)}`, { token: adminToken });
      check("[7] plr_<publicId> is still rejected as malformed by the backend resolver, independent of any frontend fix", result.status === 400 && result.payload.code === "ADMIN_TARGET_INVALID");
    }

    console.log("  -- [8] non-admin users remain rejected on the self-target-shaped request too --");
    {
      const plainSelfDetails = await api(`/api/admin/players/${targetPublicId}`, { token: playerToken });
      check("[8] a plain player token is rejected (403) resolving any target, including a self-shaped public-ID request", plainSelfDetails.status === 403);
    }
  }

}

runTests().catch(async (error) => {
  console.error("CANARY FAILED:", error);
  // runTests()'s own try/finally already closed the server and pool before
  // this handler runs (the throw only reaches here after that finally
  // completes) - closePool() a second time is a documented no-op guard for
  // safety, not a required second cleanup.
  await closePool().catch(() => {});
  process.exit(1);
});
