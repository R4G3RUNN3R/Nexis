// Ticket 4: World Map ownership, excursion cleanup, zoom/pan/reset/fit.
//
// Zoom, pan, drag, and visual layout were verified interactively in a real
// browser (see the Ticket 4 final report for screenshots and evidence) -
// there is no browser-based automated suite in this repo to extend, and
// adding one (a new @playwright/test dependency plus its Chromium binary)
// is a larger infrastructure decision than this ticket calls for. This
// canary covers everything that *is* testable without a browser: that
// Travel's source no longer renders excursion content while World Map's
// still does, that every excursion ID World Map can link to resolves to a
// real server-authoritative location, that an unknown ID fails in a
// controlled way, that locked excursions cannot be started by an
// underqualified account, and that active excursion state survives a
// runtime-state save/reload round trip.
//
//   node server/scripts/canaries/worldmap-travel-ownership-canary.mjs
//
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { ensureDatabaseSchema } from "../../db/migrate.js";
import { registerUser, getSessionUser } from "../../services/authService.js";
import { getExcursionLocation, EXCURSION_LOCATIONS } from "../../data/excursionData.js";
import { startExcursionForUser, getExcursionBoardForUser } from "../../services/excursionService.js";
import { withTransaction } from "../../db/pool.js";
import { findPlayerStateByUserInternalId, upsertPlayerRuntimeState } from "../../repositories/playerStateRepository.js";
import { buildMutableRuntimeState } from "../../lib/runtimePlayerState.js";
import { HttpError } from "../../lib/errors.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, "../../..");

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
    check(label, error instanceof HttpError && error.code === code);
  }
}

async function main() {
  console.log("== 1/2. Travel no longer owns excursion content; World Map still does (static source check) ==");
  const travelSource = readFileSync(path.join(REPO_ROOT, "src/pages/Travel.tsx"), "utf8");
  const worldMapSource = readFileSync(path.join(REPO_ROOT, "src/pages/WorldMap.tsx"), "utf8");

  check("Travel.tsx no longer imports excursionMapData", !travelSource.includes("excursionMapData"));
  check("Travel.tsx no longer renders excursion-map-marker elements", !travelSource.includes("excursion-map-marker"));
  check("Travel.tsx no longer renders the excursion grid overlay", !travelSource.includes("excursion-map-grid"));
  check("WorldMap.tsx still imports excursionMapData (the map remains the sole owner)", worldMapSource.includes("excursionMapData"));
  check("WorldMap.tsx still renders excursion-map-marker elements", worldMapSource.includes("excursion-map-marker"));
  check("WorldMap.tsx excursion markers link to /adventure?excursion=", worldMapSource.includes("/adventure?excursion="));

  console.log("== 3. Every excursion ID World Map can link to resolves to a real server-authoritative location ==");
  const excursionMapDataSource = readFileSync(path.join(REPO_ROOT, "src/data/excursionMapData.ts"), "utf8");
  const clientIds = [...excursionMapDataSource.matchAll(/\bid:\s*"([a-z0-9_]+)"/g)].map((m) => m[1]);
  check("client excursion map data defines a non-trivial set of locations", clientIds.length >= 15);
  const serverIds = new Set(EXCURSION_LOCATIONS.map((location) => location.id));
  const unresolvable = clientIds.filter((id) => !serverIds.has(id));
  check(`every World Map excursion marker ID resolves server-side (unresolvable: ${JSON.stringify(unresolvable)})`, unresolvable.length === 0);

  console.log("== 4. An unknown excursion ID fails in a controlled way, not a crash ==");
  check("getExcursionLocation returns null for an unknown id (no throw)", getExcursionLocation("definitely_not_a_real_location") === null);

  await ensureDatabaseSchema();

  const fresh = await registerUser({ firstName: "Wm", lastName: "TicketFour", email: `wm-ticket4-${Date.now()}@test.local`, password: "password1" });
  const freshUser = (await getSessionUser(fresh.sessionToken)).user;

  await expectHttpError("starting an unknown excursion id is rejected with a controlled 404, not a crash", "EXCURSION_NOT_FOUND", () =>
    startExcursionForUser(freshUser, "definitely_not_a_real_location"),
  );

  console.log("== 14/15/17. Locked excursions cannot be started by an underqualified account; no client-supplied value bypasses this ==");
  const gatedLocation = EXCURSION_LOCATIONS.find((location) => location.requiredCourses.length > 0);
  check("at least one excursion location is course-gated (a real lock exists to test against)", Boolean(gatedLocation));
  await expectHttpError(
    `a level-1 account with no completed courses cannot start the course-gated "${gatedLocation.id}" excursion`,
    "EXCURSION_LOCKED",
    () => startExcursionForUser(freshUser, gatedLocation.id),
  );
  check(
    "startExcursionForUser has no target-account or force-unlock parameter - it can only ever act on the authenticated caller's own state",
    startExcursionForUser.length <= 2,
  );

  console.log("== 19. Active excursion state survives a runtime-state save/reload round trip ==");
  const openLocation = EXCURSION_LOCATIONS.find((location) => location.requiredCourses.length === 0);
  check("at least one excursion location is open to a fresh level-1 account (needed to test persistence)", Boolean(openLocation));
  const startResult = await startExcursionForUser(freshUser, openLocation.id);
  check("starting an open excursion succeeds", Boolean(startResult.board.active));
  check(`the started excursion is the requested location (${openLocation.id})`, startResult.board.active.locationId === openLocation.id);

  const reloadedBoard = await getExcursionBoardForUser(freshUser);
  check("the active excursion is still present after an independent reload of the board", Boolean(reloadedBoard.board.active));
  check("the reloaded active excursion is still the same location", reloadedBoard.board.active?.locationId === openLocation.id);

  const rehydrated = await withTransaction(async (client) => {
    const playerState = await findPlayerStateByUserInternalId(client, freshUser.internalId);
    return buildMutableRuntimeState(freshUser, playerState);
  });
  check("buildMutableRuntimeState still hydrates the excursions field (the Ticket 1 hydration fix has not regressed)", Boolean(rehydrated.player.excursions?.active));
  check("the hydrated active excursion is still the correct location", rehydrated.player.excursions.active?.locationId === openLocation.id);

  // Prove an unrelated save afterward doesn't silently drop the active
  // excursion - the same class of bug Ticket 1 fixed for other fields.
  await withTransaction(async (client) => {
    const playerState = await findPlayerStateByUserInternalId(client, freshUser.internalId);
    const runtimeState = buildMutableRuntimeState(freshUser, playerState);
    runtimeState.player.bio = { ...runtimeState.player.bio, bio: "unrelated mutation" };
    await upsertPlayerRuntimeState(client, freshUser.internalId, runtimeState);
  });
  const afterUnrelatedSave = await getExcursionBoardForUser(freshUser);
  check("an unrelated save (bio update) does not erase the active excursion", Boolean(afterUnrelatedSave.board.active));
  check("the active excursion is still the correct location after the unrelated save", afterUnrelatedSave.board.active?.locationId === openLocation.id);

  console.log(`\nAll ${checks} checks passed.`);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("\nCANARY FAILED:", error.message);
    console.error(error.stack);
    process.exit(1);
  });
