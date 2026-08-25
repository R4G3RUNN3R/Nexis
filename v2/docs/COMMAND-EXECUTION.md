# Nexis 2.0 Authoritative Command Execution Contract

_Status: approved foundation design for implementation after build verification._

## Purpose

Nexis 2.0 uses one standardized authoritative command model without forcing every action through one giant handler, one global queue, or one concurrency strategy.

Every authoritative state mutation enters through an approved execution lane. Shared concerns are applied consistently by the lane; the owning domain module alone decides its gameplay invariants and state transition.

Read-only queries are separate and never acquire mutation semantics merely because they crossed an API boundary.

## Research basis

This design was selected after comparing the patterns used by the games and systems Nexis has borrowed from and the failure modes already observed in Nexis v1.

- **Torn** keeps its public API read-only and resolves player mutations inside the authoritative game service. Its gameplay also demonstrates why global states such as travel, hospitalization, resource bars and cooldowns must influence many otherwise unrelated actions consistently.
- **WoW-like server architecture / TrinityCore** uses common session/packet ingress, specialized gameplay handlers, action throttling and transactional persistence for sensitive operations. Auction commodity flow also uses short-lived authoritative quotes rather than trusting stale client price state.
- **Fallen London / StoryNexus** models actions as current-state prerequisites followed by consequences that change world/player state. The important lesson is to re-evaluate authoritative prerequisites at execution time rather than trust what the client previously saw.
- **DarkThrone and similar browser RPGs** combine player actions with timed world processing, reinforcing that scheduler-driven mutations are still game actions and must not bypass the game rules.
- **NationStates** shows the value of data-driven decision effects inside an appropriate domain, but not as a replacement for strong transactional invariants in economy, inventory or identity.
- **Existing Nexis v1** already uses PostgreSQL transactions, row locking and canonical multi-player lock ordering in marketplace, PvP, item and organization flows. Those safeguards are worth preserving as principles, not as scattered feature-specific code.
- **.NET/PostgreSQL guidance** supports identified/idempotent commands, optimistic concurrency for ordinary conflicts, explicit locking where contention demands it, bounded full-transaction retries for serialization/deadlock failures, and atomic state/event persistence.

The result is a hybrid model deliberately adapted to Nexis rather than a copy of one source game.

## Permanent rules

1. No controller, scheduler, client, background worker, admin surface or infrastructure adapter may mutate authoritative game state by bypassing the owning domain module.
2. A command is a request and may be accepted, rejected, conflicted, cancelled or fail. A domain event is a fact that already happened. Do not blur them.
3. The actor is derived from trusted server authentication/system context. Client payloads never grant account, role, admin, ownership or character authority.
4. The server's game clock is authoritative. Client timestamps may be retained as untrusted diagnostics only and never decide cooldowns, expiry, ordering or rewards.
5. Current authoritative state is reloaded/revalidated at execution time. A screen the player opened five seconds ago is evidence of what they saw, not permission to mutate stale state.
6. Every meaningful command attempt has a stable command identity and is protected against duplicate execution.
7. State changes and the durable events/outbox records caused by a successful command commit atomically.
8. External side effects such as email, WebSocket pushes, analytics and webhooks happen after commit through durable post-commit delivery mechanisms; they do not sit inside the authoritative game transaction.
9. Concurrency protection is chosen by domain risk/contention. Nexis does not lock everything and does not pretend optimistic concurrency solves every contested transfer.
10. Multi-resource locks use deterministic canonical ordering.

## Execution lanes

### Player command lane

For commands initiated by an authenticated player, for example BuyListing, AttackPlayer, EquipItem, StartEducation, TravelTo or CastSpell.

Shared stages:

1. establish trusted account/session context;
2. resolve the active character and entitlement context;
3. establish command identity/idempotency;
4. validate command schema and size/rate constraints;
5. apply universal/global game policies;
6. load authoritative state needed by the owning domain;
7. execute domain-specific validation and rules;
8. apply the selected concurrency strategy;
9. commit state + events + outbox atomically;
10. persist the terminal command outcome;
11. return/push the authoritative result.

### Admin command lane

For state-changing privileged actions such as corrections, sanctions, grants, reversals or repairs.

It uses the same core command identity/concurrency/transaction guarantees plus:

- elevated server-derived authorization;
- mandatory reason/case metadata where required;
- mandatory Admin Audit output;
- impact-based decision on whether a safe player-facing log projection is created;
- no hidden bypass that writes directly to domain tables.

Privileged read-only inspection remains on the authorized query path but is still recorded in the internal Admin Audit according to the existing audit decision.

### System command lane

For authoritative timer/scheduler/world actions such as CompleteEducation, FinishTravel, ExpireListing, ResolveCooldown or ProcessWorldEvent.

System jobs do not mutate tables directly. They issue domain commands using a trusted system actor and a stable occurrence identity so retries cannot resolve the same scheduled event twice.

### Realtime command lane

Reserved for future high-frequency native/Steam/WebGL gameplay where an HTTP-style request pipeline would be too heavy.

A realtime session loop may dispatch commands differently, but it must preserve the same identity, server-time, authority, domain ownership, idempotency where applicable, state-transition and durable-event contracts. It is not permission to create a second authoritative rules engine.

### Query lane

Read-only requests such as opening inventory, viewing a profile, browsing the marketplace or reading the Player Log do not enter the mutation pipeline.

They still enforce authentication/authorization/knowledge filtering where required, but do not acquire idempotency, mutation transactions or domain-event semantics simply because data was requested.

## Command envelope

The exact C# types may evolve during implementation, but every external or internally scheduled authoritative command must resolve to an execution envelope with these concepts.

### CommandId

- immutable unique identity for one command intent;
- stable across network retries;
- client/session SDK may generate it for player/admin commands, but the server validates its shape and binds it to the authenticated actor;
- system commands use server-generated or deterministic occurrence IDs;
- reusing the same CommandId with a different actor, command type or payload fingerprint is an integrity violation and must be rejected;
- duplicate delivery of the same command returns/reconstructs the prior authoritative outcome rather than executing again.

### CorrelationId

- groups the complete causal operation for diagnostics, Player Log grouping and downstream events;
- created/normalized by trusted server infrastructure at ingress;
- propagated through child commands/events;
- untrusted clients cannot choose a correlation identifier that grants access to another operation.

### Command type and contract version

- identifies the owning command contract and its schema version;
- public command contracts are module-owned and versioned deliberately;
- implementations may change without silently changing the public meaning of an existing contract.

### Actor context

Created by the server, not accepted as authoritative command payload.

It may contain trusted concepts such as:

- AccountId;
- active CharacterId where applicable;
- execution lane/actor kind;
- validated authorization/entitlement context;
- session/security context needed by policy evaluation.

Character name, display name, title or client-supplied role fields never establish authority.

### Authoritative receive time

Recorded from `IGameClock` when the engine accepts the command. It is used for audit ordering and command-lifecycle records.

A client-supplied time may be retained for diagnostics/UI latency analysis only. It cannot determine gameplay truth.

### Payload

Typed module-owned command data containing only the player's requested intent and domain inputs. It must not contain server-derived privileges or calculated authoritative results.

### Optional preconditions

Commands may carry explicit preconditions when a workflow benefits from stale-state protection, such as an expected aggregate revision, quote identifier, listing identifier/version or other domain-specific token.

These are assertions to validate, never instructions to trust.

Nexis will not require every client mutation to send one global `ExpectedVersion`; different domains have different contention models.

## Command receipt and lifecycle

Nexis already requires every meaningful gameplay command attempt to appear in permanent history, including success, rejection and failure. Idempotency must therefore work with that audit requirement rather than sit beside it as an unrelated cache.

Recommended lifecycle:

1. **Receive** - establish a unique CommandId and durable receipt for the authenticated actor/command/payload fingerprint.
2. **Execute** - run the owning domain through the selected transaction/concurrency strategy.
3. **Terminate** - append a terminal outcome such as Succeeded, Rejected, Conflict, Cancelled or DomainFailed and link emitted domain events through correlation/causation metadata.

The idempotency registry may maintain operational status for efficient lookup, but the canonical historical command attempt/outcome is append-oriented and must remain reconstructable from the authoritative ledger.

If the engine crashes after receipt but before a terminal outcome, recovery may safely resume/retry that same CommandId. It must never invent a new command ID and risk applying the intent twice.

Transport failures that occur before the command is durably accepted are operational telemetry, not proof that the engine received a gameplay command.

## Idempotency behaviour

Idempotency is mandatory for authoritative mutation commands unless a command is provably naturally idempotent and the contract explicitly documents why.

For a repeated CommandId:

- same actor + same command type + same payload fingerprint + completed result -> return/reconstruct the existing outcome;
- same identity while still executing -> return/wait according to lane policy without re-executing;
- same CommandId with changed actor/type/payload -> reject and record an integrity/security signal;
- a caller wanting to perform the same gameplay action again intentionally must create a new CommandId.

This prevents double purchases, duplicate rewards, repeated refills, repeated transfers and the classic "the first response timed out so the browser bought it twice" failure.

## Concurrency strategy

Nexis uses a **hybrid** strategy.

### Default: optimistic concurrency

Use aggregate/domain revision tokens or equivalent compare-and-swap protection for ordinary low-contention state changes.

Good fits include:

- profile/game preferences;
- education enrollment state when only the owner can mutate it;
- many single-character progression updates;
- configuration-style domain state.

If the state changed since it was loaded, the operation re-evaluates from current authoritative state or returns a defined conflict according to domain semantics. Do not silently overwrite another valid mutation.

### Selective pessimistic locking

Use explicit row/resource locks for scarce or highly contested authoritative resources where two simultaneous operations must not both believe they won.

Likely fits include:

- buying/cancelling the same marketplace listing;
- player-to-player transfers/trades;
- guild/consortium treasury operations;
- unique item ownership transfer;
- escrow settlement;
- limited-stock/limited-claim rewards;
- some PvP or capture resolutions that atomically affect multiple actors.

Locks stay inside short database transactions and are never held while waiting on external network services.

### Canonical lock ordering

When one command must lock multiple players/resources, resources are acquired in deterministic canonical order. The existing v1 marketplace/PvP pattern of sorting player identities before locking is retained as a design principle.

Domain modules define the canonical key ordering for their resource types; application/persistence infrastructure enforces it consistently.

### Database constraints as final invariants

Unique constraints, foreign keys, check constraints and atomic conditional updates should protect invariants that the database can enforce cheaply.

Application checks improve errors and domain semantics; they do not replace the final database guardrail for uniqueness/ownership/one-time claims.

### Transaction isolation and retries

Do not make PostgreSQL `SERIALIZABLE` the blanket default merely because it is the strongest label.

Start from normal short transactions with explicit domain concurrency protection. Where a domain genuinely benefits from stronger isolation, choose it deliberately and test contention.

Infrastructure must provide a bounded full-transaction retry policy for retryable PostgreSQL concurrency failures such as serialization failures and deadlocks. A retry restarts the entire domain operation from current authoritative state, not merely the last SQL statement.

Never automatically retry:

- authorization failures;
- insufficient resources;
- invalid command state;
- business-rule rejection;
- permanent unique/constraint violations that represent a real domain conflict.

After bounded technical retries are exhausted, return a defined retryable technical/conflict result and preserve operational diagnostics.

## Stale-state protection and quotes

A client-visible price, inventory count, target status or cooldown snapshot can become stale before the click reaches the engine.

Therefore:

- authoritative domain rules are always re-evaluated at execution time;
- high-risk multi-step flows may issue short-lived server-side quote/reservation/precondition tokens;
- a valid quote guarantees only the domain properties explicitly stated by that quote;
- expiry and quote validation use authoritative engine time;
- quote IDs/tokens do not replace the command's own CommandId.

This is particularly suitable for future marketplace commodity purchases, expensive crafting, travel fares or other flows where the player should be shown a firm value briefly before committing.

## Atomic persistence and outbox

For a successful durable command, one authoritative transaction must commit the logically coupled durable state together:

- domain state mutations;
- durable terminal command outcome/idempotency state needed to prevent replay;
- authoritative domain/audit events caused by the command;
- outbox records for downstream delivery.

No successful response may be sent before that durable commit is known to have succeeded.

Post-commit consumers may then update projections, notifications, websocket feeds, achievements or external integrations according to their consistency requirements. Consumers are themselves idempotent by EventId.

## Failure/result vocabulary

The exact result types are implementation work, but the engine must distinguish at least:

- **Succeeded** - authoritative state transition committed;
- **Rejected** - command was understood but a domain/policy prerequisite was not satisfied;
- **Conflict** - current authoritative state or concurrency made the requested transition invalid/stale;
- **Cancelled** - a supported cancellation path ended the intent without the requested final transition;
- **DomainFailed** - the game's defined resolution itself produced a failure outcome, such as a failed risky action, but processing was technically successful;
- **TechnicalFailure** - infrastructure prevented completion and no success is claimed.

A `DomainFailed` action is still a valid resolved gameplay event. A `TechnicalFailure` must never masquerade as an in-world failure and consume resources unless the authoritative transaction actually committed that outcome.

## Example concurrency matrix

| Operation | Default strategy | Additional guardrails |
| --- | --- | --- |
| Update player preference | optimistic revision | actor ownership |
| Start education | optimistic/domain revision | current prerequisites rechecked |
| Equip item | optimistic inventory/equipment revision | ownership + slot invariants |
| Buy marketplace listing | ordered pessimistic locks | listing status, funds, inventory, unique/conditional update |
| Direct player transfer | ordered pessimistic locks | balance/ownership constraints, idempotent CommandId |
| Guild treasury withdrawal | treasury/member lock | permission snapshot rechecked, audit |
| Claim one-time reward | atomic conditional/unique constraint | CommandId + claim key |
| Finish travel timer | system command + optimistic/conditional transition | deterministic occurrence ID, server time |
| Expire marketplace listing | system command + listing lock/conditional transition | stable occurrence/command identity |
| Future realtime movement | realtime authoritative loop | sequence/state rules defined by realtime domain |

## Implementation boundaries

### Kernel

May define only genuinely universal primitives/contracts needed by all commands, such as CommandId, CorrelationId and universal command metadata abstractions. It must not gain marketplace/combat/travel rules.

### Module-owned contracts

Each module owns its command payloads, public result contracts and any domain-specific precondition/quote types.

### Application/execution layer

Owns lane orchestration, actor-context construction, idempotency orchestration, transaction policy selection hooks, correlation propagation and dispatch to the owning domain contract.

It does not own domain gameplay rules.

### Persistence adapters

Own PostgreSQL/EF/Npgsql implementation details for command receipts, transactions, concurrency tokens, locking, outbox and retry classification.

No EF Core/Npgsql types leak into Kernel/Core/module public contracts.

## Required tests before broad gameplay work

Add automated tests proving at minimum:

1. identical CommandId + identical intent cannot mutate state twice;
2. reused CommandId with a changed payload/actor is rejected;
3. a duplicate completed command returns/reconstructs the original authoritative outcome;
4. two concurrent purchases of one listing can produce at most one winner;
5. opposite-direction two-player operations cannot deadlock because locks are acquired canonically;
6. optimistic revision conflicts never silently overwrite newer state;
7. a system job retry cannot complete the same timer/reward twice;
8. a failed transaction emits no success event/outbox record;
9. committed state and emitted durable events cannot diverge;
10. technical failure is not converted into an in-world failure that consumes player resources;
11. domain prerequisites are re-evaluated against current authoritative state, not trusted from client snapshots;
12. query paths cannot invoke mutation handlers or acquire authority by supplying command-like fields.

## Explicit non-goals

- no single mega-handler for every Nexis action;
- no global queue delaying ordinary synchronous gameplay;
- no blanket table locking;
- no blanket Serializable transaction policy without domain evidence;
- no generic rules engine replacing strongly invariant economy/inventory/identity code;
- no client-authoritative expected state;
- no direct scheduler SQL mutations;
- no external service calls inside authoritative database transactions;
- no duplicate authoritative owner for the same state domain.
