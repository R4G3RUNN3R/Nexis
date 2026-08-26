# Nexis 2.0 Command Crash Recovery and Fencing

_Status: foundation implementation slice, 2026-08-26. This document narrows `COMMAND-EXECUTION.md` and `COMMAND-LIFECYCLE-CONTRACTS.md`._

## Goal

A command must remain safe when a process dies, a worker loses its lease, or a database connection disappears around COMMIT.

Recovery is not a second command and is not permission to guess. It preserves the original CommandId/actor/intent/payload identity, then determines from durable PostgreSQL state whether the original command completed or whether a fresh whole-command attempt is required.

## Durable recovery material

Each new recoverable command receipt stores:

- CommandId;
- stable execution lane + AccountId/CharacterId actor binding;
- intent contract name + schema version;
- exact canonical typed-command JSON as `text`;
- SHA-256 fingerprint of that exact canonical JSON;
- original CorrelationId;
- received-at UTC timestamp;
- current execution fencing token;
- current worker identifier;
- execution lease expiry.

Canonical payload is intentionally `text`, not PostgreSQL `jsonb`. Recovery verifies that re-parsing the stored exact JSON produces the same fingerprint recorded on the receipt. Database normalization must not be able to alter authoritative recovery bytes.

## Execution token is the fence

`CommandExecutionToken` is the fencing identity for one execution attempt.

The atomic committer verifies that the receipt still contains the plan's exact token before it can commit any owner transition, terminal outcome, history event, Admin audit or outbox row.

Every successful recovery takeover rotates this token. Once rotated:

- the previous worker cannot commit its stale plan;
- the previous worker cannot renew its lease;
- only the new recovered execution may proceed.

Lease expiry alone does not retroactively invalidate a worker. It makes the command eligible for takeover. Whichever path obtains the authoritative receipt row lock first determines the next safe state.

## Ambiguous COMMIT reconciliation

A connection can fail after PostgreSQL receives COMMIT but before the client receives acknowledgement. Treating that as an ordinary retry risks executing the same value-producing command twice.

`ReconcileAsync` therefore locks the receipt row with `SELECT ... FOR UPDATE` using the observed execution token.

That lock cannot be obtained until a prior transaction touching the receipt has committed or rolled back. Once the row is visible:

- **terminal outcome exists:** return `Completed`; never execute again;
- **receipt incomplete and token still matches:** rotate the token/lease and return `Recovered`;
- **token changed:** return `OwnershipLost`; another recovery/execution now owns the command;
- **receipt missing:** return `Missing`;
- **legacy receipt lacks canonical payload:** return `NotRecoverable` rather than fabricating the original intent.

This is why PostgreSQL network/commit-ack failures are not classified as automatic transient retries.

## Expired orphan recovery

Workers may also die without attempting COMMIT. Expired incomplete recoverable receipts are reclaimed through `ClaimExpiredBatchAsync`.

The PostgreSQL query uses:

- terminal_status IS NULL;
- canonical_payload IS NOT NULL;
- lease expiry <= authoritative now;
- deterministic oldest-first ordering;
- `FOR UPDATE SKIP LOCKED`;
- bounded batch size.

Multiple recovery workers can therefore scan the same queue without claiming the same command.

Each claimed row receives a fresh execution token, worker identifier and lease expiry before the transaction commits.

## Heartbeats

A live worker may renew its lease only when all of these still match:

- CommandId;
- execution token;
- execution worker identifier;
- receipt remains incomplete/recoverable.

A stale worker whose token has been rotated cannot extend its old lease.

## Typed command rehydration

Stored JSON is never deserialized through CLR type names or an unrestricted reflection serializer.

Every recoverable intent schema has an explicit `ICanonicalCommandCodec`, registered in `CanonicalCommandCodecRegistry` by exact stable contract name + schema version.

Recovery rehydrates only through the registered codec. The registry rejects:

- unknown schema versions;
- duplicate codec registrations;
- null codecs/results;
- a codec returning an intent whose declared contract differs from the registry key.

This gives old command schemas an explicit compatibility obligation instead of hoping a future CLR type happens to deserialize yesterday's payload.

## Fresh authority after recovery

A recovered receipt is historical evidence, not an authorization token.

`RecoveredCommandExecution` intentionally contains no `TrustedActorContext`. Before re-execution the Application layer must resolve current trusted authority and load current authoritative snapshots.

A recovery attempt must therefore re-run:

- session/security freshness where applicable;
- current capability/policy checks;
- entitlement facts where the rule legitimately depends on them;
- owner revisions/state;
- current prerequisites/cooldowns/resources;
- Core evaluation using the controlled rule/content/replay policy.

A previous Core decision or transition plan is never resumed from memory.

## Sensitive payload policy

Recoverability increases the importance of command payload hygiene.

Do not place passwords, session tokens, API keys, payment-card data or other secrets in canonical command payloads. Before production use, command classes containing sensitive personal/business data require an explicit retention, encryption and redaction policy compatible with audit/replay needs.

## Verified failure cases

The PostgreSQL integration suite proves:

- active commands are not reclaimed before lease expiry;
- expired commands retain exact canonical payload and get a new fence token;
- concurrent recovery workers do not overlap claims;
- an already-committed ambiguous command returns its stored outcome;
- an incomplete ambiguous command rotates the token and becomes recoverable;
- the old stale plan is rejected after token rotation;
- the recovered attempt can then commit;
- a wrong token cannot steal a command;
- lease renewal blocks premature takeover;
- a stale worker cannot renew after recovery;
- fingerprint mismatch caused by payload corruption stops recovery before execution.

These tests use disposable V2 PostgreSQL state only and do not touch the live/V1 database.
