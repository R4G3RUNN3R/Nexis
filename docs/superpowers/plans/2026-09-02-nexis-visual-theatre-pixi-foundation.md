# Nexis Visual Theatre Pixi Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the first production-oriented, embeddable PixiJS v8 presentation foundation for Nexis Combat Theatre while preserving the server-authoritative security boundary and supporting later skeletal actors, excursions and adventures.

**Architecture:** Create an isolated TypeScript workspace under `v2/client/`, never the legacy V1 web client. `theatre-core` owns pure presentation contracts/orchestration with no browser/network dependency; `theatre-pixi` owns the Pixi stage/lifecycle and primitive actors; `theatre-react` is an optional host/accessibility bridge; `theatre-harness` supplies deterministic non-authoritative scenarios. The renderer receives sanitized snapshots/events and emits narrow intent callbacks only.

**Tech Stack:** TypeScript strict mode, npm workspaces, PixiJS v8 exact-version pin, React only in the optional host package, Vitest for targeted tests, Vite for the development harness. WebGL is the initial renderer preference.

**Spec:** `v2/docs/superpowers/specs/2026-09-02-nexis-visual-theatre-design.md`

## Global Constraints

- Nexis determines reality. Visual Theatre displays it and captures intent.
- Every client is attacker-controlled; no renderer owns RNG, damage/healing, inventory, rewards, cooldown truth, initiative, victory, persistence, authentication or owner-module writes.
- Minimum player-visible projections only; hidden state is not shipped merely to hide it in canvas/DOM.
- No arbitrary network client, runtime CDN, `eval`, `new Function`, Supabase or independent persistence in renderer packages.
- PixiJS is exact-version pinned after license/security review. React is forbidden in `theatre-core` and `theatre-pixi`.
- Canvas is not the accessibility surface; legal actions/targets require a semantic DOM mirror.
- Reduced motion, reduced shake and reduced flashes are binding preferences.
- Phase 1 uses primitive/original placeholders. Skeletal integration is a separate plan.
- No V1 mutation, merge, push, deploy or production data access.
- Every production behaviour follows TDD: observed RED, minimal GREEN, refactor, focused commit.

---

## File Structure

Create `v2/client/package.json`, `v2/client/tsconfig.base.json`, packages `theatre-core`, `theatre-pixi`, `theatre-react`, app `theatre-harness`, and `v2/docs/VISUAL-THEATRE.md`. Modify only V2 status/docs and `CHANGELOG.md` after verified work.

### Task 1: Bootstrap isolated client workspace and pure theatre-core contracts

**Files:** `v2/client/package.json`, `tsconfig.base.json`, `packages/theatre-core/{package.json,tsconfig.json,src/index.ts,src/contracts.ts,src/presentation.ts,test/presentation.test.ts}`.

**Produces:** `BattlePresentationSnapshot`, `PresentationActor`, `PresentationResource`, `PresentationStatus`, discriminated `PresentationEvent`, `PresentationPreferences`, `TheatreViewerMode`, `TheatreIntent`, `applyPresentationEvent(snapshot,event)`.

- [ ] Write RED tests proving resulting values are copied from authoritative events, unknown effects remain opaque, and presentation speed/preferences do not mutate authority.
- [ ] Run only theatre-core tests and observe RED because APIs do not exist.
- [ ] Implement minimal strict types/event application. No Pixi, React, fetch/storage APIs or RNG.
- [ ] Add a static purity test rejecting `fetch(`, `XMLHttpRequest`, `WebSocket`, `localStorage`, `sessionStorage`, `Math.random`, `crypto.getRandomValues`, `eval(` and `new Function` in core sources.
- [ ] Run focused tests/typecheck and commit `feat(theatre): add pure presentation core`.

### Task 2: Pixi application lifecycle and graceful fallback boundary

**Files:** `packages/theatre-pixi/{package.json,tsconfig.json,src/index.ts,src/PixiTheatreRenderer.ts,src/PixiApplicationFactory.ts,src/stageLayers.ts,test/*}`.

**Produces:** `ITheatreRenderer` with `mount`, `render`, `present`, `resize`, `dispose`; a failure result allows host DOM fallback.

- [ ] Check official npm metadata/license, pin the chosen PixiJS v8 release exactly and record it.
- [ ] RED lifecycle tests: one Application per mount, resize, disposal, no orphan ticker/listener/ResizeObserver, remount starts clean.
- [ ] Implement client-only lazy Pixi initialization with explicit WebGL preference and SSR-safe module evaluation.
- [ ] Create ordered containers: far background, environment, ground, actors, transient effects/projectiles, floating feedback, overlays.
- [ ] Implement initialization failure path returning host control rather than blank stage.
- [ ] GREEN/typecheck and commit `feat(theatre): add Pixi renderer lifecycle`.

### Task 3: Deterministic primitive actor rendering and positioning

**Files:** `theatre-pixi/src/actors/{ActorRenderer.ts,PrimitiveActorRenderer.ts,placement.ts}`, tests.

**Produces:** `IActorRenderer`; pure `computeBattlePlacement(...)`.

- [ ] RED tests for 1v1, 4-allies/6-hostiles, facing, resize and stable ordering.
- [ ] Implement deterministic side-based placement with no physics/pathfinding/gameplay collision semantics.
- [ ] Render large neutral humanoid placeholders from local Pixi graphics only.
- [ ] Prove visual attachment descriptor changes affect display only.
- [ ] GREEN/typecheck and commit `feat(theatre): render deterministic primitive actors`.

### Task 4: Semantic event presentation and accessibility preferences

**Files:** `theatre-pixi/src/presentation/{EventPresenter.ts,MovementPresenter.ts,FloatingFeedbackPool.ts,preferences.ts}`, tests.

- [ ] RED mapping tests for movement/return, skill activation, hit/miss/critical, damage/healing, status, defeat and unknown events.
- [ ] Implement bounded transient feedback pool; no per-frame texture creation/unbounded growth.
- [ ] Implement reduced-motion/shake/flash preferences without changing event order/snapshot values.
- [ ] GREEN/typecheck and commit `feat(theatre): present authoritative combat events`.

### Task 5: Legal target selection and semantic DOM mirror

**Files:** `theatre-pixi/src/input/TargetSelectionBridge.ts`, `theatre-react/{package.json,src/index.ts,src/SemanticTheatreMirror.tsx}`, tests.

- [ ] RED tests: illegal click emits none; legal target emits one intent; replay/spectator emit none; keyboard DOM controls expose equivalent targets.
- [ ] Implement narrow callback bridge with no network/auth logic.
- [ ] Implement semantic actor/resource/status output and legal-target buttons; canvas may be `aria-hidden` when mirror exists.
- [ ] GREEN/typecheck and commit `feat(theatre): add accessible target intent bridge`.

### Task 6: Replay/spectator shared path and DOM fallback

**Files:** `theatre-core/src/replay.ts`, `theatre-react/src/DomBattlefieldFallback.tsx`, tests.

- [ ] RED tests proving replay preserves supplied order/results, speed changes scheduling only, replay/spectator cannot submit intents.
- [ ] Implement playback without gameplay RNG/recalculation.
- [ ] Implement neutral DOM fallback consuming the same snapshot/events.
- [ ] GREEN/typecheck and commit `feat(theatre): add replay spectator and fallback path`.

### Task 7: Development harness and deterministic scenarios

**Files:** `v2/client/apps/theatre-harness/` Vite app, fixtures A-E, controls/tests.

- [ ] RED fixture tests proving fixed event sequences, valid actor references and no random generation.
- [ ] Build stage-first harness; debugger remains visually separate from embeddable theatre.
- [ ] Add scenario/viewer/viewport/preferences/playback controls and renderer-vs-fallback switch.
- [ ] Run harness tests, strict typecheck and production build.
- [ ] Commit `feat(theatre): add deterministic development harness`.

### Task 8: Integration docs and tranche verification

**Files:** create `v2/docs/VISUAL-THEATRE.md`; modify `v2/docs/IMPLEMENTATION-STATUS.md`, `CHANGELOG.md`.

- [ ] Document package/security/lifecycle/projection/intent/accessibility/dependency/fallback/skeletal seams.
- [ ] Run targeted theatre workspace tests, typecheck and production build only. Do not certify complete Nexis release gate.
- [ ] Inspect dependency tree/license/audit output; unresolved advisories are blockers, not suppressed warnings.
- [ ] Verify no V1, production config, secrets or unrelated authority code changed.
- [ ] Commit `docs(theatre): record Pixi foundation integration`.

## SDD / TDD Evidence Ledger

### 2026-09-03 — Task 2 M1 purity fix round 2

- Starting HEAD: `354542ebd3f28091b487d65d4588db8b42d24fc5`.
- Scope: the static `theatre-pixi` AST policy and its canaries only; no renderer runtime,
  dependency, V1 or Task 3 change.
- RED: after adding adversarial and positive canaries first,
  `npx vitest run test/purity-policy.test.ts` reported 4 failed / 56 passed. The four failures
  were object declaration, nested object parameter, object destructuring assignment and array
  declaration defaults whose executable RHS referenced `fetch`, `Function` or `localStorage`.
  The direct simple parameter default and all local-default positives already passed.
- GREEN: the focused policy passed 60/60 after recursively inspecting default RHS expressions in
  function-parameter, variable-declaration and destructuring-assignment binding patterns.
  `npm run test:pixi` passed 81/81, `npm run test:core` passed 71/71 and `npm run typecheck`
  completed cleanly for the production and test TypeScript projects.
