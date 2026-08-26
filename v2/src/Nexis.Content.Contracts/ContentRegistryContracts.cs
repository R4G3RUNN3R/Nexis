using Nexis.Core.Contracts;

namespace Nexis.Content.Contracts;

/// <summary>
/// Stable identifier for one static/versioned content definition. This identifies content only;
/// it is never a gameplay-state key or generic property path.
/// </summary>
public sealed record ContentDefinitionId
{
    public ContentDefinitionId(string value)
    {
        ArgumentException.ThrowIfNullOrWhiteSpace(value);
        var normalized = value.Trim();
        if (normalized.Length > 200)
        {
            throw new ArgumentOutOfRangeException(nameof(value), "Content definition identifiers cannot exceed 200 characters.");
        }

        Value = normalized;
    }

    public string Value { get; }

    public override string ToString() => Value;
}

/// <summary>
/// Exact lookup key: typed definition contract/schema + stable definition identifier.
/// </summary>
public sealed record ContentDefinitionKey
{
    public ContentDefinitionKey(ContractDescriptor contract, ContentDefinitionId definitionId)
    {
        Contract = contract ?? throw new ArgumentNullException(nameof(contract));
        DefinitionId = definitionId ?? throw new ArgumentNullException(nameof(definitionId));
    }

    public ContractDescriptor Contract { get; }

    public ContentDefinitionId DefinitionId { get; }

    public override string ToString() => $"{Contract.Name}@{Contract.SchemaVersion}:{DefinitionId.Value}";
}

/// <summary>
/// Marker for immutable typed static definitions supplied to Core. Implementations remain ordinary
/// typed records/classes; this contract deliberately does not expose Dictionary/string-object/JSON
/// mutation APIs.
/// </summary>
public interface IVersionedContentDefinition : ICoreContentInput
{
    ContentDefinitionId DefinitionId { get; }

    ContentDefinitionKey Key => new(Contract, DefinitionId);
}

/// <summary>
/// Exact-version content request assembled by Application before Core evaluation. There is no
/// implicit latest-version behavior: callers must name the authoritative ContentVersion.
/// </summary>
public sealed class ContentResolutionRequest
{
    public ContentResolutionRequest(
        ContentVersion version,
        IEnumerable<ContentDefinitionKey> keys)
    {
        Version = version ?? throw new ArgumentNullException(nameof(version));
        ArgumentNullException.ThrowIfNull(keys);

        var frozen = keys.ToArray();
        if (frozen.Any(static key => key is null))
        {
            throw new ArgumentException("Content resolution keys cannot contain null entries.", nameof(keys));
        }

        if (frozen.Distinct().Count() != frozen.Length)
        {
            throw new ArgumentException("Content resolution requests cannot contain duplicate definition keys.", nameof(keys));
        }

        Keys = Array.AsReadOnly(frozen);
    }

    public ContentVersion Version { get; }

    public IReadOnlyList<ContentDefinitionKey> Keys { get; }
}

/// <summary>
/// Fully resolved immutable content set for one exact registry version. Definitions are required to
/// match the requested keys one-for-one and in request order so replay/canonicalization is stable.
/// </summary>
public sealed class ContentResolution
{
    public ContentResolution(
        ContentResolutionRequest request,
        IEnumerable<IVersionedContentDefinition> definitions)
    {
        Request = request ?? throw new ArgumentNullException(nameof(request));
        ArgumentNullException.ThrowIfNull(definitions);

        var frozen = definitions.ToArray();
        if (frozen.Any(static definition => definition is null))
        {
            throw new ArgumentException("Resolved content definitions cannot contain null entries.", nameof(definitions));
        }

        if (frozen.Length != Request.Keys.Count)
        {
            throw new ArgumentException("Resolved content count must exactly match the requested key count.", nameof(definitions));
        }

        for (var index = 0; index < frozen.Length; index++)
        {
            if (frozen[index].Key != Request.Keys[index])
            {
                throw new ArgumentException(
                    $"Resolved definition at index {index} does not match requested key '{Request.Keys[index]}'.",
                    nameof(definitions));
            }
        }

        Definitions = Array.AsReadOnly(frozen);
    }

    public ContentResolutionRequest Request { get; }

    public ContentVersion Version => Request.Version;

    public IReadOnlyList<IVersionedContentDefinition> Definitions { get; }

    public IReadOnlyList<ICoreContentInput> AsCoreInputs() =>
        Array.AsReadOnly(Definitions.Cast<ICoreContentInput>().ToArray());
}

public sealed class ContentDefinitionNotFoundException : Exception
{
    public ContentDefinitionNotFoundException(
        ContentVersion version,
        ContentDefinitionKey key)
        : base($"Content definition '{key}' was not found in content version '{version?.Value}'.")
    {
        Version = version ?? throw new ArgumentNullException(nameof(version));
        Key = key ?? throw new ArgumentNullException(nameof(key));
    }

    public ContentVersion Version { get; }

    public ContentDefinitionKey Key { get; }
}

/// <summary>
/// Infrastructure-neutral read boundary used by Application to gather the exact static definitions
/// required by one Core evaluation. Implementations may use files, immutable packs, PostgreSQL or
/// caches, but the resolved authoritative version and typed definitions must remain exact.
/// </summary>
public interface IContentRegistryReader
{
    ValueTask<ContentResolution> ResolveAsync(
        ContentResolutionRequest request,
        CancellationToken cancellationToken = default);
}
