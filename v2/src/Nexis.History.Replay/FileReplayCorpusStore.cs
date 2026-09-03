using Nexis.Operations.Contracts;

namespace Nexis.History.Replay;

public enum ReplayRetentionDisposition
{
    Created = 0,
    AlreadyPresent = 1
}

/// <summary>
/// Immutable content-addressed filesystem retention for privacy-filtered replay artifacts. This
/// adapter never accepts raw production command/event records and never overwrites an existing case.
/// </summary>
public sealed class FileReplayCorpusStore
{
    private const string Extension = ".replay.v1.json";

    private static readonly OperationalComponentKey OperationalComponent = new("replay.corpus-store");
    private static readonly OperationalReasonCode SubmittedContentAddressMismatchReason =
        new("replay.submitted_content_address_mismatch");
    private static readonly OperationalReasonCode RetentionSizeExceededReason =
        new("replay.retention_size_exceeded");
    private static readonly OperationalReasonCode ScenarioCollisionReason =
        new("replay.scenario_id_collision");
    private static readonly OperationalReasonCode RetainedSizeExceededReason =
        new("replay.retained_size_exceeded");
    private static readonly OperationalReasonCode RetainedUnreviewedSchemaReason =
        new("replay.retained_unreviewed_schema_version");
    private static readonly OperationalReasonCode RetainedMalformedReason =
        new("replay.retained_artifact_malformed");
    private static readonly OperationalReasonCode RetainedContentAddressMismatchReason =
        new("replay.retained_content_address_mismatch");
    private readonly string _rootPath;
    private readonly ReplayOperationalReporter _reporter;

    public FileReplayCorpusStore(
        string rootPath,
        IOperationalSignalSink? operationalSignalSink = null,
        TimeProvider? timeProvider = null)
    {
        ArgumentException.ThrowIfNullOrWhiteSpace(rootPath);
        _rootPath = Path.GetFullPath(rootPath);
        _reporter = new ReplayOperationalReporter(operationalSignalSink, timeProvider);
        Directory.CreateDirectory(_rootPath);
    }

    private void ReportRejection(OperationalReasonCode reason) =>
        _reporter.Report(
            OperationalConditionKind.ReplayArtifactRejected,
            OperationalSeverity.Warning,
            OperationalComponent,
            reason);

    private void ReportCorruption(OperationalReasonCode reason) =>
        _reporter.Report(
            OperationalConditionKind.ReplayCorruption,
            OperationalSeverity.Critical,
            OperationalComponent,
            reason);

    public string GetArtifactPath(ReplayScenarioId scenarioId)
    {
        ArgumentNullException.ThrowIfNull(scenarioId);
        return Path.Combine(_rootPath, scenarioId.Value + Extension);
    }

    public async ValueTask<ReplayRetentionDisposition> RetainAsync(
        ReplayCorpusArtifact artifact,
        CancellationToken cancellationToken = default)
    {
        ArgumentNullException.ThrowIfNull(artifact);
        if (!artifact.VerifyIntegrity())
        {
            ReportCorruption(SubmittedContentAddressMismatchReason);
            throw new InvalidDataException("Replay artifact failed content-address integrity verification.");
        }
        if (System.Text.Encoding.UTF8.GetByteCount(artifact.CanonicalJson) >
            ReplayCorpusArtifact.MaximumCanonicalJsonUtf8Bytes)
        {
            ReportRejection(RetentionSizeExceededReason);
            throw new InvalidDataException("Replay artifact exceeds the reviewed retention size limit.");
        }

        var path = GetArtifactPath(artifact.ScenarioId);
        var temporaryPath = Path.Combine(
            _rootPath,
            $".{artifact.ScenarioId.Value}.{Guid.NewGuid():N}.tmp");
        try
        {
            await using (var stream = new FileStream(
                temporaryPath,
                FileMode.CreateNew,
                FileAccess.Write,
                FileShare.None,
                bufferSize: 4096,
                FileOptions.Asynchronous | FileOptions.WriteThrough))
            {
                await using var writer = new StreamWriter(
                    stream,
                    new System.Text.UTF8Encoding(encoderShouldEmitUTF8Identifier: false));
                await writer.WriteAsync(artifact.CanonicalJson.AsMemory(), cancellationToken);
                await writer.FlushAsync(cancellationToken);
            }

            File.Move(temporaryPath, path);
            return ReplayRetentionDisposition.Created;
        }
        catch (IOException) when (File.Exists(path))
        {
            // ReadAsync owns every retained-artifact condition. When it throws it has already reported
            // the precise reason, so this path adds nothing and exactly one signal describes one
            // logical failure. Reaching the collision branch below instead means the retained bytes
            // hash to this scenario ID while differing from the submitted JSON, which is a genuine
            // content-address collision or same-address tamper and cannot be produced by a test.
            var retained = await ReadAsync(artifact.ScenarioId, cancellationToken);
            if (!StringComparer.Ordinal.Equals(retained.CanonicalJson, artifact.CanonicalJson))
            {
                ReportCorruption(ScenarioCollisionReason);
                throw new InvalidDataException("Replay scenario ID collision or existing artifact tampering detected.");
            }

            return ReplayRetentionDisposition.AlreadyPresent;
        }
        finally
        {
            if (File.Exists(temporaryPath))
            {
                File.Delete(temporaryPath);
            }
        }
    }

    public async ValueTask<ReplayCorpusArtifact> ReadAsync(
        ReplayScenarioId scenarioId,
        CancellationToken cancellationToken = default)
    {
        ArgumentNullException.ThrowIfNull(scenarioId);
        var path = GetArtifactPath(scenarioId);
        var file = new FileInfo(path);
        if (file.Length > ReplayCorpusArtifact.MaximumCanonicalJsonUtf8Bytes)
        {
            // Retention enforced this bound before writing, so a stored file above it has changed
            // since it was written rather than merely failing an intake policy.
            ReportCorruption(RetainedSizeExceededReason);
            throw new InvalidDataException("Retained replay artifact exceeds the reviewed ingestion size limit.");
        }

        var canonicalJson = await File.ReadAllTextAsync(path, cancellationToken);
        ReplayCorpusArtifact artifact;
        try
        {
            artifact = ReplayCorpusArtifact.Parse(canonicalJson);
        }
        catch (NotSupportedException exception)
        {
            // The stored bytes parsed; the corpus simply has no reviewed codec for this corpus or
            // intent contract version. That is a policy rejection, not damaged evidence.
            ReportRejection(RetainedUnreviewedSchemaReason);
            throw new InvalidDataException("Retained replay artifact is malformed or uses an unsupported schema.", exception);
        }
        catch (FormatException exception)
        {
            // Retention only ever writes envelopes that already parsed, so a stored artifact that no
            // longer parses is damaged evidence rather than an unreviewed submission.
            ReportCorruption(RetainedMalformedReason);
            throw new InvalidDataException("Retained replay artifact is malformed or uses an unsupported schema.", exception);
        }
        if (artifact.ScenarioId != scenarioId || !artifact.VerifyIntegrity())
        {
            ReportCorruption(RetainedContentAddressMismatchReason);
            throw new InvalidDataException("Retained replay artifact does not match its content-addressed filename.");
        }

        return artifact;
    }
}
