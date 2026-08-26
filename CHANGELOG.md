# Changelog

## 2026-08-26

### Nexis 2.0 first real gameplay vertical, recovery and durable delivery foundation
- completed the missing default Core composition for the first real rule by registering `EquipItemRuleEvaluator` in `Nexis.Core.Reference`; unsupported intents still fail closed, while the reference engine now actually executes the approved Equipment vertical
- added stable Items, Inventory, Equipment and Combat contract boundaries plus exact-version Content Registry contracts/implementation without introducing generic mutable state or content blobs
- implemented `EquipItem` as a deterministic Core rule using trusted actor identity, Inventory possession, Equipment state, Combat participation and exact typed item content; Core emits only an Equipment-owner transition plus semantic event
- added real PostgreSQL Equipment-owner persistence with optimistic revision enforcement, authoritative history/outbox integration and multi-slot binding support
- added canonical value-equal `EquipmentSlotSet` semantics across Equipment placement/state/output contracts so replay/conformance compares domain values rather than backing collection object identity
- implemented durable command execution leases, stale-claim recovery, lease renewal/fencing and ambiguous commit reconciliation while preserving the original CommandId/receipt authority
- implemented leased at-least-once PostgreSQL outbox delivery with multi-worker `SKIP LOCKED` claiming, expiring leases, stable EventId redelivery identity, publication acknowledgement, failure-delay release and idempotent PostgreSQL projection checkpoints
- corrected a nondeterministic outbox seam where `available_at_utc` relied on PostgreSQL wall-clock `now()`; normal atomic command commits now persist the authoritative command completion time explicitly as initial delivery availability
- V2 CI caught two genuine integration defects during this pass: the real EquipItem evaluator was not registered in the default Core, and replay-equal Equipment outputs compared unequal because `ReadOnlyCollection` uses reference equality; both were fixed at the responsible boundaries rather than weakening tests
- after the fixes, checkpoint `e1eaf9fe2e2afe9629cc2633ddb7dcf2e7ad767c` passed the complete workflow: Release build **0 warnings / 0 errors**, architecture/Core/execution/security suite **101 passed / 0 failed / 0 skipped**, PostgreSQL integration suite **28 passed / 0 failed / 0 skipped**
- the PostgreSQL suite now proves the real EquipItem end-to-end commit, stale Equipment revision rollback, multi-slot persistence, command crash recovery, lease fencing, ambiguous reconciliation, independent outbox worker claiming, lease recovery/redelivery and atomic idempotent projection handling
- refreshed `v2/docs/IMPLEMENTATION-STATUS.md` so Claude/Codex no longer treat already-completed outbox/recovery/first-owner work as pending; the next safe foundation boundary is scheduler/CIEL mutation-bypass prevention
- bumped the reference Core implementation identifier to `0.5.0-foundation`; stable Core contract remains V1
- no live/V1 code, production database, deployment or PR merge was performed; PR #4 remains draft
- player impact: none yet; this is isolated Nexis 2.0 architecture, persistence and first-owner gameplay proof
- risk level: moderate but contained; the first real gameplay vertical is green, while broad gameplay fan-out remains blocked by the remaining foundation stop conditions

### Nexis 2.0 command lifecycle, atomic execution and audit foundation
- added separate `Nexis.Execution.Contracts` and `Nexis.Execution` boundaries for authoritative command receipt/idempotency and Application-layer execution coordination without introducing persistence types into Core or stable gameplay contracts
- bound each CommandId to a stable trusted actor identity, typed intent contract and server-derived SHA-256 payload fingerprint; retries with changed actor/type/payload are explicit integrity violations, while capability/entitlement/security-version changes remain current facts to revalidate rather than changing command identity
- preserved the first accepted CorrelationId across transport retries and added duplicate-in-progress / duplicate-completed behavior so a completed retry returns the stored terminal outcome instead of running gameplay again
- added `CommandExecutionTrace` and an all-or-nothing `CommandCommitPlan` carrying exact Core implementation/contract/rule/content provenance, typed owner transitions, proposed terminal command outcome and authoritative event envelopes; Core `Succeeded` is explicitly not durable success until the atomic committer reports `Committed`
- deliberately kept command-receipt completion out of the standalone receipt repository so owner state, terminal outcome, history/events, state-changing Admin audit and durable outbox cannot be committed through independent convenience calls
- added canonical multi-resource lock ordering by owner/type/id using ordinal comparison and a bounded whole-command retry executor that retries only infrastructure-classified transient failures, reruns the complete attempt from fresh state, respects the configured bound and never converts caller cancellation into a retry
- split the previous raw-Guid Audit placeholder into stable `Nexis.Audit.Contracts` plus replaceable `Nexis.Modules.Audit`; audit records now use typed AccountId/CorrelationId/EventId primitives and preserve append-only correction/reversal semantics
- integrated every Admin command attempt, including rejected attempts, with at least one audit entry in the same atomic command plan; the audit actor must match the trusted Admin Account and the audit correlation must match the original command correlation
- added `COMMAND-LIFECYCLE-CONTRACTS.md`, `ATOMIC-COMMAND-COMMIT.md`, `CONCURRENCY-EXECUTION.md` and `AUDIT-BOUNDARY.md`; updated rolling implementation status to distinguish completed seams from the still-missing production persistence/owner proof
- CI caught one deliberately strict dependency allow-list mismatch while the new execution assembly legitimately referenced Kernel; the allow-list was corrected narrowly rather than weakening the dependency guard
- the command receipt/idempotency, atomic commit, lock/retry, Audit split and atomic Admin-audit slices have all passed the V2 restore/build/test workflow after their latest fixes with Release warnings treated as errors
- no PostgreSQL/Npgsql adapter, owner-specific gameplay persistence, live database mutation, V1 change or deployment was introduced; PR #4 remains draft
- player impact: none; this is isolated Nexis 2.0 authoritative execution/history/security infrastructure
- risk level: low to moderate; the contracts are test-covered, but production persistence and the required multi-owner rollback proof remain blocking foundation work

### Nexis 2.0 Identity contracts and trusted Core actor boundary
- split `AccountId`, `CharacterId` and `AccountRole` out of the placeholder Identity implementation into the stable `Nexis.Identity.Contracts` assembly, preserving permanent Account/Character type separation before other systems can couple to the implementation project
- kept `AccountRole` as a named account/staff classification only; Core actor authority is represented by current server-derived capability keys rather than ordinal role comparisons
- added universal Player/Admin/System/Realtime mutation-lane vocabulary to `Nexis.Kernel`; read-only query work remains outside mutation-lane semantics
- added immutable server-created `TrustedActorContext` with distinct Player, Staff and System shapes, current security version, effective platform capabilities and separate commercial entitlements
- Player/Realtime actor context carries AccountId + CharacterId; Staff/Admin context carries the acting Account but deliberately no Character impersonation identity; System context carries no account/character identity
- integrated trusted actor context into every `CoreEvaluationContext` and internal rule-dispatch execution context so rules receive authoritative actor facts alongside time, versions, snapshots/content and deterministic RNG
- updated dependency guards so concrete Core may consume `Nexis.Kernel` and stable `*.Contracts` packages while continuing to reject feature implementation/Host/persistence dependencies
- CI caught and rejected tautological enum-value assertions through MSTest analyzer MSTEST0032; the ceremonial assertions were removed rather than suppressing the analyzer
- Identity split and trusted actor changes are restore/build/test verified by the V2 CI workflow after their latest fixes; no v1/live code, database or deployment path was touched
- added `v2/docs/IMPLEMENTATION-STATUS.md` and wired both `v2/AGENTS.md` and `v2/CLAUDE.md` to read it so Claude/Codex see current implementation progress without turning a status file into a competing architecture rulebook
- player impact: none; this is isolated Nexis 2.0 authority/contract infrastructure
- risk level: low to moderate; the boundary is pre-gameplay and test-covered, while the remaining foundation gates still block broad system implementation and PR #4 remains draft

### Nexis 2.0 Core CI verification and internal rule dispatch
- added a V2-only GitHub Actions verification workflow that restores, builds and tests the isolated `v2/` solution without touching the current/live application
- corrected CI so commands run from `v2/`, ensuring `v2/global.json` is discovered; the configured `latestFeature` roll-forward currently resolves .NET SDK 10.0.400 while preserving the approved .NET 10 line
- enabled the .NET 10 Microsoft.Testing.Platform runner in `global.json` and changed CI to the MTP `dotnet test --project` form with a minimum-test-count guard
- CI caught obsolete MSTest 4 `Assert.ThrowsException` calls before merge; tests were corrected to `Assert.ThrowsExactly`
- observed green baseline at commit `d5b83b1799691e9aa38266eb52279d74b0fea0bc`: restore succeeded, Release build completed with 0 warnings/0 errors, and all 25 architecture/Core conformance tests passed with 0 failures/skips
- added explicit internal Core rule dispatch keyed by typed intent contract name + schema version; duplicate registrations are rejected and unregistered intents remain mutation-free TechnicalFailure outcomes
- kept `CoreRuleExecutionContext` and `ICoreRuleEvaluator` internal to the concrete Core, with friend access only for architecture tests, so surrounding systems still depend exclusively on `ICoreRulesEngine`/stable contract assemblies
- each dispatched evaluation receives exactly one fresh deterministic RNG stream; evaluator exceptions/null results are treated as implementation defects rather than converted into fake in-world outcomes
- concrete `Nexis.Core` may directly reference the tiny `Nexis.Kernel` substrate and stable `*.Contracts` assemblies required by typed rule inputs; it still has no feature-module, persistence, network or UI dependencies
- dispatch commit `f316738197e54588310087c8b390d9facdff7c5c` passed the V2 restore/build/test workflow
- player impact: none; these changes are isolated Nexis 2.0 Core architecture/verification infrastructure
- risk level: low to moderate; broad gameplay implementation remains blocked by the larger foundation stop conditions and PR #4 remains draft

### Nexis 2.0 deterministic Core arithmetic
- added `Nexis.Core.Numerics.DeterministicIntegerMath` as the reference Core's exact integer/rational calculation primitive for authoritative ratios, percentages and multipliers without default floating-point semantics
- added explicit rounding modes for toward-zero, away-from-zero, floor, ceiling, nearest-even and nearest-away-from-zero behavior so each versioned gameplay formula must choose its rounding semantics deliberately
- used `Int128` multiplication intermediates with checked narrowing back to `long`, preventing valid wide-intermediate calculations from overflowing early while also preventing final authoritative values from silently wrapping
- invalid rounding modes and zero denominators now fail explicitly; overflow remains a technical/configuration error rather than being converted into an in-world result
- added tests for positive/negative midpoint behavior, negative-denominator normalization, wide intermediates, checked overflow, invalid rounding configuration and exact ratio calculations
- added `v2/docs/CORE-NUMERIC-DETERMINISM.md` defining the cross-runtime numeric contract, floating-point restrictions, overflow policy and formula-version implications without choosing any gameplay balance values
- verification status at the time of this entry was provisional; the newer Core CI verification entries above supersede it
- player impact: none; this establishes deterministic Core arithmetic infrastructure only and does not implement or change any live gameplay formula
- risk level: low to moderate; this deliberately fixes numeric semantics before domain rules depend on them

### Nexis 2.0 Core conformance and deterministic replay seam
- replaced the raw mutable RNG cursor in `CoreEvaluationContext` with an `IDeterministicRandomFactory`, so each Core evaluation receives a fresh deterministic stream from the same retained authoritative RNG inputs instead of silently advancing an earlier speculative evaluation
- added explicit typed `ICoreContentInput` support to `CoreEvaluationRequest`, keeping versioned Content Registry definitions outside the concrete Core while still supplying the exact definitions required for one rule evaluation
- hardened `CoreContractVersion`/`CoreImplementationDescriptor` validity checks and bumped the reference Core implementation descriptor to `0.2.0-foundation` without changing the public Core contract version
- added a reusable golden-scenario conformance harness that can run one implementation against expected semantics or compare baseline and candidate Core implementations using fresh equivalent requests
- added tests proving compatible replacement equivalence, deliberate divergence detection, repeatable RNG-backed results on re-evaluation, immutable snapshot/content request capture and invalid default contract-version rejection
- added `v2/docs/CORE-CONFORMANCE-HARNESS.md` documenting scenario construction, semantic comparison, replay-safe RNG requirements, Content Registry inputs and the ordered next Core slices
- verification status at the time of this entry was provisional; the newer Core CI verification entries above supersede it
- player impact: none; this is isolated Nexis 2.0 architecture/test infrastructure and does not alter the current/live game
- risk level: low to moderate; the changes deliberately tighten a pre-release contract before gameplay systems depend on it

### Nexis 2.0 replaceable Core implementation foundation
- introduced a separate `Nexis.Core.Contracts` assembly so surrounding systems can target a stable engine-facing boundary without compiling against the concrete `Nexis.Core` implementation
- added universal `CommandId` and deterministic RNG abstractions to `Nexis.Kernel`, complementing the existing authoritative game-clock and event/correlation primitives
- added versioned typed Core contracts for intents, authoritative owner snapshots, owner-addressed transitions, semantic event descriptors and typed result payloads without introducing a universal mutable PlayerState/RuntimeState contract
- added authoritative Core evaluation context carrying CommandId, CorrelationId, UTC evaluation time, gameplay rule version, content version and a controlled deterministic RNG source
- added the initial `ICoreRulesEngine` replacement seam and a reference `CoreRulesEngine` shell which rejects unsupported contract/intent work as TechnicalFailure without producing state transitions
- concrete `Nexis.Core` initially depended only on `Nexis.Core.Contracts`; later foundation work deliberately added `Nexis.Kernel` and stable Identity contracts while preserving the prohibition on feature implementation/persistence dependencies
- converted `Nexis.Architecture.Tests` from a placeholder project to `MSTest.Sdk/4.3.3` and added initial dependency-direction, infrastructure-leak, fake/replacement-Core and Core-decision behaviour tests
- updated `v2/Nexis.slnx` and `v2/docs/FOUNDATION.md` to reflect the new contract boundary and explicitly preserve the no-global-player-state rule
- verification status at the time of this entry was provisional; the newer Core CI verification entries above supersede it
- player impact: none; this is isolated Nexis 2.0 foundation code and does not alter the current/live game
- risk level: low to moderate; architecture is isolated and intentionally minimal

### Nexis 2.0 gameplay-mode clarification
- corrected the v2 design record so **Adventures** preserve their original instant-resolution role, closest in interaction pattern to Torn Crimes: choose an action and receive an immediate server-authoritative result
- moved the recently discussed timed expedition model to its intended home under **Excursions**, including preparation, supplies, standing orders, asynchronous encounters, discoveries, injuries and return/resolution
- kept **DMOS One-Shots / Scenarios** as a third distinct player-facing mode for curated scene-by-scene interactive narrative
- explicitly allowed these modes to share lower-level Core components such as combat, checks, rewards, encounters and history while prohibiting them from being collapsed into one undifferentiated Adventure engine
- clarified that deeper exploration and rare world discovery belong primarily to Excursions/world content rather than redefining Adventures as long-duration expeditions
- player impact: none yet; this corrects the Nexis 2.0 design record before implementation
- risk level: low; documentation-only change on the isolated v2 branch

## 2026-08-25

### Nexis 2.0 foundation skeleton
- created an isolated `v2/` implementation root so the live/current Nexis code remains untouched during the parallel rebuild
- established a .NET 10 solution with `Nexis.Kernel`, `Nexis.Core`, initial Identity and Audit modules, an API composition host, and an architecture-test project placeholder
- added authoritative game-clock and immutable domain-event metadata contracts with event ID, UTC occurrence time, correlation, causation and schema version
- established server-side account/character identity and role vocabulary without name-based authority
- established the approved administrator audit visibility boundary: all meaningful privileged activity remains internally auditable, while only material player-state effects are eligible for player-facing projection
- documented strict dependency direction, persistence separation, migration isolation and pre-gameplay testing gates in `v2/docs/FOUNDATION.md`
- added `v2/docs/CORE-ARCHITECTURE.md`, defining `Nexis.Core` as the authoritative rules/logic/calculation machine while keeping its concrete implementation replaceable behind stable versioned contracts; surrounding systems retain persistent state/data/interfaces, Core returns authoritative decisions/transitions, and Core replacements require conformance/golden-scenario plus shadow-cutover safeguards
- extended the Core architecture with a production-derived replay corpus requirement: detailed authoritative traces must preserve/reconstruct the state, intent, rule/content versions, controlled time/RNG inputs, outputs, events and performance data needed to replay real historical scenarios against future Core versions; known bugs, edge cases, exploit attempts and high-value operations become permanent regression/adversarial packs
- added `v2/docs/CORE-RELEASE-GATE.md`, requiring every candidate Core to complete a minimum 30-day isolated soak on a fresh production-like VPS with no production write path, using deterministic replay, diverse AI adversarial testing and independent Voidsmith staff manual testing in parallel with cross-reproduction and human release sign-off
- added `v2/docs/COMPONENT-RELEASE-GATE.md`, generalizing the same discipline to every material Nexis component replacement/version upgrade. Never treat Core as the only moving part requiring proof. Emergency hotfixes/ordinary low-risk maintenance are a separate release class, not a loophole for calling an upgrade a patch.
- explicitly prohibited AI-only testing or AI-only release approval for material Nexis upgrades; human-only and automated-only testing are also insufficient by themselves for major replacements
- added `v2/docs/COMMAND-EXECUTION.md`, defining the researched authoritative mutation model: specialized player/admin/system/realtime execution lanes, a separate query path, stable CommandId/idempotency, server-derived actor context, authoritative-time revalidation, hybrid optimistic/selective-lock concurrency, canonical multi-resource lock ordering, atomic state/event/outbox commits and bounded whole-transaction retries
- added `v2/docs/IDENTITY-AUTHORIZATION.md`, defining permanent Account/Character separation, one playable character per normal account initially, immutable public player identity, external-provider-to-Account mappings, capability/policy-based staff authority, entitlement/domain-role separation, audited admin support behavior and the Hennet public/private authority boundary
- added `v2/docs/STATE-OWNERSHIP.md`, defining one authoritative write owner per persistent state concept; rejecting a global mutable PlayerState/runtime/qualities/counters model; separating Progression, Resources, Cooldowns, Inventory, Equipment, Effects, Economy, Marketplace, World, Travel, Hospital, Justice, Combat, Education, Skills, Magic, Spirits, Guilds, Consortiums, Knowledge, Recognition and other bounded contexts; and defining typed snapshot/transition contracts plus explicit atomic multi-owner orchestration for cross-system operations
- reconciled `v2/docs/COMMAND-EXECUTION.md`, `v2/docs/CORE-ARCHITECTURE.md` and `v2/docs/AGENT-HANDOFF.md` with the approved Core and State Ownership model: Application gathers current owner snapshots and coordinates transactions, Core alone owns gameplay rule/calculation evaluation, Content Registry owns versioned static definitions, and authoritative systems persist only typed transitions addressed to the state they own
- added `v2/docs/ENGINEERING-MANUAL.md` as the canonical instruction manual shared by Claude Code, Codex, ChatGPT/OpenAI agents, Gemini, future model families and human engineers; it fixes one common architecture/quality/security/testing/Definition-of-Done standard, explicitly prevents rogue rewrites or agent-specific architecture, and requires every spawned sub-agent to inherit the same constraints
- added `v2/docs/WORK-ORDER-TEMPLATE.md` so substantial tasks can be given to all agents with the same objective, scope, owners, contracts, acceptance criteria, verification and rollback requirements
- added `v2/AGENTS.md` as the short Codex/general-agent entrypoint and `v2/CLAUDE.md` as the Claude Code adapter importing the same canonical docs; model-specific entry files are intentionally not alternative rulebooks
- added repository-root `AGENTS.md` and `CLAUDE.md` guards so agents launched from the repository root are directed into the same v2 manual before making v2 changes and are explicitly prevented from treating the current application outside `v2/` as free foundation-work scope
- added `v2/docs/CANON-AND-LORE.md` to preserve current approved Nexis world identity independently of legacy implementation data: Silverbough is the magic/Mana/item-infusion academy; Ironhall is the dwarven/gnomish crafting, engineering and building centre; Akai Tetsu Dojo is the Edo-Japan-inspired combat/tactics academy; the Sacred Grove is the island directly south of Nexis City teaching Druidic/Shamanic healing and gifted resurrection magic; and Blackharbor/Highcourt are one shared city/academy whose first three lessons branch into mutually exclusive Light bounty-hunter/capture and Shadow headhunter/assassin kill-or-capture specializations with costly, cooldown-gated, escalating path switching while retaining previously completed training
- clarified canon provenance from the recovered early Nexis snapshot and human design history: Akai Tetsu predates Ironhall; Ironhall was explicitly conceived later as a new additional dwarven/tinkering/crafting city; the 17 May city-normalization work incorrectly replaced Akai Tetsu with Ironhall rather than expanding the world; new world elements are therefore additive by default and implementation limits such as fixed compass slots/enums may never silently delete, merge or alias existing canon
- marked conflicting v1 city/academy aliases and academy-role data as preservation/migration evidence rather than current canon, and required both Codex/general agents and Claude to read the canon manifest for world/gameplay/content/migration work
- updated the Claude Code/Codex handoff so agents must preserve Core replaceability, state ownership, command execution and identity/authorization contracts and prove dependency/ownership boundaries, multi-owner rollback, scheduler/CIEL bypass prevention, duplicate-execution, stale-state, concurrency and privilege protections before broad gameplay systems begin
- player impact: none yet; this is parallel Nexis 2.0 engineering infrastructure and does not alter the live game
- risk level: low because the new tree is isolated from the current application and no live schema or runtime path is changed

## 2026-04-19

### Ashen Crown page-enrichment and shell pass
- standardized major player-facing pages around page flavor text plus a dedicated CIEL guidance panel
- upgraded Home, City, Travel, Academies, Education, Adventure, Inventory, Market, Guilds, Consortiums, Estate Office, Black Market, Hospital, Bank, Contacts, Skills, Achievements, and Profile to use the same voice and structure
- introduced shared CIEL page copy, city copy, empty-state microcopy, and rotating quote data for broader reuse
- polished the shell by wiring public top-bar navigation, aligning sidebar branding with Ashen Crown as the world brand and Nexis as the shard/capital context, and adding a sidebar CIEL quote strip
- added a route-transition CIEL quote overlay so navigation now has a brief in-game loading feel instead of snapping coldly between pages
- removed an orphaned `src/pages/Contacts.tsx` stub after routing consolidated on the public `Contact.tsx` page
- player impact: the game now reads more like a coherent browser RPG instead of a collection of disconnected placeholder panels
- risk level: low to moderate, because the pass is mostly UI and copy integration but touches shared shell components
- follow-up: run a clean GitHub-backed build verification, resolve any remaining stale metadata such as package-lock naming, and deploy only from the AshenCrown repository