# Nexis 2.0 Living World, Persistent NPC, Population and Succession Design

**Status:** APPROVED DESIGN
**Approved:** 2026-09-16
**Date:** 2026-09-16
**Product:** Nexis 2.0
**Scope:** Persistent societal NPCs, hybrid population simulation, materialisation, ageing, mortality, active-cast selection, background simulation and role succession

## 1. Purpose

Nexis should support a persistent world in which people matter over real-world years and decades without requiring the server to continuously simulate every inhabitant.

A player should be able to meet a person in one year, save or kill that person, return many years later and find a world whose history genuinely continued from that outcome. NPCs may age, form relationships, work, move, have children, die, leave vacancies, become historically important, and be remembered. Their lives are not disposable quest furniture.

At the same time, a city with tens of thousands of inhabitants must not require tens of thousands of continuously running AI agents. Runtime cost should follow active player attention, meaningful due work and world events rather than total population.

The central design principle is:

> **Persist every person who becomes individually real. Simulate only what matters. Resolve time lazily where safe. Schedule globally consequential changes. Preserve significant history, not meaningless noise.**

This design extends the existing Nexis 2.0 modular-monolith, typed-owner, Core-evaluation, command, eventing and replay architecture. It does not create a parallel simulation engine or a global NPC state blob.

## 2. Binding product principles

1. **Real time is real time.** One real-world year produces one year of chronological ageing in Nexis. There is no accelerated universal NPC ageing clock.
2. **Persistent lives create persistent consequences.** Saving an NPC preserves a possible future. Killing an NPC removes one. The world continues from either result rather than restoring a predetermined script.
3. **A role may be replaced. A person is not.** If a blacksmith dies, the world may eventually fill the vacancy. The dead blacksmith is never silently replaced by a clone carrying the same identity and dialogue.
4. **Hybrid population is authoritative.** Individually important people are persistent NPCs. The remaining anonymous population exists as conserved demographic cohorts until history requires a real individual.
5. **Materialisation creates identity, not population.** Turning an anonymous citizen into a persistent NPC transfers one person out of the appropriate aggregate cohort. It must not increase total population.
6. **Materialised identity is permanent.** Once an NPC receives a stable identity, that identity never collapses back into aggregate population. The NPC may become computationally cold, but the historical person remains addressable forever.
7. **Biography is progressive.** Materialisation creates only enough coherent history for the current need. Missing history may be expanded later, but already committed truth may not be regenerated, contradicted or erased.
8. **Importance changes fidelity, not physics.** An NPC becoming important may justify richer simulation and biography. It must not grant plot armour, alter mortality rules, or silently improve gameplay outcomes.
9. **One NPC has one physical reality.** A persistent NPC has one authoritative life state and one authoritative physical presence shared by all players. Nexis does not create private copies of the same person for different players.
10. **Knowledge is not omniscience.** History records what happened. Knowledge records who knows, believes, witnessed or discovered what happened. A hidden murder does not create psychic universal law enforcement.
11. **CIEL is intelligence, not authority.** CIEL may interpret, converse, plan or propose NPC intentions. It does not directly mutate lifecycle, economy, inventory, location, relationships, combat or other gameplay truth.
12. **Vacancies may remain vacant.** Settlements may lose a service or office for a meaningful period. Need pressure can drive recovery, but the engine does not conjure instant replacements merely to keep a UI button available.
13. **The world may recover, but history must survive recovery.** Succession, migration, retraining and social adaptation should let settlements evolve without erasing the consequences that created the need.

## 3. Scope and non-goals

### 3.1 In scope

This design covers:

- persistent societal NPC identity and lifecycle;
- 1:1 chronological ageing;
- aggregate anonymous population cohorts;
- population conservation during materialisation;
- progressive deterministic NPC history resolution;
- relevance-driven enrichment;
- cold, warm and hot simulation states;
- player-facing active-cast selection;
- persistent births, deaths and migration;
- causal off-screen mortality;
- sparse social/family relationships;
- role vacancy and succession workflows;
- service need pressure;
- candidate discovery from persistent and aggregate populations;
- single shared NPC presence across concurrent players;
- NPC autonomous actions through normal System command lanes;
- Knowledge versus History separation;
- CIEL integration boundaries;
- persistence, replay, idempotency, concurrency and scale requirements.

### 3.2 Explicit non-goals for this design

This design does not fully specify:

- exact fertility rates, mortality tables or demographic balance values;
- exact medical, disease, pregnancy or childbirth mechanics;
- detailed inheritance/property law;
- exact political election, monarchy, guild or military succession rules;
- combat balance or anti-grief protections around killing NPCs;
- detailed resurrection cost/eligibility beyond preserving the existing Sacred Grove canon seam;
- exact CIEL model/provider/prompt design;
- real-time multiplayer transport, WebSocket topology, matchmaking or presence infrastructure;
- persistent lifecycle rules for every monster, summon, spirit or temporary encounter entity;
- final physical PostgreSQL partitioning/sharding layout;
- production capacity claims before load testing.

Person-like NPCs that participate in persistent society are the primary subject. Other entity classes may opt into the same lifecycle contracts later where appropriate.

## 4. Architectural fit with Nexis V2

The current V2 architecture already provides the right foundation:

- deterministic `Nexis.Core` rule evaluation;
- typed state owners;
- Application-coordinated multi-owner commits;
- stable CommandId/CorrelationId/EventId semantics;
- controlled authoritative time and RNG;
- PostgreSQL owner persistence;
- atomic state/history/outbox commits;
- optimistic revisions and selective locking;
- System command lanes;
- automated actor keys for Scheduler and CIEL;
- at-least-once event delivery with idempotent consumers;
- immutable History/Replay evidence;
- Content Registry exact-version resolution;
- rebuildable projections.

The missing capability is not a replacement architecture. It is a set of new bounded domains and projections that use those existing contracts.

## 5. Authoritative ownership model

### 5.1 New owner: NPC lifecycle

Add a dedicated authoritative owner concept, with likely assemblies:

- `Nexis.Npcs.Contracts`
- `Nexis.Modules.Npcs`

The NPC lifecycle owner is the sole writer for the existence and lifecycle identity of a persistent NPC.

It owns facts such as:

- stable `NpcId`;
- individual materialisation provenance;
- birth instant/date and birthplace reference where authoritative;
- species/ancestry definition reference where intrinsic to identity;
- living/dead lifecycle state;
- death instant and authoritative cause reference;
- lifecycle evaluation anchor required for deterministic natural-mortality catch-up;
- personal identity facts that semantically belong to the person rather than another owner;
- a typed stable baseline personality profile where personality is gameplay-authoritative; mutable attitudes toward other people remain Social/Knowledge and transient conversational interpretation remains CIEL;
- references to immutable provenance/version information required to reproduce materialisation decisions.

The personality profile must be a bounded typed contract, not an unbounded trait/property dictionary. If personality later becomes complex enough to deserve an independently owned domain, that extraction requires a deliberate architecture change rather than silently splitting truth across two owners.

It does **not** own:

- current money;
- item ownership;
- equipment;
- current job or office;
- current travel/location;
- property;
- guild/business membership;
- social relationships;
- reputation;
- skills owned by another established domain;
- actor knowledge;
- CIEL conversational memory;
- due-work queue state.

Age is not a mutable field owned by this module. Chronological age is derived from birth time and authoritative current time.

### 5.2 New owner: aggregate population

The approved hybrid model requires an authoritative owner for anonymous population rather than treating population counts as a mere projection.

Add a Population owner concept, likely:

- `Nexis.Population.Contracts`
- `Nexis.Modules.Population`

Population owns:

- anonymous living population cohort counts;
- cohort dimensions actually required by demographic/materialisation rules;
- aggregate demographic transition state where required for its invariants;
- cohort revision/concurrency state;
- population reservation/materialisation accounting needed to prevent double creation.

Population does **not** own persistent NPC identities or their individual lives.

A settlement's total living population should normally be projected from:

`anonymous cohort population + living persistent NPCs currently belonging to that settlement/region`

rather than stored as a second independently writable total that can drift.

### 5.3 Existing owners remain authoritative

The existing ownership map remains in force:

- **World** owns dynamic regional/global state and active world events. Under this design it explicitly does not own anonymous Population cohort counts; those move to the dedicated Population owner so demographic conservation has one writer.
- **Travel** owns authoritative current location/journey state. It should be extended deliberately to support persistent NPC actors rather than letting `Nexis.Npcs` duplicate location.
- **Employment** owns jobs, positions, ranks and work-cycle state.
- **Social** owns sparse relationships including family relationships that do not belong to another organization domain.
- **Reputation** owns standing values.
- **Knowledge** owns actor-specific knowledge/reveal/belief state and must be generalized where necessary to support NPC knowers as well as player characters.
- **Property** owns ownership/residence facts.
- **Guilds/Consortiums** own their membership and governance facts.
- **Content Registry** owns static/versioned definitions, including species/lifecycle definitions, role/succession policy definitions, named canonical NPC templates where appropriate, and routine/archetype definitions.
- **History/Replay** owns immutable evidence of committed facts, not current gameplay state.
- **Scheduler** owns due-work mechanics only.
- **CIEL** owns only CIEL-specific conversation/context/memory/workflow state.

### 5.4 New workflow owner: Succession

Add a bounded long-running workflow concept, likely:

- `Nexis.Succession.Contracts`
- `Nexis.Modules.Succession`

Succession owns **vacancy-resolution workflow state**, not the roles or people involved.

It may own:

- `SuccessionCaseId`;
- typed vacancy subject/reference;
- originating owner/domain;
- vacancy cause/reference;
- opened time;
- current workflow status;
- need-pressure/evaluation state intrinsic to the case;
- next evaluation anchor where semantically part of the workflow;
- candidate references considered/selected where required for idempotency/audit;
- final resolution reference.

It may not directly edit Employment, Guild, Consortium, Property, Economy, NPC, Travel or other foreign owner tables.

Property inheritance is not automatically absorbed into Succession. The module exists to resolve role/service/office vacancies through explicit contracts. Other forms of succession require their own owning-domain design.

### 5.5 New non-authoritative simulation coordinator

Add a replaceable coordination component, likely:

- `Nexis.Simulation.Contracts`
- `Nexis.Simulation`

Simulation owns no gameplay truth.

Its responsibilities may include:

- determining which persistent NPCs need active processing;
- promoting/demoting runtime simulation fidelity;
- requesting deterministic catch-up;
- selecting due work within bounded budgets;
- dispatching approved System commands;
- applying backpressure/fair scheduling;
- maintaining ephemeral runtime caches;
- measuring cold/warm/hot populations.

It must never become a write owner or hidden `NpcState` database.

## 6. Hybrid population model

### 6.1 Two representations of one living population

A settlement contains both:

1. **Persistent individuals** with stable `NpcId` values; and
2. **Anonymous aggregate population** represented in demographic cohorts.

These are not additive fictional layers. They are two representations of the same society.

Example:

```text
Ironhall total living population: 81,426
Persistent living NPCs:            3,214
Anonymous aggregate citizens:     78,212
```

The exact total is a projection, not an independently writable counter.

### 6.2 Cohort dimensions

Cohorts should remain sparse and purposeful. Useful dimensions may include:

- world/realm;
- settlement/region;
- ancestry/species;
- broad life stage/age band;
- broad profession or skill pool;
- household status where needed;
- mobility/migration eligibility;
- other dimensions required by an approved demographic or materialisation rule.

Do not create a combinatorial cube containing every imaginable trait. A dimension is added only when a real rule needs it.

### 6.3 Population conservation invariant

Materialisation must satisfy:

> **Materialisation creates identity, not population.**

For a living anonymous citizen:

1. Application selects/reserves an eligible cohort member.
2. Core validates that materialisation is legal and that the cohort can satisfy the required constraints.
3. The Population transition decrements exactly one member from the anonymous cohort.
4. The NPC transition creates exactly one persistent living identity.
5. Required minimum owner state for exposure, such as Travel location or Employment status, is created as part of the same gameplay promise when necessary.
6. The transaction commits atomically or none of it does.

A retry with the same CommandId/materialisation identity must return the original result and must not consume another cohort member.

### 6.4 Historical materialisation

A newly relevant NPC may require already-dead parents, mentors or other historical people for coherent lineage/history.

A retrospectively materialised deceased historical person does not decrement the current living anonymous population. Their historical birth/death facts must instead be consistent with established world/history constraints and carry provenance explaining that the identity was resolved retrospectively.

Living newly materialised relatives do consume the appropriate current anonymous cohort unless they were already persistent.

## 7. Materialisation and provenance

### 7.1 Materialisation triggers

A person may become persistent because of:

- direct player interaction;
- establishment of a bounded individually exposed Active Cast role/encounter where the person must become a real identity; a projection refresh or ambient crowd display alone never materialises a person;
- a role/succession candidate search;
- a required family/household relationship;
- employment or property ownership;
- guild/faction involvement;
- witnessing or participating in a significant event;
- crime/investigation;
- travel encounter;
- becoming causally relevant to another persistent person's history;
- another approved gameplay rule that requires individual identity.

Clients cannot directly request arbitrary population materialisation.

### 7.2 Stable materialisation provenance

Each persistent NPC should retain enough provenance to explain and reproduce the identity creation boundary, including concepts such as:

- materialisation command/correlation identity;
- source population cohort or canonical content definition;
- materialisation reason/type;
- materialisation time;
- generator/rule/content version identifiers;
- stable server-side provenance seed or equivalent deterministic input where used.

A provenance seed is not a public gameplay random stream. It must not be exposed or reused for future combat/economy/RNG outcomes.

### 7.3 Named canonical NPCs

A static named NPC definition in Content Registry is not itself mutable world state. Canonical named NPCs that exist in the live world receive persistent NPC instances linked to the appropriate versioned content definition.

Their lifecycle, relationships, jobs and location then belong to the normal authoritative owners like any other persistent individual.

## 8. Progressive deterministic history

### 8.1 Materialisation is not complete biography generation

A newly materialised NPC receives only the facts required to make the present state coherent.

For a replacement baker, that may include:

- name/identity;
- birth date/place;
- ancestry;
- current residence/location anchor;
- profession and enough skill/employment history to justify qualification;
- household/family facts that are immediately required;
- stable personality traits/seed where needed;
- a small number of significant historical facts relevant to the current role.

The engine should not manufacture forty years of detailed diary entries merely because one NPC became visible.

### 8.2 Fact-resolution states

The design distinguishes:

- **Unresolved**: the world has never needed the answer. No contradictory placeholder should be invented.
- **Derived**: calculable from existing authoritative facts, such as chronological age from birth time. Usually no additional authoritative storage is required.
- **Resolved authoritative**: a fact has been generated or established and committed as world truth. It may be private, but it may no longer be silently regenerated.
- **Known/believed/observed**: an actor's Knowledge state concerning a world fact. This is separate from whether the underlying fact is true.

Earlier informal language such as “generated but private” maps to **resolved authoritative but not necessarily known**. Privacy/knowledge is not a weaker form of truth.

### 8.3 Expansion rule

When future gameplay needs an unresolved detail:

1. load established authoritative facts and relevant world/history constraints;
2. resolve the missing detail through a versioned deterministic rule using controlled inputs;
3. reject any candidate result that contradicts established truth;
4. commit the new fact through the proper owner if it affects gameplay truth;
5. record provenance/rule version required for replay;
6. expose it only through Knowledge-aware projections.

Once resolved, the fact is permanent unless an explicit in-world change can legitimately alter it.

### 8.4 Hybrid enrichment

Normal enrichment is **need-driven**.

Major relevance milestones may trigger broader coherence bundles, for example when an NPC becomes:

- a long-term companion;
- a player's spouse/close family member;
- a ruler or major political figure;
- a guild/organization leader;
- a major antagonist;
- a repeatedly encountered important merchant/professional;
- a historically significant survivor/victim/witness;
- another high-impact persistent figure.

A milestone bundle may resolve additional family, motivations, career history, formative events, relationships and context, but only through normal typed owner boundaries.

CIEL may render or interpret the result. It must not invent persistent owner facts by writing them directly.

### 8.5 Bounded relationship expansion

Resolving one NPC must not recursively generate an infinite family tree.

A household/family bundle may materialise the minimum direct relatives required for coherence. Those relatives begin at minimal fidelity unless independently relevant. Extended family remains unresolved or aggregate until needed.

## 9. Time, ageing and lifecycle

### 9.1 1:1 chronological ageing

Chronological ageing uses authoritative server time.

A person born on a real-world calendar date reaches the next chronological year on the corresponding annual anniversary. Age is derived rather than periodically incremented.

The canonical calculation uses the authoritative UTC birth instant and Gregorian calendar-year addition semantics. A 29 February birth therefore reaches its non-leap-year anniversary on 28 February at the corresponding UTC time, matching deterministic `.AddYears(...)`-style calendar behavior rather than a fixed 365-day duration. Any fantasy calendar shown to players is presentation/world-calendar mapping and does not silently change biological elapsed time.

There is no daily/monthly/yearly write merely to make age increase.

### 9.2 Species and life stages

Content Registry owns versioned lifecycle definitions for species/ancestries, such as:

- life-stage thresholds;
- typical lifespan/risk curves;
- development/retirement ranges where applicable;
- species-specific biological characteristics.

One real year remains one elapsed year for every species. A long-lived species has longer lifecycle stages; the clock itself is not slowed.

### 9.3 Chronological versus biological age

Birth history is immutable.

Magic, disease, curses, blessings or other effects that alter biological ageing must be represented through the proper effect/magic/lifecycle inputs. They do not rewrite the person's birth date.

### 9.4 Resurrection canon

Nexis canon includes a gifted resurrection path associated with the Sacred Grove. Therefore the persistence model must not structurally assume that `Dead -> Living` is impossible forever.

The binding rule is:

- death is final by default;
- no ordinary respawn or silent restoration exists;
- a genuine resurrection mechanic may explicitly transition a dead NPC back to living only through an approved typed command/Core rule;
- History still records both the death and the later resurrection;
- resurrection never erases the period of death or its already-committed consequences;
- if a role was already filled during the death period, resurrection does not automatically evict the successor. The role-owning domain decides what happens next.

## 10. Dual-resolution demographics

### 10.1 Anonymous population

Anonymous citizens change statistically at cohort level through demographic transitions such as:

- births;
- deaths;
- immigration;
- emigration;
- disaster/war/disease effects where approved.

World conditions may influence these rates.

“Statistical” does not mean “bypass gameplay authority”. Aggregate demographic mutations still enter through trusted System commands, use authoritative time/content/controlled RNG as required, are evaluated by Core, and persist only through Population's typed transitions. A demographic worker is not allowed to update cohort counts directly.

No individual NpcId is created unless a person becomes causally relevant.

### 10.2 Persistent population

Persistent people experience those processes individually.

Examples:

- a persistent couple's relevant child is created as a new persistent NPC;
- a persistent NPC death is an individual lifecycle event;
- a persistent migrant moves through Travel as an individual;
- a persistent NPC is never statistically removed from a cohort because they are no longer represented by an anonymous cohort count.

### 10.3 Birth rule

A child born to persistent parents when the family itself is relevant becomes persistent immediately.

The child increases living population exactly once and is not also added to anonymous child cohorts.

Anonymous births increase anonymous cohort counts without creating identities.

### 10.4 Migration rule

Anonymous migration moves cohort counts between places.

Persistent migration changes the individual's Travel/location state while preserving identity/history. Settlement population projections update accordingly.

## 11. Natural mortality and off-screen death

### 11.1 No fixed secret death date

A persistent NPC is not assigned an immutable predetermined death date at birth/materialisation.

Natural mortality emerges from current authoritative inputs such as:

- chronological/biological age;
- ancestry/species;
- health/resources where relevant;
- disease/injury/effects;
- profession/environment;
- famine/war/disaster/world conditions;
- magic or other approved modifiers.

### 11.2 Sparse mortality evaluation

Cold NPCs do not receive constant death rolls.

Mortality evaluations should occur at sensible sparse checkpoints determined by life stage/risk, with event-triggered reevaluation for major hazards. Young healthy NPCs may need very infrequent checkpoints; elderly/ill/exposed NPCs may need more frequent ones.

The NPC lifecycle owner may retain the last authoritative lifecycle/mortality evaluation anchor required for deterministic elapsed-risk catch-up. Scheduler owns only when/how due work is dispatched.

### 11.3 Causal off-screen mortality

A persistent NPC may die while no player is present, but every individual death must resolve to a plausible authoritative cause.

Probability may determine that a mortality event occurs. Probability itself is never recorded as the cause of death.

Possible cause classes may include:

- age-related failure/illness;
- disease;
- existing injury;
- accident;
- exposure;
- famine;
- violence;
- war/disaster;
- magical/supernatural cause;
- other typed content/rule-defined causes.

Core must have enough trusted state/context to validate the selected cause. If no plausible cause is available, the engine does not fabricate one merely to satisfy a roll.

### 11.4 Relevance cannot change survival semantics

Cold/warm/hot classification affects processing priority and fidelity only.

Given equivalent authoritative state, time interval, rule/content version and controlled RNG inputs, the mortality semantics must not improve merely because an NPC is important to a player.

No hidden plot armour.

### 11.5 Large regional hazards

War, famine, plague or disasters may affect both aggregate and persistent populations.

- aggregate casualties are resolved by Population at cohort level;
- persistent NPCs affected by the hazard resolve individually where their identity matters;
- structurally important/actively connected NPCs may be promoted to due work promptly;
- cold low-dependency NPCs may resolve exposure lazily before their next observation, provided no current authoritative dependency requires an earlier result;
- the outcome must still be reproducible from the same event/risk context and must not depend on whether a player happened to open a page.

## 12. Cold, warm and hot simulation

These are operational simulation classes, not gameplay lifecycle states.

### 12.1 Cold

A cold NPC:

- has a persistent identity;
- consumes essentially no continuous CPU;
- retains all authoritative state/history;
- ages automatically through derived time;
- may have sparse lifecycle checkpoints;
- can be reactivated whenever causal history reaches them.

### 12.2 Warm

A warm NPC has meaningful pending activity, such as:

- travel;
- a scheduled work/lifecycle event;
- active family/household event;
- succession candidacy;
- exposure to a significant world hazard;
- a pending contract/organization event;
- another due workflow.

Warm does not mean continuously simulated. It means the system has reason to keep due work readily discoverable.

### 12.3 Hot

A hot NPC is participating in active gameplay, for example:

- visible interaction with one or more players;
- combat;
- important negotiation;
- active scene/event;
- CIEL-supported dialogue/decision;
- a tightly timed gameplay sequence.

Hot state may use ephemeral caches/session objects, but those never become a second source of truth.

### 12.4 Promotion/demotion

Simulation may promote or demote NPC runtime fidelity automatically based on causal need.

Demotion to cold never deletes identity/history or collapses the person back into population statistics.

## 13. Physical presence and Active Cast

### 13.1 Single authoritative presence

A persistent NPC has one shared physical reality.

The engine must not simultaneously expose the same ordinary NPC as being in incompatible places for different players.

Lore-approved clones, projections, illusions or magical duplicates are separate entity/content mechanics and do not weaken this invariant.

### 13.2 Progressive location granularity

Nexis does not need centimetre-level location for a cold citizen.

Location may be represented at the minimum authoritative granularity required by current gameplay:

- cold: settlement/region or explicit journey;
- warm: venue/route/due state where required;
- hot: exact active location/scene state required by interaction.

Travel remains the authoritative owner. Exact presence may be derived from versioned routine/location rules when safe rather than written every minute.

If a player follows or interacts with the NPC closely enough that exact movement matters, the NPC becomes hot and the required exact Travel/presence state is resolved.

### 13.3 Active Cast projection

Add a rebuildable projection concept, likely `Nexis.Projections.ActiveCast` or an equivalent project following final solution naming conventions.

It answers:

> Which real people are relevant enough to surface to this player in this place and context right now?

Inputs may include:

- shared physical location;
- role/business availability;
- player relationships/history;
- reputation;
- ongoing contracts/events;
- time of day;
- travel route;
- NPC availability;
- knowledge/visibility filtering;
- configured presentation budgets.

Active Cast is a view selector, not authority.

A city may contain 80,000 inhabitants while the interface surfaces a handful of presently relevant individuals.

### 13.4 Ambient population interaction

Ambient crowds may be represented by aggregate population until a player chooses to interact with a specific previously anonymous person.

At that point Nexis either:

1. selects a suitable already-persistent person physically present; or
2. materialises one from the appropriate aggregate local cohort.

The new person becomes permanent from that moment onward.

### 13.5 Shared cast, personalized relevance

Players in the same place share the same physical NPC reality.

The interface may rank/surface different subsets because of personal relationships, Knowledge or contract relevance, but it may not create incompatible physical copies.

## 14. Simultaneous player interaction

### 14.1 Soft interactions may overlap

Concurrent players may safely perform non-exclusive interactions such as:

- observing an NPC;
- asking ordinary questions;
- browsing a merchant catalogue;
- hearing public dialogue;
- requesting Knowledge-filtered public information.

These sessions all reference the same authoritative person.

### 14.2 Hard interactions are authoritative commands

State-changing actions such as:

- combat/death;
- arrest;
- recruitment;
- marriage/proposal acceptance;
- hiring/firing;
- relocation;
- unique item/property transfer;
- major NPC decision;
- quest-defining commitment;

must resolve through the normal V2 command/Core/owner transaction path.

Revisions/idempotency/short locks where genuinely needed prevent conflicting outcomes.

### 14.3 Session reconciliation

A committed hard change invalidates or reconciles affected soft sessions.

If one player kills an NPC while another is speaking to that person, the second conversation cannot continue indefinitely against a private alive copy. The next relevant interaction must observe the committed lifecycle revision and react accordingly.

## 15. Social relationships, family and lineage

### 15.1 Sparse relationship graph

Social stores only meaningful relationship edges. There is no all-to-all relationship matrix.

Potential typed relationships include:

- parent/child;
- sibling;
- spouse/partner;
- guardian;
- friend;
- rival/enemy;
- mentor/apprentice;
- other approved relationship types.

Relationship state may include typed measures such as trust, affinity, fear, respect or familiarity when gameplay requires them. Avoid an unbounded generic trait bag.

### 15.2 Family continuity

Family relationships are persistent and survive death.

Children, descendants and later materialised relatives may make an older saved/killed NPC consequential many years after the original interaction.

### 15.3 Family materialisation

When a newly materialised NPC requires a spouse/child/parent for current coherence:

- already-persistent relatives are reused;
- necessary living anonymous relatives are materialised and deducted from compatible cohorts;
- necessary deceased historical relatives may be retrospectively materialised without touching current living cohorts;
- expansion stops at the minimum coherent boundary and does not recursively instantiate an infinite ancestry tree.

## 16. History, Knowledge and memory

### 16.1 History is truth

History/Replay records committed events and their causation/replay evidence.

Examples include:

- birth;
- materialisation;
- death;
- resurrection;
- marriage;
- major employment/leadership transition;
- saving someone's life;
- killing someone;
- major crime;
- faction/ownership change;
- major world-event participation.

### 16.2 Knowledge is who knows

Knowledge determines what an actor knows/believes/has discovered.

A murder in an isolated forest can therefore produce:

- History: victim died; actual killer known to authoritative world truth;
- Knowledge: killer knows, victim may have known during the event, surviving witnesses may be none;
- later discovery: investigators learn the victim was murdered without automatically learning the killer;
- later evidence/rumour/investigation may propagate additional Knowledge.

Law enforcement, dialogue and player-facing projections must use appropriate Knowledge rather than server omniscience.

### 16.3 CIEL narrative memory

CIEL may keep semantic summaries, emotional interpretations and conversational context.

CIEL memory is not authoritative world truth.

If CIEL says an NPC believes that a player committed a murder, that may be valid **belief** state if Knowledge supports it. It does not alter the authoritative killer recorded by the committed event.

### 16.4 History volume discipline

The immutable authoritative event ledger must not become a transcript of routine life.

The correct strategy is **not** to emit millions of trivial events and delete them later. Instead:

- routine activity that produces no material state change remains derived/aggregate/operational;
- domains store meaningful summarized state, such as a work period, rather than daily clock-in noise when gameplay does not require it;
- authoritative History records significant committed boundaries;
- telemetry/debug traces follow their own retention policy outside gameplay History.

Once an event is part of authoritative immutable History, it is not silently compacted away.

## 17. Saving, killing and death consequences

### 17.1 Saving a life

A life-saving outcome should produce an authoritative event when the gameplay actually establishes that outcome.

The event may cause normal owner reactions such as:

- Social gratitude/trust;
- Reputation changes;
- Knowledge propagation;
- contract/adventure progression;
- History evidence.

The saved NPC then simply continues to exist. Nexis does not need a pre-scripted “saved timeline”; the future emerges because the person remained alive.

### 17.2 Killing/death

Death should update only the owners that must move atomically with the death's immediate gameplay promise.

It must not synchronously lock every dependent domain in the game.

A typical shape is:

1. Combat/other cause resolves through Core.
2. NPC lifecycle transition to Dead is included atomically where required.
3. terminal command outcome + authoritative events + outbox commit.
4. `NpcDied` (or equivalent typed event) is delivered post-commit.
5. dependent domains react through idempotent commands/workflows.

A failed downstream Employment or Succession consumer cannot resurrect the NPC.

### 17.3 Dependent consequences

Post-death reactions may include:

- Employment termination/vacancy;
- Social grief/family changes;
- Guild/business leadership vacancy;
- Property/inheritance workflow;
- Contract/adventure branch changes;
- Reputation consequences;
- Knowledge discovery/rumour;
- Notifications;
- Succession cases.

Each domain changes only its own state.

## 18. Employment, vacancies and succession

### 18.1 Role owner remains authoritative

Employment owns ordinary civic/professional jobs and positions. Guilds, Consortiums and future government domains own their own role state where appropriate.

Succession never becomes the owner of a blacksmith job, guild master title or business directorship merely because it helps fill the vacancy.

### 18.2 Vacancy events drive succession

A death should not cause Succession to guess which roles existed.

Example:

1. NPC dies.
2. Employment consumes the death event through a normal idempotent command and terminates the job.
3. Employment emits an authoritative typed vacancy event.
4. Succession opens/updates the relevant vacancy case if policy says the role is replaceable.

Equivalent owner-specific vacancy events can later support Guilds, Consortiums, political offices and other domains.

### 18.3 Candidate priority

The approved search order is:

1. **Existing persistent candidates**
   - apprentice;
   - family member where appropriate;
   - employee;
   - qualified resident;
   - nearby professional;
   - traveller;
   - guild/faction candidate;
   - other persistent person whose real history supports the role.
2. **Materialise from a compatible local/regional anonymous cohort** if no suitable persistent person exists.
3. **Outsider/migrant** only when world conditions and mobility make that plausible.

Candidate discovery projections are advisory. Before commitment, Application reloads current authoritative owner snapshots and Core revalidates eligibility.

### 18.4 Candidate truth versus decision-maker knowledge

Objective eligibility can use authoritative truth: the person either has the necessary capability or does not.

Selection by an in-world institution/person should consider what that decision maker could reasonably know, using Knowledge/Reputation/Social inputs where gameplay requires it. Omniscient server truth must not silently become omniscient NPC decision-making.

### 18.5 Vacancy may persist

If no suitable candidate exists, the case remains unresolved.

The service may close or degrade. The world is allowed to have consequences.

### 18.6 Need pressure

A vacancy can accumulate or recalculate need pressure based on factors such as:

- service importance;
- population demand;
- duration of vacancy;
- settlement prosperity;
- war/disaster conditions;
- available apprentices/workforce;
- political/guild intervention;
- player actions.

Need pressure may increase the probability or attractiveness of:

- resident retraining;
- apprentice promotion;
- recruitment;
- migration;
- institutional intervention;
- player-supported solutions.

Need pressure never fabricates an impossible candidate and never guarantees a deadline.

### 18.7 Role-specific policy

Versioned Content can define succession policy/archetypes for different role classes.

Examples:

- ordinary trade: apprentice, hire, purchase, inheritance, migration;
- military command: chain of command;
- elected office: deputy/interim/election;
- hereditary office: heir/regency/dispute;
- guild leadership: governance-specific process;
- business ownership/directorship: domain-specific rules.

Unique roles may explicitly have no replacement policy.

### 18.8 Player influence

Where rules allow, players may influence succession through normal gameplay:

- recommend/support a candidate;
- recruit or fund relocation;
- help train someone;
- intervene in an election;
- expose disqualifying information;
- obstruct candidates through legal or illegal actions;
- create further vacancies through their actions.

Core and the owning domains decide what is legal/possible. Succession does not grant players direct appointment authority unless the world rules say they possess it.

## 19. Autonomous NPC action and executor identity

### 19.1 Infrastructure executor is not the in-world performer

Existing automated identities such as `nexis.scheduler` and `nexis.ciel` are trusted infrastructure executors.

They must not be presented in History as the person who went to work, travelled or made an in-world choice.

For autonomous NPC actions, preserve two concepts:

- **trusted executor/authority**: the registered System actor that submitted the command;
- **in-world performer/subject**: the typed `NpcId` whose action is being resolved.

Do not make an `NpcId` into an authentication credential.

A typed `WorldPerformerRef`/equivalent event or intent concept may be added if required, but it must remain separate from platform/security ActorContext.

### 19.2 CIEL proposed intentions

CIEL may propose an NPC intention such as travel, negotiate, buy, refuse, assist or flee.

The authoritative flow remains:

1. CIEL observes only authorized projections/context.
2. CIEL proposes typed intent.
3. registered System command ingress establishes trusted executor identity.
4. Application loads authoritative snapshots/content/time/RNG.
5. Core decides legality/outcome.
6. owners persist typed transitions.
7. History records the committed world performer and causation.

No CIEL direct database writes.

### 19.3 Deterministic ordinary life

Most ordinary NPC behaviour should not require LLM inference.

Rule-driven simulation should handle routine life such as:

- work cycles;
- ordinary travel/routines;
- ageing;
- basic shopping/resource needs where modeled;
- ordinary career progression;
- scheduled obligations;
- demographic processes.

CIEL is reserved for interactions and decisions where interpretation, dialogue or non-trivial planning actually adds value.

## 20. Persistence and indexing

### 20.1 No `npc_state` mega-row

This design explicitly prohibits a global mutable NPC document such as:

```text
npc_state {
  location,
  inventory,
  wallet,
  family,
  job,
  reputation,
  memories,
  skills,
  everything_else
}
```

Each owner persists its own typed facts behind private adapters.

### 20.2 Likely persistence needs

Implementation will require owner-specific tables/indexes for concepts such as:

- NPC lifecycle/identity;
- aggregate population cohorts;
- materialisation provenance/reservations;
- sparse Social edges;
- Employment state;
- succession cases;
- candidate/search projections;
- Active Cast/presence read models where persisted;
- Knowledge edges/facts;
- Scheduler due work.

Exact schema names and physical layout belong to implementation planning and migrations, not this architecture document.

### 20.3 Indexing priorities

Candidate/presence queries should be indexable by bounded keys such as:

- world/realm;
- region/settlement;
- lifecycle status;
- profession/role/skill category;
- availability;
- mobility;
- due time;
- stable NpcId.

Do not load millions of NPC objects into application memory to find twenty candidates.

### 20.4 Projection revalidation

Active Cast and candidate indexes may be eventually consistent because they are read models.

Any state-changing command based on their output must reload/revalidate current authoritative owner state before commit.

## 21. Idempotency, concurrency and recovery

### 21.1 Materialisation idempotency

A materialisation retry must never create two people or decrement a cohort twice.

Use the existing CommandId/fenced execution model plus a stable materialisation identity/reservation invariant sufficient to enforce exactly-once gameplay effect.

### 21.2 Population contention

Cohort counts use optimistic revisions or short conditional/locked updates appropriate to contention.

A materialisation requesting the last qualifying cohort member is a contested operation. Only one command may consume that final member.

### 21.3 Succession idempotency

Repeated vacancy events or retries must converge on one active succession case per vacancy identity/policy scope rather than creating duplicate recruitment processes.

### 21.4 Death idempotency

The same death command/event cannot kill the NPC twice or emit duplicate irreversible consequences.

A competing action against a now-dead NPC returns the appropriate conflict/rejection semantics after current lifecycle state is loaded.

### 21.5 Downstream event recovery

Post-commit consequences use EventId/idempotency as already required by V2.

A consumer outage delays a reaction; it does not roll back an already committed death or resurrect a person.

## 22. Scalability and backpressure

### 22.1 Complexity target

Runtime work should scale primarily with:

`active players + hot NPCs + due warm work + active world events`

not with total world population.

The number of persisted rows may scale with historical world age; the number of continuously executing agents must not.

### 22.2 No fixed population claim before evidence

This design targets eventual support for millions of persistent individuals plus much larger aggregate populations, but no specific hardware/population capacity is considered VERIFIED until representative load tests pass.

### 22.3 Processing priority

When overloaded, the simulation coordinator should prioritize approximately:

1. player-facing/hot authoritative commands;
2. safety/consistency-critical due work;
3. globally consequential warm events;
4. succession/materialisation needed for active gameplay;
5. routine catch-up/enrichment;
6. rebuildable analytics/projections.

Authoritative work is delayed with observable backlog rather than silently dropped.

### 22.4 Catch-up

A cold NPC that has not been touched for months/years should not replay every minute/day individually.

Where rules permit, Core resolves the elapsed interval from authoritative anchors, historical world events and controlled deterministic inputs.

If the elapsed interval contains globally consequential events that required immediate commitment, those should already exist as scheduled/world events rather than being retroactively invented.

### 22.5 High-cardinality telemetry guard

Operational metrics should expose bounded aggregates such as:

- total persistent living/dead NPCs;
- aggregate population size;
- cold/warm/hot counts;
- materialisation rate/failures;
- due-work backlog age;
- succession-case counts and oldest vacancy age;
- projection lag;
- mortality evaluation throughput/failures;
- History/event volume.

Do not use raw NpcId as an unbounded telemetry label.

## 23. Abuse and security boundaries

The system must assume players will discover any path that turns “meet a person” into “make the server generate expensive people forever”. Therefore:

- clients cannot choose materialisation seeds or directly mint NpcIds;
- clients cannot request arbitrary cohort extraction;
- materialisation requires a server-derived causal reason and rate/budget controls;
- repeated observation/query must not repeatedly materialise new people when an existing suitable person can be reused;
- provenance/random seeds are not exposed as prediction tools;
- client timestamps never determine age, due work or mortality;
- client claims about NPC location/life/relationship/job state are non-authoritative;
- CIEL input/output cannot bypass the normal authorization/command lane;
- admin corrections use normal audited Admin commands;
- Knowledge filtering prevents hidden history from leaking through projections/CIEL;
- materialisation and succession races are covered by concurrency/adversarial tests.

## 24. Rejected alternatives

### 24.1 Fully individual population from the beginning

Rejected as the default because it forces storage and simulation detail for people history never needs to individualise.

### 24.2 Pure aggregate population until every encounter

Rejected because meaningful relationships, roles, families and long-running candidates need real persistent individuals before direct player interaction.

### 24.3 One giant `Nexis.LivingWorld` owner

Rejected because it would recreate the global mutable-state problem V2 exists to eliminate.

“Living World” is the product feature, not a state-ownership boundary.

### 24.4 Continuous global NPC ticks

Rejected as the primary simulation model. Due work, elapsed-time resolution and player/event activation are more scalable and more deterministic.

Ticks may exist only for narrow mechanics that genuinely require them.

### 24.5 Instant role replacement

Rejected because it erases consequences and allows the UI's convenience to rewrite the world.

### 24.6 LLM-per-NPC simulation

Rejected because ordinary life does not require expensive inference, and LLM output cannot be authoritative gameplay truth without validation.

### 24.7 Silent history regeneration

Rejected because a person whose birthplace, parent or career changes whenever code updates is not persistent in any meaningful sense.

## 25. C# project/module direction

Subject to final solution naming review, the architecture expects concepts equivalent to:

### New authoritative/domain projects

- `Nexis.Npcs.Contracts`
- `Nexis.Modules.Npcs`
- `Nexis.Population.Contracts`
- `Nexis.Modules.Population`
- `Nexis.Succession.Contracts`
- `Nexis.Modules.Succession`

### New non-authoritative/runtime/projection projects

- `Nexis.Simulation.Contracts`
- `Nexis.Simulation`
- Active Cast projection project following existing projection naming conventions
- Population/candidate projection project(s) where useful

### Existing planned owners to implement/extend

- World
- Travel
- Social
- Reputation
- Employment
- Knowledge
- Scheduler

### Existing infrastructure to extend, not replace

- `Nexis.Core.Contracts`
- `Nexis.Core`
- `Nexis.Automation.Contracts`
- `Nexis.Eventing.Contracts`
- `Nexis.History.*`
- `Nexis.Content.*`
- `Nexis.Persistence.Postgres`
- CIEL contracts/runtime when that subsystem is implemented

No new module may bypass the existing command/Core/owner/eventing rules.

## 26. Suggested vertical-slice implementation order

This is sequencing guidance only, not an implementation plan.

1. **NPC lifecycle contract/owner proof**
   - NpcId, birth, living/dead, lifecycle revision, typed snapshot/transition, architecture guard.
2. **Population owner + atomic materialisation proof**
   - cohort count, reservation/transition, exactly-once materialisation, population conservation.
3. **Progressive provenance/history resolution foundation**
   - versioned provenance, unresolved/resolved fact rules, contradiction guard.
4. **Travel/presence + Active Cast proof**
   - one shared NPC presence, player-specific relevance projection, stale projection revalidation.
5. **Mortality/death proof**
   - sparse lifecycle evaluation, causal death, idempotent `NpcDied`, resurrection-compatible lifecycle model.
6. **Social/family proof**
   - sparse edges, bounded household materialisation, no recursive explosion.
7. **Employment + vacancy + Succession proof**
   - death -> employment vacancy -> open case -> persistent candidate -> aggregate candidate -> unresolved vacancy.
8. **Knowledge/History proof**
   - hidden death/crime, discovery, belief versus truth, no projection leak.
9. **Simulation/Scheduler runtime proof**
   - cold/warm/hot, due-work budgets, deterministic catch-up, backpressure.
10. **CIEL intention/dialogue integration proof**
    - CIEL proposes; Core/owners decide; no direct writes.
11. **Scale/recovery/adversarial programme**
    - synthetic large populations, concurrent materialisation, due backlog, succession load, History growth, crash recovery.

Do not fan out all modules simultaneously merely to fill the ownership matrix.

## 27. Required test programme

Implementation slices must add tests appropriate to their boundary. The eventual system requires at least the following classes of evidence.

### Architecture/ownership

- NPC lifecycle has one writer.
- Population cohorts have one writer.
- Succession cannot write Employment/Guild/Population/NPC tables directly.
- Simulation/Scheduler/CIEL cannot write gameplay-owner tables directly.
- no global mutable `NpcState`/`LivingWorldState`/generic property bag appears.

### Materialisation/population

- materialisation conserves population exactly;
- retry with same CommandId creates one identity;
- two concurrent requests cannot consume one final cohort member twice;
- NPC creation failure rolls cohort decrement back;
- living relatives consumed from cohorts are not double counted;
- historical deceased relative materialisation does not change current living population;
- client cannot directly request arbitrary materialisation/seed.

### Progressive history

- repeated unresolved-fact resolution under the same committed context is deterministic where required;
- resolved authoritative fact cannot be silently overwritten by later enrichment;
- enrichment cannot contradict birth, family, employment or world history already committed;
- generator/content/rule versions required for replay are retained.

### Ageing/mortality

- chronological age is derived from authoritative time and birth history;
- leap/calendar boundaries are defined and tested;
- relevance tier does not change mortality semantics;
- off-screen death always has a validated typed cause;
- death is idempotent;
- resurrection does not delete original death history.

### Presence/concurrency

- two players observe the same NpcId/state;
- incompatible duplicate location is rejected;
- stale Active Cast result cannot authorize a mutation;
- concurrent soft dialogue plus death/hire/travel reconciles correctly;
- contested hard commands obey revisions/lock policy.

### Succession

- existing persistent eligible candidate is considered before aggregate materialisation;
- aggregate candidate materialisation occurs only when no suitable persistent candidate is selected under policy;
- outsider migration requires valid world/mobility conditions;
- no candidate leaves vacancy open without fabricating one;
- duplicate vacancy events converge on one case;
- stale candidate state revalidates before appointment;
- need pressure changes search/recruitment behaviour without bypassing eligibility.

### Knowledge/history

- authoritative truth does not automatically become actor knowledge;
- hidden death/crime does not leak through public projection/CIEL;
- later discovery can reveal partial facts without revealing unknown perpetrator;
- actor belief can differ from world truth without overwriting truth.

### Scale/recovery

Representative PostgreSQL environments should benchmark increasing synthetic scales, including millions of population/persistent rows where practical, while measuring:

- indexed candidate lookup;
- materialisation throughput;
- Active Cast query latency;
- due-work backlog processing;
- history/outbox growth;
- cold->hot activation;
- concurrent player contention on popular NPCs;
- crash/retry exactly-once behavior;
- projection rebuild behavior.

No hardware/population limit is a release claim until observed under a documented environment.

## 28. Failure behavior

The system fails closed around authoritative state.

Examples:

- cohort exhausted -> Conflict/Rejected according to rule; do not create population;
- stale candidate -> re-evaluate or defined Conflict; do not appoint stale state;
- missing exact content version -> fail explicitly; do not fall back to “latest”;
- materialisation technical failure -> no partial person/cohort loss;
- CIEL unavailable -> deterministic gameplay remains functional; dialogue/intelligence may degrade gracefully without inventing authority;
- projection unavailable -> mutation can still use owner state where the command path supports it; projection is never authority;
- Scheduler backlog -> due work remains durable/observable and catches up; do not silently mark gameplay completed;
- downstream death consumer failure -> death remains committed and consumer retries;
- no succession candidate -> vacancy persists.

## 29. Acceptance criteria for the architecture

The design is considered correctly implemented only when all applicable future slices demonstrate that:

1. persistent NPC identity/lifecycle has exactly one authoritative owner;
2. aggregate anonymous population has exactly one authoritative owner;
3. persistent and anonymous representations conserve population;
4. materialisation is atomic/idempotent and permanent;
5. biography expands without contradiction or silent regeneration;
6. 1:1 ageing requires no continuous age writes;
7. natural mortality is sparse, reproducible and causal;
8. death can occur off-screen without becoming arbitrary or omniscient;
9. saving/killing produces durable consequences through normal owner events;
10. persistent NPCs share one physical reality across all players;
11. concurrent soft interactions do not create duplicate persons/state;
12. hard interactions use normal command/Core/concurrency rules;
13. Active Cast is a projection, not authority;
14. succession replaces roles rather than identities;
15. vacancy can remain unresolved;
16. candidate priority follows persistent -> aggregate materialisation -> plausible outsider;
17. need pressure cannot fabricate impossible candidates;
18. Knowledge remains distinct from History/world truth;
19. CIEL cannot directly mutate gameplay truth;
20. simulation cost follows active/due work rather than total population;
21. no global NPC/LivingWorld blob appears;
22. recovery/idempotency prevents duplicate people, deaths, appointments and demographic changes;
23. canonical Nexis world/lore remains additive and preserved;
24. scale claims are evidence-backed rather than aspirational labels.

## 30. Documentation changes required after final approval

After George approves this consolidated written specification, implementation planning should include deliberate reconciliation of the binding V2 documents before or alongside the first owning-contract slice:

- `v2/docs/STATE-OWNERSHIP.md`
  - add NPC lifecycle owner;
  - add Population owner;
  - add Succession workflow owner;
  - clarify Travel ownership for persistent NPC location;
  - clarify Knowledge support for NPC knowledge where adopted;
  - clarify Simulation as non-authoritative.
- `v2/docs/CORE-ARCHITECTURE.md`
  - add living-world/NPC examples without changing Core's role.
- `v2/docs/COMMAND-EXECUTION.md`
  - document autonomous NPC performer versus trusted System executor where required.
- `v2/docs/CANON-AND-LORE.md`
  - record the approved 1:1 ageing and persistent-life consequences only if classified as durable world/product canon rather than purely mechanics.
- `v2/docs/AGENT-HANDOFF.md` / `IMPLEMENTATION-STATUS.md`
  - update only when implementation status or workflow truth actually changes.
- `CHANGELOG.md`
  - record each direct implementation/documentation slice with evidence.

The global Voidsmith Source of Truth does not need this project-local detail unless implementation later changes shared infrastructure, hosting, security or cross-project operational truth.

## 31. Implementation status

At the time this design was written:

- the living-world architecture in this document is **DESIGNED, NOT IMPLEMENTED**;
- existing V2 foundation contracts provide command, Core, eventing, replay and persistence mechanisms that the design intends to reuse;
- NPC lifecycle, aggregate Population, Succession and Simulation components described here do not yet exist as implemented gameplay modules;
- no live Nexis deployment, production migration or public capability claim is authorized by this document;
- no V1/live database mutation is authorized;
- human approval was received on 2026-09-16; implementation planning is authorized, but implementation has not started.
