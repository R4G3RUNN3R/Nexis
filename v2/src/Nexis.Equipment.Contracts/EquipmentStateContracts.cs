using Nexis.Core.Contracts;
using Nexis.Identity.Contracts;
using Nexis.Items.Contracts;

namespace Nexis.Equipment.Contracts;

public sealed record EquippedItemBinding
{
    public EquippedItemBinding(
        ItemInstanceId itemInstanceId,
        EquipmentPlacementKey placementKey,
        IEnumerable<EquipmentSlotKey> occupiedSlots)
    {
        if (itemInstanceId.IsEmpty)
        {
            throw new ArgumentException("Equipped bindings require a non-empty ItemInstanceId.", nameof(itemInstanceId));
        }

        PlacementKey = placementKey ?? throw new ArgumentNullException(nameof(placementKey));
        ArgumentNullException.ThrowIfNull(occupiedSlots);
        var frozen = occupiedSlots.ToArray();
        if (frozen.Length == 0 || frozen.Any(static slot => slot is null))
        {
            throw new ArgumentException("Equipped bindings require at least one occupied slot.", nameof(occupiedSlots));
        }

        if (frozen.Distinct().Count() != frozen.Length)
        {
            throw new ArgumentException("Equipped bindings cannot occupy the same slot twice.", nameof(occupiedSlots));
        }

        ItemInstanceId = itemInstanceId;
        OccupiedSlots = Array.AsReadOnly(frozen);
    }

    public ItemInstanceId ItemInstanceId { get; }

    public EquipmentPlacementKey PlacementKey { get; }

    public IReadOnlyList<EquipmentSlotKey> OccupiedSlots { get; }
}

public sealed record EquipmentSnapshot : IAuthoritativeSnapshot
{
    public static ContractDescriptor SnapshotContract { get; } = new("nexis.equipment.snapshot", 1);

    public static OwnerKey OwnerKey { get; } = new("Equipment");

    public EquipmentSnapshot(
        CharacterId characterId,
        long revision,
        IEnumerable<EquippedItemBinding> bindings)
    {
        if (characterId.IsEmpty)
        {
            throw new ArgumentException("Equipment snapshots require a non-empty CharacterId.", nameof(characterId));
        }

        if (revision < 0)
        {
            throw new ArgumentOutOfRangeException(nameof(revision), "Snapshot revision cannot be negative.");
        }

        ArgumentNullException.ThrowIfNull(bindings);
        var frozen = bindings.ToArray();
        if (frozen.Any(static binding => binding is null))
        {
            throw new ArgumentException("Equipment snapshots cannot contain null bindings.", nameof(bindings));
        }

        if (frozen.Select(static binding => binding.ItemInstanceId).Distinct().Count() != frozen.Length)
        {
            throw new ArgumentException("An item instance cannot be bound to Equipment more than once.", nameof(bindings));
        }

        var occupiedSlots = frozen.SelectMany(static binding => binding.OccupiedSlots).ToArray();
        if (occupiedSlots.Distinct().Count() != occupiedSlots.Length)
        {
            throw new ArgumentException("Equipment bindings cannot overlap occupied slots.", nameof(bindings));
        }

        CharacterId = characterId;
        Revision = revision;
        Bindings = Array.AsReadOnly(frozen);
    }

    public ContractDescriptor Contract => SnapshotContract;

    public OwnerKey Owner => OwnerKey;

    public CharacterId CharacterId { get; }

    public long Revision { get; }

    public IReadOnlyList<EquippedItemBinding> Bindings { get; }
}
