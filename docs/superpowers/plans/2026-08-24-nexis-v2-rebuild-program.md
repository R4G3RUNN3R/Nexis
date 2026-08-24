# Nexis v2 Rebuild Program Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Preserve every valuable part of the current Nexis while rebuilding Nexis v2 as a cleaner, education-driven persistent world, then add the new systems already approved or strongly recommended through research without carrying forward the old architecture merely for compatibility.

**Architecture:** The current live Nexis remains the source of truth and reference implementation until controlled cutover. Nexis v2 is built in parallel, with a preservation-first migration pipeline, server-authoritative domain boundaries, normalized relational storage for transactional/shared/history-sensitive systems, and JSONB only where flexible low-contention state is appropriate. This master plan deliberately decomposes the rebuild into independent subsystem specs and implementation plans rather than attempting one unsafe mega-implementation.

**Tech Stack:** React 18 + TypeScript + Vite frontend; Node.js 20 + Express 5 API; PostgreSQL 16; Docker/Caddy deployment on the new VPS; existing GitHub repository as the source-control record. Exact library additions require approval in the relevant subsystem spec.

**Spec:**
- `docs/nexis-v2-working-brainstorm.md`
- `docs/nexis-v2-canon-foundation.md`
- `docs/nexis-v2-spirit-system-brainstorm.md`
- `docs/superpowers/specs/2026-08-23-spirit-system-design.md`
- `docs/research/torn-mechanics-to-nexis.md`
- `docs/research/browser-rpg-feature-opportunities.md`
- `docs/research/nexis-research-recommendations.md`

## Global Constraints

- Preserve legitimate player data, account identity, progression, inventory, currencies, organizations, marketplace history, content, lore, assets, discoveries, Chronicle history, operational knowledge, and incident learnings.
- Do not mutate the old live database in place during migration development.
- Build v2 in parallel while the old Nexis remains live/referenceable.
- Reuse knowledge, content, data, and proven behavior; do not preserve technical debt for compatibility alone.
- Education is the main progression spine: **learn -> gain capability -> practise -> improve -> specialise**.
- Practical mastery is use-based and separate from formal education.
- Hennet Uthellien is the primary Administrator account; admin authority is server-side and account-bound, never name-based.
- Other players see only Hennet's ordinary public facade. Hennet's true/private profile and true CIEL context are visible only to the authorized primary owner session.
- CIEL is a sliver of Hennet's mind that developed a genuine personality over immense time; do not reduce her to generic game software or expose objective canon merely because the server knows it.
- Life Paths are retired as active progression and survive only as unobtainable historical Feats of Strength where appropriate.
- No subsystem is implemented directly from this master document unless it is explicitly a preservation/migration-foundation task. Each independent gameplay subsystem requires its own approved design spec and implementation plan.
- Every migration step must be auditable, repeatable, idempotent where practical, and accompanied by reconciliation checks.
- Every economy, reward, PvP, contract, item-transfer, or admin action is server-authoritative.

---

## 1. Program Strategy

The rebuild follows five rules:

1. **Extract first.** Inventory current Nexis before changing it.
2. **Classify second.** Every current system/component is marked `KEEP`, `TRANSFORM`, `RETIRE`, or `ARCHIVE`.
3. **Build shared primitives before feature branches.** Event history, knowledge, research, contracts, reputation, world state, contribution tracking, and provenance are reusable foundations.
4. **Prove the architecture with one vertical slice.** Do not wait until every system exists before learning whether the architecture actually works.
5. **Migrate only after repeated rehearsal.** The live database is never the first place a migration transformer gets to discover its personality.

---

## 2. Preservation Classification

### Preserve as authoritative player/account data

- `users`, public IDs, internal IDs, auth identities, valid sessions during cutover planning, account creation timestamps, privilege records and deactivation state.
- Character progression that still exists in v2: level where retained, stats, working stats, battle stats, currency, equipment, inventory, completed education, discoveries, titles, achievements, Chronicle history, reputation/standing, organization membership and ownership.
- Guild and Consortium identities, members, roles, treasuries, logs, bases and legitimate progression.
- Marketplace listings/transactions that represent legitimate player ownership or history.
- Important one-shot completion and entitlement ledgers already protected by relational uniqueness constraints.

### Preserve primarily as game content/data

- cities and regions;
- world-map topology, useful routes and location concepts;
- item definitions, rarity identity, equipment slots, set concepts and art worth retaining;
- recipe definitions and discovery requirements;
- Adventure and Excursion content, hidden sites and discovery tables;
- transport definitions and logistics concepts;
- city demand profiles, city rhythms, threat events and world-event concepts;
- Codex content and useful lore;
- CIEL-authored copy that still fits canon;
- housing tiers, rooms/upgrades and property flavor worth carrying forward;
- visual assets that survive the aggressive v2 art/UI review.

### Preserve proven engineering patterns, not necessarily their files

- server-side authorization checks;
- public/internal ID separation;
- database uniqueness for one-time grants;
- idempotency/duplicate-grant protection;
- `SELECT ... FOR UPDATE`-style transactional marketplace behavior;
- organization permission checks;
- server-owned reward resolution;
- audit/log records for sensitive actions.

### Transform rather than copy

- `player_state` JSONB branches into a v2 model where shared, transactional, query-heavy and historically important concepts are normalized;
- Education into the deeper institution/course/prerequisite/capability model;
- Skills into practical mastery disciplines;
- Civic Jobs into real profession/world responsibilities rather than primarily Job Point conversion;
- Achievements, Titles, Legacy and Chronicle into distinct but connected concepts;
- Crafting into research-aware crafting, restoration and player commissions;
- Guilds/Consortiums into organizations with projects, facilities, contribution history and shared knowledge;
- PvP/bounty into investigation, lawful targeting, capture and consequence systems;
- Housing into functional infrastructure;
- Codex into a knowledge graph rather than only a flat reference catalogue;
- CIEL into the world/knowledge synthesis layer appropriate to her canon.

### Retire from normal progression

- active Life Paths;
- the old assumption of uniform shallow academy tracks;
- generic client-side or name-based authority decisions;
- any public signal revealing Hennet's Administrator/Absolute truth;
- Torn-like structure that exists only because Torn did it;
- duplicated/stale frontend routes, static HTML prototypes and unused libraries once v2 replacements are verified;
- any percentage-only feature that exists without a meaningful world/capability reason and cannot justify its complexity.

---

## 3. Target Shared Domain Primitives

These foundations are intentionally reusable across many features:

1. **Game Event Ledger**
   - one authoritative append-oriented history of meaningful events;
   - feeds Records, Chronicle, News, CIEL, achievements, provenance and admin audit.

2. **Knowledge Graph**
   - nodes: people, places, events, factions, items, creatures, Spirits, books, ruins, hypotheses, historical periods;
   - edges: discovered-at, owned-by, mentions, contradicts, related-to, suspected, confirmed;
   - per-character knowledge state distinguishes observation, hypothesis, accepted scholarship, hidden knowledge and objective server truth.

3. **Research Engine**
   - prerequisites + time + facility + evidence/materials/specimens + result;
   - reused by magic, crafting, archaeology, Bestiary, artifact identification and historical research.

4. **Contract / Escrow Engine**
   - issuer, eligibility, objective, escrow, deadline, acceptance, verification, completion/failure;
   - reused by crafting orders, procurement, courier work, escorts, bounties, capture, research commissions and organization requests.

5. **Reputation / Favour Engine**
   - permanent Renown/standing is separate from spendable social Favours;
   - supports institutions, cities, factions and NPC networks.

6. **World State / Event Engine**
   - event phases, success/failure branches, contributors and consequences;
   - drives News, city demand, route danger, contracts, bosses and civic projects.

7. **Contribution Engine**
   - tracks material, currency, activity and milestone contributions;
   - reused by Guild, Consortium and city-wide projects.

8. **Item Instance / Provenance Engine**
   - only for significant non-stackable items, relics, artifacts and masterpieces;
   - records maker, discovery, ownership and notable history.

---

## 4. Dependency Order

```text
PRESERVATION AUDIT
      ↓
V2 ARCHITECTURE + MIGRATION HARNESS
      ↓
IDENTITY / AUTH / HENNET PUBLIC-FACADE SECURITY
      ↓
GAME EVENT LEDGER
      ↓
EDUCATION ENGINE
      ↓
KNOWLEDGE GRAPH + CODEX + CIEL
      ↓
RESEARCH ENGINE
      ↓
ARCHAEOLOGY / BESTIARY / RESTORATION
      ↓
ECONOMY + MARKET + CONTRACTS + CRAFTING ORDERS
      ↓
WORLD STATE + TRAVEL + LOGISTICS + DYNAMIC EVENTS
      ↓
SOCIAL / FAVOURS / BOUNTY / CAPTURE
      ↓
GUILDS / CONSORTIUMS / PROJECTS / BASES
      ↓
HOUSING INFRASTRUCTURE
      ↓
COMBAT / MAGIC / GRIMOIRES / SPIRITS
      ↓
FULL CONTENT MIGRATION + REHEARSALS + CUTOVER
```

---

### Task 1: Create the Current-Nexis Preservation Inventory

**Files:**
- Create: `docs/research/nexis-v2-preservation-manifest.md`
- Create: `docs/research/nexis-v2-source-system-map.md`
- Create: `docs/research/nexis-v2-retirement-register.md`
- Read: `server/db/schema.sql`
- Read: `server/data/**`
- Read: `server/services/**`
- Read: `server/repositories/**`
- Read: `src/pages/**`
- Read: `src/data/**`

**Produces:** A complete `KEEP / TRANSFORM / RETIRE / ARCHIVE` classification with source paths, stored data, player impact, migration risk and v2 destination for every meaningful existing system.

- [ ] Inventory all database tables and each JSONB branch in `player_state`.
- [ ] Inventory every server data definition and classify content separately from implementation.
- [ ] Inventory every service/repository and identify proven server-authoritative/transactional behaviors worth preserving.
- [ ] Inventory frontend pages and flag real systems versus placeholders/prototypes/stale duplicates.
- [ ] Record every player-facing value that cannot be lost at migration.
- [ ] Record every retired mechanic that must be converted into historical/legacy representation rather than deleted silently.
- [ ] Commit the three inventory documents before any v2 schema work begins.

### Task 2: Build the Migration Evidence and Reconciliation Contract

**Files:**
- Create child spec: `docs/superpowers/specs/2026-08-24-nexis-v2-migration-foundation-design.md`
- Create child plan after approval: `docs/superpowers/plans/2026-08-24-nexis-v2-migration-foundation.md`
- Planned implementation area: `scripts/nexis-v2-migration/`
- Planned database area: `db/migrations/`

**Produces:** A versioned read-only export format, transformation contract and reconciliation report before any live migration.

- [ ] Define source export manifest: schema version, export timestamp, source commit, source database identifier, row counts and checksums.
- [ ] Define identity mapping rules preserving internal/public IDs.
- [ ] Define per-system reconciliation rules: users, balances, inventory totals, education, organizations, listings, progression and historical ledgers.
- [ ] Require anomaly reporting rather than silent dropping or coercion.
- [ ] Require migration to be repeatable against disposable v2 databases.
- [ ] Require a final dry-run export from live Nexis immediately before cutover.

### Task 3: Approve the Nexis v2 Application Architecture

**Files:**
- Create: `docs/superpowers/specs/2026-08-24-nexis-v2-application-architecture-design.md`
- Create after approval: `docs/superpowers/plans/2026-08-24-nexis-v2-application-foundation.md`

**Recommended target:** modular monolith, not microservices.

**Recommended module shape:**

```text
apps/web
apps/api
packages/domain
packages/shared
db/migrations
scripts/nexis-v2-migration
```

- [ ] Decide final repository layout.
- [ ] Decide API/domain/repository dependency direction.
- [ ] Decide database migration tooling and test database strategy.
- [ ] Decide backend and frontend test stack.
- [ ] Remove duplicate router/database-client dependencies only after confirming they are unused by preserved functionality.
- [ ] Establish CI/build/test gates before gameplay migration starts.

### Task 4: Identity, Administrator Security and Hennet Public Facade

**Files:**
- Create: `docs/superpowers/specs/2026-08-24-identity-admin-hennet-profile-design.md`
- Create after approval: `docs/superpowers/plans/2026-08-24-identity-admin-hennet-profile.md`
- Reference: `docs/nexis-v2-canon-foundation.md`

**Produces:** One Hennet account, two server-generated profile projections.

- [ ] Preserve the existing account/public-ID model where sound.
- [ ] Define the normal public profile projection seen by every other account.
- [ ] Define the private true profile visible only when the primary Hennet owner session is authenticated.
- [ ] Ensure true/admin fields are omitted from unauthorized API responses, not merely hidden in React.
- [ ] Apply the same facade rule to search, profile inspection, rankings, PvP records, Guild/Consortium rosters, marketplace identity, Records, exports and CIEL responses.
- [ ] Keep admin controls in a separate authenticated operational surface.
- [ ] Add explicit tests proving ordinary/admin/moderator accounts cannot obtain the private Hennet projection.

### Task 5: Game Event Ledger, Records, Chronicle and News Foundation

**Files:**
- Create: `docs/superpowers/specs/2026-08-24-event-ledger-chronicle-news-design.md`
- Create after approval: `docs/superpowers/plans/2026-08-24-event-ledger-chronicle-news.md`

**Produces:** One historical source feeding multiple views instead of each subsystem inventing its own history array.

- [ ] Define immutable/append-oriented event categories and actor/object references.
- [ ] Define public/private/admin visibility.
- [ ] Define Chronicle projection as universal character history, not donor-gated existence.
- [ ] Define Records as detailed personal/account audit.
- [ ] Define News generation from major public world events.
- [ ] Define achievement/title/Feat-of-Strength triggers from authoritative events.

### Task 6: Education and Certification Engine

**Files:**
- Create: `docs/superpowers/specs/2026-08-24-education-engine-design.md`
- Create after approval: `docs/superpowers/plans/2026-08-24-education-engine.md`

**Includes:**
- real-time courses and prerequisites;
- capability unlocks;
- Silverbough foundations;
- professional branches;
- course planning/queued study roadmap;
- selected practical examinations/certifications;
- migration of legitimate completed old courses into the new model.

- [ ] Preserve real-time offline study behavior.
- [ ] Replace percentage-only course design with capability-driven rewards where possible.
- [ ] Define migration mappings for old completed courses.
- [ ] Define education-speed modifier caps explicitly.
- [ ] Use Education as the prerequisite layer for Research, professions, Spirit attunement, magic and advanced world access.

### Task 7: Knowledge Graph, Codex and CIEL Synthesis

**Files:**
- Create: `docs/superpowers/specs/2026-08-24-knowledge-codex-ciel-design.md`
- Create after approval: `docs/superpowers/plans/2026-08-24-knowledge-codex-ciel.md`

**Includes:**
- knowledge nodes/edges;
- observation vs hypothesis vs accepted scholarship;
- player-specific discovery state;
- rumor graph;
- Atlas/Archives/Discoveries/Bestiary integration;
- CIEL contextual synthesis;
- strict separation of objective canon from what a character is allowed to know.

- [ ] Preserve useful existing Codex entries as seed nodes.
- [ ] Build character-specific knowledge rather than a single universal encyclopedia.
- [ ] Allow conflicting/incorrect in-world scholarship without corrupting objective canon.
- [ ] Make CIEL explain connections the player is legitimately entitled to understand without becoming a spoiler oracle.

### Task 8: Research, Antiquities, Bestiary and Artifact Restoration

**Files:**
- Create: `docs/superpowers/specs/2026-08-24-research-antiquities-bestiary-design.md`
- Create after approval: `docs/superpowers/plans/2026-08-24-research-antiquities-bestiary.md`

**Includes:**
- generic research projects;
- antiquity leads;
- research/scry-like narrowing without copying another game's presentation;
- excursion/site investigation;
- progressive Bestiary research;
- artifact identification and restoration;
- Museum/Academy donations;
- academic publication/discoverer credit;
- research notebook/history.

- [ ] Reuse existing Excursion locations, hidden sites, knowledge drops, fragments and historical courses as seed content.
- [ ] Ensure finding a relic is not automatically equivalent to understanding or using it.
- [ ] Let creature knowledge improve through observation, fighting, capture, specimens, books and research.
- [ ] Record significant discoveries in Chronicle/Event Ledger.

### Task 9: Economy, Markets, Contracts and Crafting Orders

**Files:**
- Create: `docs/superpowers/specs/2026-08-24-economy-contracts-crafting-orders-design.md`
- Create after approval: `docs/superpowers/plans/2026-08-24-economy-contracts-crafting-orders.md`

**Includes:**
- preserved player marketplace behavior;
- buy orders;
- transaction/price/volume history;
- public/guild/consortium/private crafting orders;
- generic escrow contracts;
- procurement requests;
- courier contracts;
- research/restoration commissions;
- city NPC requisitions as item sinks.

- [ ] Preserve existing market ownership/locking safety behavior.
- [ ] Normalize transactions so price history can be derived from real sales.
- [ ] Make contracts server-verified and escrow-backed.
- [ ] Keep economic data informational; CIEL may summarize trends but must not become a guaranteed-price oracle.

### Task 10: Crafting, Enhancement, Provenance and Collections

**Files:**
- Create: `docs/superpowers/specs/2026-08-24-crafting-enhancement-provenance-design.md`
- Create after approval: `docs/superpowers/plans/2026-08-24-crafting-enhancement-provenance.md`

**Includes:**
- preserve current recipe content;
- course/academy/research gates;
- recipe discovery/fragments;
- restoration;
- material-property research;
- item enhancement research;
- maker's marks/provenance for important non-stackable items;
- hidden collections and historical sets.

- [ ] Do not attach provenance to mundane stackables.
- [ ] Preserve existing rare/epic/legendary/mythic discovery content where compatible.
- [ ] Use research to reveal new methods rather than awarding every recipe from ordinary progression.

### Task 11: World State, Dynamic Event Chains, Civic Projects and Real News

**Files:**
- Create: `docs/superpowers/specs/2026-08-24-world-state-events-civic-projects-design.md`
- Create after approval: `docs/superpowers/plans/2026-08-24-world-state-events-civic-projects.md`

**Includes:**
- event phases;
- success/failure branching;
- city demand changes;
- route consequences;
- bosses;
- civic/community projects;
- contributor records;
- automatic News stories from qualifying world events.

- [ ] Seed the engine with current Wardfall, Corsair Pressure, Furnace Beast, Tunnel Raider and Highcourt legal-emergency concepts.
- [ ] Require world consequences to be time-bounded or explicitly reversible unless the event design says otherwise.
- [ ] Record contributions through the shared contribution engine.

### Task 12: Travel, Logistics, Scouting and Courier Gameplay

**Files:**
- Create: `docs/superpowers/specs/2026-08-24-travel-logistics-intelligence-design.md`
- Create after approval: `docs/superpowers/plans/2026-08-24-travel-logistics-intelligence.md`

**Includes:**
- preserve real-time travel;
- transport tiers;
- cargo;
- Consortium logistics;
- Guild escort contracts;
- route scouting/intelligence reports;
- temporary route/weather/threat confidence data;
- sell/share intelligence;
- courier contracts.

- [ ] Preserve meaningful existing route/danger/transport data.
- [ ] Make route intelligence expire and remain server-derived.
- [ ] Allow Education/Shadow/tracking/exploration to improve scouting quality without revealing exact hidden RNG tables.

### Task 13: Renown, Favours, Tavern, Contacts, Rivals and Targets

**Files:**
- Create: `docs/superpowers/specs/2026-08-24-social-renown-favours-design.md`
- Create after approval: `docs/superpowers/plans/2026-08-24-social-renown-favours.md`

**Includes:**
- permanent Renown vs spendable Favours;
- Tavern rumors/contracts/unofficial information;
- Contacts as relationships/notes/publicly known profession/organization context;
- Rivals as conflict history;
- Targets as active investigations/contracts/bounties.

- [ ] Reuse existing qualities/standing concepts as migration inputs, not necessarily as final schema.
- [ ] Keep private player notes private.
- [ ] Never expose location or intelligence a character has not legitimately learned.

### Task 14: Bounty Investigation and Capture

**Files:**
- Create: `docs/superpowers/specs/2026-08-24-bounty-investigation-capture-design.md`
- Create after approval: `docs/superpowers/plans/2026-08-24-bounty-investigation-capture.md`

**Includes:**
- NPC bounty-first implementation;
- evidence/intelligence gathering;
- tracking;
- locating safehouses/routes;
- kill vs capture resolution;
- restraints;
- transport alive;
- delivery;
- payout/reputation;
- player bounty/capture only after separate abuse/offline/griefing rules are approved.

- [ ] Reuse existing notoriety/bounty/PvP safety concepts.
- [ ] Keep capture harder and potentially more rewarding than killing.
- [ ] Do not let Targets become a magical real-time GPS page.

### Task 15: Guilds, Consortiums, Projects, Facilities and Shared Knowledge

**Files:**
- Create: `docs/superpowers/specs/2026-08-24-organizations-projects-bases-design.md`
- Create after approval: `docs/superpowers/plans/2026-08-24-organizations-projects-bases.md`

**Includes:**
- preserve Guild/Consortium separation;
- custom permissions/charters;
- hiring/roster management;
- contribution-led projects;
- functional facilities;
- Guild library/shared knowledge;
- Consortium warehouses/counting houses/workshops/logistics offices;
- Guild warfare only after a separate PvP/abuse design is approved.

- [ ] Preserve legitimate organization identities, members and treasuries.
- [ ] Migrate current bases and progression into the approved facility model.
- [ ] Make treasury spending visibly create organizational capability/infrastructure.

### Task 16: Housing as Functional Infrastructure

**Files:**
- Create: `docs/superpowers/specs/2026-08-24-housing-infrastructure-design.md`
- Create after approval: `docs/superpowers/plans/2026-08-24-housing-infrastructure.md`

**Includes:**
- Study;
- Library;
- Workshop;
- Laboratory;
- Garden;
- Storage/Vault;
- Trophy Hall;
- Guest Room;
- Infirmary/staff/stables where property tier supports them.

- [ ] Preserve current property identities and useful upgrade flavor.
- [ ] Prefer new capabilities/workspaces over passive percentage clutter.
- [ ] Ensure housing remains valuable without becoming a mandatory punitive upkeep treadmill.

### Task 17: Combat, Practical Mastery, Magic, Grimoires and Spirit Integration

**Files:**
- Create: `docs/superpowers/specs/2026-08-24-combat-mastery-magic-design.md`
- Existing approved Spirit spec: `docs/superpowers/specs/2026-08-23-spirit-system-design.md`
- Create after combat/magic approval: `docs/superpowers/plans/2026-08-24-combat-mastery-magic.md`
- Create Spirit implementation plan only after shared combat/status interfaces are fixed: `docs/superpowers/plans/2026-08-24-spirit-system.md`

**Includes:**
- martial/ranged/shadow mastery families;
- formal schools of magic;
- mana economy;
- school mastery;
- Grimoire deciphering and forbidden branches;
- Spirit effects against real combat/status/crafting/healing interfaces;
- PvP affinity rules already approved in Spirit spec.

- [ ] Generalize useful bones from current `skillData.js`/`skillService.js` rather than blindly copying the existing tree.
- [ ] Keep school mastery use-based.
- [ ] Keep Spirit Magic usable by non-casters through cooldowns only, as already approved.
- [ ] Prevent any mastery/Spirit progress from client-authored or trivial spam actions.

### Task 18: Prove the Architecture with the Nexis v2 Vertical Slice

**Acceptance journey:**

```text
Historical Awareness completed
        ↓
Tavern rumor discovered
        ↓
Antiquity lead added to Knowledge Graph
        ↓
Research narrows likely region
        ↓
Travel / route intelligence
        ↓
Excursion reveals site
        ↓
Unknown creature encountered
        ↓
Bestiary gains partial observation
        ↓
Artifact recovered but unidentified
        ↓
Research identifies inscription
        ↓
Workshop restores artifact
        ↓
Lost crafting/research method discovered
        ↓
KEEP / SELL / DONATE decision
        ↓
Event Ledger + Chronicle + institution Renown
        ↓
Public News if significance threshold qualifies
        ↓
CIEL connects the discovery to another legitimate clue
```

- [ ] The entire journey must work server-authoritatively.
- [ ] Each stage must write only the appropriate Event/Knowledge state.
- [ ] The player must not receive objective canon merely because a server-side node contains it.
- [ ] The journey must demonstrate Education, Knowledge, Research, Travel, Adventure/Excursion, Bestiary, Crafting/Restoration, Economy, Chronicle, News and CIEL working together.
- [ ] Treat this vertical slice as the first serious v2 product milestone before broad content replication.

### Task 19: Full Migration Rehearsals

**Files:**
- Use approved migration child plan from Task 2.
- Create: `docs/research/nexis-v2-migration-rehearsal-report.md`

- [ ] Export a copy of old Nexis data without altering live.
- [ ] Import into an empty v2 database.
- [ ] Run all reconciliation checks.
- [ ] Manually inspect representative accounts: fresh account, long-lived player, Administrator/Hennet, Guild leader, Consortium director, active market user, education-heavy character and content-heavy character.
- [ ] Run the import again from scratch and confirm the same result.
- [ ] Record every anomaly and resolve it through transformer logic or an explicitly approved exception record.
- [ ] Rehearse rollback by discarding v2 test state and re-running from source export.

### Task 20: Controlled Cutover

**Files:**
- Create before cutover: `docs/operations/nexis-v2-cutover-runbook.md`
- Create after cutover: `docs/operations/nexis-v2-cutover-report.md`

- [ ] Announce maintenance/read-only window if required by the final migration design.
- [ ] Take final source export and checksums.
- [ ] Run migration into production v2 database.
- [ ] Run reconciliation before accepting player writes.
- [ ] Validate Hennet public/private profile separation before opening access.
- [ ] Validate login, inventory, currency, education, organizations, marketplace, Chronicle and vertical-slice primitives.
- [ ] Switch traffic only after validation passes.
- [ ] Keep old Nexis untouched and recoverable through the agreed rollback window.
- [ ] Remove temporary migration credentials only after rollback risk has passed.

---

## 5. Required Child Specs and Plans

This master plan intentionally does **not** authorize implementing every system in one pass. The following design/plan pairs are the execution units:

1. Migration Foundation
2. Application Architecture/Foundation
3. Identity/Admin/Hennet Profile
4. Event Ledger/Chronicle/News
5. Education Engine
6. Knowledge/Codex/CIEL
7. Research/Antiquities/Bestiary
8. Economy/Contracts/Crafting Orders
9. Crafting/Enhancement/Provenance
10. World State/Events/Civic Projects
11. Travel/Logistics/Intelligence
12. Social/Renown/Favours
13. Bounty/Investigation/Capture
14. Organizations/Projects/Bases
15. Housing Infrastructure
16. Combat/Mastery/Magic
17. Spirit System Implementation, using the already-approved Spirit design
18. Migration Rehearsal and Cutover Runbook

Each child unit follows:

```text
brainstorm / current-code audit
        ↓
approved design spec
        ↓
implementation plan
        ↓
TDD implementation
        ↓
review + verification
        ↓
migrate/reconcile relevant old data
        ↓
merge into v2
```

---

## 6. Self-Review

### Spec coverage

This program covers the approved rebuild philosophy, Education-first progression, the approved Spirit design dependency, canon/CIEL/Hennet constraints, preservation of old data, new research findings, and migration/cutover requirements.

### Explicitly represented researched additions

- Knowledge/Rumour Graph
- Research Engine
- Antiquities/Archaeology
- Progressive Bestiary
- Artifact Identification/Restoration
- Museum/Academy donations
- Academic publication/discoverer credit
- Renown + Favours
- Crafting Orders
- Generic Contract/Escrow Engine
- Courier contracts
- Organization projects
- City civic projects
- Branching world events
- Real server-generated News
- NPC requisition/item sinks
- Market history and buy orders
- Route intelligence/scout reports
- Investigation gameplay
- Contacts/Rivals/Targets
- Tavern rumors/contracts
- Functional housing rooms
- Hidden collections
- Item provenance/Maker's Marks
- Shared organization knowledge
- Practical education certifications
- Study planning
- Universal Chronicle
- CIEL knowledge/world-state synthesis

### Placeholder scan

No implementation detail in this master plan is left as an unnamed `TODO`/`TBD`. Where a gameplay subsystem still needs design decisions, the plan names the exact child spec that must resolve them before code begins.

### Type/interface consistency

Shared primitives are intentionally named once in Section 3 and referenced consistently by later workstreams: Game Event Ledger, Knowledge Graph, Research Engine, Contract/Escrow Engine, Reputation/Favour Engine, World State/Event Engine, Contribution Engine, and Item Instance/Provenance Engine.
