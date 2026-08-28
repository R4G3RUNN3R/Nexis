# Nexis V2 Operational Observability Boundary

_Status: foundation implementation record, 2026-08-28. Subordinate to `ENGINEERING-MANUAL.md`, `STATE-OWNERSHIP.md`, `COMMAND-EXECUTION.md` and `AGENT-HANDOFF.md`._

## Purpose

The Operations boundary exposes structured, platform-neutral evidence that Foundation infrastructure is degraded or failing. It is not authoritative gameplay state, command history, Admin Audit, Player Log, replay evidence, analytics or a monitoring vendor integration.

`Nexis.Operations.Contracts` defines the producer/consumer seam. `Nexis.Operations` provides a bounded process-local health reporter suitable for tests, local operation and later composition behind HTTP/metrics/alerting adapters.

## Typed conditions

The V1 condition catalogue covers:

- command recovery failure;
- lease/fencing failure;
- outbox delivery failure;
- poison/dead-letter outbox state;
- retry exhaustion;
- invariant violation;
- projection failure;
- replay artifact rejection;
- replay corruption;
- unexpected concurrency failure.

Condition kind and severity are enums. Component and reason identifiers are bounded lowercase tokens. Optional `CommandId`, `CorrelationId`, `EventId` and positive attempt count preserve operational linkage without copying command payloads, event payloads, credentials, personal data or raw exception objects.

## Reporting and health surfaces

`IOperationalSignalSink` accepts one immutable structured `OperationalSignal`. Reporting is diagnostic and must never decide or mutate a gameplay outcome.

`IOperationalHealthSource` returns an immutable `OperationalHealthSnapshot` containing:

- observation time;
- Healthy, Degraded or Unhealthy status;
- total signal count;
- one bounded summary per condition kind;
- exact count, highest severity and latest structured occurrence for each kind.

`InMemoryOperationalHealthReporter` implements both contracts. It is thread-safe, bounded to the fixed condition catalogue, monotonic for latest occurrence time, and process-local. It is deliberately not durable and does not claim that a restart resolved an underlying fault. A future host/monitoring adapter may expose or persist these contracts without changing producers.

## Security and ownership

Operational signals contain no arbitrary message, dictionary, payload or `Exception` field. Detailed exception diagnostics remain in appropriately protected structured logs and must obey secret/privacy rules.

Operations owns no gameplay facts. Counts and health summaries are diagnostic projections. Losing them cannot change command, owner, history, audit, outbox, replay or projection truth.

The contract assembly depends only on `Nexis.Kernel` identities. The implementation depends only on the contract assembly and Kernel. It has no concrete Core, Execution, PostgreSQL, HTTP, Player Log or owner-module dependency.

## Producer integration rule

A producer reports the typed condition after it has classified the failure; emitting a signal does not replace correct failure handling, quarantine, retry bounds, fencing, rollback or dead-letter state.

The current slice establishes the shared contracts and health surface. Validated C7 fixes must wire the relevant recovery, outbox, retry, projection, replay and concurrency paths when those paths gain the required quarantine/dead-letter/classification behavior. Until a producer is wired, the absence of a signal is not evidence that the underlying condition cannot occur.

## Verification

Executable coverage proves all required condition kinds can be represented, structured inputs are bounded, raw payload/exception fields are absent, concurrent reporting preserves exact counts, out-of-order reports cannot move latest occurrence backward, health status reflects severity, and both assemblies retain only approved stable dependencies.
