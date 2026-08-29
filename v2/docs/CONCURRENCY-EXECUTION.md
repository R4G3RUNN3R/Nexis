# Nexis 2.0 Concurrency Execution Primitives

_Status: foundation implementation slice, 2026-08-26. This document narrows the concurrency/retry rules in `COMMAND-EXECUTION.md`._

## Canonical resource lock order

Multi-resource operations must not choose lock order from call direction, UI order, participant order or whichever collection happened to be assembled first.

`AuthoritativeResourceKey` identifies a lockable authoritative resource by:

- authoritative owner key;
- stable resource type;
- stable resource identifier.

It is **only** a concurrency identity. It is not a generic state path and cannot read or mutate gameplay state.

`CanonicalResourceLockOrder` deduplicates keys and sorts using case-sensitive ordinal comparison in this sequence:

1. owner key;
2. resource type;
3. resource identifier.

The same logical resource set therefore produces the same lock order in opposite-direction operations. Persistence adapters that use explicit locks must acquire them in this order.

For PostgreSQL atomic commands, each authoritative-owner adapter resolves every resource its typed transition can lock or conditionally update. The committer validates owner attribution, combines and deduplicates all resolved keys across the complete plan, then acquires transaction-scoped advisory locks in one global canonical sweep before invoking any owner applier. Ordering whole transitions is not a substitute: interleaved key sets such as `{a,c}` and `{b}` must still acquire `a,b,c`.

The advisory-lock identity is a stable SHA-256-derived 64-bit namespace over length-delimited owner/type/id components. Hash values select PostgreSQL lock identities; acquisition sequence remains the canonical resource-key sequence. Lock vocabulary stays in the PostgreSQL adapter and does not leak into Core contracts.

Every owner adapter requires a PostgreSQL conformance guard proving that `ResolveLockKeys` matches the order-sensitive SQL work performed by `ApplyAsync`. The real Equipment guard records its actual aggregate, binding and slot writes through database triggers and compares that sequence with the declared resource keys, preventing resource-name sorting from becoming an accidental invariant.

Resource key strings are stable contract values and must not be localized, culture-sorted or constructed from mutable display names.

## Bounded whole-command retry

`BoundedCommandRetryExecutor` retries only exceptions explicitly approved by an infrastructure-specific `ITransientCommandFailureClassifier` and only up to the configured maximum attempt count.

The retry boundary begins **after** `CommandReceiptCoordinator` has acquired the durable receipt exactly once. `RetryingCommandExecutionCoordinator` retains that claim's original CorrelationId and execution token across all attempts; it never calls `TryAcquireAsync` again for the owning attempt.

Each retry callback reloads current authoritative snapshots, revalidates current actor authority/prerequisites, re-resolves time/content/RNG inputs, re-evaluates Core where required, builds a fresh commit plan with the **same receipt token**, and attempts the atomic commit. It never resumes from a half-applied plan or reuses stale snapshots.

Between attempts the coordinator renews the existing lease through `ICommandExecutionRecoveryRepository.RenewLeaseAsync`. Refusal means the execution fence or owner moved: the loop abandons immediately, performs no stale commit, and PostgreSQL reports a lease-fencing condition. A rolled-back `40001`/`40P01` commit leaves the receipt token unchanged, so a renewed retry can still commit exactly once.

At retry exhaustion the coordinator builds and commits one terminal `TechnicalFailure` plan against the held token. That plan is required to contain no owner transitions or authoritative events. If terminalization itself cannot commit, normal receipt recovery remains authoritative.

The stable classifier contract does not mention PostgreSQL/Npgsql error types. The PostgreSQL adapter classifies only serialization and deadlock failures (`40001`/`40P01`); business rejection, authorization failure, insufficient resources, permanent constraint conflicts and ordinary domain failure remain non-retryable. Caller cancellation is never converted into a retry.

## Deliberate non-goals

This slice does not:

- add blanket pessimistic locking;
- force all commands through locks;
- force `SERIALIZABLE` isolation;
- hard-code a universal retry count into gameplay contracts;
- add an Npgsql dependency to Core, Kernel or stable execution contracts;
- decide which future gameplay operations require pessimistic locks.

Those choices stay operation- and persistence-specific as required by `COMMAND-EXECUTION.md`.
