# Nexis 2.0 Command Receipt and Idempotency Contracts

_Status: foundation implementation slice, 2026-08-26. This document narrows `COMMAND-EXECUTION.md`; it does not supersede it._

## Purpose

This slice introduces the stable command-receipt boundary required before authoritative gameplay mutations can be made safely retryable. It deliberately stops before terminal command completion, owner persistence, event append and outbox commit because those must later share one atomic transaction boundary.

## Stable idempotency identity

One received mutation command is identified by:

- `CommandId`;
- stable server-derived actor binding;
- typed intent contract name + schema version;
- SHA-256 fingerprint of the canonical command payload.

A repeat with the same identity is the same command. A repeat reusing the CommandId with a different actor, intent contract or payload fingerprint is an integrity violation, not a new action.

The first accepted receipt retains its original `CorrelationId`. Transport retries may arrive carrying a different correlation, but the stored command remains linked to the original causal operation.

## Actor binding

`CommandActorBinding` is derived only from `TrustedActorContext`:

- Player/Realtime: AccountId + CharacterId + lane;
- Admin: AccountId + Admin lane, never Character impersonation;
- System: System lane with no AccountId/CharacterId.

Current capabilities, entitlements and security/session version are intentionally not part of the idempotency identity. They must be revalidated from current trusted server state on each execution/recovery attempt. A permission change does not turn a retry into a different command, and an old capability snapshot cannot be smuggled into authority through CommandId reuse.

## Payload fingerprint

`CommandPayloadFingerprint` is SHA-256 over a canonical trusted-server representation of the typed payload. This slice provides the digest primitive but does **not** define one universal serializer for all Nexis domain contracts.

The fingerprint supplied to the coordinator must be created by trusted ingress/application code after schema validation. A client-provided hash is never accepted as authority.

## Receipt acquisition outcomes

`ICommandReceiptRepository.TryAcquireAsync` atomically returns exactly one of:

- `Acquired`: first valid execution claim, with a non-empty execution token;
- `DuplicateInProgress`: same command already has an active/incomplete receipt;
- `DuplicateCompleted`: same command already has a durable terminal outcome and that original outcome is returned/reconstructed;
- `IntegrityViolation`: the CommandId exists but actor/type/payload identity differs.

Production persistence must implement this comparison atomically, normally with a unique CommandId constraint plus transaction/locking semantics appropriate to PostgreSQL.

## Why completion is not exposed yet

There is intentionally no public `ICommandReceiptRepository.CompleteAsync` method in this slice.

A successful command may involve multiple authoritative owners. Terminal command outcome, owner state transitions, authoritative events/history and outbox entries must commit together where the gameplay promise requires atomicity. Allowing receipt completion as an independent persistence call would make it possible to record `Succeeded` before owner state committed, or mutate owner state without a durable terminal receipt.

The next persistence/transaction slice must therefore introduce completion only inside the authoritative atomic command transaction contract.

## Recovery note

This slice distinguishes an acquired/in-progress receipt from a completed receipt. Production crash recovery, stale execution-token takeover/lease semantics and bounded retry classification remain persistence/execution work. They must preserve the same CommandId and identity; recovery may never manufacture a replacement command.

## Verification scope

Current automated tests cover:

- same CommandId + same actor/type/payload cannot acquire two execution claims;
- changed payload, actor or intent contract under the same CommandId becomes an integrity violation;
- capability/entitlement/security-version changes do not alter stable actor idempotency identity;
- completed duplicates reconstruct the stored terminal outcome in the test repository without a new execution token;
- original correlation identity survives retries;
- receive time must be authoritative UTC;
- SHA-256 payload fingerprints are deterministic and normalized;
- execution contracts do not depend on implementation assemblies;
- the concrete execution coordinator depends only on approved stable contract assemblies.

The in-memory receipt repository used by tests is test infrastructure only and is not a production persistence implementation.
