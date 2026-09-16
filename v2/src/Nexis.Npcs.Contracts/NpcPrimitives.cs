namespace Nexis.Npcs.Contracts;

public readonly record struct NpcId(Guid Value)
{
    public static NpcId New() => new(Guid.NewGuid());

    public bool IsEmpty => Value == Guid.Empty;

    public override string ToString() => Value.ToString("D");
}

public enum NpcLifecycleStatus
{
    Living = 0,
    Dead = 1
}
