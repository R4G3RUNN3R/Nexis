using System.Text.Json;
using Microsoft.VisualStudio.TestTools.UnitTesting;
using Nexis.Combat.Contracts;
using Nexis.Content.Contracts;
using Nexis.Core;
using Nexis.Core.Contracts;
using Nexis.Equipment.Contracts;
using Nexis.Identity.Contracts;
using Nexis.Inventory.Contracts;
using Nexis.Items.Contracts;
using Nexis.Kernel.Commands;
using Nexis.Kernel.Events;
using Nexis.Kernel.Randomness;
using Nexis.Modules.Equipment;

namespace Nexis.Architecture.Tests;

[TestClass]
public sealed class EquipItemVerticalTests
{
    private static readonly EquipmentSlotKey MainHand = new("main-hand");
    private static readonly EquipmentSlotKey OffHand = new("off-hand");
    private static readonly EquipmentPlacementKey MainHandPlacement = new("main-hand");

    [TestMethod]
    public void DomainContracts_AreInfrastructureNeutral()
    {
        var assemblies = new[]
        {
            typeof(InventorySnapshot).Assembly,
            typeof(EquipmentSnapshot).Assembly,
            typeof(CombatParticipationSnapshot).Assembly,
            typeof(ItemInstanceId).Assembly
        };
        var forbidden = new[] { "Npgsql", "EntityFrameworkCore", "AspNetCore", "StackExchange.Redis" };

        foreach (var assembly in assemblies)
        {
            var references = assembly.GetReferencedAssemblies()
                .Select(static reference => reference.Name ?? string.Empty)
                .ToArray();
            Assert.IsFalse(
                references.Any(reference => forbidden.Any(fragment => reference.Contains(fragment, StringComparison.OrdinalIgnoreCase))),
                $"{assembly.GetName().Name} leaked infrastructure references: {string.Join(", ", references)}");
        }
    }

    [TestMethod]
    public void Snapshots_RejectDuplicatePossessionAndOverlappingEquipmentSlots()
    {
        var characterId = CharacterId.New();
        var itemId = ItemInstanceId.New();
        var definitionKey = EquippableKey("iron-sword");

        Assert.ThrowsExactly<ArgumentException>(() => new InventorySnapshot(
            characterId,
            1,
            new[]
            {
                new InventoryItemReference(itemId, definitionKey),
                new InventoryItemReference(itemId, definitionKey)
            }));

        Assert.ThrowsExactly<ArgumentException>(() => new EquipmentSnapshot(
            characterId,
            1,
            new[]
            {
                new EquippedItemBinding(ItemInstanceId.New(), MainHandPlacement, new[] { MainHand }),
                new EquippedItemBinding(ItemInstanceId.New(), new EquipmentPlacementKey("alternate"), new[] { MainHand })
            }));
    }

    [TestMethod]
    public void EquipCodec_RoundTripsWithoutRuntimeTypeMetadata()
    {
        var codec = new EquipItemCanonicalCommandCodec();
        var intent = new EquipItemIntent(CharacterId.New(), ItemInstanceId.New(), MainHandPlacement);

        var payload = codec.Serialize(intent);
        var recovered = codec.Deserialize(payload);

        Assert.AreEqual(intent, recovered);
        Assert.IsFalse(payload.Json.Contains("$type", StringComparison.OrdinalIgnoreCase));
    }

    [TestMethod]
    public void EquipCodec_RejectsUnknownPayloadProperties()
    {
        var codec = new EquipItemCanonicalCommandCodec();
        var payload = Nexis.Execution.Contracts.CanonicalCommandPayload.FromTrustedJson(
            JsonSerializer.Serialize(new
            {
                characterId = Guid.NewGuid().ToString("D"),
                itemInstanceId = Guid.NewGuid().ToString("D"),
                placement = "main-hand",
                unexpected = true
            }));

        Assert.ThrowsExactly<FormatException>(() => codec.Deserialize(payload));
    }

    [TestMethod]
    public void EquipSuccess_WritesOnlyEquipmentOwnerAndEmitsSemanticEvent()
    {
        var fixture = CreateFixture();
        var decision = Evaluate(fixture);

        Assert.AreEqual(CoreOutcomeStatus.Succeeded, decision.Status);
        Assert.AreEqual(1, decision.Transitions.Count);
        Assert.IsInstanceOfType<EquipItemTransition>(decision.Transitions[0]);
        Assert.AreEqual(EquipmentSnapshot.OwnerKey, decision.Transitions[0].TargetOwner);
        Assert.IsFalse(decision.Transitions.Any(transition => transition.TargetOwner == InventorySnapshot.OwnerKey));
        Assert.AreEqual(1, decision.Events.Count);
        Assert.IsInstanceOfType<ItemEquippedEvent>(decision.Events[0]);
    }

    [TestMethod]
    public void EquipSuccess_ReevaluationIsDeterministic()
    {
        var fixture = CreateFixture();
        var first = Evaluate(fixture);
        var second = Evaluate(fixture);

        Assert.AreEqual(first.Status, second.Status);
        Assert.AreEqual(first.Reason, second.Reason);
        CollectionAssert.AreEqual(first.Transitions.ToArray(), second.Transitions.ToArray());
        CollectionAssert.AreEqual(first.Events.ToArray(), second.Events.ToArray());
    }

    [TestMethod]
    public void Equip_RejectsActorMismatchAndActiveCombat()
    {
        var mismatch = Evaluate(CreateFixture(actorCharacterId: CharacterId.New()));
        Assert.AreEqual(CoreOutcomeStatus.Rejected, mismatch.Status);
        Assert.AreEqual("equipment.actor.character_mismatch", mismatch.Reason?.Value);

        var activeCombat = Evaluate(CreateFixture(inActiveCombat: true));
        Assert.AreEqual(CoreOutcomeStatus.Rejected, activeCombat.Status);
        Assert.AreEqual("equipment.combat.active", activeCombat.Reason?.Value);
    }

    [TestMethod]
    public void Equip_RejectsMissingPossessionUnsupportedPlacementAndOccupiedSlot()
    {
        var missing = Evaluate(CreateFixture(includePossession: false));
        Assert.AreEqual("equipment.item.not_possessed", missing.Reason?.Value);

        var unsupported = Evaluate(CreateFixture(intentPlacement: new EquipmentPlacementKey("head")));
        Assert.AreEqual("equipment.placement.unsupported", unsupported.Reason?.Value);

        var occupied = Evaluate(CreateFixture(existingBindings: new[]
        {
            new EquippedItemBinding(ItemInstanceId.New(), MainHandPlacement, new[] { MainHand })
        }));
        Assert.AreEqual("equipment.placement.occupied", occupied.Reason?.Value);
        Assert.AreEqual(0, occupied.Transitions.Count);
    }

    [TestMethod]
    public void Equip_RequiresExactTypedContentDefinition()
    {
        var missing = Evaluate(CreateFixture(includeContent: false));
        Assert.AreEqual(CoreOutcomeStatus.TechnicalFailure, missing.Status);
        Assert.AreEqual("equipment.content.definition_missing", missing.Reason?.Value);

        var wrongKey = new ContentDefinitionKey(
            new ContractDescriptor("nexis.items.misc-definition", 1),
            new ContentDefinitionId("iron-sword"));
        var notEquippable = Evaluate(CreateFixture(itemDefinitionKey: wrongKey));
        Assert.AreEqual(CoreOutcomeStatus.Rejected, notEquippable.Status);
        Assert.AreEqual("equipment.item.not_equippable", notEquippable.Reason?.Value);
    }

    [TestMethod]
    public void Equip_TwoSlotPlacementRejectsWhenEitherRequiredSlotIsOccupied()
    {
        var twoHanded = new EquippableItemDefinition(
            new ContentDefinitionId("greatsword"),
            new[]
            {
                new EquipmentPlacementDefinition(
                    new EquipmentPlacementKey("two-hand"),
                    new[] { MainHand, OffHand })
            });
        var fixture = CreateFixture(
            definition: twoHanded,
            intentPlacement: new EquipmentPlacementKey("two-hand"),
            existingBindings: new[]
            {
                new EquippedItemBinding(ItemInstanceId.New(), new EquipmentPlacementKey("off-hand"), new[] { OffHand })
            });

        var decision = Evaluate(fixture);

        Assert.AreEqual(CoreOutcomeStatus.Rejected, decision.Status);
        Assert.AreEqual("equipment.placement.occupied", decision.Reason?.Value);
    }

    private static CoreDecision Evaluate(Fixture fixture)
    {
        var content = fixture.IncludeContent
            ? new ICoreContentInput[] { fixture.Definition }
            : Array.Empty<ICoreContentInput>();
        var request = new CoreEvaluationRequest(
            CoreContractVersion.V1,
            new CoreEvaluationContext(
                CommandId.New(),
                CorrelationId.New(),
                TrustedActorContext.CreatePlayer(AccountId.New(), fixture.ActorCharacterId, 1),
                new DateTimeOffset(2026, 8, 26, 10, 0, 0, TimeSpan.Zero),
                new RuleVersion("equip-rules-v1"),
                new ContentVersion("equip-content-v1"),
                new FixedRandomFactory()),
            new EquipItemIntent(fixture.CharacterId, fixture.ItemId, fixture.Placement),
            new IAuthoritativeSnapshot[] { fixture.Inventory, fixture.Equipment, fixture.Combat },
            content);

        return new CoreRulesEngine().Evaluate(request);
    }

    private static Fixture CreateFixture(
        bool inActiveCombat = false,
        bool includePossession = true,
        bool includeContent = true,
        CharacterId? actorCharacterId = null,
        ContentDefinitionKey? itemDefinitionKey = null,
        EquippableItemDefinition? definition = null,
        EquipmentPlacementKey? intentPlacement = null,
        IEnumerable<EquippedItemBinding>? existingBindings = null)
    {
        var characterId = CharacterId.New();
        var itemId = ItemInstanceId.New();
        definition ??= new EquippableItemDefinition(
            new ContentDefinitionId("iron-sword"),
            new[]
            {
                new EquipmentPlacementDefinition(MainHandPlacement, new[] { MainHand }),
                new EquipmentPlacementDefinition(new EquipmentPlacementKey("off-hand"), new[] { OffHand })
            });
        itemDefinitionKey ??= new ContentDefinitionKey(definition.Contract, definition.DefinitionId);

        var items = includePossession
            ? new[] { new InventoryItemReference(itemId, itemDefinitionKey) }
            : Array.Empty<InventoryItemReference>();

        return new Fixture(
            characterId,
            actorCharacterId ?? characterId,
            itemId,
            intentPlacement ?? MainHandPlacement,
            new InventorySnapshot(characterId, 5, items),
            new EquipmentSnapshot(characterId, 9, existingBindings ?? Array.Empty<EquippedItemBinding>()),
            new CombatParticipationSnapshot(characterId, 3, inActiveCombat),
            definition,
            includeContent);
    }

    private static ContentDefinitionKey EquippableKey(string id) =>
        new(EquippableItemDefinition.ContractDescriptor, new ContentDefinitionId(id));

    private sealed record Fixture(
        CharacterId CharacterId,
        CharacterId ActorCharacterId,
        ItemInstanceId ItemId,
        EquipmentPlacementKey Placement,
        InventorySnapshot Inventory,
        EquipmentSnapshot Equipment,
        CombatParticipationSnapshot Combat,
        EquippableItemDefinition Definition,
        bool IncludeContent);

    private sealed class FixedRandomFactory : IDeterministicRandomFactory
    {
        public IDeterministicRandomSource Create() => new FixedRandomSource();

        private sealed class FixedRandomSource : IDeterministicRandomSource
        {
            public ulong NextUInt64() => 1;
        }
    }
}
