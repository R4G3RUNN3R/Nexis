# Nexis Skeletal Animation Runtime Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a free, first-party, security-minimal skeletal/attachment animation runtime for Nexis that consumes sanitized LoongBones-authored assets and renders through the Visual Theatre actor-renderer seam.

**Architecture:** LoongBones is authoring/build input only. A build-time compiler converts an allowlisted source subset into versioned `NexisActorAsset` JSON. `theatre-skeleton` is pure TypeScript state/animation math with no Pixi/network dependency; `theatre-pixi-skeleton` adapts evaluated bone/slot/attachment output to Pixi. Equipment visuals are projections only.

**Tech Stack:** TypeScript strict mode, existing `v2/client` workspace, PixiJS v8 adapter, Vitest, first-party code. No paid runtime/editor dependency.

**Spec:** `v2/docs/superpowers/specs/2026-09-02-nexis-skeletal-runtime-design.md`

## Global Constraints

- Runtime is presentation-only and attacker-controlled.
- No network APIs, persistence, auth, secrets, gameplay RNG or authoritative arithmetic.
- Consume only compiled/sanitized `NexisActorAsset`, never arbitrary remote editor documents.
- Reject cycles, non-finite numbers, remote URLs, traversal, unknown executable/event constructs and resource-exhaustion shapes.
- Start with bones, sprite attachments, skins and core timelines; mesh/IK/constraints require later evidence.
- Exact asset-format versioning and fail-closed parsing are mandatory.
- TDD for every behaviour; malformed assets become permanent regressions.
- No push/merge/deploy or release certification.

---

### Task 1: Versioned Nexis actor asset schema and fail-closed validator

**Files:** create `packages/theatre-skeleton/{package.json,src/asset.ts,src/validateAsset.ts,test/validateAsset.test.ts}`.

**Produces:** `NexisActorAssetV1`, bone/slot/region/skin/animation/timeline types; `validateActorAsset(input): ValidatedActorAsset`.

- [ ] RED tests: valid minimal skeleton; duplicates; missing parents; cycles; depth; non-finite values; oversized strings/counts; remote/traversal texture refs; unknown timeline/event kinds.
- [ ] Implement explicit schema/version validation and frozen validated model.
- [ ] Add static forbidden-API purity scan.
- [ ] GREEN/typecheck and commit `feat(theatre): validate Nexis actor assets`.

### Task 2: Deterministic bone hierarchy evaluation

**Files:** `src/skeleton.ts`, `src/math.ts`, tests.

- [ ] RED tests for parent-child translation/rotation/scale, stable order and reset-to-bind-pose.
- [ ] Implement minimal finite guarded 2D affine transform evaluation.
- [ ] Record micro-benchmark baseline for repeated evaluation, not release certification.
- [ ] GREEN and commit `feat(theatre): evaluate skeletal transforms`.

### Task 3: Slots, sprite attachments and skins/equipment replacement

**Files:** `src/attachments.ts`, `src/skins.ts`, tests.

- [ ] RED tests for default skin, supplied visual-equipment override, missing attachment fallback, draw order and reset.
- [ ] Implement region attachment selection and skin composition with no authority semantics.
- [ ] GREEN and commit `feat(theatre): support skeletal skins and attachments`.

### Task 4: Animation clips, timelines and presentation events

**Files:** `src/animation/{clip.ts,player.ts,interpolate.ts}`, tests.

- [ ] RED tests for key interpolation, loop/non-loop, idle->action crossfade, deterministic replay with same deltas and speed affecting presentation only.
- [ ] Implement caller-clock-driven translation/rotation/scale/attachment/visibility timelines; no wall-clock dependency/gameplay RNG.
- [ ] Allowlist presentation events as data only.
- [ ] GREEN and commit `feat(theatre): animate skeletal presentation clips`.

### Task 5: LoongBones source compiler

**Files:** create `v2/client/tools/actor-compiler/` package, parser/converter/CLI and fixtures/tests.

- [ ] RED fixture tests for minimal conversion, unsupported-feature rejection, malicious URL/path input, cycles/non-finite values and deterministic output.
- [ ] Implement local-file converter for bones, slots, region attachments, skins and supported animation timelines only.
- [ ] Emit canonical/stable ordering for deterministic diffs/builds.
- [ ] GREEN and commit `feat(theatre): compile LoongBones actors to Nexis format`.

### Task 6: Pixi skeletal actor adapter

**Files:** create `v2/client/packages/theatre-pixi-skeleton/`; modify only the Phase 1 actor-renderer registration seam.

- [ ] RED fake-Pixi tests for lifecycle, attachment replacement, pose playback and disposal.
- [ ] Implement `IActorRenderer` adapter consuming validated asset + already-resolved local texture map.
- [ ] Missing textures use host placeholder policy and never trigger fetch.
- [ ] GREEN and commit `feat(theatre): render Nexis skeletal actors with Pixi`.

### Task 7: Security corpus, lifecycle and measured performance

**Files:** malformed fixture corpus, `test/security/`, benchmark script/report.

- [ ] Permanent regressions for deep hierarchies, cycles, huge timelines, NaN/Infinity, malformed atlas refs, event abuse and unknown versions.
- [ ] Prove validation fails before renderer allocation for rejected assets.
- [ ] Test repeated create/play/swap/dispose cycles for bounded listeners/containers.
- [ ] Benchmark 1v1 and 4v6 layered scenes; record measured update/frame costs and allocations without inventing release thresholds.
- [ ] Commit `test(theatre): harden skeletal runtime inputs`.

### Task 8: Integration documentation and fallback decision gate

**Files:** create `v2/docs/SKELETAL-ACTOR-RUNTIME.md`; update `VISUAL-THEATRE.md`, `IMPLEMENTATION-STATUS.md`, `CHANGELOG.md`.

- [ ] Document LoongBones -> compiler -> asset -> first-party runtime -> Pixi pipeline and supported subset/security limits.
- [ ] Run targeted skeleton/theatre tests, typecheck and builds only.
- [ ] Compare capability/performance with the contingency DragonBones runtime without installing it into production; fallback requires material evidence.
- [ ] Verify no paid/runtime-network dependency, V1 mutation or authoritative gameplay code entered the tranche.
- [ ] Commit `docs(theatre): record skeletal runtime integration`.
