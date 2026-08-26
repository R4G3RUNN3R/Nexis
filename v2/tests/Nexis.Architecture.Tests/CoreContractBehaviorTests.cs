using Nexis.Core;
using Nexis.Core.Contracts;
using Nexis.Kernel.Commands;
using Nexis.Kernel.Events;
using Nexis.Kernel.Randomness;

namespace Nexis.Architecture.Tests;

[TestClass]
public sealed class CoreContractBehaviorTests
{
    [TestMethod]
    public void EvaluationContext_RejectsNonUtcAuthoritativeTime()
    {
        var localOffset = new DateTimeOffset(2026, 8, 26, 8, 0, 0, TimeSpan.FromHours(1));

        Assert.ThrowsException<ArgumentException>(() => new CoreEvaluationContext(
            CommandId.New(),
            CorrelationId.New(),
            localOffset,
            new RuleVersion("test-rules-v1"),
            new ContentVersion("test-content-v1"),
            new SequenceRandomSource(1)));
    }

    [TestMethod]
    public void RejectedDecision_CannotCarryOwnerTransitions()
    {
        var decision = CoreDecision.Rejected(new CoreReasonCode("test.rejected"));

        Assert.AreEqual(CoreOutcomeStatus.Rejected, decision.Status);
        Assert.AreEqual(0, decision.Transitions.Count);
        Assert.AreEqual(0, decision.Events.Count);
        Assert.IsNull(decision.Payload);
    }

    [TestMethod]
    public void DomainFailure_MayCarryCommittedGameplayConsequences()
    {
        var transition = new SyntheticTransition();
        var domainEvent = new SyntheticEvent();

        var decision = CoreDecision.DomainFailed(
            new CoreReasonCode("test.in_world_failure"),
            transitions: new[] { transition },
            events: new[] { domainEvent });

        Assert.AreEqual(CoreOutcomeStatus.DomainFailed, decision.Status);
        Assert.AreEqual(1, decision.Transitions.Count);
        Assert.AreSame(transition, decision.Transitions[0]);
        Assert.AreEqual(1, decision.Events.Count);
        Assert.AreSame(domainEvent, decision.Events[0]);
    }

    [TestMethod]
    public void ReferenceCore_UnsupportedIntentFailsWithoutMutation()
    {
        var engine = new CoreRulesEngine();
        var request = new CoreEvaluationRequest(
            CoreContractVersion.V1,
            CreateContext(),
            new SyntheticIntent(),
            Array.Empty<IAuthoritativeSnapshot>());

        var decision = engine.Evaluate(request);

        Assert.AreEqual(CoreOutcomeStatus.TechnicalFailure, decision.Status);
        Assert.AreEqual("core.intent.unsupported", decision.Reason?.Value);
        Assert.AreEqual(0, decision.Transitions.Count);
        Assert.AreEqual(0, decision.Events.Count);
    }

    private static CoreEvaluationContext CreateContext() => new(
        CommandId.New(),
        CorrelationId.New(),
        new DateTimeOffset(2026, 8, 26, 7, 0, 0, TimeSpan.Zero),
        new RuleVersion("test-rules-v1"),
        new ContentVersion("test-content-v1"),
        new SequenceRandomSource(1, 2, 3));

    private sealed class SequenceRandomSource(params ulong[] values) : IDeterministicRandomSource
    {
        private readonly Queue<ulong> _values = new(values);

        public ulong NextUInt64() =>
            _values.Count > 0
                ? _values.Dequeue()
                : throw new InvalidOperationException("The deterministic test RNG was exhausted.");
    }

    private sealed record SyntheticIntent : ICoreIntent
    {
        public ContractDescriptor Contract { get; } = new("tests.synthetic.intent", 1);
    }

    private sealed record SyntheticTransition : IOwnerTransition
    {
        public ContractDescriptor Contract { get; } = new("tests.synthetic.transition", 1);

        public OwnerKey TargetOwner { get; } = new("Tests");

        public long? ExpectedRevision => 1;
    }

    private sealed record SyntheticEvent : ICoreEventDescriptor
    {
        public ContractDescriptor Contract { get; } = new("tests.synthetic.event", 1);
    }
}
