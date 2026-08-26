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
        CanonicalCommandPayload payload,
        CommandExecutionLeaseRequest executionLease,
        DateTimeOffset receivedAtUtc,
        CancellationToken cancellationToken = default)
    {
        ArgumentNullException.ThrowIfNull(request);
        ArgumentNullException.ThrowIfNull(payload);
        ArgumentNullException.ThrowIfNull(executionLease);

        var identity = CommandExecutionIdentityFactory.Create(request, payload);
        var acquisition = new CommandReceiptAcquireRequest(
            identity,
            payload,
            request.Context.CorrelationId,
            receivedAtUtc,
            executionLease);

        return _receiptRepository.TryAcquireAsync(acquisition, cancellationToken);
    }
}
