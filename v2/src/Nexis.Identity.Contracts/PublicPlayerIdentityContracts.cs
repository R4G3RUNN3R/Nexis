using System.Globalization;

namespace Nexis.Identity.Contracts;

/// <summary>
/// Stable immutable public player identity. It is deliberately not GUID-shaped, so it cannot be
/// confused with, cast to, or reinterpreted as an internal <see cref="AccountId"/> or
/// <see cref="CharacterId"/>.
///
/// This identifier is presentation and correlation only. It grants no authority of any kind, and
/// no Nexis authorization surface accepts it. The canonical rendered form preserves the existing
/// public player-number semantics: a 'P' prefix followed by the zero-padded ordinal.
/// </summary>
public readonly record struct PublicPlayerId
{
    /// <summary>Lowest ordinal the public identity space uses at all.</summary>
    public const long Floor = 1_000_000;

    /// <summary>Ordinals below this are reserved and are never allocated to an ordinary player.</summary>
    public const long ReservedCount = 20;

    private const string Prefix = "P";
    private const int Digits = 7;

    public PublicPlayerId(long ordinal)
    {
        if (ordinal < Floor)
        {
            throw new ArgumentOutOfRangeException(
                nameof(ordinal),
                ordinal,
                $"Public player ordinals start at {Floor}.");
        }

        Ordinal = ordinal;
    }

    /// <summary>First ordinal allocatable to an ordinary player.</summary>
    public static PublicPlayerId FirstAllocatable { get; } = new(Floor + ReservedCount);

    public long Ordinal { get; }

    /// <summary>True while the ordinal falls inside the reserved, never-allocated low range.</summary>
    public bool IsReserved => Ordinal < Floor + ReservedCount;

    /// <summary>Canonical public rendering, for example <c>P1000020</c>.</summary>
    public string Value => Prefix + Ordinal.ToString(CultureInfo.InvariantCulture).PadLeft(Digits, '0');

    public static PublicPlayerId Parse(string value)
    {
        ArgumentException.ThrowIfNullOrWhiteSpace(value);

        if (!value.StartsWith(Prefix, StringComparison.Ordinal))
        {
            throw new FormatException($"Public player identifiers must start with '{Prefix}'.");
        }

        var digits = value[Prefix.Length..];
        if (digits.Length < Digits || !digits.All(char.IsAsciiDigit))
        {
            throw new FormatException(
                $"Public player identifiers must carry at least {Digits} ASCII digits after '{Prefix}'.");
        }

        if (!long.TryParse(digits, NumberStyles.None, CultureInfo.InvariantCulture, out var ordinal))
        {
            throw new FormatException("Public player identifier ordinal is not a valid number.");
        }

        return new PublicPlayerId(ordinal);
    }

    public override string ToString() => Value;
}

/// <summary>
/// Mutable player display name. Presentation only: a display name is never identity and never
/// authority, and changing it changes no identifier.
/// </summary>
public readonly record struct PlayerDisplayName
{
    public const int MinimumLength = 2;
    public const int MaximumLength = 20;

    public PlayerDisplayName(string value)
    {
        ArgumentException.ThrowIfNullOrWhiteSpace(value);

        if (value.Length < MinimumLength || value.Length > MaximumLength)
        {
            throw new ArgumentException(
                $"Display names must be between {MinimumLength} and {MaximumLength} characters.",
                nameof(value));
        }

        foreach (var character in value)
        {
            if (!char.IsAsciiLetter(character) && character is not (' ' or '-' or '\''))
            {
                throw new ArgumentException(
                    "Display names may contain only letters, spaces, hyphens and apostrophes.",
                    nameof(value));
            }
        }

        Value = value;
    }

    public string Value { get; }

    public override string ToString() => Value;
}

/// <summary>
/// The authoritative Identity-owned relationship between one account, its one playable character
/// and its stable public identity. Nexis exposes one playable character per normal account; the
/// identifiers stay permanently distinct types so that decision can be revisited later without a
/// destructive identity migration.
/// </summary>
public sealed class PlayerIdentity
{
    private PlayerIdentity(
        AccountId accountId,
        CharacterId characterId,
        PublicPlayerId publicPlayerId,
        PlayerDisplayName displayName)
    {
        if (accountId.IsEmpty)
        {
            throw new ArgumentException("Player identity AccountId cannot be empty.", nameof(accountId));
        }

        if (characterId.IsEmpty)
        {
            throw new ArgumentException("Player identity CharacterId cannot be empty.", nameof(characterId));
        }

        if (publicPlayerId.IsReserved)
        {
            throw new ArgumentException(
                "Reserved public player identifiers are never assigned to a player identity.",
                nameof(publicPlayerId));
        }

        AccountId = accountId;
        CharacterId = characterId;
        PublicPlayerId = publicPlayerId;
        DisplayName = displayName;
    }

    public AccountId AccountId { get; }

    public CharacterId CharacterId { get; }

    public PublicPlayerId PublicPlayerId { get; }

    public PlayerDisplayName DisplayName { get; }

    public static PlayerIdentity Create(
        AccountId accountId,
        CharacterId characterId,
        PublicPlayerId publicPlayerId,
        PlayerDisplayName displayName) =>
        new(accountId, characterId, publicPlayerId, displayName);

    /// <summary>
    /// Renaming produces a new identity value carrying the same account, character and public
    /// identifier. There is no path that rewrites an assigned public identifier.
    /// </summary>
    public PlayerIdentity WithDisplayName(PlayerDisplayName displayName) =>
        new(AccountId, CharacterId, PublicPlayerId, displayName);

    /// <summary>
    /// The knowledge-safe public view. It carries exactly the two facts the world is entitled to
    /// see and never the internal identifiers, role, capabilities, security version or entitlements.
    /// </summary>
    public PublicPlayerProjection ToPublicProjection() => new(PublicPlayerId, DisplayName);
}

/// <summary>
/// Public, non-authoritative projection of a player identity. This is not a write owner and carries
/// no privileged state.
/// </summary>
public sealed record PublicPlayerProjection(PublicPlayerId PublicPlayerId, PlayerDisplayName DisplayName);

/// <summary>
/// Outcome of resolving a client-supplied public identifier against the acting account.
/// </summary>
public enum PlayerIdentityResolution
{
    /// <summary>The public identifier is unknown to Identity.</summary>
    Unknown = 0,

    /// <summary>The public identifier exists but the acting account does not control it.</summary>
    NotControlledByActor = 1,

    /// <summary>The acting account controls the character behind the public identifier.</summary>
    Controlled = 2
}

/// <summary>
/// Result of a control resolution. A <see cref="CharacterId"/> is surfaced only when the acting
/// account genuinely controls it, so a forged identifier cannot yield an actionable character.
/// </summary>
public sealed record PlayerIdentityResolutionResult(PlayerIdentityResolution Outcome, CharacterId? CharacterId)
{
    public static PlayerIdentityResolutionResult Unknown { get; } = new(PlayerIdentityResolution.Unknown, null);

    public static PlayerIdentityResolutionResult NotControlled { get; } =
        new(PlayerIdentityResolution.NotControlledByActor, null);

    public static PlayerIdentityResolutionResult Controlled(CharacterId characterId) =>
        new(PlayerIdentityResolution.Controlled, characterId);
}
