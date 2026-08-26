namespace Nexis.Identity.Contracts;

public enum PlatformAuthorizationOutcome
{
    Authorized = 0,
    StaffActorRequired = 1,
    ActorMismatch = 2,
    StaleSecurityContext = 3,
    ExplicitlyDenied = 4,
    CapabilityMissing = 5
}

public sealed record PlatformAuthorizationDecision(
    PlatformAuthorizationOutcome Outcome,
    PlatformCapabilityKey RequiredCapability)
{
    public bool IsAuthorized => Outcome == PlatformAuthorizationOutcome.Authorized;
}

/// <summary>
/// Current authoritative account-security facts loaded by Identity for one command evaluation.
/// Role is descriptive input to an explicit server policy; grants and denies are current
/// server-side assignments. Commercial entitlements remain separate and never grant authority.
/// </summary>
public sealed class IdentitySecuritySnapshot
{
    private IdentitySecuritySnapshot(
        AccountId accountId,
        long securityVersion,
        AccountRole role,
        IEnumerable<PlatformCapabilityKey>? explicitGrants,
        IEnumerable<PlatformCapabilityKey>? explicitDenies,
        IEnumerable<EntitlementKey>? entitlements)
    {
        if (accountId.IsEmpty)
        {
            throw new ArgumentException("Identity security AccountId cannot be empty.", nameof(accountId));
        }

        if (securityVersion < 0)
        {
            throw new ArgumentOutOfRangeException(nameof(securityVersion), "Security version cannot be negative.");
        }

        AccountId = accountId;
        SecurityVersion = securityVersion;
        Role = role;
        ExplicitGrants = Freeze(explicitGrants);
        ExplicitDenies = Freeze(explicitDenies);
        Entitlements = Freeze(entitlements);
    }

    public AccountId AccountId { get; }

    public long SecurityVersion { get; }

    public AccountRole Role { get; }

    public IReadOnlySet<PlatformCapabilityKey> ExplicitGrants { get; }

    public IReadOnlySet<PlatformCapabilityKey> ExplicitDenies { get; }

    public IReadOnlySet<EntitlementKey> Entitlements { get; }

    public static IdentitySecuritySnapshot Create(
        AccountId accountId,
        long securityVersion,
        AccountRole role,
        IEnumerable<PlatformCapabilityKey>? explicitGrants = null,
        IEnumerable<PlatformCapabilityKey>? explicitDenies = null,
        IEnumerable<EntitlementKey>? entitlements = null) =>
        new(
            accountId,
            securityVersion,
            role,
            explicitGrants,
            explicitDenies,
            entitlements);

    private static IReadOnlySet<T> Freeze<T>(IEnumerable<T>? values)
        where T : class
    {
        if (values is null)
        {
            return new HashSet<T>();
        }

        var items = values.ToArray();
        if (items.Any(static item => item is null))
        {
            throw new ArgumentException("Identity security collections cannot contain null entries.", nameof(values));
        }

        return new HashSet<T>(items);
    }
}
