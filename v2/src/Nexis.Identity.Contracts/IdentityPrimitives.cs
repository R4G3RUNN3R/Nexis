namespace Nexis.Identity.Contracts;

/// <summary>
/// Internal platform-account identity. Account and Character remain permanently distinct concepts.
/// </summary>
public readonly record struct AccountId(Guid Value)
{
    public static AccountId New() => new(Guid.NewGuid());

    public bool IsEmpty => Value == Guid.Empty;

    public override string ToString() => Value.ToString("D");
}

/// <summary>
/// In-world character identity. This never becomes interchangeable with AccountId even while
/// ordinary Nexis accounts expose one playable character.
/// </summary>
public readonly record struct CharacterId(Guid Value)
{
    public static CharacterId New() => new(Guid.NewGuid());

    public bool IsEmpty => Value == Guid.Empty;

    public override string ToString() => Value.ToString("D");
}

/// <summary>
/// Named staff/account classification only. Sensitive authorization is capability/policy based;
/// consumers must not infer privilege from ordinal comparisons between these values.
/// </summary>
public enum AccountRole
{
    Player = 0,
    Moderator = 10,
    Administrator = 20,
    PrimaryOwner = 30
}
