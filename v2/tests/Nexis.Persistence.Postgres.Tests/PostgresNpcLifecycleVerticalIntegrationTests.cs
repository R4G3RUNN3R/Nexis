using Microsoft.VisualStudio.TestTools.UnitTesting;
using Nexis.Core;
using Nexis.Core.Contracts;
using Nexis.Execution;
using Nexis.Execution.Contracts;
using Nexis.Identity.Contracts;
using Nexis.Kernel.Commands;
using Nexis.Kernel.Events;
using Nexis.Kernel.Randomness;
using Nexis.Modules.Npcs;
using Nexis.Npcs.Contracts;
using Nexis.Persistence.Postgres;
using Npgsql;

namespace Nexis.Persistence.Postgres.Tests;

[TestClass]
[DoNotParallelize]
public sealed class PostgresNpcLifecycleVerticalIntegrationTests
{
    private static readonly DateTimeOffset EvaluationTime =
        new(2026, 9, 16, 12, 0, 0, TimeSpan.Zero);
    private static NpgsqlDataSource? s_dataSource;

    private static NpgsqlDataSource DataSource =>
        s_dataSource ?? throw new InvalidOperationException("PostgreSQL test data source is not initialized.");

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
                nexis_v2.npc_lifecycle_state,
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
    public async Task EstablishNpcLifecycle_CommitsOwnerHistoryOutboxAndDuplicateCommandIsIdempotent()
    {
        var npcId = NpcId.New();
        var birth = new DateTimeOffset(1990, 9, 16, 12, 0, 0, TimeSpan.Zero);
        var request = BuildRequest(CommandId.New(), CorrelationId.New(), npcId, birth);
        var engine = new CoreRulesEngine();
        var decision = engine.Evaluate(request);
        Assert.AreEqual(CoreOutcomeStatus.Succeeded, decision.Status);

        var codec = new EstablishNpcLifecycleCanonicalCommandCodec();
        var payload = codec.Serialize(request.Intent);
        var receiptRepository = new PostgresCommandReceiptRepository(DataSource);
        var claim = await receiptRepository.TryAcquireAsync(new CommandReceiptAcquireRequest(
            CommandExecutionIdentityFactory.Create(request, payload),
            payload,
            request.Context.CorrelationId,
            EvaluationTime.AddSeconds(1),
            new CommandExecutionLeaseRequest("npc-lifecycle-test", TimeSpan.FromMinutes(1))));
        Assert.AreEqual(CommandReceiptDisposition.Acquired, claim.Disposition);

        var plan = new CommandCommitPlanBuilder().Build(
            request,
            payload.Fingerprint,
            claim,
            decision,
            engine.Descriptor,
            EvaluationTime.AddSeconds(2));
        var commit = await new PostgresAtomicCommandCommitter(
            DataSource,
            new IPostgresOwnerTransitionApplier[] { new PostgresNpcLifecycleTransitionApplier() })
            .CommitAsync(plan);

        Assert.AreEqual(CommandCommitDisposition.Committed, commit.Disposition);
        var persisted = await new PostgresNpcLifecycleSnapshotReader(DataSource).ReadAsync(npcId);
        Assert.AreEqual(1L, persisted.Revision);
        Assert.AreEqual(birth, persisted.BirthInstantUtc);
        Assert.AreEqual(NpcLifecycleStatus.Living, persisted.Status);
        Assert.AreEqual(1, await ScalarIntAsync("SELECT count(*) FROM nexis_v2.npc_lifecycle_state;"));
        Assert.AreEqual(1, await ScalarIntAsync("SELECT count(*) FROM nexis_v2.authoritative_events;"));
        Assert.AreEqual(1, await ScalarIntAsync("SELECT count(*) FROM nexis_v2.outbox;"));

        var duplicate = await receiptRepository.TryAcquireAsync(new CommandReceiptAcquireRequest(
            CommandExecutionIdentityFactory.Create(request, payload),
            payload,
            CorrelationId.New(),
            EvaluationTime.AddSeconds(3),
            new CommandExecutionLeaseRequest("npc-lifecycle-duplicate", TimeSpan.FromMinutes(1))));

        Assert.AreEqual(CommandReceiptDisposition.DuplicateCompleted, duplicate.Disposition);
        Assert.AreEqual(CommandTerminalStatus.Succeeded, duplicate.TerminalOutcome?.Status);
        Assert.AreEqual(1, await ScalarIntAsync("SELECT count(*) FROM nexis_v2.npc_lifecycle_state;"));
        Assert.AreEqual(1, await ScalarIntAsync("SELECT count(*) FROM nexis_v2.authoritative_events;"));
        Assert.AreEqual(1, await ScalarIntAsync("SELECT count(*) FROM nexis_v2.outbox;"));
    }

    [TestMethod]
    public async Task EstablishNpcLifecycle_DifferentCommandForSameNpcConflictsWithoutDuplicateHistory()
    {
        var npcId = NpcId.New();
        var birth = new DateTimeOffset(1988, 1, 11, 9, 0, 0, TimeSpan.Zero);
        var engine = new CoreRulesEngine();
        var codec = new EstablishNpcLifecycleCanonicalCommandCodec();
        var receipts = new PostgresCommandReceiptRepository(DataSource);
        var committer = new PostgresAtomicCommandCommitter(
            DataSource,
            new IPostgresOwnerTransitionApplier[] { new PostgresNpcLifecycleTransitionApplier() });

        var firstRequest = BuildRequest(CommandId.New(), CorrelationId.New(), npcId, birth);
        var firstDecision = engine.Evaluate(firstRequest);
        Assert.AreEqual(CoreOutcomeStatus.Succeeded, firstDecision.Status);
        var firstPayload = codec.Serialize(firstRequest.Intent);
        var firstClaim = await receipts.TryAcquireAsync(new CommandReceiptAcquireRequest(
            CommandExecutionIdentityFactory.Create(firstRequest, firstPayload),
            firstPayload,
            firstRequest.Context.CorrelationId,
            EvaluationTime.AddSeconds(1),
            new CommandExecutionLeaseRequest("npc-lifecycle-first", TimeSpan.FromMinutes(1))));
        Assert.AreEqual(CommandReceiptDisposition.Acquired, firstClaim.Disposition);
        var firstPlan = new CommandCommitPlanBuilder().Build(
            firstRequest,
            firstPayload.Fingerprint,
            firstClaim,
            firstDecision,
            engine.Descriptor,
            EvaluationTime.AddSeconds(2));
        var firstResult = await committer.CommitAsync(firstPlan);
        Assert.AreEqual(CommandCommitDisposition.Committed, firstResult.Disposition);

        var secondRequest = BuildRequest(CommandId.New(), CorrelationId.New(), npcId, birth);
        var secondDecision = engine.Evaluate(secondRequest);
        Assert.AreEqual(
            CoreOutcomeStatus.Succeeded,
            secondDecision.Status,
            "Both callers deliberately evaluated against the same stale absence before persistence arbitrates the race.");
        var secondPayload = codec.Serialize(secondRequest.Intent);
        var secondClaim = await receipts.TryAcquireAsync(new CommandReceiptAcquireRequest(
            CommandExecutionIdentityFactory.Create(secondRequest, secondPayload),
            secondPayload,
            secondRequest.Context.CorrelationId,
            EvaluationTime.AddSeconds(3),
            new CommandExecutionLeaseRequest("npc-lifecycle-second", TimeSpan.FromMinutes(1))));
        Assert.AreEqual(CommandReceiptDisposition.Acquired, secondClaim.Disposition);
        var secondPlan = new CommandCommitPlanBuilder().Build(
            secondRequest,
            secondPayload.Fingerprint,
            secondClaim,
            secondDecision,
            engine.Descriptor,
            EvaluationTime.AddSeconds(4));

        var secondResult = await committer.CommitAsync(secondPlan);

        Assert.AreEqual(CommandCommitDisposition.ConcurrencyConflict, secondResult.Disposition);
        Assert.AreEqual("npcs.lifecycle.already_exists", secondResult.Reason?.Value);
        Assert.AreEqual(1, await ScalarIntAsync("SELECT count(*) FROM nexis_v2.npc_lifecycle_state;"));
        Assert.AreEqual(1, await ScalarIntAsync("SELECT count(*) FROM nexis_v2.authoritative_events;"));
        Assert.AreEqual(1, await ScalarIntAsync("SELECT count(*) FROM nexis_v2.outbox;"));
    }

    private static CoreEvaluationRequest BuildRequest(
        CommandId commandId,
        CorrelationId correlationId,
        NpcId npcId,
        DateTimeOffset birth) =>
        new(
            CoreContractVersion.V1,
            new CoreEvaluationContext(
                commandId,
                correlationId,
                TrustedActorContext.CreateSystem(new SystemActorKey("nexis.scheduler")),
                EvaluationTime,
                new RuleVersion("npc-lifecycle-rules-v1"),
                new ContentVersion("npc-lifecycle-content-v1"),
                new FixedRandomFactory()),
            new EstablishNpcLifecycleIntent(npcId, birth),
            Array.Empty<IAuthoritativeSnapshot>());

    private static async Task<int> ScalarIntAsync(string sql)
    {
        await using var connection = await DataSource.OpenConnectionAsync();
        await using var command = new NpgsqlCommand(sql, connection);
        return Convert.ToInt32(await command.ExecuteScalarAsync());
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
