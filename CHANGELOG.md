# Changelog

## 2026-08-25

### Nexis 2.0 foundation skeleton
- created an isolated `v2/` implementation root so the live/current Nexis code remains untouched during the parallel rebuild
- established a .NET 10 solution with `Nexis.Kernel`, `Nexis.Core`, initial Identity and Audit modules, an API composition host, and an architecture-test project placeholder
- added authoritative game-clock and immutable domain-event metadata contracts with event ID, UTC occurrence time, correlation, causation and schema version
- established server-side account/character identity and role vocabulary without name-based authority
- established the approved administrator audit visibility boundary: all meaningful privileged activity remains internally auditable, while only material player-state effects are eligible for player-facing projection
- documented strict dependency direction, persistence separation, migration isolation and pre-gameplay testing gates in `v2/docs/FOUNDATION.md`
- added `v2/docs/CORE-ARCHITECTURE.md`, defining `Nexis.Core` as the authoritative rules/logic/calculation machine while keeping its concrete implementation replaceable behind stable versioned contracts; surrounding systems retain persistent state/data/interfaces, Core returns authoritative decisions/transitions, and Core replacements require conformance/golden-scenario plus shadow-cutover safeguards
- added `v2/docs/COMMAND-EXECUTION.md`, defining the researched authoritative mutation model: specialized player/admin/system/realtime execution lanes, a separate query path, stable CommandId/idempotency, server-derived actor context, authoritative-time revalidation, hybrid optimistic/selective-lock concurrency, canonical multi-resource lock ordering, atomic state/event/outbox commits and bounded whole-transaction retries
- added `v2/docs/IDENTITY-AUTHORIZATION.md`, defining permanent Account/Character separation, one playable character per normal account initially, immutable public player identity, external-provider-to-Account mappings, capability/policy-based staff authority, entitlement/domain-role separation, audited admin support behavior and the Hennet public/private authority boundary
- updated the Claude Code/Codex handoff so agents must preserve Core replaceability, command-execution and identity/authorization contracts and prove replacement/conformance, duplicate-execution, stale-state, concurrency, scheduler-bypass and privilege-separation protections before broad gameplay systems begin
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
