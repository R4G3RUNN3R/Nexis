namespace Nexis.Kernel.Events;

public readonly record struct EventId(Guid Value)
{
    public static EventId New() => new(Guid.NewGuid());
}

public readonly record struct CorrelationId(Guid Value)
{
    public static CorrelationId New() => new(Guid.NewGuid());
}

/// <summary>
/// Durable identity and ordering facts for one authoritative event.
///
/// <paramref name="IntraCommandSequence"/> is the recoverable total order of the events a single
/// command committed. It is assigned from the order Core emitted them, persisted alongside the
/// event, and carried through outbox delivery, recovery, replay and Player Log projection. Order is
/// therefore never inferred from equal timestamps, database row order, list identity or a
/// wall-clock trick, all of which are unreliable when several events share one command and one
/// authoritative evaluation instant.
///
/// <paramref name="CausationId"/> additionally chains each event to its predecessor within the same
/// command, so the causal record is explicit in history rather than implied.
/// </summary>
public sealed record EventMetadata
{
    public EventMetadata(
        EventId EventId,
        DateTimeOffset OccurredAtUtc,
        CorrelationId CorrelationId,
        EventId? CausationId,
        int SchemaVersion = 1,
        int IntraCommandSequence = 0)
    {
        if (SchemaVersion <= 0)
        {
            throw new ArgumentOutOfRangeException(nameof(SchemaVersion), "Event schema versions start at 1.");
        }

        if (IntraCommandSequence < 0)
        {
            throw new ArgumentOutOfRangeException(
                nameof(IntraCommandSequence),
                "Intra-command event sequence numbers start at 0.");
        }

        this.EventId = EventId;
        this.OccurredAtUtc = OccurredAtUtc;
        this.CorrelationId = CorrelationId;
        this.CausationId = CausationId;
        this.SchemaVersion = SchemaVersion;
        this.IntraCommandSequence = IntraCommandSequence;
    }

    public EventId EventId { get; init; }

    public DateTimeOffset OccurredAtUtc { get; init; }

    public CorrelationId CorrelationId { get; init; }

    public EventId? CausationId { get; init; }

    public int SchemaVersion { get; init; }

    /// <summary>Zero-based position of this event among the events its command committed.</summary>
    public int IntraCommandSequence { get; init; }
}

public interface IDomainEvent
{
    EventMetadata Metadata { get; }
}
