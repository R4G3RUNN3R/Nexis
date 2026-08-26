using System.Collections;
using Nexis.Audit.Contracts;
using Nexis.Core.Contracts;
using Nexis.Eventing.Contracts;
using Nexis.Identity.Contracts;
using Nexis.Kernel.Events;

namespace Nexis.History.Contracts;

public enum PlayerLogAudienceKind
{
    Account = 0,
    Character = 10
}

/// <summary>
/// Explicit audience for a player-facing history entry. Account and Character remain permanently
/// distinct identities; projection code must choose one rather than assuming they are interchangeable.
/// </summary>
public sealed record PlayerLogAudience
{
    public PlayerLogAudience(
        PlayerLogAudienceKind kind,
        AccountId? accountId,
        CharacterId? characterId)
    {
        if (!Enum.IsDefined(typeof(PlayerLogAudienceKind), kind))
        {
            throw new ArgumentOutOfRangeException(nameof(kind));
        }

        var valid = kind switch
        {
            PlayerLogAudienceKind.Account => accountId is { IsEmpty: false } && characterId is null,
            PlayerLogAudienceKind.Character => characterId is { IsEmpty: false } && accountId is null,
            _ => false
        };

        if (!valid)
        {
            throw new ArgumentException("Player Log audience identity does not match its declared kind.");
        }

        Kind = kind;
        AccountId = accountId;
        CharacterId = characterId;
    }

    public PlayerLogAudienceKind Kind { get; }

    public AccountId? AccountId { get; }

    public CharacterId? CharacterId { get; }

    public static PlayerLogAudience ForAccount(AccountId accountId) =>
        new(PlayerLogAudienceKind.Account, accountId, null);

    public static PlayerLogAudience ForCharacter(CharacterId characterId) =>
        new(PlayerLogAudienceKind.Character, null, characterId);
}

public enum PlayerLogSourceKind
{
    AuthoritativeEvent = 0,
    AdministrativeAudit = 10
}

/// <summary>
/// Permanent provenance for one projection entry. The source points back to immutable internal
/// history/audit truth without exposing that source payload to the player.
/// </summary>
public sealed record PlayerLogSource
{
    public PlayerLogSource(PlayerLogSourceKind kind, Guid sourceId)
    {
        if (!Enum.IsDefined(typeof(PlayerLogSourceKind), kind))
        {
            throw new ArgumentOutOfRangeException(nameof(kind));
        }

        if (sourceId == Guid.Empty)
        {
            throw new ArgumentException("Player Log source identity cannot be empty.", nameof(sourceId));
        }

        Kind = kind;
        SourceId = sourceId;
    }

    public PlayerLogSourceKind Kind { get; }

    public Guid SourceId { get; }

    public static PlayerLogSource FromEvent(EventId eventId) =>
        new(PlayerLogSourceKind.AuthoritativeEvent, eventId.Value);

    public static PlayerLogSource FromAudit(AuditId auditId) =>
        new(PlayerLogSourceKind.AdministrativeAudit, auditId.Value);
}

public sealed record PlayerLogCategoryKey
{
    public PlayerLogCategoryKey(string value)
    {
        Value = PlayerLogText.NormalizeKey(value, 64, nameof(value));
    }

    public string Value { get; }

    public override string ToString() => Value;
}

public sealed record PlayerLogTemplateKey
{
    public PlayerLogTemplateKey(string value)
    {
        Value = PlayerLogText.NormalizeKey(value, 128, nameof(value));
    }

    public string Value { get; }

    public override string ToString() => Value;
}

/// <summary>
/// Plain-text projection value. Control characters are collapsed before storage/rendering and the
/// value is bounded. Presentation code must still encode it for its output medium; this is never HTML.
/// </summary>
public sealed record PlayerLogPlainText
{
    public PlayerLogPlainText(string value)
    {
        Value = PlayerLogText.NormalizePlainText(value, 512, nameof(value));
    }

    public string Value { get; }

    public override string ToString() => Value;
}

public sealed record PlayerLogArgument
{
    public PlayerLogArgument(string key, PlayerLogPlainText value)
    {
        Key = PlayerLogText.NormalizeKey(key, 64, nameof(key));
        Value = value ?? throw new ArgumentNullException(nameof(value));
    }

    public string Key { get; }

    public PlayerLogPlainText Value { get; }
}

/// <summary>
/// Canonically ordered value-equal argument set so deterministic re-projection does not depend on
/// collection insertion order or backing-array identity.
/// </summary>
public sealed class PlayerLogArgumentSet : IReadOnlyList<PlayerLogArgument>, IEquatable<PlayerLogArgumentSet>
{
    private readonly PlayerLogArgument[] _arguments;

    public PlayerLogArgumentSet(IEnumerable<PlayerLogArgument>? arguments = null)
    {
        var frozen = (arguments ?? Array.Empty<PlayerLogArgument>()).ToArray();
        if (frozen.Any(static argument => argument is null))
        {
            throw new ArgumentException("Player Log arguments cannot contain null entries.", nameof(arguments));
        }

        if (frozen.Select(static argument => argument.Key).Distinct(StringComparer.Ordinal).Count() != frozen.Length)
        {
            throw new ArgumentException("Player Log arguments cannot contain duplicate keys.", nameof(arguments));
        }

        _arguments = frozen
            .OrderBy(static argument => argument.Key, StringComparer.Ordinal)
            .ToArray();
    }

    public int Count => _arguments.Length;

    public PlayerLogArgument this[int index] => _arguments[index];

    public bool Equals(PlayerLogArgumentSet? other) =>
        ReferenceEquals(this, other) ||
        (other is not null && _arguments.SequenceEqual(other._arguments));

    public override bool Equals(object? obj) => obj is PlayerLogArgumentSet other && Equals(other);

    public override int GetHashCode()
    {
        var hash = new HashCode();
        foreach (var argument in _arguments)
        {
            hash.Add(argument);
        }

        return hash.ToHashCode();
    }

    public IEnumerator<PlayerLogArgument> GetEnumerator() =>
        ((IEnumerable<PlayerLogArgument>)_arguments).GetEnumerator();

    IEnumerator IEnumerable.GetEnumerator() => GetEnumerator();
}

/// <summary>
/// Safe player-facing history projection. This is rebuildable read-model data, never authoritative
/// gameplay state and never a raw copy of an authoritative event or Admin audit payload.
/// </summary>
public sealed record PlayerLogEntry
{
    public PlayerLogEntry(
        PlayerLogAudience audience,
        PlayerLogSource source,
        CorrelationId correlationId,
        DateTimeOffset occurredAtUtc,
        PlayerLogCategoryKey category,
        PlayerLogTemplateKey template,
        IEnumerable<PlayerLogArgument>? arguments = null)
    {
        if (correlationId.Value == Guid.Empty)
        {
            throw new ArgumentException("Player Log correlation identity cannot be empty.", nameof(correlationId));
        }

        if (occurredAtUtc.Offset != TimeSpan.Zero)
        {
            throw new ArgumentException("Player Log occurrence time must be UTC.", nameof(occurredAtUtc));
        }

        Audience = audience ?? throw new ArgumentNullException(nameof(audience));
        Source = source ?? throw new ArgumentNullException(nameof(source));
        CorrelationId = correlationId;
        OccurredAtUtc = occurredAtUtc;
        Category = category ?? throw new ArgumentNullException(nameof(category));
        Template = template ?? throw new ArgumentNullException(nameof(template));
        Arguments = new PlayerLogArgumentSet(arguments);
    }

    public PlayerLogAudience Audience { get; }

    public PlayerLogSource Source { get; }

    public CorrelationId CorrelationId { get; }

    public DateTimeOffset OccurredAtUtc { get; }

    public PlayerLogCategoryKey Category { get; }

    public PlayerLogTemplateKey Template { get; }

    public PlayerLogArgumentSet Arguments { get; }
}

/// <summary>
/// Explicit event-to-Player-Log projection boundary. There is no generic fallback projector: event
/// contracts that have not deliberately registered a safe projector remain invisible to Player Log.
/// </summary>
public interface IPlayerLogEventProjector
{
    ContractDescriptor SourceContract { get; }

    IReadOnlyList<PlayerLogEntry> Project(CommittedEventMessage message);
}

public interface IPlayerLogAuditProjector
{
    IReadOnlyList<PlayerLogEntry> Project(AuditEntry entry);
}

internal static class PlayerLogText
{
    public static string NormalizeKey(string value, int maximumLength, string parameterName)
    {
        ArgumentException.ThrowIfNullOrWhiteSpace(value, parameterName);
        var normalized = value.Trim().ToLowerInvariant();
        if (normalized.Length > maximumLength)
        {
            throw new ArgumentOutOfRangeException(parameterName, $"Player Log keys cannot exceed {maximumLength} characters.");
        }

        if (normalized.Any(static character =>
            !(char.IsAsciiLetterOrDigit(character) || character is '.' or '-' or '_')))
        {
            throw new ArgumentException("Player Log keys may contain only ASCII letters, digits, '.', '-' and '_'.", parameterName);
        }

        return normalized;
    }

    public static string NormalizePlainText(string value, int maximumLength, string parameterName)
    {
        ArgumentException.ThrowIfNullOrWhiteSpace(value, parameterName);

        var characters = value.Trim()
            .Select(static character => char.IsControl(character) ? ' ' : character)
            .ToArray();
        var normalized = new string(characters);
        while (normalized.Contains("  ", StringComparison.Ordinal))
        {
            normalized = normalized.Replace("  ", " ", StringComparison.Ordinal);
        }

        if (string.IsNullOrWhiteSpace(normalized))
        {
            throw new ArgumentException("Player Log plain text cannot normalize to an empty value.", parameterName);
        }

        if (normalized.Length > maximumLength)
        {
            throw new ArgumentOutOfRangeException(parameterName, $"Player Log plain text cannot exceed {maximumLength} characters.");
        }

        return normalized;
    }
}
