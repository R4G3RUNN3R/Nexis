using Nexis.Content.Contracts;
using Nexis.Core.Contracts;

namespace Nexis.Equipment.Contracts;

public sealed record EquipmentPlacementDefinition
{
    public EquipmentPlacementDefinition(
        EquipmentPlacementKey placementKey,
        IEnumerable<EquipmentSlotKey> occupiedSlots)
    {
        PlacementKey = placementKey ?? throw new ArgumentNullException(nameof(placementKey));
        OccupiedSlots = new EquipmentSlotSet(occupiedSlots);
    }

    public EquipmentPlacementKey PlacementKey { get; }

    public EquipmentSlotSet OccupiedSlots { get; }
}

/// <summary>
/// Minimal item definition required by persistent equipment placement rules. Combat stats,
/// durability, quality, enchantments and economic data belong to their own later typed contracts.
/// </summary>
public sealed record EquippableItemDefinition : IVersionedContentDefinition
{
    public static ContractDescriptor ContractDescriptor { get; } =
        new("nexis.items.equippable-definition", 1);

    public EquippableItemDefinition(
        ContentDefinitionId definitionId,
        IEnumerable<EquipmentPlacementDefinition> placements)
    {
        DefinitionId = definitionId ?? throw new ArgumentNullException(nameof(definitionId));
        ArgumentNullException.ThrowIfNull(placements);
        var frozen = placements.ToArray();
        if (frozen.Length == 0 || frozen.Any(static placement => placement is null))
        {
            throw new ArgumentException("Equippable items require at least one non-null placement.", nameof(placements));
        }

        if (frozen.Select(static placement => placement.PlacementKey).Distinct().Count() != frozen.Length)
        {
            throw new ArgumentException("Equippable item definitions cannot contain duplicate placement keys.", nameof(placements));
        }

        Placements = Array.AsReadOnly(frozen);
    }

    public ContractDescriptor Contract => ContractDescriptor;

    public ContentDefinitionId DefinitionId { get; }

    public IReadOnlyList<EquipmentPlacementDefinition> Placements { get; }
}
