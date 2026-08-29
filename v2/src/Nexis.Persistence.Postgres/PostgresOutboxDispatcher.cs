using Nexis.Eventing.Contracts;
using Nexis.Operations.Contracts;

namespace Nexis.Persistence.Postgres;

public sealed record OutboxDispatchBatchResult(
    int Claimed,
    int Published,
    int Failed,
    int LeaseLost,
    int DeadLettered);

/// <summary>
/// At-least-once post-commit publisher. A transport may receive the same EventId more than once if
/// publication succeeds but acknowledgement cannot be persisted. That is intentional and requires
/// downstream idempotency by EventId. Permanently failing events move to an explicit dead-letter
/// state after the configured infrastructure retry ceiling.
/// </summary>
public sealed class PostgresOutboxDispatcher
{
    private readonly PostgresOutboxStore _store;
    private readonly ICommittedEventTransport _transport;
    private readonly string _workerId;
    private readonly int _batchSize;
    private readonly TimeSpan _leaseDuration;
    private readonly TimeSpan _failureDelay;
    private readonly TimeProvider _timeProvider;
    private readonly int _maximumAttempts;
    private readonly IOperationalSignalSink? _operationalSignalSink;

    public PostgresOutboxDispatcher(
        PostgresOutboxStore store,
        ICommittedEventTransport transport,
        string workerId,
        int batchSize,
        TimeSpan leaseDuration,
        TimeSpan failureDelay,
        TimeProvider? timeProvider = null,
        int maximumAttempts = 10,
        IOperationalSignalSink? operationalSignalSink = null)
    {
        _store = store ?? throw new ArgumentNullException(nameof(store));
        _transport = transport ?? throw new ArgumentNullException(nameof(transport));
        ArgumentException.ThrowIfNullOrWhiteSpace(workerId);

        if (batchSize <= 0)
        {
            throw new ArgumentOutOfRangeException(nameof(batchSize), "Outbox batch size must be positive.");
        }

        if (leaseDuration <= TimeSpan.Zero)
        {
            throw new ArgumentOutOfRangeException(nameof(leaseDuration), "Outbox lease duration must be positive.");
        }

        if (failureDelay < TimeSpan.Zero)
        {
            throw new ArgumentOutOfRangeException(nameof(failureDelay), "Outbox failure delay cannot be negative.");
        }

        if (maximumAttempts <= 0)
        {
            throw new ArgumentOutOfRangeException(nameof(maximumAttempts), "Outbox maximum attempts must be positive.");
        }

        _workerId = workerId;
        _batchSize = batchSize;
        _leaseDuration = leaseDuration;
        _failureDelay = failureDelay;
        _timeProvider = timeProvider ?? TimeProvider.System;
        _maximumAttempts = maximumAttempts;
        _operationalSignalSink = operationalSignalSink;
    }

    public async ValueTask<OutboxDispatchBatchResult> DispatchOnceAsync(
        CancellationToken cancellationToken = default)
    {
        var claimTime = _timeProvider.GetUtcNow();
        var lease = await _store.ClaimBatchAsync(
            _workerId,
            _batchSize,
            claimTime,
            _leaseDuration,
            cancellationToken).ConfigureAwait(false);

        var published = 0;
        var failed = 0;
        var leaseLost = 0;
        var deadLettered = 0;

        foreach (var item in lease.Items)
        {
            cancellationToken.ThrowIfCancellationRequested();

            var renewed = await _store.RenewAsync(
                item.Message.EventId,
                lease.LeaseToken,
                lease.WorkerId,
                _timeProvider.GetUtcNow() + _leaseDuration,
                cancellationToken).ConfigureAwait(false);

            if (!renewed)
            {
                leaseLost++;
                await ReportAsync(
                    OperationalConditionKind.LeaseFencingFailure,
                    OperationalSeverity.Error,
                    "outbox_lease_renewal_lost",
                    item.Message,
                    item.AttemptCount).ConfigureAwait(false);
                continue;
            }

            try
            {
                await _transport.PublishAsync(item.Message, cancellationToken).ConfigureAwait(false);
            }
            catch (OperationCanceledException) when (cancellationToken.IsCancellationRequested)
            {
                // Publication outcome may be ambiguous. Do not release immediately: expiry will
                // safely make the row eligible again and EventId protects idempotent consumers.
                throw;
            }
            catch (Exception exception)
            {
                failed++;
                var failureKind = exception is CommittedEventTransportException classified
                    ? classified.FailureKind
                    : CommittedEventTransportFailureKind.SystemicTransient;

                if (failureKind == CommittedEventTransportFailureKind.EventSpecificPermanent)
                {
                    var failureTime = _timeProvider.GetUtcNow();
                    var poisonFailure = await _store.RecordPoisonFailureAsync(
                        item.Message.EventId,
                        lease.LeaseToken,
                        lease.WorkerId,
                        failureTime,
                        failureTime + _failureDelay,
                        _maximumAttempts,
                        cancellationToken).ConfigureAwait(false);

                    if (!poisonFailure.FenceOwned)
                    {
                        leaseLost++;
                        await ReportAsync(
                            OperationalConditionKind.LeaseFencingFailure,
                            OperationalSeverity.Error,
                            "outbox_poison_failure_fence_lost",
                            item.Message,
                            item.AttemptCount).ConfigureAwait(false);
                        continue;
                    }

                    await ReportAsync(
                        OperationalConditionKind.OutboxDeliveryFailure,
                        poisonFailure.DeadLettered ? OperationalSeverity.Error : OperationalSeverity.Warning,
                        "event_specific_rejection",
                        item.Message,
                        item.AttemptCount).ConfigureAwait(false);

                    if (poisonFailure.DeadLettered)
                    {
                        deadLettered++;
                        await ReportAsync(
                            OperationalConditionKind.OutboxPoisoned,
                            OperationalSeverity.Error,
                            "event_specific_retry_exhausted",
                            item.Message,
                            poisonFailure.PoisonAttemptCount).ConfigureAwait(false);
                        await ReportAsync(
                            OperationalConditionKind.RetryExhausted,
                            OperationalSeverity.Error,
                            "outbox_delivery",
                            item.Message,
                            poisonFailure.PoisonAttemptCount).ConfigureAwait(false);
                    }

                    continue;
                }

                var released = await _store.ReleaseAsync(
                    item.Message.EventId,
                    lease.LeaseToken,
                    lease.WorkerId,
                    _timeProvider.GetUtcNow() + _failureDelay,
                    cancellationToken).ConfigureAwait(false);

                if (!released)
                {
                    leaseLost++;
                    await ReportAsync(
                        OperationalConditionKind.LeaseFencingFailure,
                        OperationalSeverity.Error,
                        "outbox_release_fence_lost",
                        item.Message,
                        item.AttemptCount).ConfigureAwait(false);
                }
                else
                {
                    await ReportAsync(
                        OperationalConditionKind.OutboxDeliveryFailure,
                        OperationalSeverity.Warning,
                        "transport_unavailable",
                        item.Message,
                        item.AttemptCount).ConfigureAwait(false);
                }

                continue;
            }

            var acknowledged = await _store.AcknowledgePublishedAsync(
                item.Message.EventId,
                lease.LeaseToken,
                lease.WorkerId,
                _timeProvider.GetUtcNow(),
                cancellationToken).ConfigureAwait(false);

            if (acknowledged)
            {
                published++;
            }
            else
            {
                // Transport accepted the message but the durable acknowledgement was lost/rejected.
                // The event may be delivered again after lease expiry; this is the expected
                // at-least-once failure mode, not permission to fabricate exactly-once semantics.
                leaseLost++;
                await ReportAsync(
                    OperationalConditionKind.LeaseFencingFailure,
                    OperationalSeverity.Error,
                    "outbox_acknowledgement_fence_lost",
                    item.Message,
                    item.AttemptCount).ConfigureAwait(false);
            }
        }

        return new OutboxDispatchBatchResult(
            lease.Items.Count,
            published,
            failed,
            leaseLost,
            deadLettered);
    }

    private async ValueTask ReportAsync(
        OperationalConditionKind kind,
        OperationalSeverity severity,
        string reason,
        CommittedEventMessage message,
        int attemptCount)
    {
        if (_operationalSignalSink is null)
        {
            return;
        }

        try
        {
            await _operationalSignalSink.ReportAsync(
                new OperationalSignal(
                    kind,
                    severity,
                    new OperationalComponentKey("postgres.outbox-dispatcher"),
                    new OperationalReasonCode(reason),
                    _timeProvider.GetUtcNow(),
                    message.CommandId,
                    message.CorrelationId,
                    message.EventId,
                    attemptCount),
                CancellationToken.None).ConfigureAwait(false);
        }
        catch (Exception)
        {
            // Diagnostics are deliberately non-authoritative. A failing monitoring sink must not
            // change delivery, acknowledgement, fencing, or dead-letter state.
        }
    }
}
