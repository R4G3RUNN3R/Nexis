using System.Text.Json;
using Microsoft.VisualStudio.TestTools.UnitTesting;
using Nexis.Combat.Contracts;
using Nexis.Content.Contracts;
using Nexis.Core;
using Nexis.Core.Contracts;
using Nexis.Equipment.Contracts;
using Nexis.Execution;
using Nexis.Execution.Contracts;
using Nexis.Identity.Contracts;
using Nexis.Inventory.Contracts;
using Nexis.Items.Contracts;
using Nexis.Kernel.Commands;
using Nexis.Kernel.Events;
using Nexis.Kernel.Randomness;
using Nexis.Modules.Equipment;

namespace Nexis.Architecture.Tests;

/// <summary>
/// In-memory Core coverage for the M-reserve availability vocabulary and the unequip rule:
/// Equipment clears its binding while Inventory releases the same reservation, in one decision,
/// with possession never changing.
/// </summary>
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

    [TestMethod]
    public void InventoryTransitions_AddressInventoryAndCarryTheHoldingOwner()
    {
        var characterId = CharacterId.New();
        var itemId = ItemInstanceId.New();

        var reserve = new ReserveInventoryItemTransition(7, characterId, itemId, EquipmentSnapshot.OwnerKey);
        var release = new ReleaseInventoryItemReservationTransition(7, characterId, itemId, EquipmentSnapshot.OwnerKey);

        Assert.AreEqual(InventorySnapshot.OwnerKey, reserve.TargetOwner);
        Assert.AreEqual(InventorySnapshot.OwnerKey, release.TargetOwner);
        Assert.AreEqual("nexis.inventory.reserve-item", reserve.Contract.Name);
        Assert.AreEqual("nexis.inventory.release-item-reservation", release.Contract.Name);
        Assert.AreEqual(1, reserve.Contract.SchemaVersion);
        Assert.AreEqual(1, release.Contract.SchemaVersion);
        Assert.AreEqual(7L, reserve.ExpectedRevision);
        Assert.AreEqual(EquipmentSnapshot.OwnerKey, release.HoldingOwner);
        Assert.AreEqual(itemId, release.ItemInstanceId);
    }

    [TestMethod]
    public void InventoryTransitions_RejectNegativeRevisionsAndEmptyIdentities()
    {
        var characterId = CharacterId.New();
        var itemId = ItemInstanceId.New();

        Assert.ThrowsExactly<ArgumentOutOfRangeException>(() =>
            new ReserveInventoryItemTransition(-1, characterId, itemId, EquipmentSnapshot.OwnerKey));
        Assert.ThrowsExactly<ArgumentOutOfRangeException>(() =>
            new ReleaseInventoryItemReservationTransition(-1, characterId, itemId, EquipmentSnapshot.OwnerKey));
        Assert.ThrowsExactly<ArgumentNullException>(() =>
            new ReserveInventoryItemTransition(0, characterId, itemId, null!));
        Assert.ThrowsExactly<ArgumentNullException>(() =>
            new ReleaseInventoryItemReservationTransition(0, characterId, itemId, null!));
    }

    [TestMethod]
    public void UnequipSuccess_ClearsEquipmentAndReleasesTheSameInventoryReservation()
    {
        var fixture = CreateUnequipFixture();
        var decision = EvaluateUnequip(fixture);

        Assert.AreEqual(CoreOutcomeStatus.Succeeded, decision.Status);
        Assert.AreEqual(2, decision.Transitions.Count);

        var unbind = (UnequipItemTransition)decision.Transitions[0];
        Assert.AreEqual(EquipmentSnapshot.OwnerKey, unbind.TargetOwner);
        Assert.AreEqual(fixture.ItemId, unbind.ItemInstanceId);
        Assert.AreEqual(MainHandPlacement, unbind.PlacementKey);
        CollectionAssert.AreEqual(new[] { MainHand }, unbind.ReleasedSlots.ToArray());
        Assert.AreEqual(fixture.Equipment.Revision, unbind.ExpectedRevision!.Value);

        var release = (ReleaseInventoryItemReservationTransition)decision.Transitions[1];
        Assert.AreEqual(InventorySnapshot.OwnerKey, release.TargetOwner);
        Assert.AreEqual(fixture.ItemId, release.ItemInstanceId);
        Assert.AreEqual(EquipmentSnapshot.OwnerKey, release.HoldingOwner);
        Assert.AreEqual(fixture.Inventory.Revision, release.ExpectedRevision!.Value);

        Assert.AreEqual(1, decision.Events.Count);
        Assert.IsInstanceOfType<ItemUnequippedEvent>(decision.Events[0]);
    }

    /// <summary>
    /// Unequip is the inverse of equip, not a disposal. Inventory keeps possession throughout, so
    /// the only Inventory transition the rule may emit is the release of its own reservation.
    /// </summary>
    [TestMethod]
    public void UnequipTransitions_NeverCreateOrDestroyItemPossession()
    {
        var decision = EvaluateUnequip(CreateUnequipFixture());

        var inventoryTransitions = decision.Transitions
            .Where(static transition => transition.TargetOwner == InventorySnapshot.OwnerKey)
            .ToArray();

        Assert.AreEqual(1, inventoryTransitions.Length);
        Assert.IsInstanceOfType<ReleaseInventoryItemReservationTransition>(inventoryTransitions[0]);
        Assert.IsFalse(
            decision.Transitions.Any(static transition =>
                transition.Contract.Name.Contains("possession", StringComparison.OrdinalIgnoreCase) ||
                transition.Contract.Name.Contains("transfer", StringComparison.OrdinalIgnoreCase) ||
                transition.Contract.Name.Contains("grant", StringComparison.OrdinalIgnoreCase) ||
                transition.Contract.Name.Contains("destroy", StringComparison.OrdinalIgnoreCase)),
            "Unequip must not emit an ownership-transferring Inventory transition. STATE-OWNERSHIP.md "
            + "section 8 keeps possession with Inventory across the whole equip/unequip cycle.");
    }

    [TestMethod]
    public void UnequipSuccess_ReevaluationIsDeterministic()
    {
        var fixture = CreateUnequipFixture();
        var first = EvaluateUnequip(fixture);
        var second = EvaluateUnequip(fixture);

        Assert.AreEqual(first.Status, second.Status);
        CollectionAssert.AreEqual(first.Transitions.ToArray(), second.Transitions.ToArray());
        CollectionAssert.AreEqual(first.Events.ToArray(), second.Events.ToArray());
    }

    [TestMethod]
    public void UnequipDeniedByReleaseRestriction_ProducesNoOwnerTransitionAtAll()
    {
        var fixture = CreateUnequipFixture(restrictedBy: new OwnerKey("Curse"));
        var decision = EvaluateUnequip(fixture);

        Assert.AreEqual(CoreOutcomeStatus.Rejected, decision.Status);
        Assert.AreEqual("equipment.unequip.release_restricted", decision.Reason?.Value);
        Assert.AreEqual(0, decision.Transitions.Count);
        Assert.AreEqual(0, decision.Events.Count);
    }

    [TestMethod]
    public void Unequip_RejectsActorMismatchActiveCombatAndAnItemThatIsNotEquipped()
    {
        var mismatch = EvaluateUnequip(CreateUnequipFixture(actorCharacterId: CharacterId.New()));
        Assert.AreEqual("equipment.actor.character_mismatch", mismatch.Reason?.Value);

        var combat = EvaluateUnequip(CreateUnequipFixture(inActiveCombat: true));
        Assert.AreEqual("equipment.combat.active", combat.Reason?.Value);

        var notEquipped = EvaluateUnequip(CreateUnequipFixture(includeBinding: false));
        Assert.AreEqual("equipment.item.not_equipped", notEquipped.Reason?.Value);
        Assert.AreEqual(0, notEquipped.Transitions.Count);
    }

    [TestMethod]
    public void Unequip_TreatsInconsistentOwnerStateAsTechnicalFailureNotAGameplayRejection()
    {
        // Every one of these is Equipment and Inventory disagreeing about the same item. None of
        // them is something the player did, so none may be reported as an in-world rejection.
        var missing = EvaluateUnequip(CreateUnequipFixture(includeReservation: false));
        Assert.AreEqual(CoreOutcomeStatus.TechnicalFailure, missing.Status);
        Assert.AreEqual("equipment.reservation.missing", missing.Reason?.Value);

        var foreign = EvaluateUnequip(CreateUnequipFixture(reservedBy: new OwnerKey("Marketplace")));
        Assert.AreEqual(CoreOutcomeStatus.TechnicalFailure, foreign.Status);
        Assert.AreEqual("equipment.reservation.foreign_holder", foreign.Reason?.Value);
    }

    [TestMethod]
    public void UnequipCodec_RoundTripsWithoutRuntimeTypeMetadata()
    {
        var codec = new UnequipItemCanonicalCommandCodec();
        var intent = new UnequipItemIntent(CharacterId.New(), ItemInstanceId.New());

        var payload = codec.Serialize(intent);
        var recovered = codec.Deserialize(payload);

        Assert.AreEqual(intent, recovered);
        Assert.IsFalse(payload.Json.Contains("$type", StringComparison.OrdinalIgnoreCase));
        Assert.AreEqual(UnequipItemIntent.IntentContract, codec.IntentContract);
    }

    [TestMethod]
    public void UnequipCodec_RejectsUnknownDuplicateAndMalformedPayloadProperties()
    {
        var codec = new UnequipItemCanonicalCommandCodec();

        var unknown = CanonicalCommandPayload.FromTrustedJson(
            JsonSerializer.Serialize(new
            {
                characterId = Guid.NewGuid().ToString("D"),
                itemInstanceId = Guid.NewGuid().ToString("D"),
                unexpected = true
            }));
        Assert.ThrowsExactly<FormatException>(() => codec.Deserialize(unknown));

        var malformed = CanonicalCommandPayload.FromTrustedJson(
            JsonSerializer.Serialize(new
            {
                characterId = "not-a-guid",
                itemInstanceId = Guid.NewGuid().ToString("D")
            }));
        Assert.ThrowsExactly<FormatException>(() => codec.Deserialize(malformed));
    }

    [TestMethod]
    public void UnequipCodec_RegistersAlongsideEquipWithoutContractCollision()
    {
        var registry = new CanonicalCommandCodecRegistry(
            new ICanonicalCommandCodec[]
            {
                new EquipItemCanonicalCommandCodec(),
                new UnequipItemCanonicalCommandCodec()
            });

        var intent = new UnequipItemIntent(CharacterId.New(), ItemInstanceId.New());
        var payload = registry.Serialize(intent);

        Assert.AreEqual(intent, registry.Deserialize(UnequipItemIntent.IntentContract, payload));
    }

    private static CoreDecision EvaluateUnequip(UnequipFixture fixture)
    {
        var request = new CoreEvaluationRequest(
            CoreContractVersion.V1,
            new CoreEvaluationContext(
                CommandId.New(),
                CorrelationId.New(),
                TrustedActorContext.CreatePlayer(AccountId.New(), fixture.ActorCharacterId, 1),
                new DateTimeOffset(2026, 8, 29, 10, 0, 0, TimeSpan.Zero),
                new RuleVersion("unequip-rules-v1"),
                new ContentVersion("unequip-content-v1"),
                new FixedRandomFactory()),
            new UnequipItemIntent(fixture.CharacterId, fixture.ItemId),
            new IAuthoritativeSnapshot[] { fixture.Inventory, fixture.Equipment, fixture.Combat });

        return new CoreRulesEngine().Evaluate(request);
    }

    private static UnequipFixture CreateUnequipFixture(
        bool inActiveCombat = false,
        bool includeBinding = true,
        bool includeReservation = true,
        CharacterId? actorCharacterId = null,
        OwnerKey? reservedBy = null,
        OwnerKey? restrictedBy = null)
    {
        var characterId = CharacterId.New();
        var itemId = ItemInstanceId.New();
        var definitionKey = new ContentDefinitionKey(
            EquippableItemDefinition.ContractDescriptor,
            new ContentDefinitionId("iron-sword"));

        var reservations = includeReservation
            ? new[]
            {
                new InventoryItemReservation(
                    itemId,
                    reservedBy ?? EquipmentSnapshot.OwnerKey,
                    restrictedBy is null ? null : new ItemReleaseRestriction(restrictedBy))
            }
            : Array.Empty<InventoryItemReservation>();

        var bindings = includeBinding
            ? new[] { new EquippedItemBinding(itemId, MainHandPlacement, new[] { MainHand }) }
            : Array.Empty<EquippedItemBinding>();

        return new UnequipFixture(
            characterId,
            actorCharacterId ?? characterId,
            itemId,
            new InventorySnapshot(
                characterId,
                5,
                new[] { new InventoryItemReference(itemId, definitionKey) },
                reservations),
            new EquipmentSnapshot(characterId, 9, bindings),
            new CombatParticipationSnapshot(characterId, 3, inActiveCombat));
    }

    private sealed record UnequipFixture(
        CharacterId CharacterId,
        CharacterId ActorCharacterId,
        ItemInstanceId ItemId,
        InventorySnapshot Inventory,
        EquipmentSnapshot Equipment,
        CombatParticipationSnapshot Combat);

    private sealed class FixedRandomFactory : IDeterministicRandomFactory
    {
        public IDeterministicRandomSource Create() => new FixedRandomSource();

        private sealed class FixedRandomSource : IDeterministicRandomSource
        {
            public ulong NextUInt64() => 1;
        }
    }
}
