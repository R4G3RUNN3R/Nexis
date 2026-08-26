namespace Nexis.Kernel.Commands;

/// <summary>
/// Stable identity for one authoritative command intent.
/// The same identifier is reused across retries of the same intent.
/// </summary>
public readonly record struct CommandId(Guid Value)
{
    public static CommandId New() => new(Guid.NewGuid());

    public bool IsEmpty => Value == Guid.Empty;

    public override string ToString() => Value.ToString("D");
}
