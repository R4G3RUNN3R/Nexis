using Microsoft.VisualStudio.TestTools.UnitTesting;
using Nexis.Audit.Contracts;
using Nexis.Core.Contracts;
using Nexis.Execution;
using Nexis.Execution.Contracts;
using Nexis.Identity.Contracts;
using Nexis.Kernel.Commands;
using Nexis.Kernel.Events;
using Nexis.Kernel.Randomness;
using Nexis.Operations.Contracts;
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
    public async Task DiscardingPayloadIntegrityClaimStillAppendsOneDurableSignal()
    {
        var repository = new PostgresCommandReceiptRepository(DataSource);
        var request = CreatePlayerRequest(CommandId.New(), CorrelationId.New());
        var originalPayload = Payload("integrity-original");
        var collidingPayload = Payload("integrity-collision");

        await repository.TryAcquireAsync(new CommandReceiptAcquireRequest(
            CommandExecutionIdentityFactory.Create(request, originalPayload),
            originalPayload,
            request.Context.CorrelationId,
            Utc(10, 0),
            Lease("worker-original")));

        _ = await repository.TryAcquireAsync(new CommandReceiptAcquireRequest(
            CommandExecutionIdentityFactory.Create(request, collidingPayload),
            collidingPayload,
            CorrelationId.New(),
            Utc(10, 1),
            Lease("worker-collision")));

        var signal = await ReadSingleIntegritySignalAsync(request.Context.CommandId);
        Assert.AreEqual((int)OperationalSeverity.Critical, signal.Severity);
        Assert.AreEqual("integrity.payload_fingerprint_mismatch", signal.Reason);
        Assert.AreEqual(request.Context.CorrelationId.Value, signal.OriginalCorrelationId);
        Assert.AreEqual(64, signal.ActorDiscriminator.Length);
        var safeValues = string.Join('|', signal.Component, signal.Reason, signal.ActorDiscriminator);
        Assert.IsFalse(safeValues.Contains("integrity-collision", StringComparison.Ordinal));
        Assert.IsFalse(safeValues.Contains("credential-sentinel", StringComparison.Ordinal));
        Assert.AreEqual(1, await CountDurableIntegritySignalsAsync(request.Context.CommandId));
    }

    [TestMethod]
    public async Task ActorMismatchEmitsOneCriticalSignalWithBothCorrelations()
    {
        var commandId = CommandId.New();
        var originalCorrelationId = CorrelationId.New();
        var collidingCorrelationId = CorrelationId.New();
        var original = CreatePlayerRequest(commandId, originalCorrelationId);
        var colliding = CreatePlayerRequest(commandId, collidingCorrelationId);
        var payload = Payload("actor-mismatch");
        var repository = new PostgresCommandReceiptRepository(DataSource);

        await AcquireAsync(repository, original, payload);
        var result = await repository.TryAcquireAsync(new CommandReceiptAcquireRequest(
            CommandExecutionIdentityFactory.Create(colliding, payload),
            payload,
            collidingCorrelationId,
            Utc(10, 1),
            Lease("worker-collision")));

        var signal = await ReadSingleIntegritySignalAsync(commandId);
        Assert.AreEqual(CommandReceiptDisposition.IntegrityViolation, result.Disposition);
        Assert.AreEqual((int)OperationalSeverity.Critical, signal.Severity);
        Assert.AreEqual("postgres.command-receipts", signal.Component);
        Assert.AreEqual("integrity.actor_mismatch", signal.Reason);
        Assert.AreEqual(collidingCorrelationId.Value, signal.CorrelationId);
        Assert.AreEqual(originalCorrelationId.Value, signal.OriginalCorrelationId);
        Assert.AreEqual(64, signal.ActorDiscriminator.Length);
    }

    [TestMethod]
    public async Task IntentContractMismatchEmitsItsOwnDurableReasonClass()
    {
        var commandId = CommandId.New();
        var originalCorrelationId = CorrelationId.New();
        var collidingCorrelationId = CorrelationId.New();
        var actor = TrustedActorContext.CreatePlayer(AccountId.New(), CharacterId.New(), 1);
        var original = CreateRequest(commandId, originalCorrelationId, actor);
        var colliding = CreateRequest(commandId, collidingCorrelationId, actor, new AlternateIntent());
        var payload = Payload("intent-mismatch");
        var repository = new PostgresCommandReceiptRepository(DataSource);

        await AcquireAsync(repository, original, payload);
        var result = await repository.TryAcquireAsync(new CommandReceiptAcquireRequest(
            CommandExecutionIdentityFactory.Create(colliding, payload),
            payload,
            collidingCorrelationId,
            Utc(10, 1),
            Lease("worker-collision")));

        var signal = await ReadSingleIntegritySignalAsync(commandId);
        Assert.AreEqual(CommandReceiptDisposition.IntegrityViolation, result.Disposition);
        Assert.AreEqual("integrity.intent_contract_mismatch", signal.Reason);
        Assert.AreEqual(collidingCorrelationId.Value, signal.CorrelationId);
        Assert.AreEqual(originalCorrelationId.Value, signal.OriginalCorrelationId);
    }

    [TestMethod]
    public async Task FailingOperationalObserverCannotConvertIntegrityViolationIntoAcquisition()
    {
        var request = CreatePlayerRequest(CommandId.New(), CorrelationId.New());
        var originalPayload = Payload("observer-original");
        var collidingPayload = Payload("observer-collision");
        var repository = new PostgresCommandReceiptRepository(DataSource, new ThrowingOperationalSignalSink());

        await AcquireAsync(repository, request, originalPayload);
        var result = await repository.TryAcquireAsync(new CommandReceiptAcquireRequest(
            CommandExecutionIdentityFactory.Create(request, collidingPayload),
            collidingPayload,
            CorrelationId.New(),
            Utc(10, 1),
            Lease("worker-collision")));

        Assert.AreEqual(CommandReceiptDisposition.IntegrityViolation, result.Disposition);
        Assert.AreEqual(1, await CountDurableIntegritySignalsAsync(request.Context.CommandId));
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
    public async Task OppositeEmissionDirections_ApplyTransitionsInOneCanonicalResourceOrder()
    {
        var forwardOrder = new List<string>();
        var reverseOrder = new List<string>();

        await CommitRecordedTransitionsAsync(
            new[]
            {
                new SyntheticTransition(OwnerA, "resource", 1, 1),
                new SyntheticTransition(OwnerB, "resource", 1, 1)
            },
            forwardOrder);
        await ResetSyntheticOwnersAsync();
        await CommitRecordedTransitionsAsync(
            new[]
            {
                new SyntheticTransition(OwnerB, "resource", 1, 1),
                new SyntheticTransition(OwnerA, "resource", 1, 1)
            },
            reverseOrder);

        CollectionAssert.AreEqual(forwardOrder, reverseOrder);
        CollectionAssert.AreEqual(
            new[] { "SyntheticOwnerA/resource", "SyntheticOwnerB/resource" },
            forwardOrder);
    }

    [TestMethod]
    public async Task OwnerApplierWithoutResolvableLockKeys_IsRejectedNotSilentlyUnordered()
    {
        var request = CreatePlayerRequest(CommandId.New(), CorrelationId.New());
        var payload = Payload("missing-lock-keys");
        var claim = await AcquireAsync(new PostgresCommandReceiptRepository(DataSource), request, payload);
        var plan = new CommandCommitPlanBuilder().Build(
            request,
            payload.Fingerprint,
            claim,
            CoreDecision.Succeeded(transitions: new[]
            {
                new SyntheticTransition(OwnerA, "resource", 1, 1)
            }),
            CoreDescriptor(),
            Utc(10, 5));
        var committer = new PostgresAtomicCommandCommitter(
            DataSource,
            new[] { new SyntheticOwnerApplier(OwnerA, "nexis_v2_test.owner_a", resolvedKeys: Array.Empty<AuthoritativeResourceKey>()) });

        var result = await committer.CommitAsync(plan);

        Assert.AreEqual(CommandCommitDisposition.TechnicalFailure, result.Disposition);
        Assert.AreEqual("execution.owner.lock_keys_unresolved", result.Reason?.Value);
        Assert.AreEqual(0, await ReadOwnerValueAsync("owner_a"));
        Assert.IsNull(await ReadTerminalStatusAsync(request.Context.CommandId));
    }

    [TestMethod]
    public async Task SingleOwnerMultiResourceTransition_AppliesResourcesInCanonicalOrder()
    {
        await using (var connection = await DataSource.OpenConnectionAsync())
        await using (var command = new NpgsqlCommand(
            "INSERT INTO nexis_v2_test.owner_a(resource_id, value, revision) VALUES ('alpha', 0, 1), ('omega', 0, 1);",
            connection))
        {
            await command.ExecuteNonQueryAsync();
        }

        var appliedOrder = new List<string>();
        await CommitRecordedTransitionsAsync(
            new[]
            {
                new SyntheticTransition(OwnerA, "omega", 1, 1),
                new SyntheticTransition(OwnerA, "alpha", 1, 1)
            },
            appliedOrder);

        CollectionAssert.AreEqual(
            new[] { "SyntheticOwnerA/alpha", "SyntheticOwnerA/omega" },
            appliedOrder);
    }

    [TestMethod]
    public async Task RetryingWholeAttemptAfterTransientFailure_MustStillBeAbleToCommit()
    {
        await TransientFailureInsideCommit_ReachesCommittedTerminalOutcomeExactlyOnce();
    }

    [TestMethod]
    public async Task TransientFailureInsideCommit_ReachesCommittedTerminalOutcomeExactlyOnce()
    {
        var request = CreatePlayerRequest(CommandId.New(), CorrelationId.New());
        var payload = Payload("retry-once");
        var receipts = new CountingReceiptRepository(new PostgresCommandReceiptRepository(DataSource));
        var recovery = new CountingRecoveryRepository(new PostgresCommandRecoveryRepository(DataSource));
        var attempts = 0;
        var committer = new PostgresAtomicCommandCommitter(
            DataSource,
            new[] { new SyntheticOwnerApplier(OwnerA, "nexis_v2_test.owner_a") },
            resourceLockAcquirer: new RaisingResourceLockAcquirer(failures: 1));
        var coordinator = new RetryingCommandExecutionCoordinator(
            new CommandReceiptCoordinator(receipts),
            new BoundedCommandRetryExecutor(new PostgresTransientCommandFailureClassifier(), maximumAttempts: 3),
            recovery,
            new CommandCommitCoordinator(committer));

        var result = await coordinator.ExecuteAsync(
            request,
            payload,
            Lease("integration-worker"),
            Utc(10, 0),
            (claim, _, _) =>
            {
                attempts++;
                return ValueTask.FromResult(new CommandCommitPlanBuilder().Build(
                    request,
                    payload.Fingerprint,
                    claim,
                    CoreDecision.Succeeded(
                        transitions: new[] { new SyntheticTransition(OwnerA, "resource", 10, 1) },
                        events: new[] { new SyntheticEvent() }),
                    CoreDescriptor(),
                    Utc(10, 5)));
            },
            (claim, _, _) => ValueTask.FromResult(new CommandCommitPlanBuilder().Build(
                request,
                payload.Fingerprint,
                claim,
                CoreDecision.TechnicalFailure(new CoreReasonCode("execution.retry.exhausted")),
                CoreDescriptor(),
                Utc(10, 6))));

        Assert.AreEqual(CommandReceiptDisposition.Acquired, result.ReceiptClaim.Disposition);
        Assert.AreEqual(CommandCommitDisposition.Committed, result.CommitResult?.Disposition);
        Assert.AreEqual(2, attempts);
        Assert.AreEqual(1, receipts.AcquireCount);
        Assert.AreEqual(1, recovery.RenewCount);
        Assert.AreEqual(10, await ReadOwnerValueAsync("owner_a"));
        Assert.AreEqual((int)CommandTerminalStatus.Succeeded, await ReadTerminalStatusAsync(request.Context.CommandId));
        Assert.AreEqual(1, await ScalarIntForCommandAsync("nexis_v2.authoritative_events", request.Context.CommandId));
        Assert.AreEqual(1, await ScalarIntForCommandAsync("nexis_v2.outbox", request.Context.CommandId));
    }

    [TestMethod]
    public async Task RetryExhaustion_RecordsATerminalTechnicalFailureAndConsumesNoResources()
    {
        var request = CreatePlayerRequest(CommandId.New(), CorrelationId.New());
        var payload = Payload("retry-exhausted");
        var receipts = new CountingReceiptRepository(new PostgresCommandReceiptRepository(DataSource));
        var recovery = new CountingRecoveryRepository(new PostgresCommandRecoveryRepository(DataSource));
        var committer = new PostgresAtomicCommandCommitter(
            DataSource,
            new[] { new SyntheticOwnerApplier(OwnerA, "nexis_v2_test.owner_a") },
            resourceLockAcquirer: new RaisingResourceLockAcquirer(failures: int.MaxValue));
        var coordinator = new RetryingCommandExecutionCoordinator(
            new CommandReceiptCoordinator(receipts),
            new BoundedCommandRetryExecutor(new PostgresTransientCommandFailureClassifier(), maximumAttempts: 2),
            recovery,
            new CommandCommitCoordinator(committer));

        var result = await coordinator.ExecuteAsync(
            request,
            payload,
            Lease("integration-worker"),
            Utc(10, 0),
            (claim, _, _) => ValueTask.FromResult(new CommandCommitPlanBuilder().Build(
                request,
                payload.Fingerprint,
                claim,
                CoreDecision.Succeeded(
                    transitions: new[] { new SyntheticTransition(OwnerA, "resource", 10, 1) },
                    events: new[] { new SyntheticEvent() }),
                CoreDescriptor(),
                Utc(10, 5))),
            (claim, _, _) => ValueTask.FromResult(new CommandCommitPlanBuilder().Build(
                request,
                payload.Fingerprint,
                claim,
                CoreDecision.TechnicalFailure(new CoreReasonCode("execution.retry.exhausted")),
                CoreDescriptor(),
                Utc(10, 6))));

        Assert.AreEqual(CommandCommitDisposition.Committed, result.CommitResult?.Disposition);
        Assert.AreEqual(1, receipts.AcquireCount);
        Assert.AreEqual(1, recovery.RenewCount);
        Assert.AreEqual(0, await ReadOwnerValueAsync("owner_a"));
        Assert.AreEqual((int)CommandTerminalStatus.TechnicalFailure, await ReadTerminalStatusAsync(request.Context.CommandId));
        Assert.AreEqual(0, await ScalarIntForCommandAsync("nexis_v2.authoritative_events", request.Context.CommandId));
        Assert.AreEqual(0, await ScalarIntForCommandAsync("nexis_v2.outbox", request.Context.CommandId));
    }

    [TestMethod]
    public async Task RetryWhoseFenceWasRotatedMidFlight_MustNotCommit()
    {
        var request = CreatePlayerRequest(CommandId.New(), CorrelationId.New());
        var payload = Payload("retry-fenced");
        var receipts = new CountingReceiptRepository(new PostgresCommandReceiptRepository(DataSource));
        var signals = new CollectingOperationalSignalSink();
        var postgresRecovery = new PostgresCommandRecoveryRepository(DataSource, signals);
        var recovery = new RotateFenceBeforeRenewalRepository(postgresRecovery);
        var committer = new PostgresAtomicCommandCommitter(
            DataSource,
            new[] { new SyntheticOwnerApplier(OwnerA, "nexis_v2_test.owner_a") },
            resourceLockAcquirer: new RaisingResourceLockAcquirer(failures: 1));
        var coordinator = new RetryingCommandExecutionCoordinator(
            new CommandReceiptCoordinator(receipts),
            new BoundedCommandRetryExecutor(new PostgresTransientCommandFailureClassifier(), maximumAttempts: 3),
            recovery,
            new CommandCommitCoordinator(committer));
        var attempts = 0;

        var result = await coordinator.ExecuteAsync(
            request,
            payload,
            Lease("integration-worker"),
            Utc(10, 0),
            (claim, _, _) =>
            {
                attempts++;
                return ValueTask.FromResult(new CommandCommitPlanBuilder().Build(
                    request,
                    payload.Fingerprint,
                    claim,
                    CoreDecision.Succeeded(
                        transitions: new[] { new SyntheticTransition(OwnerA, "resource", 10, 1) },
                        events: new[] { new SyntheticEvent() }),
                    CoreDescriptor(),
                    Utc(10, 5)));
            },
            (claim, _, _) => ValueTask.FromResult(new CommandCommitPlanBuilder().Build(
                request,
                payload.Fingerprint,
                claim,
                CoreDecision.TechnicalFailure(new CoreReasonCode("execution.retry.exhausted")),
                CoreDescriptor(),
                Utc(10, 6))));

        Assert.AreEqual(CommandCommitDisposition.TechnicalFailure, result.CommitResult?.Disposition);
        Assert.AreEqual("execution.receipt.ownership_lost", result.CommitResult?.Reason?.Value);
        Assert.AreEqual(1, attempts);
        Assert.AreEqual(1, receipts.AcquireCount);
        Assert.AreEqual(0, await ReadOwnerValueAsync("owner_a"));
        Assert.IsNull(await ReadTerminalStatusAsync(request.Context.CommandId));
        Assert.IsTrue(signals.Signals.Any(signal =>
            signal.Kind == OperationalConditionKind.LeaseFencingFailure &&
            signal.CommandId == request.Context.CommandId &&
            signal.CorrelationId == request.Context.CorrelationId));
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

    private static async Task CommitRecordedTransitionsAsync(
        IReadOnlyList<SyntheticTransition> transitions,
        List<string> appliedOrder)
    {
        var request = CreatePlayerRequest(CommandId.New(), CorrelationId.New());
        var payload = Payload(Guid.NewGuid().ToString("N"));
        var claim = await AcquireAsync(new PostgresCommandReceiptRepository(DataSource), request, payload);
        var plan = new CommandCommitPlanBuilder().Build(
            request,
            payload.Fingerprint,
            claim,
            CoreDecision.Succeeded(transitions: transitions),
            CoreDescriptor(),
            Utc(10, 5));
        var committer = new PostgresAtomicCommandCommitter(
            DataSource,
            new IPostgresOwnerTransitionApplier[]
            {
                new SyntheticOwnerApplier(OwnerA, "nexis_v2_test.owner_a", appliedOrder),
                new SyntheticOwnerApplier(OwnerB, "nexis_v2_test.owner_b", appliedOrder)
            });

        Assert.AreEqual(CommandCommitDisposition.Committed, (await committer.CommitAsync(plan)).Disposition);
    }

    private static async Task ResetSyntheticOwnersAsync()
    {
        await using var connection = await DataSource.OpenConnectionAsync();
        await using var command = new NpgsqlCommand(
            "UPDATE nexis_v2_test.owner_a SET value = 0, revision = 1; UPDATE nexis_v2_test.owner_b SET value = 0, revision = 1;",
            connection);
        await command.ExecuteNonQueryAsync();
    }

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
        TrustedActorContext actor,
        ICoreIntent? intent = null) =>
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
            intent ?? new SyntheticIntent(),
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

    private static async Task<int> ScalarIntForCommandAsync(string table, CommandId commandId)
    {
        await using var connection = await DataSource.OpenConnectionAsync();
        await using var command = new NpgsqlCommand(
            $"SELECT count(*) FROM {table} WHERE command_id = @command_id;",
            connection);
        command.Parameters.AddWithValue("command_id", NpgsqlDbType.Uuid, commandId.Value);
        return Convert.ToInt32(await command.ExecuteScalarAsync());
    }

    private static async Task<int> CountDurableIntegritySignalsAsync(CommandId commandId)
    {
        await using var connection = await DataSource.OpenConnectionAsync();
        await using (var exists = new NpgsqlCommand(
            "SELECT to_regclass('nexis_v2.operational_signals') IS NOT NULL;",
            connection))
        {
            if (!Convert.ToBoolean(await exists.ExecuteScalarAsync()))
            {
                return 0;
            }
        }

        await using var count = new NpgsqlCommand(
            """
            SELECT count(*)
            FROM nexis_v2.operational_signals
            WHERE command_id = @command_id
              AND condition_kind = @condition_kind;
            """,
            connection);
        count.Parameters.AddWithValue("command_id", NpgsqlDbType.Uuid, commandId.Value);
        count.Parameters.AddWithValue(
            "condition_kind",
            NpgsqlDbType.Integer,
            (int)OperationalConditionKind.CommandIdentityIntegrityViolation);
        return Convert.ToInt32(await count.ExecuteScalarAsync());
    }

    private static async Task<DurableIntegritySignalRow> ReadSingleIntegritySignalAsync(CommandId commandId)
    {
        await using var connection = await DataSource.OpenConnectionAsync();
        await using var command = new NpgsqlCommand(
            """
            SELECT severity, component, reason, correlation_id, original_correlation_id,
                   actor_discriminator
            FROM nexis_v2.operational_signals
            WHERE command_id = @command_id
              AND condition_kind = @condition_kind
            ORDER BY occurred_at_utc, signal_id;
            """,
            connection);
        command.Parameters.AddWithValue("command_id", NpgsqlDbType.Uuid, commandId.Value);
        command.Parameters.AddWithValue(
            "condition_kind",
            NpgsqlDbType.Integer,
            (int)OperationalConditionKind.CommandIdentityIntegrityViolation);

        await using var reader = await command.ExecuteReaderAsync();
        Assert.IsTrue(await reader.ReadAsync(), "The integrity attempt produced no durable operational signal.");
        var row = new DurableIntegritySignalRow(
            reader.GetInt32(0),
            reader.GetString(1),
            reader.GetString(2),
            reader.GetGuid(3),
            reader.GetGuid(4),
            reader.GetString(5).TrimEnd());
        Assert.IsFalse(await reader.ReadAsync(), "One integrity attempt produced more than one durable signal.");
        return row;
    }

    private sealed record DurableIntegritySignalRow(
        int Severity,
        string Component,
        string Reason,
        Guid CorrelationId,
        Guid OriginalCorrelationId,
        string ActorDiscriminator);

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

    private sealed record AlternateIntent : ICoreIntent
    {
        public ContractDescriptor Contract { get; } = new("tests.postgres.alternate-command", 1);
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
        private readonly List<string>? _appliedOrder;
        private readonly IReadOnlyList<AuthoritativeResourceKey>? _resolvedKeys;

        public SyntheticOwnerApplier(
            OwnerKey owner,
            string table,
            List<string>? appliedOrder = null,
            IReadOnlyList<AuthoritativeResourceKey>? resolvedKeys = null)
        {
            Owner = owner;
            _table = table;
            _appliedOrder = appliedOrder;
            _resolvedKeys = resolvedKeys;
        }

        public OwnerKey Owner { get; }

        public IReadOnlyList<AuthoritativeResourceKey> ResolveLockKeys(IOwnerTransition transition)
        {
            if (transition is not SyntheticTransition synthetic || synthetic.TargetOwner != Owner)
            {
                throw new InvalidOperationException("Synthetic PostgreSQL owner received an unsupported transition.");
            }

            return _resolvedKeys ?? new[]
            {
                new AuthoritativeResourceKey(Owner, "synthetic-state", synthetic.ResourceId)
            };
        }

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

            _appliedOrder?.Add($"{Owner.Value}/{synthetic.ResourceId}");

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

    private sealed class CountingReceiptRepository : ICommandReceiptRepository
    {
        private readonly ICommandReceiptRepository _inner;

        public CountingReceiptRepository(ICommandReceiptRepository inner) => _inner = inner;

        public int AcquireCount { get; private set; }

        public ValueTask<CommandReceiptClaim> TryAcquireAsync(
            CommandReceiptAcquireRequest request,
            CancellationToken cancellationToken = default)
        {
            AcquireCount++;
            return _inner.TryAcquireAsync(request, cancellationToken);
        }
    }

    private sealed class CountingRecoveryRepository : ICommandExecutionRecoveryRepository
    {
        private readonly ICommandExecutionRecoveryRepository _inner;

        public CountingRecoveryRepository(ICommandExecutionRecoveryRepository inner) => _inner = inner;

        public int RenewCount { get; private set; }

        public ValueTask<CommandRecoveryResult> ReconcileAsync(
            CommandId commandId,
            CommandExecutionToken observedExecutionToken,
            CommandExecutionLeaseRequest replacementLease,
            DateTimeOffset nowUtc,
            CancellationToken cancellationToken = default) =>
            _inner.ReconcileAsync(commandId, observedExecutionToken, replacementLease, nowUtc, cancellationToken);

        public ValueTask<IReadOnlyList<RecoveredCommandExecution>> ClaimExpiredBatchAsync(
            CommandExecutionLeaseRequest replacementLease,
            DateTimeOffset nowUtc,
            int maximumItems,
            CancellationToken cancellationToken = default) =>
            _inner.ClaimExpiredBatchAsync(replacementLease, nowUtc, maximumItems, cancellationToken);

        public ValueTask<bool> RenewLeaseAsync(
            CommandId commandId,
            CommandExecutionToken executionToken,
            CommandExecutionLeaseRequest currentLease,
            DateTimeOffset nowUtc,
            CancellationToken cancellationToken = default)
        {
            RenewCount++;
            return _inner.RenewLeaseAsync(commandId, executionToken, currentLease, nowUtc, cancellationToken);
        }
    }

    private sealed class RotateFenceBeforeRenewalRepository : ICommandExecutionRecoveryRepository
    {
        private readonly ICommandExecutionRecoveryRepository _inner;
        private bool _rotated;

        public RotateFenceBeforeRenewalRepository(ICommandExecutionRecoveryRepository inner) => _inner = inner;

        public ValueTask<CommandRecoveryResult> ReconcileAsync(
            CommandId commandId,
            CommandExecutionToken observedExecutionToken,
            CommandExecutionLeaseRequest replacementLease,
            DateTimeOffset nowUtc,
            CancellationToken cancellationToken = default) =>
            _inner.ReconcileAsync(commandId, observedExecutionToken, replacementLease, nowUtc, cancellationToken);

        public ValueTask<IReadOnlyList<RecoveredCommandExecution>> ClaimExpiredBatchAsync(
            CommandExecutionLeaseRequest replacementLease,
            DateTimeOffset nowUtc,
            int maximumItems,
            CancellationToken cancellationToken = default) =>
            _inner.ClaimExpiredBatchAsync(replacementLease, nowUtc, maximumItems, cancellationToken);

        public async ValueTask<bool> RenewLeaseAsync(
            CommandId commandId,
            CommandExecutionToken executionToken,
            CommandExecutionLeaseRequest currentLease,
            DateTimeOffset nowUtc,
            CancellationToken cancellationToken = default)
        {
            if (!_rotated)
            {
                _rotated = true;
                var rotated = await _inner.ReconcileAsync(
                    commandId,
                    executionToken,
                    new CommandExecutionLeaseRequest("recovery-worker", TimeSpan.FromMinutes(1)),
                    nowUtc,
                    cancellationToken);
                Assert.AreEqual(CommandRecoveryDisposition.Recovered, rotated.Disposition);
            }

            return await _inner.RenewLeaseAsync(
                commandId,
                executionToken,
                currentLease,
                nowUtc,
                cancellationToken);
        }
    }

    private sealed class RaisingResourceLockAcquirer : IPostgresResourceLockAcquirer
    {
        private readonly int _failures;
        private readonly PostgresAdvisoryResourceLockAcquirer _inner = new();
        private int _attempts;

        public RaisingResourceLockAcquirer(int failures) => _failures = failures;

        public async ValueTask AcquireAsync(
            NpgsqlConnection connection,
            NpgsqlTransaction transaction,
            AuthoritativeResourceKey resource,
            CancellationToken cancellationToken = default)
        {
            if (Interlocked.Increment(ref _attempts) <= _failures)
            {
                await using var command = new NpgsqlCommand(
                    "DO $nexis$ BEGIN RAISE EXCEPTION USING ERRCODE = '40001', MESSAGE = 'forced serialization failure'; END $nexis$;",
                    connection,
                    transaction);
                await command.ExecuteNonQueryAsync(cancellationToken);
                return;
            }

            await _inner.AcquireAsync(connection, transaction, resource, cancellationToken);
        }
    }

    private sealed class CollectingOperationalSignalSink : IOperationalSignalSink
    {
        public List<OperationalSignal> Signals { get; } = new();

        public ValueTask ReportAsync(
            OperationalSignal signal,
            CancellationToken cancellationToken = default)
        {
            Signals.Add(signal);
            return ValueTask.CompletedTask;
        }
    }

    private sealed class ThrowingOperationalSignalSink : IOperationalSignalSink
    {
        public ValueTask ReportAsync(
            OperationalSignal signal,
            CancellationToken cancellationToken = default) =>
            ValueTask.FromException(new InvalidOperationException("observer unavailable"));
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
