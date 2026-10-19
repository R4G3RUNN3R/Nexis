using Nexis.Core.Contracts;
using Nexis.Execution.Contracts;
using Nexis.Operations.Contracts;

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

    private static readonly OperationalComponentKey OperationalComponent = new("execution.command-retry");
    private static readonly OperationalReasonCode RetryExhaustedReason = new("execution.retry_exhausted");
    private static readonly OperationalReasonCode PlanIdentityMismatchReason =
        new("execution.retry_plan_receipt_identity_mismatch");
    private static readonly OperationalReasonCode ExhaustionPlanInvalidReason =
        new("execution.retry_exhaustion_plan_invalid");

    private readonly CommandReceiptCoordinator _receiptCoordinator;
    private readonly BoundedCommandRetryExecutor _retryExecutor;
    private readonly ICommandExecutionRecoveryRepository _recoveryRepository;
    private readonly CommandCommitCoordinator _commitCoordinator;
    private readonly TimeProvider _timeProvider;
    private readonly IOperationalSignalSink? _operationalSignalSink;

    public RetryingCommandExecutionCoordinator(
        CommandReceiptCoordinator receiptCoordinator,
        BoundedCommandRetryExecutor retryExecutor,
        ICommandExecutionRecoveryRepository recoveryRepository,
        CommandCommitCoordinator commitCoordinator,
        TimeProvider? timeProvider = null,
        IOperationalSignalSink? operationalSignalSink = null)
    {
        _receiptCoordinator = receiptCoordinator ?? throw new ArgumentNullException(nameof(receiptCoordinator));
        _retryExecutor = retryExecutor ?? throw new ArgumentNullException(nameof(retryExecutor));
        _recoveryRepository = recoveryRepository ?? throw new ArgumentNullException(nameof(recoveryRepository));
        _commitCoordinator = commitCoordinator ?? throw new ArgumentNullException(nameof(commitCoordinator));
        _timeProvider = timeProvider ?? TimeProvider.System;
        _operationalSignalSink = operationalSignalSink;
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
                    await ValidatePlanOwnsClaimAsync(plan, request, claim, attemptNumber).ConfigureAwait(false);
                    return await _commitCoordinator.CommitAsync(plan, token).ConfigureAwait(false);
                },
                (_, _, token) => _recoveryRepository.RenewLeaseAsync(
                    request.Context.CommandId,
                    claim.ExecutionToken.Value,
                    executionLease,
                    _timeProvider.GetUtcNow(),
                    token),
                async (attemptNumber, exception, token) =>
                {
                    var plan = await buildRetryExhausted(claim, exception, token).ConfigureAwait(false);
                    await ValidatePlanOwnsClaimAsync(plan, request, claim, attemptNumber).ConfigureAwait(false);
                    await ValidateRetryExhaustionPlanAsync(plan, request, claim, attemptNumber).ConfigureAwait(false);
                    var exhaustedResult = await _commitCoordinator.CommitAsync(plan, token).ConfigureAwait(false);

                    // The bounded executor has already classified every attempt as retryable and spent
                    // the last one, and the TechnicalFailure terminal outcome has now been durably
                    // attempted, so this reports a settled fact rather than predicting one. Lease loss
                    // is deliberately not reported here: the retry bound was not reached, and the
                    // recovery repository that owns the fence already reports that condition.
                    await ReportBestEffortAsync(
                        OperationalConditionKind.RetryExhausted,
                        OperationalSeverity.Error,
                        RetryExhaustedReason,
                        request,
                        claim,
                        attemptNumber).ConfigureAwait(false);
                    return exhaustedResult;
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

    private async ValueTask ValidatePlanOwnsClaimAsync(
        CommandCommitPlan plan,
        CoreEvaluationRequest request,
        CommandReceiptClaim claim,
        int attemptNumber)
    {
        ArgumentNullException.ThrowIfNull(plan);
        if (plan.Trace.Identity.CommandId != request.Context.CommandId ||
            plan.ExecutionToken != claim.ExecutionToken ||
            plan.Trace.CorrelationId != claim.OriginalCorrelationId)
        {
            // Classification is complete and the plan is about to be refused. Reporting before the
            // throw cannot alter the refusal: an unowned plan never reaches the committer either way.
            await ReportBestEffortAsync(
                OperationalConditionKind.InvariantViolation,
                OperationalSeverity.Critical,
                PlanIdentityMismatchReason,
                request,
                claim,
                attemptNumber).ConfigureAwait(false);
            throw new InvalidOperationException("Every retry plan must retain the acquired receipt identity, correlation and execution token.");
        }
    }

    private async ValueTask ValidateRetryExhaustionPlanAsync(
        CommandCommitPlan plan,
        CoreEvaluationRequest request,
        CommandReceiptClaim claim,
        int attemptNumber)
    {
        if (plan.TerminalOutcome.Status != CommandTerminalStatus.TechnicalFailure ||
            plan.Transitions.Count != 0 ||
            plan.Events.Count != 0)
        {
            await ReportBestEffortAsync(
                OperationalConditionKind.InvariantViolation,
                OperationalSeverity.Critical,
                ExhaustionPlanInvalidReason,
                request,
                claim,
                attemptNumber).ConfigureAwait(false);
            throw new InvalidOperationException("Retry exhaustion must terminalize as TechnicalFailure without owner transitions or authoritative events.");
        }
    }

    /// <summary>
    /// Diagnostics are never authoritative here. A missing, slow or throwing sink cannot change the
    /// terminal command outcome, the receipt fence, the retry bound or the rethrown invariant failure.
    /// </summary>
    private async ValueTask ReportBestEffortAsync(
        OperationalConditionKind kind,
        OperationalSeverity severity,
        OperationalReasonCode reason,
        CoreEvaluationRequest request,
        CommandReceiptClaim claim,
        int attemptNumber)
    {
        if (_operationalSignalSink is null)
        {
            return;
        }

        try
        {
            await _operationalSignalSink.ReportAsync(
                new OperationalSignal(
                    kind,
                    severity,
                    OperationalComponent,
                    reason,
                    _timeProvider.GetUtcNow(),
                    request.Context.CommandId,
                    claim.OriginalCorrelationId,
                    attemptCount: attemptNumber),
                CancellationToken.None).ConfigureAwait(false);
        }
        catch (Exception)
        {
            // Observability must not convert a monitoring outage into a command failure, and must not
            // suppress or replace the authoritative failure being reported.
        }
    }
}
