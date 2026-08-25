# Nexis 2.0 Agent Handoff

_Status: foundation branch ready for build verification and continued implementation._

## Working branch

`feature/nexis-v2-foundation-skeleton`

The existing/current Nexis application outside `v2/` is reference material and must remain untouched unless a task explicitly concerns preservation analysis or migration tooling.

## First actions for Claude Code / Codex

1. Verify the available .NET SDK with `dotnet --info`.
2. Restore `v2/Nexis.slnx`.
3. Build the complete solution with warnings treated as errors.
4. If the pinned SDK policy cannot be satisfied, fix the environment or deliberately update `global.json`; do not silently retarget the engine.
5. Convert `Nexis.Architecture.Tests` from a placeholder into a real automated test project using an approved, current .NET test stack.
6. Add dependency-boundary tests before adding gameplay modules.

## Required architecture tests

Prove at minimum that:

- `Nexis.Kernel` does not depend on other Nexis projects or infrastructure libraries.
- `Nexis.Core` depends only on `Nexis.Kernel` and approved BCL/runtime libraries.
- feature modules do not reference the API host or concrete persistence/network implementations.
- the API host contains composition/transport only and does not become the owner of gameplay rules.
- no authorization decision grants privilege from character name, display name, title or client-supplied role state.

## Next foundation slices

After the solution is green, proceed in this order:

1. **Identity/security projection foundation**
   - authenticated account context;
   - explicit authorization policy contracts;
   - Hennet public/private server-generated profile projection boundary;
   - tests proving unauthorized callers never receive private Hennet/admin fields.

2. **Event/audit foundation**
   - event envelope/factory using `IGameClock`;
   - append-only ledger abstraction;
   - admin audit writer abstraction;
   - player-log projection contracts;
   - knowledge-aware visibility/filtering seams;
   - compensating/corrective event contract rather than history mutation.

3. **Persistence boundary**
   - introduce persistence projects/adapters outside Core/modules;
   - PostgreSQL remains the planned primary store;
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
- event/audit primitives have stable contracts;
- persistence direction is represented by adapters rather than leaking into the domain.

## Permanent constraints

- C#/.NET is the primary authoritative engine implementation, not a requirement that every future client or specialist subsystem use C#.
- one authoritative owner exists for each game-state domain;
- cross-domain interaction uses stable contracts, orchestration, snapshots/value objects or domain events rather than concrete implementation coupling;
- meaningful commands/actions resolve through the authoritative engine, not client state;
- authoritative history is append-oriented and immutable in normal operation;
- player-facing history is a knowledge-aware projection, never the raw internal audit stream;
- all meaningful privileged admin activity remains internally auditable;
- only material admin/system effects on a player are eligible for that player's visible log;
- no secrets belong in source control or documentation.
