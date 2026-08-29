using System.Reflection;
using System.Reflection.Metadata;
using System.Reflection.PortableExecutable;
using System.Text;
using System.Xml.Linq;
using Microsoft.VisualStudio.TestTools.UnitTesting;
using Nexis.Automation.Contracts;
using Nexis.Core;
using Nexis.Core.Contracts;
using Nexis.Execution;
using Nexis.Execution.Contracts;
using Nexis.Identity.Contracts;
using Nexis.Kernel.Commands;
using Nexis.Kernel.Events;
using Nexis.Kernel.Randomness;
using Nexis.Operations.Contracts;

namespace Nexis.Architecture.Tests;

/// <summary>
/// Independent adversarial tests produced by the Claude overnight review against integrator
/// checkpoint 6861c36 plus its uncommitted TM-05/TM-06 slice.
///
/// Tests named "MustXxx" assert a required Foundation invariant that the current implementation does
/// not yet uphold. They are expected to FAIL until the corresponding finding is fixed, and must be
/// made green by implementation, never by weakening an assertion.
///
/// Tests named "Guard"/"Remains"/"StillAccepts" are protective and are expected to PASS today. Losing
/// one of them would be a regression, so they must survive the remediation of the RED tests.
///
/// R-01, R-02 and R-03 are deliberately absent from this file: all three are behavioural properties
/// of PostgreSQL persistence and cannot be honestly asserted in-memory. Their acceptance criteria and
/// exact integration test specifications are in claude-foundation-overnight-review.md.
/// </summary>
[TestClass]
public sealed class ClaudeOvernightAdversarialTests
{
    // ---------------------------------------------------------------------------------------------
    // M2 - a failure terminal outcome must not carry owner transitions or authoritative events.
    // CoreDecision already enforces this for today's only construction path. CommandCommitPlan, which
    // is what the persistence boundary actually commits and what a replacement Core / future lane /
    // replay harness constructs, enforces nothing.
    // ---------------------------------------------------------------------------------------------

    [TestMethod]
    public void CommitPlan_MustRejectOwnerTransitionsForTechnicalFailure()
    {
        Assert.ThrowsExactly<ArgumentException>(
            () => CreatePlan(
                CommandTerminalStatus.TechnicalFailure,
                transitions: new IOwnerTransition[] { new NamedTransition("Economy", "tests.debit") },
                events: null),
            "A TechnicalFailure commit plan accepted owner transitions. COMMAND-EXECUTION.md requires "
            + "that a TechnicalFailure never masquerades as an in-world outcome and never consumes "
            + "resources; the committer will apply these transitions and then write the failure status.");
    }

    [TestMethod]
    public void CommitPlan_MustRejectOwnerTransitionsForRejectedOutcome()
    {
        Assert.ThrowsExactly<ArgumentException>(
            () => CreatePlan(
                CommandTerminalStatus.Rejected,
                transitions: new IOwnerTransition[] { new NamedTransition("Education", "tests.enrol") },
                events: null),
            "A Rejected commit plan accepted owner transitions. A rule rejection must commit no owner "
            + "state at all.");
    }

    [TestMethod]
    public void CommitPlan_MustRejectAuthoritativeEventsForConflictOutcome()
    {
        var correlationId = CorrelationId.New();

        Assert.ThrowsExactly<ArgumentException>(
            () => CreatePlan(
                CommandTerminalStatus.Conflict,
                transitions: null,
                events: new[] { CreateEventEnvelope(correlationId, "tests.conflict-event") },
                correlationId: correlationId),
            "A Conflict commit plan accepted authoritative events. A concurrency conflict produced no "
            + "committed fact, so it must emit no durable event and no outbox record.");
    }

    [TestMethod]
    public void CommitPlan_MustRejectTransitionsAndEventsForCancelledOutcome()
    {
        var correlationId = CorrelationId.New();

        Assert.ThrowsExactly<ArgumentException>(
            () => CreatePlan(
                CommandTerminalStatus.Cancelled,
                transitions: new IOwnerTransition[] { new NamedTransition("Resources", "tests.cancelled") },
                events: new[] { CreateEventEnvelope(correlationId, "tests.cancelled-event") },
                correlationId: correlationId),
            "A Cancelled commit plan accepted authoritative effects even though cancellation commits no in-world outcome.");
    }

    /// <summary>
    /// Protective. DomainFailed is the one non-success status that may legitimately carry transitions
    /// and events, because an in-world failure can be a committed game rule. Whatever guard closes the
    /// three RED tests above must not also close this one.
    /// </summary>
    [TestMethod]
    public void CommitPlan_StillAcceptsTransitionsAndEventsForDomainFailed()
    {
        var correlationId = CorrelationId.New();

        var plan = CreatePlan(
            CommandTerminalStatus.DomainFailed,
            transitions: new IOwnerTransition[] { new NamedTransition("Resources", "tests.spend") },
            events: new[] { CreateEventEnvelope(correlationId, "tests.domain-failed-event") },
            correlationId: correlationId);

        Assert.AreEqual(1, plan.Transitions.Count);
        Assert.AreEqual(1, plan.Events.Count);
    }

    // ---------------------------------------------------------------------------------------------
    // H1 - the within-one-owner half of canonical lock ordering.
    // TM-01 (ClaudeFoundationThreatModelTests) already covers two different owners. This covers the
    // half that owner-key sorting alone cannot satisfy: two contested resources inside one owner, for
    // example two wallets in one Economy transfer.
    // ---------------------------------------------------------------------------------------------

    [TestMethod]
    public void CommitPlan_MustOrderTwoResourcesOfOneOwnerDeterministically()
    {
        var alpha = new NamedTransition("Economy", "tests.economy.wallet-alpha");
        var beta = new NamedTransition("Economy", "tests.economy.wallet-beta");

        var forward = BuildPlan(CoreDecision.Succeeded(transitions: new IOwnerTransition[] { alpha, beta }));
        var reverse = BuildPlan(CoreDecision.Succeeded(transitions: new IOwnerTransition[] { beta, alpha }));

        CollectionAssert.AreEqual(
            forward.Transitions.Select(static transition => transition.Contract.Name).ToArray(),
            reverse.Transitions.Select(static transition => transition.Contract.Name).ToArray(),
            "Two transitions addressed to the SAME owner were applied in Core emission order. Sorting "
            + "by OwnerKey alone cannot separate them, so canonical lock ordering must be derived from "
            + "resolved AuthoritativeResourceKey values at the adapter boundary. Until it is, two "
            + "concurrent commands touching the same two resources of one owner can deadlock.");
    }

    // ---------------------------------------------------------------------------------------------
    // M3 - no public recovery contract may invent a SystemActorKey.
    // ---------------------------------------------------------------------------------------------

    [TestMethod]
    public void RecoveredCommand_MustNotSubstituteAGenericSystemActorIdentity()
    {
        var actorSubstitutingConstructor = typeof(RecoveredCommandExecution)
            .GetConstructors(BindingFlags.Public | BindingFlags.Instance)
            .SingleOrDefault(static constructor =>
            {
                var parameters = constructor.GetParameters();
                return parameters.Any(static parameter => parameter.ParameterType == typeof(CommandExecutionLane))
                    && parameters.All(static parameter => parameter.ParameterType != typeof(SystemActorKey));
            });

        Assert.IsNull(
            actorSubstitutingConstructor,
            "A public recovery contract can fabricate SystemActorKey.Platform for a System-lane command "
            + "that did not supply one. AutomationArchitectureTests already treats scheduler != CIEL != "
            + "platform as a security distinction; collapsing it during recovery is an attribution "
            + "hazard in exactly the area the directive names. The overload must be absent so no call "
            + "site can survive to fail inside a recovery path.");
    }

    [TestMethod]
    public void NoIdentityOrExecutionContractFactoryMayDefaultASystemActorKeyForTheSystemLane()
    {
        var contractAssemblies = new[]
        {
            typeof(RecoveredCommandExecution).Assembly,
            typeof(TrustedActorContext).Assembly
        };

        var offenders = contractAssemblies
            .SelectMany(static assembly => assembly.GetExportedTypes())
            .SelectMany(static type =>
                type.GetConstructors(BindingFlags.Public | BindingFlags.Instance).Cast<MethodBase>()
                    .Concat(type.GetMethods(BindingFlags.Public | BindingFlags.Static)
                        .Where(method => method.ReturnType == type)))
            .Where(static factory =>
            {
                var parameters = factory.GetParameters();
                var acceptsLane = parameters.Any(static parameter =>
                    parameter.ParameterType == typeof(CommandExecutionLane));
                var acceptsSystemActor = parameters.Any(static parameter =>
                    parameter.ParameterType == typeof(SystemActorKey));
                var createsSystem = factory.Name.Contains("Create", StringComparison.OrdinalIgnoreCase)
                    && factory.Name.Contains("System", StringComparison.OrdinalIgnoreCase);
                return (acceptsLane || createsSystem) && !acceptsSystemActor;
            })
            .Select(static factory =>
                $"{factory.DeclaringType?.FullName}.{factory.Name}({factory.GetParameters().Length} args)")
            .OrderBy(static description => description, StringComparer.Ordinal)
            .ToArray();

        Assert.AreEqual(
            0,
            offenders.Length,
            "A public Nexis.Identity.Contracts or Nexis.Execution.Contracts constructor/static "
            + "factory can create System-lane authority without requiring the actor key: "
            + string.Join(", ", offenders)
            + ". Any such convenience overload can only supply the missing identity by inventing one.");
    }

    // ---------------------------------------------------------------------------------------------
    // M5 - Core rule evaluation must not read actor capabilities, entitlements or security version.
    // Those facts are deliberately NOT retained by replay artifacts (EquipItemReplayScenarioCodec
    // reconstructs securityVersion 0 and an empty capability set, for privacy). A Core rule reading
    // them would compile, pass every existing test, and make the replay corpus report an unexplained
    // semantic divergence whose real cause is that the INPUTS differed, not the Core.
    // ---------------------------------------------------------------------------------------------

    [TestMethod]
    public void NoCoreRuleReadsActorCapabilitiesEntitlementsOrSecurityVersion()
    {
        var findings = FindTrustedActorAuthorityReads(typeof(CoreAssemblyMarker).Assembly);

        Assert.AreEqual(
            0,
            findings.Count,
            "Nexis.Core reads platform authority facts from TrustedActorContext: "
            + string.Join(", ", findings)
            + ". Platform authority is decided by IPlatformAuthorizationPolicy from a freshly loaded "
            + "IdentitySecuritySnapshot BEFORE Core; reaching it from a rule reintroduces stale-claim "
            + "authorization and breaks replay determinism.");
    }

    /// <summary>
    /// Negative control for the guard above. Without this, the member scan could silently stop
    /// matching (renamed property, changed metadata shape) and the M5 guard would pass vacuously in
    /// exactly the way L4 currently does.
    /// </summary>
    [TestMethod]
    public void TrustedActorAuthorityMemberScan_ActuallyDetectsAReadWhenOneExists()
    {
        var actor = TrustedActorContext.CreatePlayer(AccountId.New(), CharacterId.New(), 1);

        // Deliberate reads, in this test assembly only, so the scanner has something to find.
        var observed = actor.Capabilities.Count + actor.Entitlements.Count + (int)(actor.SecurityVersion ?? 0);
        Assert.IsTrue(observed >= 0);

        var findings = FindTrustedActorAuthorityReads(typeof(ClaudeOvernightAdversarialTests).Assembly);

        Assert.IsTrue(
            findings.Count > 0,
            "The TrustedActorContext authority member scan found nothing in an assembly that "
            + "provably reads Capabilities, Entitlements and SecurityVersion. The M5 guard is "
            + "therefore vacuous and must be repaired before it is trusted.");
    }

    // ---------------------------------------------------------------------------------------------
    // M6 - SystemActorKey values must be drawn from a closed server-configured registry, enforced at
    // the automation gateway before any command identity is established.
    // ---------------------------------------------------------------------------------------------

    [TestMethod]
    public void AServerSideSystemActorRegistryMustExistBeforeTheAutomationGatewayIsImplemented()
    {
        var registryShaped = typeof(IAutomatedCommandGateway).Assembly
            .GetExportedTypes()
            .Where(static type => type.IsInterface)
            .SelectMany(static type => type.GetMethods())
            .Any(static method =>
            {
                var parameters = method.GetParameters();
                return method.ReturnType == typeof(bool)
                    && parameters.Length == 1
                    && parameters[0].ParameterType == typeof(SystemActorKey);
            });

        Assert.IsTrue(
            registryShaped,
            "Nexis.Automation.Contracts exposes no closed-set resolution for SystemActorKey. "
            + "new SystemActorKey(\"anything\") succeeds for any non-blank value, AutomatedCommandRequest "
            + "accepts it unvalidated, and that value becomes the durable command_receipts.actor_system_key "
            + "record of who acted. This is a readiness gap rather than a live exploit only because "
            + "IAutomatedCommandGateway has no implementation yet, which is precisely why it should be "
            + "closed before the first caller exists.");
    }

    /// <summary>
    /// Protective compatibility guard for the registry work above. Validation belongs at the ingress
    /// boundary, never inside the SystemActorKey constructor: recovery and replay must still be able
    /// to represent a historically valid but since-retired automated authority.
    /// </summary>
    [TestMethod]
    public void RetiredSystemActorKey_RemainsConstructableForRecoveryAndReplay()
    {
        var retired = new SystemActorKey("nexis.retired-authority");

        Assert.AreEqual("nexis.retired-authority", retired.Value);
        Assert.AreNotEqual(SystemActorKey.Platform, retired);
    }

    // ---------------------------------------------------------------------------------------------
    // M4 - CommandId integrity violations must be durably signalled, with their own condition kind.
    // The durable emission itself is PostgreSQL-backed; the contract shape it needs is not.
    // ---------------------------------------------------------------------------------------------

    [TestMethod]
    public void CommandIdentityIntegrityViolations_MustHaveTheirOwnOperationalConditionKind()
    {
        var kinds = Enum.GetNames<OperationalConditionKind>();

        Assert.IsTrue(
            kinds.Any(static name => name.Contains("Integrity", StringComparison.Ordinal)),
            "OperationalConditionKind has no member for a CommandId integrity violation, so the single "
            + "highest-signal security event the command lane can observe - one actor replaying "
            + "another's CommandId, or a client mutating a payload under a reused CommandId - can only "
            + "be reported by borrowing an unrelated condition kind. COMMAND-EXECUTION.md requires this "
            + "case to 'reject and record integrity/security signal'; today "
            + "PostgresCommandReceiptRepository returns the disposition and writes nothing at all.");
    }

    // ---------------------------------------------------------------------------------------------
    // L4 - the automation bypass guard currently asserts over an empty set.
    // ---------------------------------------------------------------------------------------------

    [TestMethod]
    public void AutomationBypassGuard_MustRejectAnUnlistedProjectRegardlessOfItsName()
    {
        var bypasses = AutomationArchitectureTests.FindMutationBypasses(new[]
        {
            (Project: "Nexis.Workers", Reference: "Nexis.Execution")
        });

        CollectionAssert.AreEqual(
            new[] { "Nexis.Workers->Nexis.Execution" },
            bypasses,
            "The allowlist guard must reject an arbitrary future automated project without relying on its prefix.");
    }

    // ---------------------------------------------------------------------------------------------
    // Helpers
    // ---------------------------------------------------------------------------------------------

    private static IReadOnlyList<string> FindTrustedActorAuthorityReads(Assembly assembly)
    {
        var forbiddenMembers = new[]
        {
            "get_Capabilities",
            "get_Entitlements",
            "get_SecurityVersion",
            "HasCapability",
            "HasEntitlement"
        };

        var location = assembly.Location;
        if (string.IsNullOrWhiteSpace(location) || !File.Exists(location))
        {
            Assert.Inconclusive($"Could not locate the on-disk assembly for '{assembly.GetName().Name}'.");
        }

        var findings = new List<string>();

        using var stream = File.OpenRead(location);
        using var peReader = new PEReader(stream);
        var reader = peReader.GetMetadataReader();

        foreach (var handle in reader.MemberReferences)
        {
            var memberReference = reader.GetMemberReference(handle);
            var memberName = reader.GetString(memberReference.Name);

            if (!forbiddenMembers.Contains(memberName, StringComparer.Ordinal))
            {
                continue;
            }

            if (memberReference.Parent.Kind != HandleKind.TypeReference)
            {
                continue;
            }

            var typeReference = reader.GetTypeReference((TypeReferenceHandle)memberReference.Parent);
            var typeName = reader.GetString(typeReference.Name);

            if (string.Equals(typeName, nameof(TrustedActorContext), StringComparison.Ordinal))
            {
                findings.Add($"{typeName}.{memberName}");
            }
        }

        return findings;
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

    private static CommandCommitPlan CreatePlan(
        CommandTerminalStatus status,
        IEnumerable<IOwnerTransition>? transitions,
        IEnumerable<AuthoritativeEventEnvelope>? events,
        CorrelationId? correlationId = null)
    {
        var resolvedCorrelationId = correlationId ?? CorrelationId.New();

        var trace = new CommandExecutionTrace(
            CommandExecutionIdentityFactory.Create(
                CreateRequest(),
                CommandPayloadFingerprint.Compute(Encoding.UTF8.GetBytes("payload"))),
            resolvedCorrelationId,
            CoreImplementation,
            CoreContractVersion.V1,
            new RuleVersion("tests.rules.v1"),
            new ContentVersion("tests.content.v1"),
            Utc(10, 0));

        var outcome = CommandTerminalOutcome.Failed(
            status,
            new CommandReasonCode("tests.reason"),
            Utc(11, 0));

        return new CommandCommitPlan(
            trace,
            CommandExecutionToken.New(),
            outcome,
            transitions,
            events);
    }

    private static AuthoritativeEventEnvelope CreateEventEnvelope(CorrelationId correlationId, string contractName) =>
        new(
            new EventMetadata(EventId.New(), Utc(10, 0), correlationId, null, 1),
            new NamedEvent(contractName));

    private static CommandCommitPlan BuildPlan(CoreDecision decision) =>
        new CommandCommitPlanBuilder().Build(
            CreateRequest(),
            CommandPayloadFingerprint.Compute(Encoding.UTF8.GetBytes("payload")),
            CommandReceiptClaim.Acquired(CorrelationId.New(), CommandExecutionToken.New()),
            decision,
            CoreImplementation,
            Utc(11, 0));

    private static CoreImplementationDescriptor CoreImplementation { get; } =
        new("Test.Core", "1.0.0-test", CoreContractVersion.V1);

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
        new(2026, 8, 29, hour, minute, 0, TimeSpan.Zero);

    private sealed record StubIntent : ICoreIntent
    {
        public ContractDescriptor Contract { get; } = new("tests.overnight-adversarial", 1);
    }

    private sealed record NamedTransition : IOwnerTransition
    {
        public NamedTransition(string owner, string contractName)
        {
            TargetOwner = new OwnerKey(owner);
            Contract = new ContractDescriptor(contractName, 1);
        }

        public ContractDescriptor Contract { get; }

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

    private sealed class StubRandomFactory : IDeterministicRandomFactory
    {
        public IDeterministicRandomSource Create() => new StubRandomSource();

        private sealed class StubRandomSource : IDeterministicRandomSource
        {
            public ulong NextUInt64() => 1;
        }
    }
}
