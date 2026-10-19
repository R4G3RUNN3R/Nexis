# Nexis 2.0 Item Availability and Reservation Boundary

_Status: foundation implementation slice, 2026-08-29. This document narrows `STATE-OWNERSHIP.md` §7 and §8 under the approved M-reserve decision. It does not create a Curse, Effects or item-interaction subsystem._

## Decision

Nexis uses the **M-reserve** model, approved in
`docs/superpowers/specs/2026-08-29-nexis-systemic-item-interaction-design.md` §3.

- Inventory owns possession **and** availability.
- Equipment owns slot bindings only.
- Equipping an item does **not** remove it from Inventory. The superseded V1 M-move mechanism
  (`removeInventory`/`addInventory`) must not be reintroduced.
- There is one authoritative answer to whether an item instance is available for another
  ownership-changing or consuming action: whether Inventory holds a reservation for it.

## Contracts

| Concept | Contract |
| --- | --- |
| Availability fact | `InventoryItemReservation(ItemInstanceId, OwnerKey holdingOwner, ItemReleaseRestriction?)` |
| Removal restriction | `ItemReleaseRestriction(OwnerKey declaringOwner)` |
| Commit an item | `ReserveInventoryItemTransition` (`nexis.inventory.reserve-item` v1) |
| Free an item | `ReleaseInventoryItemReservationTransition` (`nexis.inventory.release-item-reservation` v1) |
| Clear a binding | `UnequipItemTransition` (`nexis.equipment.unbind-item` v1) |

Reservation identity is the stable `(CharacterId, ItemInstanceId)` pair. No surrogate identifier is
minted, because Core must produce reservation transitions deterministically for replay comparison.

## Structural guarantees

`nexis_v2.inventory_item_reservations` enforces the invariants at the database boundary, not only in
C#:

- `UNIQUE (item_instance_id)` — an item instance cannot hold two reservations, so it cannot be
  simultaneously equipped and escrowed, traded, consumed or destroyed.
- `FOREIGN KEY (character_id, item_instance_id)` into `inventory_items` — an unpossessed item cannot
  be reserved.
- The release statement carries `AND restriction_declaring_owner IS NULL AND holding_owner = @o`, so
  a restricted or foreign-held reservation is not releasable even if Core were bypassed or stale.

## Future curse integration seam

`ItemReleaseRestriction.DeclaringOwner` is the **only** curse-related artefact in the foundation, and
it is deliberately empty of curse semantics. No curse state, curse content, questline, purification
path, effect persistence or balance value exists anywhere in Nexis 2.0 today.

When a curse/effect authority is approved and implemented:

1. that owner becomes the authoritative source of the item's cursed-bound condition;
2. it declares removal denial by writing an `ItemReleaseRestriction` naming itself, **through the
   Inventory owner's typed transition boundary** — never by a private write into
   `inventory_item_reservations` or `equipment_bindings`;
3. `UnequipItemRuleEvaluator` already rejects with `equipment.unequip.release_restricted` and the
   Inventory applier already refuses the release, so no rule or persistence change is required to
   make binding effective;
4. curse removal, satisfaction through an approved quest/mission path, and purification are that
   owner's transitions, changing the authoritative source state so dependent effects disappear or
   transform consistently, per the approved design §8.3;
5. Equipment must not become a generic persistent-effects database, per the approved design §11.

Nothing in this slice authorizes an implementer to invent that owner.

## Player freedom

Stats, skills and knowledge are **not** equip or unequip blockers. `MReserveFreedomRuleTests` asserts
this mechanically: Nexis.Core takes no compile-time dependency on a progression/skill/knowledge owner,
and neither equipment rule declares a capability-shaped rejection reason. Removal is blocked only by
an authoritative in-world restriction, never by capability.
