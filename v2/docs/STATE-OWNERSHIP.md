# Nexis 2.0 State Ownership and Domain Boundaries

_Status: approved architecture decision, 2026-08-25._

## Purpose

Nexis 2.0 deliberately rejects the v1 pattern where a broad mutable player runtime object contains unrelated gameplay state and many services rewrite pieces of that same object.

Every authoritative state concept must have exactly one authoritative owner. Other systems may consume stable snapshots/contracts or derived projections, but they do not write the owner's private state directly.

This document defines who owns truth, who decides rules, how cross-system changes are coordinated, and which apparent "player state" concepts are projections rather than writable aggregates.

The binding high-level split is:

- **System owner**: owns authoritative persistent facts for one bounded gameplay/platform responsibility.
- **Nexis.Core**: owns rules, logic, calculations and legal/illegal transition decisions over trusted snapshots.
- **Nexis.Application / command lane**: loads snapshots, invokes Core, coordinates transactions and asks each owner to persist only its assigned transition.
- **Persistence adapter/database**: stores owner state and enforces structural/database invariants; it does not invent gameplay rules.
- **Projection/read model**: composes information for UI/search/logs/leaderboards and owns no authoritative gameplay truth unless explicitly declared otherwise.

The permanent rule is:

> One state concept, one authoritative write owner. Core decides what should happen; owners persist their own facts; Application coordinates the operation.

## Why v1 must not be repeated

The existing v1 `player_state` / mutable runtime approach demonstrates the exact failure mode this design eliminates.

Current services load one broad runtime snapshot and can mutate unrelated concerns such as currency, inventory, progression, travel, counters, achievements, conditions and records. `runtimePlayerState.js` itself documents a confirmed class of bugs where unrelated writes could silently wipe fields omitted from re-hydration because the full player snapshot was replaced rather than domain-owned state being changed independently.

That is not a coding-style problem. It is an ownership problem.

V2 therefore prohibits a replacement such as `CharacterState`, `PlayerAggregate`, `RuntimeState`, `PlayerBlob`, `Qualities`, or `Dictionary<string, object>` from becoming the new home for the whole game.

## Research basis

The design combines the useful parts of several sources rather than copying one architecture.

### Torn

Observable Torn gameplay shows multiple independent state concepts influencing unrelated actions: Energy is consumed by many systems, travel restricts access to other actions, Hospital status affects availability, and Medical/Booster/Drug cooldowns have separate semantics. The lesson for Nexis is not to place them in one mutable player object; it is to expose clear authoritative snapshots so Core can compose global action rules consistently.

### TrinityCore / WoW-like server architecture

TrinityCore exposes distinct identities for players, items, guilds and world objects and uses explicit transactions for sensitive multi-resource flows such as auctions, where inventory, money and auction state must remain consistent. Nexis keeps that transaction discipline while deliberately avoiding a single giant `Player` object as the integration boundary.

### Fallen London / StoryNexus

Quality-based narrative demonstrates the power of `state -> prerequisites -> result -> changed state`, which fits the Nexis Core model. It also demonstrates the maintenance risk of representing almost everything as generic qualities. Nexis therefore uses typed owner-specific contracts rather than one universal qualities dictionary.

### .NET / DDD bounded-context guidance

Bounded contexts should own their own domain data, and aggregate boundaries should follow what genuinely needs transactional consistency. Nexis applies this inside a modular monolith first: strong logical data sovereignty and private write ownership without prematurely forcing every bounded context into a separate process/database.

## Permanent ownership rules

1. **Exactly one authoritative write owner exists for every persistent state concept.**
2. **No system writes another system's private tables, repositories or mutable implementation objects.**
3. **No system depends on another system's implementation assembly when a stable contract can represent the relationship.**
4. **Core owns gameplay rule evaluation, not persistent state.**
5. **Application owns orchestration, not gameplay formulas.**
6. **Read models may duplicate data for performance, but duplicated projection data is explicitly rebuildable and never silently becomes source of truth.**
7. **Events may inform another system, but event handlers cannot bypass that system's command/owner boundary to mutate its authoritative state.**
8. **A scheduler never owns the gameplay outcome merely because it knows when an action is due.** It issues a System Command; Core resolves it; the owning system persists the result.
9. **Generic current-state containers are prohibited.** There is no global `player.current`, `player.condition`, `player.counters`, `player.qualities` or equivalent catch-all write model.
10. **Generic JSON/JSONB is not an ownership model.** It may be used inside one owner's private schema for validated/versioned extension metadata, content payloads or non-authoritative projection data, but not as a replacement for typed ownership boundaries.
11. **Public profiles, home dashboards, admin dossiers, leaderboards, search documents and Player Logs are projections.** They do not own the state they display.
12. **Cross-system invariants are evaluated by Core from trusted snapshots and persisted through explicit owner transitions.** No consumer is allowed to cache another owner's state and later mutate from the cached copy as though it were authoritative.

## State authority versus rule authority

A critical distinction:

### A system owns facts

Examples:

- Economy owns the wallet balance.
- Inventory owns an item instance and who owns it.
- Travel owns whether Character X is currently travelling and where.
- Resources owns Character X's current Mana state.

### Core owns what those facts mean for an action

Examples:

- Core decides whether a purchase is affordable and what the final debit/credit should be.
- Core decides whether an item can be equipped and what effective bonuses it contributes.
- Core decides whether travelling blocks an attack.
- Core decides whether sufficient Mana exists and the exact cost of a spell.

### The owner still protects storage integrity

An owner may reject an impossible/malformed transition envelope, stale expected revision, missing entity, ownership mismatch or database constraint violation. That is not reimplementing gameplay rules; it is preventing corrupted state from being persisted.

## Authoritative system map

The names below are conceptual bounded contexts. Exact assembly/package names may evolve, but the ownership boundaries are binding unless deliberately superseded.

### 1. Identity and Access

**Owns authoritative state**

- Account identity and status.
- Character identity and Account-to-Character control relationship.
- immutable internal AccountId / CharacterId relationships.
- immutable public player identity.
- mutable display name under approved rules.
- authentication-provider mappings/security versioning through infrastructure adapters.
- platform staff capabilities/denies.
- account sanctions/security status.
- effective account product entitlement state as defined by the existing Identity contract.

**Does not own**

- combat stats, resources, inventory, balances, guild roles, travel, reputation or other ordinary gameplay state.
- character appearance/cosmetic configuration beyond identity-critical public fields.

**Core consumes**

Trusted actor/character/entitlement/authorization snapshots needed by the requested rule.

### 2. Profile and Customization

**Owns authoritative state**

- portrait/avatar selections.
- biography/profile presentation fields.
- cosmetic appearance choices not owned by Equipment.
- non-authority profile customization.

**Does not own**

- public player ID, AccountId, CharacterId or display-name identity authority.
- staff/admin state.
- gameplay bonuses merely because a cosmetic appears on the profile.

**Projection rule**

The public player profile is composed from Identity, Profile/Customization, Recognition, Organizations, Travel/World and knowledge-safe public projections. It is not itself a write owner.

### 3. Preferences

**Owns authoritative state**

- account/client preferences that must sync across clients.
- UI/display preferences.
- notification preference choices where they are user configuration rather than delivery records.

**Never owns** gameplay authority or client-supplied gameplay truth.

### 4. Progression and Attributes

**Owns authoritative state**

- character level and experience.
- permanent/base battle attributes.
- permanent/base working attributes.
- permanent progression points or attribute allocations.
- permanent stat-growth state that is not a skill/magic/education progression track.

**Does not own**

- current Energy/Mana/Life.
- equipment bonuses.
- temporary effects.
- title bonuses.
- combat encounter state.

**Core consumes** base progression snapshots and computes effective values from Progression + Equipment + Effects + Recognition + other approved modifiers.

No `effectiveStats` values are persisted as authoritative base stats merely because they were convenient to calculate on read.

### 5. Resources

**Owns authoritative state**

- current/base resource state and regeneration anchors for resources such as Energy, Mana, Life/Health, Nerve and any retained Stamina/Comfort-style pools.
- permanent resource-capacity unlock state when that unlock belongs to the resource itself.
- last authoritative resolution/recovery timestamps or equivalent anchors required to reconstruct current values.

**Does not own**

- combat encounters.
- skill/spell rules.
- cooldown categories.
- property ownership merely because property may influence a resource cap/recovery rate.

**Core decides**

- spend amount.
- refill/recovery amount.
- effective maximum after modifiers.
- regeneration result at authoritative time.
- whether an action has sufficient resource.

### 6. Cooldowns

**Owns authoritative state**

- cooldown categories/windows/charges.
- authoritative expiry/accumulation anchors.
- item/drug/booster/medical/ability cooldown state where the mechanic is a cooldown rather than a long-lived status.

**Does not own** item ownership, spell ownership, hospital episodes or resources.

**Core decides** whether a cooldown permits the requested action and the resulting cooldown transition.

This stays separate from Resources because a finite regenerating pool and an eligibility timer have different invariants and upgrade paths.

### 7. Inventory

**Owns authoritative state**

- item instances and stack ownership.
- owner/container assignment.
- quantity for stackable items.
- item-instance durability/condition.
- item-instance enhancements/modifications/rolls.
- ownership transfers and reservations of items.
- organization-owned item containers where Inventory remains the canonical ownership store.

**Does not own**

- equipped-slot placement.
- item definition/base stats.
- marketplace listing state.
- crafting jobs.

**Core decides** item-use/equip/transfer eligibility and resulting item transitions from Inventory + Content + other snapshots.

### 8. Equipment and Loadouts

**Owns authoritative state**

- which owned item instance is equipped in each gameplay slot.
- saved gameplay loadouts.
- visual/cosmetic equipment placement where that is distinct from Profile customization.

**Does not own** item ownership or durability.

An equipped item remains an Inventory-owned item. Equipment stores a validated reference to it.

Equip/unequip commonly forms an explicit atomic multi-owner operation between Inventory and Equipment.

### 9. Effects

**Owns authoritative state**

- temporary buffs/debuffs.
- poison, stun, silence and similar timed/stacking effects.
- source attribution, stacks, expiry and dispel state.

**Does not own**

- hospitalization.
- jail.
- travel.
- base character attributes/resources.

Those larger state machines remain with their source systems. This prevents one universal `condition` blob from becoming a second `player_state`.

### 10. Economy

**Owns authoritative state**

- character wallets/currency balances.
- organization/system wallets where money must have one canonical owner.
- immutable/append-oriented financial ledger entries.
- reservations/escrow of currency.
- bank balances/investments if retained as economy subdomains.

**Does not own**

- marketplace listings.
- inventory/item ownership.
- guild governance.
- consortium management state.

All money moves through Economy. A Marketplace, Guild, Consortium, Bounty or Travel system never edits a gold field in its own state.

### 11. Marketplace

**Owns authoritative state**

- listings/auctions/orders and their lifecycle.
- seller/buyer references.
- listing price/quantity/status.
- market-specific reservation/quote identifiers where required.
- market history needed to enforce market invariants.

**Does not own** wallets or item ownership.

Buying a listing is an explicit atomic multi-owner operation across Marketplace + Economy + Inventory.

### 12. Direct Trade / Exchange

**Owns authoritative state**

- peer-to-peer trade offers.
- acceptance/readiness state.
- offered item/currency references/reservation references.
- trade workflow lifecycle.

**Does not own** the money/items themselves.

If this system is not needed in the first playable v2 slice it may remain unimplemented, but Marketplace must not silently absorb direct-trade workflow state merely because both move items.

### 13. World

**Owns authoritative state**

- dynamic world/global state.
- active world events and world-instance conditions.
- dynamic NPC/vendor stock or regional state where it is genuinely world-owned.
- server/world epochs or world-phase state if introduced.

**Does not own**

- static content definitions.
- a character's travel journey/current location.
- player knowledge/discovery.

Static city/route/location definitions belong to Content; character location belongs to Travel; discovered knowledge belongs to Knowledge.

### 14. Travel and Location

**Owns authoritative state**

- current authoritative character location.
- in-transit journey state.
- origin/destination/departure/arrival/due state.
- route/mode selection references.
- arrival grace/state that is intrinsic to travel.
- travel-specific cargo manifest/reservation references, but not item ownership itself.

**Does not own** static route definitions, wallets, items or global world state.

Core uses Travel snapshots as one input to global action eligibility.

There is no duplicated `player.current.currentCityId` elsewhere.

### 15. Recovery / Hospital

**Owns authoritative state**

- hospitalization episodes.
- hospital-until/reason/source.
- revive eligibility and recovery episode metadata.
- hospital-specific state required for early discharge or similar mechanics if Nexis adopts them.

**Does not own** current Life/Health or Medical Cooldown. Those remain Resources and Cooldowns.

Core composes Hospital + Resources + Cooldowns + item/effect snapshots when resolving treatment/revive actions.

### 16. Justice / Crime / Jail

**Owns authoritative state**

- jail/incarceration episodes.
- crime-resolution state.
- wanted/heat/warrant state if implemented.
- capture/custody state not owned by a specific Bounty contract.

**Does not own** Bounty contracts, wallets or combat encounters.

Core composes Justice state into global action policy.

### 17. Combat and PvP

**Owns authoritative state**

- active encounter/battle identity.
- participants and encounter lifecycle.
- turn/round/sequence state when applicable.
- combat-specific targeting/engagement state.
- persisted battle result records required by Combat itself.

**Does not own**

- base battle stats.
- current Life/Energy/Mana.
- equipment ownership/loadout.
- temporary effects.
- rewards/currency/items.

Core calculates legal actions, hit/damage/mitigation/effects/costs and transition plans from snapshots supplied by Combat, Progression, Resources, Equipment, Inventory, Effects and other relevant owners.

This is deliberate: Combat must not become another disguised Character aggregate.

### 18. Bounties and Capture

**Owns authoritative state**

- bounty/capture contract lifecycle.
- issuer/target/claimant references.
- bounty terms/conditions.
- claim/resolution state.

**Does not own** escrowed money, custody/jail state or combat state.

Economy owns escrow; Justice owns custody; Combat owns any encounter. Core resolves their combined rules.

### 19. Education

**Owns authoritative state**

- enrolled course/study state.
- start/due/completion state.
- completed-course history/unlocks whose semantic owner is Education.
- education-specific progress.

**Does not own** static course definitions, wallet balance, base attributes or skills.

Core resolves prerequisites, duration, cost and rewards. Starting a paid course is normally Economy + Education atomic; completion may also atomically transition Progression/Skills/Knowledge where the completion guarantees those rewards.

### 20. Skills and Mastery

**Owns authoritative state**

- learned/unlocked skills.
- skill rank/mastery/XP/proficiency.
- fighter/ranged/shadow and other skill-path progression.
- selected skill configuration/loadout if required.

**Does not own** generic XP/level, Mana, equipment or combat encounter state.

Core resolves skill prerequisites, costs and effects.

### 21. Magic

**Owns authoritative state**

- learned/unlocked spells or magical disciplines.
- spellbook/configuration/magical progression that is not generic Skill state.
- arcane attunement/state specific to Magic.

**Does not own** Mana or cooldown state.

Core calculates spell legality/effects/cost; Resources persists Mana; Cooldowns persists relevant cooldown; Effects persists resulting temporary effects.

### 22. Spirits

**Owns authoritative state**

- bonded/unlocked spirits.
- affinity/bond progression.
- summon/active-spirit state where persistent.

**Does not own** generic Mana, Combat or temporary effect state.

Magic and Spirits remain separate because either may evolve/upgrade independently and their progression/state invariants need not be identical.

### 23. Crafting

**Owns authoritative state**

- crafting recipe mastery/unlocks that belong to Crafting.
- active crafting jobs/orders.
- workstation/process state.
- craft-specific pity/proficiency if introduced.

**Does not own** materials or crafted output items. Inventory does.

Starting/completing a craft can be an atomic multi-owner operation with Inventory and, where relevant, Resources/Cooldowns/Economy.

### 24. Property / Housing

**Owns authoritative state**

- property ownership/lease state.
- current residence selection.
- installed property upgrades.
- property-specific maintenance/state.

**Does not own** Resource bars even if a property changes recovery/capacity. Core applies property modifiers to Resource rules from snapshots.

### 25. Employment / Civic Jobs

**Owns authoritative state**

- NPC/civic employment track.
- current job/position/rank.
- job-specific progression/perks/unlocks.
- work-cycle state if applicable.

**Does not own** base working stats or Consortium employment.

Progression owns permanent working attributes; Consortiums owns player-run business membership.

### 26. Guilds

**Owns authoritative state**

- guild identity.
- membership.
- guild ranks/roles/domain permissions.
- guild applications/invitations.
- guild progression/skill-tree state.
- guild quests/operations owned specifically by the Guild domain.
- governance/configuration.

**Does not own**

- guild money directly.
- guild-owned item instances directly.
- platform RBAC.

Economy owns guild wallets/treasury balances. Inventory owns guild armory item ownership/containers. Guilds owns whether a member has permission to request a treasury/armory operation; Core evaluates the combined rule.

### 27. Consortiums

**Owns authoritative state**

- consortium/business identity/type.
- ownership/directorship.
- roster/positions/applications.
- star/performance/business progression.
- business operations and management state.
- consortium-specific reward eligibility/state.

**Does not own** money or item ownership merely because a business uses them.

Economy owns wallets; Inventory owns stock/item instances where items are modeled as owned inventory; Progression owns base working stats.

Guilds and Consortiums are separate bounded contexts. A generic `Organizations` project may provide shared non-authoritative vocabulary/helpers only if necessary; it must not become the write owner for both domains.

### 28. Reputation and Standing

**Owns authoritative state**

- city/faction/NPC standing/reputation values.
- reputation tiers/history required for its own invariants.

**Does not own** organization membership, story progress or public titles.

Core decides gains/losses and eligibility effects using Reputation snapshots.

### 29. Knowledge / Discovery / Codex

**Owns authoritative state**

- discovered locations.
- revealed lore/facts.
- bestiary/codex discovery.
- item/world knowledge unlocks.
- intelligence/reveal relationships needed for knowledge-aware presentation.

**Does not own** World truth itself or player-facing history.

Knowledge is central to preventing hidden-information leaks: projections consult Knowledge to decide what a character is entitled to know.

There is no generic unbounded `qualities` dictionary serving as a second world/player model. Narrative flags belong to the owning Adventures/Contracts/Knowledge domain and are typed/versioned.

### 30. Recognition / Legacy / Titles

**Owns authoritative state**

- achievements.
- Feats of Strength.
- Legacy Point progression/spend state.
- unlocked titles/honors.
- selected/equipped gameplay title where titles have effects.

**Does not own** base Progression attributes.

Title/achievement definitions belong to Content; Core computes their effects/rewards. Public profile consumes Recognition projection data.

Generic global `counters` do not live here. Recognition tracks only explicit achievement/legacy progress it actually owns, preferably from durable domain events or typed observations.

### 31. Contracts

**Owns authoritative state**

- accepted contract/job objective lifecycle.
- objective progress.
- contract expiry/turn-in state.
- contract-specific branch/choice state.

**Does not own** reward money/items or general world state.

City contracts, repeatable tasks and similar objective-based work belong here unless another bounded context has a stronger semantic claim.

### 32. Adventures / Excursions / Narrative Sessions

**Owns authoritative state**

- active adventure/excursion/one-shot session.
- adventure-specific branch/progress state.
- encounter references and narrative choices.
- adventure-specific procedural/replay state.

**Does not own** generic Combat, Inventory, Economy or Knowledge state.

An Adventure may request those systems through Core/Application orchestration; it does not store private copies of them.

### 33. Social

**Owns authoritative state**

- contacts/friends/blocks/follows if Nexis retains them.
- social relationship state not owned by Guilds/Consortiums.

**Does not own** chat transport/session history unless that becomes a specifically designed Social subdomain.

### 34. CIEL

**Owns authoritative state**

- CIEL-specific conversation/session/context state.
- CIEL user preferences/memory that are explicitly part of that subsystem.
- CIEL operational workflow state.

**Never owns or directly mutates unrelated gameplay truth.**

CIEL observes through authorized queries and requests gameplay changes through the same Player/Admin/System command lanes as other actors/services. It cannot write Economy/Inventory/Combat/etc. because it is "inside the server".

### 35. Content Registry

**Owns authoritative content definitions/version history**

- item definitions.
- spell/skill/course definitions.
- location/route definitions.
- NPC/monster definitions.
- recipes.
- achievement/title definitions.
- static encounter/content data.
- content revision/version metadata.

**Does not own** player unlock/progress state.

Core consumes immutable/versioned content definitions. Historical replay must be able to resolve the content revision used by the original action.

### 36. Authoritative History / Replay Ledger

**Owns authoritative history state**

- durable command receipts and terminal outcomes.
- immutable domain event ledger records.
- correlation/causation metadata.
- replay-grade references/snapshots needed by the approved Core/component testing policy.
- correction/reversal linkage.

**Does not own current gameplay state.**

History can reconstruct/audit what happened but is not a back door for another system to mutate current state.

### 37. Admin Audit

**Owns authoritative privileged-access history**

- privileged reads.
- staff/admin actions.
- anti-cheat/moderation inspection audit.
- reasons/case metadata where required.

It is distinct from gameplay history and from Player Log projections.

### 38. Scheduler / Due-Work Infrastructure

**Owns operational state only**

- due-work queue/leases/retry metadata.
- occurrence dispatch state.

**Does not own gameplay completion truth.**

Travel owns journey arrival state; Education owns enrollment completion state; Marketplace owns listing expiry state; Cooldowns owns cooldown state. Scheduler merely notices/dispatches due work through stable System Commands.

### 39. Notifications

**Owns delivery state**

- notification inbox/delivery records where persistent.
- channel delivery attempts/preferences delegated from Preferences.

**Does not own the event that caused the notification.**

Notifications are post-commit effects from authoritative events.

### 40. Anti-Cheat / Abuse Detection

**Owns internal analytical state**

- risk signals.
- detections/cases.
- model/rule outputs.
- investigation metadata.

**Does not own gameplay state or sanctions.**

Enforcement is an explicit Admin/System command against the appropriate owner (for example Identity account suspension or domain restriction) and is audited.

### 41. Projections / Search / Leaderboards

**Own rebuildable read state only**

- home/dashboard views.
- public profile projections.
- player search documents.
- leaderboards/rankings.
- player activity/chronicle projections.
- admin dossiers.
- materialized reporting views.

These never become a write authority merely because they are fast to query.

## Explicit removal of v1 catch-all concepts

The following v1-style concepts must not reappear as global authoritative writable containers:

- `runtimeState`.
- `player_state` full-replacement gameplay blob.
- `player.current`.
- generic `player.condition` covering unrelated domains.
- global `player.counters` as a dumping ground.
- global `qualities` as a dumping ground.
- duplicated `gold` plus `currencies.gold` fields.
- duplicated current location under both player and travel structures.
- generic records/chronicle fields manually mutated by every service.

Replacement mapping:

- current city/journey -> Travel.
- hospital state -> Recovery/Hospital.
- jail/crime restriction -> Justice.
- temporary buff/debuff -> Effects.
- money -> Economy.
- item ownership -> Inventory.
- equipped placement -> Equipment.
- progress counters -> owning system or derived projection.
- player records/chronicle -> History/Player Log projection.
- knowledge/story flags -> typed Knowledge/Contracts/Adventures state.

## Global action eligibility

Nexis must not persist one global `canAct`, `blocked`, `condition`, or action-mask field as authoritative truth.

For a requested action, Application gathers only the snapshots Core needs, for example:

- Identity actor/entitlement/authority.
- Travel/location.
- Hospital/recovery.
- Justice/jail.
- Effects.
- Resources.
- Cooldowns.
- domain-specific owner state.

Core evaluates the rule and returns a typed result.

This lets Travel, Hospital, Justice and Effects evolve independently without every system sharing a mutable status object.

Read-side projections may calculate a convenient `availability` summary for UI display, but that summary is advisory and never accepted as command authority.

## Cross-system transaction model

Separation does not mean pretending every operation belongs to one owner.

### Class A - single-owner mutation

Examples:

- rename a profile field.
- update a preference.
- accept a simple contract state transition with no immediate reward.

One owner applies one typed transition under its own concurrency boundary.

### Class B - atomic multi-owner mutation

Use when the gameplay promise is invalid unless all related state changes commit together.

Canonical examples:

- **Equip item**: Inventory ownership/revision + Equipment slot assignment.
- **Buy marketplace listing**: Marketplace listing + Economy buyer/seller wallets + Inventory ownership transfer.
- **Use consumable**: Inventory quantity + Resources result + Cooldown change + Effects change.
- **Start paid education**: Economy debit + Education enrollment.
- **Complete education with guaranteed progression reward**: Education completion + Progression/Skills/Knowledge/etc. reward transitions when those rewards are part of the same guaranteed resolution.
- **Start travel with fare/cargo reservation**: Travel + Economy and/or Inventory reservation.
- **Guild treasury withdrawal**: Guild permission/governance state where needed + Economy wallet movement.
- **Bounty creation**: Bounty contract + Economy escrow.

In the modular monolith, Application may coordinate these owners inside one database transaction when they share a transactional store. Each owner applies only its typed transition; Application does not reach into private tables.

If a future extraction prevents one physical ACID transaction, the workflow must gain an explicit saga/compensation/idempotency design before extraction. The contract boundary stays stable while the orchestration implementation changes.

### Class C - long-running workflow

Examples:

- multi-step direct trade.
- guild application.
- bounty/capture lifecycle.
- auction/listing lifecycle.
- adventure chain.
- long crafting job.

The workflow owner persists its lifecycle state. Each irreversible cross-owner step remains a normal command with idempotency and audit/history.

### Class D - post-commit derived effect

Examples:

- notifications.
- analytics.
- search index refresh.
- non-authoritative dashboard refresh.
- most leaderboard updates.

These consume committed events from the outbox and may be eventually consistent.

A gameplay-affecting reward/unlock must not be casually moved into eventual processing if the player is promised it as part of the completed command. Either include it atomically or model an explicit pending workflow with a durable eventual guarantee.

## Aggregate-boundary rule

Within each owner, aggregates should be sized around invariants that truly must remain consistent together, not around the word `Player`.

Examples of likely aggregate roots or consistency units:

- ResourceState per Character.
- CooldownState per Character/category set.
- Inventory/Container per owner with item-instance ownership constraints.
- EquipmentLoadout per Character/loadout.
- Wallet per economic owner.
- MarketplaceListing per listing.
- TravelJourney/Location state per Character.
- HospitalEpisode per Character.
- CombatEncounter per encounter.
- EducationEnrollment per Character.
- SkillProgress per Character/skill family.
- Guild aggregate/membership boundaries designed around governance transactions.
- Consortium aggregate/business roster boundaries designed around management transactions.

Exact aggregate shapes are implementation design work and may differ after load/concurrency testing, but an aggregate must never be defined simply as "everything about one player".

If two state groups require atomic change in almost every meaningful command, reconsider whether the boundary is artificially split. If they only occasionally interact, keep them separate and orchestrate the explicit multi-owner transaction.

## Snapshot contracts

Every owner exposes only the minimum stable immutable snapshots required by consumers/Core.

Examples conceptually:

- `ResourceSnapshot`.
- `ProgressionSnapshot`.
- `InventoryOwnershipSnapshot`.
- `EquipmentSnapshot`.
- `TravelSnapshot`.
- `HospitalSnapshot`.
- `JusticeSnapshot`.
- `WalletSnapshot`.
- `EducationSnapshot`.
- `GuildAuthoritySnapshot`.

Rules:

- snapshots contain values, IDs, revisions and version metadata, not persistence entities.
- snapshots are immutable at the Core boundary.
- snapshots are prepared from current authoritative owner state at execution time.
- stale client snapshots never replace server snapshots.
- consumers request only what they require; a universal `PlayerSnapshot` containing the whole game is prohibited.
- composite Core requests may contain several typed owner snapshots, assembled by Application for one command.

## Transition contracts

Core output must be owner-addressable and typed.

Conceptually a result can contain transitions such as:

- Economy: debit Wallet A, credit Wallet B.
- Inventory: transfer Item X from Seller to Buyer.
- Marketplace: mark Listing Y sold.
- Recognition: record qualifying observation/unlock if included in the same resolution.

There must not be a generic "patch path/value" transition such as `player.gold -= 20` or `player.inventory.sword += 1`.

Each owner validates that its transition envelope is structurally compatible, applies concurrency/revision protection, persists it, and emits its committed domain facts.

## Events and read models

State ownership and event ownership are related but not identical.

- The system whose authoritative state changed emits the domain fact describing that change.
- Cross-system integration events are published after the authoritative transaction commits through the outbox.
- Authoritative History records the command/event chain.
- Admin Audit records privileged access/actions.
- Player Log is a knowledge-aware projection over eligible authoritative history.
- Search/leaderboards/home/admin dossiers are rebuildable read models.

No feature service should manually append a mutable `player.records` entry into the player's write state simply to make the UI show activity.

## System-specific permissions

Domain authorization stays with the owning domain snapshot and Core rule.

Examples:

- Identity confirms the actor is Character X.
- Guilds states Character X is an Officer with specific guild permissions.
- Economy states the guild wallet has a balance.
- Core decides whether the requested withdrawal is legal and its transition.

Guild Officer does not become a platform Identity capability. Likewise platform Administrator does not silently become a guild officer unless an explicit Admin command/policy permits intervention.

## Ownership transfers

Ownership-transfer domains require extra care because two parties often believe they own the same thing during a race.

Rules:

- Inventory is the single owner of item ownership.
- Economy is the single owner of currency balances/reservations.
- Marketplace/Trade/Bounty/Guild/Consortium reference those assets; they do not copy them into their own authoritative balances.
- reservations use stable reservation/escrow identifiers.
- contested transfers use the approved hybrid concurrency strategy and canonical lock order.
- database uniqueness/foreign-key/check constraints remain final structural guardrails.

## Public/client state

The client never receives one server object intended to be edited and posted back as authoritative state.

Client-facing models are projections/DTOs.

A client action submits intent and optional validated preconditions. Application reloads owner snapshots, Core evaluates the current truth, owners commit transitions, then the client receives/refetches authoritative projections with revision metadata.

This directly prevents the v1 style of client/server state drift from becoming a persistence model.

## Migration consequence

V1 migration must decompose the broad runtime/player snapshot into owner-specific v2 state.

Migration must explicitly map each source field to one target owner or projection destination. Any field with no clear owner is a migration/design anomaly, not permission to create a `misc` JSON column.

During migration/reconciliation:

- duplicated v1 values such as gold/currencies or location/travel must be compared and conflicts reported.
- known wiped/missing runtime fields must be treated as source-data anomalies.
- projections/records are rebuilt from canonical data/history where practical rather than blindly migrated as write state.
- retired features such as Life Paths are not granted a new authoritative owner unless the product design explicitly retains their data for history/Feats of Strength conversion.

## Architecture tests required

Before broad gameplay implementation, automated architecture/contract tests must prove at minimum:

1. no system implementation references another system's private persistence/repository assembly.
2. no surrounding system references concrete `Nexis.Core` implementation classes.
3. Core does not reference private system persistence implementations.
4. public contracts contain no EF/Npgsql/HTTP/frontend types.
5. no global authoritative `PlayerState`/`RuntimeState`/generic qualities/counters write model is introduced.
6. a fake/replacement owner implementation can satisfy the same public contract without consumer source changes.
7. a fake/replacement Core can consume the same snapshots and produce valid typed transitions.
8. projections cannot call authoritative repositories to mutate state.
9. Scheduler/system workers cannot directly update gameplay tables.
10. CIEL cannot directly write gameplay owner state.
11. Inventory is the sole authoritative item-ownership writer.
12. Economy is the sole authoritative currency-balance writer.
13. Travel is the sole authoritative current-location/journey writer.
14. Resources is the sole authoritative resource-bar writer.
15. Equipment cannot create/delete item ownership.
16. Marketplace cannot directly edit wallet/item tables.
17. Guilds/Consortiums cannot directly edit wallet/item tables.
18. client DTOs are not reused as persistence entities or trusted command state.
19. owner snapshots include revision/version metadata where concurrency/replay requires it.
20. cross-owner commands demonstrate atomic rollback when any participating owner transition fails.

## Initial implementation order

Do not build all forty systems at once. That would merely produce a distributed version of the old mess.

Foundation agents should first prove the ownership architecture with a narrow vertical set:

1. `Nexis.Core.Contracts` / selected Core interface.
2. Identity contracts/implementation split.
3. authoritative command/Application transaction boundary.
4. History/Event/Audit foundation.
5. Progression contracts.
6. Resources contracts.
7. Economy contracts.
8. Inventory contracts.
9. Equipment contracts.
10. one deliberately multi-owner conformance scenario such as `EquipItem` or a synthetic purchase, proving snapshots -> Core -> typed transitions -> atomic owner persistence.

Only after architecture tests prove these boundaries should agents fan out into Travel, Education, Combat, Marketplace, Skills, Magic, Guilds, Consortiums and the rest.

## Non-goals

This document does not choose:

- the final PostgreSQL physical schema/database-per-system strategy.
- exact C# project names for every future bounded context.
- exact table/column layout.
- exact public API endpoints.
- final combat/economy/spell balance formulas.
- whether any future owner is extracted into a separate process/service.

Those decisions must preserve this ownership contract rather than redefining ownership accidentally.

## Final invariant

Nexis must be able to point at any authoritative field and answer one question unambiguously:

> Which system is the only system allowed to write this truth?

If the answer is "several services," "whatever loaded the player object," "the Core," "the client," or "it depends which page you're on," the architecture has regressed.
