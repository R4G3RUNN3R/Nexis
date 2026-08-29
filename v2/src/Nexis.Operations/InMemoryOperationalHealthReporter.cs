using Nexis.Operations.Contracts;

namespace Nexis.Operations;

/// <summary>
/// Bounded-cardinality, process-local operational health surface. It aggregates only typed
/// conditions and identifiers; it is diagnostic state and never authoritative gameplay state.
/// </summary>
public sealed class InMemoryOperationalHealthReporter : IOperationalSignalSink, IOperationalHealthSource
{
    private readonly object _gate = new();
    private readonly Dictionary<OperationalConditionKind, Aggregate> _aggregates = new();
    private readonly TimeProvider _timeProvider;
    private long _totalSignals;

    public InMemoryOperationalHealthReporter(TimeProvider? timeProvider = null)
    {
        _timeProvider = timeProvider ?? TimeProvider.System;
    }

    public ValueTask ReportAsync(OperationalSignal signal, CancellationToken cancellationToken = default)
    {
        ArgumentNullException.ThrowIfNull(signal);
        cancellationToken.ThrowIfCancellationRequested();

        lock (_gate)
        {
            checked
            {
                _totalSignals++;
            }

            if (_aggregates.TryGetValue(signal.Kind, out var current))
            {
                current.Add(signal);
            }
            else
            {
                _aggregates.Add(signal.Kind, new Aggregate(signal));
            }
        }

        return ValueTask.CompletedTask;
    }

    public OperationalHealthSnapshot Capture()
    {
        lock (_gate)
        {
            var summaries = _aggregates
                .OrderBy(static pair => pair.Key)
                .Select(static pair => pair.Value.ToSummary())
                .ToArray();
            var status = summaries.Length == 0
                ? OperationalHealthStatus.Healthy
                : summaries.Any(static summary => summary.HighestSeverity >= OperationalSeverity.Error)
                    ? OperationalHealthStatus.Unhealthy
                    : OperationalHealthStatus.Degraded;

            return new OperationalHealthSnapshot(
                _timeProvider.GetUtcNow(),
                status,
                _totalSignals,
                summaries);
        }
    }

    private sealed class Aggregate
    {
        private long _count;
        private OperationalSeverity _highestSeverity;
        private OperationalSignal _latest;

        public Aggregate(OperationalSignal initial)
        {
            _count = 1;
            _highestSeverity = initial.Severity;
            _latest = initial;
        }

        public void Add(OperationalSignal signal)
        {
            checked
            {
                _count++;
            }

            if (signal.Severity > _highestSeverity)
            {
                _highestSeverity = signal.Severity;
            }

            if (signal.OccurredAtUtc > _latest.OccurredAtUtc)
            {
                _latest = signal;
            }
        }

        public OperationalConditionSummary ToSummary() =>
            new(
                _latest.Kind,
                _count,
                _highestSeverity,
                _latest.OccurredAtUtc,
                _latest.Component,
                _latest.Reason,
                _latest.CommandId,
                _latest.CorrelationId,
                _latest.EventId,
                _latest.AttemptCount,
                _latest.OriginalCorrelationId,
                _latest.ActorDiscriminator);
    }
}
