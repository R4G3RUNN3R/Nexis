using Nexis.Content.Contracts;
using Nexis.Core.Contracts;

namespace Nexis.Content.Registry;

public sealed record ContentRegistryEntry
{
    public ContentRegistryEntry(
        ContentVersion version,
        IVersionedContentDefinition definition)
    {
        Version = version ?? throw new ArgumentNullException(nameof(version));
        Definition = definition ?? throw new ArgumentNullException(nameof(definition));
    }

    public ContentVersion Version { get; }

    public IVersionedContentDefinition Definition { get; }
}

/// <summary>
/// Small immutable reference implementation used for composition/tests and static content packs.
/// It intentionally resolves only an exact ContentVersion + exact typed key and never falls back to
/// a newer/older/latest definition.
/// </summary>
public sealed class ImmutableContentRegistry : IContentRegistryReader
{
    private readonly IReadOnlyDictionary<RegistryKey, IVersionedContentDefinition> _definitions;

    public ImmutableContentRegistry(IEnumerable<ContentRegistryEntry> entries)
    {
        ArgumentNullException.ThrowIfNull(entries);

        var definitions = new Dictionary<RegistryKey, IVersionedContentDefinition>();
        foreach (var entry in entries)
        {
            if (entry is null)
            {
                throw new ArgumentException("Content registry entries cannot contain null values.", nameof(entries));
            }

            var registryKey = new RegistryKey(entry.Version, entry.Definition.Key);
            if (!definitions.TryAdd(registryKey, entry.Definition))
            {
                throw new ArgumentException(
                    $"Duplicate content definition '{entry.Definition.Key}' for version '{entry.Version.Value}'.",
                    nameof(entries));
            }
        }

        _definitions = definitions;
    }

    public ValueTask<ContentResolution> ResolveAsync(
        ContentResolutionRequest request,
        CancellationToken cancellationToken = default)
    {
        ArgumentNullException.ThrowIfNull(request);
        cancellationToken.ThrowIfCancellationRequested();

        var resolved = new IVersionedContentDefinition[request.Keys.Count];
        for (var index = 0; index < request.Keys.Count; index++)
        {
            var key = request.Keys[index];
            if (!_definitions.TryGetValue(new RegistryKey(request.Version, key), out var definition))
            {
                throw new ContentDefinitionNotFoundException(request.Version, key);
            }

            resolved[index] = definition;
        }

        return ValueTask.FromResult(new ContentResolution(request, resolved));
    }

    private sealed record RegistryKey(ContentVersion Version, ContentDefinitionKey DefinitionKey);
}
