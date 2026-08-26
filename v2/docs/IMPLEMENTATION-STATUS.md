# Nexis 2.0 Foundation Implementation Status

_Status: rolling implementation checkpoint, updated 2026-08-26. This file records progress only. It does not supersede `ENGINEERING-MANUAL.md` or any binding architecture/canon document._

## Current branch

`feature/nexis-v2-foundation-skeleton`

Draft PR #4 remains the integration surface and must remain draft until the complete foundation stop conditions in `AGENT-HANDOFF.md` are satisfied.

Existing/current Nexis outside `v2/` remains reference/migration source only. Nothing recorded here authorizes live deployment, live database mutation, or v1 changes.

## Current verified implementation

The V2 branch now contains and has executable coverage for:

- separate stable Core, Identity, Execution, Audit, Eventing, Content, Items, Inventory, Equipment, Combat and Automation contract assemblies;
- replaceable `ICoreRulesEngine` with explicit internal evaluator dispatch and no feature implementation, persistence, network or UI dependencies;
- trusted Player/Admin/System/Realtime actor context with Account/Character separation, capability-based platform authority and commercial entitlements kept separate;
- stable `SystemActorKey` identities for automated authorities, kept separate from Account/Character identity and retained through idempotency, persistence and crash recovery;
- deterministic Core evaluation inputs: authoritative UTC time, rule/content versions and replay-safe RNG factories;
- exact integer/rational arithmetic with explicit rounding and checked overflow;
- golden/conformance comparison for baseline and replacement Core implementations;
- CommandId idempotency receipts, canonical payload fingerprints, original-correlation retention and duplicate/integrity-violation handling;
- canonical command codecs and durable crash-recovery payload rehydration without runtime type metadata;
- atomic command commit plans covering owner transitions, terminal command outcome, authoritative history, outbox and state-changing Admin audit;
- canonical multi-resource lock ordering and bounded whole-command retries only for explicitly classified transient failures;
- PostgreSQL command receipt persistence, optimistic owner transition coordination, authoritative history, durable outbox and Admin audit in the dedicated `nexis_v2` schema;
- command execution leases, expired-claim recovery, lease renewal/fencing and ambiguous-commit reconciliation by CommandId;
- leased at-least-once PostgreSQL outbox delivery using EventId as the stable delivery identity;
- multi-worker outbox claiming, lease expiry/recovery, publication acknowledgement and failure-delay redelivery;
- idempotent PostgreSQL projection-consumer checkpoints whose side effect and checkpoint commit atomically;
- exact-version Content Registry resolution with no silent latest-version fallback;
- first real gameplay owner contracts for Inventory possession, Equipment state/placement and Combat participation prerequisites;
- first real Core gameplay rule: `EquipItem`, registered in the reference Core by default;
- real PostgreSQL Equipment owner persistence, including optimistic revision enforcement and multi-slot bindings;
- canonical value-equal `EquipmentSlotSet`, preventing replay/conformance divergence caused by collection reference identity;
- narrow `IAutomatedCommandGateway`/`AutomatedCommandRequest` contracts allowing automated components to submit only a System principal, CommandId, CorrelationId and typed Core intent;
- executable architecture guards preventing future `Nexis.Ciel*` and `Nexis.Scheduling*` projects from directly referencing concrete Core, concrete Execution, Execution internals, PostgreSQL or owner implementation modules.

## First real gameplay vertical proof

`EquipItem` is the first owner-specific end-to-end V2 gameplay proof.

The flow now proves:

1. Application supplies trusted player actor identity plus Inventory, Equipment and Combat snapshots and exact versioned item content;
2. Core validates actor/character identity, possession, combat state, content definition, placement legality and occupied slots;
3. Core emits only an Equipment-owner transition plus semantic `ItemEquipped` event;
4. Inventory remains the possession authority and is read-only for this operation;
5. PostgreSQL applies the Equipment transition using the expected Equipment revision;
6. receipt completion, Equipment state, authoritative history and outbox commit atomically;
7. stale Equipment revision rolls the owner mutation and command side effects back;
8. multi-slot placements persist as one binding occupying all required slots;
9. repeated evaluation of the same trusted inputs produces value-equal transitions/events.

This is intentionally narrow. It proves the architecture with a real owner without authorizing broad Equipment/Inventory/Combat implementation fan-out.

## Automated-authority boundary proof

System work is no longer represented by one anonymous machine actor.

The current foundation proves:

1. trusted automated callers use a stable `SystemActorKey` such as `nexis.scheduler` or `nexis.ciel`, never a fabricated Account or Character;
2. that System principal is part of CommandId idempotency identity, so changing the automated authority changes the actor binding;
3. PostgreSQL command receipts persist `actor_system_key` and enforce mutually exclusive Player/Realtime, Admin and System actor shapes;
4. crash recovery rehydrates and preserves the same System principal rather than degrading it to anonymous SYSTEM authority;
5. the automated submission contract can carry a typed intent but cannot carry owner transitions, a `CoreDecision`, persistence handles or a precomputed gameplay result;
6. future CIEL and Scheduling implementation projects fail architecture tests if they acquire direct references to concrete mutation/persistence boundaries;
7. actual scheduler and CIEL runtime/business logic remain intentionally unimplemented until their behavior is designed, while the mutation-bypass boundary is already enforceable.

CIEL therefore remains advisory/interpretive, and schedulers remain responsible for due-work mechanics rather than authoritative gameplay outcomes.

## Current verification evidence

Checkpoint `4de3b830c19c5659c042aa342d86e3361a0c05a7` passed the complete V2 workflow against disposable PostgreSQL 18.6 after the automated-authority/bypass changes:

- solution restore: passed;
- Release build: **0 warnings, 0 errors**;
- architecture/Core/execution/security suite: **105 passed, 0 failed, 0 skipped**;
- PostgreSQL integration suite: **28 passed, 0 failed, 0 skipped**.

That run covers, among other things:

- stable differentiation of scheduler and CIEL System actor identities;
- the narrow Automation contract dependency allow-list;
- the rule that automated submission envelopes carry intents but not transitions/precomputed outcomes;
- future CIEL/Scheduling project mutation-bypass dependency guards;
- deterministic `EquipItem` reevaluation;
- actor mismatch, active-combat, missing-possession, unsupported-placement, occupied-slot and content-definition rejection paths;
- real Equipment persistence and authoritative history/outbox emission;
- stale Equipment revision rollback;
- multi-slot Equipment persistence;
- concurrent CommandId acquisition and payload-integrity rejection;
- multi-owner all-or-nothing rollback/success infrastructure;
- Admin audit atomicity;
- command crash recovery, lease fencing and ambiguous reconciliation;
- independent outbox workers not claiming the same rows;
- expired outbox lease recovery with stable EventId and incremented attempt count;
- publish acknowledgement and redelivery after publish/failure ambiguity;
- idempotent projection checkpointing and rollback on projection failure.

Earlier PostgreSQL tests exposed a wall-clock leak in initial outbox availability; normal command commits now write authoritative command completion time explicitly. This remains covered by the green integration suite.

The reference Core implementation version remains `0.5.0-foundation`; the stable Core contract remains V1.

## Foundation work still incomplete

The branch is materially further along, but PR #4 must remain draft. Remaining stop-condition work includes:

1. the remaining Identity capability/policy implementation and security tests without ordinal-role authorization;
2. Player Log/history projection and visibility contracts, including the player-facing boundary versus internal/admin-only events;
3. production replay-corpus extraction/retention so real historical commands and known exploit/bug cases become permanent Core regression scenarios;
4. migration/reconciliation tooling before any v1-to-v2 state movement;
5. additional real owner-specific multi-owner gameplay proof where a legitimate rule actually writes more than one real owner, rather than relying only on synthetic transactional owners;
6. observability/operational readiness around recovery workers, outbox workers, poison events, retry exhaustion and invariant failures;
7. final threat-model/security review and the wider foundation stop-condition audit before broad gameplay implementation.

Exact owner/domain contracts should continue to be introduced only when the corresponding gameplay design is sufficiently settled. Do not create generic state bags merely to make the architecture look more complete.

## Next safe implementation boundary

The next safe foundation slice is **the executable Identity capability/policy boundary**.

The required behavior is:

- Account roles remain descriptive classifications and are never treated as numeric/ordinal authority;
- trusted platform capabilities are derived server-side from current identity/security facts and explicit policy, never from client claims;
- Staff/Admin commands require the exact capability relevant to the action rather than broad `IsAdmin` shortcuts;
- PrimaryOwner remains an account authority fact, never a character name/title/public ID shortcut;
- capability revocation/security-version changes take effect on fresh command evaluation and do not alter historical CommandId actor identity;
- commercial entitlements remain completely separate from platform capabilities and cannot grant administrative authority;
- policy evaluation remains outside gameplay-domain ownership and does not become a second Core;
- tests must cover privilege revocation, stale security facts, capability isolation, entitlement confusion and ordinal-role bypass attempts.

After that, continue Player Log/history projection and visibility work before broad system fan-out.

## Verification discipline

Every dependent code slice must pass the V2 restore/build/test workflow before being treated as stable. A green CI run is necessary evidence, not production-release approval. The Universal Component Release Gate and 30-day soak requirements still apply to material production promotion.
