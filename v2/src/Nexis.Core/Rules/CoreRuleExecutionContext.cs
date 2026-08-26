using Nexis.Core.Contracts;
using Nexis.Identity.Contracts;
using Nexis.Kernel.Commands;
using Nexis.Kernel.Events;
using Nexis.Kernel.Randomness;

namespace Nexis.Core.Rules;

internal sealed class CoreRuleExecutionContext
{
    internal CoreRuleExecutionContext(
        CoreEvaluationRequest request,
        IDeterministicRandomSource random)
    {
        ArgumentNullException.ThrowIfNull(request);

        CommandId = request.Context.CommandId;
        CorrelationId = request.Context.CorrelationId;
        Actor = request.Context.Actor;
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

    public TrustedActorContext Actor { get; }

    public DateTimeOffset EvaluationTimeUtc { get; }

    public RuleVersion RuleVersion { get; }

    public ContentVersion ContentVersion { get; }

    public ICoreIntent Intent { get; }

    public IReadOnlyList<IAuthoritativeSnapshot> Snapshots { get; }

    public IReadOnlyList<ICoreContentInput> Content { get; }

    public IDeterministicRandomSource Random { get; }
}
