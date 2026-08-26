using Nexis.Core.Contracts;
using Nexis.Execution.Contracts;

namespace Nexis.Execution;

/// <summary>
/// Application-layer ingress guard that derives idempotency identity from trusted Core request facts
/// and atomically claims the durable command receipt before any authoritative mutation is attempted.
/// </summary>
public sealed class CommandReceiptCoordinator
{
    private readonly ICommandReceiptRepository _receiptRepository;

    public CommandReceiptCoordinator(ICommandReceiptRepository receiptRepository)
    {
        _receiptRepository = receiptRepository ?? throw new ArgumentNullException(nameof(receiptRepository));
    }

    public ValueTask<CommandReceiptClaim> AcquireAsync(
        CoreEvaluationRequest request,
        CommandPayloadFingerprint payloadFingerprint,
        DateTimeOffset receivedAtUtc,
        CancellationToken cancellationToken = default)
    {
        ArgumentNullException.ThrowIfNull(request);
        ArgumentNullException.ThrowIfNull(payloadFingerprint);

        if (receivedAtUtc.Offset != TimeSpan.Zero)
        {
            throw new ArgumentException("Authoritative command receive time must be UTC.", nameof(receivedAtUtc));
        }

        var identity = new CommandExecutionIdentity(
            request.Context.CommandId,
            CommandActorBinding.From(request.Context.Actor),
            request.Intent.Contract,
            payloadFingerprint);

        return _receiptRepository.TryAcquireAsync(
            identity,
            request.Context.CorrelationId,
            receivedAtUtc,
            cancellationToken);
    }
}
