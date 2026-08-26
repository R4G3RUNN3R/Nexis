using Nexis.Core.Contracts;
using Nexis.Kernel.Commands;
using Nexis.Kernel.Events;

namespace Nexis.Eventing.Contracts;

/// <summary>
/// Serialized committed-event envelope delivered after the authoritative transaction has already
/// committed. EventId is the permanent delivery/idempotency identity across every redelivery.
/// </summary>
public sealed record CommittedEventMessage
{
    public CommittedEventMessage(
        EventId eventId,
        CommandId commandId,
        CorrelationId correlationId,
        DateTimeOffset occurredAtUtc,
        ContractDescriptor contract,
        string payloadJson)
    {
        if (eventId.Value == Guid.Empty)
        {
            throw new ArgumentException("Committed event messages require a non-empty EventId.", nameof(eventId));
        }

        if (commandId.IsEmpty)
        {
            throw new ArgumentException("Committed event messages require a non-empty CommandId.", nameof(commandId));
        }

        if (correlationId.Value == Guid.Empty)
        {
            throw new ArgumentException("Committed event messages require a non-empty CorrelationId.", nameof(correlationId));
        }

        if (occurredAtUtc.Offset != TimeSpan.Zero)
        {
            throw new ArgumentException("Committed event occurrence time must be UTC.", nameof(occurredAtUtc));
        }

        Contract = contract ?? throw new ArgumentNullException(nameof(contract));
        ArgumentException.ThrowIfNullOrWhiteSpace(payloadJson);

        EventId = eventId;
        CommandId = commandId;
        CorrelationId = correlationId;
        OccurredAtUtc = occurredAtUtc;
        PayloadJson = payloadJson;
    }

    public EventId EventId { get; }

    public CommandId CommandId { get; }

    public CorrelationId CorrelationId { get; }

    public DateTimeOffset OccurredAtUtc { get; }

    public ContractDescriptor Contract { get; }

    public string PayloadJson { get; }
}

/// <summary>
/// Post-commit transport boundary. Delivery is at-least-once: implementations and downstream
/// consumers must treat EventId as the stable idempotency key. This interface cannot mutate
/// authoritative gameplay state; reactions that need gameplay mutation must enter a normal System
/// command through the authoritative command pipeline.
/// </summary>
public interface ICommittedEventTransport
{
    ValueTask PublishAsync(
        CommittedEventMessage message,
        CancellationToken cancellationToken = default);
}
