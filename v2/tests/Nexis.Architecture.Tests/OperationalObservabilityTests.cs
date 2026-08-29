using Microsoft.VisualStudio.TestTools.UnitTesting;
using Nexis.Kernel.Commands;
using Nexis.Kernel.Events;
using Nexis.Operations;
using Nexis.Operations.Contracts;

namespace Nexis.Architecture.Tests;

[TestClass]
public sealed class OperationalObservabilityTests
{
    private static readonly DateTimeOffset ObservedAtUtc =
        new(2026, 8, 28, 18, 0, 0, TimeSpan.Zero);

    [TestMethod]
    public async Task ReporterAggregatesEveryRequiredConditionWithoutRawPayloadFields()
    {
        var reporter = new InMemoryOperationalHealthReporter(new FixedTimeProvider(ObservedAtUtc));

        foreach (var kind in Enum.GetValues<OperationalConditionKind>())
        {
            await reporter.ReportAsync(CreateSignal(kind, OperationalSeverity.Error));
        }

        var snapshot = reporter.Capture();

        Assert.AreEqual(Enum.GetValues<OperationalConditionKind>().Length, snapshot.TotalSignals);
        Assert.AreEqual(OperationalHealthStatus.Unhealthy, snapshot.Status);
        CollectionAssert.AreEquivalent(
            Enum.GetValues<OperationalConditionKind>(),
            snapshot.Conditions.Select(static condition => condition.Kind).ToArray());
        Assert.IsFalse(typeof(OperationalSignal).GetProperties()
            .Any(static property => property.PropertyType == typeof(Exception)));
        Assert.IsFalse(typeof(OperationalSignal).GetProperties()
            .Any(static property => property.Name.Contains("Payload", StringComparison.OrdinalIgnoreCase)));
    }

    [TestMethod]
    public async Task ConcurrentReportsProduceExactBoundedConditionCounts()
    {
        var reporter = new InMemoryOperationalHealthReporter(new FixedTimeProvider(ObservedAtUtc));
        var reports = Enumerable.Range(0, 200)
            .Select(_ => reporter.ReportAsync(CreateSignal(
                OperationalConditionKind.OutboxDeliveryFailure,
                OperationalSeverity.Warning)).AsTask())
            .ToArray();

        await Task.WhenAll(reports);
        var snapshot = reporter.Capture();

        Assert.AreEqual(200L, snapshot.TotalSignals);
        Assert.AreEqual(1, snapshot.Conditions.Count);
        Assert.AreEqual(200L, snapshot.Conditions[0].Count);
        Assert.AreEqual(OperationalHealthStatus.Degraded, snapshot.Status);
    }

    [TestMethod]
    public async Task OutOfOrderSignalsCannotMoveLatestOccurrenceBackward()
    {
        var reporter = new InMemoryOperationalHealthReporter(new FixedTimeProvider(ObservedAtUtc));
        var later = CreateSignal(
            OperationalConditionKind.CommandRecoveryFailure,
            OperationalSeverity.Error,
            ObservedAtUtc.AddMinutes(2));
        var earlier = CreateSignal(
            OperationalConditionKind.CommandRecoveryFailure,
            OperationalSeverity.Warning,
            ObservedAtUtc.AddMinutes(1));

        await reporter.ReportAsync(later);
        await reporter.ReportAsync(earlier);
        var condition = reporter.Capture().Conditions.Single();

        Assert.AreEqual(ObservedAtUtc.AddMinutes(2), condition.LatestOccurredAtUtc);
        Assert.AreEqual(OperationalSeverity.Error, condition.HighestSeverity);
    }

    [TestMethod]
    public void SignalRejectsUnboundedOrAmbiguousStructuredFields()
    {
        Assert.ThrowsExactly<ArgumentException>(() => new OperationalComponentKey("contains spaces"));
        Assert.ThrowsExactly<ArgumentOutOfRangeException>(() => new OperationalReasonCode(new string('a', 129)));
        Assert.ThrowsExactly<ArgumentException>(() => new OperationalSignal(
            OperationalConditionKind.InvariantViolation,
            OperationalSeverity.Critical,
            new OperationalComponentKey("nexis.execution"),
            new OperationalReasonCode("execution.invariant"),
            ObservedAtUtc.ToOffset(TimeSpan.FromHours(1))));
        Assert.ThrowsExactly<ArgumentOutOfRangeException>(() => new OperationalSignal(
            OperationalConditionKind.RetryExhausted,
            OperationalSeverity.Error,
            new OperationalComponentKey("nexis.execution"),
            new OperationalReasonCode("execution.retry.exhausted"),
            ObservedAtUtc,
            attemptCount: 0));
    }

    [TestMethod]
    public void IntegritySignalsCanLinkBothAttemptsWithoutCarryingRawActorIdentity()
    {
        var properties = typeof(OperationalSignal).GetProperties();

        Assert.IsNotNull(
            properties.SingleOrDefault(static property =>
                property.Name == "OriginalCorrelationId" &&
                property.PropertyType == typeof(CorrelationId?)),
            "A CommandId integrity signal must identify both the original and colliding attempts.");
        Assert.IsNotNull(
            properties.SingleOrDefault(static property =>
                property.Name == "ActorDiscriminator" &&
                string.Equals(property.PropertyType.Name, "OperationalActorDiscriminator", StringComparison.Ordinal)),
            "A CommandId integrity signal must carry a bounded pseudonymous discriminator for the attempting actor binding.");
        Assert.IsFalse(
            properties.Any(static property =>
                property.Name.Contains("AccountId", StringComparison.Ordinal) ||
                property.Name.Contains("CharacterId", StringComparison.Ordinal) ||
                property.Name.Contains("SystemActorKey", StringComparison.Ordinal)),
            "Operational signals must not expose raw Account, Character, or System actor identity.");
    }

    [TestMethod]
    public void OperationalAssembliesDependOnlyOnStableNonAuthoritativeBoundaries()
    {
        CollectionAssert.AreEquivalent(
            new[] { "Nexis.Kernel" },
            GetNexisReferences(typeof(IOperationalSignalSink).Assembly));
        CollectionAssert.AreEquivalent(
            new[] { "Nexis.Kernel", "Nexis.Operations.Contracts" },
            GetNexisReferences(typeof(InMemoryOperationalHealthReporter).Assembly));
    }

    private static OperationalSignal CreateSignal(
        OperationalConditionKind kind,
        OperationalSeverity severity,
        DateTimeOffset? occurredAtUtc = null) =>
        new(
            kind,
            severity,
            new OperationalComponentKey("nexis.foundation"),
            new OperationalReasonCode($"foundation.{kind.ToString().ToLowerInvariant()}"),
            occurredAtUtc ?? ObservedAtUtc,
            commandId: CommandId.New(),
            correlationId: CorrelationId.New(),
            eventId: EventId.New(),
            attemptCount: 1);

    private static string[] GetNexisReferences(System.Reflection.Assembly assembly) =>
        assembly.GetReferencedAssemblies()
            .Select(static reference => reference.Name ?? string.Empty)
            .Where(static name => name.StartsWith("Nexis.", StringComparison.Ordinal))
            .OrderBy(static name => name, StringComparer.Ordinal)
            .ToArray();

    private sealed class FixedTimeProvider(DateTimeOffset utcNow) : TimeProvider
    {
        public override DateTimeOffset GetUtcNow() => utcNow;
    }
}
