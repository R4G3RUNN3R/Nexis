using Nexis.Core.Contracts;
using Nexis.Identity.Contracts;
using Nexis.Items.Contracts;

namespace Nexis.Equipment.Contracts;

public sealed record UnequipItemIntent : ICoreIntent
{
    public static ContractDescriptor IntentContract { get; } = new("nexis.equipment.unequip-item", 1);

    public UnequipItemIntent(CharacterId characterId, ItemInstanceId itemInstanceId)
    {
        if (characterId.IsEmpty)
        {
            throw new ArgumentException("Unequip Item requires a non-empty CharacterId.", nameof(characterId));
        }

        if (itemInstanceId.IsEmpty)
        {
            throw new ArgumentException("Unequip Item requires a non-empty ItemInstanceId.", nameof(itemInstanceId));
        }

        CharacterId = characterId;
        ItemInstanceId = itemInstanceId;
    }

    public ContractDescriptor Contract => IntentContract;

    public CharacterId CharacterId { get; }

    public ItemInstanceId ItemInstanceId { get; }
}

/// <summary>
/// Clears one Equipment binding. Placement and released slots are carried so the persistence
/// boundary and the semantic event describe exactly what was cleared without a second content read.
/// </summary>
public sealed record UnequipItemTransition : IOwnerTransition
{
    public static ContractDescriptor TransitionContract { get; } = new("nexis.equipment.unbind-item", 1);

    public UnequipItemTransition(
        long expectedRevision,
        CharacterId characterId,
        ItemInstanceId itemInstanceId,
        EquipmentPlacementKey placementKey,
        IEnumerable<EquipmentSlotKey> releasedSlots)
    {
        if (expectedRevision < 0)
        {
            throw new ArgumentOutOfRangeException(nameof(expectedRevision));
        }

        if (characterId.IsEmpty || itemInstanceId.IsEmpty)
        {
            throw new ArgumentException("Unequip Item transitions require non-empty character and item identities.");
        }

        PlacementKey = placementKey ?? throw new ArgumentNullException(nameof(placementKey));
        ExpectedRevision = expectedRevision;
        CharacterId = characterId;
        ItemInstanceId = itemInstanceId;
        ReleasedSlots = new EquipmentSlotSet(releasedSlots);
    }

    public ContractDescriptor Contract => TransitionContract;

    public OwnerKey TargetOwner => EquipmentSnapshot.OwnerKey;

    public long? ExpectedRevision { get; }

    public CharacterId CharacterId { get; }

    public ItemInstanceId ItemInstanceId { get; }

    public EquipmentPlacementKey PlacementKey { get; }

    public EquipmentSlotSet ReleasedSlots { get; }
}

public sealed record ItemUnequippedEvent : ICoreEventDescriptor
{
    public static ContractDescriptor EventContract { get; } = new("nexis.equipment.item-unequipped", 1);

    public ItemUnequippedEvent(
        CharacterId characterId,
        ItemInstanceId itemInstanceId,
        EquipmentPlacementKey placementKey,
        IEnumerable<EquipmentSlotKey> releasedSlots)
    {
        if (characterId.IsEmpty || itemInstanceId.IsEmpty)
        {
            throw new ArgumentException("Item Unequipped events require non-empty character and item identities.");
        }

        PlacementKey = placementKey ?? throw new ArgumentNullException(nameof(placementKey));
        CharacterId = characterId;
        ItemInstanceId = itemInstanceId;
        ReleasedSlots = new EquipmentSlotSet(releasedSlots);
    }

    public ContractDescriptor Contract => EventContract;

    public CharacterId CharacterId { get; }

    public ItemInstanceId ItemInstanceId { get; }

    public EquipmentPlacementKey PlacementKey { get; }

    public EquipmentSlotSet ReleasedSlots { get; }
}
