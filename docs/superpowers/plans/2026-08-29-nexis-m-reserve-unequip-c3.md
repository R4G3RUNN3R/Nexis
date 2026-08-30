# Nexis M-Reserve Inventory Reservation and Unequip Item C3 Proof Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement the approved M-reserve item-availability model in Inventory and use it to deliver the C3 proof: `UnequipItem` clearing the Equipment binding and releasing the same Inventory reservation in one atomic, exactly-once, double-spend-proof authoritative command.

**Architecture:** Inventory keeps possession and gains the single authoritative answer to whether an item instance is available. Equip becomes a real two-owner command (Inventory reserves, Equipment binds); unequip is its inverse (Equipment unbinds, Inventory releases). Core decides both from typed snapshots and emits two owner-addressed transitions; the existing `PostgresAtomicCommandCommitter` commits both owners, the terminal receipt, the authoritative event and the outbox in one transaction or none of them. Removal denial is proved with the smallest typed input that already fits the architecture — a nullable `ItemReleaseRestriction` on the Inventory reservation naming the owner that declared it — enforced both by Core and by the Inventory persistence boundary. No Curse subsystem, effect persistence, questline, purification or balance value is created.

**Tech Stack:** C# / .NET 10 (`net10.0`, SDK 10.0.111), MSTest.Sdk 4.3.3, Npgsql 10.0.3, PostgreSQL (disposable container `nexis-claude-cont-20260829` at `127.0.0.1:55501`, `postgres:17.11`), nullable enabled, implicit usings enabled, **warnings treated as errors**, deterministic builds.

**Spec:**
- `docs/superpowers/specs/2026-08-29-nexis-systemic-item-interaction-design.md` (approved design; §3 M-reserve, §8.1 removal denial, §11 boundaries, §12 C3 decision)
- `/srv/voidsmith/nexis/coordination/parallel-2026-08-28/claude-c3-multi-owner-evidence-matrix.md` (C3 candidate analysis; Candidate A)
- `v2/docs/STATE-OWNERSHIP.md` (§7 Inventory, §8 Equipment, Class B atomic multi-owner)
- `v2/docs/COMMAND-EXECUTION.md` (lanes, idempotency, concurrency, atomic commit)
- `v2/docs/ATOMIC-COMMAND-COMMIT.md` (`CommandCommitPlan`, `IAtomicCommandCommitter`)
- `v2/docs/CORE-ARCHITECTURE.md`, `v2/docs/ENGINEERING-MANUAL.md`

## Global Constraints

- Target `net10.0`; nullable reference types enabled; implicit usings enabled; **warnings are errors**; deterministic builds. Copied verbatim from `v2/Directory.Build.props`.
- **Stats, skills and knowledge are NOT equip blockers.** From the spec §2.2: "Players may equip items regardless of stat, skill, or knowledge qualification." This slice introduces no level, stat, attribute, skill or knowledge requirement anywhere, and Task 5 asserts that mechanically.
- **No invented gameplay or balance values.** No cost, fee, cooldown, duration, percentage, durability change, capacity rule, weight rule, reward or penalty is introduced by this slice. The spec's §13 non-goals are binding.
- **Cursed-item persistence is out of scope.** No `Curse` owner, no persistent curse/effect state, no questline, no purification. The only curse-adjacent artefact is the typed `ItemReleaseRestriction(OwnerKey declaringOwner)` seam recorded in Task 11.
- **M-move is superseded and must not be copied.** V1's `removeInventory`/`addInventory` mechanism is legacy evidence only. `STATE-OWNERSHIP.md` §8 is binding: "An equipped item remains an Inventory-owned item." Equip and unequip must never create, destroy or transfer item possession.
- **Do not weaken any existing protective test.** Where an existing assertion is superseded by the approved design (Task 3, Task 9), replace it with a strictly stronger assertion in the same file and say so in the commit message. Never delete an assertion to make a build green.
- One authoritative write owner per persistent fact. Inventory owns possession and availability/reservation. Equipment owns slot bindings only. No generic state bag, no path/value patch, no global player state.
- Every production behaviour is written test-first: failing test, observed RED, minimal implementation, observed GREEN, commit.
- No push, no merge, no deploy, no V1/production access, no DNS/Caddy change, no secrets. PostgreSQL work uses the disposable container only.
- Product-facing name is Nexis. "V2" is internal engineering vocabulary.

---

## Plan corrections applied before execution

Recorded 2026-08-30 by the implementing session after reviewing this plan against the repository at
`95bf9a1`. The plan is otherwise adopted as written and is the execution authority.

### Correction 1 (architecture defect) — availability check ordering in the equip rule

**As originally written**, Task 3 inserted the M-reserve availability check immediately after the
`ItemNotPossessed` block, i.e. *before* the existing `AlreadyEquipped` check.

**Why that is a defect.** Under M-reserve, a genuinely equipped item *always* carries an
Equipment-held Inventory reservation — that is the whole point of the model. So for the single most
common failed equip attempt, re-equipping something already worn, `FindReservation(...)` is
non-null and the rule returns `equipment.item.reserved_elsewhere` and never reaches
`AlreadyEquipped`. Two concrete consequences:

1. `equipment.item.already_equipped` becomes unreachable dead code in production while still being
   counted by the Task 5 reason-code pin, so the freedom-rule guard would happily protect a reason
   nothing can emit.
2. The player is told the item is committed to some other owner when in fact it is on their own
   body. That misattributes an ordinary in-world situation to an integrity-flavoured one, which is
   exactly the kind of imprecise outcome reporting `ENGINEERING-MANUAL.md` asks rules to avoid.

Nothing in the existing suite catches this: `EquipItemVerticalTests` has no already-equipped test,
and the plan's own new fixture only attaches a reservation when `reservedBy` is passed, so its
already-equipped state would have been *inconsistent* (bound but unreserved) and would have masked
the ordering bug.

**Correction.** The availability check moves to immediately after the `AlreadyEquipped` check. An
item reserved by any owner and not bound to this character is still rejected as
`equipment.item.reserved_elsewhere`, so the double-spend guarantee is unchanged; only the
attribution of the already-equipped case improves. Task 3 gains a permanent regression test,
`Equip_ReportsAlreadyEquippedRatherThanReservedElsewhereForItsOwnBinding`, that pins the ordering by
constructing a *consistent* equipped state (binding **and** matching Equipment reservation).

This is a strictly-stronger change: no assertion is weakened and no reason code is removed.

### Correction 4 (architecture defect, found during Task 3 execution) — replay trace validation cannot survive a multi-owner decision

**Symptom.** Completing Task 3 turned 16 previously-green `ReplayCorpusTests` red, all with
`InvalidOperationException: Replay capture decision and terminal command plan are inconsistent.`
from `ReplayCorpusExtractor.ValidateTrace`.

**Root cause — a latent pre-existing defect, exposed rather than caused by this slice.**
`CommandCommitPlanBuilder.Build` deliberately canonicalizes transition order:

```csharp
var transitions = decision.Transitions
    .OrderBy(static transition => transition.TargetOwner.Value, StringComparer.Ordinal)
    ...
```

`ValidateTrace` then asserts:

```csharp
!capture.Plan.Transitions.SequenceEqual(capture.Decision.Transitions)
```

`SequenceEqual` is order-sensitive. So the check silently assumed plan order equals decision order —
an assumption the plan builder explicitly breaks. With one transition the two orders coincide and the
check passed vacuously. The equip rule now emits `[Reserve(Inventory), Equip(Equipment)]`, the builder
canonicalizes to `[Equip(Equipment), Reserve(Inventory)]`, and the comparison fails.

This is not specific to M-reserve. **Any** genuine multi-owner command whose Core rule emits
transitions in non-canonical owner order would trip it, which means the C3 proof itself is blocked by
it. It is exactly the class of latent single-owner assumption C3 exists to flush out.

**Correction.** `ValidateTrace` compares the plan's transitions against the decision's transitions as
an order-insensitive multiset. The property that actually matters — and that the check was written to
protect — is *the plan carries exactly the decision's transitions: none added, none dropped, none
substituted, none duplicated*. Order is not part of that promise, because canonicalizing it is the
plan builder's documented job and the PostgreSQL committer reorders again by canonical lock order.

This is a strict narrowing of one false assumption, not a weakened guard. Added-, dropped-,
substituted- and duplicated-transition captures must all still be rejected, and Task 3 adds tests
pinning each of those directions plus the multi-owner acceptance case.

### Correction 2 (factual) — this SDK cannot run `dotnet test`

Every `Run: dotnet test ...` step in this plan fails on the installed SDK (10.0.111) with:

> Testing with VSTest target is no longer supported by Microsoft.Testing.Platform on .NET 10 SDK

Both test projects build to Microsoft.Testing.Platform executables. The working invocations are:

```bash
./v2/tests/Nexis.Architecture.Tests/bin/Release/net10.0/Nexis.Architecture.Tests
./v2/tests/Nexis.Persistence.Postgres.Tests/bin/Release/net10.0/Nexis.Persistence.Postgres.Tests
```

with `--filter` replaced by MTP's `--filter-method` / `--filter-class` where a narrowed run is
wanted. Build first (`dotnet build v2/Nexis.slnx -c Release`), then run the executable.

### Correction 3 (factual) — disposable database credentials

The plan's Task 7/Task 10 snippets reference an unset `$PGPASSWORD`. The verified disposable
container is `nexis-claude-cont-20260829` (`postgres:17.11`, `127.0.0.1:55501`) and its password is
`nexis_disposable_local`. It is a local, disposable, non-production container; this is not a secret
and no production or V1 credential appears anywhere in this slice.

### Verified baseline at `95bf9a1` (measured, not quoted)

| Suite | Result |
| --- | --- |
| Release build | 0 warnings, 0 errors |
| Architecture | 194 total · 191 passed · 3 failed · 0 skipped |
| PostgreSQL (fresh `nexis_c3_base`) | 55 total · 55 passed · 0 failed · 0 skipped |

The three failures are the known pre-existing L3 History/Player Log REDs and must remain RED:
`MultiEventCommand_MustExposeARecoverableTotalOrderForItsEvents`,
`PlayerDisclosableAuditReason_MustBeRejectedAtWriteTimeIfPlayerLogCannotProjectIt`,
`KnownEventContractWithUnknownSchemaVersion_MustNotSilentlyVanishFromPlayerLog`.

---

## File Structure

**Create:**

| Path | Responsibility |
| --- | --- |
| `v2/src/Nexis.Inventory.Contracts/InventoryReservationContracts.cs` | `ItemReleaseRestriction`, `InventoryItemReservation` — the typed M-reserve availability vocabulary |
| `v2/src/Nexis.Inventory.Contracts/InventoryTransitionContracts.cs` | `ReserveInventoryItemTransition`, `ReleaseInventoryItemReservationTransition` |
| `v2/src/Nexis.Equipment.Contracts/UnequipItemContracts.cs` | `UnequipItemIntent`, `UnequipItemTransition`, `ItemUnequippedEvent` |
| `v2/src/Nexis.Core/Rules/Equipment/UnequipItemRuleEvaluator.cs` | Core unequip rule, incl. release-restriction denial |
| `v2/src/Nexis.Modules.Equipment/UnequipItemCanonicalCommandCodec.cs` | Stable canonical payload for unequip schema v1 |
| `v2/src/Nexis.Persistence.Postgres/Migrations/0008_inventory_owner.sql` | Inventory owner private schema |
| `v2/src/Nexis.Persistence.Postgres/PostgresInventoryOwner.cs` | `PostgresInventoryTransitionApplier`, `PostgresInventorySnapshotReader` |
| `v2/tests/Nexis.Architecture.Tests/MReserveUnequipVerticalTests.cs` | In-memory Core coverage for reservation + unequip |
| `v2/tests/Nexis.Architecture.Tests/MReserveFreedomRuleTests.cs` | Freedom-rule guard: no capability gating in equip/unequip |
| `v2/tests/Nexis.Persistence.Postgres.Tests/PostgresUnequipItemMultiOwnerIntegrationTests.cs` | The C3 database proof |
| `v2/docs/ITEM-AVAILABILITY-RESERVATION.md` | Binding record of M-reserve + the future curse integration seam |

**Modify:**

| Path | Change |
| --- | --- |
| `v2/src/Nexis.Inventory.Contracts/InventoryContracts.cs` | `InventorySnapshot` gains `Reservations`; contract schema 1 → 2 |
| `v2/src/Nexis.Core/Rules/Equipment/EquipItemRuleEvaluator.cs` | Availability check + Inventory reserve transition |
| `v2/src/Nexis.Core/CoreRulesEngine.cs` | Register `UnequipItemRuleEvaluator` |
| `v2/src/Nexis.Persistence.Postgres/PostgresEquipmentOwner.cs` | Handle `UnequipItemTransition` |
| `v2/src/Nexis.Persistence.Postgres/PostgresExecutionSchema.cs` | Register migration `0008` |
| `v2/src/Nexis.Persistence.Postgres/Nexis.Persistence.Postgres.csproj` | Add `Nexis.Inventory.Contracts` reference + `0008` embedded resource |
| `v2/src/Nexis.History.Replay/ReplayCorpus.cs` | Add `ReplayCorpusVersion.V2` |
| `v2/src/Nexis.History.Replay/EquipItemReplayScenarioCodec.cs` | Capture reservations; corpus V2; V1 fails closed |
| `v2/tests/Nexis.Architecture.Tests/EquipItemVerticalTests.cs` | Supersede the single-owner equip assertion |
| `v2/tests/Nexis.Architecture.Tests/ReplayCorpusTests.cs` | V2 expectations + V1 fail-closed test |
| `v2/tests/Nexis.Persistence.Postgres.Tests/PostgresEquipItemVerticalIntegrationTests.cs` | Equip now writes two owners |
| `v2/docs/STATE-OWNERSHIP.md` | Resolve the §8 M-reserve/M-reference contradiction |
| `v2/docs/COMMAND-EXECUTION.md` | Correct the "Inventory precondition" equip example |
| `v2/docs/IMPLEMENTATION-STATUS.md` | Record the C3 proof |
| `CHANGELOG.md` | Operational entry |

---

## Task 1: Inventory reservation vocabulary

**Files:**
- Create: `v2/src/Nexis.Inventory.Contracts/InventoryReservationContracts.cs`
- Modify: `v2/src/Nexis.Inventory.Contracts/InventoryContracts.cs:32-79`
- Test: `v2/tests/Nexis.Architecture.Tests/MReserveUnequipVerticalTests.cs`

**Interfaces:**
- Consumes: `OwnerKey` (`Nexis.Core.Contracts`), `ItemInstanceId` (`Nexis.Items.Contracts`), `CharacterId` (`Nexis.Identity.Contracts`), existing `InventoryItemReference`.
- Produces:
  - `ItemReleaseRestriction(OwnerKey declaringOwner)` with `OwnerKey DeclaringOwner { get; }`
  - `InventoryItemReservation(ItemInstanceId itemInstanceId, OwnerKey holdingOwner, ItemReleaseRestriction? releaseRestriction = null)` with `ItemInstanceId ItemInstanceId`, `OwnerKey HoldingOwner`, `ItemReleaseRestriction? ReleaseRestriction`, `bool IsOrdinarilyReleasable`
  - `InventorySnapshot(CharacterId characterId, long revision, IEnumerable<InventoryItemReference> items, IEnumerable<InventoryItemReservation>? reservations = null)` with `IReadOnlyList<InventoryItemReservation> Reservations` and `InventoryItemReservation? FindReservation(ItemInstanceId itemInstanceId)`
  - `InventorySnapshot.SnapshotContract` becomes `new("nexis.inventory.snapshot", 2)`

There is deliberately **no** surrogate reservation GUID. `(CharacterId, ItemInstanceId)` is the stable reservation identifier, satisfying `STATE-OWNERSHIP.md`'s "reservations use stable reservation/escrow identifiers" without introducing a value Core would have to mint non-deterministically.

- [ ] **Step 1: Write the failing test**

Create `v2/tests/Nexis.Architecture.Tests/MReserveUnequipVerticalTests.cs`:

```csharp
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

        Assert.AreEqual(2, snapshot.SnapshotContract.SchemaVersion);
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `dotnet test v2/Nexis.slnx --filter "FullyQualifiedName~MReserveUnequipVerticalTests"`
Expected: BUILD FAILURE, `CS0246`/`CS1729` — `ItemReleaseRestriction`/`InventoryItemReservation` do not exist and `InventorySnapshot` has no four-argument constructor. Capture the exact compiler output as the RED evidence.

- [ ] **Step 3: Write minimal implementation**

Create `v2/src/Nexis.Inventory.Contracts/InventoryReservationContracts.cs`:

```csharp
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
```

Modify `v2/src/Nexis.Inventory.Contracts/InventoryContracts.cs`. Replace the `InventorySnapshot` declaration (currently lines 32-79) with:

```csharp
/// <summary>
/// Inventory owns possession, the concrete item-instance to content-definition relationship, and
/// item availability. An item remains possessed by Inventory while equipped; Equipment owns only
/// slot bindings. Reservations are the M-reserve availability answer.
/// </summary>
public sealed record InventorySnapshot : IAuthoritativeSnapshot
{
    public static ContractDescriptor SnapshotContract { get; } = new("nexis.inventory.snapshot", 2);

    public static OwnerKey OwnerKey { get; } = new("Inventory");

    public InventorySnapshot(
        CharacterId characterId,
        long revision,
        IEnumerable<InventoryItemReference> items,
        IEnumerable<InventoryItemReservation>? reservations = null)
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

        var frozenReservations = (reservations ?? Array.Empty<InventoryItemReservation>()).ToArray();
        if (frozenReservations.Any(static reservation => reservation is null))
        {
            throw new ArgumentException("Inventory snapshots cannot contain null reservations.", nameof(reservations));
        }

        if (frozenReservations.Select(static reservation => reservation.ItemInstanceId).Distinct().Count() != frozenReservations.Length)
        {
            throw new ArgumentException("An item instance cannot be reserved more than once.", nameof(reservations));
        }

        var possessed = frozen.Select(static item => item.ItemInstanceId).ToHashSet();
        if (frozenReservations.Any(reservation => !possessed.Contains(reservation.ItemInstanceId)))
        {
            throw new ArgumentException("Inventory cannot reserve an item instance it does not possess.", nameof(reservations));
        }

        CharacterId = characterId;
        Revision = revision;
        Items = Array.AsReadOnly(frozen);
        Reservations = Array.AsReadOnly(frozenReservations);
    }

    public ContractDescriptor Contract => SnapshotContract;

    public OwnerKey Owner => OwnerKey;

    public CharacterId CharacterId { get; }

    public long Revision { get; }

    public IReadOnlyList<InventoryItemReference> Items { get; }

    public IReadOnlyList<InventoryItemReservation> Reservations { get; }

    public InventoryItemReservation? FindReservation(ItemInstanceId itemInstanceId) =>
        Reservations.SingleOrDefault(reservation => reservation.ItemInstanceId == itemInstanceId);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `dotnet test v2/Nexis.slnx --filter "FullyQualifiedName~MReserveUnequipVerticalTests"`
Expected: PASS, 3 passed.

- [ ] **Step 5: Run the full architecture suite to confirm no regression**

Run: `dotnet test v2/tests/Nexis.Architecture.Tests/Nexis.Architecture.Tests.csproj`
Expected: the three known pre-existing L3 History/Player Log RED failures only (`MultiEventCommand_MustExposeARecoverableTotalOrderForItsEvents`, `PlayerDisclosableAuditReason_MustBeRejectedAtWriteTimeIfPlayerLogCannotProjectIt`, `KnownEventContractWithUnknownSchemaVersion_MustNotSilentlyVanishFromPlayerLog`). No new failure.

- [ ] **Step 6: Commit**

```bash
git add v2/src/Nexis.Inventory.Contracts/InventoryReservationContracts.cs \
        v2/src/Nexis.Inventory.Contracts/InventoryContracts.cs \
        v2/tests/Nexis.Architecture.Tests/MReserveUnequipVerticalTests.cs
git commit -m "feat(v2): give Inventory the authoritative M-reserve availability answer"
```

---

## Task 2: Inventory reserve and release transitions

**Files:**
- Create: `v2/src/Nexis.Inventory.Contracts/InventoryTransitionContracts.cs`
- Test: `v2/tests/Nexis.Architecture.Tests/MReserveUnequipVerticalTests.cs`

**Interfaces:**
- Consumes: `IOwnerTransition`, `OwnerKey`, `ContractDescriptor`, `CharacterId`, `ItemInstanceId`, `InventorySnapshot.OwnerKey` from Task 1.
- Produces:
  - `ReserveInventoryItemTransition(long expectedRevision, CharacterId characterId, ItemInstanceId itemInstanceId, OwnerKey holdingOwner)`; contract `new("nexis.inventory.reserve-item", 1)`; `TargetOwner => InventorySnapshot.OwnerKey`
  - `ReleaseInventoryItemReservationTransition(long expectedRevision, CharacterId characterId, ItemInstanceId itemInstanceId, OwnerKey holdingOwner)`; contract `new("nexis.inventory.release-item-reservation", 1)`; `TargetOwner => InventorySnapshot.OwnerKey`
  - Both expose `long? ExpectedRevision`, `CharacterId CharacterId`, `ItemInstanceId ItemInstanceId`, `OwnerKey HoldingOwner`.

`HoldingOwner` travels on the release transition so the persistence boundary can refuse to release a reservation held by a different owner.

- [ ] **Step 1: Write the failing test**

Append to `v2/tests/Nexis.Architecture.Tests/MReserveUnequipVerticalTests.cs`:

```csharp
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `dotnet test v2/Nexis.slnx --filter "FullyQualifiedName~MReserveUnequipVerticalTests"`
Expected: BUILD FAILURE, `CS0246` — `ReserveInventoryItemTransition` and `ReleaseInventoryItemReservationTransition` do not exist.

- [ ] **Step 3: Write minimal implementation**

Create `v2/src/Nexis.Inventory.Contracts/InventoryTransitionContracts.cs`:

```csharp
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
```

- [ ] **Step 4: Run test to verify it passes**

Run: `dotnet test v2/Nexis.slnx --filter "FullyQualifiedName~MReserveUnequipVerticalTests"`
Expected: PASS, 5 passed.

- [ ] **Step 5: Commit**

```bash
git add v2/src/Nexis.Inventory.Contracts/InventoryTransitionContracts.cs \
        v2/tests/Nexis.Architecture.Tests/MReserveUnequipVerticalTests.cs
git commit -m "feat(v2): add typed Inventory reserve and release transitions"
```

---

## Task 3: Equip becomes a real two-owner command

**Files:**
- Modify: `v2/src/Nexis.Core/Rules/Equipment/EquipItemRuleEvaluator.cs:16-153`
- Modify: `v2/tests/Nexis.Architecture.Tests/EquipItemVerticalTests.cs:104-116,222-257`

**Interfaces:**
- Consumes: `InventorySnapshot.FindReservation` (Task 1), `ReserveInventoryItemTransition` (Task 2).
- Produces: `EquipItemRuleEvaluator` now returns exactly two transitions in this fixed order — `[ReserveInventoryItemTransition, EquipItemTransition]` — plus the existing single `ItemEquippedEvent`. New reason code `equipment.item.reserved_elsewhere`.

**Supersession note (read before editing):** `EquipSuccess_WritesOnlyEquipmentOwnerAndEmitsSemanticEvent` asserts equip writes no Inventory transition. The approved design §3.2 supersedes that: "Inventory verifies the item is available and reserves it for equipment." The replacement below is strictly stronger — it pins the exact two owners **and** adds a new assertion that possession is never created or destroyed, which is the invariant the old test was really protecting. Do not simply delete the old assertion.

- [ ] **Step 1: Write the failing test**

In `v2/tests/Nexis.Architecture.Tests/EquipItemVerticalTests.cs`, replace the whole `EquipSuccess_WritesOnlyEquipmentOwnerAndEmitsSemanticEvent` method (lines 103-116) with:

```csharp
    [TestMethod]
    public void EquipSuccess_ReservesInInventoryBindsInEquipmentAndEmitsSemanticEvent()
    {
        var fixture = CreateFixture();
        var decision = Evaluate(fixture);

        Assert.AreEqual(CoreOutcomeStatus.Succeeded, decision.Status);
        Assert.AreEqual(2, decision.Transitions.Count);

        var reserve = (ReserveInventoryItemTransition)decision.Transitions[0];
        Assert.AreEqual(InventorySnapshot.OwnerKey, reserve.TargetOwner);
        Assert.AreEqual(fixture.ItemId, reserve.ItemInstanceId);
        Assert.AreEqual(EquipmentSnapshot.OwnerKey, reserve.HoldingOwner);
        Assert.AreEqual(fixture.Inventory.Revision, reserve.ExpectedRevision);

        var bind = (EquipItemTransition)decision.Transitions[1];
        Assert.AreEqual(EquipmentSnapshot.OwnerKey, bind.TargetOwner);
        Assert.AreEqual(fixture.Equipment.Revision, bind.ExpectedRevision);

        Assert.AreEqual(1, decision.Events.Count);
        Assert.IsInstanceOfType<ItemEquippedEvent>(decision.Events[0]);
    }

    /// <summary>
    /// M-reserve preserves the invariant the superseded single-owner assertion protected: equipping
    /// commits the item to Equipment but never creates, destroys or transfers possession. Only
    /// reserve/release transitions may address Inventory from this rule.
    /// </summary>
    [TestMethod]
    public void EquipTransitions_NeverCreateOrDestroyItemPossession()
    {
        var decision = Evaluate(CreateFixture());

        var inventoryTransitions = decision.Transitions
            .Where(static transition => transition.TargetOwner == InventorySnapshot.OwnerKey)
            .ToArray();

        Assert.AreEqual(1, inventoryTransitions.Length);
        Assert.IsInstanceOfType<ReserveInventoryItemTransition>(inventoryTransitions[0]);
        Assert.IsFalse(
            decision.Transitions.Any(static transition =>
                transition.Contract.Name.Contains("possession", StringComparison.OrdinalIgnoreCase) ||
                transition.Contract.Name.Contains("transfer", StringComparison.OrdinalIgnoreCase) ||
                transition.Contract.Name.Contains("grant", StringComparison.OrdinalIgnoreCase) ||
                transition.Contract.Name.Contains("remove", StringComparison.OrdinalIgnoreCase)),
            "Equip must not emit an ownership-transferring Inventory transition. The superseded "
            + "M-move model removed the item from inventory; STATE-OWNERSHIP.md section 8 forbids that.");
    }

    [TestMethod]
    public void Equip_RejectsAnItemAlreadyReservedByAnotherOwner()
    {
        var fixture = CreateFixture(reservedBy: new OwnerKey("Marketplace"));
        var decision = Evaluate(fixture);

        Assert.AreEqual(CoreOutcomeStatus.Rejected, decision.Status);
        Assert.AreEqual("equipment.item.reserved_elsewhere", decision.Reason?.Value);
        Assert.AreEqual(0, decision.Transitions.Count);
    }

    /// <summary>
    /// Reason-code reachability guard (plan correction 1). Under M-reserve a genuinely equipped item
    /// always carries an Equipment-held Inventory reservation, so re-equipping it satisfies BOTH the
    /// already-equipped condition and the reserved-elsewhere condition. The player-facing answer must
    /// be the precise in-world one. If the availability check is ever moved ahead of the
    /// already-equipped check, equipment.item.already_equipped becomes dead code and this fails.
    /// </summary>
    [TestMethod]
    public void Equip_ReportsAlreadyEquippedRatherThanReservedElsewhereForItsOwnBinding()
    {
        var fixture = CreateFixture(equipItemInMainHand: true);
        var decision = Evaluate(fixture);

        Assert.AreEqual(CoreOutcomeStatus.Rejected, decision.Status);
        Assert.AreEqual(
            "equipment.item.already_equipped",
            decision.Reason?.Value,
            "An item this character already has equipped must be reported as already equipped, not "
            + "as reserved elsewhere. Its own Equipment reservation is not a foreign commitment.");
        Assert.AreEqual(0, decision.Transitions.Count);
    }
```

The new test needs the fixture to be able to produce the *consistent* equipped state — a binding
**and** the matching Equipment-held reservation. Add an `bool equipItemInMainHand = false` parameter
to `CreateFixture`; when it is true, seed `existingBindings` with
`new EquippedItemBinding(itemId, MainHandPlacement, new[] { MainHand })` and seed the reservation list
with `new InventoryItemReservation(itemId, EquipmentSnapshot.OwnerKey)`. Do not reuse the
`existingBindings` parameter for this: that parameter deliberately builds *other* items' bindings, and
those fixtures must keep producing `equipment.placement.occupied`.

Then extend the fixture factory. In `CreateFixture` (line 222) add the parameter `OwnerKey? reservedBy = null` to the signature, and replace the `new InventorySnapshot(characterId, 5, items)` argument (line 252) with:

```csharp
            new InventorySnapshot(
                characterId,
                5,
                items,
                reservedBy is null || !includePossession
                    ? Array.Empty<InventoryItemReservation>()
                    : new[] { new InventoryItemReservation(itemId, reservedBy) }),
```

Add `using Nexis.Core.Contracts;` is already present; no new using is required beyond `Nexis.Inventory.Contracts`, which is already imported at line 9.

- [ ] **Step 2: Run test to verify it fails**

Run: `dotnet test v2/Nexis.slnx --filter "FullyQualifiedName~EquipItemVerticalTests"`
Expected: FAIL. `EquipSuccess_ReservesInInventoryBindsInEquipmentAndEmitsSemanticEvent` fails with `Assert.AreEqual failed. Expected:<2>. Actual:<1>`; `EquipTransitions_NeverCreateOrDestroyItemPossession` fails with `Expected:<1>. Actual:<0>`; `Equip_RejectsAnItemAlreadyReservedByAnotherOwner` fails with `Expected:<Rejected>. Actual:<Succeeded>`.

- [ ] **Step 3: Write minimal implementation**

In `v2/src/Nexis.Core/Rules/Equipment/EquipItemRuleEvaluator.cs`, add the reason code next to the others (after line 22):

```csharp
    private static readonly CoreReasonCode ItemReservedElsewhere = new("equipment.item.reserved_elsewhere");
```

**Corrected placement (see "Plan corrections applied before execution", correction 1).** Insert the
availability check immediately **after** the existing `AlreadyEquipped` rejection block, not after
`ItemNotPossessed`:

```csharp
        // M-reserve: Inventory holds the single authoritative answer to availability. An item
        // already committed to any owner cannot simultaneously be committed to Equipment.
        // This is deliberately evaluated after the AlreadyEquipped check: under M-reserve an
        // equipped item always carries an Equipment-held reservation, so checking availability
        // first would make the more precise equipment.item.already_equipped reason unreachable.
        if (inventory.FindReservation(intent.ItemInstanceId) is not null)
        {
            return CoreDecision.Rejected(ItemReservedElsewhere);
        }
```

Replace the success block (currently lines 138-152) with:

```csharp
        var reservation = new ReserveInventoryItemTransition(
            inventory.Revision,
            intent.CharacterId,
            intent.ItemInstanceId,
            EquipmentSnapshot.OwnerKey);
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
            transitions: new IOwnerTransition[] { reservation, transition },
            events: new ICoreEventDescriptor[] { domainEvent });
```

Update the class summary comment (lines 9-13) to read:

```csharp
/// <summary>
/// First real Nexis V2 gameplay rule, now under the approved M-reserve model. Persistent loadout
/// equipment is allowed only outside an active Combat encounter, never transfers possession out of
/// Inventory, reserves the item instance in Inventory so it cannot be double-spent, and binds only
/// to an explicitly selected currently-empty data-defined placement. Stats, skills and knowledge
/// are deliberately not equip prerequisites.
/// </summary>
```

- [ ] **Step 4: Run test to verify it passes**

Run: `dotnet test v2/Nexis.slnx --filter "FullyQualifiedName~EquipItemVerticalTests"`
Expected: PASS, 11 passed. `EquipSuccess_ReevaluationIsDeterministic` must still pass — the transition order is fixed and no value is randomly minted.

- [ ] **Step 5: Commit**

```bash
git add v2/src/Nexis.Core/Rules/Equipment/EquipItemRuleEvaluator.cs \
        v2/tests/Nexis.Architecture.Tests/EquipItemVerticalTests.cs
git commit -m "feat(v2): make Equip Item reserve the item instance in Inventory (M-reserve)"
```

---

## Task 4: Unequip contracts and the Core unequip rule

**Files:**
- Create: `v2/src/Nexis.Equipment.Contracts/UnequipItemContracts.cs`
- Create: `v2/src/Nexis.Core/Rules/Equipment/UnequipItemRuleEvaluator.cs`
- Modify: `v2/src/Nexis.Core/CoreRulesEngine.cs:83-86`
- Test: `v2/tests/Nexis.Architecture.Tests/MReserveUnequipVerticalTests.cs`

**Interfaces:**
- Consumes: `InventorySnapshot`, `EquipmentSnapshot`, `CombatParticipationSnapshot`, `ReleaseInventoryItemReservationTransition`.
- Produces:
  - `UnequipItemIntent(CharacterId characterId, ItemInstanceId itemInstanceId)`; contract `new("nexis.equipment.unequip-item", 1)`
  - `UnequipItemTransition(long expectedRevision, CharacterId characterId, ItemInstanceId itemInstanceId, EquipmentPlacementKey placementKey, IEnumerable<EquipmentSlotKey> releasedSlots)`; contract `new("nexis.equipment.unbind-item", 1)`; exposes `EquipmentSlotSet ReleasedSlots`
  - `ItemUnequippedEvent(CharacterId characterId, ItemInstanceId itemInstanceId, EquipmentPlacementKey placementKey, IEnumerable<EquipmentSlotKey> releasedSlots)`; contract `new("nexis.equipment.item-unequipped", 1)`
  - `UnequipItemRuleEvaluator` registered by default in `CoreRulesEngine`, returning `[UnequipItemTransition, ReleaseInventoryItemReservationTransition]` on success.

Reason codes produced: `equipment.actor.player_required`, `equipment.actor.character_mismatch`, `equipment.snapshot.inventory_invalid`, `equipment.snapshot.equipment_invalid`, `equipment.snapshot.combat_invalid`, `equipment.combat.active`, `equipment.item.not_equipped`, `equipment.item.not_possessed`, `equipment.reservation.missing`, `equipment.reservation.foreign_holder`, `equipment.unequip.release_restricted`.

The active-combat rejection is not a new mechanic: it is the same already-implemented "persistent loadout changes are allowed only outside an active Combat encounter" rule applied to the inverse operation. No cost, cooldown or penalty is added.

- [ ] **Step 1: Write the failing test**

Append to `v2/tests/Nexis.Architecture.Tests/MReserveUnequipVerticalTests.cs` (add `using Nexis.Combat.Contracts; using Nexis.Core; using Nexis.Kernel.Commands; using Nexis.Kernel.Events; using Nexis.Kernel.Randomness;` to the file's usings):

```csharp
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
        Assert.AreEqual(fixture.Equipment.Revision, unbind.ExpectedRevision);

        var release = (ReleaseInventoryItemReservationTransition)decision.Transitions[1];
        Assert.AreEqual(InventorySnapshot.OwnerKey, release.TargetOwner);
        Assert.AreEqual(fixture.ItemId, release.ItemInstanceId);
        Assert.AreEqual(EquipmentSnapshot.OwnerKey, release.HoldingOwner);
        Assert.AreEqual(fixture.Inventory.Revision, release.ExpectedRevision);

        Assert.AreEqual(1, decision.Events.Count);
        Assert.IsInstanceOfType<ItemUnequippedEvent>(decision.Events[0]);
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `dotnet test v2/Nexis.slnx --filter "FullyQualifiedName~MReserveUnequipVerticalTests"`
Expected: BUILD FAILURE, `CS0246` — `UnequipItemIntent`, `UnequipItemTransition`, `ItemUnequippedEvent` do not exist.

- [ ] **Step 3: Write the contracts**

Create `v2/src/Nexis.Equipment.Contracts/UnequipItemContracts.cs`:

```csharp
using Nexis.Core.Contracts;
using Nexis.Identity.Contracts;
using Nexis.Items.Contracts;

namespace Nexis.Equipment.Contracts;

public sealed record UnequipItemIntent : ICoreIntent
{
    public static ContractDescriptor IntentContract { get; } = new("nexis.equipment.unequip-item", 1);

    public UnequipItemIntent(CharacterId characterId, ItemInstanceId itemInstanceId)
    {
        if (characterId.IsEmpty)
        {
            throw new ArgumentException("Unequip Item requires a non-empty CharacterId.", nameof(characterId));
        }

        if (itemInstanceId.IsEmpty)
        {
            throw new ArgumentException("Unequip Item requires a non-empty ItemInstanceId.", nameof(itemInstanceId));
        }

        CharacterId = characterId;
        ItemInstanceId = itemInstanceId;
    }

    public ContractDescriptor Contract => IntentContract;

    public CharacterId CharacterId { get; }

    public ItemInstanceId ItemInstanceId { get; }
}

/// <summary>
/// Clears one Equipment binding. Placement and released slots are carried so the persistence
/// boundary and the semantic event describe exactly what was cleared without a second content read.
/// </summary>
public sealed record UnequipItemTransition : IOwnerTransition
{
    public static ContractDescriptor TransitionContract { get; } = new("nexis.equipment.unbind-item", 1);

    public UnequipItemTransition(
        long expectedRevision,
        CharacterId characterId,
        ItemInstanceId itemInstanceId,
        EquipmentPlacementKey placementKey,
        IEnumerable<EquipmentSlotKey> releasedSlots)
    {
        if (expectedRevision < 0)
        {
            throw new ArgumentOutOfRangeException(nameof(expectedRevision));
        }

        if (characterId.IsEmpty || itemInstanceId.IsEmpty)
        {
            throw new ArgumentException("Unequip Item transitions require non-empty character and item identities.");
        }

        PlacementKey = placementKey ?? throw new ArgumentNullException(nameof(placementKey));
        ExpectedRevision = expectedRevision;
        CharacterId = characterId;
        ItemInstanceId = itemInstanceId;
        ReleasedSlots = new EquipmentSlotSet(releasedSlots);
    }

    public ContractDescriptor Contract => TransitionContract;

    public OwnerKey TargetOwner => EquipmentSnapshot.OwnerKey;

    public long? ExpectedRevision { get; }

    public CharacterId CharacterId { get; }

    public ItemInstanceId ItemInstanceId { get; }

    public EquipmentPlacementKey PlacementKey { get; }

    public EquipmentSlotSet ReleasedSlots { get; }
}

public sealed record ItemUnequippedEvent : ICoreEventDescriptor
{
    public static ContractDescriptor EventContract { get; } = new("nexis.equipment.item-unequipped", 1);

    public ItemUnequippedEvent(
        CharacterId characterId,
        ItemInstanceId itemInstanceId,
        EquipmentPlacementKey placementKey,
        IEnumerable<EquipmentSlotKey> releasedSlots)
    {
        if (characterId.IsEmpty || itemInstanceId.IsEmpty)
        {
            throw new ArgumentException("Item Unequipped events require non-empty character and item identities.");
        }

        PlacementKey = placementKey ?? throw new ArgumentNullException(nameof(placementKey));
        CharacterId = characterId;
        ItemInstanceId = itemInstanceId;
        ReleasedSlots = new EquipmentSlotSet(releasedSlots);
    }

    public ContractDescriptor Contract => EventContract;

    public CharacterId CharacterId { get; }

    public ItemInstanceId ItemInstanceId { get; }

    public EquipmentPlacementKey PlacementKey { get; }

    public EquipmentSlotSet ReleasedSlots { get; }
}
```

- [ ] **Step 4: Write the Core rule**

Create `v2/src/Nexis.Core/Rules/Equipment/UnequipItemRuleEvaluator.cs`:

```csharp
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
```

Register it in `v2/src/Nexis.Core/CoreRulesEngine.cs`, replacing lines 83-86:

```csharp
    private static ICoreRuleEvaluator[] CreateDefaultEvaluators() =>
    [
        new EquipItemRuleEvaluator(),
        new UnequipItemRuleEvaluator()
    ];
```

- [ ] **Step 5: Run test to verify it passes**

Run: `dotnet test v2/Nexis.slnx --filter "FullyQualifiedName~MReserveUnequipVerticalTests"`
Expected: PASS, 10 passed.

- [ ] **Step 6: Run the architecture suite**

Run: `dotnet test v2/tests/Nexis.Architecture.Tests/Nexis.Architecture.Tests.csproj`
Expected: only the three known pre-existing L3 RED failures. `CoreRuleDispatchTests` and `CoreConformanceTests` must still pass with the second evaluator registered.

- [ ] **Step 7: Commit**

```bash
git add v2/src/Nexis.Equipment.Contracts/UnequipItemContracts.cs \
        v2/src/Nexis.Core/Rules/Equipment/UnequipItemRuleEvaluator.cs \
        v2/src/Nexis.Core/CoreRulesEngine.cs \
        v2/tests/Nexis.Architecture.Tests/MReserveUnequipVerticalTests.cs
git commit -m "feat(v2): add the Unequip Item multi-owner Core rule with authoritative removal denial"
```

---

## Task 5: Freedom-rule guard — capability is never an equip or unequip gate

**Files:**
- Create: `v2/tests/Nexis.Architecture.Tests/MReserveFreedomRuleTests.cs`

**Interfaces:**
- Consumes: `EquipItemRuleEvaluator`, `UnequipItemRuleEvaluator` (internal types, reached by name through `typeof(CoreRulesEngine).Assembly`), `CoreReasonCode`.
- Produces: nothing consumed by later tasks. This is a permanent protective guard.

This guard is deliberately bounded from below as well as above: it asserts the reflected sets are non-empty and pins their exact sizes, so it cannot silently start asserting over nothing. That is the lesson recorded as finding L4 in the continuation status.

- [ ] **Step 1: Write the failing test**

Create `v2/tests/Nexis.Architecture.Tests/MReserveFreedomRuleTests.cs`:

```csharp
using System.Reflection;
using Microsoft.VisualStudio.TestTools.UnitTesting;
using Nexis.Core;
using Nexis.Core.Contracts;

namespace Nexis.Architecture.Tests;

/// <summary>
/// The approved systemic item interaction design is explicit: "Players may equip items regardless
/// of stat, skill, or knowledge qualification." Low capability changes effectiveness, control, cost
/// and risk - it does not prevent the attempt. These guards make that a mechanical property of the
/// Core assembly rather than a promise in a document.
/// </summary>
[TestClass]
public sealed class MReserveFreedomRuleTests
{
    private static readonly string[] CapabilityGateFragments =
    {
        "requirement", "required_level", "level", "stat", "attribute",
        "skill", "mastery", "knowledge", "qualif", "proficien"
    };

    [TestMethod]
    public void CoreAssembly_TakesNoCompileTimeDependencyOnCapabilityOwners()
    {
        var references = typeof(CoreRulesEngine).Assembly
            .GetReferencedAssemblies()
            .Select(static reference => reference.Name ?? string.Empty)
            .ToArray();

        Assert.IsTrue(references.Length > 0, "Reflection returned no referenced assemblies at all.");

        var forbidden = new[]
        {
            "Nexis.Progression", "Nexis.Skills", "Nexis.Knowledge", "Nexis.Magic", "Nexis.Recognition"
        };

        var leaked = references
            .Where(reference => forbidden.Any(prefix =>
                reference.StartsWith(prefix, StringComparison.Ordinal)))
            .ToArray();

        Assert.AreEqual(
            0,
            leaked.Length,
            "Nexis.Core acquired a compile-time dependency on a capability/progression owner: "
            + string.Join(", ", leaked)
            + ". Equip and unequip must not become capability-gated. Effectiveness rules that "
            + "legitimately consume capability belong to a later approved resolver slice, not here.");
    }

    [TestMethod]
    public void EquipAndUnequipRules_DeclareNoCapabilityGateReasonCode()
    {
        var equipCodes = ReadReasonCodes("Nexis.Core.Rules.Equipment.EquipItemRuleEvaluator");
        var unequipCodes = ReadReasonCodes("Nexis.Core.Rules.Equipment.UnequipItemRuleEvaluator");

        Assert.AreEqual(14, equipCodes.Length, "Equip reason-code set changed; review it against the freedom rule.");
        Assert.AreEqual(11, unequipCodes.Length, "Unequip reason-code set changed; review it against the freedom rule.");

        var offending = equipCodes.Concat(unequipCodes)
            .Where(static code => CapabilityGateFragments.Any(fragment =>
                code.Contains(fragment, StringComparison.OrdinalIgnoreCase)))
            .OrderBy(static code => code, StringComparer.Ordinal)
            .ToArray();

        Assert.AreEqual(
            0,
            offending.Length,
            "A capability-shaped rejection reason appeared in the equip/unequip rules: "
            + string.Join(", ", offending)
            + ". The approved design forbids stat, level, skill or knowledge equip blockers.");
    }

    private static string[] ReadReasonCodes(string evaluatorTypeName)
    {
        var type = typeof(CoreRulesEngine).Assembly.GetType(evaluatorTypeName, throwOnError: true)!;
        var codes = type
            .GetFields(BindingFlags.NonPublic | BindingFlags.Static)
            .Where(static field => field.FieldType == typeof(CoreReasonCode))
            .Select(field => ((CoreReasonCode)field.GetValue(null)!).Value)
            .ToArray();

        Assert.IsTrue(
            codes.Length > 0,
            $"Reflected zero CoreReasonCode fields from {evaluatorTypeName}. The guard is vacuous.");

        return codes;
    }
}
```

- [ ] **Step 2: Run test to verify it fails**

Run: `dotnet test v2/Nexis.slnx --filter "FullyQualifiedName~MReserveFreedomRuleTests"`
Expected: FAIL on the pinned counts if they do not match the implementation (`Assert.AreEqual failed. Expected:<14>`). Read the actual counts from the failure message, confirm by reading the two evaluator files that every field is a genuine reason code, then set the two pinned numbers to the observed values. Do **not** delete the pins — they are what stops a capability gate being added later without review. `CoreAssembly_TakesNoCompileTimeDependencyOnCapabilityOwners` should pass immediately; that is expected and correct.

- [ ] **Step 3: Correct the pinned counts**

Edit only the two `Assert.AreEqual(<n>, ...)` count literals to the observed values.

- [ ] **Step 4: Run test to verify it passes**

Run: `dotnet test v2/Nexis.slnx --filter "FullyQualifiedName~MReserveFreedomRuleTests"`
Expected: PASS, 2 passed.

- [ ] **Step 5: Commit**

```bash
git add v2/tests/Nexis.Architecture.Tests/MReserveFreedomRuleTests.cs
git commit -m "test(v2): guard the approved freedom rule against capability-gated equipment"
```

---

## Task 6: Canonical command codec for Unequip Item

**Files:**
- Create: `v2/src/Nexis.Modules.Equipment/UnequipItemCanonicalCommandCodec.cs`
- Test: `v2/tests/Nexis.Architecture.Tests/MReserveUnequipVerticalTests.cs`

**Interfaces:**
- Consumes: `ICanonicalCommandCodec`, `CanonicalCommandPayload` (`Nexis.Execution.Contracts`), `UnequipItemIntent`.
- Produces: `UnequipItemCanonicalCommandCodec` with `ContractDescriptor IntentContract => UnequipItemIntent.IntentContract`, `CanonicalCommandPayload Serialize(ICoreIntent intent)`, `ICoreIntent Deserialize(CanonicalCommandPayload payload)`. Canonical JSON property order is `characterId`, `itemInstanceId`; GUIDs use `"D"` format.

- [ ] **Step 1: Write the failing test**

Append to `v2/tests/Nexis.Architecture.Tests/MReserveUnequipVerticalTests.cs` (add `using System.Text.Json;` and `using Nexis.Modules.Equipment;`):

```csharp
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

        var unknown = Nexis.Execution.Contracts.CanonicalCommandPayload.FromTrustedJson(
            JsonSerializer.Serialize(new
            {
                characterId = Guid.NewGuid().ToString("D"),
                itemInstanceId = Guid.NewGuid().ToString("D"),
                unexpected = true
            }));
        Assert.ThrowsExactly<FormatException>(() => codec.Deserialize(unknown));

        var malformed = Nexis.Execution.Contracts.CanonicalCommandPayload.FromTrustedJson(
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
        var registry = new Nexis.Execution.CanonicalCommandCodecRegistry(
            new Nexis.Execution.Contracts.ICanonicalCommandCodec[]
            {
                new EquipItemCanonicalCommandCodec(),
                new UnequipItemCanonicalCommandCodec()
            });

        var intent = new UnequipItemIntent(CharacterId.New(), ItemInstanceId.New());
        var payload = registry.Serialize(intent);

        Assert.AreEqual(intent, registry.Deserialize(UnequipItemIntent.IntentContract, payload));
    }
```

- [ ] **Step 2: Run test to verify it fails**

Run: `dotnet test v2/Nexis.slnx --filter "FullyQualifiedName~MReserveUnequipVerticalTests"`
Expected: BUILD FAILURE, `CS0246` — `UnequipItemCanonicalCommandCodec` does not exist.

- [ ] **Step 3: Write minimal implementation**

Create `v2/src/Nexis.Modules.Equipment/UnequipItemCanonicalCommandCodec.cs`:

```csharp
using System.Globalization;
using System.Text.Json;
using Nexis.Core.Contracts;
using Nexis.Equipment.Contracts;
using Nexis.Execution.Contracts;
using Nexis.Identity.Contracts;
using Nexis.Items.Contracts;

namespace Nexis.Modules.Equipment;

/// <summary>
/// Explicit stable codec for Unequip Item schema v1. Property order and GUID formatting are fixed so
/// the canonical payload fingerprint is deterministic and recoverable across process restarts.
/// </summary>
public sealed class UnequipItemCanonicalCommandCodec : ICanonicalCommandCodec
{
    public ContractDescriptor IntentContract => UnequipItemIntent.IntentContract;

    public CanonicalCommandPayload Serialize(ICoreIntent intent)
    {
        if (intent is not UnequipItemIntent unequip)
        {
            throw new ArgumentException("Unequip Item codec received the wrong typed intent.", nameof(intent));
        }

        var json = string.Create(
            CultureInfo.InvariantCulture,
            $"{{\"characterId\":\"{unequip.CharacterId.Value:D}\",\"itemInstanceId\":\"{unequip.ItemInstanceId.Value:D}\"}}");
        return CanonicalCommandPayload.FromTrustedJson(json);
    }

    public ICoreIntent Deserialize(CanonicalCommandPayload payload)
    {
        ArgumentNullException.ThrowIfNull(payload);
        using var document = JsonDocument.Parse(payload.Json);
        if (document.RootElement.ValueKind != JsonValueKind.Object)
        {
            throw new FormatException("Unequip Item payload must be a JSON object.");
        }

        string? characterId = null;
        string? itemInstanceId = null;
        var seen = new HashSet<string>(StringComparer.Ordinal);

        foreach (var property in document.RootElement.EnumerateObject())
        {
            if (!seen.Add(property.Name))
            {
                throw new FormatException($"Unequip Item payload contains duplicate property '{property.Name}'.");
            }

            switch (property.Name)
            {
                case "characterId":
                    characterId = ReadString(property);
                    break;
                case "itemInstanceId":
                    itemInstanceId = ReadString(property);
                    break;
                default:
                    throw new FormatException($"Unequip Item payload contains unknown property '{property.Name}'.");
            }
        }

        if (!Guid.TryParseExact(characterId, "D", out var parsedCharacterId))
        {
            throw new FormatException("Unequip Item payload contains an invalid characterId.");
        }

        if (!Guid.TryParseExact(itemInstanceId, "D", out var parsedItemInstanceId))
        {
            throw new FormatException("Unequip Item payload contains an invalid itemInstanceId.");
        }

        return new UnequipItemIntent(
            new CharacterId(parsedCharacterId),
            new ItemInstanceId(parsedItemInstanceId));
    }

    private static string ReadString(JsonProperty property)
    {
        if (property.Value.ValueKind != JsonValueKind.String)
        {
            throw new FormatException($"Unequip Item payload property '{property.Name}' must be a string.");
        }

        return property.Value.GetString()
            ?? throw new FormatException($"Unequip Item payload property '{property.Name}' cannot be null.");
    }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `dotnet test v2/Nexis.slnx --filter "FullyQualifiedName~MReserveUnequipVerticalTests"`
Expected: PASS, 13 passed.

- [ ] **Step 5: Commit**

```bash
git add v2/src/Nexis.Modules.Equipment/UnequipItemCanonicalCommandCodec.cs \
        v2/tests/Nexis.Architecture.Tests/MReserveUnequipVerticalTests.cs
git commit -m "feat(v2): add the canonical Unequip Item command codec"
```

---

## Task 7: Inventory PostgreSQL owner

**Files:**
- Create: `v2/src/Nexis.Persistence.Postgres/Migrations/0008_inventory_owner.sql`
- Create: `v2/src/Nexis.Persistence.Postgres/PostgresInventoryOwner.cs`
- Modify: `v2/src/Nexis.Persistence.Postgres/PostgresExecutionSchema.cs:8-17`
- Modify: `v2/src/Nexis.Persistence.Postgres/Nexis.Persistence.Postgres.csproj`
- Test: `v2/tests/Nexis.Persistence.Postgres.Tests/PostgresUnequipItemMultiOwnerIntegrationTests.cs`

**Interfaces:**
- Consumes: `IPostgresOwnerTransitionApplier`, `PostgresOwnerTransitionResult`, `AuthoritativeResourceKey`, `CanonicalResourceLockOrder`, `ReserveInventoryItemTransition`, `ReleaseInventoryItemReservationTransition`.
- Produces:
  - `PostgresInventoryTransitionApplier : IPostgresOwnerTransitionApplier` with `OwnerKey Owner => InventorySnapshot.OwnerKey`
  - `PostgresInventorySnapshotReader(NpgsqlDataSource dataSource)` with `ValueTask<InventorySnapshot> ReadAsync(CharacterId characterId, CancellationToken cancellationToken = default)`
  - Reason codes: `inventory.revision_conflict`, `inventory.reservation_conflict`, `inventory.possession_conflict`, `inventory.reservation_not_releasable`

The `UNIQUE (item_instance_id)` constraint on `inventory_item_reservations` is the structural no-double-spend guarantee: PostgreSQL, not only C#, refuses to commit a second reservation for one item instance. `23505` is classified as a concurrency conflict, closing the Inventory half of open finding L1.

- [ ] **Step 1: Write the failing test**

Create `v2/tests/Nexis.Persistence.Postgres.Tests/PostgresUnequipItemMultiOwnerIntegrationTests.cs` with the class scaffold, the shared helpers and the first test:

```csharp
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
using Nexis.Persistence.Postgres;
using Npgsql;
using NpgsqlTypes;

namespace Nexis.Persistence.Postgres.Tests;

/// <summary>
/// The C3 real multi-owner gameplay proof. Unequip Item clears the Equipment binding and releases
/// the same Inventory reservation atomically, exactly once, without double-spend, and commits
/// neither owner transition when an authoritative removal restriction denies it.
/// </summary>
[TestClass]
[DoNotParallelize]
public sealed class PostgresUnequipItemMultiOwnerIntegrationTests
{
    private static readonly EquipmentSlotKey MainHand = new("main-hand");
    private static readonly EquipmentPlacementKey MainHandPlacement = new("main-hand");
    private static readonly ContentDefinitionKey SwordKey = new(
        EquippableItemDefinition.ContractDescriptor,
        new ContentDefinitionId("iron-sword"));
    private static NpgsqlDataSource? s_dataSource;

    [ClassInitialize]
    public static async Task ClassInitialize(TestContext _)
    {
        var connectionString = Environment.GetEnvironmentVariable("NEXIS_TEST_POSTGRES_CONNECTION");
        if (string.IsNullOrWhiteSpace(connectionString))
        {
            Assert.Inconclusive("NEXIS_TEST_POSTGRES_CONNECTION is required for PostgreSQL integration tests.");
            return;
        }

        s_dataSource = NpgsqlDataSource.Create(connectionString);
        await PostgresExecutionSchema.EnsureCreatedAsync(s_dataSource);
    }

    [ClassCleanup]
    public static async Task ClassCleanup()
    {
        if (s_dataSource is not null)
        {
            await s_dataSource.DisposeAsync();
        }
    }

    [TestInitialize]
    public async Task TestInitialize()
    {
        const string sql = """
            TRUNCATE TABLE
                nexis_v2.inventory_item_reservations,
                nexis_v2.inventory_items,
                nexis_v2.inventory_state,
                nexis_v2.equipment_binding_slots,
                nexis_v2.equipment_bindings,
                nexis_v2.equipment_state,
                nexis_v2.event_consumer_checkpoints,
                nexis_v2.outbox,
                nexis_v2.authoritative_events,
                nexis_v2.admin_audit,
                nexis_v2.command_receipts
            CASCADE;
            """;

        await using var connection = await DataSource.OpenConnectionAsync();
        await using var command = new NpgsqlCommand(sql, connection);
        await command.ExecuteNonQueryAsync();
    }

    [TestMethod]
    public async Task InventoryOwner_ReservesAndReleasesWithoutChangingPossession()
    {
        var characterId = CharacterId.New();
        var itemId = ItemInstanceId.New();
        await SeedEquippedItemAsync(characterId, itemId, reserve: false, bind: false);

        var applier = new PostgresInventoryTransitionApplier();
        var reserve = new ReserveInventoryItemTransition(1, characterId, itemId, EquipmentSnapshot.OwnerKey);

        Assert.AreEqual(
            PostgresOwnerTransitionDisposition.Applied,
            (await ApplyDirectlyAsync(applier, reserve)).Disposition);

        var afterReserve = await new PostgresInventorySnapshotReader(DataSource).ReadAsync(characterId);
        Assert.AreEqual(2L, afterReserve.Revision);
        Assert.AreEqual(1, afterReserve.Items.Count);
        Assert.AreEqual(EquipmentSnapshot.OwnerKey, afterReserve.FindReservation(itemId)?.HoldingOwner);

        var release = new ReleaseInventoryItemReservationTransition(2, characterId, itemId, EquipmentSnapshot.OwnerKey);
        Assert.AreEqual(
            PostgresOwnerTransitionDisposition.Applied,
            (await ApplyDirectlyAsync(applier, release)).Disposition);

        var afterRelease = await new PostgresInventorySnapshotReader(DataSource).ReadAsync(characterId);
        Assert.AreEqual(3L, afterRelease.Revision);
        Assert.AreEqual(1, afterRelease.Items.Count, "Releasing a reservation must never change possession.");
        Assert.IsNull(afterRelease.FindReservation(itemId));
    }

    [TestMethod]
    public async Task InventoryOwner_RefusesASecondReservationAndARestrictedRelease()
    {
        var characterId = CharacterId.New();
        var itemId = ItemInstanceId.New();
        await SeedEquippedItemAsync(characterId, itemId, reserve: true, bind: true);

        var applier = new PostgresInventoryTransitionApplier();

        var double_spend = await ApplyDirectlyAsync(
            applier,
            new ReserveInventoryItemTransition(1, characterId, itemId, new OwnerKey("Marketplace")));
        Assert.AreEqual(PostgresOwnerTransitionDisposition.ConcurrencyConflict, double_spend.Disposition);
        Assert.AreEqual("inventory.reservation_conflict", double_spend.Reason?.Value);

        await SetReleaseRestrictionAsync(itemId, "Curse");

        var restricted = await ApplyDirectlyAsync(
            applier,
            new ReleaseInventoryItemReservationTransition(1, characterId, itemId, EquipmentSnapshot.OwnerKey));
        Assert.AreEqual(PostgresOwnerTransitionDisposition.ConcurrencyConflict, restricted.Disposition);
        Assert.AreEqual("inventory.reservation_not_releasable", restricted.Reason?.Value);

        var foreign = await ApplyDirectlyAsync(
            applier,
            new ReleaseInventoryItemReservationTransition(1, characterId, itemId, new OwnerKey("Marketplace")));
        Assert.AreEqual(PostgresOwnerTransitionDisposition.ConcurrencyConflict, foreign.Disposition);
    }

    [TestMethod]
    public async Task InventoryOwner_DeclaresEveryResourceItLocks()
    {
        var characterId = CharacterId.New();
        var itemId = ItemInstanceId.New();
        var applier = new PostgresInventoryTransitionApplier();

        var keys = applier.ResolveLockKeys(
            new ReleaseInventoryItemReservationTransition(1, characterId, itemId, EquipmentSnapshot.OwnerKey));

        CollectionAssert.AreEqual(
            new[]
            {
                $"Inventory/inventory.aggregate/{characterId.Value:D}",
                $"Inventory/inventory.reservation/{characterId.Value:D}/{itemId.Value:D}"
            },
            keys.Select(static key => key.ToString()).ToArray());
        Assert.IsTrue(keys.All(key => key.Owner == InventorySnapshot.OwnerKey));
    }

    private static async Task<PostgresOwnerTransitionResult> ApplyDirectlyAsync(
        IPostgresOwnerTransitionApplier applier,
        IOwnerTransition transition)
    {
        await using var connection = await DataSource.OpenConnectionAsync();
        await using var transaction = await connection.BeginTransactionAsync();
        var result = await applier.ApplyAsync(connection, transaction, transition);
        if (result.Disposition == PostgresOwnerTransitionDisposition.Applied)
        {
            await transaction.CommitAsync();
        }
        else
        {
            await transaction.RollbackAsync();
        }

        return result;
    }

    private static async Task SeedEquippedItemAsync(
        CharacterId characterId,
        ItemInstanceId itemId,
        bool reserve,
        bool bind,
        long inventoryRevision = 1,
        long equipmentRevision = 1)
    {
        await using var connection = await DataSource.OpenConnectionAsync();

        await ExecAsync(connection,
            "INSERT INTO nexis_v2.inventory_state(character_id, revision) VALUES (@c, @r);",
            ("c", NpgsqlDbType.Uuid, characterId.Value), ("r", NpgsqlDbType.Bigint, inventoryRevision));
        await ExecAsync(connection,
            """
            INSERT INTO nexis_v2.inventory_items(
                character_id, item_instance_id, definition_contract_name,
                definition_schema_version, definition_id)
            VALUES (@c, @i, @n, @v, @d);
            """,
            ("c", NpgsqlDbType.Uuid, characterId.Value), ("i", NpgsqlDbType.Uuid, itemId.Value),
            ("n", NpgsqlDbType.Text, SwordKey.Contract.Name),
            ("v", NpgsqlDbType.Integer, SwordKey.Contract.SchemaVersion),
            ("d", NpgsqlDbType.Text, SwordKey.DefinitionId.Value));
        await ExecAsync(connection,
            "INSERT INTO nexis_v2.equipment_state(character_id, revision) VALUES (@c, @r);",
            ("c", NpgsqlDbType.Uuid, characterId.Value), ("r", NpgsqlDbType.Bigint, equipmentRevision));

        if (reserve)
        {
            await ExecAsync(connection,
                """
                INSERT INTO nexis_v2.inventory_item_reservations(
                    character_id, item_instance_id, holding_owner)
                VALUES (@c, @i, @o);
                """,
                ("c", NpgsqlDbType.Uuid, characterId.Value), ("i", NpgsqlDbType.Uuid, itemId.Value),
                ("o", NpgsqlDbType.Text, EquipmentSnapshot.OwnerKey.Value));
        }

        if (bind)
        {
            await ExecAsync(connection,
                """
                INSERT INTO nexis_v2.equipment_bindings(character_id, item_instance_id, placement_key)
                VALUES (@c, @i, @p);
                """,
                ("c", NpgsqlDbType.Uuid, characterId.Value), ("i", NpgsqlDbType.Uuid, itemId.Value),
                ("p", NpgsqlDbType.Text, MainHandPlacement.Value));
            await ExecAsync(connection,
                """
                INSERT INTO nexis_v2.equipment_binding_slots(character_id, item_instance_id, slot_key)
                VALUES (@c, @i, @s);
                """,
                ("c", NpgsqlDbType.Uuid, characterId.Value), ("i", NpgsqlDbType.Uuid, itemId.Value),
                ("s", NpgsqlDbType.Text, MainHand.Value));
        }
    }

    private static async Task SetReleaseRestrictionAsync(ItemInstanceId itemId, string declaringOwner)
    {
        await using var connection = await DataSource.OpenConnectionAsync();
        await ExecAsync(connection,
            """
            UPDATE nexis_v2.inventory_item_reservations
            SET restriction_declaring_owner = @o
            WHERE item_instance_id = @i;
            """,
            ("o", NpgsqlDbType.Text, declaringOwner), ("i", NpgsqlDbType.Uuid, itemId.Value));
    }

    private static async Task ExecAsync(
        NpgsqlConnection connection,
        string sql,
        params (string Name, NpgsqlDbType Type, object Value)[] parameters)
    {
        await using var command = new NpgsqlCommand(sql, connection);
        foreach (var parameter in parameters)
        {
            command.Parameters.AddWithValue(parameter.Name, parameter.Type, parameter.Value);
        }

        await command.ExecuteNonQueryAsync();
    }

    private static async Task<int> ScalarIntAsync(string sql)
    {
        await using var connection = await DataSource.OpenConnectionAsync();
        await using var command = new NpgsqlCommand(sql, connection);
        return Convert.ToInt32(await command.ExecuteScalarAsync());
    }

    private static DateTimeOffset Utc(int hour, int minute, int second = 0) =>
        new(2026, 8, 29, hour, minute, second, TimeSpan.Zero);

    private static NpgsqlDataSource DataSource =>
        s_dataSource ?? throw new InvalidOperationException("PostgreSQL test data source was not initialized.");

    private sealed class FixedRandomFactory : IDeterministicRandomFactory
    {
        public IDeterministicRandomSource Create() => new FixedRandomSource();

        private sealed class FixedRandomSource : IDeterministicRandomSource
        {
            public ulong NextUInt64() => 1;
        }
    }
}
```

- [ ] **Step 2: Run test to verify it fails**

Start the disposable database and export the connection string first:

```bash
docker exec nexis-claude-cont-20260829 psql -U postgres -c "DROP DATABASE IF EXISTS nexis_c3; CREATE DATABASE nexis_c3;"
export NEXIS_TEST_POSTGRES_CONNECTION="Host=127.0.0.1;Port=55501;Database=nexis_c3;Username=postgres;Password=$PGPASSWORD"
```

Run: `dotnet test v2/tests/Nexis.Persistence.Postgres.Tests/Nexis.Persistence.Postgres.Tests.csproj --filter "FullyQualifiedName~PostgresUnequipItemMultiOwnerIntegrationTests"`
Expected: BUILD FAILURE, `CS0246` — `PostgresInventoryTransitionApplier` and `PostgresInventorySnapshotReader` do not exist.

- [ ] **Step 3: Write the migration**

Create `v2/src/Nexis.Persistence.Postgres/Migrations/0008_inventory_owner.sql`:

```sql
CREATE TABLE IF NOT EXISTS nexis_v2.inventory_state (
    character_id uuid PRIMARY KEY,
    revision bigint NOT NULL CHECK (revision >= 0)
);

CREATE TABLE IF NOT EXISTS nexis_v2.inventory_items (
    character_id uuid NOT NULL REFERENCES nexis_v2.inventory_state(character_id) ON DELETE CASCADE,
    item_instance_id uuid NOT NULL,
    definition_contract_name text NOT NULL CHECK (length(btrim(definition_contract_name)) > 0),
    definition_schema_version integer NOT NULL CHECK (definition_schema_version > 0),
    definition_id text NOT NULL CHECK (length(btrim(definition_id)) > 0),
    PRIMARY KEY (character_id, item_instance_id),
    UNIQUE (item_instance_id)
);

-- M-reserve: at most one authoritative reservation may exist for an item instance at a time.
-- The UNIQUE constraint is the structural double-spend guard; it does not rely on C# checks.
-- restriction_declaring_owner names the authority that declared the item non-removable through
-- the ordinary release path. It is the integration seam for a future approved curse/effect owner;
-- no curse, effect, questline or purification state is modelled here.
CREATE TABLE IF NOT EXISTS nexis_v2.inventory_item_reservations (
    character_id uuid NOT NULL,
    item_instance_id uuid NOT NULL,
    holding_owner text NOT NULL CHECK (length(btrim(holding_owner)) > 0),
    restriction_declaring_owner text NULL CHECK (
        restriction_declaring_owner IS NULL
        OR length(btrim(restriction_declaring_owner)) > 0
    ),
    PRIMARY KEY (character_id, item_instance_id),
    UNIQUE (item_instance_id),
    FOREIGN KEY (character_id, item_instance_id)
        REFERENCES nexis_v2.inventory_items(character_id, item_instance_id)
        ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS ix_inventory_items_character
    ON nexis_v2.inventory_items(character_id);
```

Register it in `v2/src/Nexis.Persistence.Postgres/PostgresExecutionSchema.cs` by appending to `OrderedResources`:

```csharp
        "Nexis.Persistence.Postgres.Migrations.0008_inventory_owner.sql"
```

Add to `v2/src/Nexis.Persistence.Postgres/Nexis.Persistence.Postgres.csproj`, in the first `ItemGroup` of project references:

```xml
    <ProjectReference Include="..\Nexis.Inventory.Contracts\Nexis.Inventory.Contracts.csproj" />
```

and in the `EmbeddedResource` `ItemGroup`:

```xml
    <EmbeddedResource Include="Migrations\0008_inventory_owner.sql" LogicalName="Nexis.Persistence.Postgres.Migrations.0008_inventory_owner.sql" />
```

- [ ] **Step 4: Write the Inventory owner adapter**

Create `v2/src/Nexis.Persistence.Postgres/PostgresInventoryOwner.cs`:

```csharp
using Nexis.Content.Contracts;
using Nexis.Core.Contracts;
using Nexis.Execution;
using Nexis.Execution.Contracts;
using Nexis.Identity.Contracts;
using Nexis.Inventory.Contracts;
using Nexis.Items.Contracts;
using Npgsql;
using NpgsqlTypes;

namespace Nexis.Persistence.Postgres;

/// <summary>
/// Real PostgreSQL write adapter for the Inventory owner under M-reserve. It applies only typed
/// reservation transitions. It never creates, deletes or transfers item possession, and it never
/// writes Equipment state.
/// </summary>
public sealed class PostgresInventoryTransitionApplier : IPostgresOwnerTransitionApplier
{
    private static readonly CommandReasonCode RevisionConflict = new("inventory.revision_conflict");
    private static readonly CommandReasonCode ReservationConflict = new("inventory.reservation_conflict");
    private static readonly CommandReasonCode PossessionConflict = new("inventory.possession_conflict");
    private static readonly CommandReasonCode ReservationNotReleasable = new("inventory.reservation_not_releasable");

    private const string UniqueViolation = "23505";
    private const string ForeignKeyViolation = "23503";

    public OwnerKey Owner => InventorySnapshot.OwnerKey;

    public IReadOnlyList<AuthoritativeResourceKey> ResolveLockKeys(IOwnerTransition transition)
    {
        var (characterId, itemInstanceId) = Describe(transition);
        var character = characterId.Value.ToString("D");
        var item = itemInstanceId.Value.ToString("D");

        return CanonicalResourceLockOrder.Order(new[]
        {
            new AuthoritativeResourceKey(Owner, "inventory.aggregate", character),
            new AuthoritativeResourceKey(Owner, "inventory.reservation", $"{character}/{item}")
        });
    }

    public async ValueTask<PostgresOwnerTransitionResult> ApplyAsync(
        NpgsqlConnection connection,
        NpgsqlTransaction transaction,
        IOwnerTransition transition,
        CancellationToken cancellationToken = default)
    {
        ArgumentNullException.ThrowIfNull(connection);
        ArgumentNullException.ThrowIfNull(transaction);
        ArgumentNullException.ThrowIfNull(transition);

        var (characterId, itemInstanceId) = Describe(transition);
        if (transition.ExpectedRevision is not { } expectedRevision)
        {
            throw new InvalidOperationException("Inventory transitions require an optimistic Inventory revision.");
        }

        const string revisionSql = """
            UPDATE nexis_v2.inventory_state
            SET revision = revision + 1
            WHERE character_id = @character_id
              AND revision = @expected_revision;
            """;

        await using (var revisionCommand = new NpgsqlCommand(revisionSql, connection, transaction))
        {
            revisionCommand.Parameters.AddWithValue("character_id", NpgsqlDbType.Uuid, characterId.Value);
            revisionCommand.Parameters.AddWithValue("expected_revision", NpgsqlDbType.Bigint, expectedRevision);
            if (await revisionCommand.ExecuteNonQueryAsync(cancellationToken).ConfigureAwait(false) != 1)
            {
                return PostgresOwnerTransitionResult.ConcurrencyConflict(RevisionConflict);
            }
        }

        return transition switch
        {
            ReserveInventoryItemTransition reserve =>
                await ReserveAsync(connection, transaction, reserve, cancellationToken).ConfigureAwait(false),
            ReleaseInventoryItemReservationTransition release =>
                await ReleaseAsync(connection, transaction, release, cancellationToken).ConfigureAwait(false),
            _ => throw Unsupported(transition)
        };
    }

    private static async ValueTask<PostgresOwnerTransitionResult> ReserveAsync(
        NpgsqlConnection connection,
        NpgsqlTransaction transaction,
        ReserveInventoryItemTransition reserve,
        CancellationToken cancellationToken)
    {
        const string sql = """
            INSERT INTO nexis_v2.inventory_item_reservations (
                character_id, item_instance_id, holding_owner)
            VALUES (@character_id, @item_instance_id, @holding_owner);
            """;

        await using var command = new NpgsqlCommand(sql, connection, transaction);
        command.Parameters.AddWithValue("character_id", NpgsqlDbType.Uuid, reserve.CharacterId.Value);
        command.Parameters.AddWithValue("item_instance_id", NpgsqlDbType.Uuid, reserve.ItemInstanceId.Value);
        command.Parameters.AddWithValue("holding_owner", NpgsqlDbType.Text, reserve.HoldingOwner.Value);

        try
        {
            await command.ExecuteNonQueryAsync(cancellationToken).ConfigureAwait(false);
            return PostgresOwnerTransitionResult.Applied();
        }
        catch (PostgresException exception) when (exception.SqlState == UniqueViolation)
        {
            // The item was reserved by a concurrent command between snapshot load and commit.
            // This is contention over a scarce resource, not an infrastructure fault.
            return PostgresOwnerTransitionResult.ConcurrencyConflict(ReservationConflict);
        }
        catch (PostgresException exception) when (exception.SqlState == ForeignKeyViolation)
        {
            // Possession changed under us; Core evaluated against a stale Inventory snapshot.
            return PostgresOwnerTransitionResult.ConcurrencyConflict(PossessionConflict);
        }
    }

    private static async ValueTask<PostgresOwnerTransitionResult> ReleaseAsync(
        NpgsqlConnection connection,
        NpgsqlTransaction transaction,
        ReleaseInventoryItemReservationTransition release,
        CancellationToken cancellationToken)
    {
        // The predicate is the persistence-boundary half of the removal-restriction rule: a
        // restricted reservation is not releasable even if Core were bypassed or stale.
        const string sql = """
            DELETE FROM nexis_v2.inventory_item_reservations
            WHERE character_id = @character_id
              AND item_instance_id = @item_instance_id
              AND holding_owner = @holding_owner
              AND restriction_declaring_owner IS NULL;
            """;

        await using var command = new NpgsqlCommand(sql, connection, transaction);
        command.Parameters.AddWithValue("character_id", NpgsqlDbType.Uuid, release.CharacterId.Value);
        command.Parameters.AddWithValue("item_instance_id", NpgsqlDbType.Uuid, release.ItemInstanceId.Value);
        command.Parameters.AddWithValue("holding_owner", NpgsqlDbType.Text, release.HoldingOwner.Value);

        return await command.ExecuteNonQueryAsync(cancellationToken).ConfigureAwait(false) == 1
            ? PostgresOwnerTransitionResult.Applied()
            : PostgresOwnerTransitionResult.ConcurrencyConflict(ReservationNotReleasable);
    }

    private static (CharacterId CharacterId, ItemInstanceId ItemInstanceId) Describe(IOwnerTransition transition) =>
        transition switch
        {
            ReserveInventoryItemTransition reserve => (reserve.CharacterId, reserve.ItemInstanceId),
            ReleaseInventoryItemReservationTransition release => (release.CharacterId, release.ItemInstanceId),
            _ => throw Unsupported(transition)
        };

    private static InvalidOperationException Unsupported(IOwnerTransition transition) =>
        new($"Inventory PostgreSQL owner does not support transition '{transition.Contract.Name}' schema {transition.Contract.SchemaVersion}.");
}

/// <summary>
/// Consistent reader for the Inventory owner's authoritative snapshot, including the M-reserve
/// availability answer. Missing owner state is treated as provisioning failure rather than
/// fabricated revision zero.
/// </summary>
public sealed class PostgresInventorySnapshotReader
{
    private readonly NpgsqlDataSource _dataSource;

    public PostgresInventorySnapshotReader(NpgsqlDataSource dataSource)
    {
        _dataSource = dataSource ?? throw new ArgumentNullException(nameof(dataSource));
    }

    public async ValueTask<InventorySnapshot> ReadAsync(
        CharacterId characterId,
        CancellationToken cancellationToken = default)
    {
        if (characterId.IsEmpty)
        {
            throw new ArgumentException("Inventory snapshot reads require a non-empty CharacterId.", nameof(characterId));
        }

        const string sql = """
            SELECT s.revision,
                   i.item_instance_id,
                   i.definition_contract_name,
                   i.definition_schema_version,
                   i.definition_id,
                   r.holding_owner,
                   r.restriction_declaring_owner
            FROM nexis_v2.inventory_state AS s
            LEFT JOIN nexis_v2.inventory_items AS i
              ON i.character_id = s.character_id
            LEFT JOIN nexis_v2.inventory_item_reservations AS r
              ON r.character_id = i.character_id
             AND r.item_instance_id = i.item_instance_id
            WHERE s.character_id = @character_id
            ORDER BY i.item_instance_id;
            """;

        await using var connection = await _dataSource.OpenConnectionAsync(cancellationToken).ConfigureAwait(false);
        await using var command = new NpgsqlCommand(sql, connection);
        command.Parameters.AddWithValue("character_id", NpgsqlDbType.Uuid, characterId.Value);
        await using var reader = await command.ExecuteReaderAsync(cancellationToken).ConfigureAwait(false);

        long? revision = null;
        var items = new List<InventoryItemReference>();
        var reservations = new List<InventoryItemReservation>();

        while (await reader.ReadAsync(cancellationToken).ConfigureAwait(false))
        {
            revision ??= reader.GetInt64(0);
            if (reader.IsDBNull(1))
            {
                continue;
            }

            var itemId = new ItemInstanceId(reader.GetGuid(1));
            items.Add(new InventoryItemReference(
                itemId,
                new ContentDefinitionKey(
                    new ContractDescriptor(reader.GetString(2), reader.GetInt32(3)),
                    new ContentDefinitionId(reader.GetString(4)))));

            if (!reader.IsDBNull(5))
            {
                reservations.Add(new InventoryItemReservation(
                    itemId,
                    new OwnerKey(reader.GetString(5)),
                    reader.IsDBNull(6) ? null : new ItemReleaseRestriction(new OwnerKey(reader.GetString(6)))));
            }
        }

        if (!revision.HasValue)
        {
            throw new KeyNotFoundException($"Inventory state is not provisioned for character '{characterId.Value:D}'.");
        }

        return new InventorySnapshot(characterId, revision.Value, items, reservations);
    }
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `dotnet test v2/tests/Nexis.Persistence.Postgres.Tests/Nexis.Persistence.Postgres.Tests.csproj --filter "FullyQualifiedName~PostgresUnequipItemMultiOwnerIntegrationTests"`
Expected: PASS, 3 passed.

- [ ] **Step 6: Commit**

```bash
git add v2/src/Nexis.Persistence.Postgres/Migrations/0008_inventory_owner.sql \
        v2/src/Nexis.Persistence.Postgres/PostgresInventoryOwner.cs \
        v2/src/Nexis.Persistence.Postgres/PostgresExecutionSchema.cs \
        v2/src/Nexis.Persistence.Postgres/Nexis.Persistence.Postgres.csproj \
        v2/tests/Nexis.Persistence.Postgres.Tests/PostgresUnequipItemMultiOwnerIntegrationTests.cs
git commit -m "feat(v2): add the real Inventory PostgreSQL owner with structural reservation guards"
```

---

## Task 8: Equipment owner unbinds, and the C3 database proof

**Files:**
- Modify: `v2/src/Nexis.Persistence.Postgres/PostgresEquipmentOwner.cs:17-111`
- Modify: `v2/tests/Nexis.Persistence.Postgres.Tests/PostgresEquipItemVerticalIntegrationTests.cs`
- Test: `v2/tests/Nexis.Persistence.Postgres.Tests/PostgresUnequipItemMultiOwnerIntegrationTests.cs`

**Interfaces:**
- Consumes: `UnequipItemTransition` (Task 4), `PostgresInventoryTransitionApplier` + `PostgresInventorySnapshotReader` (Task 7), `UnequipItemCanonicalCommandCodec` (Task 6).
- Produces: `PostgresEquipmentTransitionApplier` handles both `EquipItemTransition` and `UnequipItemTransition`; new reason code `equipment.binding_missing`.

- [ ] **Step 1: Write the failing C3 proof tests**

Append to `v2/tests/Nexis.Persistence.Postgres.Tests/PostgresUnequipItemMultiOwnerIntegrationTests.cs`:

```csharp
    [TestMethod]
    public async Task UnequipItem_CommitsEquipmentClearAndInventoryReleaseAtomically()
    {
        var characterId = CharacterId.New();
        var itemId = ItemInstanceId.New();
        await SeedEquippedItemAsync(characterId, itemId, reserve: true, bind: true);

        var commit = await ExecuteUnequipAsync(characterId, itemId, CommandId.New(), "c3-happy");

        Assert.AreEqual(CommandCommitDisposition.Committed, commit.Result.Disposition);

        var equipment = await new PostgresEquipmentSnapshotReader(DataSource).ReadAsync(characterId);
        Assert.AreEqual(2L, equipment.Revision);
        Assert.AreEqual(0, equipment.Bindings.Count, "Equipment must have cleared the equipped reference.");
        Assert.AreEqual(0, await ScalarIntAsync("SELECT count(*) FROM nexis_v2.equipment_binding_slots;"));

        var inventory = await new PostgresInventorySnapshotReader(DataSource).ReadAsync(characterId);
        Assert.AreEqual(2L, inventory.Revision);
        Assert.IsNull(inventory.FindReservation(itemId), "Inventory must have released the same reservation.");
        Assert.AreEqual(1, inventory.Items.Count, "Possession must be unchanged by unequip.");

        Assert.AreEqual(1, await ScalarIntAsync("SELECT count(*) FROM nexis_v2.authoritative_events;"));
        Assert.AreEqual(1, await ScalarIntAsync("SELECT count(*) FROM nexis_v2.outbox;"));
        Assert.AreEqual(
            1,
            await ScalarIntAsync(
                "SELECT count(*) FROM nexis_v2.authoritative_events "
                + "WHERE contract_name = 'nexis.equipment.item-unequipped';"));
    }

    [TestMethod]
    public async Task UnequipItem_StaleInventoryRevision_CommitsNeitherOwnerTransition()
    {
        var characterId = CharacterId.New();
        var itemId = ItemInstanceId.New();
        await SeedEquippedItemAsync(characterId, itemId, reserve: true, bind: true);

        var commit = await ExecuteUnequipAsync(
            characterId,
            itemId,
            CommandId.New(),
            "c3-stale-inventory",
            beforeCommit: async () => await BumpRevisionAsync("nexis_v2.inventory_state", characterId));

        Assert.AreEqual(CommandCommitDisposition.ConcurrencyConflict, commit.Result.Disposition);
        await AssertNothingCommittedAsync(characterId, itemId);
    }

    [TestMethod]
    public async Task UnequipItem_StaleEquipmentRevision_CommitsNeitherOwnerTransition()
    {
        var characterId = CharacterId.New();
        var itemId = ItemInstanceId.New();
        await SeedEquippedItemAsync(characterId, itemId, reserve: true, bind: true);

        var commit = await ExecuteUnequipAsync(
            characterId,
            itemId,
            CommandId.New(),
            "c3-stale-equipment",
            beforeCommit: async () => await BumpRevisionAsync("nexis_v2.equipment_state", characterId));

        Assert.AreEqual(CommandCommitDisposition.ConcurrencyConflict, commit.Result.Disposition);
        Assert.AreEqual("equipment.revision_conflict", commit.Result.Reason?.Value);
        Assert.AreEqual(1, await ScalarIntAsync("SELECT count(*) FROM nexis_v2.equipment_bindings;"));
        Assert.AreEqual(1, await ScalarIntAsync("SELECT count(*) FROM nexis_v2.inventory_item_reservations;"));
        Assert.AreEqual(0, await ScalarIntAsync("SELECT count(*) FROM nexis_v2.authoritative_events;"));
        Assert.AreEqual(0, await ScalarIntAsync("SELECT count(*) FROM nexis_v2.outbox;"));
    }

    [TestMethod]
    public async Task UnequipItem_RepeatedCommandId_IsExactlyOnceAndNeverReleasesTwice()
    {
        var characterId = CharacterId.New();
        var itemId = ItemInstanceId.New();
        await SeedEquippedItemAsync(characterId, itemId, reserve: true, bind: true);
        var commandId = CommandId.New();

        var first = await ExecuteUnequipAsync(characterId, itemId, commandId, "c3-idempotent-1");
        Assert.AreEqual(CommandCommitDisposition.Committed, first.Result.Disposition);

        var replay = await new PostgresCommandReceiptRepository(DataSource).TryAcquireAsync(
            new CommandReceiptAcquireRequest(
                first.Identity,
                first.Payload,
                CorrelationId.New(),
                Utc(10, 5),
                new CommandExecutionLeaseRequest("c3-idempotent-2", TimeSpan.FromMinutes(1))));

        Assert.AreEqual(CommandReceiptDisposition.DuplicateCompleted, replay.Disposition);
        Assert.AreEqual(CommandTerminalStatus.Succeeded, replay.TerminalOutcome?.Status);

        var inventory = await new PostgresInventorySnapshotReader(DataSource).ReadAsync(characterId);
        Assert.AreEqual(2L, inventory.Revision, "A retried unequip must not advance the Inventory revision again.");
        Assert.AreEqual(1, inventory.Items.Count, "A retried unequip must not duplicate the item.");
        Assert.AreEqual(1, await ScalarIntAsync("SELECT count(*) FROM nexis_v2.authoritative_events;"));
        Assert.AreEqual(1, await ScalarIntAsync("SELECT count(*) FROM nexis_v2.outbox;"));
    }

    [TestMethod]
    public async Task ConcurrentUnequips_ProduceExactlyOneReleaseAndNoDoubleSpend()
    {
        var characterId = CharacterId.New();
        var itemId = ItemInstanceId.New();
        await SeedEquippedItemAsync(characterId, itemId, reserve: true, bind: true);

        // Both commands evaluate against the same pre-unequip snapshots, as two racing clients would.
        var first = await PrepareUnequipAsync(characterId, itemId, CommandId.New(), "c3-race-a");
        var second = await PrepareUnequipAsync(characterId, itemId, CommandId.New(), "c3-race-b");

        var results = await Task.WhenAll(
            Committer().CommitAsync(first.Plan).AsTask(),
            Committer().CommitAsync(second.Plan).AsTask());

        Assert.AreEqual(
            1,
            results.Count(static result => result.Disposition == CommandCommitDisposition.Committed),
            "Exactly one concurrent unequip may win.");
        Assert.AreEqual(
            1,
            results.Count(static result => result.Disposition == CommandCommitDisposition.ConcurrencyConflict));

        var inventory = await new PostgresInventorySnapshotReader(DataSource).ReadAsync(characterId);
        Assert.AreEqual(2L, inventory.Revision);
        Assert.AreEqual(1, inventory.Items.Count, "The item must never be duplicated by a race.");
        Assert.AreEqual(0, await ScalarIntAsync("SELECT count(*) FROM nexis_v2.inventory_item_reservations;"));
        Assert.AreEqual(1, await ScalarIntAsync("SELECT count(*) FROM nexis_v2.authoritative_events;"));
    }

    [TestMethod]
    public async Task OpposingReservationAfterUnequip_CannotDoubleSpendTheItem()
    {
        var characterId = CharacterId.New();
        var itemId = ItemInstanceId.New();
        await SeedEquippedItemAsync(characterId, itemId, reserve: true, bind: true);

        // A competing owner captured the pre-unequip Inventory snapshot and tries to escrow the
        // item after the unequip has already advanced Inventory.
        var opposing = new ReserveInventoryItemTransition(1, characterId, itemId, new OwnerKey("Marketplace"));

        var unequip = await ExecuteUnequipAsync(characterId, itemId, CommandId.New(), "c3-opposing");
        Assert.AreEqual(CommandCommitDisposition.Committed, unequip.Result.Disposition);

        var stale = await ApplyDirectlyAsync(new PostgresInventoryTransitionApplier(), opposing);
        Assert.AreEqual(PostgresOwnerTransitionDisposition.ConcurrencyConflict, stale.Disposition);
        Assert.AreEqual("inventory.revision_conflict", stale.Reason?.Value);
        Assert.AreEqual(0, await ScalarIntAsync("SELECT count(*) FROM nexis_v2.inventory_item_reservations;"));
    }

    [TestMethod]
    public async Task UnequipDeniedByRemovalRestriction_CommitsNeitherOwnerTransition()
    {
        var characterId = CharacterId.New();
        var itemId = ItemInstanceId.New();
        await SeedEquippedItemAsync(characterId, itemId, reserve: true, bind: true);
        await SetReleaseRestrictionAsync(itemId, "Curse");

        // 1. Core refuses before any transition exists.
        var request = await BuildUnequipRequestAsync(characterId, itemId, CommandId.New());
        var decision = new CoreRulesEngine().Evaluate(request);
        Assert.AreEqual(CoreOutcomeStatus.Rejected, decision.Status);
        Assert.AreEqual("equipment.unequip.release_restricted", decision.Reason?.Value);
        Assert.AreEqual(0, decision.Transitions.Count);

        // 2. The persistence boundary refuses independently, so a bypassed or stale Core cannot
        //    commit the Equipment clear either. Both transitions are forced into one plan.
        var forced = await PrepareForcedReleasePlanAsync(characterId, itemId, CommandId.New(), "c3-restricted");
        var commit = await Committer().CommitAsync(forced);

        Assert.AreEqual(CommandCommitDisposition.ConcurrencyConflict, commit.Disposition);
        Assert.AreEqual("inventory.reservation_not_releasable", commit.Reason?.Value);
        await AssertNothingCommittedAsync(characterId, itemId);
    }

    [TestMethod]
    public async Task UnequipDeclaredLockKeys_CoverEveryResourceTheCommandWrites()
    {
        var characterId = CharacterId.New();
        var itemId = ItemInstanceId.New();
        var equipmentApplier = new PostgresEquipmentTransitionApplier();
        var inventoryApplier = new PostgresInventoryTransitionApplier();

        var unbind = new UnequipItemTransition(1, characterId, itemId, MainHandPlacement, new[] { MainHand });
        var release = new ReleaseInventoryItemReservationTransition(1, characterId, itemId, EquipmentSnapshot.OwnerKey);

        var declared = CanonicalResourceLockOrder.Order(
                equipmentApplier.ResolveLockKeys(unbind).Concat(inventoryApplier.ResolveLockKeys(release)))
            .Select(static key => key.ToString())
            .ToArray();

        CollectionAssert.AreEqual(
            new[]
            {
                $"Equipment/equipment.aggregate/{characterId.Value:D}",
                $"Equipment/equipment.binding/{characterId.Value:D}/{itemId.Value:D}",
                $"Equipment/equipment.slot/{characterId.Value:D}/main-hand",
                $"Inventory/inventory.aggregate/{characterId.Value:D}",
                $"Inventory/inventory.reservation/{characterId.Value:D}/{itemId.Value:D}"
            },
            declared,
            "Both owners must declare every resource the unequip command touches, in one canonical order.");
    }

    private static async Task AssertNothingCommittedAsync(CharacterId characterId, ItemInstanceId itemId)
    {
        var equipment = await new PostgresEquipmentSnapshotReader(DataSource).ReadAsync(characterId);
        Assert.AreEqual(1, equipment.Bindings.Count, "Equipment must not have cleared its binding.");
        Assert.AreEqual(itemId, equipment.Bindings[0].ItemInstanceId);
        Assert.AreEqual(1, await ScalarIntAsync("SELECT count(*) FROM nexis_v2.inventory_item_reservations;"));
        Assert.AreEqual(0, await ScalarIntAsync("SELECT count(*) FROM nexis_v2.authoritative_events;"));
        Assert.AreEqual(0, await ScalarIntAsync("SELECT count(*) FROM nexis_v2.outbox;"));
        Assert.AreEqual(
            0,
            await ScalarIntAsync("SELECT count(*) FROM nexis_v2.command_receipts WHERE terminal_status IS NOT NULL;"));
    }

    private static async Task BumpRevisionAsync(string table, CharacterId characterId)
    {
        await using var connection = await DataSource.OpenConnectionAsync();
        await ExecAsync(connection,
            $"UPDATE {table} SET revision = revision + 1 WHERE character_id = @c;",
            ("c", NpgsqlDbType.Uuid, characterId.Value));
    }

    private static PostgresAtomicCommandCommitter Committer() =>
        new(
            DataSource,
            new IPostgresOwnerTransitionApplier[]
            {
                new PostgresEquipmentTransitionApplier(),
                new PostgresInventoryTransitionApplier()
            });

    private static async Task<CoreEvaluationRequest> BuildUnequipRequestAsync(
        CharacterId characterId,
        ItemInstanceId itemId,
        CommandId commandId)
    {
        var inventory = await new PostgresInventorySnapshotReader(DataSource).ReadAsync(characterId);
        var equipment = await new PostgresEquipmentSnapshotReader(DataSource).ReadAsync(characterId);

        return new CoreEvaluationRequest(
            CoreContractVersion.V1,
            new CoreEvaluationContext(
                commandId,
                CorrelationId.New(),
                TrustedActorContext.CreatePlayer(AccountId.New(), characterId, 1),
                Utc(10, 0),
                new RuleVersion("unequip-proof-rules-v1"),
                new ContentVersion("unequip-proof-v1"),
                new FixedRandomFactory()),
            new UnequipItemIntent(characterId, itemId),
            new IAuthoritativeSnapshot[]
            {
                inventory,
                equipment,
                new CombatParticipationSnapshot(characterId, 1, false)
            });
    }

    private static async Task<PreparedCommand> PrepareUnequipAsync(
        CharacterId characterId,
        ItemInstanceId itemId,
        CommandId commandId,
        string owner)
    {
        var request = await BuildUnequipRequestAsync(characterId, itemId, commandId);
        var engine = new CoreRulesEngine();
        var decision = engine.Evaluate(request);
        Assert.AreEqual(CoreOutcomeStatus.Succeeded, decision.Status);

        var payload = new UnequipItemCanonicalCommandCodec().Serialize(request.Intent);
        var identity = CommandExecutionIdentityFactory.Create(request, payload);
        var claim = await new PostgresCommandReceiptRepository(DataSource).TryAcquireAsync(
            new CommandReceiptAcquireRequest(
                identity,
                payload,
                request.Context.CorrelationId,
                Utc(10, 0),
                new CommandExecutionLeaseRequest(owner, TimeSpan.FromMinutes(1))));
        Assert.AreEqual(CommandReceiptDisposition.Acquired, claim.Disposition);

        var plan = new CommandCommitPlanBuilder().Build(
            request,
            payload.Fingerprint,
            claim,
            decision,
            engine.Descriptor,
            Utc(10, 0, 1));

        return new PreparedCommand(identity, payload, plan);
    }

    private static async Task<CommandCommitPlan> PrepareForcedReleasePlanAsync(
        CharacterId characterId,
        ItemInstanceId itemId,
        CommandId commandId,
        string owner)
    {
        var equipment = await new PostgresEquipmentSnapshotReader(DataSource).ReadAsync(characterId);
        var inventory = await new PostgresInventorySnapshotReader(DataSource).ReadAsync(characterId);
        var binding = equipment.Bindings.Single(b => b.ItemInstanceId == itemId);

        var request = await BuildUnequipRequestAsync(characterId, itemId, commandId);
        var engine = new CoreRulesEngine();
        var forcedDecision = CoreDecision.Succeeded(
            transitions: new IOwnerTransition[]
            {
                new UnequipItemTransition(
                    equipment.Revision, characterId, itemId, binding.PlacementKey, binding.OccupiedSlots),
                new ReleaseInventoryItemReservationTransition(
                    inventory.Revision, characterId, itemId, EquipmentSnapshot.OwnerKey)
            },
            events: new ICoreEventDescriptor[]
            {
                new ItemUnequippedEvent(characterId, itemId, binding.PlacementKey, binding.OccupiedSlots)
            });

        var payload = new UnequipItemCanonicalCommandCodec().Serialize(request.Intent);
        var claim = await new PostgresCommandReceiptRepository(DataSource).TryAcquireAsync(
            new CommandReceiptAcquireRequest(
                CommandExecutionIdentityFactory.Create(request, payload),
                payload,
                request.Context.CorrelationId,
                Utc(10, 0),
                new CommandExecutionLeaseRequest(owner, TimeSpan.FromMinutes(1))));

        return new CommandCommitPlanBuilder().Build(
            request, payload.Fingerprint, claim, forcedDecision, engine.Descriptor, Utc(10, 0, 1));
    }

    private static async Task<ExecutedCommand> ExecuteUnequipAsync(
        CharacterId characterId,
        ItemInstanceId itemId,
        CommandId commandId,
        string owner,
        Func<Task>? beforeCommit = null)
    {
        var prepared = await PrepareUnequipAsync(characterId, itemId, commandId, owner);
        if (beforeCommit is not null)
        {
            await beforeCommit();
        }

        var result = await Committer().CommitAsync(prepared.Plan);
        return new ExecutedCommand(prepared.Identity, prepared.Payload, result);
    }

    private sealed record PreparedCommand(
        CommandExecutionIdentity Identity,
        CanonicalCommandPayload Payload,
        CommandCommitPlan Plan);

    private sealed record ExecutedCommand(
        CommandExecutionIdentity Identity,
        CanonicalCommandPayload Payload,
        CommandCommitResult Result);
```

- [ ] **Step 2: Run test to verify it fails**

Run: `dotnet test v2/tests/Nexis.Persistence.Postgres.Tests/Nexis.Persistence.Postgres.Tests.csproj --filter "FullyQualifiedName~PostgresUnequipItemMultiOwnerIntegrationTests"`
Expected: FAIL. The Equipment applier throws `InvalidOperationException: Equipment PostgreSQL owner does not support transition 'nexis.equipment.unbind-item' schema 1`, surfacing as `OwnerLockKeysUnresolved` / `execution.owner.lock_keys_unresolved` technical failures on every unequip test.

If `CommandExecutionIdentity` / `CommandCommitResult` type names differ from the above, read them from `v2/src/Nexis.Execution.Contracts/CommandReceiptContracts.cs` and `CommandCommitContracts.cs` and correct the two record declarations only.

- [ ] **Step 3: Write minimal implementation**

In `v2/src/Nexis.Persistence.Postgres/PostgresEquipmentOwner.cs`, add the reason code beside `RevisionConflict`:

```csharp
    private static readonly CommandReasonCode BindingMissing = new("equipment.binding_missing");
```

Replace `ResolveLockKeys` (lines 23-40) with:

```csharp
    public IReadOnlyList<AuthoritativeResourceKey> ResolveLockKeys(IOwnerTransition transition)
    {
        var (characterId, itemInstanceId, slots) = Describe(transition);
        var character = characterId.Value.ToString("D");
        var item = itemInstanceId.Value.ToString("D");

        return CanonicalResourceLockOrder.Order(
            new[]
            {
                new AuthoritativeResourceKey(Owner, "equipment.aggregate", character),
                new AuthoritativeResourceKey(Owner, "equipment.binding", $"{character}/{item}")
            }.Concat(slots.Select(slot =>
                new AuthoritativeResourceKey(Owner, "equipment.slot", $"{character}/{slot.Value}"))));
    }
```

In `ApplyAsync`, replace the type guard and revision block (lines 52-78) with:

```csharp
        var (characterId, _, _) = Describe(transition);
        if (transition.ExpectedRevision is not { } expectedRevision)
        {
            throw new InvalidOperationException("Equipment transitions require an optimistic Equipment revision.");
        }

        const string revisionSql = """
            UPDATE nexis_v2.equipment_state
            SET revision = revision + 1
            WHERE character_id = @character_id
              AND revision = @expected_revision;
            """;

        await using (var revisionCommand = new NpgsqlCommand(revisionSql, connection, transaction))
        {
            revisionCommand.Parameters.AddWithValue("character_id", NpgsqlDbType.Uuid, characterId.Value);
            revisionCommand.Parameters.AddWithValue("expected_revision", NpgsqlDbType.Bigint, expectedRevision);
            if (await revisionCommand.ExecuteNonQueryAsync(cancellationToken).ConfigureAwait(false) != 1)
            {
                return PostgresOwnerTransitionResult.ConcurrencyConflict(RevisionConflict);
            }
        }

        if (transition is UnequipItemTransition unequip)
        {
            return await UnbindAsync(connection, transaction, unequip, cancellationToken).ConfigureAwait(false);
        }

        var equip = (EquipItemTransition)transition;
```

Leave the existing binding and slot `INSERT` blocks (lines 80-109) unchanged; they already read from `equip`.

Add these two members at the end of the class:

```csharp
    private static async ValueTask<PostgresOwnerTransitionResult> UnbindAsync(
        NpgsqlConnection connection,
        NpgsqlTransaction transaction,
        UnequipItemTransition unequip,
        CancellationToken cancellationToken)
    {
        // Slots are deleted explicitly before the binding so the write sequence is deterministic
        // rather than depending on cascade ordering.
        const string slotSql = """
            DELETE FROM nexis_v2.equipment_binding_slots
            WHERE character_id = @character_id
              AND item_instance_id = @item_instance_id;
            """;

        await using (var slotCommand = new NpgsqlCommand(slotSql, connection, transaction))
        {
            slotCommand.Parameters.AddWithValue("character_id", NpgsqlDbType.Uuid, unequip.CharacterId.Value);
            slotCommand.Parameters.AddWithValue("item_instance_id", NpgsqlDbType.Uuid, unequip.ItemInstanceId.Value);
            await slotCommand.ExecuteNonQueryAsync(cancellationToken).ConfigureAwait(false);
        }

        const string bindingSql = """
            DELETE FROM nexis_v2.equipment_bindings
            WHERE character_id = @character_id
              AND item_instance_id = @item_instance_id;
            """;

        await using var bindingCommand = new NpgsqlCommand(bindingSql, connection, transaction);
        bindingCommand.Parameters.AddWithValue("character_id", NpgsqlDbType.Uuid, unequip.CharacterId.Value);
        bindingCommand.Parameters.AddWithValue("item_instance_id", NpgsqlDbType.Uuid, unequip.ItemInstanceId.Value);

        return await bindingCommand.ExecuteNonQueryAsync(cancellationToken).ConfigureAwait(false) == 1
            ? PostgresOwnerTransitionResult.Applied()
            : PostgresOwnerTransitionResult.ConcurrencyConflict(BindingMissing);
    }

    private static (CharacterId CharacterId, ItemInstanceId ItemInstanceId, EquipmentSlotSet Slots) Describe(
        IOwnerTransition transition) =>
        transition switch
        {
            EquipItemTransition equip => (equip.CharacterId, equip.ItemInstanceId, equip.OccupiedSlots),
            UnequipItemTransition unequip => (unequip.CharacterId, unequip.ItemInstanceId, unequip.ReleasedSlots),
            _ => throw new InvalidOperationException(
                $"Equipment PostgreSQL owner does not support transition '{transition.Contract.Name}' schema {transition.Contract.SchemaVersion}.")
        };
```

- [ ] **Step 4: Update the equip integration tests for the second owner**

In `v2/tests/Nexis.Persistence.Postgres.Tests/PostgresEquipItemVerticalIntegrationTests.cs`:

1. Add `nexis_v2.inventory_item_reservations, nexis_v2.inventory_items, nexis_v2.inventory_state,` to the head of the `TRUNCATE` list in `TestInitialize` (before `nexis_v2.equipment_binding_slots`).
2. Add a seeding helper and call it from every test that calls `SeedEquipmentStateAsync`:

```csharp
    private static async Task SeedInventoryStateAsync(
        CharacterId characterId,
        ItemInstanceId itemId,
        ContentDefinitionKey definitionKey,
        long revision)
    {
        await using var connection = await DataSource.OpenConnectionAsync();
        await using (var state = new NpgsqlCommand(
            "INSERT INTO nexis_v2.inventory_state(character_id, revision) VALUES (@c, @r);", connection))
        {
            state.Parameters.AddWithValue("c", NpgsqlDbType.Uuid, characterId.Value);
            state.Parameters.AddWithValue("r", NpgsqlDbType.Bigint, revision);
            await state.ExecuteNonQueryAsync();
        }

        await using var item = new NpgsqlCommand(
            """
            INSERT INTO nexis_v2.inventory_items(
                character_id, item_instance_id, definition_contract_name,
                definition_schema_version, definition_id)
            VALUES (@c, @i, @n, @v, @d);
            """,
            connection);
        item.Parameters.AddWithValue("c", NpgsqlDbType.Uuid, characterId.Value);
        item.Parameters.AddWithValue("i", NpgsqlDbType.Uuid, itemId.Value);
        item.Parameters.AddWithValue("n", NpgsqlDbType.Text, definitionKey.Contract.Name);
        item.Parameters.AddWithValue("v", NpgsqlDbType.Integer, definitionKey.Contract.SchemaVersion);
        item.Parameters.AddWithValue("d", NpgsqlDbType.Text, definitionKey.DefinitionId.Value);
        await item.ExecuteNonQueryAsync();
    }
```

3. In `BuildRequestAsync`, replace the inline `new InventorySnapshot(characterId, 1, new[] { ... })` (lines 393-396) with `await new PostgresInventorySnapshotReader(DataSource).ReadAsync(characterId)`.
4. Register `new PostgresInventoryTransitionApplier()` alongside `new PostgresEquipmentTransitionApplier()` in every `PostgresAtomicCommandCommitter` construction in this file.
5. In `EquipItem_EndToEnd_CommitsRealEquipmentOwnerHistoryAndOutbox`, change `Assert.AreEqual(1, decision.Transitions.Count)` to `Assert.AreEqual(2, decision.Transitions.Count)` and replace the single `TargetOwner` assertion with:

```csharp
        CollectionAssert.AreEquivalent(
            new[] { InventorySnapshot.OwnerKey, EquipmentSnapshot.OwnerKey },
            decision.Transitions.Select(static transition => transition.TargetOwner).ToArray());
```

and after the commit assertions add:

```csharp
        var inventoryAfterEquip = await new PostgresInventorySnapshotReader(DataSource).ReadAsync(characterId);
        Assert.AreEqual(EquipmentSnapshot.OwnerKey, inventoryAfterEquip.FindReservation(itemId)?.HoldingOwner);
        Assert.AreEqual(1, inventoryAfterEquip.Items.Count, "Equipping must not remove the item from Inventory.");
```

6. In `EquipItem_StaleEquipmentRevision_RollsBackRealOwnerAndCommandEffects`, add after the existing rollback assertions:

```csharp
        Assert.AreEqual(
            0,
            await ScalarIntAsync("SELECT count(*) FROM nexis_v2.inventory_item_reservations;"),
            "A rolled-back equip must not leave an orphaned Inventory reservation.");
```

7. In `EquipmentDeclaredLockKeys_MatchActualSqlWriteAcquisitionOrder`, filter the transition selection so the Equipment transition is picked explicitly:

```csharp
        var transition = decision.Transitions.OfType<EquipItemTransition>().Single();
```

- [ ] **Step 5: Run test to verify it passes**

Run: `dotnet test v2/tests/Nexis.Persistence.Postgres.Tests/Nexis.Persistence.Postgres.Tests.csproj`
Expected: PASS, all PostgreSQL integration tests green, 0 skipped.

- [ ] **Step 6: Commit**

```bash
git add v2/src/Nexis.Persistence.Postgres/PostgresEquipmentOwner.cs \
        v2/tests/Nexis.Persistence.Postgres.Tests/PostgresUnequipItemMultiOwnerIntegrationTests.cs \
        v2/tests/Nexis.Persistence.Postgres.Tests/PostgresEquipItemVerticalIntegrationTests.cs
git commit -m "feat(v2): prove atomic exactly-once Unequip Item across Equipment and Inventory (C3)"
```

---

## Task 9: Replay corpus captures the availability input

**Files:**
- Modify: `v2/src/Nexis.History.Replay/ReplayCorpus.cs:10-25`
- Modify: `v2/src/Nexis.History.Replay/EquipItemReplayScenarioCodec.cs`
- Modify: `v2/tests/Nexis.Architecture.Tests/ReplayCorpusTests.cs:48,146`

**Interfaces:**
- Consumes: `InventorySnapshot.Reservations` (Task 1).
- Produces: `ReplayCorpusVersion.V2`; `EquipItemReplayScenarioCodec` encodes and decodes reservations; V1 artifacts are rejected.

Equip's decision now depends on `InventorySnapshot.Reservations`. A codec that silently drops a rule-relevant input would report false semantic equivalence during Core-vNext comparison, so the reviewed document must carry it. `restrictionDeclaringOwner` is an owner key, not player data, and is safe to retain.

- [ ] **Step 1: Write the failing test**

Append to `v2/tests/Nexis.Architecture.Tests/ReplayCorpusTests.cs` (adapt the fixture-construction lines to the helpers already in that file — the capture builder is around line 718):

```csharp
    [TestMethod]
    public void ReplayArtifact_RetainsInventoryReservationsAsARuleRelevantInput()
    {
        var artifact = EncodeEquipCaptureWithReservation();

        Assert.AreEqual(ReplayCorpusVersion.V2, artifact.CorpusVersion);
        StringAssert.Contains(artifact.CanonicalJson, "\"reservations\":");
        StringAssert.Contains(artifact.CanonicalJson, "\"holdingOwner\":\"Marketplace\"");

        var scenario = new EquipItemReplayScenarioCodec()
            .Decode(artifact.CanonicalJson, new FixedRestrictedRandomResolver());
        var inventory = scenario.Request.Snapshots.OfType<InventorySnapshot>().Single();

        Assert.AreEqual(1, inventory.Reservations.Count);
        Assert.AreEqual(new OwnerKey("Marketplace"), inventory.Reservations[0].HoldingOwner);
    }

    [TestMethod]
    public void ReplayArtifact_RejectsACorpusV1DocumentThatPredatesTheAvailabilityInput()
    {
        var artifact = EncodeEquipCaptureWithReservation();
        var downgraded = artifact.CanonicalJson.Replace(
            "\"corpusVersion\":2", "\"corpusVersion\":1", StringComparison.Ordinal);

        Assert.ThrowsExactly<NotSupportedException>(
            () => EquipItemReplayScenarioCodec.ValidateCanonicalEnvelope(downgraded));
    }
```

Add a private helper `EncodeEquipCaptureWithReservation()` that builds the same capture the existing tests use, but constructs its `InventorySnapshot` with a second possessed item carrying a `Marketplace` reservation, and returns the parsed `ReplayCorpusArtifact`. Reuse the existing capture-builder helper in the file rather than duplicating it. Reuse the existing restricted-random resolver test double; name it exactly as that file already names it.

Also update the two existing expectations, preserving their intent:
- line 48: `Assert.AreEqual(ReplayCorpusVersion.V1, artifact.CorpusVersion);` becomes `Assert.AreEqual(ReplayCorpusVersion.V2, artifact.CorpusVersion);`
- line 146: `"\"corpusVersion\":1", "\"corpusVersion\":2"` becomes `"\"corpusVersion\":2", "\"corpusVersion\":3"` — the assertion still proves an unknown corpus version is rejected.

- [ ] **Step 2: Run test to verify it fails**

Run: `dotnet test v2/Nexis.slnx --filter "FullyQualifiedName~ReplayCorpusTests"`
Expected: FAIL. `ReplayCorpusVersion.V2` does not exist (`CS0117`), and once added, the artifact still reports version 1 and contains no `reservations` property.

- [ ] **Step 3: Write minimal implementation**

In `v2/src/Nexis.History.Replay/ReplayCorpus.cs`, add beside `V1`:

```csharp
    public static ReplayCorpusVersion V2 { get; } = new(2);
```

In `v2/src/Nexis.History.Replay/EquipItemReplayScenarioCodec.cs`:

1. Line 87: `ReplayCorpusVersion.V1.Value` becomes `ReplayCorpusVersion.V2.Value`.
2. Line 307: `document.CorpusVersion != ReplayCorpusVersion.V1.Value` becomes `document.CorpusVersion != ReplayCorpusVersion.V2.Value`.
3. Replace the `InventoryDocument` record (line 440) with:

```csharp
    private sealed record InventoryDocument(
        long Revision,
        InventoryItemDocument[] Items,
        InventoryReservationDocument[] Reservations);

    private sealed record InventoryReservationDocument(
        Guid ItemInstanceId,
        string HoldingOwner,
        string? RestrictionDeclaringOwner);
```

4. In `Encode`, extend the `new InventoryDocument(...)` construction (line 117) with a third argument:

```csharp
                inventory.Reservations
                    .Select(reservation => new InventoryReservationDocument(
                        alias.PseudonymizeItem(reservation.ItemInstanceId.Value),
                        reservation.HoldingOwner.Value,
                        reservation.ReleaseRestriction?.DeclaringOwner.Value))
                    .OrderBy(static reservation => reservation.ItemInstanceId)
                    .ToArray()),
```

5. In `Decode`, extend the `new InventorySnapshot(...)` construction (line 186) with a fourth argument:

```csharp
                    document.Inventory.Reservations.Select(static reservation =>
                        new InventoryItemReservation(
                            new ItemInstanceId(reservation.ItemInstanceId),
                            new OwnerKey(reservation.HoldingOwner),
                            reservation.RestrictionDeclaringOwner is null
                                ? null
                                : new ItemReleaseRestriction(new OwnerKey(reservation.RestrictionDeclaringOwner))))),
```

6. Apply the same fourth argument to the second `new InventorySnapshot(...)` construction inside `ValidateDomainInvariants` (line 558).
7. In `ValidateReviewedTokens`, after the existing item loop, add:

```csharp
        foreach (var reservation in document.Inventory.Reservations)
        {
            ValidateSafeToken(reservation.HoldingOwner, "reservation holding owner");
            if (reservation.RestrictionDeclaringOwner is not null)
            {
                ValidateSafeToken(reservation.RestrictionDeclaringOwner, "reservation restriction declaring owner");
            }
        }
```

8. In `ValidateCanonicalCollectionOrder`, add a `RequireCanonicalOrder` call for `document.Inventory.Reservations` keyed on `ItemInstanceId`, matching the existing call for `document.Inventory.Items`.
9. In `ValidateRetainedRelations`, add a check that every reservation's `ItemInstanceId` appears in `document.Inventory.Items`, throwing `FormatException` otherwise, matching the style of the existing possession relation checks.

Run `dotnet build v2/Nexis.slnx` after each of steps 7-9 to keep the compiler honest about the surrounding helper signatures.

- [ ] **Step 4: Run test to verify it passes**

Run: `dotnet test v2/Nexis.slnx --filter "FullyQualifiedName~ReplayCorpusTests"`
Expected: PASS, all replay tests green.

- [ ] **Step 5: Commit**

```bash
git add v2/src/Nexis.History.Replay/ReplayCorpus.cs \
        v2/src/Nexis.History.Replay/EquipItemReplayScenarioCodec.cs \
        v2/tests/Nexis.Architecture.Tests/ReplayCorpusTests.cs
git commit -m "feat(v2): retain Inventory availability in the Equip Item replay scenario (corpus V2)"
```

---

## Task 10: Full verification

**Files:** none changed.

- [ ] **Step 1: Restore and Release build**

```bash
dotnet restore v2/Nexis.slnx
dotnet build v2/Nexis.slnx -c Release --no-restore
```

Expected: `0 Warning(s)`, `0 Error(s)`. Warnings are errors, so any warning is a failure to fix, not to note.

- [ ] **Step 2: Architecture, Core, execution, security, replay suite**

```bash
dotnet test v2/tests/Nexis.Architecture.Tests/Nexis.Architecture.Tests.csproj -c Release --no-build
```

Expected: every test passes **except** the three known pre-existing L3 History/Player Log REDs named in Task 1 Step 5. Record the exact total/passed/failed/skipped counts.

- [ ] **Step 3: PostgreSQL integration suite against a fresh disposable database**

```bash
docker exec nexis-claude-cont-20260829 psql -U postgres -c "DROP DATABASE IF EXISTS nexis_c3_final; CREATE DATABASE nexis_c3_final;"
export NEXIS_TEST_POSTGRES_CONNECTION="Host=127.0.0.1;Port=55501;Database=nexis_c3_final;Username=postgres;Password=$PGPASSWORD"
dotnet test v2/tests/Nexis.Persistence.Postgres.Tests/Nexis.Persistence.Postgres.Tests.csproj -c Release --no-build
```

Expected: all passed, **0 skipped**. A skip here means the connection string was not exported and the run is not evidence.

- [ ] **Step 4: Confirm no protective test was weakened**

```bash
git diff 95bf9a1..HEAD -- 'v2/tests/**' | grep -E '^-\s+(Assert|CollectionAssert|StringAssert)'
```

Review every removed assertion. The only acceptable removals are the two superseded assertions named in Task 3 and Task 8, each replaced by a strictly stronger one in the same file. If anything else appears, restore it.

- [ ] **Step 5: Commit nothing**

This task produces evidence, not changes. Record the observed counts for Task 11.

---

## Task 11: Documentation, contradiction reconciliation and the curse seam

**Files:**
- Create: `v2/docs/ITEM-AVAILABILITY-RESERVATION.md`
- Modify: `v2/docs/STATE-OWNERSHIP.md` (section 8 "Equipment and Loadouts", and the Class B "Equip item" example)
- Modify: `v2/docs/COMMAND-EXECUTION.md` ("Equip item -> Equipment slot transition, with Inventory ownership/revision precondition")
- Modify: `v2/docs/IMPLEMENTATION-STATUS.md`
- Modify: `CHANGELOG.md`

The C3 evidence matrix identified a self-contradiction inside `STATE-OWNERSHIP.md` §8: one sentence asserts reference-only, the next names equip/unequip as multi-owner. The approved design resolves it as M-reserve. `ENGINEERING-MANUAL.md` requires reconciling the losing wording rather than leaving it contradictory.

- [ ] **Step 1: Write the binding boundary record**

Create `v2/docs/ITEM-AVAILABILITY-RESERVATION.md`:

```markdown
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
```

- [ ] **Step 2: Reconcile `STATE-OWNERSHIP.md`**

In section 8 ("Equipment and Loadouts"), replace:

```
An equipped item remains an Inventory-owned item. Equipment stores a validated reference to it.

Equip/unequip commonly forms an explicit atomic multi-owner operation between Inventory and Equipment.
```

with:

```
An equipped item remains an Inventory-owned item. Equipment stores a validated reference to it, and
Inventory records a reservation marking the item unavailable for other ownership-changing actions.
This is the approved **M-reserve** model; see `ITEM-AVAILABILITY-RESERVATION.md`.

Equip and unequip are therefore explicit atomic multi-owner operations between Inventory and
Equipment: equip reserves and binds, unequip unbinds and releases, and neither transfers possession.
The superseded V1 model that removed the item from inventory on equip must not be reintroduced.
```

In the Class B canonical-example list, replace the `**Equip item**` line with:

```
- **Equip item**: Inventory reservation + Equipment slot assignment.
- **Unequip item**: Equipment binding clear + Inventory reservation release.
```

- [ ] **Step 3: Reconcile `COMMAND-EXECUTION.md`**

In "Core evaluation and owner transitions", replace:

```
- Equip item -> Equipment slot transition, with Inventory ownership/revision precondition.
```

with:

```
- Equip item -> Inventory reservation transition + Equipment slot transition, committed atomically
  under the approved M-reserve model.
- Unequip item -> Equipment binding-clear transition + Inventory reservation-release transition,
  committed atomically. Possession never moves.
```

In the "Example concurrency matrix", replace the `Equip item` row with:

```
| Equip item | optimistic Inventory/Equipment revisions | availability reservation + slot invariants |
| Unequip item | optimistic Inventory/Equipment revisions | canonical Equipment-then-Inventory lock order + release restriction |
```

- [ ] **Step 4: Update the implementation status**

In `v2/docs/IMPLEMENTATION-STATUS.md`, add a section after "First real gameplay vertical proof":

```markdown
## Real multi-owner gameplay proof (C3)

`UnequipItem` under M-reserve is the first Nexis 2.0 operation that legitimately writes two real
authoritative owners in one atomic command. The proof demonstrates:

1. Equipment clears the equipped reference;
2. Inventory releases the same item reservation;
3. both transitions commit in one transaction or neither does, proven for a stale Inventory revision
   and a stale Equipment revision independently;
4. a repeated CommandId reconstructs the original outcome and never releases or duplicates twice;
5. concurrent unequips produce exactly one winner, and an opposing reservation attempt from a stale
   snapshot cannot double-spend the item;
6. an unequip denied by an authoritative removal restriction commits neither owner transition, denied
   independently by Core and by the Inventory persistence boundary;
7. no invented balance value, cost, cooldown or content is involved.

Possession is never created, destroyed or transferred. Stats, skills and knowledge are not equip
prerequisites, and `MReserveFreedomRuleTests` asserts that mechanically.

`ITEM-AVAILABILITY-RESERVATION.md` records the boundary and the explicit future curse integration
seam. No Curse owner, curse state, questline or purification path exists.
```

Replace item 2 of "Foundation work still incomplete" (the "additional real owner-specific multi-owner gameplay proof" entry) and the paragraph beginning "The real multi-owner proof cannot currently proceed without inventing mechanics." with a statement that the proof is delivered, and update "Next safe implementation boundary" to name the next task chosen in Task 12.

- [ ] **Step 5: Update the changelog**

Prepend an entry to `CHANGELOG.md` in the style of the existing entries, describing: the M-reserve Inventory availability model, the real Inventory PostgreSQL owner, the Unequip Item Core rule and codec, the C3 atomic multi-owner proof, the freedom-rule guard, replay corpus V2, and the reconciled `STATE-OWNERSHIP.md` / `COMMAND-EXECUTION.md` wording. Name no secret and no production system.

- [ ] **Step 6: Verify the documentation build is unaffected and commit**

```bash
dotnet build v2/Nexis.slnx -c Release --no-restore
git add v2/docs/ITEM-AVAILABILITY-RESERVATION.md v2/docs/STATE-OWNERSHIP.md \
        v2/docs/COMMAND-EXECUTION.md v2/docs/IMPLEMENTATION-STATUS.md CHANGELOG.md
git commit -m "docs(v2): record M-reserve, reconcile the equip ownership contradiction, and the curse seam"
```

---

## Task 12: Continuation status update

**Files:**
- Modify: `/srv/voidsmith/nexis/coordination/parallel-2026-08-28/claude-foundation-continuation-status.md`

- [ ] **Step 1: Record exact evidence**

Update the status document with:
- the new HEAD SHA and the full commit table for this slice, with each commit's subject and what it closed;
- the exact verification counts observed in Task 10 (Release build warnings/errors; architecture suite total/passed/failed/skipped; PostgreSQL suite total/passed/failed/skipped), stating plainly that the three L3 History/Player Log REDs remain open and were not touched;
- whether **SC-TXN-2** (multi-owner command proves atomic rollback when one participating transition fails) can now be marked **MET on executed evidence**, citing the exact test names that establish it — `UnequipItem_StaleInventoryRevision_CommitsNeitherOwnerTransition`, `UnequipItem_StaleEquipmentRevision_CommitsNeitherOwnerTransition`, `UnequipDeniedByRemovalRestriction_CommitsNeitherOwnerTransition`. If any of those did not execute against a real database, say so and mark it NOT MET;
- remaining engineering gaps, carried forward from the existing §8 queue plus anything discovered here;
- the next safe task.

- [ ] **Step 2: Commit**

The status document lives outside the repository worktree. Do not `git add` it. Note in the handoff that it was updated in place.

---

## Known gaps and risks carried into execution

These were found by reviewing the plan against the repository after writing it. None blocks the
slice; each must be confirmed or recorded during execution rather than discovered late.

1. **`ItemUnequippedEvent` has no Player Log projector.** `PLAYER-LOG-BOUNDARY.md` fails closed —
   an unregistered event contract produces no player entry — so this is safe, not broken. But it
   creates an asymmetry: equipping appears in the Player Log and unequipping does not. Do **not**
   add the projector inside this slice; record it in the continuation status as a known gap so the
   Player Log slice picks it up deliberately.
2. **No production composition root registers codecs or owner appliers.** `CanonicalCommandCodecRegistry`
   and `IPostgresOwnerTransitionApplier` are wired only in tests today; `Nexis.Host.Api` composes
   neither. This is pre-existing and unchanged by this slice, but it means the unequip codec is not
   reachable by crash recovery in a hosted process. Record it; do not build a composition root here.
3. **Advisory lock semantics are unverified.** `ConcurrentUnequips_ProduceExactlyOneReleaseAndNoDoubleSpend`
   assumes `PostgresAdvisoryResourceLockAcquirer` blocks rather than failing fast. Read
   `v2/src/Nexis.Persistence.Postgres/PostgresResourceLockAcquirer.cs` before running that test. If it
   uses a `try`-style lock, the losing command surfaces a different disposition; assert the observed
   one and keep the invariant assertions (exactly one release, exactly one event, no duplicate item)
   unchanged. The invariants are the point, not the disposition label.
4. **Task 8 step 4 does not fix the seeded Inventory revision.** `SeedInventoryStateAsync` takes a
   revision; choose `1` for every call site in `PostgresEquipItemVerticalIntegrationTests` unless a
   test needs otherwise, and update that test's post-equip revision assertions to match.
5. **Task 9 may need a `ValidateCanonicalValues` branch.** Steps 7-9 name `ValidateReviewedTokens`,
   `ValidateCanonicalCollectionOrder` and `ValidateRetainedRelations`. If `ValidateCanonicalValues`
   also enumerates inventory items, add the matching reservation branch. Build after each edit.
6. **`InventorySnapshot` schema 1 → 2 is safe for idempotency.** Verified:
   `CommandExecutionIdentityFactory` derives identity from CommandId, actor binding, intent contract
   and payload fingerprint only. No snapshot contract version enters a command receipt.

---

## Self-Review

**1. Spec coverage.** The approved design's §14 acceptance criteria span the whole systemic item interaction system; this plan is deliberately only the first Foundation-closing slice, so most of §14 is out of scope by instruction. Coverage of what *is* in scope:

| Spec requirement | Task |
| --- | --- |
| §3.1 M-reserve; Inventory is the availability authority | Task 1, Task 7 |
| §3.1 one authoritative availability answer | Task 1 (`FindReservation`), Task 7 (`UNIQUE (item_instance_id)`) |
| §3.2 equip reserves + binds atomically | Task 3, Task 8 step 4 |
| §3.2 unequip unbinds + releases atomically | Task 4, Task 8 |
| §3.3 equipped item cannot be double-spent | Task 7 (`InventoryOwner_RefusesASecondReservation…`), Task 8 (`OpposingReservationAfterUnequip_…`) |
| §8.1 normal unequip fails while removal is restricted | Task 4, Task 8 (`UnequipDeniedByRemovalRestriction_…`) |
| §10 atomic owner transitions, no double-spend, auditable | Task 8 |
| §11 Inventory/Equipment/Core boundaries; curse authority deferred | Task 7, Task 11 |
| §12 C3 required proof items 1-7 | Task 8, all seven demonstrated |
| §14.9 M-reserve prevents another commitment without authorized release | Task 7, Task 8 |
| §14.10 normal unequip atomically updates both owners | Task 8 |
| §14.15 replay/concurrency/idempotency on the multi-owner path | Task 8, Task 9 |
| §2.2 / §15 freedom rule: no capability equip gate | Task 5 |
| Directive: record the curse seam explicitly | Task 11 |

Deliberately **not** covered, per the task instruction: the systemic interaction resolver (§4-§7), Improvise (§4.1), multi-effect composition (§6), achievements (§9), curse persistence/questlines/purification (§8.2-§8.3), and every formula or balance value (§13).

**2. Placeholder scan.** No "TBD", "TODO", "implement later", "add appropriate error handling", "similar to Task N" or "write tests for the above" appears. Every code step contains the actual code. Three steps deliberately require reading a value from the repository rather than guessing it — Task 5 step 2 (the pinned reason-code counts), Task 8 step 2 (`CommandExecutionIdentity`/`CommandCommitResult` type names), Task 9 step 1 (the existing replay test-helper names). Each states exactly which file to read and exactly which literal to change; none is an open-ended instruction.

**3. Type consistency.** Cross-checked:
- `InventoryItemReservation(ItemInstanceId, OwnerKey, ItemReleaseRestriction?)` — consistent in Tasks 1, 4, 7, 9.
- `ReserveInventoryItemTransition(long, CharacterId, ItemInstanceId, OwnerKey)` and `ReleaseInventoryItemReservationTransition(long, CharacterId, ItemInstanceId, OwnerKey)` — same four-parameter shape in Tasks 2, 3, 4, 7, 8.
- `UnequipItemTransition(long, CharacterId, ItemInstanceId, EquipmentPlacementKey, IEnumerable<EquipmentSlotKey>)` exposes `ReleasedSlots`; the Equipment applier's `Describe` reads `unequip.ReleasedSlots` and `equip.OccupiedSlots`, matching Tasks 4 and 8.
- `InventorySnapshot.FindReservation` is used in Tasks 3, 4, 7, 8 with the same signature defined in Task 1.
- `PostgresInventorySnapshotReader.ReadAsync(CharacterId, CancellationToken)` mirrors the existing `PostgresEquipmentSnapshotReader`, and both are called with one argument in Tasks 7 and 8.
- Reason-code strings are identical between the Core rule (Task 4), the tests (Tasks 4, 8) and the persistence adapter (Task 7): `equipment.unequip.release_restricted`, `inventory.reservation_not_releasable`, `inventory.reservation_conflict`, `inventory.revision_conflict`, `equipment.revision_conflict`, `equipment.binding_missing`.
- Lock-key resource types are `equipment.aggregate` / `equipment.binding` / `equipment.slot` and `inventory.aggregate` / `inventory.reservation` throughout, and the expected canonical ordering asserted in Task 8 follows `CanonicalResourceLockOrder`'s ordinal Owner → ResourceType → ResourceId comparison (`Equipment` before `Inventory`).
- Migration `0008` column names (`holding_owner`, `restriction_declaring_owner`, `definition_contract_name`, `definition_schema_version`, `definition_id`) match every SQL statement in Tasks 7 and 8 and the reader's ordinal indices 0-6.
