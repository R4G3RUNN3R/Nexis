// Ticket 6: academy prerequisite recognition and Nexis City education
// consistency.
//
// Regression-guards the real bug: Ironhall's academy section kept showing
// "Requires Practical Arithmetic" forever, even for an account that had
// genuinely completed the course, because src/data/cityHubData.ts carried
// static, hand-authored per-city "academy" content that was never
// recomputed from live player state and was rendered unconditionally
// alongside the correct, server-computed per-academy panels. The stored
// course-identity data itself was never the problem (verified directly
// against production's real Hennet/P1000000 account during Phase 1 - her
// completedCourses/completed/completedAtByCourse all agreed on the exact
// canonical id "practical-arithmetic") - this suite instead exercises the
// canonical evaluator (getCompletedCourseIds/hasCompletedCourse/
// getMissingCourses in educationService.js, now the single shared
// implementation cityService.js/cityEconomyService.js/marketplaceService.js/
// organizationService.js all delegate to) and the live HTTP surface a
// player's browser actually sees.
//
// Hybrid by necessity: real courses take real-world days to complete, so
// "Hennet-equivalent" fixtures are seeded by writing the exact same
// completedCourses/completed/completedAtByCourse shape completeCourse()
// itself writes (verified against production's real shape in Phase 1),
// not by waiting out a real course. Everything that can be verified over
// real HTTP (forgery resistance, response shape, route mounting) is.
//
// This script boots its own in-process Express server (via createApp()) on
// an isolated pglite instance rather than pointing at an already-running
// separate server process: PGlite is single-process/file-backed and does
// not support two separate node processes safely sharing the same on-disk
// database, even when pointed at the same directory - a second process's
// reads/writes silently miss the first process's data instead of erroring
// clearly. Booting in-process guarantees the HTTP calls below and the
// direct service/repository calls share the exact same connection.
//
// Does not touch Hennet/P1000000 or any other real account - every account
// here is freshly registered on a disposable in-process instance, and
// DATABASE_URL must be unset when this script is run (pglite auto-select).
//
//   node server/scripts/canaries/academy-prerequisite-recognition-canary.mjs
//
import assert from "node:assert/strict";
import { createApp } from "../../app.js";
import { ensureDatabaseSchema } from "../../db/migrate.js";
import { withTransaction } from "../../db/pool.js";
import { findPlayerStateByUserInternalId, upsertPlayerRuntimeState } from "../../repositories/playerStateRepository.js";
import { findUserByPublicId } from "../../repositories/usersRepository.js";
import { buildMutableRuntimeState } from "../../lib/runtimePlayerState.js";
import { getCityAcademyForUser } from "../../services/cityService.js";
import { getMissingCourses } from "../../services/educationService.js";

if (process.env.DATABASE_URL) {
  throw new Error("This canary must run with DATABASE_URL unset (disposable pglite only) - refusing to start.");
}

const PORT = 8799;
const BASE = `http://127.0.0.1:${PORT}`;

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

async function registerAndLogin(label) {
  const email = `academy.${label}.${Date.now()}.${Math.random().toString(36).slice(2)}@nexis.local`;
  const reg = await api("/register", {
    method: "POST",
    body: { firstName: "Academy", lastName: label, email, password: "TestPass123!" },
  });
  assert.ok(reg.status === 200 || reg.status === 201, `registration for ${label}: ${reg.status} ${JSON.stringify(reg.payload)}`);
  return { token: reg.payload.sessionToken, publicId: reg.payload.user.publicId, email };
}

async function loadInternalUser(publicId) {
  return withTransaction((client) => findUserByPublicId(client, publicId));
}

// Writes completions in exactly the shape completeCourse() (educationService.js)
// itself writes - completedCourses array + completed map + completedAtByCourse
// map, all three in sync - the same shape independently confirmed against
// Hennet's real production education_state during Phase 1. Optionally also
// places the account physically in a city, since getAcademyStageStatus
// prioritizes the "travel here first" lock reason over a course-requirement
// lock reason - a real player has to be standing in Ironhall to even see
// the practical-arithmetic-specific lock message, so tests that check lock
// TEXT (not just missingCourses) need to be in-city first.
async function seedCompletedCourses(publicId, courseIds, cityId = null) {
  const internalUser = await loadInternalUser(publicId);
  await withTransaction(async (client) => {
    const playerState = await findPlayerStateByUserInternalId(client, internalUser.internalId);
    const runtimeState = buildMutableRuntimeState(internalUser, playerState);
    const now = Date.now();
    const completed = { ...runtimeState.education.completed };
    const completedAtByCourse = { ...runtimeState.education.completedAtByCourse };
    for (const id of courseIds) {
      completed[id] = { completed: true, completedAt: now };
      completedAtByCourse[id] = now;
    }
    runtimeState.education = {
      ...runtimeState.education,
      completedCourses: Array.from(new Set([...runtimeState.education.completedCourses, ...courseIds])),
      completed,
      completedAtByCourse,
    };
    if (cityId) {
      runtimeState.travel = { ...runtimeState.travel, currentCityId: cityId, status: "idle" };
    }
    await upsertPlayerRuntimeState(client, internalUser.internalId, runtimeState);
  });
  return internalUser;
}

async function main() {
  await ensureDatabaseSchema();
  const app = createApp();
  const server = await new Promise((resolve) => {
    const instance = app.listen(PORT, "127.0.0.1", () => resolve(instance));
  });

  try {
    await runChecks();
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
  // The pglite/WASM runtime leaves something in flight after server.close()
  // that otherwise produces a non-zero exit code despite every check having
  // already passed - force a clean, deterministic exit once we get here.
  process.exit(0);
}

async function runChecks() {
  console.log("== 1. Fresh account: Ironhall academies correctly locked (no manual grant) ==");
  const fresh = await registerAndLogin("fresh");
  const freshInternal = await seedCompletedCourses(fresh.publicId, [], "east");
  const freshResult = await getCityAcademyForUser(freshInternal, "east");
  const freshFoundry = freshResult.academies.find((a) => a.id === "ironhall-foundry-collegium");
  const freshEnginewright = freshResult.academies.find((a) => a.id === "ironhall-enginewright-hall");
  const freshRedAnvil = freshResult.academies.find((a) => a.id === "ironhall-red-anvil-war-school");
  check("fresh account: Foundry Collegium found", Boolean(freshFoundry));
  check("fresh account: Foundry Collegium reports practical-arithmetic missing", freshFoundry.missingCourses.includes("practical-arithmetic"));
  check("fresh account: Enginewright Hall reports practical-arithmetic missing", freshEnginewright.missingCourses.includes("practical-arithmetic"));
  check("fresh account (in Ironhall): Foundry Collegium lockReason names the real requirement", /practical arithmetic/i.test(freshFoundry.lockReason ?? ""));
  check("fresh account: Red Anvil War School has zero education-course requirements (standing-only)", freshRedAnvil.requiredCourses.length === 0);
  check("fresh account: Red Anvil War School is not blocked by any missing course", freshRedAnvil.missingCourses.length === 0);

  console.log("== 2. Hennet-equivalent fixture: grant practical-arithmetic via the real completion shape ==");
  const grad = await registerAndLogin("grad");
  const gradInternal = await seedCompletedCourses(grad.publicId, ["practical-arithmetic"], "east");
  const gradResult = await getCityAcademyForUser(gradInternal, "east");
  const gradFoundry = gradResult.academies.find((a) => a.id === "ironhall-foundry-collegium");
  const gradEnginewright = gradResult.academies.find((a) => a.id === "ironhall-enginewright-hall");
  check("graduate: Foundry Collegium missingCourses is empty", gradFoundry.missingCourses.length === 0);
  check("graduate: Enginewright Hall missingCourses is empty", gradEnginewright.missingCourses.length === 0);
  check(
    "graduate: Foundry Collegium stage 2 (material-ledgers) course requirement met, standing requirement still real",
    gradFoundry.stages[1].missingCourses.length === 0 && gradFoundry.stages[1].standingMissing > 0,
  );

  console.log("== 3. Academy-chain / stage-sequencing requirement (can't skip ahead) ==");
  check(
    "graduate: stage 2 (material-ledgers) is not startable before stage 1 (primer) is complete",
    gradFoundry.stages[1].status === "locked" && !gradFoundry.stages[1].canStart,
  );
  check(
    "graduate: stage 1 (primer) is the current/available stage",
    gradFoundry.currentStageId === "primer",
  );

  console.log("== 4. Other cities' academy definitions still work (not an Ironhall-only fix) ==");
  const highcourtFresh = await getCityAcademyForUser(freshInternal, "south");
  const orator = highcourtFresh.academies.find((a) => a.id === "highcourt-orators-academy");
  check("fresh account: Highcourt Orator's Academy correctly gates on civic-fundamentals", orator.missingCourses.includes("civic-fundamentals"));
  await seedCompletedCourses(grad.publicId, ["civic-fundamentals"]);
  const highcourtGrad = await getCityAcademyForUser(gradInternal, "south");
  const oratorGrad = highcourtGrad.academies.find((a) => a.id === "highcourt-orators-academy");
  check("graduate: Highcourt Orator's Academy recognizes civic-fundamentals once completed", oratorGrad.missingCourses.length === 0);

  console.log("== 5. Legacy-id normalization (street-survival alias, already-established pattern) ==");
  await seedCompletedCourses(grad.publicId, ["street-survival"]);
  const silverboughGrad = await getCityAcademyForUser(gradInternal, "north");
  const quietLeaves = silverboughGrad.academies.find((a) => a.name === "House of Quiet Leaves");
  check("Silverbough's House of Quiet Leaves found", Boolean(quietLeaves));
  check("graduate: House of Quiet Leaves recognizes the legacy street-survival alias id", quietLeaves.missingCourses.length === 0);

  console.log("== 6. Unknown prerequisite id fails closed ==");
  const bogusRuntimeState = buildMutableRuntimeState(gradInternal, await withTransaction((client) => findPlayerStateByUserInternalId(client, gradInternal.internalId)));
  const bogusMissing = getMissingCourses(bogusRuntimeState, ["this-course-id-does-not-exist"]);
  check("a nonexistent course id is always reported missing, never silently satisfied", bogusMissing.includes("this-course-id-does-not-exist"));

  console.log("== 7. Multiple prerequisites (evaluator-level, no live academy currently needs 2+ courses) ==");
  const multiMissing = getMissingCourses(bogusRuntimeState, ["practical-arithmetic", "civic-fundamentals", "world-geography"]);
  check("with 2 of 3 completed, only the genuinely uncompleted one is reported missing", multiMissing.length === 1 && multiMissing[0] === "world-geography");

  console.log("== 8. Unrelated state write preserves education completion ==");
  await api("/state", { method: "PUT", token: grad.token, body: { player: { bio: { signature: "academy-canary-unrelated-write" } } } });
  const gradAfterUnrelatedWrite = await getCityAcademyForUser(gradInternal, "east");
  const gradFoundryAfter = gradAfterUnrelatedWrite.academies.find((a) => a.id === "ironhall-foundry-collegium");
  check("education completion survives an unrelated /state write", gradFoundryAfter.missingCourses.length === 0);

  console.log("== 9. Reload / session restore preserves completion ==");
  const meAfterReload = await api("/me", { token: grad.token });
  check("session restore succeeds", meAfterReload.status === 200);
  const academyAfterReload = await api(`/cities/east/academy`, { token: grad.token });
  check("academy status after reload still shows practical-arithmetic satisfied", academyAfterReload.status === 200 && academyAfterReload.payload.academies.find((a) => a.id === "ironhall-foundry-collegium").missingCourses.length === 0);

  console.log("== 10. Forged completion via /state does not unlock an academy ==");
  const forger = await registerAndLogin("forger");
  await api("/state", { method: "PUT", token: forger.token, body: { education: { completedCourses: ["practical-arithmetic"], completed: { "practical-arithmetic": { completed: true } } } } });
  const forgerInternal = await loadInternalUser(forger.publicId);
  const forgerResult = await getCityAcademyForUser(forgerInternal, "east");
  const forgerFoundry = forgerResult.academies.find((a) => a.id === "ironhall-foundry-collegium");
  check("a forged education.completedCourses field via /state does not unlock Foundry Collegium", forgerFoundry.missingCourses.includes("practical-arithmetic"));

  console.log("== 11. Forged academy start/complete attempts are rejected server-side ==");
  const forgerStart = await api("/cities/academies/ironhall-foundry-collegium/start", { method: "POST", token: forger.token, body: { qualified: true, missingCourses: [] } });
  check("starting Foundry Collegium with a forged 'qualified' body field still fails (real prerequisites unmet)", forgerStart.status === 409);
  const forgerComplete = await api("/cities/academies/ironhall-foundry-collegium/complete", { method: "POST", token: forger.token, body: {} });
  check("completing a stage that was never started is rejected", forgerComplete.status === 409);

  console.log("== 12. Root-mounted and /api-mounted academy endpoint agree ==");
  const rootMounted = await api("/cities/east/academy", { token: grad.token });
  const apiMounted = await api("/api/cities/east/academy", { token: grad.token });
  check("root-mounted and /api-mounted academy endpoint return the same status", rootMounted.status === apiMounted.status);
  check(
    "root-mounted and /api-mounted academy endpoint report the same Foundry Collegium eligibility",
    rootMounted.payload.academies.find((a) => a.id === "ironhall-foundry-collegium").missingCourses.length
      === apiMounted.payload.academies.find((a) => a.id === "ironhall-foundry-collegium").missingCourses.length,
  );

  console.log("== 13. Lock message / missingCourses never leak a raw unresolved id where a real name exists ==");
  check(
    "Foundry Collegium's lockReason for the fresh (locked) account is human-readable prose, not a raw slug",
    !/practical-arithmetic/.test(freshFoundry.lockReason ?? "") && /practical arithmetic/i.test(freshFoundry.lockReason ?? ""),
  );

  console.log(`\nAll ${checks} checks passed.`);
}

main().catch((error) => {
  console.error("ACADEMY_PREREQUISITE_RECOGNITION_CANARY_FAILED");
  console.error(error);
  process.exitCode = 1;
});
