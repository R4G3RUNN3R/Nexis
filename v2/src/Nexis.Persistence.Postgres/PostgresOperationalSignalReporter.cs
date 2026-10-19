using Nexis.Operations.Contracts;

namespace Nexis.Persistence.Postgres;

internal static class PostgresOperationalSignalReporter
{
    private static readonly TimeSpan ReportingTimeout = TimeSpan.FromMilliseconds(250);

    public static async ValueTask ReportBestEffortAsync(
        IOperationalSignalSink? sink,
        OperationalSignal signal)
    {
        if (sink is null)
        {
            return;
        }

        using var timeout = new CancellationTokenSource(ReportingTimeout);
        try
        {
            await sink
                .ReportAsync(signal, timeout.Token)
                .AsTask()
                .WaitAsync(ReportingTimeout)
                .ConfigureAwait(false);
        }
        catch (Exception)
        {
            // Operational reporting is diagnostic. A missing, slow, canceled or throwing sink
            // cannot delay an authoritative result indefinitely or replace its failure.
        }
    }
}
