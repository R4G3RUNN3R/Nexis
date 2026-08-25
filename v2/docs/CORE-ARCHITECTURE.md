# Nexis 2.0 Core Architecture

_Status: approved architecture decision, 2026-08-25._

## Definition

`Nexis.Core` is the authoritative **rules, logic and calculation machine** of Nexis.

It is not the database, API, scheduler, UI, persistence layer, authentication service, content store or a container for every subsystem implementation. It is the deterministic engine that receives trusted game-state inputs and command intent, applies Nexis rules and calculations, and returns authoritative decisions/state transitions/events through stable versioned contracts.

The concrete Core implementation is intentionally replaceable.

If a future `Nexis.Core vNext`, another .NET implementation, a Rust/C++/Go engine, a separate process, or any superior implementation receives the same compatible contracts/state/content and passes the required conformance tests, the rest of Nexis must continue operating without source rewrites. Replacing Core should improve the engine, not collapse the surrounding systems.

## Research basis

This design takes useful lessons from Nexis's inspiration set without copying any one architecture.

- WoW-like/TrinityCore servers place major gameplay calculations, formulas and action handling in the server core while exposing scripting/hooks around the engine. This supports the idea that the central server core is the authoritative gameplay machine.
- Fallen London/StoryNexus demonstrates an explicit state -> prerequisite/rule evaluation -> result/state-change model, reinforcing the value of a rules machine operating on authoritative state rather than UI state.
- Torn keeps external API access read-only, reinforcing the broader server-authority boundary: clients and external consumers observe/request, but the server decides and mutates.

Nexis goes further than these examples by making replaceability of the Core implementation a first-class architectural requirement.

## Core owns

The Core owns the executable meaning of Nexis rules, including as appropriate:

- command/rule evaluation;
- deterministic gameplay calculations;
- formula execution;
- prerequisite evaluation;
- legal/illegal state-transition decisions;
- resource-cost and result calculations;
- cooldown/time-rule evaluation using authoritative engine time;
- deterministic RNG consumption through approved abstractions;
- cross-system rule composition where a command depends on multiple snapshots;
- production of authoritative transition plans/domain events/results;
- rule/formula version selection where historical compatibility requires it.

Domain-specific rule packages may be organized internally by area such as Combat, Economy, Travel, Education, Magic or Organizations, but those rule packages remain part of the selected Core implementation rather than becoming compile-time dependencies of the surrounding systems.

## Surrounding systems own

Each surrounding system remains separately replaceable and owns its non-Core responsibilities, for example:

- authoritative persistent state for its domain;
- state loading/snapshot creation;
- persistence and transactions through adapters;
- domain data/content definitions where applicable;
- read projections and query models;
- external/API contracts belonging to that system;
- system-specific background scheduling inputs;
- UI/client presentation contracts;
- integration with external services.

Examples:

- Inventory owns item/ownership state; Core decides whether an equip/use/transfer intent is legal and calculates the transition.
- Economy owns balances/ledger/escrow state; Core evaluates purchase/transfer rules and produces the required state changes.
- Combat owns persistent encounter/combat state; Core calculates legal actions, hit/damage/effects and resulting transitions.
- Education owns course/enrollment/progress state and course definitions; Core evaluates prerequisites, timing and reward transitions.
- Travel owns route/location/travel state and route data; Core evaluates eligibility, cost, timing and arrival transitions.

The exact module boundaries remain subject to the separate State Ownership design, but this Core/system responsibility split is already fixed.

## Contract boundary

No surrounding system depends on concrete Core classes.

The boundary must be expressed through stable, versioned contracts. The final naming may evolve, but the architecture must provide equivalents of:

- engine request/command evaluation contract;
- trusted execution context;
- immutable state/snapshot inputs;
- typed domain/system inputs;
- rule/content version identifiers;
- deterministic RNG/time abstractions;
- authoritative decision/transition result;
- emitted domain-event descriptors;
- structured rejection/conflict/failure outcomes.

Module/system contract packages may define their own snapshots, intents and transition shapes. The Core implementation consumes/produces those contracts but the system implementation never references Core internals.

## Required interaction shape

Conceptually:

```text
Client / System / Admin request
            |
            v
Application / Command Lane
            |
            +--> load trusted state from independent systems
            +--> assemble immutable snapshots/context
            |
            v
      Core.Contracts
            |
            v
   Selected Nexis.Core
   rules/logic/calculations
            |
            v
 Authoritative Decision
 / Transition Plan / Events
            |
            v
Application transaction boundary
            |
            +--> owning systems persist their state changes
            +--> ledger/outbox/audit commit atomically
            |
            v
        projections/UI
```

Core therefore decides; surrounding systems persist and expose.

## No Core-owned database truth

Core must not become authoritative by owning a private duplicate database of every system.

It may use ephemeral in-memory state during evaluation and may consume caches/snapshots through abstractions, but persistent source-of-truth state remains with the owning systems/persistence boundaries.

This is critical for replacement: a new Core must be able to start from existing compatible system state rather than require a bespoke migration of hidden Core-owned truth.

## Determinism and reproducibility

For rules where randomness or time matters, Core receives controlled authoritative abstractions/context rather than reading uncontrolled wall-clock/random sources.

The design goal is:

`same compatible state + same intent + same rule/content version + same authoritative time/RNG inputs -> reproducible decision`

This enables testing, support investigation, anti-cheat review, replay verification and Core-vNext comparison.

## Rule and formula versioning

Core implementation version and gameplay rule version are separate concepts.

A faster/safer Core implementation may execute the same rule version without changing gameplay semantics.

When gameplay rules intentionally change, rule/formula versions are explicit so historical events/support tools can identify what logic produced an old outcome. A new Core may support multiple rule versions during migrations/replays where needed.

## Production-derived replay corpus

Detailed authoritative logs are also a permanent Core-upgrade asset. Nexis should be able to turn real historical production scenarios into reproducible Core test cases instead of relying only on hand-written synthetic tests.

For every meaningful Core evaluation, the internal replay record must preserve or be able to resolve enough structured information to reproduce the decision. The exact storage representation may use immutable content-addressed snapshots/references rather than duplicating large state blobs for every action, but the replay boundary must capture or resolve at least:

- immutable CommandId, CorrelationId and causation links;
- Core implementation version;
- gameplay rule/formula version;
- content/data version identifiers relevant to the decision;
- normalized command intent;
- trusted execution-context fields relevant to the rule decision;
- immutable authoritative state/snapshot inputs, or durable references/checksums sufficient to reconstruct them exactly;
- authoritative evaluation time and time-zone/reset context where relevant;
- deterministic RNG stream/input information required to reproduce the result, kept in restricted internal storage and never exposed as exploitable player data;
- authoritative result/status;
- calculated costs, rewards, damage, timings and other relevant numerical outputs;
- proposed/persisted state transitions and emitted events;
- execution timing and performance telemetry suitable for Core comparison;
- whether persistence committed, rejected, conflicted, failed technically or was later compensated/reversed.

The replay-grade internal trace is not the Player Log. Player-facing logs remain knowledge-aware and privacy-filtered. Security secrets, authentication tokens, passwords and unrelated sensitive data must never be copied into replay records merely for completeness.

Historical scenarios should be taggable into reusable replay packs, including ordinary production traffic, high-value economy operations, PvP/combat, timers, edge cases, incidents, known bugs, exploit attempts, concurrency races and previously repaired/corrected outcomes.

A production bug that is fixed becomes a permanent regression scenario. A strange but valid edge case becomes a permanent compatibility scenario. A suspected exploit can become an adversarial scenario. The corpus should grow more valuable with the age of the game.

## Core-vNext historical comparison

A candidate Core may be evaluated against historical production traces in three distinct modes:

1. **Semantic-equivalence replay** - same gameplay rule/content versions and same controlled inputs. Core vNext is expected to produce the same authoritative game result and invariant-preserving transitions as the active Core, subject only to explicitly declared non-semantic representation differences.
2. **Intentional rule-evolution replay** - candidate Core executes a newer gameplay rule/formula version. Differences are expected only where the new rule specification says they should occur; all other divergence is investigated.
3. **Performance replay** - correctness is established first, then the same scenarios are used to compare evaluation latency, throughput, CPU cost, memory/allocation behaviour and other engine metrics without letting speed hide semantic regressions.

For each replay, the comparison tooling should classify:

- identical result;
- equivalent result with allowed representation differences;
- expected rule-version difference;
- unexplained semantic divergence;
- invariant violation;
- performance improvement/regression;
- replay impossible because required historical context is missing.

The final category is itself useful engineering evidence: it identifies logging/context gaps that should be fixed for future traces.

Correctness and invariants always outrank speed. A Core that is faster because it skipped a rule is not an upgrade; it is an optimized bug.

## Core replacement standard

A replacement Core is not accepted merely because it compiles.

Before switching, it must pass a Core Conformance Suite proving compatibility with the current public contracts and invariants.

At minimum the suite must test:

1. contract compatibility and version negotiation;
2. identical required authorization/authority boundaries;
3. deterministic golden scenarios for major rule domains;
4. command success/rejection/conflict semantics;
5. resource conservation/inventory/economy invariants;
6. event and transition contract compatibility;
7. time/cooldown semantics;
8. deterministic RNG behaviour where equivalence is required;
9. stale/concurrent state handling expectations;
10. no direct persistence/network/UI/auth dependencies;
11. no secret state owned only by the outgoing Core;
12. performance/regression thresholds appropriate to the candidate Core;
13. production-derived historical replay packs covering representative real gameplay, known incidents, prior bugs, edge cases and adversarial/exploit scenarios.

## Shadow comparison and cutover

For a substantial Core replacement, the preferred deployment model is:

1. keep current Core as active authority;
2. feed a safe sample/replay corpus of the same normalized inputs to Core vNext in shadow mode;
3. compare decisions, rule-version-aware expected differences, events and performance;
4. investigate unexplained divergence;
5. pass conformance and migration/cutover checks;
6. switch composition/configuration to Core vNext;
7. retain the previous compatible Core for immediate rollback during the defined release window.

Shadow mode must not double-commit state or emit duplicate authoritative effects. Only the active Core's result is authoritative until cutover.

## Compatibility rule

The key promise is:

> If a replacement Core implements the same compatible contracts and required rule semantics, surrounding Nexis systems must not require source changes merely because the Core implementation changed.

If a future design intentionally changes a public contract, that is a versioned contract migration, not an excuse to couple systems to Core internals.

## Explicit non-goals

- Core is not a generic `Shared` library;
- Core is not persistence;
- Core is not the API host;
- Core is not the scheduler;
- Core is not authentication/authorization storage;
- Core is not frontend/client state;
- Core is not a second copy of every system database;
- surrounding systems must not call concrete Core classes directly;
- Core must not read/write another system's private tables directly;
- replacing Core must not require replacing Combat/Economy/Inventory/Education/etc. implementations solely due to compile-time coupling.

## Architecture consequence

The earlier simplified dependency picture `feature modules -> Nexis.Core` is superseded.

The permanent model is contracts-first composition: independent systems and the selected rules engine meet through stable contracts, with Application/Host composition selecting concrete implementations.
