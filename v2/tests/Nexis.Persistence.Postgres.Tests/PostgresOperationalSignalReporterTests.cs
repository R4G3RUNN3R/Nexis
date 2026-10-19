using System.Reflection;
using Microsoft.VisualStudio.TestTools.UnitTesting;
using Nexis.Operations.Contracts;

namespace Nexis.Persistence.Postgres.Tests;

[TestClass]
[DoNotParallelize]
public sealed class PostgresOperationalSignalReporterTests
{
    [TestMethod]
    public async Task IgnoredCancellation_DoesNotAccumulateAdditionalSinkInvocations()
    {
        var sink = new BlockingSink();
        try
        {
            await InvokeAsync(sink);
            Assert.AreEqual(1, sink.Calls);
            await InvokeAsync(sink);
            Assert.AreEqual(1, sink.Calls, "The pending sink must occupy the only reporting slot.");
        }
        finally
        {
            sink.Release();
        }
    }

    private static async Task InvokeAsync(IOperationalSignalSink sink)
    {
        var reporter = typeof(PostgresExecutionSchema).Assembly.GetType(
            "Nexis.Persistence.Postgres.PostgresOperationalSignalReporter", throwOnError: true)!;
        var method = reporter.GetMethod("ReportBestEffortAsync", BindingFlags.Public | BindingFlags.Static)!;
        var parameterType = method.GetParameters()[1].ParameterType;
        Assert.AreEqual(typeof(OperationalSignal), parameterType);
        var signal = new OperationalSignal(OperationalConditionKind.ProjectionFailure, OperationalSeverity.Error, new OperationalComponentKey("reporter-test"), new OperationalReasonCode("reporter.test"), DateTimeOffset.UtcNow);
        var task = (ValueTask)method.Invoke(null, new object?[] { sink, signal })!;
        await task.AsTask().WaitAsync(TimeSpan.FromSeconds(2));
    }

    private sealed class BlockingSink : IOperationalSignalSink
    {
        private readonly TaskCompletionSource _gate = new(TaskCreationOptions.RunContinuationsAsynchronously);
        private int _calls;
        public int Calls => Volatile.Read(ref _calls);
        public async ValueTask ReportAsync(OperationalSignal signal, CancellationToken cancellationToken = default)
        {
            Interlocked.Increment(ref _calls);
            await _gate.Task;
        }
        public void Release() => _gate.TrySetResult();
    }
}
