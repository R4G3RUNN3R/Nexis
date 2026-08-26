using System.Text;
using Microsoft.VisualStudio.TestTools.UnitTesting;
using Nexis.Core.Contracts;
using Nexis.Eventing.Contracts;
using Nexis.Execution;
using Nexis.Execution.Contracts;
using Nexis.Identity.Contracts;
using Nexis.Kernel.Commands;
using Nexis.Kernel.Events;
using Nexis.Kernel.Randomness;
using Nexis.Persistence.Postgres;
using Npgsql;
using NpgsqlTypes;

namespace Nexis.Persistence.Postgres.Tests;

[TestClass]
[DoNotParallelize]
public sealed class PostgresOutboxIntegrationTests
{
    private static NpgsqlDataSource? s_dataSource;

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
            CREATE TABLE IF NOT EXISTS nexis_v2_test.projection_counter (
                counter_key text PRIMARY KEY,
                value integer NOT NULL
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
                nexis_v2_test.projection_counter
            CASCADE;
            INSERT INTO nexis_v2_test.projection_counter(counter_key, value) VALUES ('main', 0);
            """;

        await using var connection = await DataSource.OpenConnectionAsync();
        await using var command = new NpgsqlCommand(sql, connection);
        await command.ExecuteNonQueryAsync();
    }

    [TestMethod]
    public async Task IndependentWorkers_DoNotClaimSameOutboxRows()
    {
        var seeded = await SeedEventsAsync(4);
        var store = new PostgresOutboxStore(DataSource);
        var now = Utc(11, 0);

        var firstTask = store.ClaimBatchAsync("worker-a", 2, now, TimeSpan.FromMinutes(1)).AsTask();
        var secondTask = store.ClaimBatchAsync("worker-b", 2, now, TimeSpan.FromMinutes(1)).AsTask();
        await Task.WhenAll(firstTask, secondTask);

        var firstIds = firstTask.Result.Items.Select(item => item.Message.EventId).ToHashSet();
        var secondIds = secondTask.Result.Items.Select(item => item.Message.EventId).ToHashSet();

        Assert.AreEqual(2, firstIds.Count);
        Assert.AreEqual(2, secondIds.Count);
        Assert.AreEqual(0, firstIds.Intersect(secondIds).Count());
        CollectionAssert.AreEquivalent(
            seeded.Select(message => message.EventId).ToArray(),
            firstIds.Concat(secondIds).ToArray());
    }

    [TestMethod]
    public async Task ExpiredLease_IsReclaimedWithSameEventIdAndIncrementedAttempt()
    {
        var seeded = (await SeedEventsAsync(1)).Single();
        var store = new PostgresOutboxStore(DataSource);
        var first = await store.ClaimBatchAsync("worker-a", 1, Utc(11, 0), TimeSpan.FromSeconds(30));

        var beforeExpiry = await store.ClaimBatchAsync("worker-b", 1, Utc(11, 0, 20), TimeSpan.FromSeconds(30));
        var afterExpiry = await store.ClaimBatchAsync("worker-b", 1, Utc(11, 0, 31), TimeSpan.FromSeconds(30));

        Assert.AreEqual(1, first.Items.Count);
        Assert.AreEqual(0, beforeExpiry.Items.Count);
        Assert.AreEqual(1, afterExpiry.Items.Count);
        Assert.AreEqual(seeded.EventId, afterExpiry.Items[0].Message.EventId);
        Assert.AreEqual(2, afterExpiry.Items[0].AttemptCount);
        Assert.AreNotEqual(first.LeaseToken, afterExpiry.LeaseToken);
    }

    [TestMethod]
    public async Task SuccessfulDispatch_MarksOutboxPublishedAndClearsLease()
    {
        var seeded = (await SeedEventsAsync(1)).Single();
        var transport = new RecordingTransport();
        var dispatcher = CreateDispatcher(transport, Utc(11, 0));

        var result = await dispatcher.DispatchOnceAsync();

        Assert.AreEqual(1, result.Claimed);
        Assert.AreEqual(1, result.Published);
        Assert.AreEqual(0, result.Failed);
        Assert.AreEqual(1, transport.Messages.Count);
        Assert.AreEqual(seeded.EventId, transport.Messages[0].EventId);
        Assert.IsTrue(await IsPublishedAsync(seeded.EventId));
        Assert.IsFalse(await HasLeaseAsync(seeded.EventId));
    }

    [TestMethod]
    public async Task PublishThenThrow_CanRedeliverSameEventIdAfterFailureDelay()
    {
        var seeded = (await SeedEventsAsync(1)).Single();
        var transport = new RecordingTransport(throwAfterRecording: true);
        var time = new MutableTimeProvider(Utc(11, 0));
        var dispatcher = CreateDispatcher(transport, time);

        var first = await dispatcher.DispatchOnceAsync();
        time.Advance(TimeSpan.FromSeconds(6));
        var second = await dispatcher.DispatchOnceAsync();

        Assert.AreEqual(1, first.Failed);
        Assert.AreEqual(1, second.Failed);
        Assert.AreEqual(2, transport.Messages.Count);
        Assert.IsTrue(transport.Messages.All(message => message.EventId == seeded.EventId));
        Assert.IsFalse(await IsPublishedAsync(seeded.EventId));
        Assert.AreEqual(2, await ReadAttemptCountAsync(seeded.EventId));
    }

    [TestMethod]
    public async Task ProjectionCheckpoint_MakesDuplicateDeliveryIdempotent()
    {
        var message = (await SeedEventsAsync(1)).Single();
        var consumer = new CounterProjectionConsumer("projection.counter", shouldThrow: false);
        var executor = new PostgresProjectionConsumerExecutor(DataSource, new MutableTimeProvider(Utc(11, 0)));

        var first = await executor.ConsumeAsync(consumer, message);
        var second = await executor.ConsumeAsync(consumer, message);

        Assert.AreEqual(ProjectionConsumeDisposition.Applied, first);
        Assert.AreEqual(ProjectionConsumeDisposition.AlreadyProcessed, second);
        Assert.AreEqual(1, await ReadProjectionCounterAsync());
        Assert.AreEqual(1, await ReadCheckpointCountAsync(consumer.ConsumerName, message.EventId));
    }

    [TestMethod]
    public async Task ProjectionFailure_RollsBackSideEffectAndCheckpointSoRetryCanSucceed()
    {
        var message = (await SeedEventsAsync(1)).Single();
        var executor = new PostgresProjectionConsumerExecutor(DataSource, new MutableTimeProvider(Utc(11, 0)));
        var failing = new CounterProjectionConsumer("projection.counter", shouldThrow: true);

        await Assert.ThrowsExactlyAsync<InvalidOperationException>(async () =>
        {
            await executor.ConsumeAsync(failing, message);
        });

        Assert.AreEqual(0, await ReadProjectionCounterAsync());
        Assert.AreEqual(0, await ReadCheckpointCountAsync(failing.ConsumerName, message.EventId));

        var retry = await executor.ConsumeAsync(
            new CounterProjectionConsumer("projection.counter", shouldThrow: false),
            message);

        Assert.AreEqual(ProjectionConsumeDisposition.Applied, retry);
        Assert.AreEqual(1, await ReadProjectionCounterAsync());
        Assert.AreEqual(1, await ReadCheckpointCountAsync(failing.ConsumerName, message.EventId));
    }

    [TestMethod]
    public async Task ConcurrentDuplicateProjectionDelivery_CommitsOneSideEffect()
    {
        var message = (await SeedEventsAsync(1)).Single();
        var executor = new PostgresProjectionConsumerExecutor(DataSource, new MutableTimeProvider(Utc(11, 0)));
        var consumerA = new CounterProjectionConsumer("projection.concurrent", shouldThrow: false);
        var consumerB = new CounterProjectionConsumer("projection.concurrent", shouldThrow: false);

        var first = executor.ConsumeAsync(consumerA, message).AsTask();
        var second = executor.ConsumeAsync(consumerB, message).AsTask();
        var results = await Task.WhenAll(first, second);

        CollectionAssert.AreEquivalent(
            new[] { ProjectionConsumeDisposition.Applied, ProjectionConsumeDisposition.AlreadyProcessed },
            results);
        Assert.AreEqual(1, await ReadProjectionCounterAsync());
    }

    [TestMethod]
    public async Task AcknowledgementRequiresCurrentLeaseToken()
    {
        var message = (await SeedEventsAsync(1)).Single();
        var store = new PostgresOutboxStore(DataSource);
        var lease = await store.ClaimBatchAsync("worker-a", 1, Utc(11, 0), TimeSpan.FromMinutes(1));

        var wrongToken = await store.AcknowledgePublishedAsync(
            message.EventId,
            OutboxLeaseToken.New(),
            "worker-a",
            Utc(11, 0, 1));
        var correctToken = await store.AcknowledgePublishedAsync(
            message.EventId,
            lease.LeaseToken,
            "worker-a",
            Utc(11, 0, 2));

        Assert.IsFalse(wrongToken);
        Assert.IsTrue(correctToken);
        Assert.IsTrue(await IsPublishedAsync(message.EventId));
    }

    private static PostgresOutboxDispatcher CreateDispatcher(
        RecordingTransport transport,
        DateTimeOffset nowUtc) =>
        CreateDispatcher(transport, new MutableTimeProvider(nowUtc));

    private static PostgresOutboxDispatcher CreateDispatcher(
        RecordingTransport transport,
        MutableTimeProvider timeProvider) =>
        new(
            new PostgresOutboxStore(DataSource),
            transport,
            "dispatcher-test",
            batchSize: 10,
            leaseDuration: TimeSpan.FromSeconds(30),
            failureDelay: TimeSpan.FromSeconds(5),
            timeProvider);

    private static async Task<IReadOnlyList<CommittedEventMessage>> SeedEventsAsync(int count)
    {
        var messages = new List<CommittedEventMessage>();

        for (var index = 0; index < count; index++)
        {
            var request = CreateRequest();
            var fingerprint = CommandPayloadFingerprint.Compute(Encoding.UTF8.GetBytes($"event-{index}-{request.Context.CommandId}"));
            var repository = new PostgresCommandReceiptRepository(DataSource);
            var claim = await repository.TryAcquireAsync(
                CommandExecutionIdentityFactory.Create(request, fingerprint),
                request.Context.CorrelationId,
                Utc(10, 0));
            Assert.AreEqual(CommandReceiptDisposition.Acquired, claim.Disposition);

            var descriptor = new SyntheticEvent(index);
            var plan = new CommandCommitPlanBuilder().Build(
                request,
                fingerprint,
                claim,
                CoreDecision.Succeeded(events: new[] { descriptor }),
                new CoreImplementationDescriptor("Test.Core", "outbox", CoreContractVersion.V1),
                Utc(10, 1));
            var committed = await new PostgresAtomicCommandCommitter(DataSource).CommitAsync(plan);
            Assert.AreEqual(CommandCommitDisposition.Committed, committed.Disposition);

            var envelope = plan.Events.Single();
            messages.Add(new CommittedEventMessage(
                envelope.Metadata.EventId,
                request.Context.CommandId,
                envelope.Metadata.CorrelationId,
                envelope.Metadata.OccurredAtUtc,
                descriptor.Contract,
                $"{{\"Index\":{index}}}"));
        }

        return messages;
    }

    private static CoreEvaluationRequest CreateRequest() =>
        new(
            CoreContractVersion.V1,
            new CoreEvaluationContext(
                CommandId.New(),
                CorrelationId.New(),
                TrustedActorContext.CreatePlayer(AccountId.New(), CharacterId.New(), 1),
                Utc(10, 0),
                new RuleVersion("tests.rules.v1"),
                new ContentVersion("tests.content.v1"),
                new FixedRandomFactory()),
            new SyntheticIntent(),
            Array.Empty<IAuthoritativeSnapshot>());

    private static async Task<bool> IsPublishedAsync(EventId eventId)
    {
        await using var connection = await DataSource.OpenConnectionAsync();
        await using var command = new NpgsqlCommand(
            "SELECT published_at_utc IS NOT NULL FROM nexis_v2.outbox WHERE event_id = @event_id;",
            connection);
        command.Parameters.AddWithValue("event_id", NpgsqlDbType.Uuid, eventId.Value);
        return Convert.ToBoolean(await command.ExecuteScalarAsync());
    }

    private static async Task<bool> HasLeaseAsync(EventId eventId)
    {
        await using var connection = await DataSource.OpenConnectionAsync();
        await using var command = new NpgsqlCommand(
            "SELECT lease_token IS NOT NULL FROM nexis_v2.outbox WHERE event_id = @event_id;",
            connection);
        command.Parameters.AddWithValue("event_id", NpgsqlDbType.Uuid, eventId.Value);
        return Convert.ToBoolean(await command.ExecuteScalarAsync());
    }

    private static async Task<int> ReadAttemptCountAsync(EventId eventId)
    {
        await using var connection = await DataSource.OpenConnectionAsync();
        await using var command = new NpgsqlCommand(
            "SELECT attempt_count FROM nexis_v2.outbox WHERE event_id = @event_id;",
            connection);
        command.Parameters.AddWithValue("event_id", NpgsqlDbType.Uuid, eventId.Value);
        return Convert.ToInt32(await command.ExecuteScalarAsync());
    }

    private static async Task<int> ReadProjectionCounterAsync()
    {
        await using var connection = await DataSource.OpenConnectionAsync();
        await using var command = new NpgsqlCommand(
            "SELECT value FROM nexis_v2_test.projection_counter WHERE counter_key = 'main';",
            connection);
        return Convert.ToInt32(await command.ExecuteScalarAsync());
    }

    private static async Task<int> ReadCheckpointCountAsync(string consumerName, EventId eventId)
    {
        await using var connection = await DataSource.OpenConnectionAsync();
        await using var command = new NpgsqlCommand(
            "SELECT count(*) FROM nexis_v2.event_consumer_checkpoints WHERE consumer_name = @consumer_name AND event_id = @event_id;",
            connection);
        command.Parameters.AddWithValue("consumer_name", NpgsqlDbType.Text, consumerName);
        command.Parameters.AddWithValue("event_id", NpgsqlDbType.Uuid, eventId.Value);
        return Convert.ToInt32(await command.ExecuteScalarAsync());
    }

    private static NpgsqlDataSource DataSource =>
        s_dataSource ?? throw new InvalidOperationException("PostgreSQL test data source was not initialized.");

    private static DateTimeOffset Utc(int hour, int minute, int second = 0) =>
        new(2026, 8, 26, hour, minute, second, TimeSpan.Zero);

    private sealed record SyntheticIntent : ICoreIntent
    {
        public ContractDescriptor Contract { get; } = new("tests.outbox.command", 1);
    }

    private sealed record SyntheticEvent : ICoreEventDescriptor
    {
        public SyntheticEvent(int index)
        {
            Index = index;
        }

        public int Index { get; }

        public ContractDescriptor Contract { get; } = new("tests.outbox.event", 1);
    }

    private sealed class FixedRandomFactory : IDeterministicRandomFactory
    {
        public IDeterministicRandomSource Create() => new FixedRandomSource();

        private sealed class FixedRandomSource : IDeterministicRandomSource
        {
            public ulong NextUInt64() => 1;
        }
    }

    private sealed class RecordingTransport : ICommittedEventTransport
    {
        private readonly bool _throwAfterRecording;

        public RecordingTransport(bool throwAfterRecording = false)
        {
            _throwAfterRecording = throwAfterRecording;
        }

        public List<CommittedEventMessage> Messages { get; } = new();

        public ValueTask PublishAsync(CommittedEventMessage message, CancellationToken cancellationToken = default)
        {
            cancellationToken.ThrowIfCancellationRequested();
            Messages.Add(message);
            if (_throwAfterRecording)
            {
                throw new InvalidOperationException("Synthetic transport failure after external acceptance.");
            }

            return ValueTask.CompletedTask;
        }
    }

    private sealed class CounterProjectionConsumer : IPostgresProjectionEventConsumer
    {
        private readonly bool _shouldThrow;

        public CounterProjectionConsumer(string consumerName, bool shouldThrow)
        {
            ConsumerName = consumerName;
            _shouldThrow = shouldThrow;
        }

        public string ConsumerName { get; }

        public bool Handles(ContractDescriptor contract) =>
            string.Equals(contract.Name, "tests.outbox.event", StringComparison.Ordinal) && contract.SchemaVersion == 1;

        public async ValueTask ApplyAsync(
            NpgsqlConnection connection,
            NpgsqlTransaction transaction,
            CommittedEventMessage message,
            CancellationToken cancellationToken = default)
        {
            const string sql = "UPDATE nexis_v2_test.projection_counter SET value = value + 1 WHERE counter_key = 'main';";
            await using var command = new NpgsqlCommand(sql, connection, transaction);
            await command.ExecuteNonQueryAsync(cancellationToken);

            if (_shouldThrow)
            {
                throw new InvalidOperationException("Synthetic projection failure.");
            }
        }
    }

    private sealed class MutableTimeProvider : TimeProvider
    {
        private DateTimeOffset _utcNow;

        public MutableTimeProvider(DateTimeOffset utcNow)
        {
            _utcNow = utcNow;
        }

        public override DateTimeOffset GetUtcNow() => _utcNow;

        public void Advance(TimeSpan amount) => _utcNow += amount;
    }
}
