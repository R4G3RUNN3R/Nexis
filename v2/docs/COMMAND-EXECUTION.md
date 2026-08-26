# Nexis 2.0 Authoritative Command Execution Contract

_Status: approved foundation design, reconciled 2026-08-25 with Core and State Ownership._

## Purpose

Nexis 2.0 uses one standardized authoritative command model without forcing every action through one giant handler, one global queue, one mutable player object or one concurrency strategy.

Every authoritative mutation enters through an approved execution lane. The Application layer gathers current trusted snapshots from the authoritative state owners, the selected `Nexis.Core` implementation evaluates gameplay rules and produces typed owner-addressed transitions, and the owning systems persist only their own facts under the required concurrency/transaction boundary.

Read-only queries are separate and never acquire mutation semantics merely because they crossed an API boundary.

`CORE-ARCHITECTURE.md` is authoritative for rule ownership. `STATE-OWNERSHIP.md` is authoritative for persistent-state ownership. This document defines how commands execute across those boundaries.

## Research basis

This design combines the strongest patterns from Nexis's inspiration set and the useful safeguards already present in v1 without repeating v1's shared-state coupling.

- **Torn** keeps external APIs observational/read-oriented while authoritative gameplay resolves server-side. Shared states such as travel, hospitalization, resources and cooldowns affect otherwise unrelated actions, reinforcing current-state server evaluation.
- **WoW-like / TrinityCore** server patterns use centralized authoritative ingress with specialized rules/handlers and explicit transactions/locking for contested flows such as auctions.
- **Fallen London / StoryNexus** demonstrates state prerequisite evaluation followed by state consequences, reinforcing re-evaluation from current authoritative state rather than trusting what the client previously saw.
- **Existing Nexis v1** already uses PostgreSQL transactions, row locks and canonical multi-player lock ordering in sensitive flows. Those safeguards are preserved as principles while the broad mutable `player_state` ownership model is rejected.
- **PostgreSQL/.NET** support optimistic revisions for ordinary conflicts, explicit locking for contested resources, bounded whole-transaction retry for retryable DB failures, and atomic durable state/event/outbox commits.

## Permanent rules

1. No controller, scheduler, client, worker, admin surface, CIEL workflow or infrastructure adapter may mutate authoritative gameplay state by bypassing the approved command lane, Core evaluation and owning-system transition boundary.
2. A command is a request. A domain event is a committed fact. Do not blur them.
3. Actor identity/authority is server-derived. Client payloads never grant account, character, role, ownership or admin authority.
4. Server game time is authoritative. Client timestamps are diagnostics only.
5. Current owner snapshots are loaded/revalidated at execution time. UI state is never mutation authority.
6. Every meaningful mutation command has stable command identity/idempotency protection.
7. Core returns typed transition intent; it does not write owner databases directly.
8. Each authoritative owner applies only transitions addressed to its own state and protects structural/revision invariants.
9. Logically coupled owner state + terminal command outcome + authoritative events + outbox commit atomically where the gameplay promise requires atomicity.
10. External side effects happen after commit through durable delivery.
11. Concurrency protection is selected by contention/risk rather than applied uniformly.
12. Multi-resource locks use deterministic canonical ordering.
13. No execution path may reconstruct a universal mutable `PlayerState`/`RuntimeState` and write it back as the command result.

## Execution lanes

### Player command lane

For authenticated player intents such as BuyListing, AttackPlayer, EquipItem, StartEducation, TravelTo or CastSpell.

Shared stages:

1. establish trusted account/session context;
2. resolve active Character and entitlement context;
3. establish CommandId/idempotency receipt;
4. validate contract schema, size and rate constraints;
5. resolve the set of authoritative owners required by the intent;
6. load current immutable typed snapshots/revisions from those owners;
7. assemble trusted Core evaluation context, including authoritative time and controlled RNG where required;
8. invoke the selected Core implementation to evaluate rules and produce Succeeded/Rejected/Conflict/DomainFailed/etc. plus typed owner-addressed transitions/events;
9. if no committed mutation is warranted, persist the appropriate command outcome/history and return;
10. if mutation is warranted, enter the selected concurrency/transaction boundary and revalidate/reload any state whose contention policy requires it;
11. apply each typed transition through its authoritative owner, never by direct foreign-table writes;
12. atomically commit owner state + terminal command/idempotency state + authoritative events + outbox;
13. return/push authoritative projections/results.

Core rule evaluation may be repeated inside the transaction after contested state is locked/reloaded when required for correctness. The pre-transaction evaluation is not permission to commit a stale decision.

### Admin command lane

For state-changing privileged operations such as corrections, sanctions, grants, reversals and repairs.

It uses the same command/Core/owner guarantees plus:

- elevated current server-side capability checks;
- mandatory reason/case metadata where policy requires it;
- mandatory Admin Audit output;
- safe player-facing material-effect projection where appropriate;
- no silent impersonation and no direct owner-table bypass.

Privileged read-only inspection stays on the authorized query path and remains auditable.

### System command lane

For timer/scheduler/world occurrences such as CompleteEducation, FinishTravel, ExpireListing, ResolveCooldown or ProcessWorldEvent.

Schedulers own due-work mechanics, not gameplay outcomes. They issue trusted System Commands with stable occurrence identity. Application loads current owner snapshots, Core evaluates, and owners persist the result exactly as with other authoritative commands.

### Realtime command lane

Reserved for future high-frequency native/Steam/WebGL flows where HTTP-style ingress would be too heavy.

A realtime dispatcher may differ operationally but must preserve identity, authority, authoritative time, state ownership, Core rule evaluation, concurrency, event and persistence invariants. It is not permission to create a second rules engine or second write owner.

### Query lane

Read-only operations such as inventory/profile/marketplace/log views do not enter mutation semantics.

They enforce identity/authorization/knowledge filtering but do not gain idempotency or mutation transactions merely because data was requested. Query/projection code cannot write authoritative owner state.

## Command envelope

Every external or internally scheduled authoritative command resolves to these concepts. Exact C# types may evolve behind stable contracts.

### CommandId

- immutable identity for one command intent;
- stable across retries;
- may be generated by an approved client/session SDK for player/admin requests but is validated and bound to the authenticated actor;
- system commands use server-generated or deterministic occurrence identity;
- same CommandId + same actor/type/payload returns/reconstructs the prior outcome rather than executing again;
- reuse with a different actor/type/payload fingerprint is an integrity/security violation;
- intentionally repeating an action requires a new CommandId.

### CorrelationId

- groups one causal operation for diagnostics/history/downstream events;
- created/normalized by trusted infrastructure at ingress;
- propagated through child commands/events;
- never grants authority.

### Contract type/version

- identifies the versioned intent contract;
- system/domain public contracts are owned by the relevant contract boundary;
- implementation changes must not silently change existing contract meaning.

### ActorContext

Created by trusted server infrastructure, not accepted as authoritative payload. It may contain AccountId, active CharacterId, actor kind/lane, validated capabilities/entitlements and security/session revocation context.

Names, titles, public lore and client-supplied roles never establish authority.

### Authoritative receive/evaluation time

Recorded from `IGameClock`. Client time is diagnostic only and cannot determine cooldowns, expiry, ordering or rewards.

### Payload / intent

Typed requested intent and player-supplied domain inputs only. It does not contain server-derived privilege or calculated authoritative results.

### Optional preconditions / quotes

Expected revisions, quote IDs, listing versions, reservations or similar tokens may protect stale multi-step flows. They are assertions to validate, never values to trust.

There is no required global `ExpectedPlayerVersion`; each owner/operation defines the concurrency preconditions it genuinely needs.

## Command receipt and lifecycle

Every meaningful gameplay command attempt remains durably traceable.

1. **Receive** - establish unique CommandId and durable receipt bound to actor/type/payload fingerprint.
2. **Evaluate/Execute** - load owner snapshots, invoke Core, then apply any accepted typed owner transitions under the selected transaction/concurrency strategy.
3. **Terminate** - durably record Succeeded, Rejected, Conflict, Cancelled, DomainFailed or TechnicalFailure and link resulting events through correlation/causation metadata.

If the process crashes after durable receipt but before terminal outcome, recovery resumes/retries the same CommandId. It must not invent a new identity and risk duplicate mutation.

Transport failure before durable acceptance is operational telemetry, not proof that a gameplay command was received.

## Idempotency behaviour

Idempotency is mandatory for authoritative mutation commands unless a contract is explicitly proven naturally idempotent.

For a repeated CommandId:

- same actor + type + payload fingerprint + completed outcome -> return/reconstruct original outcome;
- same identity while executing -> return/wait according to lane policy without a second execution;
- changed actor/type/payload -> reject and record integrity/security signal;
- deliberate repeat action -> new CommandId.

This prevents duplicate purchases, rewards, refills, transfers, crafting completions and timer resolutions.

## Core evaluation and owner transitions

Core receives only immutable current snapshots/content/context needed by the intent. It returns typed results and transitions addressed to specific owners.

Examples:

- Marketplace purchase -> Marketplace listing transition + Economy debit/credit + Inventory ownership transfer.
- Equip item -> Equipment slot transition, with Inventory ownership/revision precondition.
- Use consumable -> Inventory decrement + Resources change + Cooldown transition + Effects transition as applicable.
- Paid education -> Economy debit + Education enrollment.

There is no generic path/value patch such as `player.gold -= 20` or `player.inventory.sword += 1`.

The owner may reject malformed/stale/impossible transition envelopes or DB constraint violations. That is storage/state integrity, not a second gameplay rules implementation.

## Concurrency strategy

Nexis uses a hybrid strategy.

### Default: optimistic concurrency

Use owner/aggregate revision tokens or conditional updates for ordinary low-contention state.

Good fits include preferences, many single-character progression changes and education state where only one actor normally mutates the record.

On conflict, reload current owner snapshots and re-evaluate through Core or return defined Conflict semantics. Never silently overwrite newer state.

### Selective pessimistic locking

Use explicit short-lived locks for scarce, contested or high-value resources where two operations cannot both win.

Likely fits:

- one marketplace listing purchase/cancel race;
- direct trades/transfers;
- organization treasury operations;
- unique item ownership transfer;
- escrow settlement;
- limited claims/rewards;
- some PvP/capture resolutions affecting multiple actors.

Locks are never held across external network calls.

### Canonical lock ordering

When multiple owners/resources must be locked, Application/persistence infrastructure obtains them in deterministic canonical order defined by stable resource keys. The useful v1 practice of ordered player locking is preserved without preserving the v1 giant player-state row.

### Database constraints

Unique constraints, FKs, checks and atomic conditional updates are final structural guardrails where appropriate. Application/Core checks provide gameplay semantics; DB constraints protect impossible persisted shape/ownership/uniqueness.

### Isolation and retries

Do not use blanket PostgreSQL `SERIALIZABLE` merely because it sounds safe.

Use short transactions plus explicit owner concurrency rules. Infrastructure provides bounded whole-operation retry for retryable DB serialization/deadlock failures (for example SQLSTATE 40001/40P01). Each retry reloads current snapshots and re-runs rule evaluation as required.

Never automatically retry authorization failures, insufficient resources, invalid state, business-rule rejection or permanent constraint conflicts.

## Stale-state protection and quotes

Client-visible prices, balances, inventory, target status and cooldowns are snapshots, not authority.

Therefore:

- current owner state is reloaded and Core rules are re-evaluated at execution;
- high-risk multi-step flows may issue short-lived server-side quotes/reservations;
- a quote guarantees only the properties explicitly stated by its contract;
- expiry uses authoritative game time;
- quote/reservation identity never replaces CommandId.

## Atomic persistence and outbox

For a successful durable command, one authoritative transaction commits all state that the gameplay promise requires to move together:

- all participating owner state transitions;
- terminal command/idempotency outcome;
- authoritative domain/audit/history records required by the command;
- durable outbox records.

No success response is sent before commit succeeds.

Post-commit consumers may update notifications, WebSocket feeds, analytics, search, dashboards and other rebuildable projections. Consumers are idempotent by EventId/contract identity.

If future service extraction prevents a single ACID transaction, that specific workflow requires an explicit saga/compensation/idempotency design before extraction. Service boundaries do not excuse broken gameplay invariants.

## Failure/result vocabulary

Core/execution distinguishes at least:

- **Succeeded** - required authoritative transition committed;
- **Rejected** - intent understood but rule/policy prerequisite not satisfied;
- **Conflict** - current authoritative state/concurrency made requested transition stale/invalid;
- **Cancelled** - supported cancellation ended the intent without requested final transition;
- **DomainFailed** - technically successful gameplay resolution produced an in-world failure;
- **TechnicalFailure** - infrastructure prevented completion and no success is claimed.

A DomainFailed action may legitimately consume resources if that is the committed game rule. A TechnicalFailure must not masquerade as an in-world failure or consume resources unless an explicit durable gameplay outcome was actually committed.

## Example concurrency matrix

| Operation | Default strategy | Additional guardrails |
| --- | --- | --- |
| Update preference | optimistic revision | actor ownership |
| Start education | optimistic/domain revision | current prerequisites + Economy debit atomicity |
| Equip item | optimistic Inventory/Equipment revisions | ownership + slot invariants |
| Buy marketplace listing | ordered pessimistic/conditional locks | Marketplace + Economy + Inventory atomicity |
| Direct transfer | ordered locks/reservations | Economy/Inventory ownership constraints + CommandId |
| Guild treasury withdrawal | Guild authority snapshot + Economy wallet lock | current domain permission rechecked + audit |
| Claim one-time reward | conditional/unique claim | CommandId + claim key |
| Finish travel | System Command + Travel conditional transition | stable occurrence ID + server time |
| Expire listing | System Command + listing lock/conditional transition | stable occurrence ID |
| Future realtime movement | realtime authoritative loop | same Core/owner/event invariants |

## Implementation boundaries

### Kernel

Only genuinely universal primitives/contracts such as CommandId, CorrelationId and event/time abstractions. No combat/market/travel rules.

### Core contracts / Core implementation

Core contracts define the stable evaluation boundary. Concrete Core owns gameplay rule/calculation implementations and must not reference private persistence or owner implementation internals.

### System-owned contracts

Each authoritative owner defines stable snapshots, transition envelopes, public query/intent concepts and owner-specific preconditions/quotes as required. Contracts contain no EF/Npgsql/HTTP/frontend implementation types.

### Application/execution layer

Owns lane orchestration, ActorContext construction, current-snapshot loading coordination, Core invocation, idempotency, transaction/concurrency policy execution, correlation propagation and routing typed transitions to owners.

It does not contain gameplay formulas and does not write owner tables directly.

### Authoritative owner systems

Own persistent facts and apply only their typed transitions. They protect revision/structural/storage invariants but do not recreate Core gameplay calculations.

### Persistence adapters

Own PostgreSQL/EF/Npgsql implementation details for owner storage, command receipts, transactions, locking, outbox and retry classification. Those types never leak through public contracts.

## Required tests before broad gameplay work

Add automated tests proving at minimum:

1. identical CommandId + identical intent cannot mutate state twice;
2. CommandId reuse with changed payload/actor is rejected;
3. duplicate completed command reconstructs original outcome;
4. two concurrent purchases of one listing produce at most one winner;
5. opposite-direction multi-owner operations use canonical lock order and avoid preventable deadlock;
6. optimistic conflicts never silently overwrite newer owner state;
7. system-job retry cannot complete the same occurrence twice;
8. failed transaction emits no success event/outbox record;
9. committed owner state and durable events cannot diverge;
10. TechnicalFailure is not converted into an in-world loss;
11. prerequisites are re-evaluated from current authoritative owner snapshots, not client state;
12. query paths cannot invoke mutation semantics;
13. Core cannot write persistence directly;
14. Application cannot directly mutate owner tables;
15. Marketplace cannot directly edit Economy/Inventory state;
16. Guilds/Consortiums cannot directly edit Economy/Inventory state;
17. no global writable PlayerState/RuntimeState/qualities/counters object is introduced;
18. a multi-owner command rolls back all participating owner transitions when one transition cannot commit.

## Explicit non-goals

- no single mega-handler for every Nexis action;
- no giant mutable player aggregate;
- no global queue delaying ordinary synchronous gameplay;
- no blanket table locking;
- no blanket Serializable policy without evidence;
- no second gameplay rules engine inside Application or owner systems;
- no client-authoritative expected state;
- no direct scheduler SQL gameplay mutations;
- no external service calls inside authoritative DB transactions;
- no duplicate authoritative owner for one state concept;
- no generic path/value patch mechanism spanning systems.
