namespace Nexis.Core.Contracts;

/// <summary>
/// Stable implementation-neutral boundary for the selected authoritative Nexis rules engine.
/// Surrounding systems depend on this contract assembly, never on concrete Nexis.Core types.
/// </summary>
public interface ICoreRulesEngine
{
    CoreImplementationDescriptor Descriptor { get; }

    bool Supports(CoreContractVersion contractVersion);

    CoreDecision Evaluate(CoreEvaluationRequest request);
}
