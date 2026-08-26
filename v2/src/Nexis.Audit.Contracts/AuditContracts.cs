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
        SafePlayerReason = NormalizeOptional(safePlayerReason);
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
