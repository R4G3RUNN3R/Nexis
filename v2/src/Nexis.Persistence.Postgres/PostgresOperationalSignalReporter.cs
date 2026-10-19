using Nexis.Operations.Contracts;

namespace Nexis.Persistence.Postgres;

/// <summary>
/// Diagnostic delivery is never authoritative. At most one reporting operation may be
/// outstanding per process; a sink that ignores cancellation cannot accumulate work.
/// </summary>
internal static class PostgresOperationalSignalReporter
{
    private static readonly TimeSpan ReportingTimeout = TimeSpan.FromMilliseconds(250);
    private static readonly SemaphoreSlim ReportingSlot = new(1, 1);

    public static async ValueTask ReportBestEffortAsync(
        IOperationalSignalSink? sink,
        OperationalSignal signal)
    {
        if (sink is null || !ReportingSlot.Wait(0))
        {
            return;
        }

        using var timeout = new CancellationTokenSource(ReportingTimeout);
        Task? report = null;
        try
        {
            // Queue the sink outside the authoritative execution flow. Even a sink
            // that blocks synchronously cannot hold up its caller indefinitely.
            report = Task.Run(async () =>
                await sink.ReportAsync(signal, timeout.Token).ConfigureAwait(false));

            await report.WaitAsync(ReportingTimeout).ConfigureAwait(false);
        }
        catch (Exception)
        {
            // Diagnostic failure must not replace an authoritative failure.
        }
        finally
        {
            if (report is null)
            {
                ReportingSlot.Release();
            }
            else
            {
                // Do not release the slot merely because WaitAsync timed out:
                // the original sink may still be running. Observe late faults.
                _ = report.ContinueWith(
                    completed =>
                    {
                        _ = completed.Exception;
                        ReportingSlot.Release();
                    },
                    CancellationToken.None,
                    TaskContinuationOptions.ExecuteSynchronously,
                    TaskScheduler.Default);
            }
        }
    }
}
