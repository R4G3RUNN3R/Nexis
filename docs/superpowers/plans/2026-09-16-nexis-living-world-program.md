# NEXIS V2 Living World Implementation Programme

**Status:** PLANNED from the approved living-world architecture. This document controls sequencing only; each slice receives its own executable TDD plan before implementation.

**Approved design:** `docs/superpowers/specs/2026-09-16-nexis-living-world-npc-simulation-design.md`

**Baseline checkpoint:** `fdd5d98` (`docs(v2): approve living-world architecture`)

## Programme goal

Build the approved persistent living-world model as eleven independently reviewable vertical slices without weakening the existing NEXIS V2 command/Core/owner/history/outbox architecture. Each slice must produce working, testable software and preserve a safe stopping point before the next slice begins.

## Non-negotiable programme invariants

- Security remains first, performance second, ease of use third.
- One authoritative state concept has one writer.
- `Nexis.Core` remains deterministic and infrastructure-neutral.
- Clients submit intent; they never write owner state, choose materialisation seeds, or mint authoritative NPC identity directly.
- System workers, Scheduler and CIEL use trusted command ingress and never write gameplay tables directly.
- `NpcId` is an in-world identity, never an authentication credential.
- Chronological age is derived from immutable UTC birth history and authoritative time. No periodic age-write job exists.
- One real elapsed year is one NEXIS chronological year for every ancestry/species.
- A materialised NPC never collapses back into anonymous Population.
- Population conservation is explicit: anonymous living cohorts plus living materialised residents equal current settlement population, without double counting.
- History may know authoritative truth while Knowledge controls who is entitled to know it.
- Death is persistent by default. A later resurrection is a new typed lifecycle event and never erases the death period or its consequences.
- Event consumers may react to committed truth only by submitting normal idempotent commands.
- No authoritative `LivingWorldState`, `NpcState`, generic property bag, or path/value patch model is introduced.
- PostgreSQL integration evidence is required for database-backed release gates. An inconclusive test caused by absent `NEXIS_TEST_POSTGRES_CONNECTION` is reported as a missing gate, never misreported as database-backed proof.

## Delivery discipline

Each slice follows the same gate:

1. Create or refresh an isolated execution worktree using the approved Git workflow.
2. Read the approved design, current engineering manual, ownership map, command-execution rules and relevant prior vertical tests.
3. Write the slice-specific implementation plan before touching production code.
4. Implement test-first in reviewer-sized tasks with frequent commits.
5. Run the narrow tests after every task, then the architecture suite and full solution build at slice completion.
6. Run PostgreSQL integration tests whenever the slice adds or changes persistence and a disposable/test database is available.
7. Update `CHANGELOG.md`, `v2/docs/IMPLEMENTATION-STATUS.md`, and any governing document changed by actual implementation reality.
8. Perform an adversarial self-review against ownership bypass, concurrency, idempotency, replay, hidden-information leakage and recovery hazards applicable to the slice.
9. Stop at a clean verified checkpoint before beginning the next slice.

No slice is allowed to pre-implement a later domain merely because a future type would be convenient. Interfaces may establish explicit seams, but ownership and behavior stay with the slice that proves them.

## Slice 1: NPC lifecycle contract/owner proof

**Outcome:** A real `NpcLifecycle` authoritative owner exists with stable `NpcId`, immutable UTC birth history, living/dead lifecycle representation, derived 1:1 chronological age, typed Core transition, canonical command recovery, PostgreSQL persistence and architecture guards.

**Primary components:**
- `Nexis.Npcs.Contracts`
- `Nexis.Modules.Npcs`
- `Nexis.Core` NPC lifecycle evaluator
- `Nexis.Persistence.Postgres` NPC lifecycle adapter and migration
- architecture and PostgreSQL integration tests

**Explicitly excluded:** aggregate Population, provenance enrichment, Travel, Social, death-cause/mortality rules, Succession, Scheduler and CIEL.

**Gate:** one trusted System command can establish one living persistent NPC exactly once, history/outbox evidence is committed atomically, duplicate CommandId is idempotent, a conflicting second creation cannot create a second identity, and age derivation passes anniversary/leap-day tests.

**Detailed plan:** `docs/superpowers/plans/2026-09-16-nexis-living-world-slice-01-npc-lifecycle.md`

## Slice 2: Population owner + atomic materialisation proof

**Depends on:** Slice 1.

**Outcome:** Anonymous living cohort counts become real Population-owned state and one atomic materialisation command converts exactly one anonymous person into exactly one permanent `NpcId` without changing total living population.

**Primary components:**
- `Nexis.Population.Contracts`
- `Nexis.Modules.Population`
- Population Core rules
- Population PostgreSQL owner
- multi-owner Population + NPC materialisation command

**Required evidence:**
- materialisation conserves population exactly;
- retry with the same CommandId creates one identity;
- two concurrent requests cannot consume the final cohort member twice;
- NPC creation failure rolls the cohort decrement back;
- untrusted clients cannot choose the materialisation seed or arbitrary `NpcId`;
- aggregate and persistent residents cannot be double counted.

**Gate:** a database-backed concurrent materialisation proof passes with both owner transitions committed together or neither committed.

## Slice 3: Progressive provenance/history resolution foundation

**Depends on:** Slices 1-2.

**Outcome:** Materialised NPCs retain stable versioned provenance and unresolved facts can be resolved later without regeneration or contradiction.

**Primary components:**
- bounded provenance contracts owned by NPC lifecycle where identity-intrinsic;
- explicit unresolved/resolved fact contracts;
- deterministic resolution inputs/version references;
- History evidence for committed enrichment.

**Required evidence:**
- repeated deterministic resolution under the same committed context yields the same fact;
- an authoritative resolved fact cannot be silently replaced;
- code/rule-version changes cannot rewrite previously committed identity history;
- private/generated facts do not become player knowledge merely because the server has resolved them.

**Gate:** one NPC can be materialised shallowly, enriched later, replayed from its committed provenance, and retains all prior authoritative facts unchanged.

## Slice 4: Travel/presence + Active Cast proof

**Depends on:** Slices 1-3 and the approved Travel ownership boundary.

**Outcome:** A materialised NPC has one authoritative presence/location and player-facing Active Cast selection is a rebuildable relevance projection over shared world truth.

**Primary components:**
- Travel/presence owner implementation required by the approved ownership map;
- `Nexis.Projections.ActiveCast`;
- projection checkpoint/event consumption;
- stale-read revalidation at command boundaries.

**Required evidence:**
- two players in the same context observe the same authoritative named `NpcId`;
- Active Cast may differ by player relevance without inventing private NPC copies;
- a stale Active Cast entry cannot authorize an action after the NPC has moved;
- projection rebuild reproduces equivalent relevance state from authoritative evidence.

**Gate:** shared-NPC location changes propagate through events to Active Cast while authoritative commands still re-read owner state before mutation.

## Slice 5: Mortality/death proof

**Depends on:** Slices 1 and 3-4 plus versioned lifecycle content inputs needed by the mortality rule.

**Outcome:** Persistent NPC mortality is evaluated sparsely and deterministically enough for replay, every committed death has a causal authoritative reason, and death emits an idempotent semantic event without structurally preventing future resurrection mechanics.

**Primary components:**
- typed mortality/lifecycle checkpoint intent;
- lifecycle evaluation anchor;
- death transition and cause reference;
- `NpcDied` semantic event;
- lifecycle content inputs and deterministic RNG use where probability applies.

**Required evidence:**
- cold NPCs do not need per-tick age/death writes;
- elapsed-time catch-up cannot double-apply mortality;
- `Dead` persists after retries/restarts;
- a failed downstream consumer cannot resurrect the NPC;
- the schema permits a future explicit `Dead -> Living` transition without erasing death History.

**Gate:** a database-backed off-screen death survives command retry and event redelivery with one lifecycle transition and one causal death fact.

## Slice 6: Social/family proof

**Depends on:** Slices 1-3 and Population materialisation.

**Outcome:** Meaningful relationships are sparse typed Social edges, family coherence can minimally materialise required relatives, and family expansion is bounded.

**Primary components:**
- Social owner implementation;
- typed relationship edges;
- bounded household/direct-relative materialisation workflow;
- Population/NPC integration through normal commands.

**Required evidence:**
- parent/child and spouse/partner invariants are enforced without an all-to-all matrix;
- materialising one relative cannot recursively instantiate an unbounded ancestry tree;
- living relatives consumed from anonymous cohorts are not double counted;
- retrospectively materialised deceased relatives do not decrement current living cohorts.

**Gate:** a household case produces a coherent bounded family graph and exact population accounting under retry and concurrency.

## Slice 7: Employment + vacancy + Succession proof

**Depends on:** Slices 1-6.

**Outcome:** A persistent NPC death can vacate a role, open a durable Succession case and resolve candidates in the approved priority without replacing or resurrecting the dead person.

**Primary components:**
- Employment/Civic Jobs owner implementation;
- `Nexis.Succession.Contracts`
- `Nexis.Modules.Succession`
- vacancy and candidate-search projections/workflow state;
- Population materialisation seam for aggregate candidates.

**Approved candidate priority:**
1. existing persistent apprentice/relative/employee/qualified resident/nearby professional/traveller/faction or guild candidate;
2. deterministic materialisation from eligible anonymous Population when no suitable persistent candidate exists;
3. outsider/migrant only when current world/history rules make that path plausible.

**Required evidence:**
- death does not auto-spawn a clone;
- services may remain unavailable during a real vacancy;
- Succession cannot write Employment, Guild, Population or NPC tables directly;
- unique roles may remain unresolved where policy says no replacement;
- workflow retry/redelivery cannot appoint two successors.

**Gate:** death -> vacancy -> durable succession case -> candidate selection -> role-owner command works through typed owner boundaries and remains idempotent.

## Slice 8: Knowledge/History proof

**Depends on:** Slices 5-7.

**Outcome:** Authoritative truth and actor knowledge are demonstrably separate, including hidden crimes/deaths, discovery and false beliefs.

**Primary components:**
- Knowledge/Discovery/Codex owner implementation;
- History queries/projections for world facts;
- typed belief/discovery relationships where approved;
- presentation filters that consume Knowledge rather than raw omniscient History.

**Required evidence:**
- History can record a secret killing while unrelated guards/NPCs do not know it;
- witness/evidence/investigation can propagate knowledge through normal commands;
- an NPC belief may disagree with authoritative History without rewriting truth;
- projections and CIEL context cannot leak undiscovered facts.

**Gate:** a hidden-event scenario proves server truth, player knowledge and NPC belief can diverge safely and converge only through causal discovery.

## Slice 9: Simulation/Scheduler runtime proof

**Depends on:** Slices 1-8.

**Outcome:** Cold/warm/hot processing, due-work dispatch, deterministic catch-up and backpressure operate with CPU cost tied to relevant/due entities rather than total represented population.

**Primary components:**
- `Nexis.Simulation.Contracts`
- `Nexis.Simulation`
- Scheduler/Due-Work owner implementation;
- workload budgets, leases and retry integration;
- operational metrics without unbounded `NpcId` telemetry cardinality.

**Required evidence:**
- cold NPCs consume no constant per-entity tick work;
- due-work restart/retry does not duplicate authoritative outcomes;
- catch-up is deterministic for the same committed inputs;
- backlog pressure degrades safely instead of bypassing authority;
- scheduler identity is recorded as infrastructure executor, not in-world performer.

**Gate:** synthetic large-population tests show active work scales with due/relevant entities and recovery after interruption preserves authoritative state.

## Slice 10: CIEL intention/dialogue integration proof

**Depends on:** Slices 3-4 and 6-9.

**Outcome:** CIEL can converse, interpret and propose important NPC intentions while every gameplay mutation remains Core/owner-authoritative.

**Primary components:**
- typed in-world performer reference separate from trusted executor identity;
- CIEL authorized context projection;
- proposal-to-System-command boundary;
- narrative/semantic memory separated from authoritative gameplay truth.

**Required evidence:**
- CIEL cannot directly mutate lifecycle, Social, Travel, money, Inventory or other owner state;
- a CIEL proposal rejected by Core produces no owner writes;
- History distinguishes trusted executor from NPC performer;
- CIEL cannot surface undiscovered facts withheld by Knowledge;
- deterministic ordinary routines continue without LLM inference.

**Gate:** one meaningful autonomous NPC decision and one dialogue-driven proposal execute end-to-end with CIEL as proposer only.

## Slice 11: Scale/recovery/adversarial programme

**Depends on:** Slices 1-10.

**Outcome:** The complete living-world subsystem is stress-tested for scale, crash recovery, concurrency, replay, history growth and security bypass before any production release claim.

**Test programme:**
- synthetic settlements with very large anonymous cohorts and substantial cold persistent populations;
- high-concurrency materialisation at low remaining cohort counts;
- due-work backlog and worker restart/fencing;
- succession bursts after disasters/war scenarios;
- History/outbox growth and projection rebuild;
- simultaneous player interactions with one NPC;
- hidden-information adversarial tests;
- crash points before/after owner transition, receipt terminalisation and outbox publication;
- replay across committed rule/content versions;
- malformed/untrusted client attempts to mint IDs, seeds or System authority.

**Release gate:** all applicable Core/component release-gate evidence is current; PostgreSQL-backed tests have real database evidence; no unresolved HIGH security/authority/recovery defect remains; public/project status is updated to describe only what has actually been implemented and verified.

## Programme rollback and recovery policy

- Every slice is isolated behind typed contracts and a clean Git checkpoint so a failed slice can be reverted without rewriting unrelated owners.
- Database migrations are forward-only artifacts during development; destructive production migration/rollback strategy is decided at the release gate, not improvised during coding.
- No slice may require deleting committed History to recover from a bug. Corrections use explicit corrective events/transitions where applicable.
- A failed projection can be rebuilt. A failed authoritative owner change must be recovered through its command/idempotency/reconciliation path, not by hand-editing gameplay tables.
- Production deployment remains separate from implementation. Passing local/CI tests does not imply a deployment occurred.

## Programme completion definition

The living-world programme is complete only when all eleven slices have their executable plans, implementation commits, tests and release evidence; the governing NEXIS documents match verified implementation reality; History/Knowledge/privacy boundaries have adversarial coverage; database-backed gates have actually run; and no planned capability is represented publicly as implemented before that evidence exists.
