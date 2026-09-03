using System.Security.Cryptography;
using System.Text;
using System.Text.Json.Nodes;
using Microsoft.VisualStudio.TestTools.UnitTesting;
using Nexis.Combat.Contracts;
using Nexis.Content.Contracts;
using Nexis.Core;
using Nexis.Core.Contracts;
using Nexis.Equipment.Contracts;
using Nexis.Execution;
using Nexis.Execution.Contracts;
using Nexis.History.Replay;
using Nexis.Identity.Contracts;
using Nexis.Inventory.Contracts;
using Nexis.Items.Contracts;
using Nexis.Kernel.Commands;
using Nexis.Kernel.Events;
using Nexis.Kernel.Randomness;
using Nexis.Modules.Equipment;
using Nexis.Operations.Contracts;

namespace Nexis.Architecture.Tests;

/// <summary>
/// Producer coverage for the operational conditions wired by the C5 slice that can be proven without
/// a database: bounded-retry exhaustion, execution plan-integrity violations, and the replay
/// boundary's deliberate split between an artifact the corpus declines and evidence that has been
/// damaged. The PostgreSQL projection-failure and unexpected-concurrency producers need a real
/// transaction to fail inside and are covered in the integration project.
///
/// Every case asserts the same three properties: the right condition kind, no second signal for one
/// logical failure, and that a sink which throws cannot change what the caller observes.
/// </summary>
[TestClass]
public sealed class ClaudeC5OperationalProducerTests
{
    private static readonly DateTimeOffset SignalTime = new(2026, 9, 3, 12, 0, 0, TimeSpan.Zero);

    // ---------------------------------------------------------------------------------------
    // Bounded retry exhaustion
    // ---------------------------------------------------------------------------------------

    [TestMethod]
    public async Task RetryExhaustion_ReportsExactlyOneSignalCarryingTheSpentAttemptCount()
    {
        var harness = new RetryHarness(maximumAttempts: 3, attemptFailures: int.MaxValue);

        var result = await harness.ExecuteAsync();

        Assert.AreEqual(CommandCommitDisposition.Committed, result.CommitResult?.Disposition);
        var signal = harness.Signals.Single();
        Assert.AreEqual(OperationalConditionKind.RetryExhausted, signal.Kind);
        Assert.AreEqual(OperationalSeverity.Error, signal.Severity);
        Assert.AreEqual("execution.command-retry", signal.Component.Value);
        Assert.AreEqual("execution.retry_exhausted", signal.Reason.Value);
        Assert.AreEqual(3, signal.AttemptCount);
        Assert.AreEqual(harness.Request.Context.CommandId, signal.CommandId);
        Assert.AreEqual(harness.OriginalCorrelationId, signal.CorrelationId);
        Assert.AreEqual(SignalTime, signal.OccurredAtUtc);
    }

    [TestMethod]
    public async Task RetryThatEventuallySucceeds_ReportsNothing()
    {
        var harness = new RetryHarness(maximumAttempts: 3, attemptFailures: 2);

        var result = await harness.ExecuteAsync();

        Assert.AreEqual(CommandCommitDisposition.Committed, result.CommitResult?.Disposition);
        Assert.AreEqual(3, harness.AttemptCount);
        Assert.AreEqual(0, harness.Signals.Count);
    }

    /// <summary>
    /// A lost lease is already reported as a fencing condition by the recovery repository that owns
    /// the fence. Reporting retry exhaustion here as well would turn one logical failure into two
    /// signals from nested layers, and the retry bound was not in fact exhausted.
    /// </summary>
    [TestMethod]
    public async Task RetryAbandonedBecauseTheLeaseMoved_ReportsNoRetryExhaustion()
    {
        var harness = new RetryHarness(maximumAttempts: 3, attemptFailures: int.MaxValue, renewSucceeds: false);

        var result = await harness.ExecuteAsync();

        Assert.AreEqual(CommandCommitDisposition.TechnicalFailure, result.CommitResult?.Disposition);
        Assert.AreEqual(0, harness.Signals.Count);
    }

    [TestMethod]
    public async Task RetryExhaustionSignalFailure_CannotChangeTheTerminalOutcome()
    {
        var harness = new RetryHarness(
            maximumAttempts: 2,
            attemptFailures: int.MaxValue,
            sink: new ThrowingOperationalSignalSink());

        var result = await harness.ExecuteAsync();

        Assert.AreEqual(CommandCommitDisposition.Committed, result.CommitResult?.Disposition);
        Assert.AreEqual(
            CommandTerminalStatus.TechnicalFailure,
            harness.Committer.LastPlan!.TerminalOutcome.Status);
        Assert.AreEqual(0, harness.Committer.LastPlan!.Transitions.Count);
        Assert.AreEqual(0, harness.Committer.LastPlan!.Events.Count);
    }

    // ---------------------------------------------------------------------------------------
    // Execution invariant violations
    // ---------------------------------------------------------------------------------------

    [TestMethod]
    public async Task PlanThatDoesNotOwnTheAcquiredReceipt_ReportsAnInvariantViolationAndStillThrows()
    {
        var harness = new RetryHarness(maximumAttempts: 2, attemptFailures: 0, forgeAttemptPlanIdentity: true);

        await Assert.ThrowsExactlyAsync<InvalidOperationException>(async () => await harness.ExecuteAsync());

        var signal = harness.Signals.Single();
        Assert.AreEqual(OperationalConditionKind.InvariantViolation, signal.Kind);
        Assert.AreEqual(OperationalSeverity.Critical, signal.Severity);
        Assert.AreEqual("execution.retry_plan_receipt_identity_mismatch", signal.Reason.Value);
        Assert.AreEqual(0, harness.Committer.CallCount, "An unowned plan must never reach the committer.");
    }

    [TestMethod]
    public async Task ExhaustionPlanCarryingEvents_ReportsAnInvariantViolationAndStillThrows()
    {
        var harness = new RetryHarness(
            maximumAttempts: 2,
            attemptFailures: int.MaxValue,
            forgeExhaustionPlanEffects: true);

        await Assert.ThrowsExactlyAsync<InvalidOperationException>(async () => await harness.ExecuteAsync());

        var signal = harness.Signals.Single();
        Assert.AreEqual(OperationalConditionKind.InvariantViolation, signal.Kind);
        Assert.AreEqual("execution.retry_exhaustion_plan_invalid", signal.Reason.Value);
        Assert.AreEqual(0, harness.Committer.CallCount);
    }

    [TestMethod]
    public async Task InvariantSignalFailure_CannotSuppressTheOriginalInvariantException()
    {
        var harness = new RetryHarness(
            maximumAttempts: 2,
            attemptFailures: 0,
            forgeAttemptPlanIdentity: true,
            sink: new ThrowingOperationalSignalSink());

        var exception = await Assert.ThrowsExactlyAsync<InvalidOperationException>(
            async () => await harness.ExecuteAsync());

        StringAssert.Contains(exception.Message, "retain the acquired receipt identity");
    }

    // ---------------------------------------------------------------------------------------
    // Replay: rejection versus corruption
    // ---------------------------------------------------------------------------------------

    [TestMethod]
    public void RunWithoutAnApprovedCompatibility_ReportsRejectionRatherThanCorruption()
    {
        var sink = new RecordingOperationalSignalSink();
        var runner = ReplayFixture.CreateRunner(sink);

        Assert.ThrowsExactly<InvalidOperationException>(() => runner.Run(
            ReplayFixture.WithUnapprovedRuleAndContentVersions(),
            new CoreRulesEngine(),
            ReplayFixture.RandomResolver()));

        var signal = sink.Signals.Single();
        Assert.AreEqual(OperationalConditionKind.ReplayArtifactRejected, signal.Kind);
        Assert.AreEqual(OperationalSeverity.Warning, signal.Severity);
        Assert.AreEqual("replay.corpus-runner", signal.Component.Value);
        Assert.AreEqual("replay.rule_content_compatibility_unapproved", signal.Reason.Value);
        Assert.AreEqual(SignalTime, signal.OccurredAtUtc);
    }

    [TestMethod]
    public void RunWithNoRegisteredCodec_ReportsRejection()
    {
        var sink = new RecordingOperationalSignalSink();
        var runner = new ReplayCorpusRunner(
            Array.Empty<IReplayScenarioCodec>(),
            new ExactReplayVersionCompatibilityPolicy(),
            sink,
            new FixedTimeProvider(SignalTime));

        Assert.ThrowsExactly<KeyNotFoundException>(() => runner.Run(
            ReplayFixture.CreateArtifact(),
            new CoreRulesEngine(),
            ReplayFixture.RandomResolver()));

        Assert.AreEqual(OperationalConditionKind.ReplayArtifactRejected, sink.Signals.Single().Kind);
        Assert.AreEqual("replay.codec_unregistered", sink.Signals.Single().Reason.Value);
    }

    /// <summary>
    /// A candidate Core deciding differently is the comparison result the corpus exists to produce.
    /// Emitting an operational signal for it would drown the real integrity conditions in noise.
    /// </summary>
    [TestMethod]
    public void SuccessfulAndDivergentReplayComparisons_ReportNothing()
    {
        var artifact = ReplayFixture.CreateArtifact();
        var sink = new RecordingOperationalSignalSink();
        var runner = ReplayFixture.CreateRunner(sink);

        var equivalent = runner.Run(artifact, new CoreRulesEngine(), ReplayFixture.RandomResolver());
        var divergent = runner.Run(artifact, new DivergentCore(), ReplayFixture.RandomResolver());

        Assert.IsTrue(equivalent.IsEquivalent, equivalent.Difference);
        Assert.IsFalse(divergent.IsEquivalent);
        Assert.AreEqual(0, sink.Signals.Count);
    }

    [TestMethod]
    public async Task RetainedArtifactThatNoLongerParses_ReportsCorruptionNotRejection()
    {
        var artifact = ReplayFixture.CreateArtifact();
        var sink = new RecordingOperationalSignalSink();
        await UsingCorpusDirectoryAsync(async directory =>
        {
            var store = new FileReplayCorpusStore(directory, sink, new FixedTimeProvider(SignalTime));
            Assert.AreEqual(ReplayRetentionDisposition.Created, await store.RetainAsync(artifact));

            await File.AppendAllTextAsync(store.GetArtifactPath(artifact.ScenarioId), " ");
            await Assert.ThrowsExactlyAsync<InvalidDataException>(
                async () => await store.ReadAsync(artifact.ScenarioId));
        });

        var signal = sink.Signals.Single();
        Assert.AreEqual(OperationalConditionKind.ReplayCorruption, signal.Kind);
        Assert.AreEqual(OperationalSeverity.Critical, signal.Severity);
        Assert.AreEqual("replay.corpus-store", signal.Component.Value);
        Assert.AreEqual("replay.retained_artifact_malformed", signal.Reason.Value);
    }

    [TestMethod]
    public async Task RetainedArtifactWithAnUnreviewedCorpusVersion_ReportsRejectionNotCorruption()
    {
        var unreviewed = ReplayFixture.WithUnreviewedCorpusVersion();
        var sink = new RecordingOperationalSignalSink();
        await UsingCorpusDirectoryAsync(async directory =>
        {
            var store = new FileReplayCorpusStore(directory, sink, new FixedTimeProvider(SignalTime));
            var scenarioId = ReplayFixture.ContentAddressOf(unreviewed);
            await File.WriteAllTextAsync(store.GetArtifactPath(scenarioId), unreviewed);

            await Assert.ThrowsExactlyAsync<InvalidDataException>(async () => await store.ReadAsync(scenarioId));
        });

        var signal = sink.Signals.Single();
        Assert.AreEqual(OperationalConditionKind.ReplayArtifactRejected, signal.Kind);
        Assert.AreEqual("replay.retained_unreviewed_schema_version", signal.Reason.Value);
    }

    [TestMethod]
    public async Task RetainedArtifactGrownPastItsRetentionBound_ReportsCorruption()
    {
        var artifact = ReplayFixture.CreateArtifact();
        var sink = new RecordingOperationalSignalSink();
        await UsingCorpusDirectoryAsync(async directory =>
        {
            var store = new FileReplayCorpusStore(directory, sink, new FixedTimeProvider(SignalTime));
            await File.WriteAllTextAsync(
                store.GetArtifactPath(artifact.ScenarioId),
                new string('x', ReplayCorpusArtifact.MaximumCanonicalJsonUtf8Bytes + 1));

            await Assert.ThrowsExactlyAsync<InvalidDataException>(
                async () => await store.ReadAsync(artifact.ScenarioId));
        });

        Assert.AreEqual(OperationalConditionKind.ReplayCorruption, sink.Signals.Single().Kind);
        Assert.AreEqual("replay.retained_size_exceeded", sink.Signals.Single().Reason.Value);
    }

    /// <summary>
    /// Retention against an occupied path reads the retained artifact before deciding whether this is
    /// a duplicate or a collision. The read owns the retained-artifact conditions, so exactly one
    /// signal must describe the failure rather than one from each nested layer.
    /// </summary>
    [TestMethod]
    public async Task RetentionOverDamagedEvidence_ReportsOneSignalNotTwo()
    {
        var artifact = ReplayFixture.CreateArtifact();
        var sink = new RecordingOperationalSignalSink();
        await UsingCorpusDirectoryAsync(async directory =>
        {
            var store = new FileReplayCorpusStore(directory, sink, new FixedTimeProvider(SignalTime));
            await File.WriteAllTextAsync(
                store.GetArtifactPath(artifact.ScenarioId),
                artifact.CanonicalJson + " ");

            await Assert.ThrowsExactlyAsync<InvalidDataException>(async () => await store.RetainAsync(artifact));
        });

        var signal = sink.Signals.Single();
        Assert.AreEqual(OperationalConditionKind.ReplayCorruption, signal.Kind);
        Assert.AreEqual("replay.retained_artifact_malformed", signal.Reason.Value);
    }

    /// <summary>
    /// Re-retaining a byte-identical artifact is the ordinary deduplication path. It is not a fault
    /// and must stay silent, otherwise every repeated corpus import becomes a signal storm.
    /// </summary>
    [TestMethod]
    public async Task RetainingTheSameArtifactTwice_ReportsNothing()
    {
        var artifact = ReplayFixture.CreateArtifact();
        var sink = new RecordingOperationalSignalSink();
        await UsingCorpusDirectoryAsync(async directory =>
        {
            var store = new FileReplayCorpusStore(directory, sink, new FixedTimeProvider(SignalTime));

            Assert.AreEqual(ReplayRetentionDisposition.Created, await store.RetainAsync(artifact));
            Assert.AreEqual(ReplayRetentionDisposition.AlreadyPresent, await store.RetainAsync(artifact));
        });

        Assert.AreEqual(0, sink.Signals.Count);
    }

    [TestMethod]
    public async Task ReplaySignalFailure_CannotMakeDamagedEvidenceLookAcceptable()
    {
        var artifact = ReplayFixture.CreateArtifact();
        await UsingCorpusDirectoryAsync(async directory =>
        {
            var store = new FileReplayCorpusStore(
                directory,
                new ThrowingOperationalSignalSink(),
                new FixedTimeProvider(SignalTime));
            Assert.AreEqual(ReplayRetentionDisposition.Created, await store.RetainAsync(artifact));
            await File.AppendAllTextAsync(store.GetArtifactPath(artifact.ScenarioId), " ");

            await Assert.ThrowsExactlyAsync<InvalidDataException>(
                async () => await store.ReadAsync(artifact.ScenarioId));
        });
    }

    /// <summary>
    /// Replay signals deliberately carry no CommandId, CorrelationId or EventId: a rejected or
    /// corrupt artifact cannot be trusted to yield those identifiers, so linkage is never invented
    /// from untrusted content.
    /// </summary>
    [TestMethod]
    public void ReplaySignals_CarryNoLinkageInventedFromUntrustedArtifactContent()
    {
        var sink = new RecordingOperationalSignalSink();

        Assert.ThrowsExactly<InvalidOperationException>(() => ReplayFixture.CreateRunner(sink).Run(
            ReplayFixture.WithUnapprovedRuleAndContentVersions(),
            new CoreRulesEngine(),
            ReplayFixture.RandomResolver()));

        var signal = sink.Signals.Single();
        Assert.IsNull(signal.CommandId);
        Assert.IsNull(signal.CorrelationId);
        Assert.IsNull(signal.EventId);
        Assert.IsNull(signal.AttemptCount);
        Assert.IsNull(signal.ActorDiscriminator);
    }

    [TestMethod]
    public void ReplayAssembly_StillHasNoConcreteCorePersistenceOrTransportDependency()
    {
        var references = typeof(FileReplayCorpusStore).Assembly
            .GetReferencedAssemblies()
            .Select(static reference => reference.Name ?? string.Empty)
            .ToArray();

        Assert.IsTrue(
            references.Contains("Nexis.Operations.Contracts", StringComparer.Ordinal),
            "The replay boundary reports rejection and corruption through the operational contract leaf.");
        Assert.IsFalse(references.Contains("Nexis.Operations", StringComparer.Ordinal));
        Assert.IsFalse(references.Contains("Nexis.Core", StringComparer.Ordinal));
        Assert.IsFalse(references.Contains("Nexis.Persistence.Postgres", StringComparer.Ordinal));
        CollectionAssert.AreEquivalent(
            new[] { "Nexis.Kernel" },
            typeof(IOperationalSignalSink).Assembly.GetReferencedAssemblies()
                .Select(static reference => reference.Name ?? string.Empty)
                .Where(static name => name.StartsWith("Nexis.", StringComparison.Ordinal))
                .ToArray());
    }

    private static async Task UsingCorpusDirectoryAsync(Func<string, Task> body)
    {
        var directory = Path.Combine(Path.GetTempPath(), $"nexis-c5-replay-{Guid.NewGuid():N}");
        Directory.CreateDirectory(directory);
        try
        {
            await body(directory);
        }
        finally
        {
            Directory.Delete(directory, recursive: true);
        }
    }

    // ---------------------------------------------------------------------------------------
    // Replay fixture
    // ---------------------------------------------------------------------------------------

    /// <summary>
    /// A minimal genuine Equip Item corpus artifact built through the real extractor, so the tests
    /// exercise the production parse/verify paths rather than a hand-written envelope.
    /// </summary>
    private static class ReplayFixture
    {
        private const string RandomSecret = "c5-rng-material-must-not-leak";
        private static readonly DateTimeOffset EvaluatedAt = new(2026, 8, 26, 10, 0, 0, TimeSpan.Zero);
        private static readonly DateTimeOffset CompletedAt = new(2026, 8, 26, 10, 0, 1, TimeSpan.Zero);
        private static readonly DateTimeOffset CapturedAt = new(2026, 8, 27, 9, 0, 0, TimeSpan.Zero);
        private static readonly EquipmentPlacementKey MainHandPlacement = new("main-hand");
        private static readonly EquipmentSlotKey MainHand = new("main-hand");
        private static readonly RestrictedReplayRandomReference Random =
            new(Guid.Parse("30000000-0000-0000-0000-000000000003"));

        public static ReplayCorpusRunner CreateRunner(IOperationalSignalSink sink) =>
            new(
                new[] { new EquipItemReplayScenarioCodec() },
                new ExactReplayVersionCompatibilityPolicy(),
                sink,
                new FixedTimeProvider(SignalTime));

        public static IRestrictedReplayRandomResolver RandomResolver() => new FixedRandomResolver(Random);

        public static ReplayScenarioId ContentAddressOf(string canonicalJson) =>
            ReplayScenarioId.Parse(
                Convert.ToHexString(SHA256.HashData(Encoding.UTF8.GetBytes(canonicalJson))).ToLowerInvariant());

        public static ReplayCorpusArtifact WithUnapprovedRuleAndContentVersions() =>
            ReplayCorpusArtifact.Parse(Mutate(root =>
            {
                root["execution"]!["ruleVersion"] = "equip-rules-v999";
                root["execution"]!["contentVersion"] = "equip-content-v999";
            }));

        public static string WithUnreviewedCorpusVersion() => Mutate(root => root["corpusVersion"] = 3);

        private static string Mutate(Action<JsonObject> mutation)
        {
            var root = JsonNode.Parse(CreateArtifact().CanonicalJson)?.AsObject()
                ?? throw new InvalidOperationException("Replay fixture must contain a JSON object.");
            mutation(root);
            return root.ToJsonString();
        }

        public static ReplayCorpusArtifact CreateArtifact()
        {
            var characterId = CharacterId.New();
            var itemId = ItemInstanceId.New();
            var definition = new EquippableItemDefinition(
                new ContentDefinitionId("iron-sword"),
                new[] { new EquipmentPlacementDefinition(MainHandPlacement, new[] { MainHand }) });
            var definitionKey = new ContentDefinitionKey(definition.Contract, definition.DefinitionId);
            var correlationId = CorrelationId.New();
            var request = new CoreEvaluationRequest(
                CoreContractVersion.V1,
                new CoreEvaluationContext(
                    CommandId.New(),
                    correlationId,
                    TrustedActorContext.CreatePlayer(AccountId.New(), characterId, 991),
                    EvaluatedAt,
                    new RuleVersion("equip-rules-v1"),
                    new ContentVersion("equip-content-v1"),
                    new FixedRandomFactory()),
                new EquipItemIntent(characterId, itemId, MainHandPlacement),
                new IAuthoritativeSnapshot[]
                {
                    new InventorySnapshot(
                        characterId,
                        5,
                        new[] { new InventoryItemReference(itemId, definitionKey) },
                        Array.Empty<InventoryItemReservation>()),
                    new EquipmentSnapshot(characterId, 9, Array.Empty<EquippedItemBinding>()),
                    new CombatParticipationSnapshot(characterId, 3, false)
                },
                new[] { definition });
            var engine = new CoreRulesEngine();
            var decision = engine.Evaluate(request);
            var plan = new CommandCommitPlanBuilder().Build(
                request,
                new EquipItemCanonicalCommandCodec().Serialize(request.Intent).Fingerprint,
                CommandReceiptClaim.Acquired(correlationId, CommandExecutionToken.New()),
                decision,
                engine.Descriptor,
                CompletedAt);
            var capture = new ReplayCapture(
                request,
                decision,
                plan,
                new ReplayCaptureMetadata(
                    ReplayProvenanceKind.Synthetic,
                    ReplaySourceFingerprint.Compute(Encoding.UTF8.GetBytes("c5-operational-producer-fixture")),
                    CapturedAt,
                    new[] { ReplayScenarioTag.Ordinary },
                    Random,
                    TimeSpan.FromMilliseconds(7)));

            return new ReplayCorpusExtractor(
                    new[] { new EquipItemReplayScenarioCodec() },
                    new ICanonicalCommandCodec[] { new EquipItemCanonicalCommandCodec() },
                    ReplayPseudonymizationKey.FromBytes(
                        Encoding.UTF8.GetBytes("test-only-pseudonymization-key-material")))
                .Extract(capture);
        }
    }

    private sealed class ExactReplayVersionCompatibilityPolicy : IReplayVersionCompatibilityPolicy
    {
        public bool Supports(
            CoreImplementationDescriptor candidate,
            ContractDescriptor intentContract,
            CoreContractVersion coreContractVersion,
            RuleVersion ruleVersion,
            ContentVersion contentVersion) =>
            coreContractVersion == CoreContractVersion.V1 &&
            intentContract == EquipItemIntent.IntentContract &&
            ruleVersion == new RuleVersion("equip-rules-v1") &&
            contentVersion == new ContentVersion("equip-content-v1");
    }

    private sealed class FixedRandomResolver : IRestrictedReplayRandomResolver
    {
        private readonly RestrictedReplayRandomReference _expected;

        public FixedRandomResolver(RestrictedReplayRandomReference expected) => _expected = expected;

        public IDeterministicRandomFactory Resolve(RestrictedReplayRandomReference reference)
        {
            Assert.AreEqual(_expected, reference);
            return new FixedRandomFactory();
        }
    }

    // ---------------------------------------------------------------------------------------
    // Retry harness and doubles
    // ---------------------------------------------------------------------------------------

    private sealed class RetryHarness
    {
        private readonly int _attemptFailures;
        private readonly bool _forgeAttemptPlanIdentity;
        private readonly bool _forgeExhaustionPlanEffects;
        private readonly CanonicalCommandPayload _payload;
        private readonly RetryingCommandExecutionCoordinator _coordinator;
        private readonly RecordingOperationalSignalSink? _recording;

        public RetryHarness(
            int maximumAttempts,
            int attemptFailures,
            bool renewSucceeds = true,
            bool forgeAttemptPlanIdentity = false,
            bool forgeExhaustionPlanEffects = false,
            IOperationalSignalSink? sink = null)
        {
            _attemptFailures = attemptFailures;
            _forgeAttemptPlanIdentity = forgeAttemptPlanIdentity;
            _forgeExhaustionPlanEffects = forgeExhaustionPlanEffects;
            _payload = CanonicalCommandPayload.FromTrustedJson("{\"c5\":true}");
            Request = CreateRequest();
            OriginalCorrelationId = Request.Context.CorrelationId;
            if (sink is null)
            {
                _recording = new RecordingOperationalSignalSink();
                sink = _recording;
            }

            Committer = new RecordingAtomicCommitter();
            _coordinator = new RetryingCommandExecutionCoordinator(
                new CommandReceiptCoordinator(new AlwaysAcquiringReceiptRepository()),
                new BoundedCommandRetryExecutor(new AlwaysRetryableClassifier(), maximumAttempts),
                new StubRecoveryRepository(renewSucceeds),
                new CommandCommitCoordinator(Committer),
                new FixedTimeProvider(SignalTime),
                sink);
        }

        public CoreEvaluationRequest Request { get; }

        public CorrelationId OriginalCorrelationId { get; }

        public RecordingAtomicCommitter Committer { get; }

        public IReadOnlyList<OperationalSignal> Signals =>
            _recording?.Signals ?? (IReadOnlyList<OperationalSignal>)Array.Empty<OperationalSignal>();

        public int AttemptCount { get; private set; }

        public ValueTask<RetryingCommandExecutionResult> ExecuteAsync() =>
            _coordinator.ExecuteAsync(
                Request,
                _payload,
                new CommandExecutionLeaseRequest("c5-worker", TimeSpan.FromMinutes(5)),
                SignalTime,
                (claim, _, _) =>
                {
                    AttemptCount++;
                    if (AttemptCount <= _attemptFailures)
                    {
                        throw new RetryableTestFailure();
                    }

                    return ValueTask.FromResult(BuildPlan(
                        claim,
                        CoreDecision.Succeeded(),
                        forgeIdentity: _forgeAttemptPlanIdentity));
                },
                (claim, _, _) => ValueTask.FromResult(BuildPlan(
                    claim,
                    _forgeExhaustionPlanEffects
                        ? CoreDecision.Succeeded()
                        : CoreDecision.TechnicalFailure(new CoreReasonCode("execution.retry.exhausted")),
                    forgeIdentity: false)));

        private CommandCommitPlan BuildPlan(CommandReceiptClaim claim, CoreDecision decision, bool forgeIdentity)
        {
            var effectiveClaim = forgeIdentity
                ? CommandReceiptClaim.Acquired(claim.OriginalCorrelationId, CommandExecutionToken.New())
                : claim;
            return new CommandCommitPlanBuilder().Build(
                Request,
                _payload.Fingerprint,
                effectiveClaim,
                decision,
                new CoreImplementationDescriptor("Test.Core", "1.0.0-c5", CoreContractVersion.V1),
                SignalTime);
        }

        private static CoreEvaluationRequest CreateRequest() =>
            new(
                CoreContractVersion.V1,
                new CoreEvaluationContext(
                    CommandId.New(),
                    CorrelationId.New(),
                    TrustedActorContext.CreatePlayer(AccountId.New(), CharacterId.New(), 1),
                    SignalTime,
                    new RuleVersion("c5.rules.v1"),
                    new ContentVersion("c5.content.v1"),
                    new FixedRandomFactory()),
                new SyntheticIntent(),
                Array.Empty<IAuthoritativeSnapshot>());
    }

    private sealed class RetryableTestFailure : Exception;

    private sealed class AlwaysRetryableClassifier : ITransientCommandFailureClassifier
    {
        public bool IsRetryable(Exception exception) => exception is RetryableTestFailure;
    }

    private sealed class AlwaysAcquiringReceiptRepository : ICommandReceiptRepository
    {
        public ValueTask<CommandReceiptClaim> TryAcquireAsync(
            CommandReceiptAcquireRequest request,
            CancellationToken cancellationToken = default) =>
            ValueTask.FromResult(CommandReceiptClaim.Acquired(
                request.CorrelationId,
                CommandExecutionToken.New()));
    }

    private sealed class StubRecoveryRepository : ICommandExecutionRecoveryRepository
    {
        private readonly bool _renewSucceeds;

        public StubRecoveryRepository(bool renewSucceeds) => _renewSucceeds = renewSucceeds;

        public ValueTask<CommandRecoveryResult> ReconcileAsync(
            CommandId commandId,
            CommandExecutionToken observedExecutionToken,
            CommandExecutionLeaseRequest replacementLease,
            DateTimeOffset nowUtc,
            CancellationToken cancellationToken = default) =>
            throw new NotSupportedException();

        public ValueTask<IReadOnlyList<RecoveredCommandExecution>> ClaimExpiredBatchAsync(
            CommandExecutionLeaseRequest replacementLease,
            DateTimeOffset nowUtc,
            int maximumItems,
            CancellationToken cancellationToken = default) =>
            throw new NotSupportedException();

        public ValueTask<bool> RenewLeaseAsync(
            CommandId commandId,
            CommandExecutionToken executionToken,
            CommandExecutionLeaseRequest currentLease,
            DateTimeOffset nowUtc,
            CancellationToken cancellationToken = default) =>
            ValueTask.FromResult(_renewSucceeds);
    }

    private sealed class RecordingAtomicCommitter : IAtomicCommandCommitter
    {
        public int CallCount { get; private set; }

        public CommandCommitPlan? LastPlan { get; private set; }

        public ValueTask<CommandCommitResult> CommitAsync(
            CommandCommitPlan plan,
            CancellationToken cancellationToken = default)
        {
            CallCount++;
            LastPlan = plan;
            return ValueTask.FromResult(CommandCommitResult.Committed());
        }
    }

    private sealed class DivergentCore : ICoreRulesEngine
    {
        public CoreImplementationDescriptor Descriptor { get; } =
            new("Test.DivergentCore", "0.0.1-test", CoreContractVersion.V1);

        public bool Supports(CoreContractVersion version) => version == CoreContractVersion.V1;

        public CoreDecision Evaluate(CoreEvaluationRequest request) =>
            CoreDecision.Rejected(new CoreReasonCode("c5.divergent"));
    }

    private sealed class RecordingOperationalSignalSink : IOperationalSignalSink
    {
        public List<OperationalSignal> Signals { get; } = new();

        public ValueTask ReportAsync(OperationalSignal signal, CancellationToken cancellationToken = default)
        {
            Signals.Add(signal);
            return ValueTask.CompletedTask;
        }
    }

    private sealed class ThrowingOperationalSignalSink : IOperationalSignalSink
    {
        public ValueTask ReportAsync(OperationalSignal signal, CancellationToken cancellationToken = default) =>
            throw new InvalidOperationException("The operational sink is unavailable.");
    }

    private sealed class FixedTimeProvider(DateTimeOffset utcNow) : TimeProvider
    {
        public override DateTimeOffset GetUtcNow() => utcNow;
    }

    private sealed record SyntheticIntent : ICoreIntent
    {
        public ContractDescriptor Contract { get; } = new("c5.tests.command", 1);
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
