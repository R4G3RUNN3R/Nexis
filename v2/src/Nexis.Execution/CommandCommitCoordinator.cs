using Nexis.Execution.Contracts;

namespace Nexis.Execution;

/// <summary>
/// Application-facing commit boundary. The concrete persistence implementation receives the whole
/// plan at once; callers are never given separate owner/outcome/event/outbox commit methods.
/// </summary>
public sealed class CommandCommitCoordinator
{
    private readonly IAtomicCommandCommitter _committer;

    public CommandCommitCoordinator(IAtomicCommandCommitter committer)
    {
        _committer = committer ?? throw new ArgumentNullException(nameof(committer));
    }

    public ValueTask<CommandCommitResult> CommitAsync(
        CommandCommitPlan plan,
        CancellationToken cancellationToken = default)
    {
        ArgumentNullException.ThrowIfNull(plan);
        return _committer.CommitAsync(plan, cancellationToken);
    }
}
