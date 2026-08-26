namespace Nexis.Core.Contracts;

public enum CoreOutcomeStatus
{
    Succeeded = 0,
    Rejected = 1,
    Conflict = 2,
    Cancelled = 3,
    DomainFailed = 4,
    TechnicalFailure = 5
}

public sealed record CoreReasonCode
{
    public CoreReasonCode(string value)
    {
        ArgumentException.ThrowIfNullOrWhiteSpace(value);
        Value = value;
    }

    public string Value { get; }

    public override string ToString() => Value;
}

public sealed class CoreDecision
{
    private CoreDecision(
        CoreOutcomeStatus status,
        CoreReasonCode? reason,
        ICoreResultPayload? payload,
        IEnumerable<IOwnerTransition>? transitions,
        IEnumerable<ICoreEventDescriptor>? events)
    {
        Status = status;
        Reason = reason;
        Payload = payload;
        Transitions = Freeze(transitions);
        Events = Freeze(events);
    }

    public CoreOutcomeStatus Status { get; }

    public CoreReasonCode? Reason { get; }

    public ICoreResultPayload? Payload { get; }

    public IReadOnlyList<IOwnerTransition> Transitions { get; }

    public IReadOnlyList<ICoreEventDescriptor> Events { get; }

    public static CoreDecision Succeeded(
        ICoreResultPayload? payload = null,
        IEnumerable<IOwnerTransition>? transitions = null,
        IEnumerable<ICoreEventDescriptor>? events = null) =>
        new(CoreOutcomeStatus.Succeeded, null, payload, transitions, events);

    public static CoreDecision DomainFailed(
        CoreReasonCode reason,
        ICoreResultPayload? payload = null,
        IEnumerable<IOwnerTransition>? transitions = null,
        IEnumerable<ICoreEventDescriptor>? events = null) =>
        new(CoreOutcomeStatus.DomainFailed, RequireReason(reason), payload, transitions, events);

    public static CoreDecision Rejected(CoreReasonCode reason) =>
        NoMutation(CoreOutcomeStatus.Rejected, reason);

    public static CoreDecision Conflict(CoreReasonCode reason) =>
        NoMutation(CoreOutcomeStatus.Conflict, reason);

    public static CoreDecision Cancelled(CoreReasonCode reason) =>
        NoMutation(CoreOutcomeStatus.Cancelled, reason);

    public static CoreDecision TechnicalFailure(CoreReasonCode reason) =>
        NoMutation(CoreOutcomeStatus.TechnicalFailure, reason);

    private static CoreDecision NoMutation(CoreOutcomeStatus status, CoreReasonCode reason) =>
        new(status, RequireReason(reason), null, null, null);

    private static CoreReasonCode RequireReason(CoreReasonCode reason) =>
        reason ?? throw new ArgumentNullException(nameof(reason));

    private static IReadOnlyList<T> Freeze<T>(IEnumerable<T>? values) =>
        Array.AsReadOnly((values ?? Array.Empty<T>()).ToArray());
}
