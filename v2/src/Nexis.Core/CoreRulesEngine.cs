using Nexis.Core.Contracts;

namespace Nexis.Core;

/// <summary>
/// Initial reference Core shell. It establishes the replaceable engine boundary before gameplay
/// rule handlers are introduced. Unsupported intents fail without producing state transitions.
/// </summary>
public sealed class CoreRulesEngine : ICoreRulesEngine
{
    private static readonly CoreReasonCode UnsupportedContract = new("core.contract.unsupported");
    private static readonly CoreReasonCode UnsupportedIntent = new("core.intent.unsupported");

    public CoreImplementationDescriptor Descriptor { get; } = new(
        "Nexis.Core.Reference",
        "0.1.0-foundation",
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

        return CoreDecision.TechnicalFailure(UnsupportedIntent);
    }
}
