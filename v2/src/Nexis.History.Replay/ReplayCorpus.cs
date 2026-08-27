using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using Nexis.Core.Contracts;
using Nexis.Execution.Contracts;
using Nexis.Kernel.Randomness;

namespace Nexis.History.Replay;

public readonly record struct ReplayCorpusVersion
{
    public static ReplayCorpusVersion V1 { get; } = new(1);

    public ReplayCorpusVersion(int value)
    {
        if (value <= 0)
        {
            throw new ArgumentOutOfRangeException(nameof(value), "Replay corpus versions must be positive.");
        }

        Value = value;
    }

    public int Value { get; }
}

public enum ReplayScenarioTag
{
    Ordinary = 0,
    KnownBug = 1,
    Exploit = 2,
    Concurrency = 3,
    HighValue = 4
}

public enum ReplayProvenanceKind
{
    ProductionHistory = 0,
    IncidentRegression = 1,
    HumanObserved = 2,
    AutomatedGenerated = 3,
    Synthetic = 4
}

public enum ReplayPersistenceOutcome
{
    Committed = 0,
    Rejected = 1,
    Conflicted = 2,
    TechnicalFailure = 3,
    Compensated = 4,
    Reversed = 5
}

public sealed record ReplaySourceFingerprint
{
    private const int Sha256HexLength = 64;

    private ReplaySourceFingerprint(string value) => Value = value;

    public string Value { get; }

    public static ReplaySourceFingerprint Compute(ReadOnlySpan<byte> sourceReference) =>
        new(Convert.ToHexString(SHA256.HashData(sourceReference)).ToLowerInvariant());

    public static ReplaySourceFingerprint Parse(string value)
    {
        ArgumentException.ThrowIfNullOrWhiteSpace(value);
        if (value.Length != Sha256HexLength || value.Any(static character => !Uri.IsHexDigit(character)))
        {
            throw new FormatException("Replay source fingerprints must be 64 hexadecimal SHA-256 characters.");
        }

        return new ReplaySourceFingerprint(value.ToLowerInvariant());
    }
}

public readonly record struct RestrictedReplayRandomReference
{
    public RestrictedReplayRandomReference(Guid value)
    {
        if (value == Guid.Empty)
        {
            throw new ArgumentException("Restricted replay RNG references cannot be empty.", nameof(value));
        }

        Value = value;
    }

    public Guid Value { get; }
}

public interface IRestrictedReplayRandomResolver
{
    IDeterministicRandomFactory Resolve(RestrictedReplayRandomReference reference);
}

public sealed record ReplayCaptureMetadata
{
    public ReplayCaptureMetadata(
        ReplayProvenanceKind provenanceKind,
        ReplaySourceFingerprint sourceFingerprint,
        DateTimeOffset capturedAtUtc,
        IEnumerable<ReplayScenarioTag> tags,
        RestrictedReplayRandomReference randomReference,
        TimeSpan evaluationDuration,
        ReplayPersistenceOutcome persistenceOutcome = ReplayPersistenceOutcome.Committed)
    {
        if (!Enum.IsDefined(provenanceKind))
        {
            throw new ArgumentOutOfRangeException(nameof(provenanceKind));
        }

        if (!Enum.IsDefined(persistenceOutcome))
        {
            throw new ArgumentOutOfRangeException(nameof(persistenceOutcome));
        }

        if (capturedAtUtc.Offset != TimeSpan.Zero)
        {
            throw new ArgumentException("Replay capture time must be UTC.", nameof(capturedAtUtc));
        }

        if (evaluationDuration < TimeSpan.Zero)
        {
            throw new ArgumentOutOfRangeException(nameof(evaluationDuration));
        }

        ArgumentNullException.ThrowIfNull(tags);
        var normalizedTags = tags.Distinct().Order().ToArray();
        if (normalizedTags.Length == 0 || normalizedTags.Any(static tag => !Enum.IsDefined(tag)))
        {
            throw new ArgumentException("Replay captures require at least one valid scenario tag.", nameof(tags));
        }

        ProvenanceKind = provenanceKind;
        SourceFingerprint = sourceFingerprint ?? throw new ArgumentNullException(nameof(sourceFingerprint));
        CapturedAtUtc = capturedAtUtc;
        Tags = Array.AsReadOnly(normalizedTags);
        RandomReference = randomReference;
        EvaluationDuration = evaluationDuration;
        PersistenceOutcome = persistenceOutcome;
    }

    public ReplayProvenanceKind ProvenanceKind { get; }

    public ReplaySourceFingerprint SourceFingerprint { get; }

    public DateTimeOffset CapturedAtUtc { get; }

    public IReadOnlyList<ReplayScenarioTag> Tags { get; }

    public RestrictedReplayRandomReference RandomReference { get; }

    public TimeSpan EvaluationDuration { get; }

    public ReplayPersistenceOutcome PersistenceOutcome { get; }
}

public sealed record ReplayCapture
{
    public ReplayCapture(
        CoreEvaluationRequest request,
        CoreDecision decision,
        CommandCommitPlan plan,
        ReplayCaptureMetadata metadata)
    {
        Request = request ?? throw new ArgumentNullException(nameof(request));
        Decision = decision ?? throw new ArgumentNullException(nameof(decision));
        Plan = plan ?? throw new ArgumentNullException(nameof(plan));
        Metadata = metadata ?? throw new ArgumentNullException(nameof(metadata));
    }

    public CoreEvaluationRequest Request { get; }

    public CoreDecision Decision { get; }

    public CommandCommitPlan Plan { get; }

    public ReplayCaptureMetadata Metadata { get; }
}

public sealed class ReplayPseudonymizationKey
{
    private readonly byte[] _key;

    private ReplayPseudonymizationKey(byte[] key) => _key = key;

    public static ReplayPseudonymizationKey FromBytes(ReadOnlySpan<byte> key)
    {
        if (key.Length < 32)
        {
            throw new ArgumentException("Replay pseudonymization keys must contain at least 256 bits.", nameof(key));
        }

        return new ReplayPseudonymizationKey(key.ToArray());
    }

    internal Guid Pseudonymize(Guid identity, string domain)
    {
        if (identity == Guid.Empty)
        {
            throw new ArgumentException("Replay identities cannot be empty.", nameof(identity));
        }

        ArgumentException.ThrowIfNullOrWhiteSpace(domain);
        using var hmac = new HMACSHA256(_key);
        var input = Encoding.UTF8.GetBytes($"{domain}:{identity:D}");
        var digest = hmac.ComputeHash(input);
        return new Guid(digest.AsSpan(0, 16));
    }
}

public sealed record ReplayScenarioId
{
    private const int Sha256HexLength = 64;

    private ReplayScenarioId(string value) => Value = value;

    public string Value { get; }

    internal static ReplayScenarioId FromCanonicalJson(string canonicalJson) =>
        new(Convert.ToHexString(SHA256.HashData(Encoding.UTF8.GetBytes(canonicalJson))).ToLowerInvariant());

    public static ReplayScenarioId Parse(string value)
    {
        ArgumentException.ThrowIfNullOrWhiteSpace(value);
        if (value.Length != Sha256HexLength || value.Any(static character => !Uri.IsHexDigit(character)))
        {
            throw new FormatException("Replay scenario IDs must be 64 hexadecimal SHA-256 characters.");
        }

        return new ReplayScenarioId(value.ToLowerInvariant());
    }

    public override string ToString() => Value;
}

public sealed class ReplayCorpusArtifact
{
    private ReplayCorpusArtifact(
        ReplayCorpusVersion corpusVersion,
        ReplayScenarioId scenarioId,
        ContractDescriptor intentContract,
        string canonicalJson)
    {
        CorpusVersion = corpusVersion;
        ScenarioId = scenarioId;
        IntentContract = intentContract;
        CanonicalJson = canonicalJson;
    }

    public ReplayCorpusVersion CorpusVersion { get; }

    public ReplayScenarioId ScenarioId { get; }

    public ContractDescriptor IntentContract { get; }

    public string CanonicalJson { get; }

    internal static ReplayCorpusArtifact Create(
        ReplayCorpusVersion corpusVersion,
        ContractDescriptor intentContract,
        string canonicalJson)
    {
        ArgumentNullException.ThrowIfNull(intentContract);
        ArgumentException.ThrowIfNullOrWhiteSpace(canonicalJson);
        return new ReplayCorpusArtifact(
            corpusVersion,
            ReplayScenarioId.FromCanonicalJson(canonicalJson),
            intentContract,
            canonicalJson);
    }

    public static ReplayCorpusArtifact Parse(string canonicalJson)
    {
        ArgumentException.ThrowIfNullOrWhiteSpace(canonicalJson);
        try
        {
            using var document = JsonDocument.Parse(canonicalJson);
            var root = document.RootElement;
            var version = new ReplayCorpusVersion(root.GetProperty("corpusVersion").GetInt32());
            var contractElement = root.GetProperty("intentContract");
            var contract = new ContractDescriptor(
                contractElement.GetProperty("name").GetString()
                    ?? throw new FormatException("Replay intent contract name cannot be null."),
                contractElement.GetProperty("schemaVersion").GetInt32());
            if (contract != Nexis.Equipment.Contracts.EquipItemIntent.IntentContract)
            {
                throw new NotSupportedException("Replay artifact uses an unreviewed intent contract.");
            }

            EquipItemReplayScenarioCodec.ValidateCanonicalEnvelope(canonicalJson);

            return Create(version, contract, canonicalJson);
        }
        catch (Exception exception) when (exception is JsonException or KeyNotFoundException or InvalidOperationException)
        {
            throw new FormatException("Replay corpus artifact is not a valid versioned envelope.", exception);
        }
    }

    public bool VerifyIntegrity() =>
        ScenarioId == ReplayScenarioId.FromCanonicalJson(CanonicalJson);
}

public sealed record ReplayComparison(
    bool IsEquivalent,
    CoreOutcomeStatus ActualStatus,
    string? Difference);

public interface IReplayScenarioCodec
{
    ContractDescriptor IntentContract { get; }

    string Encode(ReplayCapture capture, ReplayPseudonymizationKey pseudonymizationKey);

    ReplayExecutableScenario Decode(
        string canonicalJson,
        IRestrictedReplayRandomResolver randomResolver);

    string DecisionFingerprint(CoreDecision decision);
}

public sealed record ReplayExecutableScenario(
    CoreEvaluationRequest Request,
    string ExpectedDecisionFingerprint);

public sealed class ReplayCorpusExtractor
{
    private readonly IReadOnlyDictionary<ContractDescriptor, IReplayScenarioCodec> _codecs;
    private readonly ReplayPseudonymizationKey _pseudonymizationKey;

    public ReplayCorpusExtractor(
        IEnumerable<IReplayScenarioCodec> codecs,
        ReplayPseudonymizationKey pseudonymizationKey)
    {
        ArgumentNullException.ThrowIfNull(codecs);
        var registered = new Dictionary<ContractDescriptor, IReplayScenarioCodec>();
        foreach (var codec in codecs)
        {
            if (codec is null)
            {
                throw new ArgumentException("Replay codec collections cannot contain null entries.", nameof(codecs));
            }

            if (!registered.TryAdd(codec.IntentContract, codec))
            {
                throw new ArgumentException(
                    $"A replay codec is already registered for '{codec.IntentContract.Name}' schema {codec.IntentContract.SchemaVersion}.",
                    nameof(codecs));
            }
        }

        _codecs = registered;
        _pseudonymizationKey = pseudonymizationKey ?? throw new ArgumentNullException(nameof(pseudonymizationKey));
    }

    public ReplayCorpusArtifact Extract(ReplayCapture capture)
    {
        ArgumentNullException.ThrowIfNull(capture);
        var contract = capture.Request.Intent.Contract;
        var codec = _codecs.TryGetValue(contract, out var registered)
            ? registered
            : throw new KeyNotFoundException(
                $"No privacy-reviewed replay codec is registered for '{contract.Name}' schema {contract.SchemaVersion}.");
        ValidateTrace(capture);
        var canonicalJson = codec.Encode(capture, _pseudonymizationKey);
        var artifact = ReplayCorpusArtifact.Parse(canonicalJson);
        if (artifact.CorpusVersion != ReplayCorpusVersion.V1 || artifact.IntentContract != contract)
        {
            throw new InvalidOperationException("Replay codec emitted an artifact for the wrong corpus or intent contract version.");
        }

        return artifact;
    }

    private static void ValidateTrace(ReplayCapture capture)
    {
        var request = capture.Request;
        var trace = capture.Plan.Trace;
        if (trace.Identity.CommandId != request.Context.CommandId ||
            trace.Identity.IntentContract != request.Intent.Contract ||
            trace.Identity.Actor != CommandActorBinding.From(request.Context.Actor) ||
            trace.CoreContractVersion != request.ContractVersion ||
            trace.RuleVersion != request.Context.RuleVersion ||
            trace.ContentVersion != request.Context.ContentVersion ||
            trace.EvaluatedAtUtc != request.Context.EvaluationTimeUtc)
        {
            throw new InvalidOperationException("Replay capture request and authoritative command trace are inconsistent.");
        }

        var expectedStatus = (CommandTerminalStatus)capture.Decision.Status;
        if (capture.Plan.TerminalOutcome.Status != expectedStatus ||
            capture.Plan.TerminalOutcome.Reason?.Value != capture.Decision.Reason?.Value ||
            !capture.Plan.Transitions.SequenceEqual(capture.Decision.Transitions) ||
            !capture.Plan.Events.Select(static item => item.Descriptor).SequenceEqual(capture.Decision.Events))
        {
            throw new InvalidOperationException("Replay capture decision and terminal command plan are inconsistent.");
        }
    }
}

public sealed class ReplayCorpusRunner
{
    private readonly IReadOnlyDictionary<ContractDescriptor, IReplayScenarioCodec> _codecs;

    public ReplayCorpusRunner(IEnumerable<IReplayScenarioCodec> codecs)
    {
        ArgumentNullException.ThrowIfNull(codecs);
        _codecs = codecs.ToDictionary(static codec => codec.IntentContract);
    }

    public ReplayComparison Run(
        ReplayCorpusArtifact artifact,
        ICoreRulesEngine core,
        IRestrictedReplayRandomResolver randomResolver)
    {
        ArgumentNullException.ThrowIfNull(artifact);
        ArgumentNullException.ThrowIfNull(core);
        ArgumentNullException.ThrowIfNull(randomResolver);
        if (!artifact.VerifyIntegrity())
        {
            throw new InvalidDataException("Replay artifact content does not match its content-addressed scenario ID.");
        }

        var codec = _codecs.TryGetValue(artifact.IntentContract, out var registered)
            ? registered
            : throw new KeyNotFoundException(
                $"No replay codec is registered for '{artifact.IntentContract.Name}' schema {artifact.IntentContract.SchemaVersion}.");
        var scenario = codec.Decode(artifact.CanonicalJson, randomResolver);
        if (!core.Supports(scenario.Request.ContractVersion))
        {
            throw new InvalidOperationException("Selected Core does not support the replay scenario contract version.");
        }

        var actual = core.Evaluate(scenario.Request);
        var actualFingerprint = codec.DecisionFingerprint(actual);
        var equivalent = StringComparer.Ordinal.Equals(actualFingerprint, scenario.ExpectedDecisionFingerprint);
        return new ReplayComparison(
            equivalent,
            actual.Status,
            equivalent ? null : "Candidate Core decision differs from the retained authoritative decision.");
    }
}
