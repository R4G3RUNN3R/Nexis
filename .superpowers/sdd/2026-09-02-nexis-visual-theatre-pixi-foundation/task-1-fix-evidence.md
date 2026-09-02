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
