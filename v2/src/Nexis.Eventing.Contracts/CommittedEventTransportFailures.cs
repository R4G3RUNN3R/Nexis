namespace Nexis.Eventing.Contracts;

/// <summary>
/// Classifies whether a committed-event delivery failure is specific to the immutable event or to
/// shared transport infrastructure. Only an event-specific permanent failure may advance a poison
/// quarantine ceiling.
/// </summary>
public enum CommittedEventTransportFailureKind
{
    SystemicTransient = 0,
    EventSpecificPermanent = 1
}

/// <summary>
/// Explicit failure classification supplied by a committed-event transport. Unclassified
/// exceptions are treated as systemic/transient by the dispatcher so infrastructure outages fail
/// safe without mass-quarantining valid events.
/// </summary>
public sealed class CommittedEventTransportException : Exception
{
    public CommittedEventTransportException(
        CommittedEventTransportFailureKind failureKind,
        string message)
        : this(failureKind, message, null)
    {
    }

    public CommittedEventTransportException(
        CommittedEventTransportFailureKind failureKind,
        string message,
        Exception? innerException)
        : base(message, innerException)
    {
        if (!Enum.IsDefined(failureKind))
        {
            throw new ArgumentOutOfRangeException(nameof(failureKind));
        }

        FailureKind = failureKind;
    }

    public CommittedEventTransportFailureKind FailureKind { get; }
}
