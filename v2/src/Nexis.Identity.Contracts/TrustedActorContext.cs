using Nexis.Kernel.Commands;

namespace Nexis.Identity.Contracts;

public enum ActorKind
{
    Player = 0,
    Staff = 1,
    System = 2
}

public sealed record PlatformCapabilityKey
{
    public PlatformCapabilityKey(string value)
    {
        ArgumentException.ThrowIfNullOrWhiteSpace(value);
        Value = value;
    }

    public string Value { get; }

    public override string ToString() => Value;
}

public sealed record EntitlementKey
{
    public EntitlementKey(string value)
    {
        ArgumentException.ThrowIfNullOrWhiteSpace(value);
        Value = value;
    }

    public string Value { get; }

    public override string ToString() => Value;
}

/// <summary>
/// Stable server-side identity for an automated authority source such as the scheduler or CIEL.
/// This is not an Account and must never be accepted from an untrusted client.
/// </summary>
public sealed record SystemActorKey
{
    public static SystemActorKey Platform { get; } = new("nexis.system");

    public SystemActorKey(string value)
    {
        ArgumentException.ThrowIfNullOrWhiteSpace(value);
        var normalized = value.Trim().ToLowerInvariant();
        if (normalized.Length > 128)
        {
            throw new ArgumentOutOfRangeException(nameof(value), "System actor keys cannot exceed 128 characters.");
        }

        Value = normalized;
    }

    public string Value { get; }

    public override string ToString() => Value;
}

/// <summary>
/// Server-created actor facts supplied to authoritative command/Core evaluation. This contract
/// contains stable identity, current effective platform capabilities and commercial entitlements;
/// it never accepts character names, titles, client roles or gameplay-domain ranks as authority.
/// </summary>
public sealed class TrustedActorContext
{
    private TrustedActorContext(
        ActorKind kind,
        CommandExecutionLane lane,
        AccountId? accountId,
        CharacterId? characterId,
        SystemActorKey? systemActorKey,
        long? securityVersion,
        IEnumerable<PlatformCapabilityKey>? capabilities,
        IEnumerable<EntitlementKey>? entitlements)
    {
        if (accountId is { IsEmpty: true })
        {
            throw new ArgumentException("Actor AccountId cannot be empty.", nameof(accountId));
        }

        if (characterId is { IsEmpty: true })
        {
            throw new ArgumentException("Actor CharacterId cannot be empty.", nameof(characterId));
        }

        if (securityVersion < 0)
        {
            throw new ArgumentOutOfRangeException(nameof(securityVersion), "Security version cannot be negative.");
        }

        var validShape = kind switch
        {
            ActorKind.Player => accountId.HasValue && characterId.HasValue && systemActorKey is null,
            ActorKind.Staff => accountId.HasValue && !characterId.HasValue && systemActorKey is null,
            ActorKind.System => !accountId.HasValue && !characterId.HasValue && systemActorKey is not null,
            _ => false
        };

        if (!validShape)
        {
            throw new ArgumentException("Trusted actor identity does not match its actor kind.");
        }

        Kind = kind;
        Lane = lane;
        AccountId = accountId;
        CharacterId = characterId;
        SystemActorKey = systemActorKey;
        SecurityVersion = securityVersion;
        Capabilities = Freeze(capabilities);
        Entitlements = Freeze(entitlements);
    }

    public ActorKind Kind { get; }

    public CommandExecutionLane Lane { get; }

    public AccountId? AccountId { get; }

    public CharacterId? CharacterId { get; }

    public SystemActorKey? SystemActorKey { get; }

    public long? SecurityVersion { get; }

    public IReadOnlyList<PlatformCapabilityKey> Capabilities { get; }

    public IReadOnlyList<EntitlementKey> Entitlements { get; }

    public bool HasCapability(PlatformCapabilityKey capability)
    {
        ArgumentNullException.ThrowIfNull(capability);
        return Capabilities.Contains(capability);
    }

    public bool HasEntitlement(EntitlementKey entitlement)
    {
        ArgumentNullException.ThrowIfNull(entitlement);
        return Entitlements.Contains(entitlement);
    }

    public static TrustedActorContext CreatePlayer(
        AccountId accountId,
        CharacterId characterId,
        long securityVersion,
        IEnumerable<PlatformCapabilityKey>? capabilities = null,
        IEnumerable<EntitlementKey>? entitlements = null,
        bool realtime = false)
    {
        if (accountId.IsEmpty)
        {
            throw new ArgumentException("Player AccountId cannot be empty.", nameof(accountId));
        }

        if (characterId.IsEmpty)
        {
            throw new ArgumentException("Player CharacterId cannot be empty.", nameof(characterId));
        }

        return new TrustedActorContext(
            ActorKind.Player,
            realtime ? CommandExecutionLane.Realtime : CommandExecutionLane.Player,
            accountId,
            characterId,
            null,
            securityVersion,
            capabilities,
            entitlements);
    }

    public static TrustedActorContext CreateStaff(
        AccountId accountId,
        long securityVersion,
        IEnumerable<PlatformCapabilityKey>? capabilities = null,
        IEnumerable<EntitlementKey>? entitlements = null)
    {
        if (accountId.IsEmpty)
        {
            throw new ArgumentException("Staff AccountId cannot be empty.", nameof(accountId));
        }

        return new TrustedActorContext(
            ActorKind.Staff,
            CommandExecutionLane.Admin,
            accountId,
            null,
            null,
            securityVersion,
            capabilities,
            entitlements);
    }

    public static TrustedActorContext CreateSystem() =>
        CreateSystem(SystemActorKey.Platform);

    public static TrustedActorContext CreateSystem(SystemActorKey systemActorKey)
    {
        ArgumentNullException.ThrowIfNull(systemActorKey);

        return new TrustedActorContext(
            ActorKind.System,
            CommandExecutionLane.System,
            null,
            null,
            systemActorKey,
            null,
            null,
            null);
    }

    private static IReadOnlyList<T> Freeze<T>(IEnumerable<T>? values)
        where T : class
    {
        if (values is null)
        {
            return Array.Empty<T>();
        }

        var items = values.ToArray();
        if (items.Any(static item => item is null))
        {
            throw new ArgumentException("Trusted actor collections cannot contain null entries.", nameof(values));
        }

        return Array.AsReadOnly(items
            .Distinct()
            .OrderBy(static item => item.ToString(), StringComparer.Ordinal)
            .ToArray());
    }
}
