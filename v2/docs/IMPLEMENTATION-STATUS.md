# Nexis 2.0 Foundation Implementation Status

_Status: rolling implementation checkpoint, updated 2026-08-26. This file records progress only. It does not supersede `ENGINEERING-MANUAL.md` or any binding architecture/canon document._

## Current branch

`feature/nexis-v2-foundation-skeleton`

Draft PR #4 remains the integration surface and must remain draft until the complete foundation stop conditions in `AGENT-HANDOFF.md` are satisfied.

Existing/current Nexis outside `v2/` remains reference/migration source only. Nothing recorded here authorizes live deployment, live database mutation, or v1 changes.

## Current verified implementation

The V2 branch now contains and has executable coverage for:

- separate stable Core, Identity, Execution, Audit, Eventing, Content, Items, Inventory, Equipment and Combat contract assemblies;
- replaceable `ICoreRulesEngine` with explicit internal evaluator dispatch and no feature implementation, persistence, network or UI dependencies;
- trusted Player/Admin/System/Realtime actor context with Account/Character separation, capability-based platform authority and commercial entitlements kept separate;
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
- canonical value-equal `EquipmentSlotSet`, preventing replay/conformance divergence caused by collection reference identity.

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

## Current verification evidence

The code checkpoint `e1eaf9fe2e2afe9629cc2633ddb7dcf2e7ad767c` passed the complete V2 workflow against disposable PostgreSQL 18.6 after the first real gameplay vertical fixes:

- solution restore: passed;
- Release build: **0 warnings, 0 errors**;
- architecture/Core/execution/security suite: **101 passed, 0 failed, 0 skipped**;
- PostgreSQL integration suite: **28 passed, 0 failed, 0 skipped**.

That run covers, among other things:

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

The outbox tests also exposed a wall-clock leak: initial `available_at_utc` relied on PostgreSQL `now()`. Normal command commits now write the authoritative command completion time explicitly, keeping delivery eligibility testable and consistent with the execution-time model.

The reference Core implementation version is now `0.5.0-foundation`; the stable Core contract remains V1.

## Foundation work still incomplete

The branch is materially further along, but PR #4 must remain draft. Remaining stop-condition work includes:

1. executable scheduler/System-lane and CIEL bypass protections so neither can mutate owner state outside normal command/Core/persistence paths;
2. the remaining Identity capability/policy implementation and security tests without ordinal-role authorization;
3. Player Log/history projection and visibility contracts, including the player-facing boundary versus internal/admin-only events;
4. production replay-corpus extraction/retention so real historical commands and known exploit/bug cases become permanent Core regression scenarios;
5. migration/reconciliation tooling before any v1-to-v2 state movement;
6. additional real owner-specific multi-owner gameplay proof where a legitimate rule actually writes more than one real owner, rather than relying only on synthetic transactional owners;
7. observability/operational readiness around recovery workers, outbox workers, poison events, retry exhaustion and invariant failures;
8. final threat-model/security review and the wider foundation stop-condition audit before broad gameplay implementation.

Exact owner/domain contracts should continue to be introduced only when the corresponding gameplay design is sufficiently settled. Do not create generic state bags merely to make the architecture look more complete.

## Next safe implementation boundary

The next safe foundation slice is **scheduler/CIEL bypass prevention at the executable architecture boundary**.

The required behavior is:

- schedulers and CIEL may propose/submit typed commands only through the approved System or applicable trusted execution lane;
- neither receives a direct owner repository mutation path;
- neither calls owner transition appliers or PostgreSQL owner tables directly;
- state-changing work still passes through CommandId/idempotency, trusted actor context, current snapshots/content, Core evaluation and atomic commit;
- CIEL remains advisory/interpretive and never becomes an authoritative gameplay owner;
- automated/System work is auditable and replayable with the same rule/content/time provenance expectations as player commands;
- architecture tests should fail if scheduler/CIEL implementation assemblies acquire forbidden direct persistence/owner dependencies.

After that, continue the remaining Identity policy boundary and Player Log/history projection work before broad system fan-out.

## Verification discipline

Every dependent code slice must pass the V2 restore/build/test workflow before being treated as stable. A green CI run is necessary evidence, not production-release approval. The Universal Component Release Gate and 30-day soak requirements still apply to material production promotion.
