using Nexis.Operations.Contracts;

namespace Nexis.History.Replay;

/// <summary>
/// Best-effort structured reporting for the replay boundary.
///
/// Two conditions are deliberately kept apart. <see cref="OperationalConditionKind.ReplayArtifactRejected"/>
/// means the boundary refused a structurally intact artifact under an explicit policy: an unreviewed
/// corpus or intent contract version, an unregistered codec, a Core that does not support the
/// scenario's contract version, an absent rule/content compatibility approval, or a retention size
/// bound. Nothing is damaged; the corpus simply declines to accept or run it, which is a routine and
/// expected result while the reviewed catalogue is narrow.
///
/// <see cref="OperationalConditionKind.ReplayCorruption"/> means retained evidence no longer matches
/// what was written: a content address that does not match its own JSON, a stored file that has grown
/// past the bound it was written under, a retained artifact that no longer parses, or a same-address
/// collision. That is an integrity incident against the historical record.
///
/// A divergent replay comparison is neither. A candidate Core producing a different decision is the
/// entire point of the comparison and is returned as a result, never reported as a fault.
///
/// Replay signals deliberately carry no CommandId, CorrelationId or EventId. A rejected or corrupt
/// artifact cannot be trusted to yield those identifiers, and the signal contract has no
/// artifact-identity field, so inventing linkage from untrusted content is not an option here.
/// </summary>
internal sealed class ReplayOperationalReporter
{
    private readonly IOperationalSignalSink? _sink;
    private readonly TimeProvider _timeProvider;

    public ReplayOperationalReporter(IOperationalSignalSink? sink, TimeProvider? timeProvider)
    {
        _sink = sink;
        _timeProvider = timeProvider ?? TimeProvider.System;
    }

    public void Report(
        OperationalConditionKind kind,
        OperationalSeverity severity,
        OperationalComponentKey component,
        OperationalReasonCode reason)
    {
        if (_sink is null)
        {
            return;
        }

        try
        {
            var pending = _sink.ReportAsync(
                new OperationalSignal(kind, severity, component, reason, _timeProvider.GetUtcNow()),
                CancellationToken.None);
            if (!pending.IsCompletedSuccessfully)
            {
                pending.AsTask().GetAwaiter().GetResult();
            }
        }
        catch (Exception)
        {
            // A failing sink must never convert a rejection into a corruption report, suppress the
            // exception the caller is about to see, or let an unusable artifact appear acceptable.
        }
    }
}
