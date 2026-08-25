# Nexis 2.0 Engineering Instruction Manual

_Status: approved canonical engineering policy, 2026-08-25._

## Purpose

This is the single canonical working manual for every engineer or coding agent contributing to Nexis 2.0, including Claude Code, Codex, ChatGPT/OpenAI agents, Gemini, future model families, human developers, and any sub-agent/parallel worker they spawn.

The provider/model is not allowed to define its own Nexis architecture, quality bar, coding philosophy, release rules or interpretation of the task.

Agents may use different internal reasoning, tools, sub-agent counts or implementation tactics. Their output must still conform to the same architecture, contracts, ownership boundaries, security rules, Definition of Done and verification requirements in this manual and the binding design documents it references.

> Agents may differ in how they work. They may not differ in what Nexis is.

## Canonical instruction hierarchy

For Nexis 2.0 repository work, obey instructions in this order after platform/system safety instructions:

1. the human's explicit current task and scope;
2. this `ENGINEERING-MANUAL.md`;
3. the binding Nexis design documents listed below;
4. narrower approved task/specification documents;
5. existing implementation patterns that do not conflict with items 1-4;
6. agent preference/convention only when no project rule exists.

An agent must never use a convenient existing v1 pattern to override v2 architecture.

If two binding documents appear to contradict each other, do not choose the easier interpretation. Reconcile the contradiction or report it as a blocker before creating implementation gravity around one interpretation.

An AI agent cannot self-authorize an architecture change by editing this manual or a binding design document during an unrelated implementation task.

## Binding design documents

Every agent doing non-trivial v2 work must read the documents relevant to its task. Foundation or cross-system work requires all of them.

- `docs/FOUNDATION.md`
- `docs/CORE-ARCHITECTURE.md`
- `docs/STATE-OWNERSHIP.md`
- `docs/COMMAND-EXECUTION.md`
- `docs/IDENTITY-AUTHORIZATION.md`
- `docs/CORE-RELEASE-GATE.md`
- `docs/COMPONENT-RELEASE-GATE.md`
- `docs/AGENT-HANDOFF.md`

This manual governs workflow and implementation discipline. The listed documents govern the specialized architecture decisions.

## Permanent project identity

- Product: Nexis 2.0.
- Current authoritative engine implementation language/runtime: C# / .NET 10 (`net10.0`).
- Architecture: modular monolith first, with strong bounded ownership and replaceable components.
- Primary persistence direction: PostgreSQL, behind private persistence adapters.
- Current v2 work lives under `v2/` in parallel with the existing application.
- Existing/current application outside `v2/` is reference/migration source only unless the human explicitly asks for a v1/live change.
- Live production deployment is not implied by repository implementation work.

## Non-negotiable architecture

### Core

`Nexis.Core` is the authoritative rules, logic and calculation machine.

Core:

- receives immutable trusted typed snapshots/content/context;
- evaluates gameplay rules and formulas;
- performs deterministic calculations;
- evaluates prerequisites and legal transitions;
- consumes authoritative time and controlled RNG;
- returns typed authoritative outcomes and owner-addressed transition plans;
- remains independently replaceable behind stable contracts.

Core does not own databases, HTTP/API transport, schedulers, authentication providers, frontend state or a hidden duplicate copy of gameplay truth.

No surrounding system may compile against concrete Core internals.

### State ownership

Every persistent state concept has exactly one authoritative write owner.

Examples that are permanently binding unless deliberately superseded:

- Identity owns Account/Character/public identity and platform authority facts.
- Progression owns level/XP/base attributes.
- Resources owns Energy/Mana/Life/Nerve-style resource state.
- Cooldowns owns cooldown state.
- Inventory owns item instances/ownership/durability/enhancements.
- Equipment owns equipped-slot/loadout references, not item ownership.
- Economy owns currency balances/ledger/escrow.
- Marketplace owns listing lifecycle, not money/items.
- Travel owns current location/journey.
- Recovery/Hospital owns hospitalization, not Life or cooldowns.
- Justice owns jail/crime/custody state.
- Combat owns encounters, not base stats/resources/equipment ownership.
- Guilds/Consortiums own governance/business state, not currency/item ownership.
- Content Registry owns immutable/versioned static definitions.
- History/Replay owns authoritative evidence of what happened, not current gameplay truth.

There is no global authoritative `PlayerState`, `RuntimeState`, `CharacterState`, `player.current`, universal `condition`, generic counters/qualities dictionary or path/value patch mechanism.

### Application / command lanes

Application coordinates. It does not become a second rules engine.

For a mutation:

1. establish trusted actor/context and CommandId;
2. load current snapshots from the required authoritative owners;
3. resolve relevant versioned content/time/RNG context;
4. invoke selected Core;
5. apply concurrency/locking/revalidation as required;
6. route Core's typed transitions only to the authoritative owners they address;
7. commit required owner state + terminal command outcome + authoritative events + outbox atomically;
8. return authoritative projections/results.

No controller, worker, scheduler, CIEL workflow or admin UI writes gameplay tables directly.

### Clients

Clients submit intent and display authoritative results/projections.

Never trust client-submitted:

- balances;
- inventories;
- current stats/resources;
- timestamps for gameplay truth;
- RNG/results;
- role/admin/owner authority;
- ownership claims;
- current location/condition;
- calculated prices/rewards/damage.

## Replaceability rule

Every major Nexis moving part is designed so a compatible better implementation can replace it without collapsing unrelated systems.

An implementation task must not create unnecessary compile-time, persistence or runtime coupling that makes future replacement require rewriting consumers.

If the task can be implemented behind an existing stable contract, use the contract.

If a new public contract is necessary, design the narrowest stable contract that expresses the required behaviour without exposing implementation or persistence internals.

A component may be internally redesigned later. Consumers must not depend on those internals.

## Agent equality rule

No model/provider receives a lower quality bar or a different architectural interpretation.

Claude, Codex and any other agent must use:

- the same binding architecture;
- the same ownership map;
- the same coding/runtime constraints;
- the same testing expectations;
- the same security assumptions;
- the same Definition of Done;
- the same changelog/documentation policy;
- the same deployment prohibitions;
- the same review and verification standards.

A model-specific tool file may explain how that tool loads this manual. It must not introduce alternative project rules.

## Multi-agent / sub-agent policy

Agents may spawn or delegate to any reasonable number of sub-agents. Parallelism is encouraged where tasks are genuinely independent.

Every parent agent is responsible for ensuring every child agent receives and obeys this manual and the relevant binding documents.

### Required sub-agent task packet

Every delegated work unit must state at minimum:

- repository and branch/worktree;
- exact objective;
- allowed file/domain scope;
- explicit out-of-scope areas;
- relevant authoritative state owner(s);
- relevant Core/contract boundary;
- acceptance criteria;
- tests/checks required;
- whether schema/API/contract changes are allowed;
- deployment prohibition/permission;
- documentation/changelog expectation.

A child agent that does not know these things is not ready to modify code.

### Parallel editing rules

- Prefer independent files/domains per agent.
- Do not have multiple agents concurrently rewrite the same public contract, migration, central project file or architectural document without one designated integrator.
- Shared-contract changes are serialized through one owner/integrator and then consumed by parallel agents.
- Parent/integrator reviews every child result against the same Definition of Done before integration.
- Sub-agents cannot expand scope because they discovered an interesting adjacent redesign.
- A child agent may report a better architectural idea; it may not silently implement it when it changes an approved boundary.

There is no upper architectural limit on agent count. Coordination and rule consistency, not the number of agents, is the constraint.

## Task execution protocol

### Before editing

1. Confirm repository/branch/worktree and task scope.
2. Read this manual.
3. Read all relevant binding design documents.
4. Inspect the affected implementation and nearby tests/contracts.
5. Identify authoritative owners and Core responsibilities involved.
6. Identify cross-owner transaction/concurrency implications.
7. Check for existing patterns/contracts before inventing new ones.
8. Identify how completion will be verified.

Do not begin by scaffolding a replacement application, new architecture, new framework or alternate backend unless the task explicitly requests and approves that change.

### During implementation

- Make the smallest coherent change that fully satisfies the task and architecture.
- Prefer explicit typed code/contracts over generic dictionaries/reflection/dynamic state.
- Preserve component replaceability.
- Keep gameplay formulas/rule decisions inside selected Core, not Application/controllers/persistence.
- Keep persistent writes inside the authoritative owner.
- Re-evaluate current server state for mutations; never trust stale UI snapshots.
- Preserve idempotency/concurrency/history/event invariants.
- Add tests while implementing behaviour, not as an afterthought.
- If fixing a bug, create a reproduction/regression test where practical before or alongside the fix.
- Do not perform unrelated cleanup merely because the file is open.
- Do not change an approved public contract for local convenience.
- Do not silently add dependencies, services, databases, caches or queues that were not justified by the task.

### When a better design is discovered

A better internal implementation is welcome when it preserves approved behaviour/contracts and task scope.

If the improvement changes any of the following, stop implementation of that redesign and surface it as a proposal rather than silently applying it:

- authoritative state ownership;
- Core/system responsibility;
- public contract semantics;
- identity/authorization semantics;
- persistence source of truth;
- client/server authority;
- release/upgrade policy;
- runtime/framework/platform direction;
- cross-system transaction semantics;
- security boundary.

The quality floor is fixed. The architecture is not a playground for whichever model happens to be running today.

## No-rogue-rewrite rules

Unless explicitly requested and approved, an agent must not:

- create a second/alternate Nexis application;
- rewrite the project from scratch;
- replace C#/.NET with another runtime;
- split the modular monolith into microservices;
- introduce a second authoritative gameplay engine;
- create a giant Shared/Common/God project that absorbs domain logic;
- recreate a global mutable player-state blob;
- move ownership between domains;
- replace PostgreSQL direction with another authoritative store;
- introduce Redis/queues merely as fashionable infrastructure;
- change auth/identity semantics;
- expose Core/system internals through public APIs;
- touch/deploy live production because tests passed locally;
- merge/rebase/cherry-pick into production branches unless the human explicitly requested it.

If an approved task genuinely requires one of these, the task must state so explicitly and the relevant architecture documents must be updated deliberately.

## C# / .NET implementation standard

The existing `Directory.Build.props` is binding:

- target `net10.0`;
- nullable reference types enabled;
- implicit usings enabled;
- warnings treated as errors;
- deterministic builds.

Additional standards:

- Prefer clear immutable records/value objects for contracts/snapshots where appropriate.
- Use meaningful domain types/IDs rather than unvalidated primitive soup at public boundaries.
- Keep public contracts small and versionable.
- Do not expose EF Core/Npgsql/HTTP/frontend implementation types through domain/Core contracts.
- Avoid static mutable gameplay state.
- Do not call uncontrolled wall-clock/random APIs from deterministic Core gameplay evaluation; use approved authoritative time/RNG contracts.
- Do not swallow exceptions or convert infrastructure exceptions into fake in-world outcomes.
- Propagate cancellation for I/O/background work where the hosting boundary supports it.
- Keep transactions short; never await unrelated external network calls while holding DB locks.
- Do not use broad reflection/dynamic dispatch to avoid defining proper contracts unless an approved subsystem specifically requires it.
- Optimize only after correctness/invariants; performance improvements must be measurable and must not change semantics accidentally.

Style is secondary to correctness and architecture. Do not create enormous style-only diffs during feature work.

## Contract standard

Public inter-component contracts must be:

- explicit;
- typed;
- versionable;
- implementation-neutral;
- persistence-neutral;
- transport-neutral unless the contract is intentionally a transport DTO;
- minimal enough that consumers are not coupled to private internal models.

Never reuse persistence entities as public contracts.

Never use one giant universal snapshot because it is convenient.

Owner snapshots contain only the state required by the consumer/rule plus revision/version metadata needed for concurrency/replay.

Core transition output is typed and owner-addressed. No generic property-path patching.

## Persistence standard

Until a later binding persistence-layout decision is approved, do not invent a database-per-module, schema-per-module or microservice topology as part of unrelated feature work.

Regardless of physical layout:

- each authoritative owner has a private persistence boundary;
- foreign systems do not write its tables/repositories;
- Core does not reach into persistence directly;
- projections are explicitly rebuildable/non-authoritative;
- DB constraints protect structural invariants that can be expressed cheaply;
- sensitive contested operations use the approved hybrid concurrency strategy;
- migrations are explicit/reviewable/repeatable;
- v2 migration/testing never mutates the live v1 database unless explicitly authorized.

## Security standard

Assume every external/client-controlled value is hostile or stale until validated.

Required principles:

- authentication provider identity maps to internal AccountId; provider IDs do not become gameplay identity;
- CharacterId control is verified server-side;
- staff privilege uses current server-side capabilities/policies, not role-name comparisons or stale client/JWT claims alone;
- guild/consortium/job ranks cannot grant platform admin authority;
- paid entitlements cannot grant staff authority;
- Hennet/name/title/public ID never grants owner/admin privilege;
- admin mutations use explicit Admin commands and audit the real acting staff identity;
- support/view-as-player is read-only unless an explicit Admin command is executed;
- secrets/tokens/passwords/private keys never enter source, logs, replay records or docs;
- replay/telemetry/player-facing logs must respect knowledge/privacy boundaries;
- CIEL/AI components receive no privileged direct write path merely because they run server-side.

For economy, inventory, trading, PvP, admin, identity or other high-risk code, add abuse/adversarial tests relevant to the change.

## Logging, events and replay standard

Meaningful authoritative actions must remain traceable through stable CommandId/CorrelationId/EventId relationships and approved history/audit contracts.

Do not recreate mutable `player.records`/chronicle fields as gameplay write state simply to render activity.

Keep separate:

- authoritative command/event history;
- Admin Audit;
- knowledge-filtered Player Log;
- operational telemetry/logs/traces;
- replay-grade test evidence;
- notifications/read projections.

A bug/exploit/race discovered during implementation or testing should become a permanent regression/adversarial scenario where practical.

## Time and randomness

Gameplay time and randomness are authoritative server/Core concerns.

- Use `IGameClock` or the approved authoritative time context.
- Persist absolute timestamps/anchors where the owning model requires them rather than trusting client timers.
- Do not use local machine timezone for gameplay truth.
- Do not call uncontrolled random sources in replay-sensitive Core evaluation.
- Preserve the inputs/context required to reproduce historical outcomes.

## Testing standard

No agent may declare work complete merely because the code looks correct.

### Required verification for implementation changes

Run all checks available in the environment that apply to the change, normally including from repo root:

1. `dotnet --info` / confirm required SDK;
2. `dotnet restore v2/Nexis.slnx`;
3. `dotnet build v2/Nexis.slnx --no-restore`;
4. relevant unit/architecture/integration tests;
5. full test suite when feasible for the change/branch;
6. targeted concurrency/security/replay tests where the change touches those concerns.

Warnings are errors.

If a check cannot be run because the environment lacks the SDK/service/tool, state that explicitly. Never claim a test/build passed without observed evidence.

### Minimum test expectations

Tests should cover as applicable:

- success path;
- rule rejection;
- stale/conflict path;
- duplicate/idempotent command path;
- unauthorized/forged actor path;
- owner-boundary violations;
- atomic rollback when a multi-owner transition fails;
- concurrency race for contested resources;
- replay/deterministic behaviour for Core rules;
- privacy/knowledge filtering for projections;
- regression for any bug being fixed.

An implementation that cannot be tested cleanly is evidence that its boundaries may be wrong.

## Definition of Done

A task is complete only when all applicable conditions are true:

1. requested behaviour is implemented and no requested requirement is silently omitted;
2. implementation conforms to this manual and binding architecture;
3. no unrelated architecture/scope was changed;
4. authoritative state owners remain unambiguous;
5. no new concrete Core/foreign persistence coupling was introduced;
6. tests were added/updated for changed behaviour;
7. required available restore/build/test checks pass;
8. no known warning/error/security regression is ignored;
9. relevant docs/contracts are updated if their truth changed;
10. repository changelog receives a concise operational entry for direct changes;
11. no secrets were committed/logged/documented;
12. no deployment/merge/live DB action was performed unless explicitly authorized;
13. final handoff states what changed, what was tested, what could not be tested, and any remaining risk/blocker.

"Mostly works", "compiles on my machine", "the other agent can finish it" and "I improved the architecture while I was there" are not Definitions of Done.

## Review standard

Before handing work back, the implementing agent performs a self-review against:

- task acceptance criteria;
- ownership boundaries;
- Core separation;
- client/server authority;
- concurrency/idempotency;
- data/privacy/security;
- tests/build evidence;
- accidental scope expansion;
- migration/backward-compatibility impact;
- changelog/documentation.

For substantial or high-risk changes, prefer an independent reviewer/agent that did not write the implementation. The reviewer uses the same manual and architecture, not its own preferences.

A reviewer may reject code that passes tests if it violates architecture/security/replaceability. Tests are evidence, not permission to violate design.

## Git and branch discipline

- Work only on the task's stated branch/worktree.
- Do not modify `main`, production branches or live deployment refs unless explicitly instructed.
- Do not merge/rebase/cherry-pick/push to production simply because implementation is complete.
- Keep commits coherent and messages descriptive.
- Do not rewrite unrelated history.
- When direct repo changes are made, maintain `CHANGELOG.md` per repository policy.
- Avoid committing generated/build artifacts unless the repository explicitly tracks them.

## Documentation discipline

Binding architecture documents are executable constraints for humans/agents, not decorative notes.

When an approved architecture decision changes:

- update the canonical design document;
- reconcile conflicting older wording rather than leaving contradictory instructions;
- update `AGENT-HANDOFF.md`/this manual when the workflow or universal rules changed;
- update changelog;
- update the canonical Voidsmith Source of Truth through the standing workflow.

Do not turn open brainstorming into a binding decision without human approval.

## Release/deployment discipline

Implementation completion is not production approval.

Material component upgrades/replacements use the Universal Component Release Gate:

- brand-new isolated production-like proving environment;
- immutable candidate build;
- deterministic automation/replay where applicable;
- diverse AI testing;
- independent Voidsmith human testing in parallel;
- cross-reproduction/comparison of findings;
- minimum 30-day exact-build soak;
- explicit human release approval;
- rollback readiness.

AI never runs all tests and never has sole release authority.

Normal feature implementation does not automatically trigger deployment.

## When blocked or ambiguous

Do not invent product/architecture decisions merely to keep moving.

For a genuine blocking ambiguity:

- first inspect existing binding docs/contracts/code;
- choose the safest interpretation that does not expand scope or alter architecture when the requirement is already inferable;
- if the ambiguity changes product semantics/public contracts/ownership/security and cannot be safely inferred, report the exact unresolved decision rather than implementing competing architectures;
- complete independent, non-blocked portions where possible.

Never create two implementations "just in case" unless explicitly asked to prototype alternatives.

## Required final handoff format

For implementation work, return a concise evidence-based handoff:

### Summary
What was implemented/fixed.

### Changed
Affected systems/files and architectural impact.

### Verification
Exact checks/tests run and their observed result. Explicitly list checks not run and why.

### Player/operational impact
What users/operators will notice, if anything.

### Risk / follow-up
Only real remaining risk/blockers; do not invent busywork.

Do not dump large code diffs unless the human asks for them.

## Final rule

Every agent should be replaceable too.

A different model should be able to open the same repository, read the same manual and binding documents, receive the same task, and understand the same expected system boundaries, quality bar and completion criteria.

If successful implementation depends on "Claude knows what I meant" or "Codex usually does it this way", the repository instructions are incomplete.
