# Changelog

## 2026-08-26

### Nexis 2.0 Core conformance and deterministic replay seam
- replaced the raw mutable RNG cursor in `CoreEvaluationContext` with an `IDeterministicRandomFactory`, so each Core evaluation receives a fresh deterministic stream from the same retained authoritative RNG inputs instead of silently advancing an earlier speculative evaluation
- added explicit typed `ICoreContentInput` support to `CoreEvaluationRequest`, keeping versioned Content Registry definitions outside the concrete Core while still supplying the exact definitions required for one rule evaluation
- hardened `CoreContractVersion`/`CoreImplementationDescriptor` validity checks and bumped the reference Core implementation descriptor to `0.2.0-foundation` without changing the public Core contract version
- added a reusable golden-scenario conformance harness that can run one implementation against expected semantics or compare baseline and candidate Core implementations using fresh equivalent requests
- added tests proving compatible replacement equivalence, deliberate divergence detection, repeatable RNG-backed results on re-evaluation, immutable snapshot/content request capture and invalid default contract-version rejection
- added `v2/docs/CORE-CONFORMANCE-HARNESS.md` documenting scenario construction, semantic comparison, replay-safe RNG requirements, Content Registry inputs and the ordered next Core slices
- verification status: static review completed for this slice, but the current execution environment still has no .NET SDK and no GitHub Actions run exists, so restore/build/test evidence remains mandatory before the branch is green
- player impact: none; this is isolated Nexis 2.0 architecture/test infrastructure and does not alter the current/live game
- risk level: low to moderate; the changes deliberately tighten a pre-release contract before gameplay systems depend on it, but compilation/test verification is still pending

### Nexis 2.0 replaceable Core implementation foundation
- introduced a separate `Nexis.Core.Contracts` assembly so surrounding systems can target a stable engine-facing boundary without compiling against the concrete `Nexis.Core` implementation
- added universal `CommandId` and deterministic RNG abstractions to `Nexis.Kernel`, complementing the existing authoritative game-clock and event/correlation primitives
- added versioned typed Core contracts for intents, authoritative owner snapshots, owner-addressed transitions, semantic event descriptors and typed result payloads without introducing a universal mutable PlayerState/RuntimeState contract
- added authoritative Core evaluation context carrying CommandId, CorrelationId, UTC evaluation time, gameplay rule version, content version and a controlled deterministic RNG source
- added the initial `ICoreRulesEngine` replacement seam and a reference `CoreRulesEngine` shell which rejects unsupported contract/intent work as TechnicalFailure without producing state transitions
- changed concrete `Nexis.Core` so its only Nexis project dependency is `Nexis.Core.Contracts`; the contract assembly depends only on the deliberately small `Nexis.Kernel`
- converted `Nexis.Architecture.Tests` from a placeholder project to `MSTest.Sdk/4.3.3` and added initial dependency-direction, infrastructure-leak, fake/replacement-Core and Core-decision behaviour tests
- updated `v2/Nexis.slnx` and `v2/docs/FOUNDATION.md` to reflect the new contract boundary and explicitly preserve the no-global-player-state rule
- verification status: code has been statically reviewed, but the current execution environment has no .NET SDK and cannot clone GitHub over outbound DNS; no GitHub workflow run exists for the pushed commit, so restore/build/test evidence remains required before the branch is considered green
- player impact: none; this is isolated Nexis 2.0 foundation code and does not alter the current/live game
- risk level: low to moderate; architecture is isolated and intentionally minimal, but compilation/test verification is still pending

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
- added `v2/docs/COMPONENT-RELEASE-GATE.md`, generalizing the same evidence-first release discipline to every replaceable Nexis moving part: isolated production-like proving environment, immutable candidate build, historical replay where applicable, deterministic automation, diverse AI testing, mandatory human manual validation, parallel comparison, soak, promotion blockers and rollback
- explicitly prohibited AI-only testing or AI-only release approval for material Nexis upgrades; human-only and automated-only testing are also insufficient by themselves for major replacements
- added `v2/docs/COMMAND-EXECUTION.md`, defining the researched authoritative mutation model: specialized player/admin/system/realtime execution lanes, a separate query path, stable CommandId/idempotency, server-derived actor context, authoritative-time revalidation, hybrid optimistic/selective-lock concurrency, canonical multi-resource lock ordering, atomic state/event/outbox commits and bounded whole-transaction retries
- added `v2/docs/IDENTITY-AUTHORIZATION.md`, defining permanent Account/Character separation, one playable character per normal account initially, immutable public player identity, external-provider-to-Account mappings, capability/policy-based staff authority, entitlement/domain-role separation, audited admin support behavior and the Hennet public/private authority boundary
- added `v2/docs/STATE-OWNERSHIP.md`, defining one authoritative write owner per persistent state concept; rejecting a global mutable PlayerState/runtime/qualities/counters model; separating Progression, Resources, Cooldowns, Inventory, Equipment, Effects, Economy, Marketplace, World, Travel, Hospital, Justice, Combat, Education, Skills, Magic, Spirits, Guilds, Consortiums, Knowledge, Recognition and other bounded contexts; and defining typed snapshot/transition contracts plus explicit atomic multi-owner orchestration for cross-system operations
- reconciled `v2/docs/COMMAND-EXECUTION.md`, `v2/docs/CORE-ARCHITECTURE.md` and `v2/docs/AGENT-HANDOFF.md` with the approved Core and State Ownership model: Application gathers current owner snapshots and coordinates transactions, Core alone owns gameplay rule/calculation evaluation, Content Registry owns versioned static definitions, and authoritative systems persist only typed transitions addressed to the state they own
- added `v2/docs/ENGINEERING-MANUAL.md` as the canonical instruction manual shared by Claude Code, Codex, ChatGPT/OpenAI agents, Gemini, future model families and human engineers; it fixes one common architecture/quality/security/testing/Definition-of-Done standard, explicitly prevents rogue rewrites or agent-specific architecture, and requires every spawned sub-agent to inherit the same constraints
- added `v2/docs/WORK-ORDER-TEMPLATE.md` so substantial tasks can be given to all agents with the same objective, scope, state owners, Core responsibilities, contract permissions, persistence/concurrency expectations, security cases, acceptance criteria, tests and deployment authority
- added `v2/AGENTS.md` as the short Codex/general-agent entrypoint and `v2/CLAUDE.md` as the Claude Code adapter importing the same canonical manual/design documents; model-specific entry files are intentionally not alternative rulebooks
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
