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

## Unrecoverable-artifact quarantine and controlled resolution

A malformed, unsupported or fingerprint-invalid stored recovery artifact cannot abort healthy siblings in the same recovery batch. The recovery transaction quarantines only that receipt, records a bounded reason and deliberately rotates `execution_token` in the same fenced update. The atomic committer independently rejects any receipt carrying recovery-abandon evidence, so a late original worker receives a clean ownership-lost result rather than relying on a database CHECK violation. Quarantined receipts are excluded from automatic claim, reconciliation fence rotation and lease renewal.

Quarantine is reversible only through an explicit privileged operator transition. `PostgresOperationalQuarantineService` exposes a payload-free bounded listing and one controlled terminal resolution for every non-terminal non-recoverable receipt, including historical rows whose `canonical_payload` is null. Resolution requires an authorized `operations.quarantine.manage` decision, acting staff AccountId, CorrelationId, case reference, the observed execution fence and the observed abandonment timestamp (including an observed null for a payload-unavailable row). PostgreSQL compares all observed values and the still-unrecoverable shape, records terminal `TechnicalFailure`, clears the inactive lease, retains any original abandonment time/reason, and appends the successful or stale-fence outcome to Admin Audit in one transaction. A repeated CommandId then reconstructs the completed technical failure instead of remaining `DuplicateInProgress`. No recovery sweep automatically clears, resolves, or resurrects quarantine.

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
- fingerprint mismatch caused by payload corruption quarantines only that receipt while healthy siblings recover;
- quarantine rotates the execution fence and a late original worker receives ownership-lost without committing effects;
- authorized operators can enumerate unresolved quarantine and record terminal TechnicalFailure while retaining abandonment evidence;
- non-terminal receipts without canonical payload are enumerated with the bounded `canonical_payload_unavailable` reason and use the same execution-token-fenced terminal resolution; no automatic resurrection exists;
- repeated CommandId acquisition after controlled resolution returns the completed technical failure.

These tests use disposable V2 PostgreSQL state only and do not touch the live/V1 database.
