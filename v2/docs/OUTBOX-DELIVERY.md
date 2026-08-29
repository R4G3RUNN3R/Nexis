# Nexis 2.0 Durable Outbox Delivery and Consumer Idempotency

_Status: foundation implementation slice, 2026-08-26._

## Delivery guarantee

Nexis post-commit event delivery is **at-least-once**.

The system deliberately does not claim exactly-once delivery across PostgreSQL and arbitrary external transports. A worker can publish an event successfully and then lose the database acknowledgement because of a crash/network failure. That event will later be delivered again. Every transport and consumer therefore receives the immutable `EventId` as the stable idempotency key.

Authoritative gameplay state has already committed before an outbox message exists. Outbox workers and projection consumers may not directly mutate authoritative owner state. A post-commit reaction that needs gameplay mutation must enter a new normal System command with its own CommandId through the authoritative command pipeline.

## Multi-worker claiming

`PostgresOutboxStore.ClaimBatchAsync` uses a queue-style PostgreSQL statement with `FOR UPDATE SKIP LOCKED`. PostgreSQL documents `SKIP LOCKED` as appropriate for avoiding lock contention between multiple consumers of a queue-like table.

Each claimed row receives:

- a random lease token;
- a stable worker identifier;
- a UTC lease expiry;
- an incremented delivery-attempt count.

A row can be claimed only when it is unpublished, its retry availability time has arrived, and it is currently unleased or its previous lease has expired.

Expired leases are reclaimable. This is crash recovery for the delivery worker, not permission to invent a new EventId.

## Lease acknowledgement

Publication acknowledgement or release requires the exact EventId + lease token + worker identity. A stale worker cannot acknowledge a row after another worker has reclaimed it.

The dispatcher renews the current item's lease before transport publication. If transport publication succeeds but durable acknowledgement fails, the row remains eligible for later redelivery after lease expiry. This is the expected at-least-once ambiguity window.

Transport failure releases the row with a configured `available_at_utc` delay. Failure delay and lease duration are infrastructure configuration, not gameplay rules.

## Failure classification, quarantine and operator recovery

Delivery attempts and poison attempts are distinct durable counters. Every claim increments the total delivery-attempt count for operational evidence. Only an explicit `CommittedEventTransportException` classified as `EventSpecificPermanent` increments the event-specific poison count. Unclassified failures and `SystemicTransient` failures are treated as shared transport unavailability: they back off and remain claimable, regardless of how many times the transport is unavailable. A broad outage can therefore never consume the poison budget of valid backlog.

When one immutable event reaches the configured poison ceiling, PostgreSQL atomically clears its lease and records `dead_lettered_at_utc` plus the bounded reason `event_specific_retry_exhausted`. Dead-lettered events are excluded from ordinary claim, renew, acknowledge and release paths.

Quarantine is a lifecycle state, not a permanent trapdoor. `PostgresOperationalQuarantineService` provides payload-free bounded listing and explicit requeue. Both require an authorized `operations.quarantine.manage` privileged-entry decision, acting staff AccountId, CorrelationId and case reference. Requeue compares the observed dead-letter timestamp and poison count, resets only quarantine and delivery availability, and appends the successful or stale-fence outcome to Admin Audit in the same transaction. Listing alone never requeues an event, and no background path automatically resurrects dead-lettered work.

## Internal PostgreSQL projections

`PostgresProjectionConsumerExecutor` exists only for non-authoritative read models/projections.

A projection consumer receives the same committed `EventId` and applies its projection using the supplied Npgsql connection/transaction. The executor first inserts `(consumer_name, event_id)` into `event_consumer_checkpoints` and performs the projection side effect in the **same transaction**.

Therefore:

- duplicate delivery after a prior successful commit becomes `AlreadyProcessed`;
- concurrent duplicate delivery for one consumer blocks/conflicts on the same checkpoint key and commits at most one projection side effect;
- if the projection throws after making a database change, both the change and checkpoint roll back;
- the later retry can safely process the event again.

This transactional checkpoint guarantee applies only when the projection side effect uses the supplied PostgreSQL transaction. External systems must provide their own EventId idempotency handling.

## Stable contract boundary

`Nexis.Eventing.Contracts` contains the infrastructure-neutral `CommittedEventMessage` and `ICommittedEventTransport` boundary. It depends only on Kernel/Core contracts and contains no Npgsql, EF, HTTP, Redis or UI types.

The transport message contains:

- EventId;
- originating CommandId;
- original CorrelationId;
- authoritative occurrence time;
- event contract name/schema;
- serialized JSON payload produced from the committed authoritative event.

Core has no dependency on the event transport or PostgreSQL delivery implementation.

## Deliberate non-goals

This slice does not yet add:

- a specific Kafka/RabbitMQ/cloud transport;
- gameplay event handlers;
- direct post-commit owner mutations;
- production operational dashboards/alerting;
- automatic command creation from events.

Those are later replaceable components and must follow the same component release/verification discipline.
