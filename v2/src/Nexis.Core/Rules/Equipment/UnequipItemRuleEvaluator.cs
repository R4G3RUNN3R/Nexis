using Nexis.Combat.Contracts;
using Nexis.Core.Contracts;
using Nexis.Equipment.Contracts;
using Nexis.Inventory.Contracts;
using Nexis.Kernel.Commands;

namespace Nexis.Core.Rules.Equipment;

/// <summary>
/// The inverse of the Equip Item rule under M-reserve, and the approved C3 multi-owner proof.
/// Equipment clears its binding and Inventory releases the same reservation in one decision.
/// Possession never changes. Stats, skills and knowledge are deliberately not consulted: removal is
/// blocked only by an authoritative in-world restriction, never by capability.
/// </summary>
internal sealed class UnequipItemRuleEvaluator : ICoreRuleEvaluator
{
    private static readonly CoreReasonCode PlayerActorRequired = new("equipment.actor.player_required");
    private static readonly CoreReasonCode ActorCharacterMismatch = new("equipment.actor.character_mismatch");
    private static readonly CoreReasonCode InventorySnapshotInvalid = new("equipment.snapshot.inventory_invalid");
    private static readonly CoreReasonCode EquipmentSnapshotInvalid = new("equipment.snapshot.equipment_invalid");
    private static readonly CoreReasonCode CombatSnapshotInvalid = new("equipment.snapshot.combat_invalid");
    private static readonly CoreReasonCode ActiveCombat = new("equipment.combat.active");
    private static readonly CoreReasonCode ItemNotEquipped = new("equipment.item.not_equipped");
    private static readonly CoreReasonCode ItemNotPossessed = new("equipment.item.not_possessed");
    private static readonly CoreReasonCode ReservationMissing = new("equipment.reservation.missing");
    private static readonly CoreReasonCode ReservationForeignHolder = new("equipment.reservation.foreign_holder");
    private static readonly CoreReasonCode ReleaseRestricted = new("equipment.unequip.release_restricted");

    public ContractDescriptor IntentContract => UnequipItemIntent.IntentContract;

    public CoreDecision Evaluate(CoreRuleExecutionContext context)
    {
        ArgumentNullException.ThrowIfNull(context);

        if (context.Intent is not UnequipItemIntent intent)
        {
            throw new InvalidOperationException("Unequip Item evaluator received a different intent type for its registered contract.");
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

        var binding = equipment!.Bindings
            .SingleOrDefault(candidate => candidate.ItemInstanceId == intent.ItemInstanceId);
        if (binding is null)
        {
            return CoreDecision.Rejected(ItemNotEquipped);
        }

        // Owner states that disagree are an integrity problem, not an in-world outcome. Equipment
        // holding a binding for an item Inventory does not possess is corruption, not a rejection.
        if (inventory!.Items.All(item => item.ItemInstanceId != intent.ItemInstanceId))
        {
            return CoreDecision.TechnicalFailure(ItemNotPossessed);
        }

        var reservation = inventory.FindReservation(intent.ItemInstanceId);
        if (reservation is null)
        {
            return CoreDecision.TechnicalFailure(ReservationMissing);
        }

        if (reservation.HoldingOwner != EquipmentSnapshot.OwnerKey)
        {
            return CoreDecision.TechnicalFailure(ReservationForeignHolder);
        }

        // An authoritative in-world restriction denies removal before either owner moves. The
        // declaring owner is carried by the restriction so a future curse authority integrates here.
        if (!reservation.IsOrdinarilyReleasable)
        {
            return CoreDecision.Rejected(ReleaseRestricted);
        }

        var unbind = new UnequipItemTransition(
            equipment.Revision,
            intent.CharacterId,
            intent.ItemInstanceId,
            binding.PlacementKey,
            binding.OccupiedSlots);
        var release = new ReleaseInventoryItemReservationTransition(
            inventory.Revision,
            intent.CharacterId,
            intent.ItemInstanceId,
            EquipmentSnapshot.OwnerKey);
        var domainEvent = new ItemUnequippedEvent(
            intent.CharacterId,
            intent.ItemInstanceId,
            binding.PlacementKey,
            binding.OccupiedSlots);

        return CoreDecision.Succeeded(
            transitions: new IOwnerTransition[] { unbind, release },
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
