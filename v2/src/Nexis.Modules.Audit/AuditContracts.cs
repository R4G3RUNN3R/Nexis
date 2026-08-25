namespace Nexis.Modules.Audit;

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

public sealed record AuditEntry(
    Guid AuditId,
    Guid ActingAccountId,
    Guid? TargetAccountId,
    AuditActionKind ActionKind,
    AuditVisibility Visibility,
    DateTimeOffset OccurredAtUtc,
    string Action,
    string Outcome,
    string? SafePlayerReason,
    string? CaseReference,
    Guid CorrelationId,
    Guid? CausationEventId);
