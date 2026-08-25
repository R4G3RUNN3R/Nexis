# Nexis 2.0 Agent Handoff

_Status: foundation branch ready for build verification and continued implementation._

## Working branch

`feature/nexis-v2-foundation-skeleton`

The existing/current Nexis application outside `v2/` is reference material and must remain untouched unless a task explicitly concerns preservation analysis or migration tooling.

## Canonical engineering instructions

All coding agents and human engineers use the same canonical working rules:

- `v2/docs/ENGINEERING-MANUAL.md` - universal workflow, quality bar, security, multi-agent rules, testing, documentation, Git/deployment discipline and Definition of Done.
- `v2/docs/WORK-ORDER-TEMPLATE.md` - standard task packet so Claude, Codex and other agents receive the same objective, scope, owners, contracts, acceptance criteria and verification requirements.
- `v2/AGENTS.md` - short Codex/agent entrypoint into the canonical docs.
- `v2/CLAUDE.md` - Claude Code adapter importing the same canonical docs.

Model-specific entry files must never become alternative rulebooks. Provider/model choice may change tools or parallelism, not Nexis architecture or the quality bar.

## Binding design documents

Before implementing foundation code, read and preserve:

- `v2/docs/FOUNDATION.md`
- `v2/docs/CORE-ARCHITECTURE.md`
- `v2/docs/STATE-OWNERSHIP.md`
- `v2/docs/CORE-RELEASE-GATE.md`
- `v2/docs/COMPONENT-RELEASE-GATE.md`
- `v2/docs/COMMAND-EXECUTION.md`
- `v2/docs/IDENTITY-AUTHORIZATION.md`

### Precedence

`ENGINEERING-MANUAL.md` is the binding universal working policy. It does not replace specialized architecture documents; it requires every agent to obey them consistently.

`CORE-ARCHITECTURE.md` is the binding definition of Core. `Nexis.Core` is the authoritative rules, logic and calculation machine while remaining independently replaceable behind stable versioned contracts.

`STATE-OWNERSHIP.md` is the binding definition of persistent state/data ownership. It supersedes older examples that imply a system may own another system's facts, static content that belongs to Content Registry, or a global mutable `PlayerState`/`RuntimeState`/qualities/counters container. The permanent rule is one state concept, one authoritative write owner.

`COMMAND-EXECUTION.md` defines how Application loads current owner snapshots, invokes the selected Core, coordinates concurrency/transactions and routes typed transitions to authoritative owners. It has been reconciled with Core and State Ownership; do not recreate the older model where an owning module both contains all gameplay rules and mutates shared player state.

`IDENTITY-AUTHORIZATION.md` is the approved identity/security boundary. Preserve Account/Character separation, one playable character per normal account initially, immutable public player identity, capability/policy-based staff authorization, entitlement separation and the prohibition on character-name/client-state privilege.

`CORE-RELEASE-GATE.md` is the Core-specific proving policy. Candidate Core builds require production-derived replay, deterministic conformance, diverse AI adversarial testing, independent Voidsmith staff manual testing, a fresh production-like isolated environment, at least 30 days of exact-build soak, human sign-off and rollback readiness.

`COMPONENT-RELEASE-GATE.md` generalizes the same discipline to every material Nexis component replacement/version upgrade. Never treat Core as the only moving part requiring proof. Emergency hotfixes/ordinary low-risk maintenance are a separate release class, not a loophole for calling an upgrade a patch.

If wording in an older document conflicts with a newer binding ownership/Core decision, stop and reconcile the documents rather than choosing whichever sentence is convenient.

## First actions for Claude Code / Codex

1. Read `v2/docs/ENGINEERING-MANUAL.md` and the current Work Order/task packet before editing.
2. Verify the available .NET SDK with `dotnet --info`.
3. Restore `v2/Nexis.slnx`.
4. Build the complete solution with warnings treated as errors.
5. If the pinned SDK policy cannot be satisfied, fix the environment or deliberately update `global.json`; do not silently retarget the engine.
6. Convert `Nexis.Architecture.Tests` from a placeholder into a real automated test project using an approved current .NET test stack.
7. Add dependency/ownership architecture tests before adding gameplay systems.
8. Split stable engine-facing public contracts from the concrete `Nexis.Core` implementation before surrounding systems integrate against Core behaviour.
9. Split `Nexis.Identity.Contracts` from Identity implementation before broad integration.
10. Establish typed owner snapshot/transition contract seams required by `STATE-OWNERSHIP.md`; do not create a universal PlayerSnapshot/PlayerState.
11. Add a Core conformance-test seam so a fake/replacement Core can be composed without changing surrounding systems.
12. Implement command identity/execution-lane/concurrency/transaction/idempotency behaviour exactly through the reconciled `COMMAND-EXECUTION.md` model.
13. Prove one deliberately multi-owner vertical scenario end-to-end before broad feature fan-out.

## Required architecture tests

Prove at minimum that:

- `Nexis.Kernel` does not depend on other Nexis projects or infrastructure libraries;
- stable Core/system contract packages do not depend on concrete implementations;
- surrounding system implementations do not reference concrete `Nexis.Core`;
- concrete `Nexis.Core` does not reference private system persistence/implementation assemblies;
- a replacement/fake Core can be composed without modifying surrounding systems;
- a replacement/fake authoritative owner can satisfy its contract without consumer source changes;
- public contracts contain no EF Core/Npgsql/HTTP/frontend implementation types;
- API/Application contains composition/transport/orchestration only and not gameplay formulas;
- Application/Host cannot directly write owner-private tables;
- Core evaluates deterministic scenarios from normalized typed snapshots/context without reaching into owner databases;
- no global authoritative `PlayerState`, `RuntimeState`, `CharacterState`, generic qualities or counters write model exists;
- Inventory is the sole authoritative item-ownership writer;
- Economy is the sole authoritative currency-balance writer;
- Travel is the sole authoritative current-location/journey writer;
- Resources is the sole authoritative resource-bar writer;
- Equipment cannot create/delete item ownership;
- Marketplace/Guilds/Consortiums cannot directly mutate Economy/Inventory state;
- Combat cannot become the owner of base stats, HP/Mana/Energy or equipment ownership;
- Hospital cannot become the owner of Life/resource bars or cooldown state;
- Scheduler/background workers cannot update gameplay tables directly;
- CIEL cannot directly mutate unrelated gameplay owner state;
- projections/read models cannot mutate authoritative owner state;
- client DTOs are not reused as trusted persistence entities;
- no authorization decision grants privilege from character name, title or client-supplied role state;
- Account/platform capabilities, gameplay-domain roles and commercial entitlements remain separate;
- a multi-owner command proves full atomic rollback when any participating transition cannot commit.

## Next foundation slices

After the solution is green, proceed in this order.

### 1. Core contracts + ownership contracts + command execution + identity/security

- introduce stable `Nexis.Core.Contracts` or equivalent engine-facing contract boundary;
- keep concrete Core out of surrounding-system compile-time dependencies;
- represent immutable trusted owner snapshots and owner-addressed transition results without persistence types;
- establish deterministic authoritative time/RNG seams;
- create Core conformance/golden-scenario harness;
- preserve universal CommandId/CorrelationId primitives only where genuinely cross-domain;
- implement trusted ActorContext construction and capability/policy authorization;
- preserve permanent AccountId/CharacterId separation and one playable character per normal account initially;
- preserve immutable public player identity independent of display name;
- build Identity contracts/implementation split;
- prohibit global mutable player blobs, qualities/counters dumping grounds and generic path/value mutation;
- prove Hennet public/private projection boundary;
- prove client payloads cannot supply/escalate actor/account/role authority.

### 2. History/event/audit + command lifecycle

- event envelope/factory using authoritative game time;
- append-only authoritative ledger abstraction;
- command receipt/terminal-outcome contracts tied to CommandId;
- replay-grade trace/snapshot reference seams;
- Admin Audit writer abstraction;
- Player Log projection contracts;
- knowledge-aware visibility/filtering;
- compensating/corrective events instead of history mutation;
- durable outbox and idempotent post-commit consumers.

### 3. Persistence/concurrency boundary

- introduce persistence projects/adapters outside Core/public contracts;
- PostgreSQL remains planned primary store;
- each authoritative owner gets private persistence boundaries; no foreign owner direct-table writes;
- implement owner revisions, command receipts/idempotency state, transaction coordination, locking, outbox and retry classification;
- optimistic concurrency by default and selective ordered locks for contested/high-value operations;
- bounded whole-transaction retry for retryable PostgreSQL concurrency failures;
- no EF/Npgsql/auth-provider-specific types in public contracts;
- Core must never require a private duplicate gameplay datastore;
- no v2 persistence code may alter the live v1 database.

### 4. Ownership proof vertical slice

Before broad gameplay implementation, prove the full architecture with a narrow set:

1. Core contract and selected Core implementation seam;
2. Identity contract/implementation split;
3. Application command transaction boundary;
4. History/Event/Audit foundation;
5. Progression contracts;
6. Resources contracts;
7. Economy contracts;
8. Inventory contracts;
9. Equipment contracts;
10. one multi-owner scenario such as EquipItem or a synthetic purchase demonstrating snapshots -> Core -> typed transitions -> atomic owner persistence -> events/outbox -> projection.

### 5. Migration harness foundation

- read-only v1 source export contract;
- versioned manifest/checksums/counts;
- explicit transforms from v1 broad runtime/player state into owner-specific v2 state;
- anomaly reporting for duplicated/conflicting v1 fields;
- repeatable reconciliation against disposable v2 databases;
- no `misc` bucket for fields without a clear owner.

## Stop conditions

Do not begin broad Education, Combat, Economy, Magic, Spirits, World, Travel, Marketplace, Guild or Consortium implementation until:

- solution restores/builds cleanly;
- dependency and ownership architecture tests exist and pass;
- Core public contracts are separated from concrete Core;
- owner snapshot/transition boundaries are represented without a universal player blob;
- surrounding systems are demonstrably independent of concrete Core and foreign private persistence;
- Core conformance/golden-scenario harness exists;
- Identity/Hennet security tests pass;
- Account/Character/public-identity and capability boundaries are represented/tested;
- command identity/execution-lane/idempotency boundaries are represented/tested;
- one atomic multi-owner vertical scenario passes, including rollback-on-failure;
- event/audit/history primitives have stable contracts;
- persistence/concurrency is isolated behind adapters;
- Scheduler and CIEL bypass protections are testable.

## Permanent constraints

- all engineering agents, regardless of provider/model, use the same `ENGINEERING-MANUAL.md`, architecture documents, Work Order requirements and Definition of Done;
- any sub-agent receives the same parent constraints and may not invent a different architecture/quality bar;
- C#/.NET is the current primary authoritative engine implementation, not a requirement for every future client/specialist subsystem;
- `Nexis.Core` is the authoritative rules, logic and calculation machine;
- concrete Core is replaceable behind stable contracts;
- surrounding systems own persistent facts/data/interfaces; Core evaluates rules and returns typed decisions/transitions;
- one authoritative write owner exists for each persistent state concept;
- no global writable PlayerState/RuntimeState/qualities/counters aggregate is permitted;
- Core owns no hidden duplicate authoritative gameplay database;
- Inventory alone owns item ownership; Economy alone owns currency; Travel alone owns current location/journey; Resources alone owns resource bars;
- Equipment owns slot placement but not items; Marketplace owns listings but not money/items; Combat owns encounters but not HP/base stats/equipment; Hospital owns hospitalization but not Life/cooldowns; Guilds/Consortiums own governance/business state but not money/items;
- Content Registry owns versioned static content definitions; player unlock/progress remains with its gameplay owner;
- public profiles, dashboards, Player Log, leaderboards, search and admin dossiers are projections, not write owners;
- global action availability is computed by Core from current relevant owner snapshots, not persisted as one universal condition flag;
- cross-owner operations are explicitly orchestrated and atomic where the gameplay promise requires it;
- all authoritative mutations enter an approved lane, are evaluated by selected Core and persisted by authoritative owners;
- read-only queries cannot become mutations through payload fields;
- command identity/idempotency and current-state revalidation are mandatory;
- concurrency is hybrid: optimistic by default, selective deterministic locking/constraints for contested resources;
- successful required state + command outcome + events/outbox commit atomically;
- authoritative history is append-oriented and immutable in normal operation;
- Player Log remains knowledge-aware projection, not raw audit;
- all meaningful privileged admin activity is internally auditable;
- material component upgrades follow the Universal Component Release Gate: brand-new production-like isolated environment, deterministic automation, diverse AI testing, independent Voidsmith human testing in parallel, cross-reproduction, minimum 30-day exact-build soak and rollback readiness;
- AI never runs all tests and never has sole release authority;
- no secrets belong in source control or documentation.
