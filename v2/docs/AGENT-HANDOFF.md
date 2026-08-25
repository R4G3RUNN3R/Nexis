# Nexis 2.0 Agent Handoff

_Status: foundation branch ready for build verification and continued implementation._

## Working branch

`feature/nexis-v2-foundation-skeleton`

The existing/current Nexis application outside `v2/` is reference material and must remain untouched unless a task explicitly concerns preservation analysis or migration tooling.

## Binding design documents

Before implementing foundation code, read and preserve:

- `v2/docs/FOUNDATION.md`
- `v2/docs/COMMAND-EXECUTION.md`

`COMMAND-EXECUTION.md` is the approved authoritative mutation/concurrency design. Do not simplify it into one mega-handler, blanket optimistic concurrency, blanket locking, direct scheduler SQL writes, or client-authoritative state.

## First actions for Claude Code / Codex

1. Verify the available .NET SDK with `dotnet --info`.
2. Restore `v2/Nexis.slnx`.
3. Build the complete solution with warnings treated as errors.
4. If the pinned SDK policy cannot be satisfied, fix the environment or deliberately update `global.json`; do not silently retarget the engine.
5. Convert `Nexis.Architecture.Tests` from a placeholder into a real automated test project using an approved, current .NET test stack.
6. Add dependency-boundary tests before adding gameplay modules.
7. Read `v2/docs/COMMAND-EXECUTION.md` and implement foundation work against its command identity, execution-lane, concurrency, transaction and idempotency constraints rather than inventing a separate request model.

## Required architecture tests

Prove at minimum that:

- `Nexis.Kernel` does not depend on other Nexis projects or infrastructure libraries.
- `Nexis.Core` depends only on `Nexis.Kernel` and approved BCL/runtime libraries.
- feature modules do not reference the API host or concrete persistence/network implementations.
- the API host contains composition/transport only and does not become the owner of gameplay rules.
- no authorization decision grants privilege from character name, display name, title or client-supplied role state.
- query paths cannot mutate authoritative state.
- background/system workers cannot bypass the command/domain boundary to write authoritative game state directly.

## Next foundation slices

After the solution is green, proceed in this order:

1. **Command execution + identity/security foundation**
   - universal command identity/correlation primitives only where genuinely cross-domain;
   - authenticated account context and trusted actor-context construction;
   - explicit authorization policy contracts;
   - module-owned typed command contracts rather than one global gameplay command assembly;
   - execution-lane orchestration seams without domain gameplay rules in the dispatcher;
   - Hennet public/private server-generated profile projection boundary;
   - tests proving unauthorized callers never receive private Hennet/admin fields;
   - tests proving client payloads cannot supply or escalate actor/account/role authority.

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
   - introduce persistence projects/adapters outside Core/modules;
   - PostgreSQL remains the planned primary store;
   - implement idempotency registry/receipt persistence, transaction boundaries and durable outbox behind abstractions;
   - use optimistic revisions by default and selective ordered locks for contested/high-value mutations as defined in `COMMAND-EXECUTION.md`;
   - provide bounded whole-transaction retry classification for retryable PostgreSQL concurrency failures;
   - do not expose EF Core/Npgsql-specific types through domain contracts;
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
- identity/Hennet projection security tests exist and pass;
- command identity/execution-lane boundaries are represented and tested;
- duplicate command execution is demonstrably prevented at the foundation level;
- event/audit primitives have stable contracts;
- persistence/concurrency behavior is isolated behind adapters rather than leaking into the domain.

## Permanent constraints

- C#/.NET is the primary authoritative engine implementation, not a requirement that every future client or specialist subsystem use C#.
- one authoritative owner exists for each game-state domain;
- cross-domain interaction uses stable contracts, orchestration, snapshots/value objects or domain events rather than concrete implementation coupling;
- all authoritative state mutations enter through an approved execution lane and the owning domain module;
- read-only queries use a separate path and cannot become mutations through supplied payload fields;
- meaningful commands/actions resolve through the authoritative engine, not client state;
- commands use stable identity/idempotency protection and current authoritative state is revalidated at execution time;
- concurrency is hybrid: optimistic by default, selective deterministic locking/atomic constraints for contested resources;
- state + durable events/outbox commit atomically for successful durable commands;
- authoritative history is append-oriented and immutable in normal operation;
- player-facing history is a knowledge-aware projection, never the raw internal audit stream;
- all meaningful privileged admin activity remains internally auditable;
- only material admin/system effects on a player are eligible for that player's visible log;
- no secrets belong in source control or documentation.
