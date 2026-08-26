using System.Collections;

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

/// <summary>
/// Immutable canonical value representing the slots occupied by one equipment placement.
/// Slot order is not gameplay meaning, so construction normalizes to ordinal slot-key order.
/// Equality and hashing are based on slot values rather than backing collection identity.
/// </summary>
public sealed class EquipmentSlotSet : IReadOnlyList<EquipmentSlotKey>, IEquatable<EquipmentSlotSet>
{
    private readonly EquipmentSlotKey[] _slots;

    public EquipmentSlotSet(IEnumerable<EquipmentSlotKey> slots)
    {
        ArgumentNullException.ThrowIfNull(slots);

        var frozen = slots.ToArray();
        if (frozen.Length == 0 || frozen.Any(static slot => slot is null))
        {
            throw new ArgumentException("Equipment slot sets require at least one non-null slot.", nameof(slots));
        }

        if (frozen.Distinct().Count() != frozen.Length)
        {
            throw new ArgumentException("Equipment slot sets cannot contain duplicate slots.", nameof(slots));
        }

        _slots = frozen
            .OrderBy(static slot => slot.Value, StringComparer.Ordinal)
            .ToArray();
    }

    public int Count => _slots.Length;

    public EquipmentSlotKey this[int index] => _slots[index];

    public bool Equals(EquipmentSlotSet? other) =>
        ReferenceEquals(this, other) ||
        (other is not null && _slots.SequenceEqual(other._slots));

    public override bool Equals(object? obj) =>
        obj is EquipmentSlotSet other && Equals(other);

    public override int GetHashCode()
    {
        var hash = new HashCode();
        foreach (var slot in _slots)
        {
            hash.Add(slot);
        }

        return hash.ToHashCode();
    }

    public IEnumerator<EquipmentSlotKey> GetEnumerator() =>
        ((IEnumerable<EquipmentSlotKey>)_slots).GetEnumerator();

    IEnumerator IEnumerable.GetEnumerator() => GetEnumerator();

    public override string ToString() => string.Join(",", _slots.Select(static slot => slot.Value));
}
