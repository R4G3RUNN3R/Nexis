using Nexis.Core.Contracts;
using Nexis.Identity.Contracts;
using Nexis.Items.Contracts;

namespace Nexis.Inventory.Contracts;

/// <summary>
/// Commits an item instance to one holding owner while possession stays with Inventory. This is
/// never an ownership transfer: no item is created, destroyed or moved to another character.
/// </summary>
public sealed record ReserveInventoryItemTransition : IOwnerTransition
{
    public static ContractDescriptor TransitionContract { get; } = new("nexis.inventory.reserve-item", 1);

    public ReserveInventoryItemTransition(
        long expectedRevision,
        CharacterId characterId,
        ItemInstanceId itemInstanceId,
        OwnerKey holdingOwner)
    {
        if (expectedRevision < 0)
        {
            throw new ArgumentOutOfRangeException(nameof(expectedRevision));
        }

        if (characterId.IsEmpty || itemInstanceId.IsEmpty)
        {
            throw new ArgumentException("Inventory reservation transitions require non-empty character and item identities.");
        }

        ExpectedRevision = expectedRevision;
        CharacterId = characterId;
        ItemInstanceId = itemInstanceId;
        HoldingOwner = holdingOwner ?? throw new ArgumentNullException(nameof(holdingOwner));
    }

    public ContractDescriptor Contract => TransitionContract;

    public OwnerKey TargetOwner => InventorySnapshot.OwnerKey;

    public long? ExpectedRevision { get; }

    public CharacterId CharacterId { get; }

    public ItemInstanceId ItemInstanceId { get; }

    public OwnerKey HoldingOwner { get; }
}

/// <summary>
/// Releases an existing reservation held by <see cref="HoldingOwner"/>, making the item available
/// again. Possession is unchanged. A reservation carrying an ItemReleaseRestriction is not
/// releasable through this transition.
/// </summary>
public sealed record ReleaseInventoryItemReservationTransition : IOwnerTransition
{
    public static ContractDescriptor TransitionContract { get; } = new("nexis.inventory.release-item-reservation", 1);

    public ReleaseInventoryItemReservationTransition(
        long expectedRevision,
        CharacterId characterId,
        ItemInstanceId itemInstanceId,
        OwnerKey holdingOwner)
    {
        if (expectedRevision < 0)
        {
            throw new ArgumentOutOfRangeException(nameof(expectedRevision));
        }

        if (characterId.IsEmpty || itemInstanceId.IsEmpty)
        {
            throw new ArgumentException("Inventory release transitions require non-empty character and item identities.");
        }

        ExpectedRevision = expectedRevision;
        CharacterId = characterId;
        ItemInstanceId = itemInstanceId;
        HoldingOwner = holdingOwner ?? throw new ArgumentNullException(nameof(holdingOwner));
    }

    public ContractDescriptor Contract => TransitionContract;

    public OwnerKey TargetOwner => InventorySnapshot.OwnerKey;

    public long? ExpectedRevision { get; }

    public CharacterId CharacterId { get; }

    public ItemInstanceId ItemInstanceId { get; }

    public OwnerKey HoldingOwner { get; }
}
