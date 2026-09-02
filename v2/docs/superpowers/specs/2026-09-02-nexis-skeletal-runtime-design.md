# Nexis Skeletal Runtime Design

**Status:** APPROVED - user authorised implementation on 2 September 2026

**Date:** 2 September 2026

**Parent spec:** `v2/docs/superpowers/specs/2026-09-02-nexis-visual-theatre-design.md`

## Decision

Nexis will use **LoongBones** as the free/MIT skeletal-animation authoring workflow and a **minimal Nexis-owned TypeScript skeletal/attachment runtime rendered through PixiJS v8** in production.

A pinned, audited and vendored fork of `pixi-dragonbones-runtime` is contingency-only if the Nexis-owned runtime proves materially inadequate after measured implementation/benchmark evidence. Rive and paid/commercial authoring/runtime paths are rejected.

## Security boundary

The skeletal runtime is untrusted presentation code. It receives sanitized, player-visible actor presentation assets and commands only. It never receives or owns combat formulas, RNG seeds, hidden enemy state, inventory authority, account secrets, auth capabilities, persistence access, arbitrary network clients, rewards, cooldown truth, victory state, or owner-module write access.

The runtime must not call `fetch`, open sockets, load runtime CDN code, evaluate strings as code, use `eval`/`new Function`, or accept executable callbacks from authored asset data.

## Authoring and asset pipeline

1. Artists/technical authors create skeletons and animations in LoongBones.
2. Source exports are treated as untrusted build inputs.
3. A Nexis asset compiler parses the supported LoongBones/DragonBones-style JSON subset.
4. The compiler rejects unsupported or pathological constructs and emits a compact, versioned `NexisActorAsset` representation.
5. Runtime code consumes only `NexisActorAsset` plus already-resolved local textures/atlases.

No runtime conversion of arbitrary editor documents is required in production.

## Validation policy

The compiler/runtime format must fail closed and enforce explicit finite limits for schema version, skeleton/bone count, hierarchy depth, slot/attachment count, animation count/duration, timeline key count, mesh geometry when later supported, texture/atlas references, event vocabulary, string length, identifier syntax, cycles, NaN/Infinity, unknown type handling, path traversal, and remote URLs. Concrete numeric caps are engineering safety limits and must be benchmarked/documented before production adoption.

## Initial runtime capabilities

The initial first-party runtime supports deterministic bone transforms, slots, region/sprite attachments, skins/equipment attachment replacement, translation/rotation/scale/attachment/visibility animation timelines, presentation-only clip mixing, allowlisted animation events, lifecycle disposal, and a PixiJS v8 renderer adapter.

Mesh deformation, IK and additional constraints are staged capabilities. They are added only when approved art requires them and tests/benchmarks justify the cost.

## Equipment and authority

Visual equipment descriptors are player-visible presentation projections supplied by Nexis. Applying a visual attachment never grants ownership, stats, legality or effects. Unknown assets fail to a neutral placeholder/omission policy.

## Determinism and time

Animation time is presentation time only. Replay speed may alter playback without changing authoritative time. The runtime uses no gameplay RNG. Given the same validated asset, command sequence and presentation-clock inputs, pose output is reproducible within normal floating-point rendering tolerances.

## Supply-chain policy

LoongBones is authoring/build input, not a production runtime dependency. PixiJS is exact-version pinned under the Visual Theatre dependency policy. The skeletal runtime is first-party code. Any fallback runtime must be exact-version/commit pinned, license captured, dependency audited, preferably vendored/forked, and cannot auto-update in production builds. SBOM/license/advisory review remains a release prerequisite.

## Non-goals

No gameplay simulation, authoritative hitboxes, physics, outcome calculation, server-side animation decisions, final art, invented content, or implementation of every LoongBones/DragonBones feature.

## Acceptance boundary

The runtime is acceptable for integration review when it can load a validated Nexis actor asset, render layered actors through PixiJS, switch supplied equipment/skin attachments, play deterministic reusable animation clips, survive malformed-asset tests without executing code/network activity, dispose cleanly, and remain strictly presentation-only.
