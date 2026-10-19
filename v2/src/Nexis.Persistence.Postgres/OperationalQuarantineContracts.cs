using Nexis.Core.Contracts;
using Nexis.Execution.Contracts;
using Nexis.Kernel.Commands;
using Nexis.Kernel.Events;

namespace Nexis.Persistence.Postgres;

public sealed record OperationalQuarantineActionContext
{
    public OperationalQuarantineActionContext(
        PrivilegedCommandEntryDecision authorization,
        CorrelationId correlationId,
        DateTimeOffset occurredAtUtc,
        string caseReference)
    {
        Authorization = authorization ?? throw new ArgumentNullException(nameof(authorization));
        if (correlationId.Value == Guid.Empty)
        {
            throw new ArgumentException("Operator quarantine actions require a CorrelationId.", nameof(correlationId));
        }

        if (occurredAtUtc.Offset != TimeSpan.Zero)
        {
            throw new ArgumentException("Operator quarantine action time must be UTC.", nameof(occurredAtUtc));
        }

        ArgumentException.ThrowIfNullOrWhiteSpace(caseReference);
        var normalizedCaseReference = caseReference.Trim();
        if (normalizedCaseReference.Length > 128)
        {
            throw new ArgumentOutOfRangeException(nameof(caseReference), "Case references cannot exceed 128 characters.");
        }

        CorrelationId = correlationId;
        OccurredAtUtc = occurredAtUtc;
        CaseReference = normalizedCaseReference;
    }

    public PrivilegedCommandEntryDecision Authorization { get; }

    public CorrelationId CorrelationId { get; }

    public DateTimeOffset OccurredAtUtc { get; }

    public string CaseReference { get; }
}

public sealed record OutboxDeadLetterEntry(
    EventId EventId,
    CommandId CommandId,
    CorrelationId CorrelationId,
    DateTimeOffset OccurredAtUtc,
    ContractDescriptor Contract,
    DateTimeOffset CreatedAtUtc,
    int AttemptCount,
    int PoisonAttemptCount,
    DateTimeOffset DeadLetteredAtUtc,
    string DeadLetterReason);

public sealed record CommandRecoveryQuarantineEntry(
    CommandId CommandId,
    CorrelationId OriginalCorrelationId,
    ContractDescriptor IntentContract,
    DateTimeOffset ReceivedAtUtc,
    CommandExecutionToken ExecutionToken,
    DateTimeOffset? RecoveryAbandonedAtUtc,
    string RecoveryAbandonReason);
