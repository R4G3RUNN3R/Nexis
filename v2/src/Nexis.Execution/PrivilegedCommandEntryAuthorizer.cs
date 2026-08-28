using Nexis.Execution.Contracts;
using Nexis.Identity.Contracts;

namespace Nexis.Execution;

/// <summary>
/// Reusable Admin-lane entry boundary. It delegates authority to current Identity policy facts and
/// binds successful entry to the real acting staff AccountId for downstream atomic Admin Audit.
/// </summary>
public sealed class PrivilegedCommandEntryAuthorizer : IPrivilegedCommandEntryAuthorizer
{
    private readonly IPlatformAuthorizationPolicy _authorizationPolicy;

    public PrivilegedCommandEntryAuthorizer(IPlatformAuthorizationPolicy authorizationPolicy)
    {
        _authorizationPolicy = authorizationPolicy ?? throw new ArgumentNullException(nameof(authorizationPolicy));
    }

    public PrivilegedCommandEntryDecision Authorize(PrivilegedCommandEntryRequest request)
    {
        ArgumentNullException.ThrowIfNull(request);
        var authorization = _authorizationPolicy.Authorize(
            request.Actor,
            request.CurrentSecurity,
            request.RequiredCapability);

        if (!authorization.IsAuthorized)
        {
            return PrivilegedCommandEntryDecision.Denied(authorization, request.TargetAccountId);
        }

        if (request.Actor.AccountId is not { } actingAccountId)
        {
            throw new InvalidOperationException("Identity policy authorized a privileged actor without an AccountId.");
        }

        return PrivilegedCommandEntryDecision.Authorized(
            authorization,
            actingAccountId,
            request.TargetAccountId);
    }
}
