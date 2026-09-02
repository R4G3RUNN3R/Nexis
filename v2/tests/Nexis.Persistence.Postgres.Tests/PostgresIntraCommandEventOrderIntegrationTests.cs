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
/// Durable proof that a multi-event command keeps a recoverable total order across real
/// persistence and outbox delivery, without relying on timestamps, row order or list identity.
/// </summary>
[TestClass]
[DoNotParallelize]
public sealed class PostgresIntraCommandEventOrderIntegrationTests
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

    [TestMethod]
    public async Task CommittedEvents_KeepTheirIntraCommandOrderInAuthoritativeHistory()
    {
        var committed = await CommitFiveEventCommandAsync();

        // Read back deliberately ordered by event_id, which is random, so any surviving order must
        // come from the persisted sequence rather than from insertion or physical row order.
        var rows = await ReadEventsAsync(committed.CommandId, orderBy: "event_id");

        CollectionAssert.AreEqual(
            new[] { 0, 1, 2, 3, 4 },
            rows.OrderBy(static row => row.Sequence).Select(static row => row.Sequence).ToArray());

        CollectionAssert.AreEqual(
            new[] { "tests.step-0", "tests.step-1", "tests.step-2", "tests.step-3", "tests.step-4" },
            rows.OrderBy(static row => row.Sequence).Select(static row => row.ContractName).ToArray(),
            "History must reconstruct the authoritative intra-command order from durable metadata alone.");

        // All five share one authoritative instant, so the timestamp genuinely cannot order them.
        Assert.AreEqual(1, rows.Select(static row => row.OccurredAtUtc).Distinct().Count());
    }

    [TestMethod]
    public async Task PersistedCausationChain_ReconstructsTheSameOrderIndependently()
    {
        var committed = await CommitFiveEventCommandAsync();
        var rows = await ReadEventsAsync(committed.CommandId, orderBy: "event_id");

        // Walk the durable causation chain from the single root, without consulting the sequence.
        var byCausation = rows.ToDictionary(static row => row.CausationEventId ?? Guid.Empty, static row => row);
        var walked = new List<string>();
        var cursor = Guid.Empty;
        while (byCausation.TryGetValue(cursor, out var row))
        {
            walked.Add(row.ContractName);
            cursor = row.EventId;
        }

        CollectionAssert.AreEqual(
            new[] { "tests.step-0", "tests.step-1", "tests.step-2", "tests.step-3", "tests.step-4" },
            walked.ToArray(),
            "The persisted causation chain must independently reproduce the authoritative order.");

        Assert.AreEqual(1, rows.Count(static row => row.CausationEventId is null), "Exactly one root event.");
    }

    [TestMethod]
    public async Task Database_RefusesTwoEventsClaimingTheSamePositionInOneCommand()
    {
        var committed = await CommitFiveEventCommandAsync();
        var existing = (await ReadEventsAsync(committed.CommandId, orderBy: "intra_command_sequence")).First();

        var duplicate = await Assert.ThrowsExactlyAsync<PostgresException>(async () =>
        {
            await using var connection = await DataSource.OpenConnectionAsync();
            await using var command = new NpgsqlCommand(
                """
                INSERT INTO nexis_v2.authoritative_events (
                    event_id, command_id, correlation_id, occurred_at_utc, causation_event_id,
                    contract_name, contract_schema_version, payload, intra_command_sequence)
                VALUES (@e, @c, @r, @o, NULL, @n, 1, '{}'::jsonb, @s);
                """,
                connection);
            command.Parameters.AddWithValue("e", NpgsqlDbType.Uuid, Guid.NewGuid());
            command.Parameters.AddWithValue("c", NpgsqlDbType.Uuid, committed.CommandId.Value);
            command.Parameters.AddWithValue("r", NpgsqlDbType.Uuid, Guid.NewGuid());
            command.Parameters.AddWithValue("o", NpgsqlDbType.TimestampTz, existing.OccurredAtUtc);
            command.Parameters.AddWithValue("n", NpgsqlDbType.Text, "tests.impostor");
            command.Parameters.AddWithValue("s", NpgsqlDbType.Integer, existing.Sequence);
            await command.ExecuteNonQueryAsync();
        });

        Assert.AreEqual("23505", duplicate.SqlState,
            "UNIQUE (command_id, intra_command_sequence) is the structural guarantee that the order is total.");
    }

    [TestMethod]
    public async Task Database_RefusesANegativeIntraCommandSequence()
    {
        var committed = await CommitFiveEventCommandAsync();

        var rejected = await Assert.ThrowsExactlyAsync<PostgresException>(async () =>
        {
            await using var connection = await DataSource.OpenConnectionAsync();
            await using var command = new NpgsqlCommand(
                """
                INSERT INTO nexis_v2.authoritative_events (
                    event_id, command_id, correlation_id, occurred_at_utc, causation_event_id,
                    contract_name, contract_schema_version, payload, intra_command_sequence)
                VALUES (@e, @c, @r, now(), NULL, 'tests.negative', 1, '{}'::jsonb, -1);
                """,
                connection);
            command.Parameters.AddWithValue("e", NpgsqlDbType.Uuid, Guid.NewGuid());
            command.Parameters.AddWithValue("c", NpgsqlDbType.Uuid, committed.CommandId.Value);
            command.Parameters.AddWithValue("r", NpgsqlDbType.Uuid, Guid.NewGuid());
            await command.ExecuteNonQueryAsync();
        });

        Assert.AreEqual("23514", rejected.SqlState);
    }

    [TestMethod]
    public async Task ReRunningTheSchemaMigrationsDoesNotRewriteExistingEventOrder()
    {
        var committed = await CommitFiveEventCommandAsync();
        var before = (await ReadEventsAsync(committed.CommandId, orderBy: "intra_command_sequence"))
            .Select(static row => (row.EventId, row.Sequence))
            .ToArray();

        // EnsureCreatedAsync re-executes every migration file. A backfill that re-derived sequences
        // for rows that already carry authoritative values would overwrite real emission order and
        // collide with the uniqueness constraint, so the add-and-backfill must be strictly one-time.
        await PostgresExecutionSchema.EnsureCreatedAsync(DataSource);
        await PostgresExecutionSchema.EnsureCreatedAsync(DataSource);

        var after = (await ReadEventsAsync(committed.CommandId, orderBy: "intra_command_sequence"))
            .Select(static row => (row.EventId, row.Sequence))
            .ToArray();

        CollectionAssert.AreEqual(before, after, "Re-running migrations must not renumber committed events.");
    }

    [TestMethod]
    public async Task OutboxDelivery_CarriesTheIntraCommandSequenceAndClaimsInOrder()
    {
        var committed = await CommitFiveEventCommandAsync();

        var lease = await new PostgresOutboxStore(DataSource).ClaimBatchAsync(
            "order-worker",
            maximumItems: 10,
            nowUtc: Utc(11, 0),
            leaseDuration: TimeSpan.FromMinutes(1));

        var claimed = lease.Items
            .Select(static item => item.Message)
            .Where(message => message.CommandId == committed.CommandId)
            .ToArray();

        Assert.AreEqual(5, claimed.Length);

        CollectionAssert.AreEqual(
            new[] { 0, 1, 2, 3, 4 },
            claimed.Select(static message => message.IntraCommandSequence).ToArray(),
            "Outbox delivery must surface one command's events in their authoritative order.");

        CollectionAssert.AreEqual(
            new[] { "tests.step-0", "tests.step-1", "tests.step-2", "tests.step-3", "tests.step-4" },
            claimed.Select(static message => message.Contract.Name).ToArray());
    }

    private static async Task<(CommandId CommandId, CommandCommitPlan Plan)> CommitFiveEventCommandAsync()
    {
        var request = CreateRequest();
        var payload = CanonicalCommandPayload.FromTrustedJson(
            $"{{\"commandId\":\"{request.Context.CommandId.Value:D}\"}}");

        var claim = await new PostgresCommandReceiptRepository(DataSource).TryAcquireAsync(
            new CommandReceiptAcquireRequest(
                CommandExecutionIdentityFactory.Create(request, payload),
                payload,
                request.Context.CorrelationId,
                Utc(10, 0),
                new CommandExecutionLeaseRequest("order-seed", TimeSpan.FromMinutes(1))));
        Assert.AreEqual(CommandReceiptDisposition.Acquired, claim.Disposition);

        var plan = new CommandCommitPlanBuilder().Build(
            request,
            payload.Fingerprint,
            claim,
            CoreDecision.Succeeded(events: Enumerable.Range(0, 5)
                .Select(static index => (ICoreEventDescriptor)new StepEvent(index))
                .ToArray()),
            new CoreImplementationDescriptor("Test.Core", "order", CoreContractVersion.V1),
            Utc(10, 1));

        var committed = await new PostgresAtomicCommandCommitter(DataSource).CommitAsync(plan);
        Assert.AreEqual(CommandCommitDisposition.Committed, committed.Disposition);

        return (request.Context.CommandId, plan);
    }

    private static async Task<IReadOnlyList<EventRow>> ReadEventsAsync(CommandId commandId, string orderBy)
    {
        // orderBy is chosen from this test's own closed set, never from external input.
        var sql = $"""
            SELECT event_id, causation_event_id, contract_name, occurred_at_utc, intra_command_sequence
            FROM nexis_v2.authoritative_events
            WHERE command_id = @command_id
            ORDER BY {orderBy};
            """;

        var rows = new List<EventRow>();
        await using var connection = await DataSource.OpenConnectionAsync();
        await using var command = new NpgsqlCommand(sql, connection);
        command.Parameters.AddWithValue("command_id", NpgsqlDbType.Uuid, commandId.Value);

        await using var reader = await command.ExecuteReaderAsync();
        while (await reader.ReadAsync())
        {
            rows.Add(new EventRow(
                reader.GetGuid(0),
                reader.IsDBNull(1) ? null : reader.GetGuid(1),
                reader.GetString(2),
                reader.GetDateTime(3),
                reader.GetInt32(4)));
        }

        return rows;
    }

    private static CoreEvaluationRequest CreateRequest() =>
        new(
            CoreContractVersion.V1,
            new CoreEvaluationContext(
                CommandId.New(),
                CorrelationId.New(),
                TrustedActorContext.CreatePlayer(AccountId.New(), CharacterId.New(), 1),
                Utc(10, 0),
                new RuleVersion("order.rules.v1"),
                new ContentVersion("order.content.v1"),
                new StubRandomFactory()),
            new StubIntent(),
            Array.Empty<IAuthoritativeSnapshot>());

    private static DateTimeOffset Utc(int hour, int minute) => new(2026, 9, 1, hour, minute, 0, TimeSpan.Zero);

    private static NpgsqlDataSource DataSource =>
        s_dataSource ?? throw new InvalidOperationException("PostgreSQL test data source was not initialized.");

    private sealed record EventRow(
        Guid EventId,
        Guid? CausationEventId,
        string ContractName,
        DateTime OccurredAtUtc,
        int Sequence);

    private sealed record StepEvent(int Index) : ICoreEventDescriptor
    {
        public ContractDescriptor Contract => new($"tests.step-{Index}", 1);
    }

    private sealed record StubIntent : ICoreIntent
    {
        public ContractDescriptor Contract { get; } = new("tests.order-intent", 1);
    }

    private sealed class StubRandomFactory : IDeterministicRandomFactory
    {
        public IDeterministicRandomSource Create() => new StubRandomSource();

        private sealed class StubRandomSource : IDeterministicRandomSource
        {
            public ulong NextUInt64() => 1;
        }
    }
}
