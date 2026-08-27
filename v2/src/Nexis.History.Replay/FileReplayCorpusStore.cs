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
    private readonly string _rootPath;

    public FileReplayCorpusStore(string rootPath)
    {
        ArgumentException.ThrowIfNullOrWhiteSpace(rootPath);
        _rootPath = Path.GetFullPath(rootPath);
        Directory.CreateDirectory(_rootPath);
    }

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
            throw new InvalidDataException("Replay artifact failed content-address integrity verification.");
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
            var retained = await ReadAsync(artifact.ScenarioId, cancellationToken);
            if (!StringComparer.Ordinal.Equals(retained.CanonicalJson, artifact.CanonicalJson))
            {
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
        var canonicalJson = await File.ReadAllTextAsync(path, cancellationToken);
        ReplayCorpusArtifact artifact;
        try
        {
            artifact = ReplayCorpusArtifact.Parse(canonicalJson);
        }
        catch (Exception exception) when (exception is FormatException or NotSupportedException)
        {
            throw new InvalidDataException("Retained replay artifact is malformed or uses an unsupported schema.", exception);
        }
        if (artifact.ScenarioId != scenarioId || !artifact.VerifyIntegrity())
        {
            throw new InvalidDataException("Retained replay artifact does not match its content-addressed filename.");
        }

        return artifact;
    }
}
