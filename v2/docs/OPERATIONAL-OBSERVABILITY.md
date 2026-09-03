# Nexis V2 Operational Observability Boundary

_Status: foundation implementation record, 2026-08-28; producer wiring completed 2026-09-03. Subordinate to `ENGINEERING-MANUAL.md`, `STATE-OWNERSHIP.md`, `COMMAND-EXECUTION.md` and `AGENT-HANDOFF.md`._

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

The recovery and outbox quarantine slice wires the first producers. Recovery reports invalid stored artifacts and deliberate quarantine fence rotation only after the durable quarantine commits. Outbox delivery reports systemic unavailability separately from explicit event-specific rejection, poison exhaustion and fence loss; systemic failures never advance the poison ceiling. Signal-sink failure remains non-authoritative and cannot roll back quarantine, requeue, receipt resolution or delivery state.

The C5 slice wires the remaining producers, each reporting only after its own authoritative classification is complete.

- **Retry exhaustion** (`execution.command-retry`). Reported once, after the bounded executor has spent its last attempt and the TechnicalFailure terminal outcome has been durably attempted, carrying the CommandId, the receipt's original CorrelationId and the spent attempt count. A retry abandoned because the lease moved is deliberately *not* reported here: the bound was not reached, and the recovery repository that owns the fence already reports that condition, so one logical failure does not produce two signals from nested layers.
- **Execution invariant violations** (`execution.command-retry`). A retry plan that does not retain the acquired receipt identity, or a retry-exhaustion plan carrying owner transitions or authoritative events, reports `InvariantViolation` and still throws. Reporting cannot rescue the plan; an unowned plan never reaches the committer either way.
- **Projection failure** (`postgres.projection-consumer`). Reported after the projection transaction has already failed, so neither the checkpoint nor the side effect survives and the event stays redeliverable. The reason token distinguishes a projector that threw from a side effect that succeeded but could not commit. Cooperative cancellation is not a projection defect and is not reported.
- **Unexpected concurrency failure** (`postgres.command-commit`). SQLSTATE class 40 is transaction rollback. Serialization failure and deadlock are the two states the transient classifier owns and retries, and stale owner revisions return ConcurrencyConflict without throwing, so any other class-40 state is a concurrency failure the design does not expect. The bounded reason token appends the specific SQLSTATE. Classes outside 40 are ordinary persistence failures and are deliberately not reported, so a constraint error cannot masquerade as a concurrency incident.
- **Replay artifact rejection versus replay corruption** (`replay.corpus-runner`, `replay.corpus-store`). These are deliberately separate conditions. Rejection means the boundary refused a structurally intact artifact under an explicit policy: an unreviewed corpus or intent contract version, an unregistered codec, a Core that does not support the scenario's contract version, an absent rule/content compatibility approval, or a retention size bound. Corruption means retained evidence no longer matches what was written: a content address that does not match its own JSON, a stored file grown past the bound it was written under, a retained artifact that no longer parses, or a same-address collision. Retention that finds an occupied path delegates to the read path, which owns those conditions, so exactly one signal describes one failure. A divergent replay comparison is neither: a candidate Core deciding differently is the finding the corpus exists to produce and is returned as a result, never reported as a fault.

Replay signals deliberately carry no CommandId, CorrelationId or EventId. A rejected or corrupt artifact cannot be trusted to yield those identifiers, and the signal contract has no artifact-identity field, so linkage is never invented from untrusted content.

Every producer takes the sink as an optional constructor dependency and reports best-effort. A missing, slow or throwing sink cannot change a gameplay outcome, a terminal command outcome, owner state, authoritative history, the retry bound, the receipt fence, rollback, quarantine, checkpoint or replay semantics, and cannot suppress the exception the caller is about to observe.

## Verification

Executable coverage proves all required condition kinds can be represented, structured inputs are bounded, raw payload/exception fields are absent, concurrent reporting preserves exact counts, out-of-order reports cannot move latest occurrence backward, health status reflects severity, and both assemblies retain only approved stable dependencies.

Producer coverage additionally proves, for every C5 producer, the emitted condition kind, severity, component, bounded reason token, linkage and UTC time; that one logical failure emits exactly one signal; that ordinary success, expected conflict, deduplicated retention and divergent comparison emit nothing; and that a throwing sink changes neither the terminal outcome, the rethrown exception, the projection checkpoint nor the committed authoritative record. The PostgreSQL cases raise genuine server-side SQLSTATE errors rather than fabricated exceptions.

One guard is untestable by construction and is documented rather than covered: the retention collision branch is reachable only if retained bytes hash to the requested scenario ID while differing from the submitted JSON, which requires a SHA-256 collision.
