using Nexis.Core.Contracts;
using Nexis.Kernel.Events;

namespace Nexis.Execution.Contracts;

/// <summary>
/// Immutable execution metadata persisted with a terminal authoritative command so historical
/// replay can identify the exact Core/rule/content versions that produced the decision.
/// </summary>
public sealed record CommandExecutionTrace
{
    public CommandExecutionTrace(
        CommandExecutionIdentity identity,
        CorrelationId correlationId,
        CoreImplementationDescriptor coreImplementation,
        CoreContractVersion coreContractVersion,
        RuleVersion ruleVersion,
        ContentVersion contentVersion,
        DateTimeOffset evaluatedAtUtc)
    {
        if (correlationId.Value == Guid.Empty)
        {
            throw new ArgumentException("Command trace CorrelationId cannot be empty.", nameof(correlationId));
        }

        if (evaluatedAtUtc.Offset != TimeSpan.Zero)
        {
            throw new ArgumentException("Command trace evaluation time must be UTC.", nameof(evaluatedAtUtc));
        }

        if (!coreContractVersion.IsValid)
        {
            throw new ArgumentOutOfRangeException(nameof(coreContractVersion), "Core contract version must be positive.");
        }

        Identity = identity ?? throw new ArgumentNullException(nameof(identity));
        CoreImplementation = coreImplementation ?? throw new ArgumentNullException(nameof(coreImplementation));
        RuleVersion = ruleVersion ?? throw new ArgumentNullException(nameof(ruleVersion));
        ContentVersion = contentVersion ?? throw new ArgumentNullException(nameof(contentVersion));

        if (CoreImplementation.ContractVersion != coreContractVersion)
        {
            throw new ArgumentException("Core implementation descriptor must match the evaluated Core contract version.", nameof(coreImplementation));
        }

        CorrelationId = correlationId;
        CoreContractVersion = coreContractVersion;
        EvaluatedAtUtc = evaluatedAtUtc;
    }

    public CommandExecutionIdentity Identity { get; }

    public CorrelationId CorrelationId { get; }

    public CoreImplementationDescriptor CoreImplementation { get; }

    public CoreContractVersion CoreContractVersion { get; }

    public RuleVersion RuleVersion { get; }

    public ContentVersion ContentVersion { get; }

    public DateTimeOffset EvaluatedAtUtc { get; }
}

/// <summary>
/// Authoritative event ready to be committed to immutable history and the durable outbox.
/// The typed Core descriptor remains the semantic payload; persistence serialization is an adapter concern.
/// </summary>
public sealed record AuthoritativeEventEnvelope
{
    public AuthoritativeEventEnvelope(EventMetadata metadata, ICoreEventDescriptor descriptor)
    {
        Metadata = metadata ?? throw new ArgumentNullException(nameof(metadata));
        Descriptor = descriptor ?? throw new ArgumentNullException(nameof(descriptor));

        if (Metadata.EventId.Value == Guid.Empty)
        {
            throw new ArgumentException("Authoritative events require a non-empty EventId.", nameof(metadata));
        }

        if (Metadata.CorrelationId.Value == Guid.Empty)
        {
            throw new ArgumentException("Authoritative events require a non-empty CorrelationId.", nameof(metadata));
        }

        if (Metadata.OccurredAtUtc.Offset != TimeSpan.Zero)
        {
            throw new ArgumentException("Authoritative event time must be UTC.", nameof(metadata));
        }

        if (Metadata.SchemaVersion <= 0)
        {
            throw new ArgumentOutOfRangeException(nameof(metadata), "Authoritative event schema version must be positive.");
        }

        if (Metadata.SchemaVersion != Descriptor.Contract.SchemaVersion)
        {
            throw new ArgumentException("Authoritative event metadata schema version must match the event descriptor contract.", nameof(metadata));
        }
    }

    public EventMetadata Metadata { get; }

    public ICoreEventDescriptor Descriptor { get; }
}

/// <summary>
/// Complete all-or-nothing commit request. The terminal outcome is only proposed until an
/// IAtomicCommandCommitter reports Committed.
/// </summary>
public sealed class CommandCommitPlan
{
    public CommandCommitPlan(
        CommandExecutionTrace trace,
        CommandExecutionToken executionToken,
        CommandTerminalOutcome terminalOutcome,
        IEnumerable<IOwnerTransition>? transitions,
        IEnumerable<AuthoritativeEventEnvelope>? events)
    {
        if (executionToken.IsEmpty)
        {
            throw new ArgumentException("Command commit plans require a non-empty execution token.", nameof(executionToken));
        }

        Trace = trace ?? throw new ArgumentNullException(nameof(trace));
        ExecutionToken = executionToken;
        TerminalOutcome = terminalOutcome ?? throw new ArgumentNullException(nameof(terminalOutcome));
        Transitions = Freeze(transitions, nameof(transitions));
        Events = Freeze(events, nameof(events));

        foreach (var transition in Transitions)
        {
            if (transition.TargetOwner is null)
            {
                throw new ArgumentException("Owner transitions must identify a target owner.", nameof(transitions));
            }
        }

        foreach (var eventEnvelope in Events)
        {
            if (eventEnvelope.Metadata.CorrelationId != Trace.CorrelationId)
            {
                throw new ArgumentException("All committed events must use the command's original CorrelationId.", nameof(events));
            }
        }
    }

    public CommandExecutionTrace Trace { get; }

    public CommandExecutionToken ExecutionToken { get; }

    public CommandTerminalOutcome TerminalOutcome { get; }

    public IReadOnlyList<IOwnerTransition> Transitions { get; }

    public IReadOnlyList<AuthoritativeEventEnvelope> Events { get; }

    private static IReadOnlyList<T> Freeze<T>(IEnumerable<T>? values, string parameterName)
        where T : class
    {
        var items = (values ?? Array.Empty<T>()).ToArray();

        if (items.Any(static item => item is null))
        {
            throw new ArgumentException("Command commit collections cannot contain null entries.", parameterName);
        }

        return Array.AsReadOnly(items);
    }
}

public enum CommandCommitDisposition
{
    Committed = 0,
    ConcurrencyConflict = 1,
    TechnicalFailure = 2
}

public sealed record CommandCommitResult
{
    private CommandCommitResult(CommandCommitDisposition disposition, CommandReasonCode? reason)
    {
        if (!Enum.IsDefined(typeof(CommandCommitDisposition), disposition))
        {
            throw new ArgumentOutOfRangeException(nameof(disposition));
        }

        if (disposition == CommandCommitDisposition.Committed && reason is not null)
        {
            throw new ArgumentException("Committed results cannot carry a failure reason.", nameof(reason));
        }

        if (disposition != CommandCommitDisposition.Committed && reason is null)
        {
            throw new ArgumentNullException(nameof(reason), "Failed commit results require an explicit reason.");
        }

        Disposition = disposition;
        Reason = reason;
    }

    public CommandCommitDisposition Disposition { get; }

    public CommandReasonCode? Reason { get; }

    public static CommandCommitResult Committed() => new(CommandCommitDisposition.Committed, null);

    public static CommandCommitResult ConcurrencyConflict(CommandReasonCode reason) =>
        new(CommandCommitDisposition.ConcurrencyConflict, reason ?? throw new ArgumentNullException(nameof(reason)));

    public static CommandCommitResult TechnicalFailure(CommandReasonCode reason) =>
        new(CommandCommitDisposition.TechnicalFailure, reason ?? throw new ArgumentNullException(nameof(reason)));
}

/// <summary>
/// Persistence boundary for one authoritative command. Implementations must verify that the
/// CommandId/identity/execution-token still own the durable receipt and then atomically commit:
/// all owner transitions, terminal command outcome, immutable authoritative events/history, and
/// durable outbox records for those events. Any failure before commit must leave all of those
/// effects uncommitted.
/// </summary>
public interface IAtomicCommandCommitter
{
    ValueTask<CommandCommitResult> CommitAsync(
        CommandCommitPlan plan,
        CancellationToken cancellationToken = default);
}
