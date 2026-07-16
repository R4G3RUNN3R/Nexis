import assert from "node:assert/strict";
import {
  EXCURSION_GRID,
  EXCURSION_LOCATIONS,
  calculateExcursionTiming,
  getExcursionLocation,
} from "../../data/excursionData.js";
import {
  applyExcursionCompletionToRuntime,
  normalizeExcursionState,
  rollExcursionReward,
} from "../../services/excursionService.js";

function makeRuntime() {
  return {
    player: {
      level: 16,
      gold: 0,
      inventory: {},
      counters: {},
      current: { currentCityId: "nexis" },
    },
    travel: { status: "idle", currentCityId: "nexis" },
    education: { completedCourses: ["world-geography", "historical-awareness", "applied-knowledge"] },
  };
}

assert.equal(EXCURSION_GRID.columns >= 12, true, "grid must be broad enough to slice the map");
assert.equal(EXCURSION_GRID.rows >= 8, true, "grid must be tall enough to slice the map");
assert.equal(EXCURSION_LOCATIONS.length >= 15, true, "map should expose at least fifteen named excursion locations");
assert.equal(EXCURSION_LOCATIONS.some((location) => location.rewardFocus.includes("recipe")), true, "some locations must advertise recipe discovery");

const target = getExcursionLocation("central_ruined_watchtower_grid");
assert.ok(target, "central ruined watchtower excursion location must exist");
const timing = calculateExcursionTiming({ originBox: { x: 7, y: 5 }, targetBox: target.box });
assert.equal(timing.exploreMs, 60 * 60 * 1000, "exploration phase must always be one hour");
assert.equal(timing.returnMs, timing.outboundMs, "return time must equal outbound time");
assert.equal(timing.totalMs, timing.outboundMs + timing.exploreMs + timing.returnMs, "total time must be outbound + one hour + return");
assert.equal(timing.distanceBoxes > 0, true, "target must be away from origin box");

const guaranteed = rollExcursionReward(target, {
  random: () => 0,
  now: 1000,
  playerLevel: 16,
  completedCourses: new Set(["world-geography", "historical-awareness", "applied-knowledge"]),
});
assert.ok(guaranteed.gold > 0, "guaranteed low roll should award gold");
assert.ok(guaranteed.items.length > 0, "guaranteed low roll should award at least one item/material");
assert.ok(guaranteed.recipeProgress.length > 0, "guaranteed low roll should include recipe progress");
assert.ok(guaranteed.skillFragments.length > 0 || guaranteed.magicFragments.length > 0, "guaranteed low roll should include skill or magic fragments");

const runtime = makeRuntime();
const state = normalizeExcursionState(runtime);
runtime.player.excursions = state;
state.active = {
  id: "excursion_test",
  locationId: target.id,
  startedAt: 0,
  completesAt: 1,
  originCityId: "nexis",
  originBox: { x: 7, y: 5 },
  targetBox: target.box,
  timing,
};
const completion = applyExcursionCompletionToRuntime(runtime, state.active, { now: 2000, random: () => 0 });
assert.equal(completion.completed, true, "completion should resolve once the total timer has elapsed");
assert.equal(runtime.player.counters.excursionsCompleted, 1, "completion must increment excursion counter");
assert.equal(runtime.player.counters.excursionItemsFound > 0, true, "completion must count found items");
assert.equal(runtime.player.counters.excursionRareFinds > 0, true, "completion must count rare finds on rare reward rolls");
assert.equal(runtime.player.excursions.active, null, "active excursion must clear after completion");
assert.equal(runtime.player.excursions.history.length, 1, "completion must write excursion history");

console.log(JSON.stringify({ ok: true, locations: EXCURSION_LOCATIONS.length, timing, reward: guaranteed, counters: runtime.player.counters }, null, 2));
