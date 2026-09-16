using Microsoft.VisualStudio.TestTools.UnitTesting;
using Nexis.Core;
using Nexis.Core.Contracts;
using Nexis.Identity.Contracts;
using Nexis.Kernel.Commands;
using Nexis.Kernel.Events;
using Nexis.Kernel.Randomness;
using Nexis.Npcs.Contracts;

namespace Nexis.Architecture.Tests;

[TestClass]
public sealed partial class NpcLifecycleVerticalTests
{
    private static readonly DateTimeOffset Now =
        new(2026, 9, 16, 12, 0, 0, TimeSpan.Zero);

    [TestMethod]
    public void EstablishLifecycle_SystemActorCreatesLivingOwnerTransitionAndEvent()
    {
        var id = NpcId.New();
        var birth = Now.AddYears(-30);
        var decision = Evaluate(id, birth, TrustedActorContext.CreateSystem(new SystemActorKey("nexis.scheduler")));

        Assert.AreEqual(CoreOutcomeStatus.Succeeded, decision.Status);
        Assert.AreEqual(1, decision.Transitions.Count);
        var transition = (CreateNpcLifecycleTransition)decision.Transitions[0];
        Assert.AreEqual(NpcLifecycleSnapshot.OwnerKey, transition.TargetOwner);
        Assert.IsNull(transition.ExpectedRevision);
        Assert.AreEqual(id, transition.NpcId);
        Assert.AreEqual(birth, transition.BirthInstantUtc);

        Assert.AreEqual(1, decision.Events.Count);
        Assert.IsInstanceOfType<NpcLifecycleEstablishedEvent>(decision.Events[0]);
    }

    [TestMethod]
    public void EstablishLifecycle_PlayerActorCannotMintNpcIdentity()
    {
        var decision = Evaluate(
            NpcId.New(),
            Now.AddYears(-20),
            TrustedActorContext.CreatePlayer(AccountId.New(), CharacterId.New(), 1));

        Assert.AreEqual(CoreOutcomeStatus.Rejected, decision.Status);
        Assert.AreEqual("npcs.actor.system_required", decision.Reason?.Value);
        Assert.AreEqual(0, decision.Transitions.Count);
    }

    [TestMethod]
    public void EstablishLifecycle_RejectsFutureBirth()
    {
        var decision = Evaluate(
            NpcId.New(),
            Now.AddTicks(1),
            TrustedActorContext.CreateSystem(new SystemActorKey("nexis.scheduler")));

        Assert.AreEqual(CoreOutcomeStatus.Rejected, decision.Status);
        Assert.AreEqual("npcs.birth.future", decision.Reason?.Value);
    }

    [TestMethod]
    public void EstablishLifecycle_RejectsAlreadyExistingNpc()
    {
        var id = NpcId.New();
        var birth = Now.AddYears(-45);
        var decision = Evaluate(
            id,
            birth,
            TrustedActorContext.CreateSystem(new SystemActorKey("nexis.scheduler")),
            new NpcLifecycleSnapshot(id, 4, birth, NpcLifecycleStatus.Living));

        Assert.AreEqual(CoreOutcomeStatus.Rejected, decision.Status);
        Assert.AreEqual("npcs.lifecycle.already_exists", decision.Reason?.Value);
        Assert.AreEqual(0, decision.Transitions.Count);
    }

    [TestMethod]
    public void EstablishLifecycle_ReevaluationIsDeterministic()
    {
        var id = NpcId.New();
        var birth = Now.AddYears(-18);
        var actor = TrustedActorContext.CreateSystem(new SystemActorKey("nexis.scheduler"));

        var first = Evaluate(id, birth, actor);
        var second = Evaluate(id, birth, actor);

        Assert.AreEqual(first.Status, second.Status);
        CollectionAssert.AreEqual(first.Transitions.ToArray(), second.Transitions.ToArray());
        CollectionAssert.AreEqual(first.Events.ToArray(), second.Events.ToArray());
    }

    private static CoreDecision Evaluate(
        NpcId id,
        DateTimeOffset birth,
        TrustedActorContext actor,
        params IAuthoritativeSnapshot[] snapshots)
    {
        var request = new CoreEvaluationRequest(
            CoreContractVersion.V1,
            new CoreEvaluationContext(
                CommandId.New(),
                CorrelationId.New(),
                actor,
                Now,
                new RuleVersion("npc-lifecycle-rules-v1"),
                new ContentVersion("npc-lifecycle-content-v1"),
                new FixedRandomFactory()),
            new EstablishNpcLifecycleIntent(id, birth),
            snapshots);

        return new CoreRulesEngine().Evaluate(request);
    }

    private sealed class FixedRandomFactory : IDeterministicRandomFactory
    {
        public IDeterministicRandomSource Create() => new FixedRandomSource();

        private sealed class FixedRandomSource : IDeterministicRandomSource
        {
            public ulong NextUInt64() => 1;
        }
    }
}
