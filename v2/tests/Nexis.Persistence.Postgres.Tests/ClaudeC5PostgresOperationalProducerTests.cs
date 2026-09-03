using Microsoft.VisualStudio.TestTools.UnitTesting;
using Nexis.Core.Contracts;
using Nexis.Eventing.Contracts;
using Nexis.Execution;
using Nexis.Execution.Contracts;
using Nexis.Identity.Contracts;
using Nexis.Kernel.Commands;
using Nexis.Kernel.Events;
using Nexis.Kernel.Randomness;
using Nexis.Operations.Contracts;
using Npgsql;
using NpgsqlTypes;

namespace Nexis.Persistence.Postgres.Tests;

/// <summary>
/// The two C5 operational producers that need a real transaction to fail inside: projection failure
/// and unexpected concurrency failure.
///
/// Both cases deliberately raise genuine server-side PostgreSQL errors rather than fabricating an
/// exception, so the classification under test is the one production will actually see. Every case
/// asserts the condition kind and linkage, that one logical failure yields exactly one signal, and
/// that a throwing sink changes neither the checkpoint, the side effect nor the terminal outcome.
/// </summary>
[TestClass]
[DoNotParallelize]
public sealed class ClaudeC5PostgresOperationalProducerTests
{
    private static NpgsqlDataSource? s_dataSource;

    private static readonly OwnerKey SyntheticOwner = new("ClaudeC5SyntheticOwner");
    private static readonly DateTimeOffset SignalTime = new(2026, 9, 3, 12, 0, 0, TimeSpan.Zero);

    private static NpgsqlDataSource DataSource =>
        s_dataSource ?? throw new InvalidOperationException("PostgreSQL data source is not initialized.");

    [ClassInitialize]
    public static async Task ClassInitialize(TestContext _)
    {
        var connectionString = Environment.GetEnvironmentVariable("NEXIS_TEST_POSTGRES_CONNECTION");
        if (string.IsNullOrWhiteSpace(connectionString))
        {
            Assert.Inconclusive("NEXIS_TEST_POSTGRES_CONNECTION is required for PostgreSQL integration tests.");
            return;
        }

        s_dataSource = NpgsqlDataSource.Create(connectionString);
        await PostgresExecutionSchema.EnsureCreatedAsync(s_dataSource);

        const string sql = """
            CREATE SCHEMA IF NOT EXISTS nexis_v2_test;
            CREATE TABLE IF NOT EXISTS nexis_v2_test.c5_projection (
                marker text NOT NULL,
                CONSTRAINT c5_projection_marker_unique UNIQUE (marker) DEFERRABLE INITIALLY DEFERRED
            );
            """;

        await using var connection = await s_dataSource.OpenConnectionAsync();
        await using var command = new NpgsqlCommand(sql, connection);
        await command.ExecuteNonQueryAsync();
    }

    [ClassCleanup]
    public static async Task ClassCleanup()
    {
        if (s_dataSource is not null)
        {
            await s_dataSource.DisposeAsync();
        }
    }

    [TestInitialize]
    public async Task TestInitialize()
    {
        const string sql = """
            TRUNCATE TABLE
                nexis_v2.event_consumer_checkpoints,
                nexis_v2.outbox,
                nexis_v2.authoritative_events,
                nexis_v2.admin_audit,
                nexis_v2.command_receipts,
                nexis_v2_test.c5_projection
            CASCADE;
            """;

        await using var connection = await DataSource.OpenConnectionAsync();
        await using var command = new NpgsqlCommand(sql, connection);
        await command.ExecuteNonQueryAsync();
    }

    // ---------------------------------------------------------------------------------------
    // Projection failure
    // ---------------------------------------------------------------------------------------

    [TestMethod]
    public async Task ProjectionSideEffectFailure_ReportsOneSignalAndStillRollsEverythingBack()
    {
        var message = await SeedEventAsync();
        var sink = new RecordingOperationalSignalSink();
        var executor = new PostgresProjectionConsumerExecutor(
            DataSource,
            new FixedTimeProvider(SignalTime),
            sink);

        await Assert.ThrowsExactlyAsync<InvalidOperationException>(async () =>
            await executor.ConsumeAsync(new MarkerProjectionConsumer(FailureMode.SideEffect), message));

        var signal = sink.Signals.Single();
        Assert.AreEqual(OperationalConditionKind.ProjectionFailure, signal.Kind);
        Assert.AreEqual(OperationalSeverity.Error, signal.Severity);
        Assert.AreEqual("postgres.projection-consumer", signal.Component.Value);
        Assert.AreEqual("projection.side_effect_failed", signal.Reason.Value);
        Assert.AreEqual(message.EventId, signal.EventId);
        Assert.AreEqual(message.CommandId, signal.CommandId);
        Assert.AreEqual(message.CorrelationId, signal.CorrelationId);
        Assert.AreEqual(SignalTime, signal.OccurredAtUtc);

        Assert.AreEqual(0, await ReadProjectionMarkerCountAsync());
        Assert.AreEqual(0, await ReadCheckpointCountAsync(MarkerProjectionConsumer.Name, message.EventId));
    }

    /// <summary>
    /// A side effect that succeeded and a checkpoint that could not commit is a different operational
    /// story from a projector that threw, so the reason token distinguishes them. Both roll back.
    /// </summary>
    [TestMethod]
    public async Task ProjectionCheckpointCommitFailure_ReportsTheCheckpointReason()
    {
        var message = await SeedEventAsync();
        var sink = new RecordingOperationalSignalSink();
        var executor = new PostgresProjectionConsumerExecutor(
            DataSource,
            new FixedTimeProvider(SignalTime),
            sink);

        await Assert.ThrowsExactlyAsync<PostgresException>(async () =>
            await executor.ConsumeAsync(new MarkerProjectionConsumer(FailureMode.Commit), message));

        var signal = sink.Signals.Single();
        Assert.AreEqual(OperationalConditionKind.ProjectionFailure, signal.Kind);
        Assert.AreEqual("projection.checkpoint_commit_failed", signal.Reason.Value);
        Assert.AreEqual(0, await ReadProjectionMarkerCountAsync());
        Assert.AreEqual(0, await ReadCheckpointCountAsync(MarkerProjectionConsumer.Name, message.EventId));
    }

    [TestMethod]
    public async Task SuccessfulAndAlreadyProcessedProjections_ReportNothing()
    {
        var message = await SeedEventAsync();
        var sink = new RecordingOperationalSignalSink();
        var executor = new PostgresProjectionConsumerExecutor(
            DataSource,
            new FixedTimeProvider(SignalTime),
            sink);

        var first = await executor.ConsumeAsync(new MarkerProjectionConsumer(FailureMode.None), message);
        var second = await executor.ConsumeAsync(new MarkerProjectionConsumer(FailureMode.None), message);
        var ignored = await executor.ConsumeAsync(new UnrelatedProjectionConsumer(), message);

        Assert.AreEqual(ProjectionConsumeDisposition.Applied, first);
        Assert.AreEqual(ProjectionConsumeDisposition.AlreadyProcessed, second);
        Assert.AreEqual(ProjectionConsumeDisposition.Ignored, ignored);
        Assert.AreEqual(0, sink.Signals.Count);
    }

    [TestMethod]
    public async Task ProjectionSignalFailure_CannotCommitTheRolledBackProjection()
    {
        var message = await SeedEventAsync();
        var executor = new PostgresProjectionConsumerExecutor(
            DataSource,
            new FixedTimeProvider(SignalTime),
            new ThrowingOperationalSignalSink());

        var exception = await Assert.ThrowsExactlyAsync<InvalidOperationException>(async () =>
            await executor.ConsumeAsync(new MarkerProjectionConsumer(FailureMode.SideEffect), message));

        StringAssert.Contains(exception.Message, "projection side effect");
        Assert.AreEqual(0, await ReadProjectionMarkerCountAsync());
        Assert.AreEqual(0, await ReadCheckpointCountAsync(MarkerProjectionConsumer.Name, message.EventId));
    }

    // ---------------------------------------------------------------------------------------
    // Unexpected concurrency failure
    // ---------------------------------------------------------------------------------------

    /// <summary>
    /// SQLSTATE class 40 is transaction rollback. Serialization failure and deadlock are the two
    /// states the transient classifier already owns and retries, so any other class-40 state is a
    /// concurrency failure nothing in the design expects.
    /// </summary>
    [TestMethod]
    public async Task UnexpectedClass40Rollback_ReportsOneSignalAndStillReturnsTechnicalFailure()
    {
        var sink = new RecordingOperationalSignalSink();
        var plan = await BuildCommittablePlanAsync();
        var committer = CreateCommitter(sink, "40002");

        var result = await committer.CommitAsync(plan);

        Assert.AreEqual(CommandCommitDisposition.TechnicalFailure, result.Disposition);
        Assert.AreEqual("execution.persistence.failed", result.Reason?.Value);
        var signal = sink.Signals.Single();
        Assert.AreEqual(OperationalConditionKind.UnexpectedConcurrencyFailure, signal.Kind);
        Assert.AreEqual(OperationalSeverity.Error, signal.Severity);
        Assert.AreEqual("postgres.command-commit", signal.Component.Value);
        Assert.AreEqual("concurrency.unexpected_transaction_rollback.40002", signal.Reason.Value);
        Assert.AreEqual(plan.Trace.Identity.CommandId, signal.CommandId);
        Assert.AreEqual(plan.Trace.CorrelationId, signal.CorrelationId);
        Assert.AreEqual(SignalTime, signal.OccurredAtUtc);
        Assert.AreEqual(0, await ReadCommittedEventCountAsync(plan.Trace.Identity.CommandId));
    }

    /// <summary>
    /// Serialization failure and deadlock are expected contention that the bounded retry executor
    /// owns. Reporting them here would emit a signal for every ordinary retry.
    /// </summary>
    [TestMethod]
    [DataRow("40001")]
    [DataRow("40P01")]
    public async Task RetryableConcurrencyFailure_RethrowsForRetryAndReportsNothing(string sqlState)
    {
        var sink = new RecordingOperationalSignalSink();
        var plan = await BuildCommittablePlanAsync();
        var committer = CreateCommitter(sink, sqlState);

        var exception = await Assert.ThrowsExactlyAsync<PostgresException>(
            async () => await committer.CommitAsync(plan));

        Assert.AreEqual(sqlState, exception.SqlState);
        Assert.AreEqual(0, sink.Signals.Count);
    }

    /// <summary>
    /// An ordinary persistence fault outside class 40 must not masquerade as a concurrency incident,
    /// or a constraint bug would page whoever owns contention.
    /// </summary>
    [TestMethod]
    public async Task OrdinaryPersistenceFailureOutsideClass40_ReportsNoConcurrencySignal()
    {
        var sink = new RecordingOperationalSignalSink();
        var plan = await BuildCommittablePlanAsync();
        var committer = CreateCommitter(sink, "23505");

        var result = await committer.CommitAsync(plan);

        Assert.AreEqual(CommandCommitDisposition.TechnicalFailure, result.Disposition);
        Assert.AreEqual(0, sink.Signals.Count);
    }

    [TestMethod]
    public async Task ConcurrencySignalFailure_CannotChangeTheTerminalOutcomeOrCommitAnything()
    {
        var plan = await BuildCommittablePlanAsync();
        var committer = CreateCommitter(new ThrowingOperationalSignalSink(), "40002");

        var result = await committer.CommitAsync(plan);

        Assert.AreEqual(CommandCommitDisposition.TechnicalFailure, result.Disposition);
        Assert.AreEqual(0, await ReadCommittedEventCountAsync(plan.Trace.Identity.CommandId));
    }

    [TestMethod]
    public async Task OrdinarySuccessfulCommit_ReportsNothing()
    {
        var sink = new RecordingOperationalSignalSink();
        var plan = await BuildCommittablePlanAsync(withOwnerTransition: false);
        var committer = new PostgresAtomicCommandCommitter(
            DataSource,
            operationalSignalSink: sink,
            timeProvider: new FixedTimeProvider(SignalTime));

        var result = await committer.CommitAsync(plan);

        Assert.AreEqual(CommandCommitDisposition.Committed, result.Disposition);
        Assert.AreEqual(0, sink.Signals.Count);
    }

    // ---------------------------------------------------------------------------------------
    // Helpers
    // ---------------------------------------------------------------------------------------

    private static PostgresAtomicCommandCommitter CreateCommitter(
        IOperationalSignalSink sink,
        string sqlState) =>
        new(
            DataSource,
            new[] { new RaisingOwnerApplier(SyntheticOwner, sqlState) },
            operationalSignalSink: sink,
            timeProvider: new FixedTimeProvider(SignalTime));

    private static async Task<CommandCommitPlan> BuildCommittablePlanAsync(bool withOwnerTransition = true)
    {
        var request = CreateRequest();
        var payload = CanonicalCommandPayload.FromTrustedJson(
            $"{{\"commandId\":\"{request.Context.CommandId.Value:D}\"}}");
        var claim = await new PostgresCommandReceiptRepository(DataSource).TryAcquireAsync(
            new CommandReceiptAcquireRequest(
                CommandExecutionIdentityFactory.Create(request, payload),
                payload,
                request.Context.CorrelationId,
                SignalTime,
                new CommandExecutionLeaseRequest("c5-commit", TimeSpan.FromMinutes(1))));
        Assert.AreEqual(CommandReceiptDisposition.Acquired, claim.Disposition);

        return new CommandCommitPlanBuilder().Build(
            request,
            payload.Fingerprint,
            claim,
            CoreDecision.Succeeded(
                transitions: withOwnerTransition
                    ? new IOwnerTransition[] { new SyntheticTransition(SyntheticOwner) }
                    : Array.Empty<IOwnerTransition>(),
                events: new ICoreEventDescriptor[] { new SyntheticEvent() }),
            new CoreImplementationDescriptor("Test.Core", "c5", CoreContractVersion.V1),
            SignalTime);
    }

    private static async Task<CommittedEventMessage> SeedEventAsync()
    {
        var request = CreateRequest();
        var payload = CanonicalCommandPayload.FromTrustedJson(
            $"{{\"commandId\":\"{request.Context.CommandId.Value:D}\"}}");
        var claim = await new PostgresCommandReceiptRepository(DataSource).TryAcquireAsync(
            new CommandReceiptAcquireRequest(
                CommandExecutionIdentityFactory.Create(request, payload),
                payload,
                request.Context.CorrelationId,
                SignalTime,
                new CommandExecutionLeaseRequest("c5-seed", TimeSpan.FromMinutes(1))));
        Assert.AreEqual(CommandReceiptDisposition.Acquired, claim.Disposition);

        var descriptor = new SyntheticEvent();
        var plan = new CommandCommitPlanBuilder().Build(
            request,
            payload.Fingerprint,
            claim,
            CoreDecision.Succeeded(events: new ICoreEventDescriptor[] { descriptor }),
            new CoreImplementationDescriptor("Test.Core", "c5", CoreContractVersion.V1),
            SignalTime);
        var committed = await new PostgresAtomicCommandCommitter(DataSource).CommitAsync(plan);
        Assert.AreEqual(CommandCommitDisposition.Committed, committed.Disposition);

        var envelope = plan.Events.Single();
        return new CommittedEventMessage(
            envelope.Metadata.EventId,
            request.Context.CommandId,
            envelope.Metadata.CorrelationId,
            envelope.Metadata.OccurredAtUtc,
            descriptor.Contract,
            "{}");
    }

    private static CoreEvaluationRequest CreateRequest() =>
        new(
            CoreContractVersion.V1,
            new CoreEvaluationContext(
                CommandId.New(),
                CorrelationId.New(),
                TrustedActorContext.CreatePlayer(AccountId.New(), CharacterId.New(), 1),
                SignalTime,
                new RuleVersion("c5.rules.v1"),
                new ContentVersion("c5.content.v1"),
                new FixedRandomFactory()),
            new SyntheticIntent(),
            Array.Empty<IAuthoritativeSnapshot>());

    private static async Task<int> ReadProjectionMarkerCountAsync()
    {
        await using var connection = await DataSource.OpenConnectionAsync();
        await using var command = new NpgsqlCommand(
            "SELECT count(*) FROM nexis_v2_test.c5_projection;",
            connection);
        return Convert.ToInt32(await command.ExecuteScalarAsync());
    }

    private static async Task<int> ReadCheckpointCountAsync(string consumerName, EventId eventId)
    {
        await using var connection = await DataSource.OpenConnectionAsync();
        await using var command = new NpgsqlCommand(
            """
            SELECT count(*) FROM nexis_v2.event_consumer_checkpoints
            WHERE consumer_name = @consumer_name AND event_id = @event_id;
            """,
            connection);
        command.Parameters.AddWithValue("consumer_name", NpgsqlDbType.Text, consumerName);
        command.Parameters.AddWithValue("event_id", NpgsqlDbType.Uuid, eventId.Value);
        return Convert.ToInt32(await command.ExecuteScalarAsync());
    }

    private static async Task<int> ReadCommittedEventCountAsync(CommandId commandId)
    {
        await using var connection = await DataSource.OpenConnectionAsync();
        await using var command = new NpgsqlCommand(
            "SELECT count(*) FROM nexis_v2.authoritative_events WHERE command_id = @command_id;",
            connection);
        command.Parameters.AddWithValue("command_id", NpgsqlDbType.Uuid, commandId.Value);
        return Convert.ToInt32(await command.ExecuteScalarAsync());
    }

    private static async Task RaiseSqlStateAsync(
        NpgsqlConnection connection,
        NpgsqlTransaction transaction,
        string sqlState,
        CancellationToken cancellationToken)
    {
        await using var command = new NpgsqlCommand(
            $"DO $$ BEGIN RAISE EXCEPTION 'nexis c5 synthetic failure' USING ERRCODE = '{sqlState}'; END $$;",
            connection,
            transaction);
        await command.ExecuteNonQueryAsync(cancellationToken);
    }

    // ---------------------------------------------------------------------------------------
    // Doubles
    // ---------------------------------------------------------------------------------------

    private enum FailureMode
    {
        None = 0,
        SideEffect = 1,
        Commit = 2
    }

    /// <summary>
    /// Writes one marker row. <see cref="FailureMode.SideEffect"/> throws before the transaction can
    /// commit. <see cref="FailureMode.Commit"/> returns normally after writing a duplicate marker;
    /// because the uniqueness constraint is DEFERRABLE INITIALLY DEFERRED, PostgreSQL raises it at
    /// COMMIT, so the projector succeeds and the commit is what fails.
    /// </summary>
    private sealed class MarkerProjectionConsumer : IPostgresProjectionEventConsumer
    {
        public const string Name = "projection.c5-marker";

        private readonly FailureMode _failureMode;

        public MarkerProjectionConsumer(FailureMode failureMode) => _failureMode = failureMode;

        public string ConsumerName => Name;

        public bool Handles(ContractDescriptor contract) => contract == SyntheticEvent.EventContract;

        public async ValueTask ApplyAsync(
            NpgsqlConnection connection,
            NpgsqlTransaction transaction,
            CommittedEventMessage message,
            CancellationToken cancellationToken = default)
        {
            await using (var command = new NpgsqlCommand(
                "INSERT INTO nexis_v2_test.c5_projection(marker) VALUES (@marker);",
                connection,
                transaction))
            {
                command.Parameters.AddWithValue("marker", NpgsqlDbType.Text, message.EventId.Value.ToString("D"));
                await command.ExecuteNonQueryAsync(cancellationToken);
            }

            switch (_failureMode)
            {
                case FailureMode.SideEffect:
                    throw new InvalidOperationException("The C5 projection side effect failed.");
                case FailureMode.Commit:
                    await using (var duplicate = new NpgsqlCommand(
                        "INSERT INTO nexis_v2_test.c5_projection(marker) VALUES (@marker);",
                        connection,
                        transaction))
                    {
                        duplicate.Parameters.AddWithValue(
                            "marker",
                            NpgsqlDbType.Text,
                            message.EventId.Value.ToString("D"));
                        await duplicate.ExecuteNonQueryAsync(cancellationToken);
                    }

                    break;
            }
        }
    }

    private sealed class UnrelatedProjectionConsumer : IPostgresProjectionEventConsumer
    {
        public string ConsumerName => "projection.c5-unrelated";

        public bool Handles(ContractDescriptor contract) => false;

        public ValueTask ApplyAsync(
            NpgsqlConnection connection,
            NpgsqlTransaction transaction,
            CommittedEventMessage message,
            CancellationToken cancellationToken = default) =>
            throw new InvalidOperationException("An ignored contract must never reach the projector.");
    }

    /// <summary>
    /// Raises a genuine server-side error with the requested SQLSTATE from inside the commit
    /// transaction, so the committer classifies the same exception shape production would see.
    /// </summary>
    private sealed class RaisingOwnerApplier : IPostgresOwnerTransitionApplier
    {
        private readonly string _sqlState;

        public RaisingOwnerApplier(OwnerKey owner, string sqlState)
        {
            Owner = owner;
            _sqlState = sqlState;
        }

        public OwnerKey Owner { get; }

        public IReadOnlyList<AuthoritativeResourceKey> ResolveLockKeys(IOwnerTransition transition) =>
            new[] { new AuthoritativeResourceKey(Owner, "c5-synthetic", "resource") };

        public async ValueTask<PostgresOwnerTransitionResult> ApplyAsync(
            NpgsqlConnection connection,
            NpgsqlTransaction transaction,
            IOwnerTransition transition,
            CancellationToken cancellationToken = default)
        {
            await RaiseSqlStateAsync(connection, transaction, _sqlState, cancellationToken);
            throw new InvalidOperationException("The raising applier must never return normally.");
        }
    }

    private sealed record SyntheticTransition(OwnerKey TargetOwner) : IOwnerTransition
    {
        public ContractDescriptor Contract { get; } = new("c5.tests.transition", 1);

        public long? ExpectedRevision => 1;
    }

    private sealed record SyntheticIntent : ICoreIntent
    {
        public ContractDescriptor Contract { get; } = new("c5.tests.command", 1);
    }

    private sealed record SyntheticEvent : ICoreEventDescriptor
    {
        public static ContractDescriptor EventContract { get; } = new("c5.tests.event", 1);

        public ContractDescriptor Contract => EventContract;
    }

    private sealed class RecordingOperationalSignalSink : IOperationalSignalSink
    {
        public List<OperationalSignal> Signals { get; } = new();

        public ValueTask ReportAsync(OperationalSignal signal, CancellationToken cancellationToken = default)
        {
            Signals.Add(signal);
            return ValueTask.CompletedTask;
        }
    }

    private sealed class ThrowingOperationalSignalSink : IOperationalSignalSink
    {
        public ValueTask ReportAsync(OperationalSignal signal, CancellationToken cancellationToken = default) =>
            throw new InvalidOperationException("The operational sink is unavailable.");
    }

    private sealed class FixedTimeProvider(DateTimeOffset utcNow) : TimeProvider
    {
        public override DateTimeOffset GetUtcNow() => utcNow;
    }

    private sealed class FixedRandomFactory : IDeterministicRandomFactory
    {
        public IDeterministicRandomSource Create() => new FixedRandomSource();

        private sealed class FixedRandomSource : IDeterministicRandomSource
        {
            public ulong NextUInt64() => 1;
        }
    }
}
