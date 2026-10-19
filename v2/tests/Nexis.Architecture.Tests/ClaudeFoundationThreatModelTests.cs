using System.Text;
using Microsoft.VisualStudio.TestTools.UnitTesting;
using Nexis.Audit.Contracts;
using Nexis.Core.Contracts;
using Nexis.Eventing.Contracts;
using Nexis.Execution;
using Nexis.Execution.Contracts;
using Nexis.History.Contracts;
using Nexis.History.Projection;
using Nexis.Identity.Contracts;
using Nexis.Kernel.Commands;
using Nexis.Kernel.Events;
using Nexis.Kernel.Randomness;

namespace Nexis.Architecture.Tests;

/// <summary>
/// Independent adversarial RED tests produced by the L3 Foundation threat model against integrator
/// checkpoint 58f40f4. Each test asserts a required Foundation invariant that the current
/// implementation does not yet uphold. They are expected to FAIL until the corresponding finding is
/// fixed by the Foundation integrator, and must not be weakened to make them pass.
/// </summary>
[TestClass]
public sealed class ClaudeFoundationThreatModelTests
{
    /// <summary>
    /// FINDING TM-01 (High, deadlock/lock-order).
    /// CanonicalResourceLockOrder documents "persistence adapters must acquire locks in this order",
    /// but CommandCommitPlanBuilder forwards CoreDecision.Transitions verbatim and
    /// PostgresAtomicCommandCommitter applies them in that order. Two concurrent multi-owner commands
    /// whose Core emitted transitions in opposite owner order therefore take row locks in opposite
    /// order, which is a textbook ABBA deadlock.
    /// Required invariant: a commit plan must expose transitions in one deterministic owner order
    /// regardless of the order Core emitted them.
    /// </summary>
    [TestMethod]
    public void CommitPlan_MustOrderTransitionsDeterministicallyRegardlessOfCoreEmissionOrder()
    {
        var economy = new NamedTransition("Economy");
        var inventory = new NamedTransition("Inventory");

        var forward = BuildPlan(CoreDecision.Succeeded(transitions: new IOwnerTransition[] { economy, inventory }));
        var reverse = BuildPlan(CoreDecision.Succeeded(transitions: new IOwnerTransition[] { inventory, economy }));

        CollectionAssert.AreEqual(
            forward.Transitions.Select(static transition => transition.TargetOwner.Value).ToArray(),
            reverse.Transitions.Select(static transition => transition.TargetOwner.Value).ToArray(),
            "Commit plans built from the same transitions in opposite order must apply them in one "
            + "canonical lock order, otherwise concurrent multi-owner commands can deadlock.");
    }

    /// <summary>
    /// FINDING TM-02 (Medium, event order ambiguity).
    /// Every event in one command is stamped with the identical Context.EvaluationTimeUtc and a null
    /// CausationId, and nexis_v2.authoritative_events has no monotonic sequence column. A multi-event
    /// command therefore has no recoverable intra-command order for replay or Player Log rendering.
    /// Required invariant: two events committed by one command must be totally orderable.
    /// </summary>
    [TestMethod]
    public void MultiEventCommand_MustExposeARecoverableTotalOrderForItsEvents()
    {
        var plan = BuildPlan(CoreDecision.Succeeded(events: new ICoreEventDescriptor[]
        {
            new NamedEvent("tests.first"),
            new NamedEvent("tests.second")
        }));

        Assert.AreEqual(2, plan.Events.Count);
        var first = plan.Events[0].Metadata;
        var second = plan.Events[1].Metadata;

        Assert.IsFalse(
            first.OccurredAtUtc == second.OccurredAtUtc && first.CausationId is null && second.CausationId is null,
            "Events committed by one command carry identical timestamps and no causation chain, so their "
            + "authoritative order cannot be reconstructed from history.");
    }

    /// <summary>
    /// FINDING TM-03 (Medium, poison projection / write-read validation asymmetry).
    /// AuditEntry.SafePlayerReason is unbounded free text, but SafeAdminAuditPlayerLogProjector feeds it
    /// straight into PlayerLogPlainText which rejects anything over 512 characters. A durable, immutable
    /// audit row can therefore be written that permanently throws on every projection attempt.
    /// Required invariant: the audit write boundary must reject text the Player Log boundary cannot
    /// project, so a committed audit row can never poison the projection.
    /// </summary>
    [TestMethod]
    public void PlayerDisclosableAuditReason_MustBeRejectedAtWriteTimeIfPlayerLogCannotProjectIt()
    {
        var overlongReason = new string('a', 600);

        var accepted = true;
        try
        {
            _ = new AuditEntry(
                AuditId.New(),
                AccountId.New(),
                AccountId.New(),
                AuditActionKind.Correction,
                AuditVisibility.PlayerMaterialEffect,
                Utc(10, 0),
                "tests.action",
                "tests.outcome",
                overlongReason,
                null,
                CorrelationId.New(),
                null);
        }
        catch (ArgumentException)
        {
            accepted = false;
        }

        Assert.IsFalse(
            accepted,
            "AuditEntry accepted a player-disclosable reason longer than the Player Log plain-text bound; "
            + "that row is durable and immutable and will throw on every projection attempt.");
    }

    /// <summary>
    /// FINDING TM-04 (Medium, silent player-history loss).
    /// PlayerLogProjectionRegistry keys on the full ContractDescriptor (name AND schema version) and
    /// returns an empty projection for anything unregistered. Bumping a registered event contract's
    /// schema version therefore silently stops producing player history instead of failing loudly, and
    /// no observability surface reports the drop.
    /// Required invariant: an event whose contract NAME has a registered projector but whose schema
    /// version is unknown must be treated as a misconfiguration, not as a deliberately internal event.
    /// </summary>
    [TestMethod]
    public void KnownEventContractWithUnknownSchemaVersion_MustNotSilentlyVanishFromPlayerLog()
    {
        var registry = new PlayerLogProjectionRegistry(new IPlayerLogEventProjector[]
        {
            new StubProjector(new ContractDescriptor("tests.schema-bump", 1))
        });

        var bumped = new CommittedEventMessage(
            EventId.New(),
            CommandId.New(),
            CorrelationId.New(),
            Utc(10, 0),
            new ContractDescriptor("tests.schema-bump", 2),
            "{}");

        Assert.ThrowsExactly<InvalidOperationException>(
            () => registry.Project(bumped),
            "A registered event contract that bumped schema version silently produced zero Player Log "
            + "entries instead of surfacing the missing projector as a misconfiguration.");
    }

    private static CommandCommitPlan BuildPlan(CoreDecision decision) =>
        new CommandCommitPlanBuilder().Build(
            CreateRequest(),
            CommandPayloadFingerprint.Compute(Encoding.UTF8.GetBytes("payload")),
            CommandReceiptClaim.Acquired(CorrelationId.New(), CommandExecutionToken.New()),
            decision,
            new CoreImplementationDescriptor("Test.Core", "1.0.0-test", CoreContractVersion.V1),
            Utc(11, 0));

    private static CoreEvaluationRequest CreateRequest() =>
        new(
            CoreContractVersion.V1,
            new CoreEvaluationContext(
                CommandId.New(),
                CorrelationId.New(),
                TrustedActorContext.CreatePlayer(AccountId.New(), CharacterId.New(), 1),
                Utc(10, 0),
                new RuleVersion("tests.rules.v1"),
                new ContentVersion("tests.content.v1"),
                new StubRandomFactory()),
            new StubIntent(),
            Array.Empty<IAuthoritativeSnapshot>());

    private static DateTimeOffset Utc(int hour, int minute) =>
        new(2026, 8, 28, hour, minute, 0, TimeSpan.Zero);

    private sealed record StubIntent : ICoreIntent
    {
        public ContractDescriptor Contract { get; } = new("tests.threat-model", 1);
    }

    private sealed record NamedTransition : IOwnerTransition
    {
        public NamedTransition(string owner)
        {
            TargetOwner = new OwnerKey(owner);
        }

        public ContractDescriptor Contract { get; } = new("tests.transition", 1);

        public OwnerKey TargetOwner { get; }

        public long? ExpectedRevision => 1;
    }

    private sealed record NamedEvent : ICoreEventDescriptor
    {
        public NamedEvent(string name)
        {
            Contract = new ContractDescriptor(name, 1);
        }

        public ContractDescriptor Contract { get; }
    }

    private sealed class StubProjector : IPlayerLogEventProjector
    {
        public StubProjector(ContractDescriptor contract)
        {
            SourceContract = contract;
        }

        public ContractDescriptor SourceContract { get; }

        public IReadOnlyList<PlayerLogEntry> Project(CommittedEventMessage message) =>
            Array.Empty<PlayerLogEntry>();
    }

    private sealed class StubRandomFactory : IDeterministicRandomFactory
    {
        public IDeterministicRandomSource Create() => new StubRandomSource();

        private sealed class StubRandomSource : IDeterministicRandomSource
        {
            public ulong NextUInt64() => 1;
        }
    }
}
