# Nexis 2.0 Foundation Contract

_Status: initial implementation skeleton, corrected 2026-08-25 to enforce Core replaceability._

## Dependency direction

Nexis is intentionally separated into replaceable capabilities. `Nexis.Core` is **not** the base library that all feature modules depend on.

The intended dependency shape is:

```text
Nexis.Host.Api / Nexis.Application
        |
        +--> selected Nexis.Core implementation
        +--> selected feature-module implementations
        +--> persistence/infrastructure adapters

Stable public contracts
        |
        +--> Nexis.Core.Contracts
        +--> Nexis.<Module>.Contracts
        |
        v
Nexis.Kernel
```

Rules:

- `Nexis.Kernel` is the deliberately tiny universal substrate.
- public contracts are separated from implementations;
- feature modules may depend on `Nexis.Kernel`, their own public contract packages, and deliberately approved stable integration contracts;
- feature modules must **not** depend on the concrete `Nexis.Core` implementation;
- `Nexis.Core` must not depend on concrete feature-module implementations;
- composition/application code selects and wires compatible implementations at runtime/build composition;
- replacing `Nexis.Core` with a newer implementation or even a different runtime must not require feature modules to be rewritten when the stable contracts remain compatible;
- domain projects must not reference the web host, EF Core, PostgreSQL drivers, Redis clients, Caddy concerns, SMTP, payment SDKs, filesystem adapters or frontend code.

The implementation skeleton does not yet contain the final `Nexis.Core.Contracts` split. That split is a foundation requirement before broad gameplay modules are allowed to integrate against Core.

## Kernel

`Nexis.Kernel` is intentionally tiny. It owns only genuinely universal identifiers/contracts such as authoritative time, deterministic randomness abstractions, command/event identity metadata and similarly cross-domain primitives. It must not become `Shared`, `Utils`, or any other junk drawer wearing a respectable hat.

Every meaningful domain event carries:

- immutable event ID;
- authoritative UTC occurrence time;
- correlation ID;
- optional causation event ID;
- schema version.

## Core

`Nexis.Core` is a **replaceable authoritative engine/runtime capability**, not the owner of every game's feature logic and not a mandatory compile-time parent of the modules.

Its implementation may provide engine-level concerns such as standardized command execution, deterministic orchestration, global policy composition and other cross-cutting runtime behavior defined by stable contracts. It must not absorb Combat, Items, Economy, Education, Travel, Organizations, Magic or other feature-specific rules merely because those features execute through the engine.

A future `Nexis.Core vNext`, Rust/Go/C++ implementation, separate process, or other superior engine may replace the current Core implementation behind compatible contracts. The rest of Nexis must continue operating without source changes unless a contract itself is deliberately versioned or replaced.

Core replacement therefore means replacing an implementation, not rebuilding the game around a new foundation.

## Feature modules

Each feature is an independently understandable, testable and replaceable capability with one authoritative owner for its state.

Initial modules prove the pattern:

- `Nexis.Modules.Identity`: current placeholder implementation for account/character identity and authorization vocabulary. This is planned to split into stable Identity contracts plus implementation before broad integration.
- `Nexis.Modules.Audit`: current placeholder implementation for append-oriented privileged-action audit vocabulary and the approved internal-vs-player visibility boundary. It should follow the same contracts/implementation split.

Later modules should follow the same pattern, including Education, Knowledge, Research, Economy, Contracts, World, Organizations, Combat, Magic and Spirits.

Modules interact through stable contracts, prepared snapshots/value objects, application orchestration and domain events. They do not read another module's private tables or concrete classes.

## Audit invariant

All meaningful administrator activity is internally auditable. Privileged reads, moderation investigations and anti-cheat inspections remain internal. Admin/system actions that materially change or affect a player's authoritative game state may be projected into that player's log with a safe explanation, while sensitive staff notes/signals remain internal.

## Host and application composition

`Nexis.Host.Api` is composition and transport, not the game. It may wire selected Core, module and infrastructure implementations but must not contain authoritative gameplay rules.

`Nexis.Application`/composition owns wiring and orchestration across compatible contracts. It must not turn into a second domain layer or hard-code one concrete Core implementation as an irreplaceable dependency.

## Persistence

Persistence implementation is deliberately not added in this first skeleton. PostgreSQL remains the planned primary datastore, but domain contracts are being established before persistence technology is allowed to shape them. Event/audit storage will be append-oriented and corrections will use new compensating/corrective events rather than mutation of history.

Persistence adapters implement storage concerns behind contracts and must remain replaceable without leaking EF Core/Npgsql types into Core or feature-module public boundaries.

## Testing gate

Before gameplay modules are implemented, architecture tests must enforce at minimum:

- `Nexis.Kernel` has no dependency on Core, modules or infrastructure;
- feature-module implementations do not reference concrete `Nexis.Core`;
- `Nexis.Core` does not reference concrete feature-module implementations;
- Core/module public contract packages do not reference their implementation assemblies;
- the API/Application composition layer is the place where implementations are selected;
- a test replacement/fake Core can be composed with feature modules without changing those modules;
- infrastructure dependencies do not leak into domain/public contracts;
- authorization, audit visibility and Hennet public/private projection boundaries remain enforced.

## Migration boundary

The existing Nexis application and database remain the reference source during the parallel rebuild. No v2 code may silently mutate the live v1 schema. Migration tooling must be explicit, repeatable, auditable and reconcilable.
