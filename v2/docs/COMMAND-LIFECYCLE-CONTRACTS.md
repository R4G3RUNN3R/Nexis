# Nexis 2.0 Command Receipt and Idempotency Contracts

_Status: foundation implementation slice, updated 2026-08-26. This document narrows `COMMAND-EXECUTION.md`; it does not supersede it._

## Purpose

This document defines the durable mutation-command identity, receipt, recovery payload and execution-fencing contracts used before any authoritative gameplay mutation is allowed to commit.

The lifecycle now spans:

1. trusted typed command ingress;
2. canonical payload serialization + fingerprinting;
3. first receipt acquisition;
4. Core evaluation / whole-command execution;
5. atomic owner/history/audit/outbox commit;
6. duplicate replay of the stored terminal result;
7. fenced crash recovery where an incomplete execution is abandoned or a prior COMMIT result is ambiguous.

## Stable idempotency identity

One mutation command is durably identified by:

- `CommandId`;
- stable server-derived actor binding;
- typed intent contract name + schema version;
- SHA-256 fingerprint of the exact canonical command payload.

A repeat with the same identity is the same command. Reusing the CommandId with a different actor, intent contract/schema or payload fingerprint is an integrity violation, not a new action.

The first accepted receipt retains its original `CorrelationId`. Later transport retries may arrive with a different correlation, but authoritative history/replay remains tied to the original causal operation.

## Actor binding

`CommandActorBinding` is derived only from `TrustedActorContext`:

- Player/Realtime: AccountId + CharacterId + lane;
- Admin: AccountId + Admin lane, never Character impersonation;
- System: System lane with no AccountId/CharacterId.

Current capabilities, entitlements and security/session version are intentionally **not** part of idempotency identity. Those values are current execution facts and must be resolved/revalidated again whenever the command is freshly executed or recovered.

A durable receipt therefore proves who originally submitted the command. It never proves that the actor is still authorized now.

## Canonical command payload

`CanonicalCommandPayload` stores the exact trusted-server canonical JSON representation of one validated typed command intent plus its SHA-256 fingerprint.

Important boundaries:

- canonical JSON is command recovery/replay material, not generic gameplay state;
- a client-supplied JSON string or hash is never authoritative;
- the exact canonical string is stored as PostgreSQL `text`, **not** `jsonb`, because jsonb normalization could alter whitespace/key representation and break the exact-byte fingerprint invariant;
- secrets, credentials, raw tokens and other unnecessary sensitive material must never be placed in recoverable command payloads;
- retention/redaction/encryption policy for sensitive command classes must be defined before production rollout.

## Explicit typed codec registry

There is no universal reflection serializer for authoritative commands.

Each recoverable typed intent contract registers an explicit `ICanonicalCommandCodec` keyed by stable contract name + schema version. `CanonicalCommandCodecRegistry`:

- rejects duplicate registrations;
- serializes through only the codec registered for the intent's exact contract;
- deserializes only a registered name/schema pair;
- rejects a codec that returns an intent advertising a different contract;
- never persists or activates CLR type names;
- never uses assembly scanning or arbitrary JSON-to-object activation as authority.

Old schemas therefore require their old codec/upcaster path to remain intentionally supported or to be deliberately retired through migration policy. A new schema is never silently treated as compatible with an old one.

## Receipt acquisition and execution lease

A first receipt acquisition supplies:

- stable execution identity;
- canonical payload;
- original CorrelationId;
- authoritative received-at UTC time;
- execution worker identifier;
- positive execution lease duration.

PostgreSQL stores:

- exact payload + fingerprint;
- execution owner;
- lease expiry;
- an opaque `CommandExecutionToken` fencing token.

`ICommandReceiptRepository.TryAcquireAsync` atomically returns:

- `Acquired`: first valid execution claim, with a non-empty execution token;
- `DuplicateInProgress`: same command already has an active/incomplete receipt;
- `DuplicateCompleted`: same command already has a durable terminal outcome and that original outcome is returned;
- `IntegrityViolation`: CommandId exists but stable actor/type/payload identity differs.

## Completion stays atomic

There is intentionally no public standalone `CompleteAsync` on the receipt repository.

Terminal outcome, owner transitions, authoritative history/events, state-changing Admin audit and durable outbox must commit through the atomic command transaction. This prevents a receipt from saying `Succeeded` before owner state committed, or owner state committing without a durable terminal receipt/history trail.

## Crash recovery and fencing

Every in-progress recoverable command has an execution lease and fencing token.

Two recovery paths exist:

### Ambiguous completion reconciliation

If a worker loses connection around COMMIT, it must not guess whether the command committed. Recovery locks the receipt row with `SELECT ... FOR UPDATE` and lets PostgreSQL resolve the previous transaction first.

Then:

- terminal row -> return the stored terminal result and do **not** execute again;
- incomplete row with matching observed token -> rotate to a new token/lease and allow a fresh whole-command attempt;
- token mismatch -> another worker already owns recovery; return ownership lost;
- legacy/incomplete row without canonical payload -> explicitly not recoverable.

### Expired orphan recovery

Expired incomplete recoverable receipts can be claimed in batches using `FOR UPDATE SKIP LOCKED` so multiple recovery workers do not take the same command.

Every takeover rotates the execution token. The old worker may no longer commit or renew once that token changes.

Lease expiry means **eligible for takeover**, not instantly invalid. If the original worker acquires the receipt row lock and completes before takeover rotates the token, that completion remains safe. If recovery wins first, the old worker is fenced.

## Recovery does not restore authority

`RecoveredCommandExecution` contains historical identity and exact payload facts only. It deliberately does not contain `TrustedActorContext`.

Before rerunning Core, recovery/application code must:

1. decode the exact stored typed intent through the explicit codec registry;
2. resolve fresh current actor/session/capability/entitlement facts;
3. load fresh authoritative owner snapshots;
4. load the appropriate rule/content versions according to replay/recovery policy;
5. revalidate all current prerequisites and authorization;
6. rerun the complete Core evaluation/commit attempt under the new fencing token.

A stale snapshot/transition plan is never resumed.

## Verification scope

Automated tests now cover:

- exactly one first acquisition for the same CommandId under concurrency;
- changed payload, actor or intent contract under the same CommandId -> integrity violation;
- capability/entitlement/security-version changes do not change stable command identity;
- completed duplicates return the original stored terminal outcome;
- original correlation survives retries;
- canonical payload JSON validity + deterministic SHA-256 fingerprinting;
- exact canonical payload persistence as text;
- active lease not recovered before expiry;
- expired lease recovery preserves the exact payload and rotates the fence token;
- concurrent recovery workers do not overlap claims;
- ambiguous reconcile returns stored outcome after a committed command;
- ambiguous reconcile rotates the token after a rolled-back/incomplete attempt;
- stale workers cannot commit or renew after takeover;
- wrong fencing token cannot steal a command;
- corrupted canonical payload/fingerprint mismatch blocks recovery before re-execution;
- codec registry rejects unknown schemas, duplicate registrations and wrong-contract deserialization.

The remaining gameplay proof is not command-lifecycle infrastructure. It requires a real approved owner-specific command and real typed owner contracts/content definitions.
