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

/// <summary>
/// Independent adversarial RED tests produced by the L3 Foundation threat model against integrator
/// checkpoint 58f40f4. Each test asserts a required Foundation invariant that the current
/// implementation does not yet uphold. They are expected to FAIL until the corresponding finding is
/// fixed by the Foundation integrator, and must not be weakened to make them pass.
/// All infrastructure used here is disposable local PostgreSQL.
/// </summary>
[TestClass]
[DoNotParallelize]
public sealed class ClaudeFoundationThreatModelIntegrationTests
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
                nexis_v2.command_receipts
            CASCADE;
            """;

        await using var connection = await DataSource.OpenConnectionAsync();
        await using var command = new NpgsqlCommand(sql, connection);
        await command.ExecuteNonQueryAsync();
    }

    /// <summary>
    /// FINDING TM-05 (High, recovery denial of service).
    /// ClaimExpiredBatchAsync selects a whole batch of expired commands, then calls BuildRecovered for
    /// each inside one transaction. BuildRecovered throws InvalidOperationException when a stored
    /// canonical_payload no longer matches its durable fingerprint. The throw aborts the entire
    /// transaction, so every healthy expired command in the same batch is also left unrecovered, and
    /// because the batch is ordered by lease expiry the corrupted row is selected again on every
    /// subsequent sweep. One damaged row therefore halts crash recovery permanently.
    /// Required invariant: a single unrecoverable receipt must be quarantined without preventing
    /// recovery of the healthy commands in the same sweep.
    /// </summary>
    [TestMethod]
    public async Task CorruptedReceiptPayload_MustNotBlockRecoveryOfHealthyExpiredCommands()
    {
        var poison = await AcquireExpiredAsync("{\"kind\":\"poison\"}");
        var healthy = await AcquireExpiredAsync("{\"kind\":\"healthy\"}");

        // Simulate storage-level damage/tampering of one canonical payload while its durable
        // fingerprint stays unchanged. Ordered first so it is always selected in the sweep.
        await CorruptCanonicalPayloadAsync(poison, "{\"kind\":\"tampered\"}");

        var recovery = new PostgresCommandRecoveryRepository(DataSource);

        IReadOnlyList<RecoveredCommandExecution> claimed = Array.Empty<RecoveredCommandExecution>();
        Exception? thrown = null;
        try
        {
            claimed = await recovery.ClaimExpiredBatchAsync(
                new CommandExecutionLeaseRequest("recovery-worker", TimeSpan.FromMinutes(1)),
                Utc(11, 0),
                maximumItems: 10);
        }
        catch (Exception exception)
        {
            thrown = exception;
        }

        Assert.IsNull(
            thrown,
            "One corrupted receipt aborted the whole recovery sweep: " + thrown?.Message);
        Assert.IsTrue(
            claimed.Any(item => item.CommandId == healthy),
            "The healthy expired command was not recovered because a corrupted receipt in the same "
            + "batch rolled the recovery transaction back.");
    }

    /// <summary>
    /// FINDING TM-06 (High, poison event / retry exhaustion).
    /// nexis_v2.outbox has no dead-letter state and no maximum attempt bound, and ClaimBatchAsync
    /// re-claims any unpublished row whose lease has expired. An event whose transport always fails is
    /// therefore retried without limit forever, consuming a batch slot on every sweep, and no
    /// operational surface reports that it has exhausted its retries.
    /// Required invariant: an outbox event that keeps failing must eventually stop being claimed as an
    /// ordinary delivery and become an explicit, reportable dead-letter/poison condition.
    /// </summary>
    [TestMethod]
    public async Task OutboxEventThatAlwaysFails_MustEventuallyBeQuarantinedInsteadOfRetriedForever()
    {
        var seeded = await SeedCommittedEventAsync();
        var transport = new AlwaysFailingTransport();
        var clock = new MutableTimeProvider(Utc(11, 0));
        var dispatcher = new PostgresOutboxDispatcher(
            new PostgresOutboxStore(DataSource),
            transport,
            "poison-dispatcher",
            batchSize: 10,
            leaseDuration: TimeSpan.FromSeconds(30),
            failureDelay: TimeSpan.Zero,
            clock);

        const int sweeps = 25;
        for (var sweep = 0; sweep < sweeps; sweep++)
        {
            await dispatcher.DispatchOnceAsync();
            clock.Advance(TimeSpan.FromMinutes(1));
        }

        var attempts = await ReadAttemptCountAsync(seeded);
        var stillClaimable = await IsClaimableAsync(seeded, Utc(12, 0));

        Assert.IsFalse(
            stillClaimable && attempts >= sweeps,
            $"A permanently failing outbox event was claimed {attempts} times across {sweeps} sweeps and "
            + "is still an ordinary claimable delivery. There is no dead-letter state, no attempt bound "
            + "and no retry-exhaustion signal.");
    }

    private static async ValueTask<CommandId> AcquireExpiredAsync(string canonicalJson)
    {
        var request = CreateRequest();
        var payload = CanonicalCommandPayload.FromTrustedJson(canonicalJson);
        var repository = new PostgresCommandReceiptRepository(DataSource);
        var claim = await repository.TryAcquireAsync(new CommandReceiptAcquireRequest(
            CommandExecutionIdentityFactory.Create(request, payload),
            payload,
            request.Context.CorrelationId,
            Utc(10, 0),
            new CommandExecutionLeaseRequest("crashed-worker", TimeSpan.FromSeconds(30))));
        Assert.AreEqual(CommandReceiptDisposition.Acquired, claim.Disposition);
        return request.Context.CommandId;
    }

    private static async Task CorruptCanonicalPayloadAsync(CommandId commandId, string tamperedJson)
    {
        const string sql = """
            UPDATE nexis_v2.command_receipts
            SET canonical_payload = @canonical_payload
            WHERE command_id = @command_id;
            """;

        await using var connection = await DataSource.OpenConnectionAsync();
        await using var command = new NpgsqlCommand(sql, connection);
        command.Parameters.AddWithValue("canonical_payload", NpgsqlDbType.Text, tamperedJson);
        command.Parameters.AddWithValue("command_id", NpgsqlDbType.Uuid, commandId.Value);
        Assert.AreEqual(1, await command.ExecuteNonQueryAsync());
    }

    private static async Task<EventId> SeedCommittedEventAsync()
    {
        var request = CreateRequest();
        var payload = CanonicalCommandPayload.FromTrustedJson(
            $"{{\"commandId\":\"{request.Context.CommandId.Value:D}\"}}");
        var repository = new PostgresCommandReceiptRepository(DataSource);
        var claim = await repository.TryAcquireAsync(new CommandReceiptAcquireRequest(
            CommandExecutionIdentityFactory.Create(request, payload),
            payload,
            request.Context.CorrelationId,
            Utc(10, 0),
            new CommandExecutionLeaseRequest("poison-seed", TimeSpan.FromMinutes(1))));
        Assert.AreEqual(CommandReceiptDisposition.Acquired, claim.Disposition);

        var plan = new CommandCommitPlanBuilder().Build(
            request,
            payload.Fingerprint,
            claim,
            CoreDecision.Succeeded(events: new[] { new SyntheticEvent() }),
            new CoreImplementationDescriptor("Test.Core", "threat-model", CoreContractVersion.V1),
            Utc(10, 1));
        var committed = await new PostgresAtomicCommandCommitter(DataSource).CommitAsync(plan);
        Assert.AreEqual(CommandCommitDisposition.Committed, committed.Disposition);
        return plan.Events.Single().Metadata.EventId;
    }

    private static async Task<int> ReadAttemptCountAsync(EventId eventId)
    {
        const string sql = "SELECT attempt_count FROM nexis_v2.outbox WHERE event_id = @event_id;";
        await using var connection = await DataSource.OpenConnectionAsync();
        await using var command = new NpgsqlCommand(sql, connection);
        command.Parameters.AddWithValue("event_id", NpgsqlDbType.Uuid, eventId.Value);
        return (int)(await command.ExecuteScalarAsync() ?? 0);
    }

    private static async Task<bool> IsClaimableAsync(EventId eventId, DateTimeOffset nowUtc)
    {
        const string sql = """
            SELECT count(*)
            FROM nexis_v2.outbox
            WHERE event_id = @event_id
              AND published_at_utc IS NULL
              AND available_at_utc <= @now_utc
              AND (lease_expires_at_utc IS NULL OR lease_expires_at_utc <= @now_utc);
            """;

        await using var connection = await DataSource.OpenConnectionAsync();
        await using var command = new NpgsqlCommand(sql, connection);
        command.Parameters.AddWithValue("event_id", NpgsqlDbType.Uuid, eventId.Value);
        command.Parameters.AddWithValue("now_utc", NpgsqlDbType.TimestampTz, nowUtc.UtcDateTime);
        return (long)(await command.ExecuteScalarAsync() ?? 0L) == 1;
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

    private static DateTimeOffset Utc(int hour, int minute, int second = 0) =>
        new(2026, 8, 28, hour, minute, second, TimeSpan.Zero);

    private static NpgsqlDataSource DataSource =>
        s_dataSource ?? throw new InvalidOperationException("PostgreSQL test data source was not initialized.");

    private sealed record SyntheticIntent : ICoreIntent
    {
        public ContractDescriptor Contract { get; } = new("tests.threat-model.command", 1);
    }

    private sealed record SyntheticEvent : ICoreEventDescriptor
    {
        public ContractDescriptor Contract { get; } = new("tests.threat-model.event", 1);
    }

    private sealed class FixedRandomFactory : IDeterministicRandomFactory
    {
        public IDeterministicRandomSource Create() => new FixedRandomSource();

        private sealed class FixedRandomSource : IDeterministicRandomSource
        {
            public ulong NextUInt64() => 1;
        }
    }

    private sealed class AlwaysFailingTransport : ICommittedEventTransport
    {
        public int Attempts { get; private set; }

        public ValueTask PublishAsync(CommittedEventMessage message, CancellationToken cancellationToken = default)
        {
            Attempts++;
            throw new InvalidOperationException("Synthetic permanently poisoned transport failure.");
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

        public void Advance(TimeSpan delta) => _utcNow += delta;
    }
}
