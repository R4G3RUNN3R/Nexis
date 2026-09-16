using Nexis.Core.Contracts;
using Nexis.Identity.Contracts;
using Nexis.Kernel.Commands;
using Nexis.Npcs.Contracts;

namespace Nexis.Core.Rules.Npcs;

internal sealed class EstablishNpcLifecycleRuleEvaluator : ICoreRuleEvaluator
{
    private static readonly CoreReasonCode SystemActorRequired = new("npcs.actor.system_required");
    private static readonly CoreReasonCode FutureBirth = new("npcs.birth.future");
    private static readonly CoreReasonCode AlreadyExists = new("npcs.lifecycle.already_exists");
    private static readonly CoreReasonCode AmbiguousSnapshot = new("npcs.snapshot.lifecycle_ambiguous");

    public ContractDescriptor IntentContract => EstablishNpcLifecycleIntent.IntentContract;

    public CoreDecision Evaluate(CoreRuleExecutionContext context)
    {
        ArgumentNullException.ThrowIfNull(context);

        if (context.Intent is not EstablishNpcLifecycleIntent intent)
        {
            throw new InvalidOperationException("NPC lifecycle evaluator received a different intent type.");
        }

        if (context.Actor.Kind != ActorKind.System || context.Actor.Lane != CommandExecutionLane.System)
        {
            return CoreDecision.Rejected(SystemActorRequired);
        }

        if (intent.BirthInstantUtc > context.EvaluationTimeUtc)
        {
            return CoreDecision.Rejected(FutureBirth);
        }

        var existing = context.Snapshots
            .OfType<NpcLifecycleSnapshot>()
            .Where(snapshot => snapshot.NpcId == intent.NpcId)
            .ToArray();

        if (existing.Length > 1)
        {
            return CoreDecision.TechnicalFailure(AmbiguousSnapshot);
        }

        if (existing.Length == 1)
        {
            return CoreDecision.Rejected(AlreadyExists);
        }

        return CoreDecision.Succeeded(
            transitions:
            [
                new CreateNpcLifecycleTransition(intent.NpcId, intent.BirthInstantUtc)
            ],
            events:
            [
                new NpcLifecycleEstablishedEvent(intent.NpcId, intent.BirthInstantUtc)
            ]);
    }
}
