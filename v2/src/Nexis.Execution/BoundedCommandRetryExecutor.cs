using Nexis.Execution.Contracts;

namespace Nexis.Execution;

/// <summary>
/// Reruns the complete supplied authoritative command attempt only for failures explicitly
/// classified as transient/retryable. The callback must represent the whole attempt: reload current
/// state, revalidate authority/prerequisites, re-evaluate Core as required, then attempt commit.
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
        ArgumentNullException.ThrowIfNull(wholeCommandAttempt);

        for (var attemptNumber = 1; attemptNumber <= _maximumAttempts; attemptNumber++)
        {
            cancellationToken.ThrowIfCancellationRequested();

            try
            {
                return await wholeCommandAttempt(attemptNumber, cancellationToken).ConfigureAwait(false);
            }
            catch (OperationCanceledException) when (cancellationToken.IsCancellationRequested)
            {
                throw;
            }
            catch (Exception exception) when (
                attemptNumber < _maximumAttempts &&
                _failureClassifier.IsRetryable(exception))
            {
                // Retry by invoking the complete command attempt again. Never resume from a partial
                // in-memory transition plan or reuse stale snapshots from the failed attempt.
            }
        }

        throw new InvalidOperationException("Bounded retry executor reached an impossible terminal state.");
    }
}
