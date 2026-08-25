namespace Nexis.Modules.Identity;

public readonly record struct AccountId(Guid Value)
{
    public static AccountId New() => new(Guid.NewGuid());
}

public readonly record struct CharacterId(Guid Value)
{
    public static CharacterId New() => new(Guid.NewGuid());
}

public enum AccountRole
{
    Player = 0,
    Moderator = 10,
    Administrator = 20,
    PrimaryOwner = 30
}
