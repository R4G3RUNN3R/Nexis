using Microsoft.VisualStudio.TestTools.UnitTesting;
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
            new SequenceRandomFactory(1)));
    }

    [TestMethod]
    public void EvaluationRequest_RejectsInvalidDefaultContractVersion()
    {
        Assert.ThrowsException<ArgumentOutOfRangeException>(() => new CoreEvaluationRequest(
            default,
            CreateContext(),
            new SyntheticIntent(),
            Array.Empty<IAuthoritativeSnapshot>()));
    }

    [TestMethod]
    public void EvaluationRequest_FreezesSnapshotsAndContentInputs()
    {
        var snapshots = new List<IAuthoritativeSnapshot> { new SyntheticSnapshot() };
        var content = new List<ICoreContentInput> { new SyntheticContent() };

        var request = new CoreEvaluationRequest(
            CoreContractVersion.V1,
            CreateContext(),
            new SyntheticIntent(),
            snapshots,
            content);

        snapshots.Clear();
        content.Clear();

        Assert.AreEqual(1, request.Snapshots.Count);
        Assert.AreEqual(1, request.Content.Count);
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
        new SequenceRandomFactory(1, 2, 3));

    private sealed class SequenceRandomFactory : IDeterministicRandomFactory
    {
        private readonly ulong[] _values;

        public SequenceRandomFactory(params ulong[] values)
        {
            _values = (ulong[])values.Clone();
        }

        public IDeterministicRandomSource Create() => new SequenceRandomSource(_values);

        private sealed class SequenceRandomSource : IDeterministicRandomSource
        {
            private readonly ulong[] _values;
            private int _index;

            public SequenceRandomSource(ulong[] values)
            {
                _values = values;
            }

            public ulong NextUInt64()
            {
                if (_index >= _values.Length)
                {
                    throw new InvalidOperationException("The deterministic test RNG was exhausted.");
                }

                return _values[_index++];
            }
        }
    }

    private sealed record SyntheticIntent : ICoreIntent
    {
        public ContractDescriptor Contract { get; } = new("tests.synthetic.intent", 1);
    }

    private sealed record SyntheticSnapshot : IAuthoritativeSnapshot
    {
        public ContractDescriptor Contract { get; } = new("tests.synthetic.snapshot", 1);

        public OwnerKey Owner { get; } = new("Tests");

        public long Revision => 1;
    }

    private sealed record SyntheticContent : ICoreContentInput
    {
        public ContractDescriptor Contract { get; } = new("tests.synthetic.content", 1);
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
