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

Resource key strings are stable contract values and must not be localized, culture-sorted or constructed from mutable display names.

## Bounded whole-command retry

`BoundedCommandRetryExecutor` retries only exceptions explicitly approved by an infrastructure-specific `ITransientCommandFailureClassifier` and only up to the configured maximum attempt count.

Each retry invokes the **whole command attempt callback again**. That callback is required to reload current authoritative snapshots, revalidate current actor authority/prerequisites, re-evaluate Core where required and then attempt the atomic commit again.

It must never resume from a half-applied in-memory plan or reuse stale snapshots from the failed attempt.

The stable contract deliberately does not mention PostgreSQL/Npgsql error types. A later PostgreSQL adapter may classify known retryable database failures such as serialization/deadlock conditions, while business-rule rejection, authorization failure, insufficient resources, permanent constraint conflicts and ordinary domain failure remain non-retryable.

Caller cancellation is never converted into an automatic retry even if a faulty classifier claims otherwise.

## Deliberate non-goals

This slice does not:

- add blanket pessimistic locking;
- force all commands through locks;
- force `SERIALIZABLE` isolation;
- hard-code a universal retry count into gameplay contracts;
- add an Npgsql dependency to Core, Kernel or stable execution contracts;
- decide which future gameplay operations require pessimistic locks.

Those choices stay operation- and persistence-specific as required by `COMMAND-EXECUTION.md`.
