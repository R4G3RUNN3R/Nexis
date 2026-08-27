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

namespace Nexis.Architecture.Tests;

[TestClass]
public sealed class ReplayCorpusTests
{
    private const string RandomSecret = "future-rng-seed-must-not-leak";
    private const string CapabilitySecret = "security.inspect.private-case-991";
    private const string EntitlementSecret = "private-commercial-entitlement";
    private static readonly DateTimeOffset EvaluatedAt = new(2026, 8, 26, 10, 0, 0, TimeSpan.Zero);
    private static readonly DateTimeOffset CompletedAt = new(2026, 8, 26, 10, 0, 1, TimeSpan.Zero);
    private static readonly DateTimeOffset CapturedAt = new(2026, 8, 27, 9, 0, 0, TimeSpan.Zero);
    private static readonly EquipmentPlacementKey MainHandPlacement = new("main-hand");
    private static readonly EquipmentSlotKey MainHand = new("main-hand");

    [TestMethod]
    public void Extract_NormalizesVersionsProvenanceTagsAndAuthoritativeIdentities()
    {
        var fixture = CreateFixture(
            ReplayScenarioTag.Ordinary,
            ReplayScenarioTag.KnownBug,
            ReplayScenarioTag.Exploit,
            ReplayScenarioTag.Concurrency,
            ReplayScenarioTag.HighValue);

        var artifact = CreateExtractor().Extract(fixture.Capture);

        Assert.AreEqual(ReplayCorpusVersion.V1, artifact.CorpusVersion);
        Assert.AreEqual(EquipItemIntent.IntentContract, artifact.IntentContract);
        Assert.IsTrue(artifact.VerifyIntegrity());
        StringAssert.Contains(artifact.CanonicalJson, "\"provenanceKind\":\"productionHistory\"");
        StringAssert.Contains(artifact.CanonicalJson, "\"sourceFingerprint\":\"");
        StringAssert.Contains(artifact.CanonicalJson, "\"ordinary\"");
        StringAssert.Contains(artifact.CanonicalJson, "\"knownBug\"");
        StringAssert.Contains(artifact.CanonicalJson, "\"exploit\"");
        StringAssert.Contains(artifact.CanonicalJson, "\"concurrency\"");
        StringAssert.Contains(artifact.CanonicalJson, "\"highValue\"");
        StringAssert.Contains(artifact.CanonicalJson, fixture.Request.Context.CommandId.Value.ToString("D"));
        StringAssert.Contains(artifact.CanonicalJson, fixture.Plan.Trace.CorrelationId.Value.ToString("D"));
        StringAssert.Contains(artifact.CanonicalJson, fixture.Plan.Events.Single().Metadata.EventId.Value.ToString("D"));
        StringAssert.Contains(artifact.CanonicalJson, "\"coreImplementationVersion\":\"0.5.0-foundation\"");
        StringAssert.Contains(artifact.CanonicalJson, $"\"payloadFingerprint\":\"{fixture.Plan.Trace.Identity.PayloadFingerprint.Value}\"");
        StringAssert.Contains(artifact.CanonicalJson, "\"ruleVersion\":\"equip-rules-v1\"");
        StringAssert.Contains(artifact.CanonicalJson, "\"contentVersion\":\"equip-content-v1\"");
        StringAssert.Contains(artifact.CanonicalJson, "\"evaluatedAtUtc\":\"2026-08-26T10:00:00.0000000\\u002B00:00\"");
    }

    [TestMethod]
    public void Extract_PseudonymizesPrivateIdentitiesAndCannotRetainSecretsForCompleteness()
    {
        var fixture = CreateFixture(ReplayScenarioTag.Exploit);

        var artifact = CreateExtractor().Extract(fixture.Capture);

        Assert.IsFalse(artifact.CanonicalJson.Contains(fixture.AccountId.Value.ToString("D"), StringComparison.OrdinalIgnoreCase));
        Assert.IsFalse(artifact.CanonicalJson.Contains(fixture.CharacterId.Value.ToString("D"), StringComparison.OrdinalIgnoreCase));
        Assert.IsFalse(artifact.CanonicalJson.Contains(fixture.ItemId.Value.ToString("D"), StringComparison.OrdinalIgnoreCase));
        Assert.IsFalse(artifact.CanonicalJson.Contains(RandomSecret, StringComparison.Ordinal));
        Assert.IsFalse(artifact.CanonicalJson.Contains(CapabilitySecret, StringComparison.Ordinal));
        Assert.IsFalse(artifact.CanonicalJson.Contains(EntitlementSecret, StringComparison.Ordinal));
        Assert.IsFalse(artifact.CanonicalJson.Contains("securityVersion", StringComparison.OrdinalIgnoreCase));
        Assert.IsFalse(artifact.CanonicalJson.Contains("capabilities", StringComparison.OrdinalIgnoreCase));
        Assert.IsFalse(artifact.CanonicalJson.Contains("entitlements", StringComparison.OrdinalIgnoreCase));
        Assert.IsFalse(artifact.CanonicalJson.Contains("randomSeed", StringComparison.OrdinalIgnoreCase));
        StringAssert.Contains(artifact.CanonicalJson, fixture.RandomReference.Value.ToString("D"));
    }

    [TestMethod]
    public void Extract_IsCanonicalAcrossInputOrderingAndReplaysDeterministically()
    {
        var fixture = CreateFixture(ReplayScenarioTag.Ordinary);
        var reorderedRequest = new CoreEvaluationRequest(
            fixture.Request.ContractVersion,
            fixture.Request.Context,
            fixture.Request.Intent,
            fixture.Request.Snapshots.Reverse(),
            fixture.Request.Content.Reverse());
        var reordered = fixture with
        {
            Capture = new ReplayCapture(reorderedRequest, fixture.Decision, fixture.Plan, fixture.Capture.Metadata)
        };
        var extractor = CreateExtractor();

        var first = extractor.Extract(fixture.Capture);
        var second = extractor.Extract(reordered.Capture);
        var result = new ReplayCorpusRunner(new[] { new EquipItemReplayScenarioCodec() })
            .Run(first, new CoreRulesEngine(), new FixedRandomResolver(fixture.RandomReference));

        Assert.AreEqual(first.ScenarioId, second.ScenarioId);
        Assert.AreEqual(first.CanonicalJson, second.CanonicalJson);
        Assert.IsTrue(result.IsEquivalent, result.Difference);
        Assert.AreEqual(CoreOutcomeStatus.Succeeded, result.ActualStatus);
    }

    [TestMethod]
    public void ArtifactParser_RejectsUnreviewedCompletenessFields()
    {
        var artifact = CreateExtractor().Extract(CreateFixture(ReplayScenarioTag.Exploit).Capture);
        var injected = artifact.CanonicalJson[..^1] + ",\"credential\":\"must-not-be-retained\"}";

        var exception = Assert.ThrowsExactly<FormatException>(() => ReplayCorpusArtifact.Parse(injected));

        var nonCanonical = Assert.ThrowsExactly<FormatException>(() =>
            ReplayCorpusArtifact.Parse(" " + artifact.CanonicalJson));
        Assert.ThrowsExactly<NotSupportedException>(() =>
            ReplayCorpusArtifact.Parse(artifact.CanonicalJson.Replace("\"corpusVersion\":1", "\"corpusVersion\":2", StringComparison.Ordinal)));
        StringAssert.Contains(exception.Message, "exact reviewed schema");
        StringAssert.Contains(nonCanonical.Message, "canonical");
        Assert.IsFalse(artifact.CanonicalJson.Contains("credential", StringComparison.OrdinalIgnoreCase));
    }

    [TestMethod]
    public void ArtifactParser_RejectsCanonicalDomainInvalidArtifacts()
    {
        var fixture = CreateFixture(ReplayScenarioTag.Exploit);
        var artifact = CreateExtractor().Extract(fixture.Capture);
        var invalidArtifacts = new[]
        {
            artifact.CanonicalJson.Replace("\"tags\":[\"exploit\"]", "\"tags\":[]", StringComparison.Ordinal),
            artifact.CanonicalJson.Replace("\"evaluationDurationTicks\":70000", "\"evaluationDurationTicks\":-1", StringComparison.Ordinal),
            artifact.CanonicalJson.Replace(
                $"\"sourceFingerprint\":\"{fixture.Capture.Metadata.SourceFingerprint.Value}\"",
                "\"sourceFingerprint\":\"invalid\"",
                StringComparison.Ordinal),
            artifact.CanonicalJson.Replace(
                "\"provenanceKind\":\"productionHistory\"",
                "\"provenanceKind\":99",
                StringComparison.Ordinal),
            artifact.CanonicalJson.Replace(
                "\"definitionContract\":{\"name\":\"nexis.items.equippable-definition\"",
                "\"definitionContract\":{\"name\":\"\"",
                StringComparison.Ordinal)
        };

        foreach (var invalidArtifact in invalidArtifacts)
        {
            Assert.ThrowsExactly<FormatException>(() => ReplayCorpusArtifact.Parse(invalidArtifact));
        }
    }

    [TestMethod]
    public async Task ArtifactIngest_RejectsCrossFieldInconsistenciesAndStoreFailsClosed()
    {
        var artifact = CreateExtractor().Extract(CreateFixture(ReplayScenarioTag.Exploit).Capture);
        var invalidArtifacts = new[]
        {
            MutateArtifact(artifact, root =>
                root["committedEvents"]!.AsArray()[0]!["correlationId"] = Guid.NewGuid()),
            MutateArtifact(artifact, root =>
                root["decision"]!["events"]!.AsArray()[0]!["placement"] = "off-hand"),
            MutateArtifact(artifact, root =>
                root["decision"]!["transitions"]!.AsArray()[0]!["characterId"] = Guid.NewGuid()),
            MutateArtifact(artifact, root =>
            {
                root["decision"]!["transitions"] = new JsonArray();
                root["decision"]!["events"] = new JsonArray();
            }),
            MutateArtifact(artifact, root => root["inventory"]!["items"] = new JsonArray())
        };

        foreach (var invalidArtifact in invalidArtifacts)
        {
            Assert.ThrowsExactly<FormatException>(() => ReplayCorpusArtifact.Parse(invalidArtifact));
        }

        var retainedInvalid = invalidArtifacts[0];
        var scenarioId = ReplayScenarioId.Parse(
            Convert.ToHexString(SHA256.HashData(Encoding.UTF8.GetBytes(retainedInvalid))).ToLowerInvariant());
        var directory = Path.Combine(Path.GetTempPath(), $"nexis-replay-invalid-{Guid.NewGuid():N}");
        Directory.CreateDirectory(directory);
        try
        {
            var store = new FileReplayCorpusStore(directory);
            await File.WriteAllTextAsync(store.GetArtifactPath(scenarioId), retainedInvalid);

            await Assert.ThrowsExactlyAsync<InvalidDataException>(async () => await store.ReadAsync(scenarioId));
        }
        finally
        {
            Directory.Delete(directory, recursive: true);
        }
    }

    [TestMethod]
    public void ArtifactParser_RejectsNonCanonicalValueSpellings()
    {
        var artifact = CreateExtractor().Extract(CreateFixture(ReplayScenarioTag.Exploit).Capture);
        var invalidArtifacts = new[]
        {
            MutateArtifact(artifact, root =>
                root["sourceFingerprint"] = root["sourceFingerprint"]!.GetValue<string>().ToUpperInvariant()),
            MutateArtifact(artifact, root => MutatePlacement(root, "MAIN-HAND")),
            MutateArtifact(artifact, root => MutateSlots(root, " MAIN-HAND ")),
            MutateArtifact(artifact, root =>
            {
                root["inventory"]!["items"]!.AsArray()[0]!["definitionId"] = " iron-sword ";
                root["content"]!["definitionId"] = " iron-sword ";
            }),
            MutateArtifact(artifact, root =>
            {
                root["capturedAtUtc"] = "2026-08-27T09:00:00.0000000Z";
                root["execution"]!["evaluatedAtUtc"] = "2026-08-26T10:00:00.0000000Z";
                root["execution"]!["completedAtUtc"] = "2026-08-26T10:00:01.0000000Z";
                root["committedEvents"]!.AsArray()[0]!["occurredAtUtc"] = "2026-08-26T10:00:00.0000000Z";
            })
        };

        foreach (var invalidArtifact in invalidArtifacts)
        {
            Assert.ThrowsExactly<FormatException>(() => ReplayCorpusArtifact.Parse(invalidArtifact));
        }
    }

    [TestMethod]
    public void ArtifactParser_RejectsUnreviewedRetainedTokensAndContractNames()
    {
        var artifact = CreateExtractor().Extract(CreateFixture(ReplayScenarioTag.Exploit).Capture);
        var oversized = new string('a', 201);
        var invalidArtifacts = new[]
        {
            MutateArtifact(artifact, root => root["execution"]!["ruleVersion"] = "private operator notes"),
            MutateArtifact(artifact, root => root["execution"]!["contentVersion"] = oversized),
            MutateArtifact(artifact, root => root["execution"]!["coreImplementationName"] = "unreviewed core name"),
            MutateArtifact(artifact, root => root["execution"]!["coreImplementationVersion"] = oversized),
            MutateArtifact(artifact, root => MutateFailureReason(root, "private terminal notes")),
            MutateArtifact(artifact, root => MutateFailureReason(root, oversized)),
            MutateArtifact(artifact, root =>
            {
                root["inventory"]!["items"]!.AsArray()[0]!["definitionId"] = "iron sword";
                root["content"]!["definitionId"] = "iron sword";
            }),
            MutateArtifact(artifact, root => MutatePlacement(root, "main hand")),
            MutateArtifact(artifact, root => MutateSlots(root, "main hand")),
            MutateArtifact(artifact, root =>
                root["inventory"]!["items"]!.AsArray()[0]!["definitionContract"]!["name"] =
                    "nexis.items.unreviewed-definition")
        };

        foreach (var invalidArtifact in invalidArtifacts)
        {
            Assert.ThrowsExactly<FormatException>(() => ReplayCorpusArtifact.Parse(invalidArtifact));
        }
    }

    [TestMethod]
    public void EncodeParseDecodeAndJsonReencode_IsByteStable()
    {
        var fixture = CreateFixture(ReplayScenarioTag.Ordinary);
        var artifact = CreateExtractor().Extract(fixture.Capture);
        var parsed = ReplayCorpusArtifact.Parse(artifact.CanonicalJson);
        var codec = new EquipItemReplayScenarioCodec();

        var scenario = codec.Decode(parsed.CanonicalJson, new FixedRandomResolver(fixture.RandomReference));
        var reencoded = JsonNode.Parse(parsed.CanonicalJson)!.ToJsonString();
        var reparsed = ReplayCorpusArtifact.Parse(reencoded);

        Assert.AreEqual(artifact.CanonicalJson, reencoded);
        Assert.AreEqual(artifact.ScenarioId, reparsed.ScenarioId);
        Assert.AreEqual(
            scenario.ExpectedDecisionFingerprint,
            codec.DecisionFingerprint(new CoreRulesEngine().Evaluate(scenario.Request)));
    }

    [TestMethod]
    public void Extract_RejectsCodecThatAttemptsCompletenessPayloadBypass()
    {
        var fixture = CreateFixture(ReplayScenarioTag.Exploit);
        var extractor = new ReplayCorpusExtractor(
            new IReplayScenarioCodec[] { new CompletenessReplayCodec() },
            ReplayPseudonymizationKey.FromBytes(
                Encoding.UTF8.GetBytes("test-only-pseudonymization-key-material")));

        Assert.ThrowsExactly<FormatException>(() => extractor.Extract(fixture.Capture));
    }

    [TestMethod]
    public void Extract_RejectsRequestAndTraceCorrelationMismatch()
    {
        var fixture = CreateFixture(ReplayScenarioTag.KnownBug);
        var mismatchedRequest = new CoreEvaluationRequest(
            fixture.Request.ContractVersion,
            new CoreEvaluationContext(
                fixture.Request.Context.CommandId,
                CorrelationId.New(),
                fixture.Request.Context.Actor,
                fixture.Request.Context.EvaluationTimeUtc,
                fixture.Request.Context.RuleVersion,
                fixture.Request.Context.ContentVersion,
                fixture.Request.Context.RandomFactory),
            fixture.Request.Intent,
            fixture.Request.Snapshots,
            fixture.Request.Content);
        var capture = new ReplayCapture(
            mismatchedRequest,
            fixture.Decision,
            fixture.Plan,
            fixture.Capture.Metadata);

        Assert.ThrowsExactly<InvalidOperationException>(() => CreateExtractor().Extract(capture));
    }


    [TestMethod]
    public void Extract_FailsClosedForUnregisteredOrInconsistentHistoricalData()
    {
        var fixture = CreateFixture(ReplayScenarioTag.KnownBug);
        var unknownRequest = new CoreEvaluationRequest(
            fixture.Request.ContractVersion,
            fixture.Request.Context,
            new SecretBearingIntent("credential=do-not-copy"),
            Array.Empty<IAuthoritativeSnapshot>());
        var unknownCapture = new ReplayCapture(unknownRequest, CoreDecision.Succeeded(), fixture.Plan, fixture.Capture.Metadata);
        var inconsistentRequest = new CoreEvaluationRequest(
            fixture.Request.ContractVersion,
            new CoreEvaluationContext(
                CommandId.New(),
                fixture.Request.Context.CorrelationId,
                fixture.Request.Context.Actor,
                fixture.Request.Context.EvaluationTimeUtc,
                fixture.Request.Context.RuleVersion,
                fixture.Request.Context.ContentVersion,
                fixture.Request.Context.RandomFactory),
            fixture.Request.Intent,
            fixture.Request.Snapshots,
            fixture.Request.Content);

        Assert.ThrowsExactly<KeyNotFoundException>(() => CreateExtractor().Extract(unknownCapture));
        Assert.ThrowsExactly<InvalidOperationException>(() => CreateExtractor().Extract(
            new ReplayCapture(inconsistentRequest, fixture.Decision, fixture.Plan, fixture.Capture.Metadata)));
    }

    [TestMethod]
    public async Task FileRetention_IsImmutableContentAddressedAndDetectsTampering()
    {
        var artifact = CreateExtractor().Extract(CreateFixture(ReplayScenarioTag.Concurrency).Capture);
        var directory = Path.Combine(Path.GetTempPath(), $"nexis-replay-{Guid.NewGuid():N}");
        Directory.CreateDirectory(directory);
        try
        {
            var store = new FileReplayCorpusStore(directory);

            Assert.AreEqual(ReplayRetentionDisposition.Created, await store.RetainAsync(artifact));
            Assert.AreEqual(ReplayRetentionDisposition.AlreadyPresent, await store.RetainAsync(artifact));
            var retained = await store.ReadAsync(artifact.ScenarioId);
            Assert.AreEqual(artifact.CanonicalJson, retained.CanonicalJson);

            await File.AppendAllTextAsync(store.GetArtifactPath(artifact.ScenarioId), " ");
            await Assert.ThrowsExactlyAsync<InvalidDataException>(async () => await store.ReadAsync(artifact.ScenarioId));
        }
        finally
        {
            Directory.Delete(directory, recursive: true);
        }
    }

    [TestMethod]
    public void ReplayAssembly_HasNoConcreteCorePersistenceTransportOrPlayerLogDependency()
    {
        var references = typeof(ReplayCorpusExtractor).Assembly
            .GetReferencedAssemblies()
            .Select(static reference => reference.Name ?? string.Empty)
            .ToArray();

        Assert.IsFalse(references.Contains("Nexis.Core", StringComparer.Ordinal));
        Assert.IsFalse(references.Contains("Nexis.Persistence.Postgres", StringComparer.Ordinal));
        Assert.IsFalse(references.Contains("Nexis.History.Projection", StringComparer.Ordinal));
        Assert.IsFalse(references.Any(static name =>
            name.Contains("Npgsql", StringComparison.OrdinalIgnoreCase) ||
            name.Contains("EntityFrameworkCore", StringComparison.OrdinalIgnoreCase) ||
            name.Contains("AspNetCore", StringComparison.OrdinalIgnoreCase)));

        var properties = typeof(ReplayCorpusArtifact).GetProperties();
        Assert.IsFalse(properties.Any(static property => property.PropertyType == typeof(object)));
        Assert.IsFalse(properties.Any(static property =>
            typeof(System.Collections.IDictionary).IsAssignableFrom(property.PropertyType)));
        Assert.IsFalse(properties.Any(static property =>
            property.Name.Contains("Secret", StringComparison.OrdinalIgnoreCase) ||
            property.Name.Contains("Credential", StringComparison.OrdinalIgnoreCase) ||
            property.Name.Contains("Seed", StringComparison.OrdinalIgnoreCase)));
    }

    private static ReplayCorpusExtractor CreateExtractor() =>
        new(
            new[] { new EquipItemReplayScenarioCodec() },
            ReplayPseudonymizationKey.FromBytes(Encoding.UTF8.GetBytes("test-only-pseudonymization-key-material")));

    private static void MutateFailureReason(JsonObject root, string value)
    {
        root["execution"]!["terminalStatus"] = "rejected";
        root["execution"]!["terminalReason"] = value;
        root["decision"]!["status"] = "rejected";
        root["decision"]!["reason"] = value;
        root["decision"]!["transitions"] = new JsonArray();
        root["decision"]!["events"] = new JsonArray();
        root["committedEvents"] = new JsonArray();
    }

    private static void MutatePlacement(JsonObject root, string value)
    {
        root["intent"]!["placement"] = value;
        root["content"]!["placements"]!.AsArray()[0]!["placement"] = value;
        root["decision"]!["transitions"]!.AsArray()[0]!["placement"] = value;
        root["decision"]!["events"]!.AsArray()[0]!["placement"] = value;
        root["committedEvents"]!.AsArray()[0]!["event"]!["placement"] = value;
    }

    private static void MutateSlots(JsonObject root, string value)
    {
        root["content"]!["placements"]!.AsArray()[0]!["occupiedSlots"] =
            new JsonArray(JsonValue.Create(value));
        root["decision"]!["transitions"]!.AsArray()[0]!["occupiedSlots"] =
            new JsonArray(JsonValue.Create(value));
        root["decision"]!["events"]!.AsArray()[0]!["occupiedSlots"] =
            new JsonArray(JsonValue.Create(value));
        root["committedEvents"]!.AsArray()[0]!["event"]!["occupiedSlots"] =
            new JsonArray(JsonValue.Create(value));
    }

    private static string MutateArtifact(
        ReplayCorpusArtifact artifact,
        Action<JsonObject> mutation)
    {
        var root = JsonNode.Parse(artifact.CanonicalJson)?.AsObject()
            ?? throw new InvalidOperationException("Replay fixture must contain a JSON object.");
        mutation(root);
        return root.ToJsonString();
    }

    private static Fixture CreateFixture(params ReplayScenarioTag[] tags)
    {
        var commandId = new CommandId(Guid.Parse("10000000-0000-0000-0000-000000000001"));
        var correlationId = new CorrelationId(Guid.Parse("20000000-0000-0000-0000-000000000002"));
        var accountId = AccountId.New();
        var characterId = CharacterId.New();
        var itemId = ItemInstanceId.New();
        var definition = new EquippableItemDefinition(
            new ContentDefinitionId("iron-sword"),
            new[] { new EquipmentPlacementDefinition(MainHandPlacement, new[] { MainHand }) });
        var definitionKey = new ContentDefinitionKey(definition.Contract, definition.DefinitionId);
        var actor = TrustedActorContext.CreatePlayer(
            accountId,
            characterId,
            991,
            new[] { new PlatformCapabilityKey(CapabilitySecret) },
            new[] { new EntitlementKey(EntitlementSecret) });
        var request = new CoreEvaluationRequest(
            CoreContractVersion.V1,
            new CoreEvaluationContext(
                commandId,
                correlationId,
                actor,
                EvaluatedAt,
                new RuleVersion("equip-rules-v1"),
                new ContentVersion("equip-content-v1"),
                new SecretBearingRandomFactory(RandomSecret)),
            new EquipItemIntent(characterId, itemId, MainHandPlacement),
            new IAuthoritativeSnapshot[]
            {
                new InventorySnapshot(characterId, 5, new[] { new InventoryItemReference(itemId, definitionKey) }),
                new EquipmentSnapshot(characterId, 9, Array.Empty<EquippedItemBinding>()),
                new CombatParticipationSnapshot(characterId, 3, false)
            },
            new[] { definition });
        var engine = new CoreRulesEngine();
        var decision = engine.Evaluate(request);
        var codec = new EquipItemCanonicalCommandCodec();
        var plan = new CommandCommitPlanBuilder().Build(
            request,
            codec.Serialize(request.Intent).Fingerprint,
            CommandReceiptClaim.Acquired(correlationId, CommandExecutionToken.New()),
            decision,
            engine.Descriptor,
            CompletedAt);
        var randomReference = new RestrictedReplayRandomReference(
            Guid.Parse("30000000-0000-0000-0000-000000000003"));
        var metadata = new ReplayCaptureMetadata(
            ReplayProvenanceKind.ProductionHistory,
            ReplaySourceFingerprint.Compute(Encoding.UTF8.GetBytes("private-production-source-reference")),
            CapturedAt,
            tags,
            randomReference,
            TimeSpan.FromMilliseconds(7));

        return new Fixture(
            accountId,
            characterId,
            itemId,
            randomReference,
            request,
            decision,
            plan,
            new ReplayCapture(request, decision, plan, metadata));
    }

    private sealed record Fixture(
        AccountId AccountId,
        CharacterId CharacterId,
        ItemInstanceId ItemId,
        RestrictedReplayRandomReference RandomReference,
        CoreEvaluationRequest Request,
        CoreDecision Decision,
        CommandCommitPlan Plan,
        ReplayCapture Capture);

    private sealed record SecretBearingIntent(string Credential) : ICoreIntent
    {
        public ContractDescriptor Contract { get; } = new("tests.secret-bearing-intent", 1);
    }

    private sealed class CompletenessReplayCodec : IReplayScenarioCodec
    {
        public ContractDescriptor IntentContract => EquipItemIntent.IntentContract;

        public string Encode(ReplayCapture capture, ReplayPseudonymizationKey pseudonymizationKey) =>
            "{\"credential\":\"must-not-be-retained\"}";

        public ReplayExecutableScenario Decode(
            string canonicalJson,
            IRestrictedReplayRandomResolver randomResolver) =>
            throw new NotSupportedException();

        public string DecisionFingerprint(CoreDecision decision) =>
            throw new NotSupportedException();
    }

    private sealed class SecretBearingRandomFactory : IDeterministicRandomFactory
    {
        private readonly string _secret;

        public SecretBearingRandomFactory(string secret) => _secret = secret;

        public IDeterministicRandomSource Create() => new FixedRandomSource((ulong)_secret.Length);
    }

    private sealed class FixedRandomResolver : IRestrictedReplayRandomResolver
    {
        private readonly RestrictedReplayRandomReference _expected;

        public FixedRandomResolver(RestrictedReplayRandomReference expected) => _expected = expected;

        public IDeterministicRandomFactory Resolve(RestrictedReplayRandomReference reference)
        {
            Assert.AreEqual(_expected, reference);
            return new SecretBearingRandomFactory(RandomSecret);
        }
    }

    private sealed class FixedRandomSource : IDeterministicRandomSource
    {
        private readonly ulong _value;

        public FixedRandomSource(ulong value) => _value = value;

        public ulong NextUInt64() => _value;
    }
}
