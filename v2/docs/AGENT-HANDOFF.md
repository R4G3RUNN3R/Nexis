# Nexis 2.0 Agent Handoff

_Status: foundation branch ready for build verification and continued implementation._

## Working branch

`feature/nexis-v2-foundation-skeleton`

The existing/current Nexis application outside `v2/` is reference material and must remain untouched unless a task explicitly concerns preservation analysis or migration tooling.

## Binding design documents

Before implementing foundation code, read and preserve:

- `v2/docs/FOUNDATION.md`
- `v2/docs/CORE-ARCHITECTURE.md`
- `v2/docs/COMMAND-EXECUTION.md`
- `v2/docs/IDENTITY-AUTHORIZATION.md`

`CORE-ARCHITECTURE.md` is the binding definition of Core. `Nexis.Core` is the authoritative rules, logic and calculation machine, while remaining independently replaceable behind stable versioned contracts. Surrounding systems own persistent state/data/interfaces and must never compile against concrete Core internals. If older wording in another foundation document implies that gameplay rules belong to surrounding module implementations, `CORE-ARCHITECTURE.md` supersedes that wording.

`COMMAND-EXECUTION.md` is the approved authoritative mutation/concurrency design. Preserve its execution lanes, idempotency, server authority, transaction and concurrency rules, but interpret domain rule evaluation through the Core boundary defined by `CORE-ARCHITECTURE.md`.

`IDENTITY-AUTHORIZATION.md` is the approved identity/security boundary. Preserve Account/Character separation, the initial one-playable-character-per-account policy, immutable public player identity, capability/policy-based staff authorization, entitlement separation, and the prohibition on character-name/client-state privilege.

## First actions for Claude Code / Codex

1. Verify the available .NET SDK with `dotnet --info`.
2. Restore `v2/Nexis.slnx`.
3. Build the complete solution with warnings treated as errors.
4. If the pinned SDK policy cannot be satisfied, fix the environment or deliberately update `global.json`; do not silently retarget the engine.
5. Convert `Nexis.Architecture.Tests` from a placeholder into a real automated test project using an approved, current .NET test stack.
6. Add dependency-boundary tests before adding gameplay systems.
7. Split stable engine-facing public contracts from the concrete `Nexis.Core` implementation before surrounding systems integrate against Core behavior. The current skeleton has not completed this contracts/implementation split yet.
8. Add a Core conformance-test seam so a fake/replacement Core can be composed without changing surrounding systems.
9. Read `v2/docs/COMMAND-EXECUTION.md` and implement foundation work against its command identity, execution-lane, concurrency, transaction and idempotency constraints rather than inventing a separate request model.
10. Read `v2/docs/IDENTITY-AUTHORIZATION.md` before changing the current placeholder Identity contracts; split public Identity contracts from implementation rather than allowing the placeholder module assembly to become the permanent integration boundary.

## Required architecture tests

Prove at minimum that:

- `Nexis.Kernel` does not depend on other Nexis projects or infrastructure libraries;
- stable Core/system contract packages do not depend on their concrete implementations;
- surrounding system implementations do **not** reference concrete `Nexis.Core`;
- concrete `Nexis.Core` does **not** reference surrounding system implementation/private persistence assemblies;
- a replacement/fake Core implementation can be composed with surrounding systems without modifying those systems;
- surrounding systems do not reference the API host or concrete persistence/network implementations except through designated adapters;
- the API/Application layer contains composition/transport/orchestration only and does not become a second rules engine;
- Core can evaluate deterministic golden scenarios from normalized snapshots/context without reaching directly into system databases;
- no authorization decision grants privilege from character name, display name, title or client-supplied role state;
- query paths cannot mutate authoritative state;
- background/system workers cannot bypass the command/Core/system boundary to write authoritative game state directly;
- account/platform capabilities, gameplay-domain roles and commercial entitlements remain separate authorization concepts.

## Next foundation slices

After the solution is green, proceed in this order:

1. **Core-contract separation + conformance + command execution + identity/security foundation**
   - introduce the stable public engine-facing contract boundary required to replace `Nexis.Core` independently;
   - keep concrete Core out of surrounding-system compile-time dependencies;
   - represent normalized trusted state snapshots/inputs and authoritative transition/results without leaking persistence types;
   - establish deterministic time/RNG seams required by Core;
   - create a Core conformance/golden-scenario test harness and prove a fake/replacement engine can be substituted;
   - universal command identity/correlation primitives only where genuinely cross-domain;
   - authenticated account context and trusted actor-context construction;
   - explicit authorization policy/capability contracts rather than ordinal-role privilege checks;
   - permanent AccountId/CharacterId separation while enforcing one playable character per normal account initially;
   - immutable public player identity independent of mutable display name;
   - system-owned typed state/content contracts rather than one global mutable player blob;
   - split `Nexis.Identity.Contracts` from Identity implementation before broad integration;
   - execution-lane orchestration without gameplay formulas in Application/Host;
   - Hennet public/private server-generated profile projection boundary;
   - tests proving unauthorized callers never receive private Hennet/admin fields;
   - tests proving client payloads cannot supply or escalate actor/account/role authority;
   - tests proving guild/consortium roles and commercial entitlements cannot become platform admin privilege.

2. **Event/audit + command lifecycle foundation**
   - event envelope/factory using `IGameClock`;
   - append-only ledger abstraction;
   - command receipt/terminal-outcome contracts tied to stable CommandId;
   - admin audit writer abstraction;
   - player-log projection contracts;
   - knowledge-aware visibility/filtering seams;
   - compensating/corrective event contract rather than history mutation;
   - duplicate-command behavior defined by the approved command-execution document.

3. **Persistence/concurrency boundary**
   - introduce persistence projects/adapters outside Core/systems;
   - PostgreSQL remains the planned primary store;
   - implement idempotency registry/receipt persistence, transaction boundaries and durable outbox behind abstractions;
   - use optimistic revisions by default and selective ordered locks for contested/high-value mutations as defined in `COMMAND-EXECUTION.md`;
   - provide bounded whole-transaction retry classification for retryable PostgreSQL concurrency failures;
   - external auth-provider mappings attach to AccountId behind infrastructure adapters and never become game-domain identity;
   - do not expose EF Core/Npgsql/auth-provider-specific types through public contracts;
   - Core must never require a private hidden database containing duplicate authoritative truth;
   - no v2 persistence code may alter the live v1 database.

4. **Migration harness foundation**
   - read-only source export contract;
   - versioned manifest/checksums/counts;
   - explicit transforms;
   - anomaly reporting;
   - repeatable reconciliation against disposable v2 databases.

## Stop conditions

Do not begin broad Education, Combat, Economy, Magic, Spirit, World or Organization implementation until:

- the solution builds cleanly;
- dependency architecture tests exist and pass;
- Core public contracts are separated from the concrete Core implementation;
- surrounding systems can be proven independent of concrete Core;
- a Core conformance/golden-scenario harness exists;
- identity/Hennet projection security tests exist and pass;
- Account/Character/public-identity boundaries and capability authorization are represented and tested;
- command identity/execution-lane boundaries are represented and tested;
- duplicate command execution is demonstrably prevented at the foundation level;
- event/audit primitives have stable contracts;
- persistence/concurrency behavior is isolated behind adapters rather than leaking into Core or public contracts.

## Permanent constraints

- C#/.NET is the primary current authoritative engine implementation, not a permanent dependency that every feature/client/specialist subsystem must share;
- `Nexis.Core` is the authoritative rules, logic and calculation machine;
- the concrete `Nexis.Core` implementation is replaceable; surrounding systems depend on stable contracts, never Core internals;
- replacing Core with `Core vNext`, another runtime or a separate service must not require surrounding-system rewrites while contracts/rule versions remain compatible;
- surrounding systems own persistent state/data/interfaces; Core evaluates rules and returns authoritative decisions/transitions;
- Core must not own a hidden duplicate database that makes replacement require state reconstruction;
- one authoritative owner exists for each persistent game-state domain;
- Account is the authentication/security/entitlement principal; Character is the in-world gameplay identity; the two identifiers are never collapsed even while the initial product permits one playable character per account;
- public player identity is stable and separate from mutable display name/internal account identity;
- staff privilege is evaluated through trusted server-side capabilities/policies, not names, client claims or ordinal role comparisons;
- in-world guild/consortium/job roles remain domain authorization, not platform RBAC;
- cross-system interaction uses stable contracts, normalized snapshots/value objects, orchestration and domain events rather than concrete implementation coupling;
- all authoritative state mutations enter through an approved execution lane, are evaluated by the selected Core rules engine, and are persisted through the owning systems;
- read-only queries use a separate path and cannot become mutations through supplied payload fields;
- meaningful commands/actions resolve through the selected authoritative engine implementation, not client state;
- commands use stable identity/idempotency protection and current authoritative state is revalidated at execution time;
- concurrency is hybrid: optimistic by default, selective deterministic locking/atomic constraints for contested resources;
- state + durable events/outbox commit atomically for successful durable commands;
- authoritative history is append-oriented and immutable in normal operation;
- player-facing history is a knowledge-aware projection, never the raw internal audit stream;
- all meaningful privileged admin activity remains internally auditable;
- only material admin/system effects on a player are eligible for that player's visible log;
- no secrets belong in source control or documentation.
