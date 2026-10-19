# NEXIS V2 Living World Slice 01: NPC Lifecycle Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add the first real living-world vertical slice: one authoritative NPC lifecycle owner with stable NPC identity, immutable UTC birth history, derived chronological age, trusted-System creation, canonical recovery, atomic PostgreSQL persistence, History/outbox evidence and executable ownership guards.

**Architecture:** The slice follows the existing Equipment vertical rather than inventing a parallel execution path. `Nexis.Npcs.Contracts` owns stable typed contracts, `Nexis.Core` decides whether a trusted System command may establish an NPC lifecycle, `Nexis.Modules.Npcs` supplies the canonical command codec, and `Nexis.Persistence.Postgres` is the only database adapter allowed to mutate NPC lifecycle state. The slice deliberately establishes only a living NPC; mortality/death-cause transitions, Population materialisation, provenance enrichment, Social, Travel, Succession, Scheduler and CIEL remain outside this slice.

**Tech Stack:** C# / .NET 10 (`net10.0`), .NET SDK baseline from `v2/global.json`, MSTest 4.3.3, Npgsql 10.0.3, PostgreSQL `nexis_v2` schema, existing NEXIS command/Core/History/outbox infrastructure.

**Spec:** `docs/superpowers/specs/2026-09-16-nexis-living-world-npc-simulation-design.md`

## Global Constraints

- Preserve the approved command flow: trusted ingress -> authoritative snapshots/content/time -> `Nexis.Core` -> typed owner transitions/events -> atomic persistence -> History/outbox.
- `NpcLifecycle` is the sole authoritative writer for persistent NPC existence/lifecycle identity.
- `NpcId` is an in-world identity value, never an authentication credential.
- Only a trusted System actor may establish NPC lifecycle state in this slice. No player/client API endpoint is added.
- Chronological age is derived from immutable UTC birth time and authoritative UTC evaluation time. No age column and no periodic age-write job are permitted.
- One real elapsed year equals one NEXIS chronological year. Anniversary calculation uses Gregorian `.AddYears(...)` semantics, including 29 February -> 28 February in non-leap years.
- The persisted lifecycle representation must include both `Living` and `Dead` as valid states so the schema is not structurally incompatible with mortality/resurrection, but Slice 01 adds no command that transitions a living NPC to dead or a dead NPC to living.
- NPC creation begins at lifecycle revision `1`; creation transitions have no expected prior revision because the owner row must not exist yet.
- Duplicate CommandId remains command-idempotent through the existing receipt machinery. A different command attempting to create the same `NpcId` must fail as a concurrency conflict without additional History/outbox effects.
- Contracts remain infrastructure-neutral. `Nexis.Core` must not reference Npgsql, ASP.NET, Redis, filesystem, network or concrete persistence code.
- Do not introduce Population counts, materialisation seeds/provenance, species lifecycle rules, personal names/personality, current location, employment, Social relationships, Knowledge, mortality causes, Scheduler state or CIEL memory in this slice.
- No generic `NpcState`, `LivingWorldState`, string-keyed property bag or path/value transition is permitted.
- `CHANGELOG.md` and `v2/docs/IMPLEMENTATION-STATUS.md` are updated only with results actually observed during implementation verification.

---

## File Structure

### New contract project

- `v2/src/Nexis.Npcs.Contracts/Nexis.Npcs.Contracts.csproj` - stable infrastructure-neutral NPC lifecycle contract assembly.
- `v2/src/Nexis.Npcs.Contracts/NpcPrimitives.cs` - `NpcId` and `NpcLifecycleStatus`.
- `v2/src/Nexis.Npcs.Contracts/NpcChronology.cs` - canonical chronological-age derivation.
- `v2/src/Nexis.Npcs.Contracts/NpcLifecycleStateContracts.cs` - authoritative lifecycle snapshot.
- `v2/src/Nexis.Npcs.Contracts/EstablishNpcLifecycleContracts.cs` - typed intent, create transition and semantic event.

### New module project

- `v2/src/Nexis.Modules.Npcs/Nexis.Modules.Npcs.csproj` - NPC application-boundary serialization module.
- `v2/src/Nexis.Modules.Npcs/EstablishNpcLifecycleCanonicalCommandCodec.cs` - stable schema-v1 canonical JSON codec.

### Core changes

- `v2/src/Nexis.Core/Rules/Npcs/EstablishNpcLifecycleRuleEvaluator.cs` - deterministic authoritative rule for first lifecycle establishment.
- `v2/src/Nexis.Core/CoreRulesEngine.cs` - register the NPC lifecycle evaluator.
- `v2/src/Nexis.Core/Nexis.Core.csproj` - reference `Nexis.Npcs.Contracts`.

### Persistence changes

- `v2/src/Nexis.Persistence.Postgres/Migrations/0011_npc_lifecycle_owner.sql` - authoritative NPC lifecycle table.
- `v2/src/Nexis.Persistence.Postgres/PostgresNpcLifecycleOwner.cs` - transition applier and snapshot reader.
- `v2/src/Nexis.Persistence.Postgres/PostgresExecutionSchema.cs` - append migration 0011 to ordered resources.
- `v2/src/Nexis.Persistence.Postgres/Nexis.Persistence.Postgres.csproj` - reference NPC contracts and embed migration 0011.

### Solution/test changes

- `v2/Nexis.slnx` - add both NPC projects.
- `v2/tests/Nexis.Architecture.Tests/Nexis.Architecture.Tests.csproj` - reference NPC contract/module projects.
- `v2/tests/Nexis.Persistence.Postgres.Tests/Nexis.Persistence.Postgres.Tests.csproj` - reference NPC contract/module projects.
- `v2/tests/Nexis.Architecture.Tests/NpcLifecycleContractTests.cs` - identity, status, age and snapshot tests.
- `v2/tests/Nexis.Architecture.Tests/NpcLifecycleVerticalTests.cs` - Core rule and canonical codec tests.
- `v2/tests/Nexis.Architecture.Tests/NpcLifecycleOwnershipGuardTests.cs` - dependency/table-writer/no-client-surface guards.
- `v2/tests/Nexis.Architecture.Tests/AutomationArchitectureTests.cs` - explicitly allow the reviewed `Nexis.Modules.Npcs -> Nexis.Execution.Contracts` serialization boundary.
- `v2/tests/Nexis.Persistence.Postgres.Tests/PostgresNpcLifecycleVerticalIntegrationTests.cs` - database-backed creation/idempotency/conflict/history/outbox proof.

### Documentation changes at slice close

- `CHANGELOG.md`
- `v2/docs/IMPLEMENTATION-STATUS.md`
- `v2/docs/AGENT-HANDOFF.md` - record the completed Slice 01 checkpoint and the exact next slice boundary.

---

### Task 1: Add NPC lifecycle contract project and pure lifecycle primitives

**Files:**
- Create: `v2/src/Nexis.Npcs.Contracts/Nexis.Npcs.Contracts.csproj`
- Create: `v2/src/Nexis.Npcs.Contracts/NpcPrimitives.cs`
- Create: `v2/src/Nexis.Npcs.Contracts/NpcChronology.cs`
- Create: `v2/src/Nexis.Npcs.Contracts/NpcLifecycleStateContracts.cs`
- Modify: `v2/Nexis.slnx`
- Modify: `v2/tests/Nexis.Architecture.Tests/Nexis.Architecture.Tests.csproj`
- Create/Test: `v2/tests/Nexis.Architecture.Tests/NpcLifecycleContractTests.cs`

**Interfaces:**
- Produces: `readonly record struct NpcId(Guid Value)` with `New()`, `IsEmpty`, stable `D` string formatting.
- Produces: `enum NpcLifecycleStatus { Living = 0, Dead = 1 }`.
- Produces: `static int NpcChronology.CalculateChronologicalAge(DateTimeOffset birthInstantUtc, DateTimeOffset atUtc)`.
- Produces: `NpcLifecycleSnapshot(NpcId npcId, long revision, DateTimeOffset birthInstantUtc, NpcLifecycleStatus status) : IAuthoritativeSnapshot`.
- Produces owner identity: `NpcLifecycleSnapshot.OwnerKey == new OwnerKey("NpcLifecycle")`.

- [ ] **Step 1: Add the project shell, solution entry and architecture-test reference**

Create `v2/src/Nexis.Npcs.Contracts/Nexis.Npcs.Contracts.csproj`:

```xml
<Project Sdk="Microsoft.NET.Sdk">
  <ItemGroup>
    <ProjectReference Include="..\Nexis.Core.Contracts\Nexis.Core.Contracts.csproj" />
  </ItemGroup>
</Project>
```

Add to `/src/` in `v2/Nexis.slnx`:

```xml
<Project Path="src/Nexis.Npcs.Contracts/Nexis.Npcs.Contracts.csproj" />
```

Add to the architecture test project:

```xml
<ProjectReference Include="..\..\src\Nexis.Npcs.Contracts\Nexis.Npcs.Contracts.csproj" />
```

- [ ] **Step 2: Write the failing primitive/snapshot/chronology tests**

Create `NpcLifecycleContractTests.cs` with these assertions:

```csharp
using Microsoft.VisualStudio.TestTools.UnitTesting;
using Nexis.Npcs.Contracts;

namespace Nexis.Architecture.Tests;

[TestClass]
public sealed class NpcLifecycleContractTests
{
    [TestMethod]
    public void NpcId_IsStableNonEmptyGuidIdentity()
    {
        var id = NpcId.New();
        Assert.IsFalse(id.IsEmpty);
        Assert.AreEqual(id.Value.ToString("D"), id.ToString());
        Assert.ThrowsExactly<ArgumentException>(() =>
            new NpcLifecycleSnapshot(
                new NpcId(Guid.Empty), 1,
                new DateTimeOffset(2026, 9, 16, 10, 0, 0, TimeSpan.Zero),
                NpcLifecycleStatus.Living));
    }

    [TestMethod]
    public void LifecycleSnapshot_UsesOneOwnerAndRejectsInvalidShape()
    {
        var id = NpcId.New();
        var birth = new DateTimeOffset(2000, 9, 16, 10, 0, 0, TimeSpan.Zero);
        var snapshot = new NpcLifecycleSnapshot(id, 1, birth, NpcLifecycleStatus.Living);

        Assert.AreEqual("NpcLifecycle", snapshot.Owner.Value);
        Assert.AreEqual(1L, snapshot.Revision);
        Assert.AreEqual(birth, snapshot.BirthInstantUtc);
        Assert.AreEqual(NpcLifecycleStatus.Living, snapshot.Status);
        Assert.ThrowsExactly<ArgumentOutOfRangeException>(() =>
            new NpcLifecycleSnapshot(id, -1, birth, NpcLifecycleStatus.Living));
        Assert.ThrowsExactly<ArgumentException>(() =>
            new NpcLifecycleSnapshot(id, 1, birth.ToOffset(TimeSpan.FromHours(1)), NpcLifecycleStatus.Living));
        Assert.ThrowsExactly<ArgumentOutOfRangeException>(() =>
            new NpcLifecycleSnapshot(id, 1, birth, (NpcLifecycleStatus)999));
    }

    [TestMethod]
    public void ChronologicalAge_UsesAnniversaryRatherThanFixedDayCount()
    {
        var birth = new DateTimeOffset(2000, 9, 16, 10, 30, 0, TimeSpan.Zero);

        Assert.AreEqual(24, NpcChronology.CalculateChronologicalAge(
            birth,
            new DateTimeOffset(2025, 9, 16, 10, 29, 59, TimeSpan.Zero)));
        Assert.AreEqual(25, NpcChronology.CalculateChronologicalAge(
            birth,
            new DateTimeOffset(2025, 9, 16, 10, 30, 0, TimeSpan.Zero)));
    }

    [TestMethod]
    public void ChronologicalAge_February29UsesAddYearsCalendarSemantics()
    {
        var birth = new DateTimeOffset(2024, 2, 29, 12, 0, 0, TimeSpan.Zero);

        Assert.AreEqual(0, NpcChronology.CalculateChronologicalAge(
            birth,
            new DateTimeOffset(2025, 2, 28, 11, 59, 59, TimeSpan.Zero)));
        Assert.AreEqual(1, NpcChronology.CalculateChronologicalAge(
            birth,
            new DateTimeOffset(2025, 2, 28, 12, 0, 0, TimeSpan.Zero)));
    }

    [TestMethod]
    public void ChronologicalAge_RejectsNonUtcOrPreBirthEvaluation()
    {
        var birth = new DateTimeOffset(2026, 9, 16, 12, 0, 0, TimeSpan.Zero);

        Assert.ThrowsExactly<ArgumentException>(() =>
            NpcChronology.CalculateChronologicalAge(
                birth.ToOffset(TimeSpan.FromHours(1)), birth));
        Assert.ThrowsExactly<ArgumentException>(() =>
            NpcChronology.CalculateChronologicalAge(
                birth, birth.ToOffset(TimeSpan.FromHours(1))));
        Assert.ThrowsExactly<ArgumentOutOfRangeException>(() =>
            NpcChronology.CalculateChronologicalAge(birth, birth.AddTicks(-1)));
    }
}
```

- [ ] **Step 3: Run the focused test and confirm it fails because the contracts do not exist**

Run from `v2/`:

```bash
dotnet test tests/Nexis.Architecture.Tests/Nexis.Architecture.Tests.csproj --filter FullyQualifiedName~NpcLifecycleContractTests
```

Expected: compile failure for missing `Nexis.Npcs.Contracts` types.

- [ ] **Step 4: Implement `NpcId` and lifecycle status**

`NpcPrimitives.cs`:

```csharp
namespace Nexis.Npcs.Contracts;

public readonly record struct NpcId(Guid Value)
{
    public static NpcId New() => new(Guid.NewGuid());

    public bool IsEmpty => Value == Guid.Empty;

    public override string ToString() => Value.ToString("D");
}

public enum NpcLifecycleStatus
{
    Living = 0,
    Dead = 1
}
```

- [ ] **Step 5: Implement canonical chronological-age derivation**

`NpcChronology.cs`:

```csharp
namespace Nexis.Npcs.Contracts;

public static class NpcChronology
{
    public static int CalculateChronologicalAge(
        DateTimeOffset birthInstantUtc,
        DateTimeOffset atUtc)
    {
        if (birthInstantUtc.Offset != TimeSpan.Zero)
        {
            throw new ArgumentException("NPC birth instant must be UTC.", nameof(birthInstantUtc));
        }

        if (atUtc.Offset != TimeSpan.Zero)
        {
            throw new ArgumentException("NPC age evaluation time must be UTC.", nameof(atUtc));
        }

        if (atUtc < birthInstantUtc)
        {
            throw new ArgumentOutOfRangeException(nameof(atUtc), "NPC age cannot be evaluated before birth.");
        }

        var years = atUtc.Year - birthInstantUtc.Year;
        if (birthInstantUtc.AddYears(years) > atUtc)
        {
            years--;
        }

        return years;
    }
}
```

- [ ] **Step 6: Implement the authoritative lifecycle snapshot**

`NpcLifecycleStateContracts.cs`:

```csharp
using Nexis.Core.Contracts;

namespace Nexis.Npcs.Contracts;

public sealed record NpcLifecycleSnapshot : IAuthoritativeSnapshot
{
    public static ContractDescriptor SnapshotContract { get; } =
        new("nexis.npcs.lifecycle-snapshot", 1);

    public static OwnerKey OwnerKey { get; } = new("NpcLifecycle");

    public NpcLifecycleSnapshot(
        NpcId npcId,
        long revision,
        DateTimeOffset birthInstantUtc,
        NpcLifecycleStatus status)
    {
        if (npcId.IsEmpty)
        {
            throw new ArgumentException("NPC lifecycle snapshots require a non-empty NpcId.", nameof(npcId));
        }

        if (revision < 0)
        {
            throw new ArgumentOutOfRangeException(nameof(revision), "Lifecycle revision cannot be negative.");
        }

        if (birthInstantUtc.Offset != TimeSpan.Zero)
        {
            throw new ArgumentException("NPC birth instant must be UTC.", nameof(birthInstantUtc));
        }

        if (!Enum.IsDefined(status))
        {
            throw new ArgumentOutOfRangeException(nameof(status));
        }

        NpcId = npcId;
        Revision = revision;
        BirthInstantUtc = birthInstantUtc;
        Status = status;
    }

    public ContractDescriptor Contract => SnapshotContract;
    public OwnerKey Owner => OwnerKey;
    public NpcId NpcId { get; }
    public long Revision { get; }
    public DateTimeOffset BirthInstantUtc { get; }
    public NpcLifecycleStatus Status { get; }
}
```

- [ ] **Step 7: Re-run the focused test**

Run:

```bash
dotnet test tests/Nexis.Architecture.Tests/Nexis.Architecture.Tests.csproj --filter FullyQualifiedName~NpcLifecycleContractTests
```

Expected: all `NpcLifecycleContractTests` pass.

- [ ] **Step 8: Commit Task 1**

```bash
git add v2/Nexis.slnx v2/src/Nexis.Npcs.Contracts v2/tests/Nexis.Architecture.Tests/Nexis.Architecture.Tests.csproj v2/tests/Nexis.Architecture.Tests/NpcLifecycleContractTests.cs
git commit -m "feat(v2): add npc lifecycle contracts"
```

---

### Task 2: Add trusted-System lifecycle establishment rule

**Files:**
- Create: `v2/src/Nexis.Npcs.Contracts/EstablishNpcLifecycleContracts.cs`
- Create: `v2/src/Nexis.Core/Rules/Npcs/EstablishNpcLifecycleRuleEvaluator.cs`
- Modify: `v2/src/Nexis.Core/CoreRulesEngine.cs`
- Modify: `v2/src/Nexis.Core/Nexis.Core.csproj`
- Create/Test: `v2/tests/Nexis.Architecture.Tests/NpcLifecycleVerticalTests.cs`

**Interfaces:**
- Consumes: `NpcId`, `NpcLifecycleSnapshot`, `NpcLifecycleStatus`, trusted `System` actor context, authoritative UTC `CoreEvaluationContext.EvaluationTimeUtc`.
- Produces: `EstablishNpcLifecycleIntent(NpcId, DateTimeOffset)` contract `nexis.npcs.establish-lifecycle` schema 1.
- Produces: `CreateNpcLifecycleTransition(NpcId, DateTimeOffset)` targeting `NpcLifecycle`, `ExpectedRevision == null`.
- Produces: `NpcLifecycleEstablishedEvent(NpcId, DateTimeOffset)` contract `nexis.npcs.lifecycle-established` schema 1.
- Produces Core reason codes: `npcs.actor.system_required`, `npcs.birth.future`, `npcs.lifecycle.already_exists`, `npcs.snapshot.lifecycle_ambiguous`.

- [ ] **Step 1: Write failing Core-rule tests**

Add these tests to `NpcLifecycleVerticalTests.cs`:

```csharp
using Microsoft.VisualStudio.TestTools.UnitTesting;
using Nexis.Core;
using Nexis.Core.Contracts;
using Nexis.Identity.Contracts;
using Nexis.Kernel.Commands;
using Nexis.Kernel.Events;
using Nexis.Kernel.Randomness;
using Nexis.Npcs.Contracts;

namespace Nexis.Architecture.Tests;

[TestClass]
public sealed partial class NpcLifecycleVerticalTests
{
    private static readonly DateTimeOffset Now =
        new(2026, 9, 16, 12, 0, 0, TimeSpan.Zero);

    [TestMethod]
    public void EstablishLifecycle_SystemActorCreatesLivingOwnerTransitionAndEvent()
    {
        var id = NpcId.New();
        var birth = Now.AddYears(-30);
        var decision = Evaluate(id, birth, TrustedActorContext.CreateSystem(new SystemActorKey("nexis.scheduler")));

        Assert.AreEqual(CoreOutcomeStatus.Succeeded, decision.Status);
        Assert.AreEqual(1, decision.Transitions.Count);
        var transition = (CreateNpcLifecycleTransition)decision.Transitions[0];
        Assert.AreEqual(NpcLifecycleSnapshot.OwnerKey, transition.TargetOwner);
        Assert.IsNull(transition.ExpectedRevision);
        Assert.AreEqual(id, transition.NpcId);
        Assert.AreEqual(birth, transition.BirthInstantUtc);

        Assert.AreEqual(1, decision.Events.Count);
        Assert.IsInstanceOfType<NpcLifecycleEstablishedEvent>(decision.Events[0]);
    }

    [TestMethod]
    public void EstablishLifecycle_PlayerActorCannotMintNpcIdentity()
    {
        var decision = Evaluate(
            NpcId.New(),
            Now.AddYears(-20),
            TrustedActorContext.CreatePlayer(AccountId.New(), CharacterId.New(), 1));

        Assert.AreEqual(CoreOutcomeStatus.Rejected, decision.Status);
        Assert.AreEqual("npcs.actor.system_required", decision.Reason?.Value);
        Assert.AreEqual(0, decision.Transitions.Count);
    }

    [TestMethod]
    public void EstablishLifecycle_RejectsFutureBirth()
    {
        var decision = Evaluate(
            NpcId.New(),
            Now.AddTicks(1),
            TrustedActorContext.CreateSystem(new SystemActorKey("nexis.scheduler")));

        Assert.AreEqual(CoreOutcomeStatus.Rejected, decision.Status);
        Assert.AreEqual("npcs.birth.future", decision.Reason?.Value);
    }

    [TestMethod]
    public void EstablishLifecycle_RejectsAlreadyExistingNpc()
    {
        var id = NpcId.New();
        var birth = Now.AddYears(-45);
        var decision = Evaluate(
            id,
            birth,
            TrustedActorContext.CreateSystem(new SystemActorKey("nexis.scheduler")),
            new NpcLifecycleSnapshot(id, 4, birth, NpcLifecycleStatus.Living));

        Assert.AreEqual(CoreOutcomeStatus.Rejected, decision.Status);
        Assert.AreEqual("npcs.lifecycle.already_exists", decision.Reason?.Value);
        Assert.AreEqual(0, decision.Transitions.Count);
    }

    [TestMethod]
    public void EstablishLifecycle_ReevaluationIsDeterministic()
    {
        var id = NpcId.New();
        var birth = Now.AddYears(-18);
        var actor = TrustedActorContext.CreateSystem(new SystemActorKey("nexis.scheduler"));

        var first = Evaluate(id, birth, actor);
        var second = Evaluate(id, birth, actor);

        Assert.AreEqual(first.Status, second.Status);
        CollectionAssert.AreEqual(first.Transitions.ToArray(), second.Transitions.ToArray());
        CollectionAssert.AreEqual(first.Events.ToArray(), second.Events.ToArray());
    }

    private static CoreDecision Evaluate(
        NpcId id,
        DateTimeOffset birth,
        TrustedActorContext actor,
        params IAuthoritativeSnapshot[] snapshots)
    {
        var request = new CoreEvaluationRequest(
            CoreContractVersion.V1,
            new CoreEvaluationContext(
                CommandId.New(),
                CorrelationId.New(),
                actor,
                Now,
                new RuleVersion("npc-lifecycle-rules-v1"),
                new ContentVersion("npc-lifecycle-content-v1"),
                new FixedRandomFactory()),
            new EstablishNpcLifecycleIntent(id, birth),
            snapshots);

        return new CoreRulesEngine().Evaluate(request);
    }
}
```

- [ ] **Step 2: Run the focused tests and verify missing contracts/evaluator fail the build**

```bash
dotnet test tests/Nexis.Architecture.Tests/Nexis.Architecture.Tests.csproj --filter FullyQualifiedName~NpcLifecycleVerticalTests
```

Expected: compile failure for the new lifecycle intent/transition/event.

- [ ] **Step 3: Implement typed intent, transition and event**

`EstablishNpcLifecycleContracts.cs`:

```csharp
using Nexis.Core.Contracts;

namespace Nexis.Npcs.Contracts;

public sealed record EstablishNpcLifecycleIntent : ICoreIntent
{
    public static ContractDescriptor IntentContract { get; } =
        new("nexis.npcs.establish-lifecycle", 1);

    public EstablishNpcLifecycleIntent(NpcId npcId, DateTimeOffset birthInstantUtc)
    {
        Validate(npcId, birthInstantUtc);
        NpcId = npcId;
        BirthInstantUtc = birthInstantUtc;
    }

    public ContractDescriptor Contract => IntentContract;
    public NpcId NpcId { get; }
    public DateTimeOffset BirthInstantUtc { get; }

    internal static void Validate(NpcId npcId, DateTimeOffset birthInstantUtc)
    {
        if (npcId.IsEmpty)
        {
            throw new ArgumentException("NPC lifecycle establishment requires a non-empty NpcId.", nameof(npcId));
        }
        if (birthInstantUtc.Offset != TimeSpan.Zero)
        {
            throw new ArgumentException("NPC birth instant must be UTC.", nameof(birthInstantUtc));
        }
    }
}

public sealed record CreateNpcLifecycleTransition : IOwnerTransition
{
    public static ContractDescriptor TransitionContract { get; } =
        new("nexis.npcs.create-lifecycle", 1);

    public CreateNpcLifecycleTransition(NpcId npcId, DateTimeOffset birthInstantUtc)
    {
        EstablishNpcLifecycleIntent.Validate(npcId, birthInstantUtc);
        NpcId = npcId;
        BirthInstantUtc = birthInstantUtc;
    }

    public ContractDescriptor Contract => TransitionContract;
    public OwnerKey TargetOwner => NpcLifecycleSnapshot.OwnerKey;
    public long? ExpectedRevision => null;
    public NpcId NpcId { get; }
    public DateTimeOffset BirthInstantUtc { get; }
}

public sealed record NpcLifecycleEstablishedEvent : ICoreEventDescriptor
{
    public static ContractDescriptor EventContract { get; } =
        new("nexis.npcs.lifecycle-established", 1);

    public NpcLifecycleEstablishedEvent(NpcId npcId, DateTimeOffset birthInstantUtc)
    {
        EstablishNpcLifecycleIntent.Validate(npcId, birthInstantUtc);
        NpcId = npcId;
        BirthInstantUtc = birthInstantUtc;
    }

    public ContractDescriptor Contract => EventContract;
    public NpcId NpcId { get; }
    public DateTimeOffset BirthInstantUtc { get; }
}
```

- [ ] **Step 4: Reference NPC contracts from Core**

Add to `Nexis.Core.csproj`:

```xml
<ProjectReference Include="..\Nexis.Npcs.Contracts\Nexis.Npcs.Contracts.csproj" />
```

- [ ] **Step 5: Implement the deterministic rule evaluator**

`Rules/Npcs/EstablishNpcLifecycleRuleEvaluator.cs`:

```csharp
using Nexis.Core.Contracts;
using Nexis.Identity.Contracts;
using Nexis.Kernel.Commands;
using Nexis.Npcs.Contracts;

namespace Nexis.Core.Rules.Npcs;

internal sealed class EstablishNpcLifecycleRuleEvaluator : ICoreRuleEvaluator
{
    private static readonly CoreReasonCode SystemActorRequired = new("npcs.actor.system_required");
    private static readonly CoreReasonCode FutureBirth = new("npcs.birth.future");
    private static readonly CoreReasonCode AlreadyExists = new("npcs.lifecycle.already_exists");
    private static readonly CoreReasonCode AmbiguousSnapshot = new("npcs.snapshot.lifecycle_ambiguous");

    public ContractDescriptor IntentContract => EstablishNpcLifecycleIntent.IntentContract;

    public CoreDecision Evaluate(CoreRuleExecutionContext context)
    {
        ArgumentNullException.ThrowIfNull(context);

        if (context.Intent is not EstablishNpcLifecycleIntent intent)
        {
            throw new InvalidOperationException("NPC lifecycle evaluator received a different intent type.");
        }

        if (context.Actor.Kind != ActorKind.System || context.Actor.Lane != CommandExecutionLane.System)
        {
            return CoreDecision.Rejected(SystemActorRequired);
        }

        if (intent.BirthInstantUtc > context.EvaluationTimeUtc)
        {
            return CoreDecision.Rejected(FutureBirth);
        }

        var existing = context.Snapshots
            .OfType<NpcLifecycleSnapshot>()
            .Where(snapshot => snapshot.NpcId == intent.NpcId)
            .ToArray();

        if (existing.Length > 1)
        {
            return CoreDecision.TechnicalFailure(AmbiguousSnapshot);
        }

        if (existing.Length == 1)
        {
            return CoreDecision.Rejected(AlreadyExists);
        }

        return CoreDecision.Succeeded(
            transitions:
            [
                new CreateNpcLifecycleTransition(intent.NpcId, intent.BirthInstantUtc)
            ],
            events:
            [
                new NpcLifecycleEstablishedEvent(intent.NpcId, intent.BirthInstantUtc)
            ]);
    }
}
```

- [ ] **Step 6: Register the rule in `CoreRulesEngine`**

Add:

```csharp
using Nexis.Core.Rules.Npcs;
```

and make the default evaluator list:

```csharp
private static ICoreRuleEvaluator[] CreateDefaultEvaluators() =>
[
    new EquipItemRuleEvaluator(),
    new UnequipItemRuleEvaluator(),
    new EstablishNpcLifecycleRuleEvaluator()
];
```

- [ ] **Step 7: Re-run lifecycle vertical tests and the existing Core architecture tests**

```bash
dotnet test tests/Nexis.Architecture.Tests/Nexis.Architecture.Tests.csproj --filter "FullyQualifiedName~NpcLifecycleVerticalTests|FullyQualifiedName~CoreArchitectureTests"
```

Expected: all selected tests pass.

- [ ] **Step 8: Commit Task 2**

```bash
git add v2/src/Nexis.Npcs.Contracts/EstablishNpcLifecycleContracts.cs v2/src/Nexis.Core v2/tests/Nexis.Architecture.Tests/NpcLifecycleVerticalTests.cs
git commit -m "feat(v2): decide npc lifecycle establishment"
```

---

### Task 3: Add canonical command recovery for NPC lifecycle establishment

**Files:**
- Create: `v2/src/Nexis.Modules.Npcs/Nexis.Modules.Npcs.csproj`
- Create: `v2/src/Nexis.Modules.Npcs/EstablishNpcLifecycleCanonicalCommandCodec.cs`
- Modify: `v2/Nexis.slnx`
- Modify: `v2/tests/Nexis.Architecture.Tests/Nexis.Architecture.Tests.csproj`
- Modify/Test: `v2/tests/Nexis.Architecture.Tests/NpcLifecycleVerticalTests.cs`
- Modify/Test: `v2/tests/Nexis.Architecture.Tests/AutomationArchitectureTests.cs`

**Interfaces:**
- Consumes: `EstablishNpcLifecycleIntent`.
- Produces: `EstablishNpcLifecycleCanonicalCommandCodec : ICanonicalCommandCodec` using exactly `npcId` and `birthInstantUtc` JSON properties.
- Canonical timestamp format: invariant `O` round-trip format with UTC offset required.
- Unknown or duplicate JSON properties are rejected.

- [ ] **Step 1: Add module project shell, solution entry and test reference**

`Nexis.Modules.Npcs.csproj`:

```xml
<Project Sdk="Microsoft.NET.Sdk">
  <ItemGroup>
    <ProjectReference Include="..\Nexis.Core.Contracts\Nexis.Core.Contracts.csproj" />
    <ProjectReference Include="..\Nexis.Execution.Contracts\Nexis.Execution.Contracts.csproj" />
    <ProjectReference Include="..\Nexis.Npcs.Contracts\Nexis.Npcs.Contracts.csproj" />
  </ItemGroup>
</Project>
```

Add to `Nexis.slnx`:

```xml
<Project Path="src/Nexis.Modules.Npcs/Nexis.Modules.Npcs.csproj" />
```

Add to architecture-test project references:

```xml
<ProjectReference Include="..\..\src\Nexis.Modules.Npcs\Nexis.Modules.Npcs.csproj" />
```

- [ ] **Step 2: Add failing codec tests**

Append to `NpcLifecycleVerticalTests.cs`:

```csharp
[TestMethod]
public void LifecycleCodec_RoundTripsCanonicalPayloadWithoutRuntimeTypeMetadata()
{
    var codec = new Nexis.Modules.Npcs.EstablishNpcLifecycleCanonicalCommandCodec();
    var intent = new EstablishNpcLifecycleIntent(
        NpcId.New(),
        new DateTimeOffset(2001, 2, 3, 4, 5, 6, TimeSpan.Zero));

    var payload = codec.Serialize(intent);
    var recovered = codec.Deserialize(payload);

    Assert.AreEqual(intent, recovered);
    StringAssert.DoesNotContain(payload.Json, "$type");
}

[TestMethod]
public void LifecycleCodec_RejectsUnknownProperties()
{
    var payload = Nexis.Execution.Contracts.CanonicalCommandPayload.FromTrustedJson(
        "{\"npcId\":\"11111111-1111-1111-1111-111111111111\","
        + "\"birthInstantUtc\":\"2001-02-03T04:05:06.0000000+00:00\","
        + "\"unexpected\":true}");

    Assert.ThrowsExactly<FormatException>(() =>
        new Nexis.Modules.Npcs.EstablishNpcLifecycleCanonicalCommandCodec().Deserialize(payload));
}
```

- [ ] **Step 3: Run the codec tests and verify they fail because the codec is absent**

```bash
dotnet test tests/Nexis.Architecture.Tests/Nexis.Architecture.Tests.csproj --filter FullyQualifiedName~LifecycleCodec
```

Expected: compile failure for missing codec type.

- [ ] **Step 4: Implement the canonical codec**

`EstablishNpcLifecycleCanonicalCommandCodec.cs`:

```csharp
using System.Globalization;
using System.Text.Json;
using Nexis.Core.Contracts;
using Nexis.Execution.Contracts;
using Nexis.Npcs.Contracts;

namespace Nexis.Modules.Npcs;

public sealed class EstablishNpcLifecycleCanonicalCommandCodec : ICanonicalCommandCodec
{
    public ContractDescriptor IntentContract => EstablishNpcLifecycleIntent.IntentContract;

    public CanonicalCommandPayload Serialize(ICoreIntent intent)
    {
        if (intent is not EstablishNpcLifecycleIntent establish)
        {
            throw new ArgumentException("NPC lifecycle codec received the wrong typed intent.", nameof(intent));
        }

        var birth = establish.BirthInstantUtc.ToString("O", CultureInfo.InvariantCulture);
        var json = string.Create(
            CultureInfo.InvariantCulture,
            $"{{\"npcId\":\"{establish.NpcId.Value:D}\",\"birthInstantUtc\":\"{birth}\"}}");
        return CanonicalCommandPayload.FromTrustedJson(json);
    }

    public ICoreIntent Deserialize(CanonicalCommandPayload payload)
    {
        ArgumentNullException.ThrowIfNull(payload);
        using var document = JsonDocument.Parse(payload.Json);
        if (document.RootElement.ValueKind != JsonValueKind.Object)
        {
            throw new FormatException("NPC lifecycle payload must be a JSON object.");
        }

        string? npcId = null;
        string? birthInstantUtc = null;
        var seen = new HashSet<string>(StringComparer.Ordinal);

        foreach (var property in document.RootElement.EnumerateObject())
        {
            if (!seen.Add(property.Name))
            {
                throw new FormatException($"NPC lifecycle payload contains duplicate property '{property.Name}'.");
            }

            switch (property.Name)
            {
                case "npcId":
                    npcId = ReadString(property);
                    break;
                case "birthInstantUtc":
                    birthInstantUtc = ReadString(property);
                    break;
                default:
                    throw new FormatException($"NPC lifecycle payload contains unknown property '{property.Name}'.");
            }
        }

        if (!Guid.TryParseExact(npcId, "D", out var parsedNpcId))
        {
            throw new FormatException("NPC lifecycle payload contains an invalid npcId.");
        }

        if (!DateTimeOffset.TryParseExact(
                birthInstantUtc,
                "O",
                CultureInfo.InvariantCulture,
                DateTimeStyles.RoundtripKind,
                out var parsedBirth) ||
            parsedBirth.Offset != TimeSpan.Zero)
        {
            throw new FormatException("NPC lifecycle payload contains an invalid UTC birthInstantUtc.");
        }

        return new EstablishNpcLifecycleIntent(new NpcId(parsedNpcId), parsedBirth);
    }

    private static string ReadString(JsonProperty property)
    {
        if (property.Value.ValueKind != JsonValueKind.String)
        {
            throw new FormatException($"NPC lifecycle payload property '{property.Name}' must be a string.");
        }

        return property.Value.GetString()
            ?? throw new FormatException($"NPC lifecycle payload property '{property.Name}' cannot be null.");
    }
}
```

- [ ] **Step 5: Make the mutation-boundary allowlist explicit**

`AutomationArchitectureTests.FindMutationBypasses` intentionally treats any `Nexis.Modules.* -> Nexis.Execution.Contracts` reference as privileged composition. Add this exact reviewed pair beside the Equipment module entry:

```csharp
("Nexis.Modules.Npcs", "Nexis.Execution.Contracts"),
```

Do not broaden the allowlist to `Nexis.Modules.*`; the point is to keep it closed.

- [ ] **Step 6: Run codec and automation-architecture tests**

```bash
dotnet test tests/Nexis.Architecture.Tests/Nexis.Architecture.Tests.csproj --filter "FullyQualifiedName~NpcLifecycleVerticalTests|FullyQualifiedName~AutomationArchitectureTests"
```

Expected: all selected tests pass and the mutation-boundary scan recognizes exactly the reviewed NPC serialization module reference.

- [ ] **Step 7: Commit Task 3**

```bash
git add v2/Nexis.slnx v2/src/Nexis.Modules.Npcs v2/tests/Nexis.Architecture.Tests
git commit -m "feat(v2): add npc lifecycle command codec"
```

---

### Task 4: Add PostgreSQL NPC lifecycle owner and migration

**Files:**
- Create: `v2/src/Nexis.Persistence.Postgres/Migrations/0011_npc_lifecycle_owner.sql`
- Create: `v2/src/Nexis.Persistence.Postgres/PostgresNpcLifecycleOwner.cs`
- Modify: `v2/src/Nexis.Persistence.Postgres/PostgresExecutionSchema.cs`
- Modify: `v2/src/Nexis.Persistence.Postgres/Nexis.Persistence.Postgres.csproj`
- Modify: `v2/tests/Nexis.Persistence.Postgres.Tests/Nexis.Persistence.Postgres.Tests.csproj`

**Interfaces:**
- Consumes: `CreateNpcLifecycleTransition` only.
- Produces: table `nexis_v2.npc_lifecycle_state` keyed by `npc_id`.
- Produces: `PostgresNpcLifecycleTransitionApplier : IPostgresOwnerTransitionApplier`.
- Produces: `PostgresNpcLifecycleSnapshotReader.ReadAsync(NpcId, CancellationToken)`.
- Lock resource: owner `NpcLifecycle`, resource type `npc.lifecycle`, resource id lower-case canonical GUID `D` string.
- Conflict reason: `npcs.lifecycle.already_exists`.

- [ ] **Step 1: Add the migration**

`0011_npc_lifecycle_owner.sql`:

```sql
CREATE TABLE IF NOT EXISTS nexis_v2.npc_lifecycle_state (
    npc_id uuid PRIMARY KEY,
    revision bigint NOT NULL CHECK (revision >= 1),
    birth_instant_utc timestamptz NOT NULL,
    lifecycle_status smallint NOT NULL CHECK (lifecycle_status IN (0, 1))
);
```

There is deliberately no mutable age column, death-cause column, provenance blob, generic JSON attributes column or foreign owner state in this table.

- [ ] **Step 2: Register migration and contract reference**

Append to `PostgresExecutionSchema.OrderedResources` after 0010:

```csharp
"Nexis.Persistence.Postgres.Migrations.0011_npc_lifecycle_owner.sql"
```

Add to `Nexis.Persistence.Postgres.csproj` project references:

```xml
<ProjectReference Include="..\Nexis.Npcs.Contracts\Nexis.Npcs.Contracts.csproj" />
```

Add the embedded resource:

```xml
<EmbeddedResource Include="Migrations\0011_npc_lifecycle_owner.sql" LogicalName="Nexis.Persistence.Postgres.Migrations.0011_npc_lifecycle_owner.sql" />
```

Add NPC contracts/module references to `Nexis.Persistence.Postgres.Tests.csproj`:

```xml
<ProjectReference Include="..\..\src\Nexis.Npcs.Contracts\Nexis.Npcs.Contracts.csproj" />
<ProjectReference Include="..\..\src\Nexis.Modules.Npcs\Nexis.Modules.Npcs.csproj" />
```

- [ ] **Step 3: Implement the transition applier and reader**

`PostgresNpcLifecycleOwner.cs`:

```csharp
using Nexis.Core.Contracts;
using Nexis.Execution;
using Nexis.Execution.Contracts;
using Nexis.Npcs.Contracts;
using Npgsql;
using NpgsqlTypes;

namespace Nexis.Persistence.Postgres;

public sealed class PostgresNpcLifecycleTransitionApplier : IPostgresOwnerTransitionApplier
{
    private static readonly CommandReasonCode AlreadyExists = new("npcs.lifecycle.already_exists");

    public OwnerKey Owner => NpcLifecycleSnapshot.OwnerKey;

    public IReadOnlyList<AuthoritativeResourceKey> ResolveLockKeys(IOwnerTransition transition)
    {
        var create = RequireCreate(transition);
        return
        [
            new AuthoritativeResourceKey(
                Owner,
                "npc.lifecycle",
                create.NpcId.Value.ToString("D"))
        ];
    }

    public async ValueTask<PostgresOwnerTransitionResult> ApplyAsync(
        NpgsqlConnection connection,
        NpgsqlTransaction transaction,
        IOwnerTransition transition,
        CancellationToken cancellationToken = default)
    {
        ArgumentNullException.ThrowIfNull(connection);
        ArgumentNullException.ThrowIfNull(transaction);
        var create = RequireCreate(transition);

        if (create.ExpectedRevision is not null)
        {
            throw new InvalidOperationException("NPC lifecycle creation must not carry a prior revision.");
        }

        const string sql = """
            INSERT INTO nexis_v2.npc_lifecycle_state (
                npc_id, revision, birth_instant_utc, lifecycle_status)
            VALUES (@npc_id, 1, @birth_instant_utc, @lifecycle_status)
            ON CONFLICT (npc_id) DO NOTHING;
            """;

        await using var command = new NpgsqlCommand(sql, connection, transaction);
        command.Parameters.AddWithValue("npc_id", NpgsqlDbType.Uuid, create.NpcId.Value);
        command.Parameters.AddWithValue("birth_instant_utc", NpgsqlDbType.TimestampTz, create.BirthInstantUtc.UtcDateTime);
        command.Parameters.AddWithValue("lifecycle_status", NpgsqlDbType.Smallint, (short)NpcLifecycleStatus.Living);

        return await command.ExecuteNonQueryAsync(cancellationToken).ConfigureAwait(false) == 1
            ? PostgresOwnerTransitionResult.Applied()
            : PostgresOwnerTransitionResult.ConcurrencyConflict(AlreadyExists);
    }

    private static CreateNpcLifecycleTransition RequireCreate(IOwnerTransition transition)
    {
        ArgumentNullException.ThrowIfNull(transition);
        return transition as CreateNpcLifecycleTransition
            ?? throw new InvalidOperationException(
                $"NPC lifecycle PostgreSQL owner does not support transition '{transition.Contract.Name}' schema {transition.Contract.SchemaVersion}.");
    }
}

public sealed class PostgresNpcLifecycleSnapshotReader
{
    private readonly NpgsqlDataSource _dataSource;

    public PostgresNpcLifecycleSnapshotReader(NpgsqlDataSource dataSource)
    {
        _dataSource = dataSource ?? throw new ArgumentNullException(nameof(dataSource));
    }

    public async ValueTask<NpcLifecycleSnapshot> ReadAsync(
        NpcId npcId,
        CancellationToken cancellationToken = default)
    {
        if (npcId.IsEmpty)
        {
            throw new ArgumentException("NPC lifecycle reads require a non-empty NpcId.", nameof(npcId));
        }

        const string sql = """
            SELECT revision, birth_instant_utc, lifecycle_status
            FROM nexis_v2.npc_lifecycle_state
            WHERE npc_id = @npc_id;
            """;

        await using var connection = await _dataSource.OpenConnectionAsync(cancellationToken).ConfigureAwait(false);
        await using var command = new NpgsqlCommand(sql, connection);
        command.Parameters.AddWithValue("npc_id", NpgsqlDbType.Uuid, npcId.Value);
        await using var reader = await command.ExecuteReaderAsync(cancellationToken).ConfigureAwait(false);

        if (!await reader.ReadAsync(cancellationToken).ConfigureAwait(false))
        {
            throw new KeyNotFoundException($"NPC lifecycle state is not provisioned for '{npcId.Value:D}'.");
        }

        var revision = reader.GetInt64(0);
        var birth = new DateTimeOffset(DateTime.SpecifyKind(reader.GetDateTime(1), DateTimeKind.Utc));
        var status = (NpcLifecycleStatus)reader.GetInt16(2);

        return new NpcLifecycleSnapshot(npcId, revision, birth, status);
    }
}
```

- [ ] **Step 4: Build the persistence project**

```bash
dotnet build src/Nexis.Persistence.Postgres/Nexis.Persistence.Postgres.csproj
```

Expected: build succeeds with zero warnings and zero errors.

- [ ] **Step 5: Commit Task 4**

```bash
git add v2/src/Nexis.Persistence.Postgres v2/tests/Nexis.Persistence.Postgres.Tests/Nexis.Persistence.Postgres.Tests.csproj
git commit -m "feat(v2): persist npc lifecycle owner"
```

---

### Task 5: Prove atomic lifecycle creation, idempotency and conflict behavior in PostgreSQL

**Files:**
- Create/Test: `v2/tests/Nexis.Persistence.Postgres.Tests/PostgresNpcLifecycleVerticalIntegrationTests.cs`

**Interfaces:**
- Consumes: existing `PostgresCommandReceiptRepository`, `CommandExecutionIdentityFactory`, `CommandCommitPlanBuilder`, `PostgresAtomicCommandCommitter`, NPC canonical codec and transition applier.
- Produces database evidence that owner state + terminal receipt + authoritative event + outbox commit atomically.

- [ ] **Step 1: Write the PostgreSQL integration fixture and happy-path/idempotency test**

Create the test class with the same environment gate used by existing persistence tests:

```csharp
using Microsoft.VisualStudio.TestTools.UnitTesting;
using Nexis.Core;
using Nexis.Core.Contracts;
using Nexis.Execution;
using Nexis.Execution.Contracts;
using Nexis.Identity.Contracts;
using Nexis.Kernel.Commands;
using Nexis.Kernel.Events;
using Nexis.Kernel.Randomness;
using Nexis.Modules.Npcs;
using Nexis.Npcs.Contracts;
using Nexis.Persistence.Postgres;
using Npgsql;

namespace Nexis.Persistence.Postgres.Tests;

[TestClass]
[DoNotParallelize]
public sealed class PostgresNpcLifecycleVerticalIntegrationTests
{
    private static NpgsqlDataSource? s_dataSource;

    private static NpgsqlDataSource DataSource =>
        s_dataSource ?? throw new InvalidOperationException("PostgreSQL test data source is not initialized.");

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
                nexis_v2.npc_lifecycle_state,
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
    public async Task EstablishNpcLifecycle_CommitsOwnerHistoryOutboxAndDuplicateCommandIsIdempotent()
    {
        var npcId = NpcId.New();
        var birth = new DateTimeOffset(1990, 9, 16, 12, 0, 0, TimeSpan.Zero);
        var commandId = CommandId.New();
        var correlationId = CorrelationId.New();
        var request = new CoreEvaluationRequest(
            CoreContractVersion.V1,
            new CoreEvaluationContext(
                commandId,
                correlationId,
                TrustedActorContext.CreateSystem(new SystemActorKey("nexis.scheduler")),
                new DateTimeOffset(2026, 9, 16, 12, 0, 0, TimeSpan.Zero),
                new RuleVersion("npc-lifecycle-rules-v1"),
                new ContentVersion("npc-lifecycle-content-v1"),
                new FixedRandomFactory()),
            new EstablishNpcLifecycleIntent(npcId, birth),
            Array.Empty<IAuthoritativeSnapshot>());

        var engine = new CoreRulesEngine();
        var decision = engine.Evaluate(request);
        Assert.AreEqual(CoreOutcomeStatus.Succeeded, decision.Status);

        var payload = new EstablishNpcLifecycleCanonicalCommandCodec().Serialize(request.Intent);
        var receipts = new PostgresCommandReceiptRepository(DataSource);
        var claim = await receipts.TryAcquireAsync(new CommandReceiptAcquireRequest(
            CommandExecutionIdentityFactory.Create(request, payload),
            payload,
            correlationId,
            new DateTimeOffset(2026, 9, 16, 12, 0, 1, TimeSpan.Zero),
            new CommandExecutionLeaseRequest("npc-lifecycle-test", TimeSpan.FromMinutes(1))));
        Assert.AreEqual(CommandReceiptDisposition.Acquired, claim.Disposition);

        var plan = new CommandCommitPlanBuilder().Build(
            request,
            payload.Fingerprint,
            claim,
            decision,
            engine.Descriptor,
            new DateTimeOffset(2026, 9, 16, 12, 0, 2, TimeSpan.Zero));

        var result = await new PostgresAtomicCommandCommitter(
            DataSource,
            new IPostgresOwnerTransitionApplier[] { new PostgresNpcLifecycleTransitionApplier() })
            .CommitAsync(plan);

        Assert.AreEqual(CommandCommitDisposition.Committed, result.Disposition);
        var persisted = await new PostgresNpcLifecycleSnapshotReader(DataSource).ReadAsync(npcId);
        Assert.AreEqual(1L, persisted.Revision);
        Assert.AreEqual(birth, persisted.BirthInstantUtc);
        Assert.AreEqual(NpcLifecycleStatus.Living, persisted.Status);
        Assert.AreEqual(1, await CountAsync("nexis_v2.npc_lifecycle_state"));
        Assert.AreEqual(1, await CountAsync("nexis_v2.authoritative_events"));
        Assert.AreEqual(1, await CountAsync("nexis_v2.outbox"));

        var duplicate = await receipts.TryAcquireAsync(new CommandReceiptAcquireRequest(
            CommandExecutionIdentityFactory.Create(request, payload),
            payload,
            CorrelationId.New(),
            new DateTimeOffset(2026, 9, 16, 12, 0, 3, TimeSpan.Zero),
            new CommandExecutionLeaseRequest("npc-lifecycle-duplicate", TimeSpan.FromMinutes(1))));

        Assert.AreEqual(CommandReceiptDisposition.DuplicateCompleted, duplicate.Disposition);
        Assert.AreEqual(1, await CountAsync("nexis_v2.npc_lifecycle_state"));
        Assert.AreEqual(1, await CountAsync("nexis_v2.authoritative_events"));
        Assert.AreEqual(1, await CountAsync("nexis_v2.outbox"));
    }

    private static async Task<int> CountAsync(string qualifiedTable)
    {
        var allowed = new HashSet<string>(StringComparer.Ordinal)
        {
            "nexis_v2.npc_lifecycle_state",
            "nexis_v2.authoritative_events",
            "nexis_v2.outbox"
        };
        if (!allowed.Contains(qualifiedTable))
        {
            throw new ArgumentOutOfRangeException(nameof(qualifiedTable));
        }

        await using var connection = await DataSource.OpenConnectionAsync();
        await using var command = new NpgsqlCommand($"SELECT count(*) FROM {qualifiedTable};", connection);
        return Convert.ToInt32(await command.ExecuteScalarAsync());
    }
}
```

- [ ] **Step 2: Add a conflicting-second-command test**

Add this complete test to the same class. Both commands intentionally evaluate against absence; the second command uses a distinct CommandId and reaches persistence only after the first commit has created the row:

```csharp
[TestMethod]
public async Task EstablishNpcLifecycle_DifferentCommandForSameNpcConflictsWithoutDuplicateHistory()
{
    var npcId = NpcId.New();
    var birth = new DateTimeOffset(1988, 1, 11, 9, 0, 0, TimeSpan.Zero);
    var evaluationTime = new DateTimeOffset(2026, 9, 16, 12, 0, 0, TimeSpan.Zero);
    var engine = new CoreRulesEngine();
    var codec = new EstablishNpcLifecycleCanonicalCommandCodec();
    var receipts = new PostgresCommandReceiptRepository(DataSource);
    var committer = new PostgresAtomicCommandCommitter(
        DataSource,
        new IPostgresOwnerTransitionApplier[] { new PostgresNpcLifecycleTransitionApplier() });

    var firstRequest = new CoreEvaluationRequest(
        CoreContractVersion.V1,
        new CoreEvaluationContext(
            CommandId.New(),
            CorrelationId.New(),
            TrustedActorContext.CreateSystem(new SystemActorKey("nexis.scheduler")),
            evaluationTime,
            new RuleVersion("npc-lifecycle-rules-v1"),
            new ContentVersion("npc-lifecycle-content-v1"),
            new FixedRandomFactory()),
        new EstablishNpcLifecycleIntent(npcId, birth),
        Array.Empty<IAuthoritativeSnapshot>());
    var firstDecision = engine.Evaluate(firstRequest);
    Assert.AreEqual(CoreOutcomeStatus.Succeeded, firstDecision.Status);
    var firstPayload = codec.Serialize(firstRequest.Intent);
    var firstClaim = await receipts.TryAcquireAsync(new CommandReceiptAcquireRequest(
        CommandExecutionIdentityFactory.Create(firstRequest, firstPayload),
        firstPayload,
        firstRequest.Context.CorrelationId,
        evaluationTime.AddSeconds(1),
        new CommandExecutionLeaseRequest("npc-lifecycle-first", TimeSpan.FromMinutes(1))));
    Assert.AreEqual(CommandReceiptDisposition.Acquired, firstClaim.Disposition);
    var firstPlan = new CommandCommitPlanBuilder().Build(
        firstRequest,
        firstPayload.Fingerprint,
        firstClaim,
        firstDecision,
        engine.Descriptor,
        evaluationTime.AddSeconds(2));
    var firstResult = await committer.CommitAsync(firstPlan);
    Assert.AreEqual(CommandCommitDisposition.Committed, firstResult.Disposition);

    var secondRequest = new CoreEvaluationRequest(
        CoreContractVersion.V1,
        new CoreEvaluationContext(
            CommandId.New(),
            CorrelationId.New(),
            TrustedActorContext.CreateSystem(new SystemActorKey("nexis.scheduler")),
            evaluationTime,
            new RuleVersion("npc-lifecycle-rules-v1"),
            new ContentVersion("npc-lifecycle-content-v1"),
            new FixedRandomFactory()),
        new EstablishNpcLifecycleIntent(npcId, birth),
        Array.Empty<IAuthoritativeSnapshot>());
    var secondDecision = engine.Evaluate(secondRequest);
    Assert.AreEqual(CoreOutcomeStatus.Succeeded, secondDecision.Status);
    var secondPayload = codec.Serialize(secondRequest.Intent);
    var secondClaim = await receipts.TryAcquireAsync(new CommandReceiptAcquireRequest(
        CommandExecutionIdentityFactory.Create(secondRequest, secondPayload),
        secondPayload,
        secondRequest.Context.CorrelationId,
        evaluationTime.AddSeconds(3),
        new CommandExecutionLeaseRequest("npc-lifecycle-second", TimeSpan.FromMinutes(1))));
    Assert.AreEqual(CommandReceiptDisposition.Acquired, secondClaim.Disposition);
    var secondPlan = new CommandCommitPlanBuilder().Build(
        secondRequest,
        secondPayload.Fingerprint,
        secondClaim,
        secondDecision,
        engine.Descriptor,
        evaluationTime.AddSeconds(4));

    var secondResult = await committer.CommitAsync(secondPlan);

    Assert.AreEqual(CommandCommitDisposition.ConcurrencyConflict, secondResult.Disposition);
    Assert.AreEqual("npcs.lifecycle.already_exists", secondResult.Reason?.Value);
    Assert.AreEqual(1, await CountAsync("nexis_v2.npc_lifecycle_state"));
    Assert.AreEqual(1, await CountAsync("nexis_v2.authoritative_events"));
    Assert.AreEqual(1, await CountAsync("nexis_v2.outbox"));
}
```

This proves the persistence boundary remains safe when two callers both observed absence before either authoritative write became visible.

- [ ] **Step 3: Run the focused PostgreSQL test with a test database**

When `NEXIS_TEST_POSTGRES_CONNECTION` is available:

```bash
dotnet test tests/Nexis.Persistence.Postgres.Tests/Nexis.Persistence.Postgres.Tests.csproj --filter FullyQualifiedName~PostgresNpcLifecycleVerticalIntegrationTests
```

Expected: all NPC lifecycle PostgreSQL tests pass.

When the environment variable is absent, the class must be reported as inconclusive/skipped. Record that as a missing database-backed gate rather than treating it as proof.

- [ ] **Step 4: Commit Task 5**

```bash
git add v2/tests/Nexis.Persistence.Postgres.Tests/PostgresNpcLifecycleVerticalIntegrationTests.cs
git commit -m "test(v2): prove npc lifecycle atomic persistence"
```

---

### Task 6: Add executable NPC ownership and bypass guards

**Files:**
- Create/Test: `v2/tests/Nexis.Architecture.Tests/NpcLifecycleOwnershipGuardTests.cs`
- Modify/Test: `v2/tests/Nexis.Architecture.Tests/ClaudeC5GlobalStateBlobGuardTests.cs` - add `Nexis.Npcs.Contracts` to the pinned governed-assembly list.

**Interfaces:**
- Guards the NPC contract assembly against infrastructure references.
- Guards source writes to `nexis_v2.npc_lifecycle_state` so the approved PostgreSQL owner adapter is the only C# writer.
- Guards `Nexis.Host.Api` from referencing `Nexis.Modules.Npcs` in Slice 01.
- Extends the existing global-state guard surface to include NPC contracts where required by its pinned scan.

- [ ] **Step 1: Write the ownership guard tests**

Create `NpcLifecycleOwnershipGuardTests.cs`:

```csharp
using System.Xml.Linq;
using Microsoft.VisualStudio.TestTools.UnitTesting;
using Nexis.Npcs.Contracts;

namespace Nexis.Architecture.Tests;

[TestClass]
public sealed class NpcLifecycleOwnershipGuardTests
{
    [TestMethod]
    public void NpcContracts_AreInfrastructureNeutral()
    {
        var references = typeof(NpcLifecycleSnapshot).Assembly
            .GetReferencedAssemblies()
            .Select(static reference => reference.Name ?? string.Empty)
            .ToArray();
        var forbidden = new[] { "Npgsql", "EntityFrameworkCore", "AspNetCore", "StackExchange.Redis" };

        Assert.IsFalse(
            references.Any(reference => forbidden.Any(fragment =>
                reference.Contains(fragment, StringComparison.OrdinalIgnoreCase))),
            $"NPC contracts leaked infrastructure references: {string.Join(", ", references)}");
    }

    [TestMethod]
    public void OnlyNpcLifecyclePostgresOwnerWritesNpcLifecycleTableFromCSharp()
    {
        var src = Path.Combine(FindSolutionDirectory(), "src");
        var writers = Directory.EnumerateFiles(src, "*.cs", SearchOption.AllDirectories)
            .Where(path => File.ReadAllText(path).Contains(
                "nexis_v2.npc_lifecycle_state",
                StringComparison.Ordinal))
            .Select(path => Path.GetRelativePath(src, path).Replace('\\', '/'))
            .OrderBy(static path => path, StringComparer.Ordinal)
            .ToArray();

        CollectionAssert.AreEqual(
            new[] { "Nexis.Persistence.Postgres/PostgresNpcLifecycleOwner.cs" },
            writers);
    }

    [TestMethod]
    public void HostApi_DoesNotReferenceNpcMutationModuleInSlice01()
    {
        var root = FindSolutionDirectory();
        var hostProject = XDocument.Load(Path.Combine(root, "src", "Nexis.Host.Api", "Nexis.Host.Api.csproj"));
        var refs = hostProject.Descendants("ProjectReference")
            .Select(static element => element.Attribute("Include")?.Value ?? string.Empty)
            .Select(static include => include.Replace('\\', '/'))
            .ToArray();

        Assert.IsFalse(refs.Any(static include =>
            include.EndsWith("Nexis.Modules.Npcs/Nexis.Modules.Npcs.csproj", StringComparison.Ordinal)));
    }

    private static string FindSolutionDirectory()
    {
        var directory = new DirectoryInfo(AppContext.BaseDirectory);
        while (directory is not null)
        {
            if (File.Exists(Path.Combine(directory.FullName, "Nexis.slnx")))
            {
                return directory.FullName;
            }
            directory = directory.Parent;
        }

        throw new DirectoryNotFoundException("Could not locate the Nexis V2 solution root.");
    }
}
```

- [ ] **Step 2: Extend the pinned global-state guard to require NPC contracts**

In `ClaudeC5GlobalStateBlobGuardTests.ReflectionScan_GovernsTheRealContractAndCoreSurface`, add `Nexis.Npcs.Contracts` to the explicit required assembly names:

```csharp
foreach (var required in new[]
         {
             "Nexis.Core",
             "Nexis.Core.Contracts",
             "Nexis.Equipment.Contracts",
             "Nexis.Execution",
             "Nexis.Identity.Contracts",
             "Nexis.Inventory.Contracts",
             "Nexis.Kernel",
             "Nexis.Npcs.Contracts"
         })
{
    Assert.IsTrue(
        scanned.Contains(required, StringComparer.Ordinal),
        $"The blob guard must govern {required}.");
}
```

The existing `NexisAssemblies()` implementation loads every `Nexis.*.dll` copied beside the test executable, so no separate type-loading mechanism is required once the test project references `Nexis.Npcs.Contracts`.

- [ ] **Step 3: Run the ownership guards and global-state guard**

```bash
dotnet test tests/Nexis.Architecture.Tests/Nexis.Architecture.Tests.csproj --filter "FullyQualifiedName~NpcLifecycleOwnershipGuardTests|FullyQualifiedName~ClaudeC5GlobalStateBlobGuardTests"
```

Expected: all selected tests pass and the pinned reflection guard explicitly proves `Nexis.Npcs.Contracts` is inside its governed surface.

- [ ] **Step 4: Run all NPC-focused architecture tests together**

```bash
dotnet test tests/Nexis.Architecture.Tests/Nexis.Architecture.Tests.csproj --filter "FullyQualifiedName~NpcLifecycle"
```

Expected: all NPC lifecycle contract, Core, codec and guard tests pass.

- [ ] **Step 5: Commit Task 6**

```bash
git add v2/tests/Nexis.Architecture.Tests
git commit -m "test(v2): guard npc lifecycle ownership"
```

---

### Task 7: Full verification, truthful documentation and slice checkpoint

**Files:**
- Modify: `CHANGELOG.md`
- Modify: `v2/docs/IMPLEMENTATION-STATUS.md`
- Modify: `v2/docs/AGENT-HANDOFF.md`

**Interfaces:**
- Consumes all Slice 01 implementation and tests.
- Produces a clean, reviewable slice checkpoint with exact observed verification evidence.

- [ ] **Step 1: Restore and build the complete V2 solution**

From `v2/`:

```bash
dotnet restore Nexis.slnx
dotnet build Nexis.slnx -c Release --no-restore
```

Expected: Release build succeeds with zero warnings and zero errors.

- [ ] **Step 2: Run the complete architecture test executable**

```bash
dotnet test tests/Nexis.Architecture.Tests/Nexis.Architecture.Tests.csproj -c Release --no-build
```

Expected: zero failed tests.

- [ ] **Step 3: Run the persistence executable and classify evidence honestly**

```bash
dotnet test tests/Nexis.Persistence.Postgres.Tests/Nexis.Persistence.Postgres.Tests.csproj -c Release --no-build
```

If `NEXIS_TEST_POSTGRES_CONNECTION` is configured, require zero failures including `PostgresNpcLifecycleVerticalIntegrationTests`.

If it is absent, record the PostgreSQL tests as skipped/inconclusive and mark the database-backed Slice 01 release evidence as **BLOCKED on test-database availability**. Do not convert a skip into a pass claim.

- [ ] **Step 4: Re-run static repository integrity checks**

```bash
git diff --check
grep -RniE '\b(class|record|struct|interface)\s+(NpcState|LivingWorldState)\b' src tests || true
grep -Rni 'nexis_v2.npc_lifecycle_state' src
```

Expected:
- `git diff --check` emits no errors;
- no forbidden global state container is declared;
- the lifecycle table appears in the migration/schema registration context and the single approved PostgreSQL owner adapter, with no unrelated C# writer.

- [ ] **Step 5: Update implementation status and changelog with observed facts**

Record these implementation facts if verification confirms them:

```markdown
- implemented Slice 01 NPC lifecycle owner proof with stable NpcId, immutable UTC birth history, derived chronological age, trusted-System establishment, canonical recovery and PostgreSQL owner persistence
- no Population/materialisation, mortality/death transition, Social, Travel, Succession, Scheduler or CIEL gameplay behavior was added in this slice
```

For verification, copy the literal observed build/test totals from the terminal. If PostgreSQL was unavailable, state explicitly that those tests were skipped/inconclusive and database-backed evidence remains blocked. If PostgreSQL ran, state the literal passing totals and connection type only at a non-secret level such as "disposable/test PostgreSQL"; never record credentials.

- [ ] **Step 6: Review the slice against the approved design before commit**

Verify all of the following manually:

```text
NpcLifecycle owns only identity/lifecycle facts.
No age column exists.
No client route establishes NPCs.
No NpcId is used as TrustedActorContext authority.
No Population or provenance logic was smuggled into Slice 01.
Create transition is typed and owner-addressed.
PostgreSQL duplicate identity conflict rolls back History/outbox effects.
Lifecycle representation permits Dead without providing an unauthorized generic state setter.
```

- [ ] **Step 7: Commit the verified slice checkpoint**

```bash
git add CHANGELOG.md v2/docs/IMPLEMENTATION-STATUS.md v2/docs/AGENT-HANDOFF.md
git commit -m "docs(v2): record npc lifecycle slice verification"
```

Update `AGENT-HANDOFF.md` to identify the verified Slice 01 checkpoint, preserve the out-of-scope boundaries above, and name Slice 02 Population/materialisation as the next planned boundary.

- [ ] **Step 8: Confirm clean repository state and capture checkpoint hash**

```bash
git status --short --branch
git log -1 --oneline
```

Expected: no uncommitted Slice 01 changes. The resulting commit hash is the baseline for Slice 02 planning; it is not a production deployment claim.

---

## Slice 01 Acceptance Criteria

Slice 01 is complete only when all of these are true:

1. `NpcId` is a stable typed GUID identity and cannot be empty in authoritative lifecycle contracts.
2. `NpcLifecycleSnapshot` has one owner key, `NpcLifecycle`, and a monotonic revision.
3. UTC birth history is immutable in the creation path and no mutable age field exists.
4. Chronological age uses anniversary/`.AddYears(...)` semantics, including leap-day behavior.
5. The Core rule accepts only trusted System actor context, rejects future birth and rejects a known existing identity.
6. The creation transition is typed, targets only `NpcLifecycle`, and has no prior expected revision.
7. The canonical codec round-trips without CLR runtime-type metadata and rejects unknown/duplicate fields.
8. PostgreSQL stores exactly one row per `NpcId`, starting at revision 1 and `Living` status.
9. Same-CommandId retry does not duplicate NPC state, History or outbox.
10. A different command racing to create the same `NpcId` returns a concurrency conflict and leaves no second authoritative event/outbox entry.
11. Contracts remain infrastructure-neutral and Host API exposes no NPC-minting surface in this slice.
12. Existing architecture/global-state guards still pass and govern the new NPC contracts.
13. Full Release build and architecture tests have zero failures.
14. Database-backed verification is either genuinely passing against test PostgreSQL or explicitly recorded as blocked/inconclusive because the test database is absent.
15. Documentation and changelog describe only verified implementation, not future Population/mortality/Social/Succession capability.

## Out-of-Scope Protection

The following are intentionally absent from Slice 01 and must not be added while executing this plan:

- anonymous Population cohorts or conservation accounting;
- materialisation seed/provenance generation;
- species/ancestry lifecycle content;
- natural mortality probability or death-cause logic;
- `NpcDied` or resurrection commands;
- names, personality, biography or enrichment;
- Travel/current-location state;
- Social/family edges;
- Employment, role vacancies or Succession;
- Knowledge/belief state;
- Scheduler queues, cold/warm/hot simulation or CIEL integration;
- public API/UI exposure.

Those boundaries are not missing work in this slice. They are the mechanism that keeps the first owner proof reviewable, reversible and safe.
