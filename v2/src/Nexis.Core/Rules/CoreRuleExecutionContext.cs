using Nexis.Core.Contracts;
using Nexis.Kernel.Commands;
using Nexis.Kernel.Events;
using Nexis.Kernel.Randomness;

namespace Nexis.Core.Rules;

/// <summary>
/// Concrete-Core execution context for one rule evaluation. This is intentionally internal so
/// surrounding systems cannot depend on the selected Core implementation's evaluator machinery.
/// </summary>
internal sealed class CoreRuleExecutionContext
{
    internal CoreRuleExecutionContext(
        CoreEvaluationRequest request,
        IDeterministicRandomSource random)
    {
        ArgumentNullException.ThrowIfNull(request);

        CommandId = request.Context.CommandId;
        CorrelationId = request.Context.CorrelationId;
        EvaluationTimeUtc = request.Context.EvaluationTimeUtc;
        RuleVersion = request.Context.RuleVersion;
        ContentVersion = request.Context.ContentVersion;
        Intent = request.Intent;
        Snapshots = request.Snapshots;
        Content = request.Content;
        Random = random ?? throw new ArgumentNullException(nameof(random));
    }

    public CommandId CommandId { get; }

    public CorrelationId CorrelationId { get; }

    public DateTimeOffset EvaluationTimeUtc { get; }

    public RuleVersion RuleVersion { get; }

    public ContentVersion ContentVersion { get; }

    public ICoreIntent Intent { get; }

    public IReadOnlyList<IAuthoritativeSnapshot> Snapshots { get; }

    public IReadOnlyList<ICoreContentInput> Content { get; }

    /// <summary>
    /// One deterministic stream for this top-level evaluation. Evaluators cannot create competing
    /// cursors from the factory or advance a stream retained by a previous evaluation.
    /// </summary>
    public IDeterministicRandomSource Random { get; }
}
