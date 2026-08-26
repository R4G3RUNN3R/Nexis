# Nexis 2.0 PostgreSQL Execution Adapter

_Status: isolated V2 foundation implementation slice, 2026-08-26._

## Selected baseline

The adapter uses raw Npgsql rather than EF Core for the command transaction spine. Current dependency research on 2026-08-26 selected:

- PostgreSQL 18.x, with 18.6 the current supported minor release;
- Npgsql 10.0.3, the current stable Npgsql release.

PostgreSQL 19 remains beta and is not used as the foundation baseline.

## Isolation

All infrastructure tables live under the dedicated `nexis_v2` PostgreSQL schema. This migration is for disposable/pre-production V2 databases only. Nothing in this project targets or alters the live v1 database/schema.

The initial schema contains only execution infrastructure:

- command receipts/idempotency state;
- authoritative event/history rows;
- durable outbox rows;
- administrative audit rows.

There are deliberately no gameplay owner tables in this migration.

## Command receipt behavior

`PostgresCommandReceiptRepository` implements the stable receipt contract with a unique CommandId primary key and `INSERT ... ON CONFLICT DO NOTHING` acquisition. A conflicting caller then compares the stored stable actor/intent/payload identity and returns duplicate or integrity-violation semantics.

The database also constrains the trusted actor shape by execution lane:

- Player/Realtime require Account + Character;
- Admin requires Account and forbids Character impersonation;
- System carries neither.

## Atomic commit

`PostgresAtomicCommandCommitter` opens one PostgreSQL transaction, locks the command receipt row, revalidates identity + execution token, applies registered owner transitions, appends authoritative history/outbox and Admin audit rows, records replay-critical Core/rule/content versions, completes the command receipt, and commits once.

Owner persistence remains explicit through `IPostgresOwnerTransitionApplier`. This interface is intentionally infrastructure-specific and may expose Npgsql transaction types; stable Core/gameplay contracts never do.

A transition applier may report optimistic concurrency conflict. If any owner reports conflict after another owner already staged an update, the transaction is rolled back and none of the staged owner/history/outbox/terminal effects survive.

## Retry safety

Only PostgreSQL SQLSTATEs `40001` (serialization failure) and `40P01` (deadlock detected) are classified as automatically retryable by this adapter. Those errors imply the transaction was aborted and are suitable for the existing bounded whole-command retry policy.

Network/connection failures are **not** automatically classified as safe retries because a connection loss around COMMIT may have an ambiguous outcome. The caller must reconcile by CommandId receipt before beginning another execution. This prevents an innocent retry policy from becoming a duplicate-value generator.

## Append-only audit

`PostgresAppendOnlyAuditLog` supports privileged read-only audit entries without a gameplay command. State-changing Admin audit records continue through the atomic command plan and receive the command_id foreign key in the same transaction.

## CI proof

The V2 workflow now provisions a pinned PostgreSQL 18.6 service and runs separate integration tests. The tests use only disposable CI data and synthetic owner tables under `nexis_v2_test`.

The integration suite is required to prove at minimum:

- concurrent same-CommandId receipt acquisition produces exactly one winner;
- changed payload under the same CommandId is an integrity violation;
- two synthetic authoritative owners commit together on success;
- a conflict in the second owner rolls back the first owner's staged update;
- failed multi-owner commit leaves command receipt incomplete and emits no history/outbox;
- successful commit persists terminal command result + authoritative history + outbox together;
- completed duplicate receipt returns the stored terminal outcome;
- Admin command audit persists in the same transaction;
- privileged read audit can append without a gameplay command receipt;
- only serialization/deadlock SQLSTATEs are considered safe automatic retries.

Synthetic owner tables are test infrastructure only. They are not a substitute for the later required real owner-specific vertical proof.
