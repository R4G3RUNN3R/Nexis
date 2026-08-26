using Nexis.Core.Contracts;
using Nexis.Execution.Contracts;

namespace Nexis.Execution;

/// <summary>
/// Builds stable idempotency identity only from trusted request facts plus the server-derived
/// canonical payload fingerprint.
/// </summary>
public static class CommandExecutionIdentityFactory
{
    public static CommandExecutionIdentity Create(
        CoreEvaluationRequest request,
        CanonicalCommandPayload payload)
    {
        ArgumentNullException.ThrowIfNull(payload);
        return Create(request, payload.Fingerprint);
    }

    public static CommandExecutionIdentity Create(
        CoreEvaluationRequest request,
        CommandPayloadFingerprint payloadFingerprint)
    {
        ArgumentNullException.ThrowIfNull(request);
        ArgumentNullException.ThrowIfNull(payloadFingerprint);

        return new CommandExecutionIdentity(
            request.Context.CommandId,
            CommandActorBinding.From(request.Context.Actor),
            request.Intent.Contract,
            payloadFingerprint);
    }
}
