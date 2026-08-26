using Nexis.Content.Contracts;
using Nexis.Core.Contracts;
using Nexis.Identity.Contracts;
using Nexis.Items.Contracts;

namespace Nexis.Inventory.Contracts;

public sealed record InventoryItemReference
{
    public InventoryItemReference(
        ItemInstanceId itemInstanceId,
        ContentDefinitionKey definitionKey)
    {
        if (itemInstanceId.IsEmpty)
        {
            throw new ArgumentException("Inventory item references require a non-empty ItemInstanceId.", nameof(itemInstanceId));
        }

        ItemInstanceId = itemInstanceId;
        DefinitionKey = definitionKey ?? throw new ArgumentNullException(nameof(definitionKey));
    }

    public ItemInstanceId ItemInstanceId { get; }

    public ContentDefinitionKey DefinitionKey { get; }
}

/// <summary>
/// Inventory owns possession and the concrete item-instance to content-definition relationship.
/// An item remains possessed by Inventory while equipped; Equipment owns only slot bindings.
/// </summary>
public sealed record InventorySnapshot : IAuthoritativeSnapshot
{
    public static ContractDescriptor SnapshotContract { get; } = new("nexis.inventory.snapshot", 1);

    public static OwnerKey OwnerKey { get; } = new("Inventory");

    public InventorySnapshot(
        CharacterId characterId,
        long revision,
        IEnumerable<InventoryItemReference> items)
    {
        if (characterId.IsEmpty)
        {
            throw new ArgumentException("Inventory snapshots require a non-empty CharacterId.", nameof(characterId));
        }

        if (revision < 0)
        {
            throw new ArgumentOutOfRangeException(nameof(revision), "Snapshot revision cannot be negative.");
        }

        ArgumentNullException.ThrowIfNull(items);
        var frozen = items.ToArray();
        if (frozen.Any(static item => item is null))
        {
            throw new ArgumentException("Inventory snapshots cannot contain null item references.", nameof(items));
        }

        if (frozen.Select(static item => item.ItemInstanceId).Distinct().Count() != frozen.Length)
        {
            throw new ArgumentException("Inventory snapshots cannot contain the same item instance more than once.", nameof(items));
        }

        CharacterId = characterId;
        Revision = revision;
        Items = Array.AsReadOnly(frozen);
    }

    public ContractDescriptor Contract => SnapshotContract;

    public OwnerKey Owner => OwnerKey;

    public CharacterId CharacterId { get; }

    public long Revision { get; }

    public IReadOnlyList<InventoryItemReference> Items { get; }
}
