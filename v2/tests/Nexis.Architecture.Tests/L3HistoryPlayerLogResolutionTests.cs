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
/// Root-cause coverage for the three L3 History/Player Log findings, beyond the original RED
/// assertions in <see cref="ClaudeFoundationThreatModelTests"/>.
/// </summary>
[TestClass]
public sealed class L3HistoryPlayerLogResolutionTests
{
    // ---- TM-02: durable recoverable intra-command event order -------------------------------

    [TestMethod]
    public void MultiEventCommand_AssignsAContiguousZeroBasedSequenceInCoreEmissionOrder()
    {
        var plan = BuildPlan(CoreDecision.Succeeded(events: new ICoreEventDescriptor[]
        {
            new NamedEvent("tests.first"),
            new NamedEvent("tests.second"),
            new NamedEvent("tests.third")
        }));

        CollectionAssert.AreEqual(
            new[] { 0, 1, 2 },
            plan.Events.Select(static envelope => envelope.Metadata.IntraCommandSequence).ToArray());

        CollectionAssert.AreEqual(
            new[] { "tests.first", "tests.second", "tests.third" },
            plan.Events.Select(static envelope => envelope.Descriptor.Contract.Name).ToArray(),
            "The sequence must follow Core's emission order, which is the authoritative semantic order.");
    }

    [TestMethod]
    public void MultiEventCommand_ChainsCausationSoTheOrderIsExplicitInHistory()
    {
        var plan = BuildPlan(CoreDecision.Succeeded(events: new ICoreEventDescriptor[]
        {
            new NamedEvent("tests.first"),
            new NamedEvent("tests.second"),
            new NamedEvent("tests.third")
        }));

        Assert.IsNull(plan.Events[0].Metadata.CausationId, "The first event of a command has no predecessor.");
        Assert.AreEqual(plan.Events[0].Metadata.EventId, plan.Events[1].Metadata.CausationId);
        Assert.AreEqual(plan.Events[1].Metadata.EventId, plan.Events[2].Metadata.CausationId);

        // The chain is a real total order, not an artefact of equal timestamps.
        Assert.AreEqual(plan.Events[0].Metadata.OccurredAtUtc, plan.Events[2].Metadata.OccurredAtUtc);
    }

    [TestMethod]
    public void IntraCommandOrder_DoesNotDependOnTimestampsOrListIdentity()
    {
        var plan = BuildPlan(CoreDecision.Succeeded(events: new ICoreEventDescriptor[]
        {
            new NamedEvent("tests.alpha"),
            new NamedEvent("tests.beta")
        }));

        // Reversed so list order is actively wrong, the events still sort back into the
        // authoritative order using only durable metadata.
        var recovered = plan.Events
            .Reverse()
            .OrderBy(static envelope => envelope.Metadata.IntraCommandSequence)
            .Select(static envelope => envelope.Descriptor.Contract.Name)
            .ToArray();

        CollectionAssert.AreEqual(new[] { "tests.alpha", "tests.beta" }, recovered);
    }

    [TestMethod]
    public void EventMetadata_RejectsANegativeIntraCommandSequence()
    {
        Assert.ThrowsExactly<ArgumentOutOfRangeException>(() => new EventMetadata(
            EventId.New(), Utc(10, 0), CorrelationId.New(), null, 1, -1));

        Assert.ThrowsExactly<ArgumentOutOfRangeException>(() => new CommittedEventMessage(
            EventId.New(),
            CommandId.New(),
            CorrelationId.New(),
            Utc(10, 0),
            new ContractDescriptor("tests.event", 1),
            "{}",
            -1));
    }

    [TestMethod]
    public void SingleEventCommand_StillCarriesAWellDefinedSequence()
    {
        var plan = BuildPlan(CoreDecision.Succeeded(events: new ICoreEventDescriptor[] { new NamedEvent("tests.only") }));

        Assert.AreEqual(1, plan.Events.Count);
        Assert.AreEqual(0, plan.Events[0].Metadata.IntraCommandSequence);
        Assert.IsNull(plan.Events[0].Metadata.CausationId);
    }

    // ---- TM-03: player-disclosable audit reason write boundary -------------------------------

    [TestMethod]
    public void AuditReason_AcceptsExactlyTheBoundAndRejectsOneCharacterMore()
    {
        var bound = PlayerDisclosableAuditText.MaximumLength;

        // The audit bound is only meaningful if the Player Log boundary genuinely accepts exactly
        // that much and no more, so both directions are probed behaviourally rather than compared
        // against a hard-coded literal.
        Assert.AreEqual(bound, new PlayerLogPlainText(new string('a', bound)).Value.Length);
        Assert.ThrowsExactly<ArgumentOutOfRangeException>(
            () => new PlayerLogPlainText(new string('a', bound + 1)));

        var atBound = new string('a', bound);
        var entry = CreateAudit(atBound);
        Assert.AreEqual(bound, entry.SafePlayerReason!.Length);

        // And the Player Log boundary genuinely accepts what the write boundary accepted.
        Assert.AreEqual(bound, new PlayerLogPlainText(entry.SafePlayerReason).Value.Length);

        Assert.ThrowsExactly<ArgumentOutOfRangeException>(() => CreateAudit(new string('a', bound + 1)));
    }

    [TestMethod]
    public void AuditReason_IsRejectedRatherThanSilentlyTruncated()
    {
        var overlong = new string('a', 600);

        Assert.ThrowsExactly<ArgumentOutOfRangeException>(() => CreateAudit(overlong));

        // Nothing anywhere quietly shortened it into an acceptable value.
        var accepted = CreateAudit(new string('a', 511));
        Assert.AreEqual(511, accepted.SafePlayerReason!.Length);
    }

    [TestMethod]
    public void AuditReason_AgreesExactlyWithThePlayerLogBoundaryOnAdversarialInput()
    {
        // Audit.Contracts cannot reference History.Contracts without a dependency cycle, so the two
        // boundaries restate the same rules. This pins them to the same decision on every input that
        // could plausibly differ: length, control characters, collapsing whitespace and values that
        // normalize away entirely.
        var inputs = new[]
        {
            "ordinary reason",
            "  leading and trailing  ",
            "collapse    the    runs",
            "control" + (char)7 + "characters" + (char)1 + "here",
            "tabs" + (char)9 + "and" + (char)10 + "newlines",
            new string('a', 511),
            new string('a', 512),
            new string('a', 513),
            new string('a', 600),
            new string(' ', 40) + "padded" + new string(' ', 40)
        };

        foreach (var input in inputs)
        {
            string? auditResult = null;
            Exception? auditFailure = null;
            try
            {
                auditResult = CreateAudit(input).SafePlayerReason;
            }
            catch (Exception exception)
            {
                auditFailure = exception;
            }

            string? playerLogResult = null;
            Exception? playerLogFailure = null;
            try
            {
                playerLogResult = new PlayerLogPlainText(input).Value;
            }
            catch (Exception exception)
            {
                playerLogFailure = exception;
            }

            Assert.AreEqual(
                auditFailure is null,
                playerLogFailure is null,
                $"Audit and Player Log disagree on whether '{Describe(input)}' is acceptable.");

            if (auditFailure is null)
            {
                Assert.AreEqual(playerLogResult, auditResult, $"Normalized values differ for '{Describe(input)}'.");
            }
            else
            {
                Assert.AreEqual(
                    playerLogFailure!.GetType(),
                    auditFailure.GetType(),
                    $"Rejection kinds differ for '{Describe(input)}'.");
            }
        }
    }

    [TestMethod]
    public void AcceptedAuditReason_AlwaysProjectsWithoutThrowing()
    {
        var projector = new SafeAdminAuditPlayerLogProjector();

        foreach (var length in new[] { 1, 2, 100, 511, 512 })
        {
            var entry = CreateAudit(new string('a', length));

            var entries = projector.Project(entry);

            Assert.AreEqual(1, entries.Count, $"A committed reason of length {length} must remain projectable forever.");
        }
    }

    [TestMethod]
    public void AuditReason_RemainsOptionalAndAnAbsentReasonIsNeverDisclosed()
    {
        // Whitespace-only means "no reason supplied", which is the one input where the two
        // boundaries deliberately differ: Audit stores absence, while PlayerLogPlainText is simply
        // never constructed for an absent reason. That is not a poisoning risk, because the
        // projector refuses to disclose a player-material entry that has no reason at all.
        Assert.IsNull(CreateAudit(null).SafePlayerReason);
        Assert.IsNull(CreateAudit("   ").SafePlayerReason);

        var withoutReason = CreateAudit(null);
        Assert.ThrowsExactly<InvalidOperationException>(
            () => new SafeAdminAuditPlayerLogProjector().Project(withoutReason));
    }

    // ---- TM-04: unregistered internal event versus unsupported schema version -----------------

    [TestMethod]
    public void UnregisteredContractName_RemainsDeliberatelyInternalAndInvisible()
    {
        var registry = new PlayerLogProjectionRegistry(new IPlayerLogEventProjector[]
        {
            new StubPlayerLogProjector(new ContractDescriptor("tests.projected", 1))
        });

        var internalEvent = Message(new ContractDescriptor("tests.internal-only", 1));

        Assert.AreEqual(
            0,
            registry.Project(internalEvent).Count,
            "An event nobody registered is deliberately internal and must stay invisible, not throw.");
    }

    [TestMethod]
    public void KnownContractNameWithUnknownSchemaVersion_FailsLoudlyAndDiagnostically()
    {
        var registry = new PlayerLogProjectionRegistry(new IPlayerLogEventProjector[]
        {
            new StubPlayerLogProjector(new ContractDescriptor("tests.projected", 1))
        });

        foreach (var unknownVersion in new[] { 2, 7, 99 })
        {
            var failure = Assert.ThrowsExactly<InvalidOperationException>(
                () => registry.Project(Message(new ContractDescriptor("tests.projected", unknownVersion))));

            StringAssert.Contains(failure.Message, "tests.projected");
            StringAssert.Contains(failure.Message, unknownVersion.ToString());
        }
    }

    [TestMethod]
    public void MultipleRegisteredVersionsOfOneContract_BothProjectAndOnlyTheGapFails()
    {
        var registry = new PlayerLogProjectionRegistry(new IPlayerLogEventProjector[]
        {
            new StubPlayerLogProjector(new ContractDescriptor("tests.projected", 1)),
            new StubPlayerLogProjector(new ContractDescriptor("tests.projected", 3))
        });

        Assert.AreEqual(1, registry.Project(Message(new ContractDescriptor("tests.projected", 1))).Count);
        Assert.AreEqual(1, registry.Project(Message(new ContractDescriptor("tests.projected", 3))).Count);

        Assert.ThrowsExactly<InvalidOperationException>(
            () => registry.Project(Message(new ContractDescriptor("tests.projected", 2))));
    }

    [TestMethod]
    public void LoudFailure_DoesNotExposeUnrelatedInternalEventNames()
    {
        var registry = new PlayerLogProjectionRegistry(new IPlayerLogEventProjector[]
        {
            new StubPlayerLogProjector(new ContractDescriptor("tests.projected", 1)),
            new StubPlayerLogProjector(new ContractDescriptor("tests.secret-internal-audit", 1))
        });

        var failure = Assert.ThrowsExactly<InvalidOperationException>(
            () => registry.Project(Message(new ContractDescriptor("tests.projected", 2))));

        Assert.IsFalse(
            failure.Message.Contains("secret-internal-audit", StringComparison.Ordinal),
            "A misconfiguration diagnostic must not enumerate the rest of the registry.");
    }

    [TestMethod]
    public void MalformedPayloadBehaviourRemainsFailClosed()
    {
        var registry = new PlayerLogProjectionRegistry(new IPlayerLogEventProjector[]
        {
            new ThrowingPlayerLogProjector(new ContractDescriptor("tests.projected", 1))
        });

        // A registered projector that cannot read its payload still fails rather than silently
        // producing an empty player history.
        Assert.ThrowsExactly<FormatException>(
            () => registry.Project(Message(new ContractDescriptor("tests.projected", 1))));
    }

    // ---- helpers ------------------------------------------------------------------------------

    private static string Describe(string value) =>
        value.Length > 24 ? $"<{value.Length} chars>" : value.Replace(' ', '?');

    private static CommittedEventMessage Message(ContractDescriptor contract) =>
        new(EventId.New(), CommandId.New(), CorrelationId.New(), Utc(10, 0), contract, "{}");

    private static AuditEntry CreateAudit(string? reason) =>
        new(
            AuditId.New(),
            AccountId.New(),
            AccountId.New(),
            AuditActionKind.Correction,
            AuditVisibility.PlayerMaterialEffect,
            Utc(10, 0),
            "tests.action",
            "tests.outcome",
            reason,
            null,
            CorrelationId.New(),
            null);

    private static DateTimeOffset Utc(int hour, int minute) => new(2026, 9, 1, hour, minute, 0, TimeSpan.Zero);

    private static CommandCommitPlan BuildPlan(CoreDecision decision)
    {
        var request = new CoreEvaluationRequest(
            CoreContractVersion.V1,
            new CoreEvaluationContext(
                CommandId.New(),
                CorrelationId.New(),
                TrustedActorContext.CreatePlayer(AccountId.New(), CharacterId.New(), 1),
                Utc(10, 0),
                new RuleVersion("l3-rules-v1"),
                new ContentVersion("l3-content-v1"),
                new FixedRandomFactory()),
            new NamedIntent(),
            Array.Empty<IAuthoritativeSnapshot>());

        return new CommandCommitPlanBuilder().Build(
            request,
            CommandPayloadFingerprint.Compute(System.Text.Encoding.UTF8.GetBytes("l3-payload")),
            CommandReceiptClaim.Acquired(request.Context.CorrelationId, CommandExecutionToken.New()),
            decision,
            new CoreImplementationDescriptor("tests.core", "0.0.1", CoreContractVersion.V1),
            Utc(10, 1));
    }

    private sealed record NamedIntent : ICoreIntent
    {
        public ContractDescriptor Contract { get; } = new("tests.intent", 1);
    }

    private sealed record NamedEvent(string Name) : ICoreEventDescriptor
    {
        public ContractDescriptor Contract => new(Name, 1);
    }

    private sealed class StubPlayerLogProjector : IPlayerLogEventProjector
    {
        public StubPlayerLogProjector(ContractDescriptor contract) => SourceContract = contract;

        public ContractDescriptor SourceContract { get; }

        public IReadOnlyList<PlayerLogEntry> Project(CommittedEventMessage message) =>
            new[]
            {
                new PlayerLogEntry(
                    PlayerLogAudience.ForAccount(AccountId.New()),
                    PlayerLogSource.FromEvent(message.EventId),
                    message.CorrelationId,
                    message.OccurredAtUtc,
                    new PlayerLogCategoryKey("tests"),
                    new PlayerLogTemplateKey("tests.entry"))
            };
    }

    private sealed class ThrowingPlayerLogProjector : IPlayerLogEventProjector
    {
        public ThrowingPlayerLogProjector(ContractDescriptor contract) => SourceContract = contract;

        public ContractDescriptor SourceContract { get; }

        public IReadOnlyList<PlayerLogEntry> Project(CommittedEventMessage message) =>
            throw new FormatException("Malformed payload.");
    }

    private sealed class FixedRandomFactory : IDeterministicRandomFactory
    {
        public IDeterministicRandomSource Create() => new FixedRandomSource();

        private sealed class FixedRandomSource : IDeterministicRandomSource
        {
            public ulong NextUInt64() => 1;
        }
    }
}
