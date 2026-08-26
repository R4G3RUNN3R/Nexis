using Nexis.Core.Contracts;
using Nexis.Identity.Contracts;
using Nexis.Kernel.Commands;
using Nexis.Kernel.Events;

namespace Nexis.Execution.Contracts;

/// <summary>
/// Durable command facts needed to rehydrate an abandoned typed command. These are historical
/// identity facts, not current authorization. Recovery code must resolve a fresh TrustedActorContext
/// and current authoritative owner snapshots before any re-evaluation.
/// </summary>
public sealed record RecoveredCommandExecution
{
    public RecoveredCommandExecution(
        CommandId commandId,
        CommandExecutionLane lane,
        AccountId? accountId,
        CharacterId? characterId,
        ContractDescriptor intentContract,
        CanonicalCommandPayload payload,
        CorrelationId originalCorrelationId,
        DateTimeOffset receivedAtUtc,
        CommandExecutionToken executionToken,
        string workerId,
        DateTimeOffset leaseExpiresAtUtc)
        : this(
            commandId,
            lane,
            accountId,
            characterId,
            lane == CommandExecutionLane.System ? SystemActorKey.Platform : null,
            intentContract,
            payload,
            originalCorrelationId,
            receivedAtUtc,
            executionToken,
            workerId,
            leaseExpiresAtUtc)
    {
    }

    public RecoveredCommandExecution(
        CommandId commandId,
        CommandExecutionLane lane,
        AccountId? accountId,
        CharacterId? characterId,
        SystemActorKey? systemActorKey,
        ContractDescriptor intentContract,
        CanonicalCommandPayload payload,
        CorrelationId originalCorrelationId,
        DateTimeOffset receivedAtUtc,
        CommandExecutionToken executionToken,
        string workerId,
        DateTimeOffset leaseExpiresAtUtc)
    {
        if (commandId.IsEmpty)
        {
            throw new ArgumentException("Recovered commands require a non-empty CommandId.", nameof(commandId));
        }

        if (!Enum.IsDefined(typeof(CommandExecutionLane), lane))
        {
            throw new ArgumentOutOfRangeException(nameof(lane));
        }

        ValidateActorShape(lane, accountId, characterId, systemActorKey);
        IntentContract = intentContract ?? throw new ArgumentNullException(nameof(intentContract));
        Payload = payload ?? throw new ArgumentNullException(nameof(payload));

        if (originalCorrelationId.Value == Guid.Empty)
        {
            throw new ArgumentException("Recovered commands require the original CorrelationId.", nameof(originalCorrelationId));
        }

        if (receivedAtUtc.Offset != TimeSpan.Zero)
        {
            throw new ArgumentException("Recovered command receive time must be UTC.", nameof(receivedAtUtc));
        }

        if (executionToken.IsEmpty)
        {
            throw new ArgumentException("Recovered commands require a non-empty execution token.", nameof(executionToken));
        }

        ArgumentException.ThrowIfNullOrWhiteSpace(workerId);
        if (leaseExpiresAtUtc.Offset != TimeSpan.Zero)
        {
            throw new ArgumentException("Recovered command lease expiry must be UTC.", nameof(leaseExpiresAtUtc));
        }

        CommandId = commandId;
        Lane = lane;
        AccountId = accountId;
        CharacterId = characterId;
        SystemActorKey = systemActorKey;
        OriginalCorrelationId = originalCorrelationId;
        ReceivedAtUtc = receivedAtUtc;
        ExecutionToken = executionToken;
        WorkerId = workerId.Trim();
        LeaseExpiresAtUtc = leaseExpiresAtUtc;
    }

    public CommandId CommandId { get; }

    public CommandExecutionLane Lane { get; }

    public AccountId? AccountId { get; }

    public CharacterId? CharacterId { get; }

    public SystemActorKey? SystemActorKey { get; }

    public ContractDescriptor IntentContract { get; }

    public CanonicalCommandPayload Payload { get; }

    public CorrelationId OriginalCorrelationId { get; }

    public DateTimeOffset ReceivedAtUtc { get; }

    public CommandExecutionToken ExecutionToken { get; }

    public string WorkerId { get; }

    public DateTimeOffset LeaseExpiresAtUtc { get; }

    private static void ValidateActorShape(
        CommandExecutionLane lane,
        AccountId? accountId,
        CharacterId? characterId,
        SystemActorKey? systemActorKey)
    {
        if (accountId is { IsEmpty: true })
        {
            throw new ArgumentException("Recovered AccountId cannot be empty when supplied.", nameof(accountId));
        }

        if (characterId is { IsEmpty: true })
        {
            throw new ArgumentException("Recovered CharacterId cannot be empty when supplied.", nameof(characterId));
        }

        var valid = lane switch
        {
            CommandExecutionLane.Player or CommandExecutionLane.Realtime => accountId.HasValue && characterId.HasValue && systemActorKey is null,
            CommandExecutionLane.Admin => accountId.HasValue && !characterId.HasValue && systemActorKey is null,
            CommandExecutionLane.System => !accountId.HasValue && !characterId.HasValue && systemActorKey is not null,
            _ => false
        };

        if (!valid)
        {
            throw new ArgumentException("Recovered command actor identity does not match its execution lane.");
        }
    }
}

public enum CommandRecoveryDisposition
{
    Recovered = 0,
    Completed = 1,
    OwnershipLost = 2,
    Missing = 3,
    NotRecoverable = 4
}

public sealed record CommandRecoveryResult
{
    private CommandRecoveryResult(
        CommandRecoveryDisposition disposition,
        CorrelationId? originalCorrelationId,
        RecoveredCommandExecution? execution,
        CommandTerminalOutcome? terminalOutcome)
    {
        Disposition = disposition;
        OriginalCorrelationId = originalCorrelationId;
        Execution = execution;
        TerminalOutcome = terminalOutcome;
    }

    public CommandRecoveryDisposition Disposition { get; }

    public CorrelationId? OriginalCorrelationId { get; }

    public RecoveredCommandExecution? Execution { get; }

    public CommandTerminalOutcome? TerminalOutcome { get; }

    public static CommandRecoveryResult Recovered(RecoveredCommandExecution execution) =>
        new(
            CommandRecoveryDisposition.Recovered,
            (execution ?? throw new ArgumentNullException(nameof(execution))).OriginalCorrelationId,
            execution,
            null);

    public static CommandRecoveryResult Completed(
        CorrelationId originalCorrelationId,
        CommandTerminalOutcome terminalOutcome) =>
        new(
            CommandRecoveryDisposition.Completed,
            originalCorrelationId,
            null,
            terminalOutcome ?? throw new ArgumentNullException(nameof(terminalOutcome)));

    public static CommandRecoveryResult OwnershipLost(CorrelationId originalCorrelationId) =>
        new(CommandRecoveryDisposition.OwnershipLost, originalCorrelationId, null, null);

    public static CommandRecoveryResult Missing() =>
        new(CommandRecoveryDisposition.Missing, null, null, null);

    public static CommandRecoveryResult NotRecoverable(CorrelationId originalCorrelationId) =>
        new(CommandRecoveryDisposition.NotRecoverable, originalCorrelationId, null, null);
}

public interface ICommandExecutionRecoveryRepository
{
    ValueTask<CommandRecoveryResult> ReconcileAsync(
        CommandId commandId,
        CommandExecutionToken observedExecutionToken,
        CommandExecutionLeaseRequest replacementLease,
        DateTimeOffset nowUtc,
        CancellationToken cancellationToken = default);

    ValueTask<IReadOnlyList<RecoveredCommandExecution>> ClaimExpiredBatchAsync(
        CommandExecutionLeaseRequest replacementLease,
        DateTimeOffset nowUtc,
        int maximumItems,
        CancellationToken cancellationToken = default);

    ValueTask<bool> RenewLeaseAsync(
        CommandId commandId,
        CommandExecutionToken executionToken,
        CommandExecutionLeaseRequest currentLease,
        DateTimeOffset nowUtc,
        CancellationToken cancellationToken = default);
}
