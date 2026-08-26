namespace Nexis.Items.Contracts;

/// <summary>
/// Stable identity of one concrete item instance. Item definitions/content and concrete item
/// instances are deliberately separate concepts.
/// </summary>
public readonly record struct ItemInstanceId
{
    public ItemInstanceId(Guid value)
    {
        if (value == Guid.Empty)
        {
            throw new ArgumentException("Item instance ID cannot be empty.", nameof(value));
        }

        Value = value;
    }

    public Guid Value { get; }

    public bool IsEmpty => Value == Guid.Empty;

    public static ItemInstanceId New() => new(Guid.NewGuid());

    public override string ToString() => Value.ToString("D");
}
