using Nexis.Identity.Contracts;
using Nexis.Kernel.Commands;

namespace Nexis.Modules.Identity;

/// <summary>
/// Evaluates platform authority from current server-loaded Identity facts and exact policy bundles.
/// AccountRole values are dictionary keys only; their numeric values never imply capability.
/// </summary>
public sealed class PlatformAuthorizationPolicy
{
    private readonly IReadOnlyDictionary<AccountRole, IReadOnlySet<PlatformCapabilityKey>> _roleBundles;

    public PlatformAuthorizationPolicy(
        IReadOnlyDictionary<AccountRole, IReadOnlyCollection<PlatformCapabilityKey>> roleBundles)
    {
        ArgumentNullException.ThrowIfNull(roleBundles);

        _roleBundles = roleBundles.ToDictionary(
            static pair => pair.Key,
            static pair =>
            {
                ArgumentNullException.ThrowIfNull(pair.Value);
                if (pair.Value.Any(static capability => capability is null))
                {
                    throw new ArgumentException("Role capability bundles cannot contain null entries.", nameof(roleBundles));
                }

                return (IReadOnlySet<PlatformCapabilityKey>)new HashSet<PlatformCapabilityKey>(pair.Value);
            });
    }

    public PlatformAuthorizationDecision Authorize(
        TrustedActorContext actor,
        IdentitySecuritySnapshot currentSecurity,
        PlatformCapabilityKey requiredCapability)
    {
        ArgumentNullException.ThrowIfNull(actor);
        ArgumentNullException.ThrowIfNull(currentSecurity);
        ArgumentNullException.ThrowIfNull(requiredCapability);

        if (actor.Kind != ActorKind.Staff ||
            actor.Lane != CommandExecutionLane.Admin ||
            actor.AccountId is null ||
            actor.SecurityVersion is null)
        {
            return Deny(PlatformAuthorizationOutcome.StaffActorRequired, requiredCapability);
        }

        if (actor.AccountId.Value != currentSecurity.AccountId)
        {
            return Deny(PlatformAuthorizationOutcome.ActorMismatch, requiredCapability);
        }

        if (actor.SecurityVersion.Value != currentSecurity.SecurityVersion)
        {
            return Deny(PlatformAuthorizationOutcome.StaleSecurityContext, requiredCapability);
        }

        if (currentSecurity.ExplicitDenies.Contains(requiredCapability))
        {
            return Deny(PlatformAuthorizationOutcome.ExplicitlyDenied, requiredCapability);
        }

        var grantedByRole =
            _roleBundles.TryGetValue(currentSecurity.Role, out var roleCapabilities) &&
            roleCapabilities.Contains(requiredCapability);

        if (!grantedByRole && !currentSecurity.ExplicitGrants.Contains(requiredCapability))
        {
            return Deny(PlatformAuthorizationOutcome.CapabilityMissing, requiredCapability);
        }

        return new PlatformAuthorizationDecision(
            PlatformAuthorizationOutcome.Authorized,
            requiredCapability);
    }

    private static PlatformAuthorizationDecision Deny(
        PlatformAuthorizationOutcome outcome,
        PlatformCapabilityKey requiredCapability) =>
        new(outcome, requiredCapability);
}
