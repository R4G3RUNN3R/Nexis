using Microsoft.VisualStudio.TestTools.UnitTesting;
using Nexis.Content.Contracts;
using Nexis.Core.Contracts;
using Nexis.Equipment.Contracts;
using Nexis.Identity.Contracts;
using Nexis.Inventory.Contracts;
using Nexis.Items.Contracts;

namespace Nexis.Architecture.Tests;

[TestClass]
public sealed class MReserveUnequipVerticalTests
{
    private static readonly EquipmentSlotKey MainHand = new("main-hand");
    private static readonly EquipmentPlacementKey MainHandPlacement = new("main-hand");

    [TestMethod]
    public void InventorySnapshot_HoldsTheSingleAuthoritativeAvailabilityAnswer()
    {
        var characterId = CharacterId.New();
        var itemId = ItemInstanceId.New();
        var otherId = ItemInstanceId.New();
        var definitionKey = new ContentDefinitionKey(
            EquippableItemDefinition.ContractDescriptor,
            new ContentDefinitionId("iron-sword"));

        var snapshot = new InventorySnapshot(
            characterId,
            5,
            new[]
            {
                new InventoryItemReference(itemId, definitionKey),
                new InventoryItemReference(otherId, definitionKey)
            },
            new[]
            {
                new InventoryItemReservation(itemId, EquipmentSnapshot.OwnerKey)
            });

        Assert.AreEqual(2, InventorySnapshot.SnapshotContract.SchemaVersion);
        Assert.AreEqual(1, snapshot.Reservations.Count);
        Assert.AreEqual(EquipmentSnapshot.OwnerKey, snapshot.FindReservation(itemId)?.HoldingOwner);
        Assert.IsTrue(snapshot.FindReservation(itemId)!.IsOrdinarilyReleasable);
        Assert.IsNull(snapshot.FindReservation(otherId));
    }

    [TestMethod]
    public void InventoryReservation_CarriesTheOwnerThatDeclaredAReleaseRestriction()
    {
        var reservation = new InventoryItemReservation(
            ItemInstanceId.New(),
            EquipmentSnapshot.OwnerKey,
            new ItemReleaseRestriction(new OwnerKey("Curse")));

        Assert.IsFalse(reservation.IsOrdinarilyReleasable);
        Assert.AreEqual(new OwnerKey("Curse"), reservation.ReleaseRestriction?.DeclaringOwner);
    }

    [TestMethod]
    public void InventorySnapshot_RejectsUnpossessedDuplicateAndNullReservations()
    {
        var characterId = CharacterId.New();
        var itemId = ItemInstanceId.New();
        var definitionKey = new ContentDefinitionKey(
            EquippableItemDefinition.ContractDescriptor,
            new ContentDefinitionId("iron-sword"));
        var items = new[] { new InventoryItemReference(itemId, definitionKey) };

        Assert.ThrowsExactly<ArgumentException>(() => new InventorySnapshot(
            characterId,
            1,
            items,
            new[] { new InventoryItemReservation(ItemInstanceId.New(), EquipmentSnapshot.OwnerKey) }));

        Assert.ThrowsExactly<ArgumentException>(() => new InventorySnapshot(
            characterId,
            1,
            items,
            new[]
            {
                new InventoryItemReservation(itemId, EquipmentSnapshot.OwnerKey),
                new InventoryItemReservation(itemId, new OwnerKey("Marketplace"))
            }));

        Assert.ThrowsExactly<ArgumentException>(() => new InventorySnapshot(
            characterId,
            1,
            items,
            new InventoryItemReservation[] { null! }));
    }
}
