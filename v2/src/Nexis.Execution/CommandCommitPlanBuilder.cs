using Nexis.Core.Contracts;
using Nexis.Execution.Contracts;
using Nexis.Kernel.Events;

namespace Nexis.Execution;

/// <summary>
/// Converts one Core decision into the immutable all-or-nothing persistence plan. It does not
/// perform persistence and cannot turn a proposed Core success into a durable command success.
/// </summary>
public sealed class CommandCommitPlanBuilder
{
    public CommandCommitPlan Build(
        CoreEvaluationRequest request,
        CommandPayloadFingerprint payloadFingerprint,
        CommandReceiptClaim receiptClaim,
        CoreDecision decision,
        CoreImplementationDescriptor coreImplementation,
        DateTimeOffset completedAtUtc)
    {
        ArgumentNullException.ThrowIfNull(request);
        ArgumentNullException.ThrowIfNull(payloadFingerprint);
        ArgumentNullException.ThrowIfNull(receiptClaim);
        ArgumentNullException.ThrowIfNull(decision);
        ArgumentNullException.ThrowIfNull(coreImplementation);

        if (receiptClaim.Disposition != CommandReceiptDisposition.Acquired || !receiptClaim.ExecutionToken.HasValue)
        {
            throw new InvalidOperationException("Only the active acquired command execution may build a commit plan.");
        }

        if (completedAtUtc.Offset != TimeSpan.Zero)
        {
            throw new ArgumentException("Command completion time must be UTC.", nameof(completedAtUtc));
        }

        if (coreImplementation.ContractVersion != request.ContractVersion)
        {
            throw new ArgumentException("Core implementation descriptor does not match the evaluated contract version.", nameof(coreImplementation));
        }

        var identity = CommandExecutionIdentityFactory.Create(request, payloadFingerprint);
        var trace = new CommandExecutionTrace(
            identity,
            receiptClaim.OriginalCorrelationId,
            coreImplementation,
            request.ContractVersion,
            request.Context.RuleVersion,
            request.Context.ContentVersion,
            request.Context.EvaluationTimeUtc);

        var terminalOutcome = MapTerminalOutcome(decision, completedAtUtc);
        var eventEnvelopes = decision.Events
            .Select(descriptor => new AuthoritativeEventEnvelope(
                new EventMetadata(
                    EventId.New(),
                    request.Context.EvaluationTimeUtc,
                    receiptClaim.OriginalCorrelationId,
                    null,
                    descriptor.Contract.SchemaVersion),
                descriptor))
            .ToArray();

        return new CommandCommitPlan(
            trace,
            receiptClaim.ExecutionToken.Value,
            terminalOutcome,
            decision.Transitions,
            eventEnvelopes);
    }

    private static CommandTerminalOutcome MapTerminalOutcome(
        CoreDecision decision,
        DateTimeOffset completedAtUtc)
    {
        if (decision.Status == CoreOutcomeStatus.Succeeded)
        {
            return CommandTerminalOutcome.Succeeded(completedAtUtc);
        }

        var terminalStatus = decision.Status switch
        {
            CoreOutcomeStatus.Rejected => CommandTerminalStatus.Rejected,
            CoreOutcomeStatus.Conflict => CommandTerminalStatus.Conflict,
            CoreOutcomeStatus.Cancelled => CommandTerminalStatus.Cancelled,
            CoreOutcomeStatus.DomainFailed => CommandTerminalStatus.DomainFailed,
            CoreOutcomeStatus.TechnicalFailure => CommandTerminalStatus.TechnicalFailure,
            _ => throw new ArgumentOutOfRangeException(nameof(decision), "Unknown Core outcome status.")
        };

        var reason = decision.Reason
            ?? throw new InvalidOperationException("Non-success Core decisions require a reason before terminal persistence.");

        return CommandTerminalOutcome.Failed(
            terminalStatus,
            new CommandReasonCode(reason.Value),
            completedAtUtc);
    }
}
