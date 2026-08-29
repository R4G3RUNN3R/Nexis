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
public sealed class PostgresOperationalQuarantineIntegrationTests
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
    public async Task DeadLetteredEvent_IsEnumerableThroughTheQuarantineListing()
    {
        var eventId = await SeedDeadLetteredEventAsync();
        var service = new PostgresOperationalQuarantineService(DataSource);

        var listed = await service.ListDeadLetteredEventsAsync(OperatorContext(), maximumItems: 20);
        var ordinaryClaim = await new PostgresOutboxStore(DataSource).ClaimBatchAsync(
            "ordinary-dispatcher",
            maximumItems: 20,
            Utc(12, 0),
            TimeSpan.FromMinutes(1));

        Assert.AreEqual(1, listed.Count);
        Assert.AreEqual(eventId, listed[0].EventId);
        Assert.AreEqual(1, listed[0].PoisonAttemptCount);
        Assert.AreEqual("event_specific_retry_exhausted", listed[0].DeadLetterReason);
        Assert.AreEqual(0, ordinaryClaim.Items.Count);
    }

    [TestMethod]
    public async Task ExplicitOperatorRequeue_RestoresClaimabilityAndIsRecorded()
    {
        var eventId = await SeedDeadLetteredEventAsync();
        var operatorId = AccountId.New();
        var context = OperatorContext(operatorId, "OPS-REQUEUE-1");
        var service = new PostgresOperationalQuarantineService(DataSource);
        var listed = await service.ListDeadLetteredEventsAsync(context, maximumItems: 20);

        var applied = await service.RequeueDeadLetteredEventAsync(
            context,
            eventId,
            listed.Single().DeadLetteredAtUtc,
            listed.Single().PoisonAttemptCount);
        var staleRepeat = await service.RequeueDeadLetteredEventAsync(
            context,
            eventId,
            listed.Single().DeadLetteredAtUtc,
            listed.Single().PoisonAttemptCount);
        var claimed = await new PostgresOutboxStore(DataSource).ClaimBatchAsync(
            "requeue-verifier",
            maximumItems: 1,
            Utc(12, 0),
            TimeSpan.FromMinutes(1));

        Assert.IsTrue(applied);
        Assert.IsFalse(staleRepeat);
        Assert.AreEqual(eventId, claimed.Items.Single().Message.EventId);
        Assert.AreEqual(2, await CountAuditAsync(
            "operations.outbox.dead-letter.requeue",
            operatorId,
            "OPS-REQUEUE-1"));
        Assert.AreEqual(1, await CountAuditAsync(
            "operations.outbox.dead-letter.requeue",
            operatorId,
            "OPS-REQUEUE-1",
            "requeued"));
        Assert.AreEqual(1, await CountAuditAsync(
            "operations.outbox.dead-letter.requeue",
            operatorId,
            "OPS-REQUEUE-1",
            "fence_lost_or_not_found"));
    }

    [TestMethod]
    public async Task QuarantinedReceipt_CanReachTerminalTechnicalFailureWhileRetainingItsAbandonReason()
    {
        var seeded = await SeedRecoveryQuarantineAsync();
        var operatorId = AccountId.New();
        var context = OperatorContext(operatorId, "OPS-RECOVERY-1");
        var service = new PostgresOperationalQuarantineService(DataSource);
        var listed = await service.ListRecoveryQuarantinesAsync(context, maximumItems: 20);
        var entry = listed.Single(item => item.CommandId == seeded.Request.Context.CommandId);

        var applied = await service.ResolveRecoveryQuarantineAsTechnicalFailureAsync(
            context,
            entry.CommandId,
            entry.ExecutionToken,
            entry.RecoveryAbandonedAtUtc);

        const string sql = """
            SELECT terminal_status, terminal_reason,
                   recovery_abandoned_at_utc IS NOT NULL, recovery_abandon_reason
            FROM nexis_v2.command_receipts
            WHERE command_id = @command_id;
            """;
        await using var connection = await DataSource.OpenConnectionAsync();
        await using var command = new NpgsqlCommand(sql, connection);
        command.Parameters.AddWithValue("command_id", NpgsqlDbType.Uuid, entry.CommandId.Value);
        await using var reader = await command.ExecuteReaderAsync();
        Assert.IsTrue(await reader.ReadAsync());

        Assert.IsTrue(applied);
        Assert.AreEqual((int)CommandTerminalStatus.TechnicalFailure, reader.GetInt32(0));
        Assert.AreEqual("execution.recovery.quarantine_resolved", reader.GetString(1));
        Assert.IsTrue(reader.GetBoolean(2));
        Assert.AreEqual("stored_recovery_artifact_invalid", reader.GetString(3));
        Assert.AreEqual(1, await CountAuditAsync(
            "operations.command-recovery.quarantine.resolve",
            operatorId,
            "OPS-RECOVERY-1"));
    }

    [TestMethod]
    public async Task RepeatingACommandIdAfterQuarantineResolution_DoesNotHangOnDuplicateInProgress()
    {
        var seeded = await SeedRecoveryQuarantineAsync();
        var service = new PostgresOperationalQuarantineService(DataSource);
        var context = OperatorContext();
        var entry = (await service.ListRecoveryQuarantinesAsync(context, maximumItems: 20)).Single();
        Assert.IsTrue(await service.ResolveRecoveryQuarantineAsTechnicalFailureAsync(
            context,
            entry.CommandId,
            entry.ExecutionToken,
            entry.RecoveryAbandonedAtUtc));

        var repeated = await new PostgresCommandReceiptRepository(DataSource).TryAcquireAsync(
            AcquireRequest(seeded.Request, seeded.Payload, "repeat-worker", TimeSpan.FromMinutes(1)));

        Assert.AreEqual(CommandReceiptDisposition.DuplicateCompleted, repeated.Disposition);
        Assert.AreEqual(CommandTerminalStatus.TechnicalFailure, repeated.TerminalOutcome?.Status);
        Assert.AreEqual("execution.recovery.quarantine_resolved", repeated.TerminalOutcome?.Reason?.Value);
    }

    [TestMethod]
    public async Task ReceiptWithoutCanonicalPayload_IsEnumerableAndUsesTheSameFencedTerminalResolution()
    {
        var seeded = await SeedReceiptWithoutCanonicalPayloadAsync();
        var operatorId = AccountId.New();
        var context = OperatorContext(operatorId, "OPS-NO-PAYLOAD-1");
        var service = new PostgresOperationalQuarantineService(DataSource);

        var entry = (await service.ListRecoveryQuarantinesAsync(context, maximumItems: 20))
            .Single(item => item.CommandId == seeded.Request.Context.CommandId);

        Assert.IsNull(entry.RecoveryAbandonedAtUtc);
        Assert.AreEqual("canonical_payload_unavailable", entry.RecoveryAbandonReason);
        Assert.IsTrue(await service.ResolveRecoveryQuarantineAsTechnicalFailureAsync(
            context,
            entry.CommandId,
            entry.ExecutionToken,
            entry.RecoveryAbandonedAtUtc));

        var repeated = await new PostgresCommandReceiptRepository(DataSource).TryAcquireAsync(
            AcquireRequest(seeded.Request, seeded.Payload, "no-payload-repeat", TimeSpan.FromMinutes(1)));

        Assert.AreEqual(CommandReceiptDisposition.DuplicateCompleted, repeated.Disposition);
        Assert.AreEqual(CommandTerminalStatus.TechnicalFailure, repeated.TerminalOutcome?.Status);
        Assert.AreEqual(1, await CountAuditAsync(
            "operations.command-recovery.quarantine.resolve",
            operatorId,
            "OPS-NO-PAYLOAD-1",
            "technical_failure_recorded"));
    }

    [TestMethod]
    public async Task ReceiptWithoutCanonicalPayload_CannotBeResolvedThroughAStaleExecutionFence()
    {
        var seeded = await SeedReceiptWithoutCanonicalPayloadAsync();
        var operatorId = AccountId.New();
        var context = OperatorContext(operatorId, "OPS-NO-PAYLOAD-STALE");
        var service = new PostgresOperationalQuarantineService(DataSource);
        var entry = (await service.ListRecoveryQuarantinesAsync(context, maximumItems: 20))
            .Single(item => item.CommandId == seeded.Request.Context.CommandId);

        await using (var connection = await DataSource.OpenConnectionAsync())
        await using (var command = new NpgsqlCommand(
            "UPDATE nexis_v2.command_receipts SET execution_token = @replacement WHERE command_id = @command_id;",
            connection))
        {
            command.Parameters.AddWithValue("replacement", NpgsqlDbType.Uuid, Guid.NewGuid());
            command.Parameters.AddWithValue("command_id", NpgsqlDbType.Uuid, entry.CommandId.Value);
            Assert.AreEqual(1, await command.ExecuteNonQueryAsync());
        }

        Assert.IsFalse(await service.ResolveRecoveryQuarantineAsTechnicalFailureAsync(
            context,
            entry.CommandId,
            entry.ExecutionToken,
            entry.RecoveryAbandonedAtUtc));
        Assert.AreEqual(1, await CountAuditAsync(
            "operations.command-recovery.quarantine.resolve",
            operatorId,
            "OPS-NO-PAYLOAD-STALE",
            "fence_lost_or_not_found"));

        await using var verifyConnection = await DataSource.OpenConnectionAsync();
        await using var verifyCommand = new NpgsqlCommand(
            "SELECT terminal_status IS NULL FROM nexis_v2.command_receipts WHERE command_id = @command_id;",
            verifyConnection);
        verifyCommand.Parameters.AddWithValue("command_id", NpgsqlDbType.Uuid, entry.CommandId.Value);
        Assert.AreEqual(true, await verifyCommand.ExecuteScalarAsync());
    }

    [TestMethod]
    public void OperationalQuarantineMigrationPinsTechnicalFailureOrdinalToTheExecutionContract()
    {
        const string migrationName = "Nexis.Persistence.Postgres.Migrations.0006_operational_quarantine.sql";
        using var stream = typeof(PostgresExecutionSchema).Assembly.GetManifestResourceStream(migrationName);
        Assert.IsNotNull(stream, $"Embedded migration '{migrationName}' is missing.");
        using var reader = new StreamReader(stream);
        var migration = reader.ReadToEnd();

        StringAssert.Contains(
            migration,
            $"terminal_status = {(int)CommandTerminalStatus.TechnicalFailure}",
            "The recovery-abandon schema must fail loudly if the persisted TechnicalFailure ordinal drifts.");
    }

    [TestMethod]
    public async Task DeniedOperatorDecision_CannotListQuarantineState()
    {
        await SeedDeadLetteredEventAsync();
        var denied = PrivilegedCommandEntryDecision.Denied(
            new PlatformAuthorizationDecision(
                PlatformAuthorizationOutcome.CapabilityMissing,
                PostgresOperationalQuarantineService.RequiredCapability),
            attemptedByAccountId: AccountId.New(),
            targetAccountId: null,
            evaluatedSecurityVersion: 7,
            evaluatedAtUtc: Utc(11, 30));
        var context = new OperationalQuarantineActionContext(
            denied,
            CorrelationId.New(),
            Utc(11, 30),
            "OPS-DENIED-1");

        await Assert.ThrowsExactlyAsync<UnauthorizedAccessException>(async () =>
        {
            await new PostgresOperationalQuarantineService(DataSource).ListDeadLetteredEventsAsync(
                context,
                maximumItems: 20);
        });
    }

    private static async Task<EventId> SeedDeadLetteredEventAsync()
    {
        var request = CreateRequest();
        var payload = CanonicalCommandPayload.FromTrustedJson(
            $"{{\"commandId\":\"{request.Context.CommandId.Value:D}\"}}");
        var repository = new PostgresCommandReceiptRepository(DataSource);
        var claim = await repository.TryAcquireAsync(AcquireRequest(
            request,
            payload,
            "dead-letter-seed",
            TimeSpan.FromMinutes(1)));
        Assert.AreEqual(CommandReceiptDisposition.Acquired, claim.Disposition);

        var plan = new CommandCommitPlanBuilder().Build(
            request,
            payload.Fingerprint,
            claim,
            CoreDecision.Succeeded(events: new[] { new SyntheticEvent() }),
            new CoreImplementationDescriptor("Test.Core", "quarantine", CoreContractVersion.V1),
            Utc(10, 1));
        Assert.AreEqual(
            CommandCommitDisposition.Committed,
            (await new PostgresAtomicCommandCommitter(DataSource).CommitAsync(plan)).Disposition);

        var dispatcher = new PostgresOutboxDispatcher(
            new PostgresOutboxStore(DataSource),
            new EventSpecificRejectingTransport(),
            "dead-letter-seed-dispatcher",
            batchSize: 1,
            leaseDuration: TimeSpan.FromMinutes(1),
            failureDelay: TimeSpan.Zero,
            timeProvider: new FixedTimeProvider(Utc(11, 0)),
            maximumAttempts: 1);
        Assert.AreEqual(1, (await dispatcher.DispatchOnceAsync()).DeadLettered);
        return plan.Events.Single().Metadata.EventId;
    }

    private static async Task<RecoverySeed> SeedRecoveryQuarantineAsync()
    {
        var request = CreateRequest();
        var payload = CanonicalCommandPayload.FromTrustedJson("{\"kind\":\"recovery-quarantine\"}");
        var claim = await new PostgresCommandReceiptRepository(DataSource).TryAcquireAsync(
            AcquireRequest(request, payload, "recovery-seed", TimeSpan.FromSeconds(1)));
        Assert.AreEqual(CommandReceiptDisposition.Acquired, claim.Disposition);

        await using (var connection = await DataSource.OpenConnectionAsync())
        await using (var command = new NpgsqlCommand(
            "UPDATE nexis_v2.command_receipts SET canonical_payload = '{\"kind\":\"tampered\"}' WHERE command_id = @command_id;",
            connection))
        {
            command.Parameters.AddWithValue("command_id", NpgsqlDbType.Uuid, request.Context.CommandId.Value);
            Assert.AreEqual(1, await command.ExecuteNonQueryAsync());
        }

        var recovered = await new PostgresCommandRecoveryRepository(DataSource).ClaimExpiredBatchAsync(
            new CommandExecutionLeaseRequest("recovery-quarantine-worker", TimeSpan.FromMinutes(1)),
            Utc(10, 0, 2),
            maximumItems: 1);
        Assert.AreEqual(0, recovered.Count);
        return new RecoverySeed(request, payload);
    }

    private static async Task<RecoverySeed> SeedReceiptWithoutCanonicalPayloadAsync()
    {
        var request = CreateRequest();
        var payload = CanonicalCommandPayload.FromTrustedJson("{\"kind\":\"legacy-no-payload\"}");
        var claim = await new PostgresCommandReceiptRepository(DataSource).TryAcquireAsync(
            AcquireRequest(request, payload, "legacy-seed", TimeSpan.FromMinutes(1)));
        Assert.AreEqual(CommandReceiptDisposition.Acquired, claim.Disposition);

        const string sql = """
            UPDATE nexis_v2.command_receipts
            SET canonical_payload = NULL,
                execution_owner = NULL,
                execution_lease_expires_at_utc = NULL
            WHERE command_id = @command_id;
            """;
        await using var connection = await DataSource.OpenConnectionAsync();
        await using var command = new NpgsqlCommand(sql, connection);
        command.Parameters.AddWithValue("command_id", NpgsqlDbType.Uuid, request.Context.CommandId.Value);
        Assert.AreEqual(1, await command.ExecuteNonQueryAsync());
        return new RecoverySeed(request, payload);
    }

    private static CommandReceiptAcquireRequest AcquireRequest(
        CoreEvaluationRequest request,
        CanonicalCommandPayload payload,
        string workerId,
        TimeSpan leaseDuration) =>
        new(
            CommandExecutionIdentityFactory.Create(request, payload),
            payload,
            request.Context.CorrelationId,
            Utc(10, 0),
            new CommandExecutionLeaseRequest(workerId, leaseDuration));

    private static OperationalQuarantineActionContext OperatorContext(
        AccountId? operatorId = null,
        string caseReference = "OPS-LIST-1")
    {
        var decision = PrivilegedCommandEntryDecision.Authorized(
            new PlatformAuthorizationDecision(
                PlatformAuthorizationOutcome.Authorized,
                PostgresOperationalQuarantineService.RequiredCapability),
            operatorId ?? AccountId.New(),
            targetAccountId: null,
            evaluatedSecurityVersion: 7,
            evaluatedAtUtc: Utc(11, 30));
        return new OperationalQuarantineActionContext(
            decision,
            CorrelationId.New(),
            Utc(11, 30),
            caseReference);
    }

    private static async Task<int> CountAuditAsync(
        string action,
        AccountId actingAccountId,
        string caseReference,
        string? outcome = null)
    {
        const string sql = """
            SELECT count(*)
            FROM nexis_v2.admin_audit
            WHERE action = @action
              AND acting_account_id = @acting_account_id
              AND case_reference = @case_reference
              AND (@outcome IS NULL OR outcome = @outcome);
            """;
        await using var connection = await DataSource.OpenConnectionAsync();
        await using var command = new NpgsqlCommand(sql, connection);
        command.Parameters.AddWithValue("action", NpgsqlDbType.Text, action);
        command.Parameters.AddWithValue("acting_account_id", NpgsqlDbType.Uuid, actingAccountId.Value);
        command.Parameters.AddWithValue("case_reference", NpgsqlDbType.Text, caseReference);
        command.Parameters.AddWithValue("outcome", NpgsqlDbType.Text, (object?)outcome ?? DBNull.Value);
        return Convert.ToInt32(await command.ExecuteScalarAsync());
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
        new(2026, 8, 29, hour, minute, second, TimeSpan.Zero);

    private static NpgsqlDataSource DataSource =>
        s_dataSource ?? throw new InvalidOperationException("PostgreSQL test data source was not initialized.");

    private sealed record RecoverySeed(CoreEvaluationRequest Request, CanonicalCommandPayload Payload);

    private sealed record SyntheticIntent : ICoreIntent
    {
        public ContractDescriptor Contract { get; } = new("tests.quarantine.command", 1);
    }

    private sealed record SyntheticEvent : ICoreEventDescriptor
    {
        public ContractDescriptor Contract { get; } = new("tests.quarantine.event", 1);
    }

    private sealed class EventSpecificRejectingTransport : ICommittedEventTransport
    {
        public ValueTask PublishAsync(CommittedEventMessage message, CancellationToken cancellationToken = default) =>
            ValueTask.FromException(new CommittedEventTransportException(
                CommittedEventTransportFailureKind.EventSpecificPermanent,
                "Synthetic event-specific rejection."));
    }

    private sealed class FixedTimeProvider : TimeProvider
    {
        private readonly DateTimeOffset _now;

        public FixedTimeProvider(DateTimeOffset now) => _now = now;

        public override DateTimeOffset GetUtcNow() => _now;
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
