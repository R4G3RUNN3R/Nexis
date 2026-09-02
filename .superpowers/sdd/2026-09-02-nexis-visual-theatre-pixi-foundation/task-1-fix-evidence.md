# Task 1 review-fix RED/GREEN evidence

All commands run from `v2/client/packages/theatre-core` unless noted.

## H1 — encounter-bound deterministic event cursor

- RED: `npx vitest run test/event-integrity.test.ts`
- Observed: 1 file failed, 6 tests failed because the required snapshot/event decoders and cursor-aware result API did not exist (`decodeBattlePresentationSnapshot is not a function`; `decodePresentationEvent is not a function`).
- Additional RED: after the initial implementation, `npx vitest run test/event-integrity.test.ts` failed 2 of 9 tests because in-order events targeting an unexposed resource or absent status were silently consumed and advanced the cursor.
- GREEN: `npx vitest run test/event-integrity.test.ts` passed 1 file, 9 tests after nested references were included in fail-closed validation.

## H2 / M1 / M2 — versioned decoding, opaque selectors, sanitization

- RED: `npx vitest run test/wire-contracts.test.ts`
- Observed: 1 file failed; 8 failed and 1 passed. Version constant and all three decoders were absent, so supported/unsupported versions, unknown variants, selector validation, unknown-field rejection and immutable cloning were not enforced.
- GREEN: included in `npm run test:core`: version, selector, sanitization, immutability and historical V1 checks passed.

## M3 — stale interaction projection

- RED: `npx vitest run test/interaction-resync.test.ts`
- Observed: 1 file failed, 5 tests failed because snapshot/event decoding and a typed resync path did not exist; unknown active actors and stale legal-target transitions were therefore unenforced.
- Additional RED: `npx vitest run test/interaction-resync.test.ts` failed 4 of 6 tests after adding the explicit host intent-safety gate because `canSubmitTheatreIntent` did not exist.
- GREEN: `npx vitest run test/interaction-resync.test.ts` passed 1 file, 6 tests after the gate admitted only fresh active live projections.

## M4 — AST/dependency/global purity guard

- RED: `npx vitest run test/purity-policy.test.ts`
- Observed: suite failed during collection because the AST policy module did not exist; dynamic import, side-effect import, global fetch, beacon, transport and storage canaries were therefore unenforced.
- GREEN: `npx vitest run test/purity-policy.test.ts test/purity.test.ts` passed 2 files, 10 tests after adding the Rolldown/Oxc AST guard from the existing Vite toolchain and scanning all publishable TS/TSX/JS/JSX/MJS/CJS sources.

## Final targeted verification

- `npm run test:core` from `v2/client`: 6 files passed, 35 tests passed (checkpoint before the final two nested-reference cases).
- Final `npm run test:core` from `v2/client`: 6 files passed, 45 tests passed.
- Final `npm run typecheck` from `v2/client`: production source typecheck and separate Node/Vitest test-tooling typecheck both passed.
- `git diff --check`: passed with no whitespace errors.

---

# Task 1 review-fix round 2 (M2 / M3 / M4) RED/GREEN evidence

Codex re-reviewed exact commit `36ad771` and marked H1, H2 and M1 RESOLVED. M2, M3 and M4 were
independently confirmed as only partially resolved. All commands below run from
`v2/client/packages/theatre-core` unless noted.

## M2 — caller-owned alias / mutation safety

- RED: `npx vitest run test/caller-ownership.test.ts`
- Observed: **1 file failed, 4 of 4 tests failed.** `applyPresentationEvent` deep-froze the
  caller-owned snapshot on both the accepted and resync paths, froze the caller-owned event and its
  status object (`[false] vs [true]` on `Object.isFrozen`), and retained the caller's status object
  by reference in the result (`expected { kind: 'known', … } not to be { kind: 'known', … }`).
- Implementation: `internalizeSnapshot` / `cloneActor` / `cloneResource` / `cloneAttachment` /
  `cloneStatus` rebuild the snapshot and any retained event status by explicit typed reconstruction
  before evaluation. No JSON serialization cloning and no new framework.
- GREEN: included in the final `npm run test:core` below; all 4 caller-ownership tests pass.

## M3 — stale interaction projection and intent safety gate

- RED: `npx vitest run test/interaction-resync.test.ts`
- Observed: **1 file failed, 8 failed / 14 passed (22).** The five state-mutating event families
  (`damageApplied`, `healingApplied`, `resourceChanged`, `statusApplied`, `statusRemoved`) returned
  `applied` and left `interactionState` at `ready`, and `canSubmitTheatreIntent` accepted a
  wrong-encounter intent and an intent naming an actor that is not offered as a legal target or is
  absent from the projection entirely (`expected true to be false`).
- Implementation: `changesInteractionLegality` makes every retained-state change block interaction
  and return `resyncRequired` / `interactionProjectionStale` with the display update applied;
  presentation-only cues stay `applied`. `canSubmitTheatreIntent(snapshot, viewerMode, intent)` now
  requires live viewer mode, active phase, `ready` interaction state, matching contract version and
  encounter, and — for any target-bearing intent — a target the current projection still offers as a
  legal, undefeated target.
- GREEN: included in the final `npm run test:core` below; all 22 interaction/gate tests pass.

## M4 — purity AST gate bypasses

- RED: `npx vitest run test/purity-policy.test.ts`
- Observed: **1 file failed, 5 failed / 13 passed (18).** `globalThis['fetch'](…)`,
  `new globalThis['WebSocket'](…)`, `globalThis['localStorage']`, `const F = Function; new F(…)` and
  `let sink; sink = process;` all returned `[]`. (`const escape = globalThis.fetch;` was already
  caught by the existing dotted-member rule and is retained as a regression canary.)
- Implementation: `memberName` resolves computed string-literal property access as well as dotted
  access and checks it against both the member and forbidden-global rule tables; `aliased` flags a
  `VariableDeclarator` initializer or assignment right-hand side that binds a forbidden global to a
  local name. Static test guard only; no runtime code and no new dependency.
- GREEN: included in the final `npm run test:core` below; all 18 policy canaries and the
  publishable-source scan pass with no false positive on `src/`.

## Behaviour updates to previously green tests

The M3 contract change means state-mutating events now terminate as
`resyncRequired` / `interactionProjectionStale` rather than `applied`. Five pre-existing assertions
in `test/event-integrity.test.ts` and `test/presentation.test.ts` were updated to the new outcome.
No assertion was weakened: each still pins cursor advance, the copied resulting values, opaque status
semantics, frozen results and the stale/duplicate rejection it originally pinned.

## Final targeted verification

- `npm run test:core` from `v2/client`: **7 files passed, 71 tests passed, 0 failed.**
- `npm run typecheck` from `v2/client`: passed for both `tsconfig.json` (production source) and
  `tsconfig.test.json` (Node/Vitest test tooling).
- `git diff --check 36ad771..HEAD` and `git diff --check`: clean, no whitespace errors.
- Not run, deliberately: the full release suite and any .NET restore/build/test, because this round
  changes only `v2/client/packages/theatre-core` and the task scoped verification to the targeted
  client checks.
