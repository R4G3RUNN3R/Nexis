using Microsoft.VisualStudio.TestTools.UnitTesting;
using Nexis.Core;
using Nexis.Core.Contracts;
using Nexis.Kernel.Commands;
using Nexis.Kernel.Events;
using Nexis.Kernel.Randomness;

namespace Nexis.Architecture.Tests;

[TestClass]
public sealed class CoreConformanceTests
{
    private static readonly CommandId StableCommandId = new(
        Guid.Parse("11111111-1111-1111-1111-111111111111"));

    private static readonly CorrelationId StableCorrelationId = new(
        Guid.Parse("22222222-2222-2222-2222-222222222222"));

    [TestMethod]
    public void ReferenceCore_MatchesGoldenUnsupportedIntentScenario()
    {
        var observation = CoreConformanceHarness.Run(
            new CoreRulesEngine(),
            CreateUnsupportedIntentScenario());

        Assert.IsTrue(observation.MatchesGolden, observation.Fingerprint);
    }

    [TestMethod]
    public void CompatibleReplacementCore_MatchesReferenceCore()
    {
        var comparison = CoreConformanceHarness.Compare(
            new CoreRulesEngine(),
            new EquivalentUnsupportedCore(),
            CreateUnsupportedIntentScenario());

        Assert.IsTrue(comparison.Baseline.MatchesGolden, comparison.Baseline.Fingerprint);
        Assert.IsTrue(comparison.Candidate.MatchesGolden, comparison.Candidate.Fingerprint);
        Assert.IsTrue(comparison.IsEquivalent);
    }

    [TestMethod]
    public void ConformanceHarness_DetectsSemanticDivergence()
    {
        var comparison = CoreConformanceHarness.Compare(
            new CoreRulesEngine(),
            new DivergentUnsupportedCore(),
            CreateUnsupportedIntentScenario());

        Assert.IsTrue(comparison.Baseline.MatchesGolden);
        Assert.IsFalse(comparison.Candidate.MatchesGolden);
        Assert.IsFalse(comparison.IsEquivalent);
    }

    [TestMethod]
    public void SameRequest_ReevaluationUsesFreshDeterministicRandomStream()
    {
        var engine = new DeterministicProbeCore();
        var request = CreateProbeRequest();

        var first = engine.Evaluate(request);
        var second = engine.Evaluate(request);

        Assert.AreEqual(ProjectProbe(first), ProjectProbe(second));
        Assert.AreEqual("Succeeded|51", ProjectProbe(first));
    }

    [TestMethod]
    public void CompatibleDeterministicCores_ProduceEquivalentGoldenResult()
    {
        var scenario = CreateProbeScenario();
        var comparison = CoreConformanceHarness.Compare(
            new DeterministicProbeCore(),
            new DeterministicProbeCore(),
            scenario);

        Assert.IsTrue(comparison.Baseline.MatchesGolden, comparison.Baseline.Fingerprint);
        Assert.IsTrue(comparison.Candidate.MatchesGolden, comparison.Candidate.Fingerprint);
        Assert.IsTrue(comparison.IsEquivalent);
    }

    [TestMethod]
    public void DeterministicCoreDivergence_IsDetected()
    {
        var scenario = CreateProbeScenario();
        var comparison = CoreConformanceHarness.Compare(
            new DeterministicProbeCore(),
            new DeterministicProbeCore(resultOffset: 1),
            scenario);

        Assert.IsTrue(comparison.Baseline.MatchesGolden);
        Assert.IsFalse(comparison.Candidate.MatchesGolden);
        Assert.IsFalse(comparison.IsEquivalent);
    }

    private static CoreGoldenScenario CreateUnsupportedIntentScenario() => new(
        "foundation.unsupported-intent.v1",
        CoreContractVersion.V1,
        static () => new CoreEvaluationRequest(
            CoreContractVersion.V1,
            CreateContext(new SequenceRandomFactory(5, 8, 13)),
            new ProbeIntent(10),
            Array.Empty<IAuthoritativeSnapshot>(),
            new ICoreContentInput[] { new ProbeContent("foundation") }),
        ProjectEnvelope,
        "TechnicalFailure|core.intent.unsupported|-|0|0");

    private static CoreGoldenScenario CreateProbeScenario() => new(
        "foundation.deterministic-rng.v1",
        CoreContractVersion.V1,
        CreateProbeRequest,
        ProjectProbe,
        "Succeeded|51");

    private static CoreEvaluationRequest CreateProbeRequest() => new(
        CoreContractVersion.V1,
        CreateContext(new SequenceRandomFactory(41, 99)),
        new ProbeIntent(10),
        Array.Empty<IAuthoritativeSnapshot>(),
        new ICoreContentInput[] { new ProbeContent("foundation") });

    private static CoreEvaluationContext CreateContext(IDeterministicRandomFactory randomFactory) => new(
        StableCommandId,
        StableCorrelationId,
        new DateTimeOffset(2026, 8, 26, 8, 30, 0, TimeSpan.Zero),
        new RuleVersion("foundation-rules-v1"),
        new ContentVersion("foundation-content-v1"),
        randomFactory);

    private static string ProjectEnvelope(CoreDecision decision) =>
        string.Join(
            "|",
            decision.Status,
            decision.Reason?.Value ?? "-",
            decision.Payload?.Contract.Name ?? "-",
            decision.Transitions.Count,
            decision.Events.Count);

    private static string ProjectProbe(CoreDecision decision)
    {
        var payload = decision.Payload as ProbePayload
            ?? throw new InvalidOperationException("Expected deterministic probe payload.");

        return $"{decision.Status}|{payload.Value}";
    }

    private sealed record ProbeIntent(long BaseValue) : ICoreIntent
    {
        public ContractDescriptor Contract { get; } = new("tests.conformance.probe-intent", 1);
    }

    private sealed record ProbeContent(string Name) : ICoreContentInput
    {
        public ContractDescriptor Contract { get; } = new("tests.conformance.probe-content", 1);
    }

    private sealed record ProbePayload(long Value) : ICoreResultPayload
    {
        public ContractDescriptor Contract { get; } = new("tests.conformance.probe-result", 1);
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
                    throw new InvalidOperationException("The deterministic test RNG was exhausted.");
                }

                return _values[_index++];
            }
        }
    }

    private sealed class EquivalentUnsupportedCore : ICoreRulesEngine
    {
        private static readonly CoreReasonCode UnsupportedContract = new("core.contract.unsupported");
        private static readonly CoreReasonCode UnsupportedIntent = new("core.intent.unsupported");

        public CoreImplementationDescriptor Descriptor { get; } = new(
            "Tests.EquivalentUnsupportedCore",
            "1.0.0",
            CoreContractVersion.V1);

        public bool Supports(CoreContractVersion contractVersion) =>
            contractVersion == CoreContractVersion.V1;

        public CoreDecision Evaluate(CoreEvaluationRequest request)
        {
            ArgumentNullException.ThrowIfNull(request);

            return Supports(request.ContractVersion)
                ? CoreDecision.TechnicalFailure(UnsupportedIntent)
                : CoreDecision.TechnicalFailure(UnsupportedContract);
        }
    }

    private sealed class DivergentUnsupportedCore : ICoreRulesEngine
    {
        private static readonly CoreReasonCode Divergence = new("tests.intent.rejected");

        public CoreImplementationDescriptor Descriptor { get; } = new(
            "Tests.DivergentUnsupportedCore",
            "1.0.0",
            CoreContractVersion.V1);

        public bool Supports(CoreContractVersion contractVersion) =>
            contractVersion == CoreContractVersion.V1;

        public CoreDecision Evaluate(CoreEvaluationRequest request)
        {
            ArgumentNullException.ThrowIfNull(request);
            return CoreDecision.Rejected(Divergence);
        }
    }

    private sealed class DeterministicProbeCore : ICoreRulesEngine
    {
        private static readonly CoreReasonCode UnsupportedContract = new("core.contract.unsupported");
        private static readonly CoreReasonCode UnsupportedIntent = new("core.intent.unsupported");
        private readonly long _resultOffset;

        public DeterministicProbeCore(long resultOffset = 0)
        {
            _resultOffset = resultOffset;
        }

        public CoreImplementationDescriptor Descriptor { get; } = new(
            "Tests.DeterministicProbeCore",
            "1.0.0",
            CoreContractVersion.V1);

        public bool Supports(CoreContractVersion contractVersion) =>
            contractVersion == CoreContractVersion.V1;

        public CoreDecision Evaluate(CoreEvaluationRequest request)
        {
            ArgumentNullException.ThrowIfNull(request);

            if (!Supports(request.ContractVersion))
            {
                return CoreDecision.TechnicalFailure(UnsupportedContract);
            }

            if (request.Intent is not ProbeIntent intent)
            {
                return CoreDecision.TechnicalFailure(UnsupportedIntent);
            }

            var random = request.Context.RandomFactory.Create()
                ?? throw new InvalidOperationException("Deterministic random factory returned null.");

            var draw = random.NextUInt64();
            var result = checked(intent.BaseValue + (long)(draw % 100UL) + _resultOffset);

            return CoreDecision.Succeeded(new ProbePayload(result));
        }
    }
}
