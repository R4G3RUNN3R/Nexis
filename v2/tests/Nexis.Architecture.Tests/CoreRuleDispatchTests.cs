using Microsoft.VisualStudio.TestTools.UnitTesting;
using Nexis.Core;
using Nexis.Core.Contracts;
using Nexis.Core.Rules;
using Nexis.Kernel.Commands;
using Nexis.Kernel.Events;
using Nexis.Kernel.Randomness;

namespace Nexis.Architecture.Tests;

[TestClass]
public sealed class CoreRuleDispatchTests
{
    private static readonly ContractDescriptor ProbeContract = new("tests.dispatch.probe", 1);

    [TestMethod]
    public void RegisteredEvaluator_IsDispatchedByIntentContract()
    {
        var engine = new CoreRulesEngine(new ICoreRuleEvaluator[] { new ProbeEvaluator() });
        var decision = engine.Evaluate(CreateRequest(new ProbeIntent(10), new SequenceRandomFactory(7)));

        var payload = decision.Payload as ProbePayload;

        Assert.IsNotNull(payload);
        Assert.AreEqual(CoreOutcomeStatus.Succeeded, decision.Status);
        Assert.AreEqual(17L, payload.Value);
    }

    [TestMethod]
    public void DuplicateIntentRegistration_IsRejected()
    {
        Assert.ThrowsExactly<ArgumentException>(() => new CoreRulesEngine(
            new ICoreRuleEvaluator[] { new ProbeEvaluator(), new ProbeEvaluator() }));
    }

    [TestMethod]
    public void RepeatedEvaluation_GetsFreshDeterministicStream()
    {
        var engine = new CoreRulesEngine(new ICoreRuleEvaluator[] { new ProbeEvaluator() });
        var request = CreateRequest(new ProbeIntent(10), new SequenceRandomFactory(7, 99));

        var first = (ProbePayload?)engine.Evaluate(request).Payload;
        var second = (ProbePayload?)engine.Evaluate(request).Payload;

        Assert.IsNotNull(first);
        Assert.IsNotNull(second);
        Assert.AreEqual(17L, first.Value);
        Assert.AreEqual(first.Value, second.Value);
    }

    [TestMethod]
    public void UnsupportedIntent_RemainsTechnicalFailureWithoutMutation()
    {
        var engine = new CoreRulesEngine(new ICoreRuleEvaluator[] { new ProbeEvaluator() });
        var decision = engine.Evaluate(CreateRequest(new UnknownIntent(), new SequenceRandomFactory(1)));

        Assert.AreEqual(CoreOutcomeStatus.TechnicalFailure, decision.Status);
        Assert.AreEqual("core.intent.unsupported", decision.Reason?.Value);
        Assert.AreEqual(0, decision.Transitions.Count);
        Assert.AreEqual(0, decision.Events.Count);
    }

    [TestMethod]
    public void EvaluatorProgrammingFailure_Propagates()
    {
        var engine = new CoreRulesEngine(new ICoreRuleEvaluator[] { new ThrowingEvaluator() });
        var request = CreateRequest(new ThrowingIntent(), new SequenceRandomFactory(1));

        Assert.ThrowsExactly<InvalidOperationException>(() => engine.Evaluate(request));
    }

    [TestMethod]
    public void NullRandomStream_IsRejected()
    {
        var engine = new CoreRulesEngine(new ICoreRuleEvaluator[] { new ProbeEvaluator() });
        var request = CreateRequest(new ProbeIntent(10), new NullRandomFactory());

        Assert.ThrowsExactly<InvalidOperationException>(() => engine.Evaluate(request));
    }

    private static CoreEvaluationRequest CreateRequest(
        ICoreIntent intent,
        IDeterministicRandomFactory randomFactory) =>
        new(
            CoreContractVersion.V1,
            new CoreEvaluationContext(
                new CommandId(Guid.Parse("33333333-3333-3333-3333-333333333333")),
                new CorrelationId(Guid.Parse("44444444-4444-4444-4444-444444444444")),
                new DateTimeOffset(2026, 8, 26, 8, 45, 0, TimeSpan.Zero),
                new RuleVersion("dispatch-rules-v1"),
                new ContentVersion("dispatch-content-v1"),
                randomFactory),
            intent,
            Array.Empty<IAuthoritativeSnapshot>(),
            Array.Empty<ICoreContentInput>());

    private sealed record ProbeIntent(long BaseValue) : ICoreIntent
    {
        public ContractDescriptor Contract => ProbeContract;
    }

    private sealed record UnknownIntent : ICoreIntent
    {
        public ContractDescriptor Contract { get; } = new("tests.dispatch.unknown", 1);
    }

    private sealed record ThrowingIntent : ICoreIntent
    {
        public ContractDescriptor Contract { get; } = new("tests.dispatch.throwing", 1);
    }

    private sealed record ProbePayload(long Value) : ICoreResultPayload
    {
        public ContractDescriptor Contract { get; } = new("tests.dispatch.probe-result", 1);
    }

    private sealed class ProbeEvaluator : ICoreRuleEvaluator
    {
        public ContractDescriptor IntentContract => ProbeContract;

        public CoreDecision Evaluate(CoreRuleExecutionContext context)
        {
            if (context.Intent is not ProbeIntent intent)
            {
                throw new InvalidOperationException("Probe evaluator received the wrong typed intent.");
            }

            var draw = context.Random.NextUInt64();
            return CoreDecision.Succeeded(new ProbePayload(checked(intent.BaseValue + (long)(draw % 100UL))));
        }
    }

    private sealed class ThrowingEvaluator : ICoreRuleEvaluator
    {
        public ContractDescriptor IntentContract { get; } = new("tests.dispatch.throwing", 1);

        public CoreDecision Evaluate(CoreRuleExecutionContext context)
        {
            ArgumentNullException.ThrowIfNull(context);
            throw new InvalidOperationException("Synthetic evaluator programming failure.");
        }
    }

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
                    throw new InvalidOperationException("Synthetic random stream exhausted.");
                }

                return _values[_index++];
            }
        }
    }

    private sealed class NullRandomFactory : IDeterministicRandomFactory
    {
        public IDeterministicRandomSource Create() => null!;
    }
}
