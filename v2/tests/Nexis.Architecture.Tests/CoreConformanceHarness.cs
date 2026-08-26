using Nexis.Core.Contracts;

namespace Nexis.Architecture.Tests;

internal sealed record CoreGoldenScenario
{
    public CoreGoldenScenario(
        string name,
        CoreContractVersion contractVersion,
        Func<CoreEvaluationRequest> createRequest,
        Func<CoreDecision, string> projectSemanticResult,
        string expectedFingerprint)
    {
        ArgumentException.ThrowIfNullOrWhiteSpace(name);
        ArgumentNullException.ThrowIfNull(createRequest);
        ArgumentNullException.ThrowIfNull(projectSemanticResult);
        ArgumentException.ThrowIfNullOrWhiteSpace(expectedFingerprint);

        if (!contractVersion.IsValid)
        {
            throw new ArgumentOutOfRangeException(nameof(contractVersion));
        }

        Name = name;
        ContractVersion = contractVersion;
        CreateRequest = createRequest;
        ProjectSemanticResult = projectSemanticResult;
        ExpectedFingerprint = expectedFingerprint;
    }

    public string Name { get; }

    public CoreContractVersion ContractVersion { get; }

    public Func<CoreEvaluationRequest> CreateRequest { get; }

    public Func<CoreDecision, string> ProjectSemanticResult { get; }

    public string ExpectedFingerprint { get; }
}

internal sealed record CoreConformanceObservation(
    string ScenarioName,
    string ImplementationName,
    string ImplementationVersion,
    string Fingerprint,
    bool MatchesGolden);

internal sealed record CoreConformanceComparison(
    CoreConformanceObservation Baseline,
    CoreConformanceObservation Candidate)
{
    public bool IsEquivalent =>
        StringComparer.Ordinal.Equals(Baseline.Fingerprint, Candidate.Fingerprint);
}

internal static class CoreConformanceHarness
{
    public static CoreConformanceObservation Run(
        ICoreRulesEngine engine,
        CoreGoldenScenario scenario)
    {
        ArgumentNullException.ThrowIfNull(engine);
        ArgumentNullException.ThrowIfNull(scenario);

        if (!engine.Supports(scenario.ContractVersion))
        {
            throw new InvalidOperationException(
                $"Core '{engine.Descriptor.ImplementationName}' does not support contract {scenario.ContractVersion} required by scenario '{scenario.Name}'.");
        }

        var request = scenario.CreateRequest()
            ?? throw new InvalidOperationException($"Scenario '{scenario.Name}' returned a null request.");

        if (request.ContractVersion != scenario.ContractVersion)
        {
            throw new InvalidOperationException(
                $"Scenario '{scenario.Name}' declared contract {scenario.ContractVersion} but created request contract {request.ContractVersion}.");
        }

        var decision = engine.Evaluate(request)
            ?? throw new InvalidOperationException(
                $"Core '{engine.Descriptor.ImplementationName}' returned a null decision for scenario '{scenario.Name}'.");

        var fingerprint = scenario.ProjectSemanticResult(decision);
        ArgumentException.ThrowIfNullOrWhiteSpace(fingerprint);

        return new CoreConformanceObservation(
            scenario.Name,
            engine.Descriptor.ImplementationName,
            engine.Descriptor.ImplementationVersion,
            fingerprint,
            StringComparer.Ordinal.Equals(fingerprint, scenario.ExpectedFingerprint));
    }

    public static CoreConformanceComparison Compare(
        ICoreRulesEngine baseline,
        ICoreRulesEngine candidate,
        CoreGoldenScenario scenario) =>
        new(Run(baseline, scenario), Run(candidate, scenario));
}
