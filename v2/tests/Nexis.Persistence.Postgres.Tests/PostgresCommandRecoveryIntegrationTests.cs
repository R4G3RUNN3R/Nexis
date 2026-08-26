using Microsoft.VisualStudio.TestTools.UnitTesting;
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
public sealed class PostgresCommandRecoveryIntegrationTests
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
    public async Task ActiveLease_IsNotClaimedBeforeExpiry()
    {
        var request = CreateRequest();
        var payload = Payload("{\"kind\":\"active\"}");
        await AcquireAsync(request, payload, "worker-a", TimeSpan.FromMinutes(1));
        var recovery = new PostgresCommandRecoveryRepository(DataSource);

        var claimed = await recovery.ClaimExpiredBatchAsync(
            Lease("worker-b", TimeSpan.FromMinutes(1)),
            Utc(10, 0, 30),
            maximumItems: 10);

        Assert.AreEqual(0, claimed.Count);
    }

    [TestMethod]
    public async Task ExpiredLease_IsRecoveredWithExactPayloadAndNewFenceToken()
    {
        var request = CreateRequest();
        const string exactJson = "{\"z\":1,\"a\":[2,3]}";
        var payload = Payload(exactJson);
        var original = await AcquireAsync(request, payload, "worker-a", TimeSpan.FromSeconds(30));
        var recovery = new PostgresCommandRecoveryRepository(DataSource);

        var claimed = await recovery.ClaimExpiredBatchAsync(
            Lease("worker-b", TimeSpan.FromMinutes(1)),
            Utc(10, 0, 31),
            maximumItems: 10);

        Assert.AreEqual(1, claimed.Count);
        var recovered = claimed[0];
        Assert.AreEqual(request.Context.CommandId, recovered.CommandId);
        Assert.AreEqual(request.Context.CorrelationId, recovered.OriginalCorrelationId);
        Assert.AreEqual(exactJson, recovered.Payload.Json);
        Assert.AreEqual(payload.Fingerprint, recovered.Payload.Fingerprint);
        Assert.AreNotEqual(original.ExecutionToken, recovered.ExecutionToken);
        Assert.AreEqual("worker-b", recovered.WorkerId);
        Assert.AreEqual(request.Context.Actor.AccountId, recovered.AccountId);
        Assert.AreEqual(request.Context.Actor.CharacterId, recovered.CharacterId);
    }

    [TestMethod]
    public async Task ConcurrentRecoveryWorkers_DoNotClaimSameExpiredCommands()
    {
        for (var index = 0; index < 4; index++)
        {
            var request = CreateRequest();
            await AcquireAsync(
                request,
                Payload($"{{\"index\":{index}}}"),
                "seed-worker",
                TimeSpan.FromSeconds(1));
        }

        var recovery = new PostgresCommandRecoveryRepository(DataSource);
        var now = Utc(10, 0, 2);
        var firstTask = recovery.ClaimExpiredBatchAsync(
            Lease("recovery-a", TimeSpan.FromMinutes(1)),
            now,
            maximumItems: 2).AsTask();
        var secondTask = recovery.ClaimExpiredBatchAsync(
            Lease("recovery-b", TimeSpan.FromMinutes(1)),
            now,
            maximumItems: 2).AsTask();

        await Task.WhenAll(firstTask, secondTask);
        var firstIds = firstTask.Result.Select(item => item.CommandId).ToHashSet();
        var secondIds = secondTask.Result.Select(item => item.CommandId).ToHashSet();

        Assert.AreEqual(2, firstIds.Count);
        Assert.AreEqual(2, secondIds.Count);
        Assert.AreEqual(0, firstIds.Intersect(secondIds).Count());
        Assert.AreEqual(4, firstIds.Concat(secondIds).Distinct().Count());
    }

    [TestMethod]
    public async Task AmbiguousReconcile_AfterCommittedCommandReturnsStoredOutcomeWithoutTakeover()
    {
        var request = CreateRequest();
        var payload = Payload("{\"kind\":\"committed\"}");
        var claim = await AcquireAsync(request, payload, "worker-a", TimeSpan.FromMinutes(1));
        var plan = BuildSuccessPlan(request, payload, claim);
        var committed = await new PostgresAtomicCommandCommitter(DataSource).CommitAsync(plan);
        Assert.AreEqual(CommandCommitDisposition.Committed, committed.Disposition);

        var result = await new PostgresCommandRecoveryRepository(DataSource).ReconcileAsync(
            request.Context.CommandId,
            claim.ExecutionToken!.Value,
            Lease("worker-reconcile", TimeSpan.FromMinutes(1)),
            Utc(10, 0, 10));

        Assert.AreEqual(CommandRecoveryDisposition.Completed, result.Disposition);
        Assert.AreEqual(CommandTerminalStatus.Succeeded, result.TerminalOutcome?.Status);
        Assert.IsNull(result.Execution);
    }

    [TestMethod]
    public async Task AmbiguousReconcile_IncompleteCurrentFenceRotatesTokenAndFencesOldWorker()
    {
        var request = CreateRequest();
        var payload = Payload("{\"kind\":\"ambiguous\"}");
        var originalClaim = await AcquireAsync(request, payload, "worker-a", TimeSpan.FromMinutes(1));
        var stalePlan = BuildSuccessPlan(request, payload, originalClaim);
        var recovery = new PostgresCommandRecoveryRepository(DataSource);

        var result = await recovery.ReconcileAsync(
            request.Context.CommandId,
            originalClaim.ExecutionToken!.Value,
            Lease("worker-recovered", TimeSpan.FromMinutes(1)),
            Utc(10, 0, 10));

        Assert.AreEqual(CommandRecoveryDisposition.Recovered, result.Disposition);
        var recovered = result.Execution!;
        Assert.AreNotEqual(originalClaim.ExecutionToken, recovered.ExecutionToken);

        var staleCommit = await new PostgresAtomicCommandCommitter(DataSource).CommitAsync(stalePlan);
        Assert.AreEqual(CommandCommitDisposition.TechnicalFailure, staleCommit.Disposition);
        Assert.AreEqual("execution.receipt.ownership_lost", staleCommit.Reason?.Value);

        var recoveredClaim = CommandReceiptClaim.Acquired(
            recovered.OriginalCorrelationId,
            recovered.ExecutionToken);
        var recoveredPlan = BuildSuccessPlan(request, payload, recoveredClaim);
        var recoveredCommit = await new PostgresAtomicCommandCommitter(DataSource).CommitAsync(recoveredPlan);

        Assert.AreEqual(CommandCommitDisposition.Committed, recoveredCommit.Disposition);
    }

    [TestMethod]
    public async Task ReconcileWithWrongFence_CannotStealIncompleteCommand()
    {
        var request = CreateRequest();
        var payload = Payload("{\"kind\":\"owned\"}");
        await AcquireAsync(request, payload, "worker-a", TimeSpan.FromMinutes(1));
        var recovery = new PostgresCommandRecoveryRepository(DataSource);

        var result = await recovery.ReconcileAsync(
            request.Context.CommandId,
            CommandExecutionToken.New(),
            Lease("attacker-worker", TimeSpan.FromMinutes(1)),
            Utc(10, 0, 10));

        Assert.AreEqual(CommandRecoveryDisposition.OwnershipLost, result.Disposition);
        Assert.IsNull(result.Execution);
    }

    [TestMethod]
    public async Task RenewedLease_PreventsExpiredBatchTakeover()
    {
        var request = CreateRequest();
        var payload = Payload("{\"kind\":\"heartbeat\"}");
        var claim = await AcquireAsync(request, payload, "worker-a", TimeSpan.FromMinutes(1));
        var recovery = new PostgresCommandRecoveryRepository(DataSource);

        var renewed = await recovery.RenewLeaseAsync(
            request.Context.CommandId,
            claim.ExecutionToken!.Value,
            Lease("worker-a", TimeSpan.FromMinutes(1)),
            Utc(10, 0, 30));
        var claimed = await recovery.ClaimExpiredBatchAsync(
            Lease("worker-b", TimeSpan.FromMinutes(1)),
            Utc(10, 1, 1),
            maximumItems: 10);

        Assert.IsTrue(renewed);
        Assert.AreEqual(0, claimed.Count);
    }

    [TestMethod]
    public async Task StaleWorkerCannotRenewAfterRecoveryRotatesFence()
    {
        var request = CreateRequest();
        var payload = Payload("{\"kind\":\"fenced\"}");
        var claim = await AcquireAsync(request, payload, "worker-a", TimeSpan.FromSeconds(1));
        var recovery = new PostgresCommandRecoveryRepository(DataSource);
        var recovered = await recovery.ClaimExpiredBatchAsync(
            Lease("worker-b", TimeSpan.FromMinutes(1)),
            Utc(10, 0, 2),
            maximumItems: 1);
        Assert.AreEqual(1, recovered.Count);

        var staleRenew = await recovery.RenewLeaseAsync(
            request.Context.CommandId,
            claim.ExecutionToken!.Value,
            Lease("worker-a", TimeSpan.FromMinutes(1)),
            Utc(10, 0, 3));

        Assert.IsFalse(staleRenew);
    }

    [TestMethod]
    public async Task CorruptedStoredPayload_IsRejectedBeforeRecoveredExecutionCanRun()
    {
        var request = CreateRequest();
        var payload = Payload("{\"kind\":\"original\"}");
        await AcquireAsync(request, payload, "worker-a", TimeSpan.FromSeconds(1));

        await using (var connection = await DataSource.OpenConnectionAsync())
        await using (var command = new NpgsqlCommand(
            "UPDATE nexis_v2.command_receipts SET canonical_payload = '{\"kind\":\"tampered\"}' WHERE command_id = @command_id;",
            connection))
        {
            command.Parameters.AddWithValue("command_id", NpgsqlDbType.Uuid, request.Context.CommandId.Value);
            await command.ExecuteNonQueryAsync();
        }

        await Assert.ThrowsExactlyAsync<InvalidOperationException>(async () =>
        {
            await new PostgresCommandRecoveryRepository(DataSource).ClaimExpiredBatchAsync(
                Lease("worker-b", TimeSpan.FromMinutes(1)),
                Utc(10, 0, 2),
                maximumItems: 1);
        });
    }

    private static async ValueTask<CommandReceiptClaim> AcquireAsync(
        CoreEvaluationRequest request,
        CanonicalCommandPayload payload,
        string workerId,
        TimeSpan leaseDuration)
    {
        var repository = new PostgresCommandReceiptRepository(DataSource);
        var claim = await repository.TryAcquireAsync(new CommandReceiptAcquireRequest(
            CommandExecutionIdentityFactory.Create(request, payload),
            payload,
            request.Context.CorrelationId,
            Utc(10, 0),
            Lease(workerId, leaseDuration)));
        Assert.AreEqual(CommandReceiptDisposition.Acquired, claim.Disposition);
        return claim;
    }

    private static CommandCommitPlan BuildSuccessPlan(
        CoreEvaluationRequest request,
        CanonicalCommandPayload payload,
        CommandReceiptClaim claim) =>
        new CommandCommitPlanBuilder().Build(
            request,
            payload.Fingerprint,
            claim,
            CoreDecision.Succeeded(),
            new CoreImplementationDescriptor("Test.Core", "recovery", CoreContractVersion.V1),
            Utc(10, 0, 20));

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

    private static CanonicalCommandPayload Payload(string json) =>
        CanonicalCommandPayload.FromTrustedJson(json);

    private static CommandExecutionLeaseRequest Lease(string workerId, TimeSpan duration) =>
        new(workerId, duration);

    private static DateTimeOffset Utc(int hour, int minute, int second = 0) =>
        new(2026, 8, 26, hour, minute, second, TimeSpan.Zero);

    private static NpgsqlDataSource DataSource =>
        s_dataSource ?? throw new InvalidOperationException("PostgreSQL test data source was not initialized.");

    private sealed record SyntheticIntent : ICoreIntent
    {
        public ContractDescriptor Contract { get; } = new("tests.recovery.command", 1);
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
