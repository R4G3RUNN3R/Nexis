using Nexis.Core.Contracts;
using Nexis.Core.Rules;

namespace Nexis.Core;

/// <summary>
/// Reference implementation of the replaceable Nexis rules engine. Stable callers use only
/// ICoreRulesEngine; internal evaluator registration and dispatch remain implementation details.
/// </summary>
public sealed class CoreRulesEngine : ICoreRulesEngine
{
    private static readonly CoreReasonCode UnsupportedContract = new("core.contract.unsupported");
    private static readonly CoreReasonCode UnsupportedIntent = new("core.intent.unsupported");
    private readonly IReadOnlyDictionary<ContractDescriptor, ICoreRuleEvaluator> _evaluators;

    public CoreRulesEngine()
        : this(Array.Empty<ICoreRuleEvaluator>())
    {
    }

    internal CoreRulesEngine(IEnumerable<ICoreRuleEvaluator> evaluators)
    {
        ArgumentNullException.ThrowIfNull(evaluators);

        var registered = new Dictionary<ContractDescriptor, ICoreRuleEvaluator>();

        foreach (var evaluator in evaluators)
        {
            if (evaluator is null)
            {
                throw new ArgumentException("Core rule evaluator collection cannot contain null entries.", nameof(evaluators));
            }

            var intentContract = evaluator.IntentContract
                ?? throw new ArgumentException("Core rule evaluator returned a null intent contract.", nameof(evaluators));

            if (!registered.TryAdd(intentContract, evaluator))
            {
                throw new ArgumentException(
                    $"A Core rule evaluator is already registered for intent contract '{intentContract.Name}' schema {intentContract.SchemaVersion}.",
                    nameof(evaluators));
            }
        }

        _evaluators = registered;
    }

    public CoreImplementationDescriptor Descriptor { get; } = new(
        "Nexis.Core.Reference",
        "0.4.0-foundation",
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

        var intentContract = request.Intent.Contract
            ?? throw new InvalidOperationException("Core intent returned a null contract descriptor.");

        if (!_evaluators.TryGetValue(intentContract, out var evaluator))
        {
            return CoreDecision.TechnicalFailure(UnsupportedIntent);
        }

        var random = request.Context.RandomFactory.Create()
            ?? throw new InvalidOperationException("Deterministic random factory returned a null stream.");

        var executionContext = new CoreRuleExecutionContext(request, random);
        return evaluator.Evaluate(executionContext)
            ?? throw new InvalidOperationException(
                $"Core rule evaluator for '{intentContract.Name}' schema {intentContract.SchemaVersion} returned null.");
    }
}
