using Nexis.Identity.Contracts;

namespace Nexis.Execution.Contracts;

/// <summary>
/// Trusted inputs for one privileged command entry check. Target identity is retained for later
/// audit construction but never participates in the platform-authority decision.
/// </summary>
public sealed record PrivilegedCommandEntryRequest
{
    public PrivilegedCommandEntryRequest(
        TrustedActorContext actor,
        IdentitySecuritySnapshot currentSecurity,
        PlatformCapabilityKey requiredCapability,
        AccountId? targetAccountId = null)
    {
        if (targetAccountId is { IsEmpty: true })
        {
            throw new ArgumentException("Target AccountId cannot be empty when supplied.", nameof(targetAccountId));
        }

        Actor = actor ?? throw new ArgumentNullException(nameof(actor));
        CurrentSecurity = currentSecurity ?? throw new ArgumentNullException(nameof(currentSecurity));
        RequiredCapability = requiredCapability ?? throw new ArgumentNullException(nameof(requiredCapability));
        TargetAccountId = targetAccountId;
    }

    public TrustedActorContext Actor { get; }

    public IdentitySecuritySnapshot CurrentSecurity { get; }

    public PlatformCapabilityKey RequiredCapability { get; }

    public AccountId? TargetAccountId { get; }
}

/// <summary>
/// Fail-closed privileged entry result. ActingAccountId is populated only after the current
/// Identity policy authorizes the trusted staff actor and is never derived from TargetAccountId.
/// </summary>
public sealed record PrivilegedCommandEntryDecision
{
    private PrivilegedCommandEntryDecision(
        PlatformAuthorizationDecision authorization,
        AccountId? actingAccountId,
        AccountId? targetAccountId)
    {
        Authorization = authorization ?? throw new ArgumentNullException(nameof(authorization));
        ActingAccountId = actingAccountId;
        TargetAccountId = targetAccountId;
    }

    public PlatformAuthorizationDecision Authorization { get; }

    public bool IsAuthorized => Authorization.IsAuthorized;

    public AccountId? ActingAccountId { get; }

    public AccountId? TargetAccountId { get; }

    public static PrivilegedCommandEntryDecision Authorized(
        PlatformAuthorizationDecision authorization,
        AccountId actingAccountId,
        AccountId? targetAccountId)
    {
        ArgumentNullException.ThrowIfNull(authorization);
        if (!authorization.IsAuthorized)
        {
            throw new ArgumentException("Authorized entry decisions require an authorized Identity decision.", nameof(authorization));
        }

        if (actingAccountId.IsEmpty)
        {
            throw new ArgumentException("Authorized entry decisions require the acting staff AccountId.", nameof(actingAccountId));
        }

        return new PrivilegedCommandEntryDecision(authorization, actingAccountId, targetAccountId);
    }

    public static PrivilegedCommandEntryDecision Denied(
        PlatformAuthorizationDecision authorization,
        AccountId? targetAccountId)
    {
        ArgumentNullException.ThrowIfNull(authorization);
        if (authorization.IsAuthorized)
        {
            throw new ArgumentException("Denied entry decisions cannot carry an authorized Identity decision.", nameof(authorization));
        }

        return new PrivilegedCommandEntryDecision(authorization, null, targetAccountId);
    }
}

public interface IPrivilegedCommandEntryAuthorizer
{
    PrivilegedCommandEntryDecision Authorize(PrivilegedCommandEntryRequest request);
}
