using Nexis.Identity.Contracts;
using Nexis.Kernel.Events;

namespace Nexis.Audit.Contracts;

public readonly record struct AuditId
{
    public AuditId(Guid value)
    {
        if (value == Guid.Empty)
        {
            throw new ArgumentException("AuditId cannot be empty.", nameof(value));
        }

        Value = value;
    }

    public Guid Value { get; }

    public bool IsEmpty => Value == Guid.Empty;

    public static AuditId New() => new(Guid.NewGuid());
}

public enum AuditVisibility
{
    InternalOnly = 0,
    PlayerMaterialEffect = 10
}

public enum AuditActionKind
{
    PrivilegedRead = 0,
    StateMutation = 10,
    ModerationAction = 20,
    AntiCheatInspection = 30,
    Correction = 40,
    Reversal = 50
}

/// <summary>
/// Immutable administrative audit fact. Player-visible material-effect projections are derived
/// separately; the internal audit record itself is never rewritten to change what happened.
/// </summary>
/// <summary>
/// Write-boundary rules for player-disclosable Admin Audit text.
///
/// Audit history is append-only and immutable, so a reason the Player Log cannot project would be a
/// permanently poisoned row that throws on every projection attempt. The write boundary therefore
/// applies exactly the normalization and bound the Player Log plain-text boundary applies, and
/// rejects rather than truncates: silently shortening a staff-written reason would change the
/// recorded justification for a privileged action.
///
/// Nexis.Audit.Contracts cannot reference Nexis.History.Contracts without a dependency cycle, so the
/// rules are restated here and an architecture test asserts the two boundaries agree exactly on
/// adversarial inputs. Drift fails the suite.
/// </summary>
public static class PlayerDisclosableAuditText
{
    /// <summary>Must equal the Player Log plain-text bound.</summary>
    public const int MaximumLength = 512;

    public static string Normalize(string value, string parameterName)
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
            throw new ArgumentException(
                "Player-disclosable audit reason cannot normalize to an empty value.",
                parameterName);
        }

        if (normalized.Length > MaximumLength)
        {
            throw new ArgumentOutOfRangeException(
                parameterName,
                $"Player-disclosable audit reason cannot exceed {MaximumLength} characters. It is rejected "
                + "rather than truncated so the recorded justification is never silently altered.");
        }

        return normalized;
    }
}

public sealed record AuditEntry
{
    public AuditEntry(
        AuditId auditId,
        AccountId actingAccountId,
        AccountId? targetAccountId,
        AuditActionKind actionKind,
        AuditVisibility visibility,
        DateTimeOffset occurredAtUtc,
        string action,
        string outcome,
        string? safePlayerReason,
        string? caseReference,
        CorrelationId correlationId,
        EventId? causationEventId)
    {
        if (auditId.IsEmpty)
        {
            throw new ArgumentException("AuditId cannot be empty.", nameof(auditId));
        }

        if (actingAccountId.IsEmpty)
        {
            throw new ArgumentException("Acting AccountId cannot be empty.", nameof(actingAccountId));
        }

        if (targetAccountId is { IsEmpty: true })
        {
            throw new ArgumentException("Target AccountId cannot be empty when supplied.", nameof(targetAccountId));
        }

        if (!Enum.IsDefined(typeof(AuditActionKind), actionKind))
        {
            throw new ArgumentOutOfRangeException(nameof(actionKind));
        }

        if (!Enum.IsDefined(typeof(AuditVisibility), visibility))
        {
            throw new ArgumentOutOfRangeException(nameof(visibility));
        }

        if (occurredAtUtc.Offset != TimeSpan.Zero)
        {
            throw new ArgumentException("Audit occurrence time must be UTC.", nameof(occurredAtUtc));
        }

        ArgumentException.ThrowIfNullOrWhiteSpace(action);
        ArgumentException.ThrowIfNullOrWhiteSpace(outcome);

        if (correlationId.Value == Guid.Empty)
        {
            throw new ArgumentException("Audit CorrelationId cannot be empty.", nameof(correlationId));
        }

        if (causationEventId is { Value: var eventValue } && eventValue == Guid.Empty)
        {
            throw new ArgumentException("Causation EventId cannot be empty when supplied.", nameof(causationEventId));
        }

        AuditId = auditId;
        ActingAccountId = actingAccountId;
        TargetAccountId = targetAccountId;
        ActionKind = actionKind;
        Visibility = visibility;
        OccurredAtUtc = occurredAtUtc;
        Action = action;
        Outcome = outcome;
        // Validated whenever supplied, not only for currently player-visible entries: the field is
        // player-disclosable by definition and the row is immutable once written.
        SafePlayerReason = string.IsNullOrWhiteSpace(safePlayerReason)
            ? null
            : PlayerDisclosableAuditText.Normalize(safePlayerReason, nameof(safePlayerReason));
        CaseReference = NormalizeOptional(caseReference);
        CorrelationId = correlationId;
        CausationEventId = causationEventId;
    }

    public AuditId AuditId { get; }

    public AccountId ActingAccountId { get; }

    public AccountId? TargetAccountId { get; }

    public AuditActionKind ActionKind { get; }

    public AuditVisibility Visibility { get; }

    public DateTimeOffset OccurredAtUtc { get; }

    public string Action { get; }

    public string Outcome { get; }

    public string? SafePlayerReason { get; }

    public string? CaseReference { get; }

    public CorrelationId CorrelationId { get; }

    public EventId? CausationEventId { get; }

    private static string? NormalizeOptional(string? value) =>
        string.IsNullOrWhiteSpace(value) ? null : value.Trim();
}

/// <summary>
/// Append-only audit boundary for privileged operations that do not participate in a gameplay
/// mutation transaction, such as authorized sensitive reads. State-changing command audit entries
/// must instead be included in the atomic command commit plan.
/// </summary>
public interface IAppendOnlyAuditLog
{
    ValueTask AppendAsync(AuditEntry entry, CancellationToken cancellationToken = default);
}
