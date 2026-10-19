using Nexis.Core.Contracts;
using Nexis.Items.Contracts;

namespace Nexis.Inventory.Contracts;

/// <summary>
/// Typed, authoritative declaration that an existing Inventory reservation may not be released
/// through the ordinary release path. Inventory owns item availability; <see cref="DeclaringOwner"/>
/// names the authority that placed the restriction so a denial is attributable.
///
/// This is the integration seam for a future approved curse/effect authority. That owner declares a
/// restriction through this typed boundary; it does not gain a private write path into Inventory or
/// Equipment, and Equipment never becomes a persistent-effects database. See
/// docs/ITEM-AVAILABILITY-RESERVATION.md.
/// </summary>
public sealed record ItemReleaseRestriction
{
    public ItemReleaseRestriction(OwnerKey declaringOwner)
    {
        DeclaringOwner = declaringOwner ?? throw new ArgumentNullException(nameof(declaringOwner));
    }

    public OwnerKey DeclaringOwner { get; }
}

/// <summary>
/// M-reserve: possession stays with Inventory while an item is committed to another authoritative
/// use. The reservation is the single authoritative answer to whether the item instance is
/// available for another ownership-changing or consuming action.
///
/// Identity is the stable (character, item instance) pair. No surrogate identifier is minted,
/// because Core must produce reservation transitions deterministically for replay.
/// </summary>
public sealed record InventoryItemReservation
{
    public InventoryItemReservation(
        ItemInstanceId itemInstanceId,
        OwnerKey holdingOwner,
        ItemReleaseRestriction? releaseRestriction = null)
    {
        if (itemInstanceId.IsEmpty)
        {
            throw new ArgumentException("Inventory reservations require a non-empty ItemInstanceId.", nameof(itemInstanceId));
        }

        ItemInstanceId = itemInstanceId;
        HoldingOwner = holdingOwner ?? throw new ArgumentNullException(nameof(holdingOwner));
        ReleaseRestriction = releaseRestriction;
    }

    public ItemInstanceId ItemInstanceId { get; }

    public OwnerKey HoldingOwner { get; }

    public ItemReleaseRestriction? ReleaseRestriction { get; }

    public bool IsOrdinarilyReleasable => ReleaseRestriction is null;
}
