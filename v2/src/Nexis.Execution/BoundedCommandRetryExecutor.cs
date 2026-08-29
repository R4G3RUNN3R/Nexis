using Nexis.Execution.Contracts;

namespace Nexis.Execution;

/// <summary>
/// Reruns the post-receipt authoritative command attempt only for failures explicitly classified
/// as transient/retryable. Receipt acquisition is outside this boundary. Each callback must reload
/// current state, revalidate authority/prerequisites, re-evaluate Core and attempt commit while
/// retaining the same acquired receipt token.
/// </summary>
public sealed class BoundedCommandRetryExecutor
{
    private readonly ITransientCommandFailureClassifier _failureClassifier;
    private readonly int _maximumAttempts;

    public BoundedCommandRetryExecutor(
        ITransientCommandFailureClassifier failureClassifier,
        int maximumAttempts)
    {
        _failureClassifier = failureClassifier ?? throw new ArgumentNullException(nameof(failureClassifier));

        if (maximumAttempts <= 0)
        {
            throw new ArgumentOutOfRangeException(nameof(maximumAttempts), "Maximum attempts must be positive.");
        }

        _maximumAttempts = maximumAttempts;
    }

    public async ValueTask<T> ExecuteAsync<T>(
        Func<int, CancellationToken, ValueTask<T>> wholeCommandAttempt,
        CancellationToken cancellationToken = default)
    {
        return await ExecuteAsync(
            wholeCommandAttempt,
            static (_, _, _) => ValueTask.FromResult(true),
            static (_, exception, _) => ValueTask.FromException<T>(exception),
            cancellationToken).ConfigureAwait(false);
    }

    public async ValueTask<T> ExecuteAsync<T>(
        Func<int, CancellationToken, ValueTask<T>> postReceiptAttempt,
        Func<int, Exception, CancellationToken, ValueTask<bool>> renewLeaseBeforeRetry,
        Func<int, Exception, CancellationToken, ValueTask<T>> retryExhausted,
        CancellationToken cancellationToken = default)
    {
        ArgumentNullException.ThrowIfNull(postReceiptAttempt);
        ArgumentNullException.ThrowIfNull(renewLeaseBeforeRetry);
        ArgumentNullException.ThrowIfNull(retryExhausted);

        for (var attemptNumber = 1; attemptNumber <= _maximumAttempts; attemptNumber++)
        {
            cancellationToken.ThrowIfCancellationRequested();

            try
            {
                return await postReceiptAttempt(attemptNumber, cancellationToken).ConfigureAwait(false);
            }
            catch (OperationCanceledException) when (cancellationToken.IsCancellationRequested)
            {
                throw;
            }
            catch (Exception exception) when (_failureClassifier.IsRetryable(exception))
            {
                if (attemptNumber == _maximumAttempts)
                {
                    return await retryExhausted(attemptNumber, exception, cancellationToken).ConfigureAwait(false);
                }

                if (!await renewLeaseBeforeRetry(attemptNumber, exception, cancellationToken).ConfigureAwait(false))
                {
                    throw new CommandRetryLeaseLostException(attemptNumber, exception);
                }
            }
        }

        throw new InvalidOperationException("Bounded retry executor reached an impossible terminal state.");
    }
}

public sealed class CommandRetryLeaseLostException : Exception
{
    public CommandRetryLeaseLostException(int completedAttempts, Exception transientFailure)
        : base("The command receipt lease or execution fence moved before a retry could begin.", transientFailure)
    {
        if (completedAttempts <= 0)
        {
            throw new ArgumentOutOfRangeException(nameof(completedAttempts));
        }

        CompletedAttempts = completedAttempts;
    }

    public int CompletedAttempts { get; }
}
