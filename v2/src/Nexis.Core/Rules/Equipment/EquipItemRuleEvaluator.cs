using Nexis.Combat.Contracts;
using Nexis.Core.Contracts;
using Nexis.Equipment.Contracts;
using Nexis.Inventory.Contracts;
using Nexis.Kernel.Commands;

namespace Nexis.Core.Rules.Equipment;

/// <summary>
/// First real Nexis V2 gameplay rule. Persistent loadout equipment is allowed only outside an
/// active Combat encounter, never transfers possession out of Inventory, and binds only to an
/// explicitly selected currently-empty data-defined placement.
/// </summary>
internal sealed class EquipItemRuleEvaluator : ICoreRuleEvaluator
{
    private static readonly CoreReasonCode PlayerActorRequired = new("equipment.actor.player_required");
    private static readonly CoreReasonCode ActorCharacterMismatch = new("equipment.actor.character_mismatch");
    private static readonly CoreReasonCode InventorySnapshotInvalid = new("equipment.snapshot.inventory_invalid");
    private static readonly CoreReasonCode EquipmentSnapshotInvalid = new("equipment.snapshot.equipment_invalid");
    private static readonly CoreReasonCode CombatSnapshotInvalid = new("equipment.snapshot.combat_invalid");
    private static readonly CoreReasonCode ActiveCombat = new("equipment.combat.active");
    private static readonly CoreReasonCode ItemNotPossessed = new("equipment.item.not_possessed");
    private static readonly CoreReasonCode ItemNotEquippable = new("equipment.item.not_equippable");
    private static readonly CoreReasonCode DefinitionMissing = new("equipment.content.definition_missing");
    private static readonly CoreReasonCode DefinitionAmbiguous = new("equipment.content.definition_ambiguous");
    private static readonly CoreReasonCode PlacementUnsupported = new("equipment.placement.unsupported");
    private static readonly CoreReasonCode AlreadyEquipped = new("equipment.item.already_equipped");
    private static readonly CoreReasonCode PlacementOccupied = new("equipment.placement.occupied");

    public ContractDescriptor IntentContract => EquipItemIntent.IntentContract;

    public CoreDecision Evaluate(CoreRuleExecutionContext context)
    {
        ArgumentNullException.ThrowIfNull(context);

        if (context.Intent is not EquipItemIntent intent)
        {
            throw new InvalidOperationException("Equip Item evaluator received a different intent type for its registered contract.");
        }

        var actor = context.Actor;
        if (actor.Lane != CommandExecutionLane.Player || !actor.CharacterId.HasValue)
        {
            return CoreDecision.Rejected(PlayerActorRequired);
        }

        if (actor.CharacterId.Value != intent.CharacterId)
        {
            return CoreDecision.Rejected(ActorCharacterMismatch);
        }

        var inventory = RequireSingleSnapshot<InventorySnapshot>(
            context.Snapshots,
            intent.CharacterId,
            static snapshot => snapshot.CharacterId,
            InventorySnapshotInvalid,
            out var inventoryFailure);
        if (inventoryFailure is not null)
        {
            return inventoryFailure;
        }

        var equipment = RequireSingleSnapshot<EquipmentSnapshot>(
            context.Snapshots,
            intent.CharacterId,
            static snapshot => snapshot.CharacterId,
            EquipmentSnapshotInvalid,
            out var equipmentFailure);
        if (equipmentFailure is not null)
        {
            return equipmentFailure;
        }

        var combat = RequireSingleSnapshot<CombatParticipationSnapshot>(
            context.Snapshots,
            intent.CharacterId,
            static snapshot => snapshot.CharacterId,
            CombatSnapshotInvalid,
            out var combatFailure);
        if (combatFailure is not null)
        {
            return combatFailure;
        }

        if (combat!.IsInActiveCombat)
        {
            return CoreDecision.Rejected(ActiveCombat);
        }

        var possessedItem = inventory!.Items.SingleOrDefault(item => item.ItemInstanceId == intent.ItemInstanceId);
        if (possessedItem is null)
        {
            return CoreDecision.Rejected(ItemNotPossessed);
        }

        if (possessedItem.DefinitionKey.Contract != EquippableItemDefinition.ContractDescriptor)
        {
            return CoreDecision.Rejected(ItemNotEquippable);
        }

        var definitions = context.Content
            .OfType<EquippableItemDefinition>()
            .Where(definition =>
                definition.Contract == possessedItem.DefinitionKey.Contract &&
                definition.DefinitionId == possessedItem.DefinitionKey.DefinitionId)
            .ToArray();

        if (definitions.Length == 0)
        {
            return CoreDecision.TechnicalFailure(DefinitionMissing);
        }

        if (definitions.Length != 1)
        {
            return CoreDecision.TechnicalFailure(DefinitionAmbiguous);
        }

        var placement = definitions[0].Placements
            .SingleOrDefault(candidate => candidate.PlacementKey == intent.PlacementKey);
        if (placement is null)
        {
            return CoreDecision.Rejected(PlacementUnsupported);
        }

        if (equipment!.Bindings.Any(binding => binding.ItemInstanceId == intent.ItemInstanceId))
        {
            return CoreDecision.Rejected(AlreadyEquipped);
        }

        var occupiedSlots = equipment.Bindings
            .SelectMany(static binding => binding.OccupiedSlots)
            .ToHashSet();
        if (placement.OccupiedSlots.Any(occupiedSlots.Contains))
        {
            return CoreDecision.Rejected(PlacementOccupied);
        }

        var transition = new EquipItemTransition(
            equipment.Revision,
            intent.CharacterId,
            intent.ItemInstanceId,
            placement.PlacementKey,
            placement.OccupiedSlots);
        var domainEvent = new ItemEquippedEvent(
            intent.CharacterId,
            intent.ItemInstanceId,
            placement.PlacementKey,
            placement.OccupiedSlots);

        return CoreDecision.Succeeded(
            transitions: new IOwnerTransition[] { transition },
            events: new ICoreEventDescriptor[] { domainEvent });
    }

    private static TSnapshot? RequireSingleSnapshot<TSnapshot>(
        IReadOnlyList<IAuthoritativeSnapshot> snapshots,
        Nexis.Identity.Contracts.CharacterId characterId,
        Func<TSnapshot, Nexis.Identity.Contracts.CharacterId> characterSelector,
        CoreReasonCode failureReason,
        out CoreDecision? failure)
        where TSnapshot : class, IAuthoritativeSnapshot
    {
        var matching = snapshots
            .OfType<TSnapshot>()
            .Where(snapshot => characterSelector(snapshot) == characterId)
            .ToArray();

        if (matching.Length != 1)
        {
            failure = CoreDecision.TechnicalFailure(failureReason);
            return null;
        }

        failure = null;
        return matching[0];
    }
}
