namespace Nexis.Kernel.Events;

public readonly record struct EventId(Guid Value)
{
    public static EventId New() => new(Guid.NewGuid());
}

public readonly record struct CorrelationId(Guid Value)
{
    public static CorrelationId New() => new(Guid.NewGuid());
}

public sealed record EventMetadata(
    EventId EventId,
    DateTimeOffset OccurredAtUtc,
    CorrelationId CorrelationId,
    EventId? CausationId,
    int SchemaVersion = 1);

public interface IDomainEvent
{
    EventMetadata Metadata { get; }
}
