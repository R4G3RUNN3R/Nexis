using Nexis.Core.Contracts;

namespace Nexis.Core.Rules;

/// <summary>
/// Internal rule-package seam used by the selected C# Core implementation. This is not part of the
/// stable engine-facing contract and may be redesigned without changing surrounding systems.
/// </summary>
internal interface ICoreRuleEvaluator
{
    ContractDescriptor IntentContract { get; }

    CoreDecision Evaluate(CoreRuleExecutionContext context);
}
