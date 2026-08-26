using Nexis.Eventing.Contracts;

namespace Nexis.Persistence.Postgres;

public sealed record OutboxDispatchBatchResult(
    int Claimed,
    int Published,
    int Failed,
    int LeaseLost);

/// <summary>
/// At-least-once post-commit publisher. A transport may receive the same EventId more than once if
/// publication succeeds but acknowledgement cannot be persisted. That is intentional and requires
/// downstream idempotency by EventId.
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

    public PostgresOutboxDispatcher(
        PostgresOutboxStore store,
        ICommittedEventTransport transport,
        string workerId,
        int batchSize,
        TimeSpan leaseDuration,
        TimeSpan failureDelay,
        TimeProvider? timeProvider = null)
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

        _workerId = workerId;
        _batchSize = batchSize;
        _leaseDuration = leaseDuration;
        _failureDelay = failureDelay;
        _timeProvider = timeProvider ?? TimeProvider.System;
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
            catch (Exception)
            {
                failed++;
                var released = await _store.ReleaseAsync(
                    item.Message.EventId,
                    lease.LeaseToken,
                    lease.WorkerId,
                    _timeProvider.GetUtcNow() + _failureDelay,
                    cancellationToken).ConfigureAwait(false);

                if (!released)
                {
                    leaseLost++;
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
            }
        }

        return new OutboxDispatchBatchResult(lease.Items.Count, published, failed, leaseLost);
    }
}
