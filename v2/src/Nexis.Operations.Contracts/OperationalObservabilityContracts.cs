using Nexis.Kernel.Commands;
using Nexis.Kernel.Events;

namespace Nexis.Operations.Contracts;

public enum OperationalConditionKind
{
    CommandRecoveryFailure = 0,
    LeaseFencingFailure = 1,
    OutboxDeliveryFailure = 2,
    OutboxPoisoned = 3,
    RetryExhausted = 4,
    InvariantViolation = 5,
    ProjectionFailure = 6,
    ReplayArtifactRejected = 7,
    ReplayCorruption = 8,
    UnexpectedConcurrencyFailure = 9
}

public enum OperationalSeverity
{
    Warning = 0,
    Error = 1,
    Critical = 2
}

public enum OperationalHealthStatus
{
    Healthy = 0,
    Degraded = 1,
    Unhealthy = 2
}

public sealed record OperationalComponentKey
{
    public OperationalComponentKey(string value)
    {
        Value = OperationalToken.Validate(value, nameof(value));
    }

    public string Value { get; }

    public override string ToString() => Value;
}

public sealed record OperationalReasonCode
{
    public OperationalReasonCode(string value)
    {
        Value = OperationalToken.Validate(value, nameof(value));
    }

    public string Value { get; }

    public override string ToString() => Value;
}

public sealed record OperationalSignal
{
    public OperationalSignal(
        OperationalConditionKind kind,
        OperationalSeverity severity,
        OperationalComponentKey component,
        OperationalReasonCode reason,
        DateTimeOffset occurredAtUtc,
        CommandId? commandId = null,
        CorrelationId? correlationId = null,
        EventId? eventId = null,
        int? attemptCount = null)
    {
        if (!Enum.IsDefined(kind))
        {
            throw new ArgumentOutOfRangeException(nameof(kind));
        }

        if (!Enum.IsDefined(severity))
        {
            throw new ArgumentOutOfRangeException(nameof(severity));
        }

        if (occurredAtUtc.Offset != TimeSpan.Zero)
        {
            throw new ArgumentException("Operational signal time must be UTC.", nameof(occurredAtUtc));
        }

        if (commandId is { IsEmpty: true })
        {
            throw new ArgumentException("Operational CommandId cannot be empty when supplied.", nameof(commandId));
        }

        if (correlationId is { Value: var correlationValue } && correlationValue == Guid.Empty)
        {
            throw new ArgumentException("Operational CorrelationId cannot be empty when supplied.", nameof(correlationId));
        }

        if (eventId is { Value: var eventValue } && eventValue == Guid.Empty)
        {
            throw new ArgumentException("Operational EventId cannot be empty when supplied.", nameof(eventId));
        }

        if (attemptCount <= 0)
        {
            throw new ArgumentOutOfRangeException(nameof(attemptCount), "Attempt count must be positive when supplied.");
        }

        Kind = kind;
        Severity = severity;
        Component = component ?? throw new ArgumentNullException(nameof(component));
        Reason = reason ?? throw new ArgumentNullException(nameof(reason));
        OccurredAtUtc = occurredAtUtc;
        CommandId = commandId;
        CorrelationId = correlationId;
        EventId = eventId;
        AttemptCount = attemptCount;
    }

    public OperationalConditionKind Kind { get; }

    public OperationalSeverity Severity { get; }

    public OperationalComponentKey Component { get; }

    public OperationalReasonCode Reason { get; }

    public DateTimeOffset OccurredAtUtc { get; }

    public CommandId? CommandId { get; }

    public CorrelationId? CorrelationId { get; }

    public EventId? EventId { get; }

    public int? AttemptCount { get; }
}

public sealed record OperationalConditionSummary(
    OperationalConditionKind Kind,
    long Count,
    OperationalSeverity HighestSeverity,
    DateTimeOffset LatestOccurredAtUtc,
    OperationalComponentKey LatestComponent,
    OperationalReasonCode LatestReason,
    CommandId? LatestCommandId,
    CorrelationId? LatestCorrelationId,
    EventId? LatestEventId,
    int? LatestAttemptCount);

public sealed class OperationalHealthSnapshot
{
    public OperationalHealthSnapshot(
        DateTimeOffset observedAtUtc,
        OperationalHealthStatus status,
        long totalSignals,
        IEnumerable<OperationalConditionSummary> conditions)
    {
        if (observedAtUtc.Offset != TimeSpan.Zero)
        {
            throw new ArgumentException("Operational health observation time must be UTC.", nameof(observedAtUtc));
        }

        if (!Enum.IsDefined(status))
        {
            throw new ArgumentOutOfRangeException(nameof(status));
        }

        if (totalSignals < 0)
        {
            throw new ArgumentOutOfRangeException(nameof(totalSignals));
        }

        ArgumentNullException.ThrowIfNull(conditions);
        var frozen = conditions.ToArray();
        if (frozen.Any(static condition => condition is null))
        {
            throw new ArgumentException("Operational condition summaries cannot contain null entries.", nameof(conditions));
        }

        ObservedAtUtc = observedAtUtc;
        Status = status;
        TotalSignals = totalSignals;
        Conditions = Array.AsReadOnly(frozen);
    }

    public DateTimeOffset ObservedAtUtc { get; }

    public OperationalHealthStatus Status { get; }

    public long TotalSignals { get; }

    public IReadOnlyList<OperationalConditionSummary> Conditions { get; }
}

public interface IOperationalSignalSink
{
    ValueTask ReportAsync(OperationalSignal signal, CancellationToken cancellationToken = default);
}

public interface IOperationalHealthSource
{
    OperationalHealthSnapshot Capture();
}

internal static class OperationalToken
{
    private const int MaximumLength = 128;

    public static string Validate(string value, string parameterName)
    {
        ArgumentException.ThrowIfNullOrWhiteSpace(value, parameterName);
        if (value.Length > MaximumLength)
        {
            throw new ArgumentOutOfRangeException(parameterName, $"Operational identifiers cannot exceed {MaximumLength} characters.");
        }

        if (value.Any(static character =>
                !char.IsAsciiLetterLower(character) &&
                !char.IsAsciiDigit(character) &&
                character is not '.' and not '-' and not '_'))
        {
            throw new ArgumentException(
                "Operational identifiers use only lowercase ASCII letters, digits, periods, hyphens and underscores.",
                parameterName);
        }

        return value;
    }
}
