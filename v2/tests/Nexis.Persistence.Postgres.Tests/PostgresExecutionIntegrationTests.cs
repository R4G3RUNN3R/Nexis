using Microsoft.VisualStudio.TestTools.UnitTesting;
using Nexis.Audit.Contracts;
using Nexis.Core.Contracts;
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
public sealed class PostgresExecutionIntegrationTests
{
    private static NpgsqlDataSource? s_dataSource;

    private static readonly OwnerKey OwnerA = new("SyntheticOwnerA");
    private static readonly OwnerKey OwnerB = new("SyntheticOwnerB");

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
            CREATE TABLE IF NOT EXISTS nexis_v2_test.owner_a (
                resource_id text PRIMARY KEY,
                value integer NOT NULL,
                revision bigint NOT NULL
            );
            CREATE TABLE IF NOT EXISTS nexis_v2_test.owner_b (
                resource_id text PRIMARY KEY,
                value integer NOT NULL,
                revision bigint NOT NULL
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
                nexis_v2_test.owner_a,
                nexis_v2_test.owner_b
            CASCADE;
            INSERT INTO nexis_v2_test.owner_a(resource_id, value, revision) VALUES ('resource', 0, 1);
            INSERT INTO nexis_v2_test.owner_b(resource_id, value, revision) VALUES ('resource', 0, 1);
            """;

        await using var connection = await DataSource.OpenConnectionAsync();
        await using var command = new NpgsqlCommand(sql, connection);
        await command.ExecuteNonQueryAsync();
    }

    [TestMethod]
    public async Task ConcurrentSameCommand_AcquiresExactlyOneReceipt()
    {
        var repository = new PostgresCommandReceiptRepository(DataSource);
        var request = CreatePlayerRequest(CommandId.New(), CorrelationId.New());
        var payload = Payload("same");
        var identity = CommandExecutionIdentityFactory.Create(request, payload);

        var tasks = Enumerable.Range(0, 10)
            .Select(index => repository.TryAcquireAsync(
                    new CommandReceiptAcquireRequest(
                        identity,
                        payload,
                        CorrelationId.New(),
                        Utc(10, 0),
                        Lease($"worker-{index}")))
                .AsTask())
            .ToArray();

        var claims = await Task.WhenAll(tasks);
        var acquired = claims.Single(claim => claim.Disposition == CommandReceiptDisposition.Acquired);

        Assert.AreEqual(1, claims.Count(claim => claim.Disposition == CommandReceiptDisposition.Acquired));
        Assert.AreEqual(9, claims.Count(claim => claim.Disposition == CommandReceiptDisposition.DuplicateInProgress));
        Assert.IsTrue(claims
            .Where(claim => claim.Disposition == CommandReceiptDisposition.DuplicateInProgress)
            .All(claim => claim.OriginalCorrelationId == acquired.OriginalCorrelationId));
    }

    [TestMethod]
    public async Task ReusedCommandIdWithDifferentPayload_IsIntegrityViolation()
    {
        var repository = new PostgresCommandReceiptRepository(DataSource);
        var request = CreatePlayerRequest(CommandId.New(), CorrelationId.New());
        var payloadA = Payload("payload-a");
        var payloadB = Payload("payload-b");

        await repository.TryAcquireAsync(new CommandReceiptAcquireRequest(
            CommandExecutionIdentityFactory.Create(request, payloadA),
            payloadA,
            request.Context.CorrelationId,
            Utc(10, 0),
            Lease("worker-a")));

        var result = await repository.TryAcquireAsync(new CommandReceiptAcquireRequest(
            CommandExecutionIdentityFactory.Create(request, payloadB),
            payloadB,
            CorrelationId.New(),
            Utc(10, 1),
            Lease("worker-b")));

        Assert.AreEqual(CommandReceiptDisposition.IntegrityViolation, result.Disposition);
    }

    [TestMethod]
    public async Task NewReceipt_PersistsCanonicalPayloadAndExecutionLease()
    {
        var repository = new PostgresCommandReceiptRepository(DataSource);
        var request = CreatePlayerRequest(CommandId.New(), CorrelationId.New());
        var payload = Payload("recoverable");

        var claim = await AcquireAsync(repository, request, payload);

        Assert.AreEqual(CommandReceiptDisposition.Acquired, claim.Disposition);
        await using var connection = await DataSource.OpenConnectionAsync();
        await using var command = new NpgsqlCommand(
            "SELECT canonical_payload::text, execution_owner, execution_lease_expires_at_utc FROM nexis_v2.command_receipts WHERE command_id = @command_id;",
            connection);
        command.Parameters.AddWithValue("command_id", NpgsqlDbType.Uuid, request.Context.CommandId.Value);
        await using var reader = await command.ExecuteReaderAsync();
        Assert.IsTrue(await reader.ReadAsync());
        Assert.AreEqual(payload.Json, reader.GetString(0));
        Assert.AreEqual("integration-worker", reader.GetString(1));
        Assert.IsFalse(reader.IsDBNull(2));
    }

    [TestMethod]
    public async Task MultiOwnerConflict_RollsBackEarlierOwnerAndLeavesReceiptIncomplete()
    {
        var request = CreatePlayerRequest(CommandId.New(), CorrelationId.New());
        var payload = Payload("rollback");
        var repository = new PostgresCommandReceiptRepository(DataSource);
        var claim = await AcquireAsync(repository, request, payload);
        var decision = CoreDecision.Succeeded(
            transitions: new IOwnerTransition[]
            {
                new SyntheticTransition(OwnerA, "resource", 10, 1),
                new SyntheticTransition(OwnerB, "resource", 20, 999)
            },
            events: new[] { new SyntheticEvent() });
        var plan = new CommandCommitPlanBuilder().Build(
            request,
            payload.Fingerprint,
            claim,
            decision,
            CoreDescriptor(),
            Utc(10, 5));
        var committer = CreateCommitter();

        var result = await committer.CommitAsync(plan);

        Assert.AreEqual(CommandCommitDisposition.ConcurrencyConflict, result.Disposition);
        Assert.AreEqual(0, await ReadOwnerValueAsync("owner_a"));
        Assert.AreEqual(0, await ReadOwnerValueAsync("owner_b"));
        Assert.AreEqual(0, await ScalarIntAsync("SELECT count(*) FROM nexis_v2.authoritative_events;"));
        Assert.AreEqual(0, await ScalarIntAsync("SELECT count(*) FROM nexis_v2.outbox;"));
        Assert.IsNull(await ReadTerminalStatusAsync(request.Context.CommandId));
    }

    [TestMethod]
    public async Task MultiOwnerSuccess_CommitsOwnersReceiptHistoryAndOutboxTogether()
    {
        var request = CreatePlayerRequest(CommandId.New(), CorrelationId.New());
        var payload = Payload("success");
        var repository = new PostgresCommandReceiptRepository(DataSource);
        var claim = await AcquireAsync(repository, request, payload);
        var decision = CoreDecision.Succeeded(
            transitions: new IOwnerTransition[]
            {
                new SyntheticTransition(OwnerA, "resource", 10, 1),
                new SyntheticTransition(OwnerB, "resource", 20, 1)
            },
            events: new[] { new SyntheticEvent() });
        var plan = new CommandCommitPlanBuilder().Build(
            request,
            payload.Fingerprint,
            claim,
            decision,
            CoreDescriptor(),
            Utc(10, 5));

        var result = await CreateCommitter().CommitAsync(plan);

        Assert.AreEqual(CommandCommitDisposition.Committed, result.Disposition);
        Assert.AreEqual(10, await ReadOwnerValueAsync("owner_a"));
        Assert.AreEqual(20, await ReadOwnerValueAsync("owner_b"));
        Assert.AreEqual((int)CommandTerminalStatus.Succeeded, await ReadTerminalStatusAsync(request.Context.CommandId));
        Assert.AreEqual(1, await ScalarIntAsync("SELECT count(*) FROM nexis_v2.authoritative_events;"));
        Assert.AreEqual(1, await ScalarIntAsync("SELECT count(*) FROM nexis_v2.outbox;"));
        Assert.AreEqual(0, await ScalarIntAsync("SELECT count(*) FROM nexis_v2.command_receipts WHERE execution_owner IS NOT NULL OR execution_lease_expires_at_utc IS NOT NULL;"));

        var duplicate = await repository.TryAcquireAsync(new CommandReceiptAcquireRequest(
            CommandExecutionIdentityFactory.Create(request, payload),
            payload,
            CorrelationId.New(),
            Utc(10, 6),
            Lease("duplicate-worker")));
        Assert.AreEqual(CommandReceiptDisposition.DuplicateCompleted, duplicate.Disposition);
        Assert.AreEqual(CommandTerminalStatus.Succeeded, duplicate.TerminalOutcome?.Status);
    }

    [TestMethod]
    public async Task AdminCommand_PersistsAuditInSameTransaction()
    {
        var accountId = AccountId.New();
        var request = CreateAdminRequest(accountId, CommandId.New(), CorrelationId.New());
        var payload = Payload("admin");
        var repository = new PostgresCommandReceiptRepository(DataSource);
        var claim = await AcquireAsync(repository, request, payload);
        var audit = new AuditEntry(
            AuditId.New(),
            accountId,
            null,
            AuditActionKind.StateMutation,
            AuditVisibility.InternalOnly,
            Utc(10, 5),
            "admin.test",
            "rejected",
            null,
            "INTEGRATION",
            claim.OriginalCorrelationId,
            null);
        var plan = new CommandCommitPlanBuilder().Build(
            request,
            payload.Fingerprint,
            claim,
            CoreDecision.Rejected(new CoreReasonCode("tests.rejected")),
            CoreDescriptor(),
            Utc(10, 5),
            auditEntries: new[] { audit });

        var result = await CreateCommitter().CommitAsync(plan);

        Assert.AreEqual(CommandCommitDisposition.Committed, result.Disposition);
        Assert.AreEqual(1, await ScalarIntAsync("SELECT count(*) FROM nexis_v2.admin_audit;"));
        Assert.AreEqual((int)CommandTerminalStatus.Rejected, await ReadTerminalStatusAsync(request.Context.CommandId));
    }

    [TestMethod]
    public async Task AppendOnlyReadAudit_DoesNotRequireCommandReceipt()
    {
        var entry = new AuditEntry(
            AuditId.New(),
            AccountId.New(),
            null,
            AuditActionKind.PrivilegedRead,
            AuditVisibility.InternalOnly,
            Utc(10, 5),
            "admin.read",
            "allowed",
            null,
            "READ-TEST",
            CorrelationId.New(),
            null);

        await new PostgresAppendOnlyAuditLog(DataSource).AppendAsync(entry);

        Assert.AreEqual(1, await ScalarIntAsync("SELECT count(*) FROM nexis_v2.admin_audit WHERE command_id IS NULL;"));
    }

    [TestMethod]
    public void RetryClassifier_AllowsOnlySerializationAndDeadlockSqlStates()
    {
        Assert.IsTrue(PostgresTransientCommandFailureClassifier.IsRetryableSqlState("40001"));
        Assert.IsTrue(PostgresTransientCommandFailureClassifier.IsRetryableSqlState("40P01"));
        Assert.IsFalse(PostgresTransientCommandFailureClassifier.IsRetryableSqlState("23505"));
        Assert.IsFalse(PostgresTransientCommandFailureClassifier.IsRetryableSqlState(null));
    }

    private static NpgsqlDataSource DataSource =>
        s_dataSource ?? throw new InvalidOperationException("PostgreSQL test data source was not initialized.");

    private static PostgresAtomicCommandCommitter CreateCommitter() =>
        new(
            DataSource,
            new IPostgresOwnerTransitionApplier[]
            {
                new SyntheticOwnerApplier(OwnerA, "nexis_v2_test.owner_a"),
                new SyntheticOwnerApplier(OwnerB, "nexis_v2_test.owner_b")
            });

    private static async ValueTask<CommandReceiptClaim> AcquireAsync(
        PostgresCommandReceiptRepository repository,
        CoreEvaluationRequest request,
        CanonicalCommandPayload payload)
    {
        var claim = await repository.TryAcquireAsync(new CommandReceiptAcquireRequest(
            CommandExecutionIdentityFactory.Create(request, payload),
            payload,
            request.Context.CorrelationId,
            Utc(10, 0),
            Lease("integration-worker")));
        Assert.AreEqual(CommandReceiptDisposition.Acquired, claim.Disposition);
        return claim;
    }

    private static CoreEvaluationRequest CreatePlayerRequest(CommandId commandId, CorrelationId correlationId) =>
        CreateRequest(commandId, correlationId, TrustedActorContext.CreatePlayer(AccountId.New(), CharacterId.New(), 1));

    private static CoreEvaluationRequest CreateAdminRequest(
        AccountId accountId,
        CommandId commandId,
        CorrelationId correlationId) =>
        CreateRequest(
            commandId,
            correlationId,
            TrustedActorContext.CreateStaff(
                accountId,
                1,
                capabilities: new[] { new PlatformCapabilityKey("admin.test") }));

    private static CoreEvaluationRequest CreateRequest(
        CommandId commandId,
        CorrelationId correlationId,
        TrustedActorContext actor) =>
        new(
            CoreContractVersion.V1,
            new CoreEvaluationContext(
                commandId,
                correlationId,
                actor,
                Utc(10, 0),
                new RuleVersion("tests.rules.v1"),
                new ContentVersion("tests.content.v1"),
                new FixedRandomFactory()),
            new SyntheticIntent(),
            Array.Empty<IAuthoritativeSnapshot>());

    private static CanonicalCommandPayload Payload(string value) =>
        CanonicalCommandPayload.FromTrustedJson($"{{\"value\":\"{value}\"}}");

    private static CommandExecutionLeaseRequest Lease(string workerId) =>
        new(workerId, TimeSpan.FromMinutes(1));

    private static CoreImplementationDescriptor CoreDescriptor() =>
        new("Test.Core", "postgres-proof", CoreContractVersion.V1);

    private static DateTimeOffset Utc(int hour, int minute) =>
        new(2026, 8, 26, hour, minute, 0, TimeSpan.Zero);

    private static async Task<int> ReadOwnerValueAsync(string table)
    {
        await using var connection = await DataSource.OpenConnectionAsync();
        await using var command = new NpgsqlCommand($"SELECT value FROM nexis_v2_test.{table} WHERE resource_id = 'resource';", connection);
        return Convert.ToInt32(await command.ExecuteScalarAsync());
    }

    private static async Task<int?> ReadTerminalStatusAsync(CommandId commandId)
    {
        await using var connection = await DataSource.OpenConnectionAsync();
        await using var command = new NpgsqlCommand(
            "SELECT terminal_status FROM nexis_v2.command_receipts WHERE command_id = @command_id;",
            connection);
        command.Parameters.AddWithValue("command_id", NpgsqlDbType.Uuid, commandId.Value);
        var value = await command.ExecuteScalarAsync();
        return value is null or DBNull ? null : Convert.ToInt32(value);
    }

    private static async Task<int> ScalarIntAsync(string sql)
    {
        await using var connection = await DataSource.OpenConnectionAsync();
        await using var command = new NpgsqlCommand(sql, connection);
        return Convert.ToInt32(await command.ExecuteScalarAsync());
    }

    private sealed record SyntheticIntent : ICoreIntent
    {
        public ContractDescriptor Contract { get; } = new("tests.postgres.command", 1);
    }

    private sealed record SyntheticEvent : ICoreEventDescriptor
    {
        public ContractDescriptor Contract { get; } = new("tests.postgres.event", 1);
    }

    private sealed record SyntheticTransition(
        OwnerKey TargetOwner,
        string ResourceId,
        int Delta,
        long? ExpectedRevision) : IOwnerTransition
    {
        public ContractDescriptor Contract { get; } = new("tests.postgres.transition", 1);
    }

    private sealed class SyntheticOwnerApplier : IPostgresOwnerTransitionApplier
    {
        private readonly string _table;

        public SyntheticOwnerApplier(OwnerKey owner, string table)
        {
            Owner = owner;
            _table = table;
        }

        public OwnerKey Owner { get; }

        public async ValueTask<PostgresOwnerTransitionResult> ApplyAsync(
            NpgsqlConnection connection,
            NpgsqlTransaction transaction,
            IOwnerTransition transition,
            CancellationToken cancellationToken = default)
        {
            if (transition is not SyntheticTransition synthetic || synthetic.TargetOwner != Owner || !synthetic.ExpectedRevision.HasValue)
            {
                throw new InvalidOperationException("Synthetic PostgreSQL owner received an unsupported transition.");
            }

            var sql = $"""
                UPDATE {_table}
                SET value = value + @delta,
                    revision = revision + 1
                WHERE resource_id = @resource_id
                  AND revision = @expected_revision;
                """;

            await using var command = new NpgsqlCommand(sql, connection, transaction);
            command.Parameters.AddWithValue("delta", NpgsqlDbType.Integer, synthetic.Delta);
            command.Parameters.AddWithValue("resource_id", NpgsqlDbType.Text, synthetic.ResourceId);
            command.Parameters.AddWithValue("expected_revision", NpgsqlDbType.Bigint, synthetic.ExpectedRevision.Value);
            var rows = await command.ExecuteNonQueryAsync(cancellationToken);

            return rows == 1
                ? PostgresOwnerTransitionResult.Applied()
                : PostgresOwnerTransitionResult.ConcurrencyConflict(new CommandReasonCode("tests.revision_conflict"));
        }
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
