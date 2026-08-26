namespace Nexis.Equipment.Contracts;

public sealed record EquipmentSlotKey
{
    public EquipmentSlotKey(string value)
    {
        ArgumentException.ThrowIfNullOrWhiteSpace(value);
        var normalized = value.Trim().ToLowerInvariant();
        if (normalized.Length > 64)
        {
            throw new ArgumentOutOfRangeException(nameof(value), "Equipment slot keys cannot exceed 64 characters.");
        }

        Value = normalized;
    }

    public string Value { get; }

    public override string ToString() => Value;
}

public sealed record EquipmentPlacementKey
{
    public EquipmentPlacementKey(string value)
    {
        ArgumentException.ThrowIfNullOrWhiteSpace(value);
        var normalized = value.Trim().ToLowerInvariant();
        if (normalized.Length > 64)
        {
            throw new ArgumentOutOfRangeException(nameof(value), "Equipment placement keys cannot exceed 64 characters.");
        }

        Value = normalized;
    }

    public string Value { get; }

    public override string ToString() => Value;
}
