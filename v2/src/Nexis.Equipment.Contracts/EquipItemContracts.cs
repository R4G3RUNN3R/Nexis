using Nexis.Core.Contracts;
using Nexis.Identity.Contracts;
using Nexis.Items.Contracts;

namespace Nexis.Equipment.Contracts;

public sealed record EquipItemIntent : ICoreIntent
{
    public static ContractDescriptor IntentContract { get; } = new("nexis.equipment.equip-item", 1);

    public EquipItemIntent(
        CharacterId characterId,
        ItemInstanceId itemInstanceId,
        EquipmentPlacementKey placementKey)
    {
        if (characterId.IsEmpty)
        {
            throw new ArgumentException("Equip Item requires a non-empty CharacterId.", nameof(characterId));
        }

        if (itemInstanceId.IsEmpty)
        {
            throw new ArgumentException("Equip Item requires a non-empty ItemInstanceId.", nameof(itemInstanceId));
        }

        CharacterId = characterId;
        ItemInstanceId = itemInstanceId;
        PlacementKey = placementKey ?? throw new ArgumentNullException(nameof(placementKey));
    }

    public ContractDescriptor Contract => IntentContract;

    public CharacterId CharacterId { get; }

    public ItemInstanceId ItemInstanceId { get; }

    public EquipmentPlacementKey PlacementKey { get; }
}

public sealed record EquipItemTransition : IOwnerTransition
{
    public static ContractDescriptor TransitionContract { get; } = new("nexis.equipment.bind-item", 1);

    public EquipItemTransition(
        long expectedRevision,
        CharacterId characterId,
        ItemInstanceId itemInstanceId,
        EquipmentPlacementKey placementKey,
        IEnumerable<EquipmentSlotKey> occupiedSlots)
    {
        if (expectedRevision < 0)
        {
            throw new ArgumentOutOfRangeException(nameof(expectedRevision));
        }

        if (characterId.IsEmpty || itemInstanceId.IsEmpty)
        {
            throw new ArgumentException("Equip Item transitions require non-empty character and item identities.");
        }

        PlacementKey = placementKey ?? throw new ArgumentNullException(nameof(placementKey));
        ExpectedRevision = expectedRevision;
        CharacterId = characterId;
        ItemInstanceId = itemInstanceId;
        OccupiedSlots = new EquipmentSlotSet(occupiedSlots);
    }

    public ContractDescriptor Contract => TransitionContract;

    public OwnerKey TargetOwner => EquipmentSnapshot.OwnerKey;

    public long? ExpectedRevision { get; }

    public CharacterId CharacterId { get; }

    public ItemInstanceId ItemInstanceId { get; }

    public EquipmentPlacementKey PlacementKey { get; }

    public EquipmentSlotSet OccupiedSlots { get; }
}

public sealed record ItemEquippedEvent : ICoreEventDescriptor
{
    public static ContractDescriptor EventContract { get; } = new("nexis.equipment.item-equipped", 1);

    public ItemEquippedEvent(
        CharacterId characterId,
        ItemInstanceId itemInstanceId,
        EquipmentPlacementKey placementKey,
        IEnumerable<EquipmentSlotKey> occupiedSlots)
    {
        if (characterId.IsEmpty || itemInstanceId.IsEmpty)
        {
            throw new ArgumentException("Item Equipped events require non-empty character and item identities.");
        }

        PlacementKey = placementKey ?? throw new ArgumentNullException(nameof(placementKey));
        CharacterId = characterId;
        ItemInstanceId = itemInstanceId;
        OccupiedSlots = new EquipmentSlotSet(occupiedSlots);
    }

    public ContractDescriptor Contract => EventContract;

    public CharacterId CharacterId { get; }

    public ItemInstanceId ItemInstanceId { get; }

    public EquipmentPlacementKey PlacementKey { get; }

    public EquipmentSlotSet OccupiedSlots { get; }
}
