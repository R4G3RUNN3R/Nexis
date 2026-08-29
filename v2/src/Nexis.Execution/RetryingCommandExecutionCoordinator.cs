using Nexis.Core.Contracts;
using Nexis.Execution.Contracts;

namespace Nexis.Execution;

public sealed record RetryingCommandExecutionResult(
    CommandReceiptClaim ReceiptClaim,
    CommandCommitResult? CommitResult);

/// <summary>
/// Composes durable receipt acquisition with bounded post-acquisition retry. A command receipt is
/// acquired exactly once; every retry rebuilds a fresh plan while retaining that claim's execution
/// token. Lease renewal fences every subsequent attempt.
/// </summary>
public sealed class RetryingCommandExecutionCoordinator
{
    private static readonly CommandReasonCode ReceiptOwnershipLost = new("execution.receipt.ownership_lost");

    private readonly CommandReceiptCoordinator _receiptCoordinator;
    private readonly BoundedCommandRetryExecutor _retryExecutor;
    private readonly ICommandExecutionRecoveryRepository _recoveryRepository;
    private readonly CommandCommitCoordinator _commitCoordinator;
    private readonly TimeProvider _timeProvider;

    public RetryingCommandExecutionCoordinator(
        CommandReceiptCoordinator receiptCoordinator,
        BoundedCommandRetryExecutor retryExecutor,
        ICommandExecutionRecoveryRepository recoveryRepository,
        CommandCommitCoordinator commitCoordinator,
        TimeProvider? timeProvider = null)
    {
        _receiptCoordinator = receiptCoordinator ?? throw new ArgumentNullException(nameof(receiptCoordinator));
        _retryExecutor = retryExecutor ?? throw new ArgumentNullException(nameof(retryExecutor));
        _recoveryRepository = recoveryRepository ?? throw new ArgumentNullException(nameof(recoveryRepository));
        _commitCoordinator = commitCoordinator ?? throw new ArgumentNullException(nameof(commitCoordinator));
        _timeProvider = timeProvider ?? TimeProvider.System;
    }

    public async ValueTask<RetryingCommandExecutionResult> ExecuteAsync(
        CoreEvaluationRequest request,
        CanonicalCommandPayload payload,
        CommandExecutionLeaseRequest executionLease,
        DateTimeOffset receivedAtUtc,
        Func<CommandReceiptClaim, int, CancellationToken, ValueTask<CommandCommitPlan>> buildAttempt,
        Func<CommandReceiptClaim, Exception, CancellationToken, ValueTask<CommandCommitPlan>> buildRetryExhausted,
        CancellationToken cancellationToken = default)
    {
        ArgumentNullException.ThrowIfNull(request);
        ArgumentNullException.ThrowIfNull(payload);
        ArgumentNullException.ThrowIfNull(executionLease);
        ArgumentNullException.ThrowIfNull(buildAttempt);
        ArgumentNullException.ThrowIfNull(buildRetryExhausted);

        var claim = await _receiptCoordinator.AcquireAsync(
            request,
            payload,
            executionLease,
            receivedAtUtc,
            cancellationToken).ConfigureAwait(false);

        if (claim.Disposition != CommandReceiptDisposition.Acquired || !claim.ExecutionToken.HasValue)
        {
            return new RetryingCommandExecutionResult(claim, null);
        }

        try
        {
            var commitResult = await _retryExecutor.ExecuteAsync(
                async (attemptNumber, token) =>
                {
                    var plan = await buildAttempt(claim, attemptNumber, token).ConfigureAwait(false);
                    ValidatePlanOwnsClaim(plan, request, claim);
                    return await _commitCoordinator.CommitAsync(plan, token).ConfigureAwait(false);
                },
                (_, _, token) => _recoveryRepository.RenewLeaseAsync(
                    request.Context.CommandId,
                    claim.ExecutionToken.Value,
                    executionLease,
                    _timeProvider.GetUtcNow(),
                    token),
                async (_, exception, token) =>
                {
                    var plan = await buildRetryExhausted(claim, exception, token).ConfigureAwait(false);
                    ValidatePlanOwnsClaim(plan, request, claim);
                    ValidateRetryExhaustionPlan(plan);
                    return await _commitCoordinator.CommitAsync(plan, token).ConfigureAwait(false);
                },
                cancellationToken).ConfigureAwait(false);

            return new RetryingCommandExecutionResult(claim, commitResult);
        }
        catch (CommandRetryLeaseLostException)
        {
            return new RetryingCommandExecutionResult(
                claim,
                CommandCommitResult.TechnicalFailure(ReceiptOwnershipLost));
        }
    }

    private static void ValidatePlanOwnsClaim(
        CommandCommitPlan plan,
        CoreEvaluationRequest request,
        CommandReceiptClaim claim)
    {
        ArgumentNullException.ThrowIfNull(plan);
        if (plan.Trace.Identity.CommandId != request.Context.CommandId ||
            plan.ExecutionToken != claim.ExecutionToken ||
            plan.Trace.CorrelationId != claim.OriginalCorrelationId)
        {
            throw new InvalidOperationException("Every retry plan must retain the acquired receipt identity, correlation and execution token.");
        }
    }

    private static void ValidateRetryExhaustionPlan(CommandCommitPlan plan)
    {
        if (plan.TerminalOutcome.Status != CommandTerminalStatus.TechnicalFailure ||
            plan.Transitions.Count != 0 ||
            plan.Events.Count != 0)
        {
            throw new InvalidOperationException("Retry exhaustion must terminalize as TechnicalFailure without owner transitions or authoritative events.");
        }
    }
}
