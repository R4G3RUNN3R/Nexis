# Nexis 2.0 Foundation Contract

_Status: initial implementation skeleton, corrected 2026-08-26 to reflect the first Core contract implementation slice._

## Dependency direction

Nexis is intentionally separated into replaceable capabilities. `Nexis.Core` is **not** the base library that all feature modules depend on.

The intended dependency shape is:

```text
Nexis.Host.Api / Nexis.Application
        |
        +--> selected Nexis.Core implementation
        +--> selected feature/system implementations
        +--> persistence/infrastructure adapters

Stable public contracts
        |
        +--> Nexis.Core.Contracts
        +--> Nexis.<System>.Contracts
        |
        v
Nexis.Kernel
```

Rules:

- `Nexis.Kernel` is the deliberately tiny universal substrate.
- public contracts are separated from implementations;
- surrounding systems may depend on `Nexis.Kernel`, their own public contract packages, and deliberately approved stable integration contracts;
- surrounding systems must **not** depend on the concrete `Nexis.Core` implementation;
- the concrete Core must not depend on surrounding system implementation classes or private persistence models;
- composition/application code selects and wires compatible implementations at runtime/build composition;
- replacing `Nexis.Core` with a newer implementation or even a different runtime must not require surrounding systems to be rewritten when the stable contracts remain compatible;
- domain/system projects must not reference the web host, EF Core, PostgreSQL drivers, Redis clients, Caddy concerns, SMTP, payment SDKs, filesystem adapters or frontend code unless they are explicitly infrastructure adapters.

The implementation skeleton now contains the initial `Nexis.Core.Contracts` split. `Nexis.Core` references that stable contract assembly rather than serving as the dependency base for surrounding systems. The first contract slice establishes versioned engine identity, typed intent/snapshot/owner-transition/event/result seams, authoritative evaluation context, controlled deterministic RNG input and a replaceable `ICoreRulesEngine` boundary. These contracts remain intentionally narrow and must be extended through owner-specific contract assemblies rather than by introducing a universal player-state payload.

## Kernel

`Nexis.Kernel` is intentionally tiny. It owns only genuinely universal identifiers/contracts such as authoritative time, deterministic randomness abstractions, command/event identity metadata and similarly cross-domain primitives. It must not become `Shared`, `Utils`, or any other junk drawer wearing a respectable hat.

Every meaningful domain event carries:

- immutable event ID;
- authoritative UTC occurrence time;
- correlation ID;
- optional causation event ID;
- schema version.

## Core

`Nexis.Core` is the replaceable authoritative **rules, logic and calculation machine** of Nexis.

Core owns the executable meaning of gameplay rules: calculations, formula execution, prerequisite evaluation, legal/illegal transition decisions, resource-cost/result calculations, deterministic RNG consumption, time/cooldown rule evaluation, and composition of rules that need trusted snapshots from more than one system.

Core does **not** own the database, UI, API transport, scheduler, authentication provider, persistence implementation, external integrations or private system state stores. Surrounding systems provide trusted state/content through stable contracts and persist the authoritative transition produced by Core through the approved application/transaction boundary.

Domain-specific rules may be organized inside Core by areas such as Combat, Economy, Travel, Education, Magic or Organizations. Their existence inside the rules engine does not permit surrounding systems to reference concrete Core classes.

A future `Nexis.Core vNext`, Rust/Go/C++ implementation, separate process, or other superior engine may replace the current Core behind compatible contracts. Given the same compatible state/content/contracts and required rule versions, the surrounding Nexis systems must continue operating without source changes.

Core replacement therefore means replacing the rules machine, not rebuilding the game around a new foundation.

The binding detailed specification is `v2/docs/CORE-ARCHITECTURE.md`.

## Surrounding feature/system modules

Each surrounding system is an independently understandable, testable and replaceable capability with one authoritative owner for its persistent state and external system responsibilities.

Implemented foundation capabilities prove the pattern:

- `Nexis.Identity.Contracts` and `Nexis.Modules.Identity` separate stable identity/authorization vocabulary from implementation policy.
- `Nexis.Audit.Contracts` and `Nexis.Modules.Audit` separate immutable privileged-action contracts from the replaceable audit implementation.
- `Nexis.History.Contracts` and `Nexis.History.Projection` separate safe Player Log contracts from a fail-closed, rebuildable projection implementation; neither project owns current gameplay state or persistence.

Later systems should follow the same pattern, including Education, Knowledge, Research, Economy, Contracts, World, Organizations, Combat, Magic and Spirits.

Systems own their persistent state, state-loading/snapshot boundaries, projections, persistence adapters and external interfaces. They hand immutable trusted inputs to Core and consume authoritative decisions/transitions from Core through stable contracts. They do not read another system's private tables/classes and do not embed irreplaceable dependencies on Core internals.

## Audit invariant

All meaningful administrator activity is internally auditable. Privileged reads, moderation investigations and anti-cheat inspections remain internal. Admin/system actions that materially change or affect a player's authoritative game state may be projected into that player's log with a safe explanation, while sensitive staff notes/signals remain internal.

## Host and application composition

`Nexis.Host.Api` is composition and transport, not the game. It may wire selected Core, system and infrastructure implementations but must not contain authoritative gameplay rules.

`Nexis.Application`/composition owns wiring and orchestration across compatible contracts. It loads/coordinates trusted system state, invokes the selected Core rules engine, and coordinates persistence of accepted transitions. It must not turn into a second rules engine or hard-code one concrete Core implementation as an irreplaceable dependency.

## Persistence

PostgreSQL persistence adapters now exist behind stable contracts for command receipts, owner transitions, authoritative events, outbox, Admin Audit and generic projection checkpoints. Those adapters remain private infrastructure and do not shape Core, owner or Player Log public contracts. Authoritative history is append-oriented, and corrections use new compensating/corrective events rather than mutation of history. Player Log storage and runtime consumer wiring are not introduced by the current History projection slice.

Persistence adapters implement storage concerns behind contracts and must remain replaceable without leaking EF Core/Npgsql types into Core or system public boundaries.

## Testing gate

Before broad gameplay systems are implemented, architecture tests must enforce at minimum:

- `Nexis.Kernel` has no dependency on Core, systems or infrastructure;
- system implementations do not reference concrete `Nexis.Core`;
- concrete `Nexis.Core` does not reference system implementation/private persistence assemblies;
- Core/system public contract packages do not reference their implementation assemblies;
- the API/Application composition layer is the place where implementations are selected;
- a replacement/fake Core can be composed with surrounding systems without changing those systems;
- Core conformance/golden tests prove compatible rule semantics before replacement;
- infrastructure dependencies do not leak into domain/public contracts;
- authorization, audit visibility and Hennet public/private projection boundaries remain enforced.

The architecture-test project contains executable dependency, replaceability, ownership, authorization, audit and Player Log projection checks. Current verification evidence is recorded in `IMPLEMENTATION-STATUS.md`; every dependent slice must rerun the full workflow.

## Migration boundary

The existing Nexis application and database remain the reference source during the parallel rebuild. No v2 code may silently mutate the live v1 schema. Migration tooling must be explicit, repeatable, auditable and reconcilable.
