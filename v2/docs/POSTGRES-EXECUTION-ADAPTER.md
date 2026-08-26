# Nexis 2.0 PostgreSQL Execution Adapter

_Status: isolated V2 foundation implementation slice, updated 2026-08-26._

## Selected baseline

The adapter uses raw Npgsql rather than EF Core for the command transaction spine. Current dependency research on 2026-08-26 selected:

- PostgreSQL 18.x, with 18.6 the current supported minor release;
- Npgsql 10.0.3, the current stable Npgsql release.

PostgreSQL 19 remains beta and is not used as the foundation baseline.

## Isolation

All infrastructure tables live under the dedicated `nexis_v2` PostgreSQL schema. These migrations are for disposable/pre-production V2 databases only. Nothing in this project targets or alters the live v1 database/schema.

The execution schema contains only infrastructure concerns:

- command receipts/idempotency/recovery state;
- authoritative event/history rows;
- durable outbox rows + delivery leases;
- consumer idempotency checkpoints;
- administrative audit rows.

There are deliberately no real gameplay-owner tables in these migrations. Synthetic owner/projection tables used by CI live under `nexis_v2_test` and exist only to prove transaction behavior.

## Ordered migrations

`PostgresExecutionSchema` applies embedded migrations in order:

1. `0001_execution_foundation.sql` - command receipts, authoritative events, outbox and Admin audit;
2. `0002_outbox_delivery.sql` - leased outbox delivery and `(consumer_name, event_id)` projection checkpoints;
3. `0003_command_recovery.sql` - exact canonical command payload, execution worker lease and recovery-ready index.

The recovery payload column is PostgreSQL `text`, not `jsonb`, because the SHA-256 command fingerprint is over the exact canonical JSON representation and must not change through database JSON normalization.

## Command receipt behavior

`PostgresCommandReceiptRepository` implements the stable receipt contract with a unique CommandId primary key and `INSERT ... ON CONFLICT DO NOTHING` acquisition. A conflicting caller compares stored stable actor/intent/payload identity and returns duplicate or integrity-violation semantics.

A new receipt persists:

- exact canonical JSON + fingerprint;
- original correlation;
- execution fencing token;
- worker identifier;
- lease expiry.

The database constrains trusted actor shape by execution lane:

- Player/Realtime require Account + Character;
- Admin requires Account and forbids Character impersonation;
- System carries neither.

## Atomic commit

`PostgresAtomicCommandCommitter` opens one PostgreSQL transaction, locks the command receipt row, revalidates identity + execution token, applies registered owner transitions, appends authoritative history/outbox and Admin audit rows, records replay-critical Core/rule/content versions, completes the command receipt, clears its execution lease, and commits once.

Owner persistence remains explicit through `IPostgresOwnerTransitionApplier`. This interface is intentionally infrastructure-specific and may expose Npgsql transaction types; stable Core/gameplay contracts never do.

A transition applier may report optimistic concurrency conflict. If any owner reports conflict after another owner already staged an update, the transaction is rolled back and none of the staged owner/history/outbox/terminal effects survive.

## Retry and ambiguous COMMIT safety

Only PostgreSQL SQLSTATEs `40001` (serialization failure) and `40P01` (deadlock detected) are classified as automatically retryable. Those failures abort the transaction and are suitable for the bounded whole-command retry policy.

Network/connection failures are **not** automatically classified as safe retries because a connection loss around COMMIT may have an ambiguous outcome.

Ambiguous completion is reconciled by `PostgresCommandRecoveryRepository.ReconcileAsync`, which locks the durable receipt row with `SELECT ... FOR UPDATE`. PostgreSQL therefore resolves any previous transaction on that row before recovery decides whether:

- the command already completed and its stored result must be returned;
- the previous attempt is incomplete and its execution token may be safely rotated;
- another recovery worker already owns a newer token.

This prevents connection failures from becoming duplicate-value generators.

## Orphan crash recovery

Incomplete recoverable commands carry worker leases. Expired receipts are claimed with `FOR UPDATE SKIP LOCKED`, then receive a new execution token + worker lease before the recovery transaction commits.

The execution token is the fence. Once rotated, the stale worker can neither commit its old plan nor renew the old lease.

The recovery record exposes historical Account/Character/lane/intent/payload facts, not current authorization. A recovered command must resolve a fresh `TrustedActorContext` and fresh authoritative snapshots before Core is rerun.

## Durable outbox

Committed authoritative events create outbox rows in the same command transaction.

`PostgresOutboxStore` uses `FOR UPDATE SKIP LOCKED` plus lease token/worker/expiry fields so multiple dispatch workers can claim queue rows without overlap. Delivery is intentionally **at-least-once**.

If external publication succeeds but the PostgreSQL acknowledgement is lost, the event may be redelivered after lease expiry with the same immutable EventId. Consumers must therefore be idempotent by EventId.

Internal PostgreSQL projections can use `PostgresProjectionConsumerExecutor`, which commits the projection side effect and `(consumer_name, event_id)` checkpoint in one PostgreSQL transaction. Duplicate delivery then cannot double-apply that projection.

Outbox/projection code is post-commit infrastructure and may never mutate authoritative gameplay owner state directly. A gameplay reaction must issue a normal System command through the authoritative command pipeline.

## Append-only audit

`PostgresAppendOnlyAuditLog` supports privileged read-only audit entries without a gameplay command. State-changing Admin audit records continue through the atomic command plan and receive the CommandId foreign key in the same transaction.

## CI proof

The V2 workflow provisions a pinned PostgreSQL 18.6 service and runs separate integration tests against disposable data.

The database suite now covers:

- concurrent same-CommandId receipt acquisition with exactly one winner;
- payload reuse integrity violations;
- exact canonical payload/lease persistence;
- two-owner atomic success;
- second-owner conflict rolling the first owner back;
- failed multi-owner commit leaving terminal/history/outbox absent;
- successful terminal/history/outbox persistence together;
- completed duplicate outcome reconstruction;
- state-changing Admin audit in the same transaction;
- read-only audit without a command receipt;
- serialization/deadlock-only automatic retry classification;
- non-overlapping outbox workers;
- outbox lease expiry/reclaim and EventId-preserving redelivery;
- acknowledgement fencing by lease token;
- idempotent PostgreSQL projection checkpoints, including concurrent duplicate delivery and rollback/retry;
- active command leases protected from recovery;
- expired command recovery with exact payload + new fence token;
- non-overlapping recovery workers;
- ambiguous COMMIT reconciliation to stored completion or safe token rotation;
- stale-worker commit/renew fencing after recovery;
- corrupted canonical payload detection before re-execution.

Synthetic owner/projection tables prove infrastructure atomicity only. They are not a substitute for the required first real owner-specific gameplay vertical proof.
