using System.Data;
using Nexis.Audit.Contracts;
using Nexis.Execution.Contracts;
using Nexis.Identity.Contracts;
using Nexis.Kernel.Commands;
using Nexis.Kernel.Events;
using Npgsql;
using NpgsqlTypes;

namespace Nexis.Persistence.Postgres;

/// <summary>
/// Explicit privileged operator boundary for inspecting and resolving durable infrastructure
/// quarantine. No method is invoked automatically by a dispatcher or recovery sweep.
/// </summary>
public sealed class PostgresOperationalQuarantineService
{
    private const int MaximumListingItems = 500;
    private readonly NpgsqlDataSource _dataSource;

    public PostgresOperationalQuarantineService(NpgsqlDataSource dataSource)
    {
        _dataSource = dataSource ?? throw new ArgumentNullException(nameof(dataSource));
    }

    public static PlatformCapabilityKey RequiredCapability { get; } =
        new("operations.quarantine.manage");

    public async ValueTask<IReadOnlyList<OutboxDeadLetterEntry>> ListDeadLetteredEventsAsync(
        OperationalQuarantineActionContext context,
        int maximumItems,
        CancellationToken cancellationToken = default)
    {
        var actingAccountId = RequireAuthorized(context);
        ValidateMaximumItems(maximumItems);

        const string sql = """
            SELECT event_id, command_id, correlation_id, occurred_at_utc,
                   contract_name, contract_schema_version, created_at_utc,
                   attempt_count, poison_attempt_count,
                   dead_lettered_at_utc, dead_letter_reason
            FROM nexis_v2.outbox
            WHERE dead_lettered_at_utc IS NOT NULL
            ORDER BY dead_lettered_at_utc, event_id
            LIMIT @maximum_items;
            """;

        var entries = new List<OutboxDeadLetterEntry>();
        await using var connection = await _dataSource.OpenConnectionAsync(cancellationToken).ConfigureAwait(false);
        await using var transaction = await connection.BeginTransactionAsync(IsolationLevel.ReadCommitted, cancellationToken)
            .ConfigureAwait(false);
        await using (var command = new NpgsqlCommand(sql, connection, transaction))
        {
            command.Parameters.AddWithValue("maximum_items", NpgsqlDbType.Integer, maximumItems);
            await using var reader = await command.ExecuteReaderAsync(cancellationToken).ConfigureAwait(false);
            while (await reader.ReadAsync(cancellationToken).ConfigureAwait(false))
            {
                entries.Add(new OutboxDeadLetterEntry(
                    new EventId(reader.GetGuid(0)),
                    new CommandId(reader.GetGuid(1)),
                    new CorrelationId(reader.GetGuid(2)),
                    ToDateTimeOffset(reader.GetDateTime(3)),
                    new Core.Contracts.ContractDescriptor(reader.GetString(4), reader.GetInt32(5)),
                    ToDateTimeOffset(reader.GetDateTime(6)),
                    reader.GetInt32(7),
                    reader.GetInt32(8),
                    ToDateTimeOffset(reader.GetDateTime(9)),
                    reader.GetString(10)));
            }
        }

        await AppendAuditAsync(
            connection,
            transaction,
            context,
            actingAccountId,
            AuditActionKind.PrivilegedRead,
            "operations.outbox.dead-letter.list",
            "listed",
            cancellationToken).ConfigureAwait(false);
        await transaction.CommitAsync(cancellationToken).ConfigureAwait(false);
        return entries.AsReadOnly();
    }

    public async ValueTask<bool> RequeueDeadLetteredEventAsync(
        OperationalQuarantineActionContext context,
        EventId eventId,
        DateTimeOffset observedDeadLetteredAtUtc,
        int observedPoisonAttemptCount,
        CancellationToken cancellationToken = default)
    {
        var actingAccountId = RequireAuthorized(context);
        ValidateEventId(eventId);
        ValidateUtc(observedDeadLetteredAtUtc, nameof(observedDeadLetteredAtUtc));
        if (observedPoisonAttemptCount <= 0)
        {
            throw new ArgumentOutOfRangeException(
                nameof(observedPoisonAttemptCount),
                "A dead-letter observation requires a positive poison-attempt count.");
        }

        const string sql = """
            UPDATE nexis_v2.outbox
            SET poison_attempt_count = 0,
                dead_lettered_at_utc = NULL,
                dead_letter_reason = NULL,
                available_at_utc = @available_at_utc,
                lease_token = NULL,
                lease_owner = NULL,
                lease_expires_at_utc = NULL
            WHERE event_id = @event_id
              AND published_at_utc IS NULL
              AND dead_lettered_at_utc = @observed_dead_lettered_at_utc
              AND poison_attempt_count = @observed_poison_attempt_count;
            """;

        await using var connection = await _dataSource.OpenConnectionAsync(cancellationToken).ConfigureAwait(false);
        await using var transaction = await connection.BeginTransactionAsync(IsolationLevel.ReadCommitted, cancellationToken)
            .ConfigureAwait(false);
        await using var command = new NpgsqlCommand(sql, connection, transaction);
        command.Parameters.AddWithValue("available_at_utc", NpgsqlDbType.TimestampTz, context.OccurredAtUtc.UtcDateTime);
        command.Parameters.AddWithValue("event_id", NpgsqlDbType.Uuid, eventId.Value);
        command.Parameters.AddWithValue(
            "observed_dead_lettered_at_utc",
            NpgsqlDbType.TimestampTz,
            observedDeadLetteredAtUtc.UtcDateTime);
        command.Parameters.AddWithValue(
            "observed_poison_attempt_count",
            NpgsqlDbType.Integer,
            observedPoisonAttemptCount);
        var applied = await command.ExecuteNonQueryAsync(cancellationToken).ConfigureAwait(false) == 1;

        await AppendAuditAsync(
            connection,
            transaction,
            context,
            actingAccountId,
            AuditActionKind.Correction,
            "operations.outbox.dead-letter.requeue",
            applied ? "requeued" : "fence_lost_or_not_found",
            cancellationToken).ConfigureAwait(false);
        await transaction.CommitAsync(cancellationToken).ConfigureAwait(false);
        return applied;
    }

    public async ValueTask<IReadOnlyList<CommandRecoveryQuarantineEntry>> ListRecoveryQuarantinesAsync(
        OperationalQuarantineActionContext context,
        int maximumItems,
        CancellationToken cancellationToken = default)
    {
        var actingAccountId = RequireAuthorized(context);
        ValidateMaximumItems(maximumItems);

        const string sql = """
            SELECT command_id, original_correlation_id,
                   intent_name, intent_schema_version, received_at_utc,
                   execution_token, recovery_abandoned_at_utc,
                   COALESCE(recovery_abandon_reason, 'canonical_payload_unavailable')
            FROM nexis_v2.command_receipts
            WHERE terminal_status IS NULL
              AND (recovery_abandoned_at_utc IS NOT NULL OR canonical_payload IS NULL)
            ORDER BY COALESCE(recovery_abandoned_at_utc, received_at_utc), command_id
            LIMIT @maximum_items;
            """;

        var entries = new List<CommandRecoveryQuarantineEntry>();
        await using var connection = await _dataSource.OpenConnectionAsync(cancellationToken).ConfigureAwait(false);
        await using var transaction = await connection.BeginTransactionAsync(IsolationLevel.ReadCommitted, cancellationToken)
            .ConfigureAwait(false);
        await using (var command = new NpgsqlCommand(sql, connection, transaction))
        {
            command.Parameters.AddWithValue("maximum_items", NpgsqlDbType.Integer, maximumItems);
            await using var reader = await command.ExecuteReaderAsync(cancellationToken).ConfigureAwait(false);
            while (await reader.ReadAsync(cancellationToken).ConfigureAwait(false))
            {
                entries.Add(new CommandRecoveryQuarantineEntry(
                    new CommandId(reader.GetGuid(0)),
                    new CorrelationId(reader.GetGuid(1)),
                    new Core.Contracts.ContractDescriptor(reader.GetString(2), reader.GetInt32(3)),
                    ToDateTimeOffset(reader.GetDateTime(4)),
                    new CommandExecutionToken(reader.GetGuid(5)),
                    reader.IsDBNull(6) ? null : ToDateTimeOffset(reader.GetDateTime(6)),
                    reader.GetString(7)));
            }
        }

        await AppendAuditAsync(
            connection,
            transaction,
            context,
            actingAccountId,
            AuditActionKind.PrivilegedRead,
            "operations.command-recovery.quarantine.list",
            "listed",
            cancellationToken).ConfigureAwait(false);
        await transaction.CommitAsync(cancellationToken).ConfigureAwait(false);
        return entries.AsReadOnly();
    }

    public async ValueTask<bool> ResolveRecoveryQuarantineAsTechnicalFailureAsync(
        OperationalQuarantineActionContext context,
        CommandId commandId,
        CommandExecutionToken observedExecutionToken,
        DateTimeOffset? observedRecoveryAbandonedAtUtc,
        CancellationToken cancellationToken = default)
    {
        var actingAccountId = RequireAuthorized(context);
        if (commandId.IsEmpty)
        {
            throw new ArgumentException("CommandId cannot be empty.", nameof(commandId));
        }

        if (observedExecutionToken.IsEmpty)
        {
            throw new ArgumentException("Observed recovery fence cannot be empty.", nameof(observedExecutionToken));
        }

        if (observedRecoveryAbandonedAtUtc.HasValue)
        {
            ValidateUtc(observedRecoveryAbandonedAtUtc.Value, nameof(observedRecoveryAbandonedAtUtc));
        }

        const string sql = """
            UPDATE nexis_v2.command_receipts
            SET terminal_status = @terminal_status,
                terminal_reason = 'execution.recovery.quarantine_resolved',
                completed_at_utc = @completed_at_utc,
                core_implementation_name = 'Nexis.OperationalRecovery',
                core_implementation_version = '1',
                core_contract_version = 1,
                rule_version = 'not_evaluated',
                content_version = 'not_evaluated',
                evaluated_at_utc = @completed_at_utc,
                execution_owner = NULL,
                execution_lease_expires_at_utc = NULL
            WHERE command_id = @command_id
              AND execution_token = @observed_execution_token
              AND recovery_abandoned_at_utc IS NOT DISTINCT FROM @observed_recovery_abandoned_at_utc
              AND terminal_status IS NULL
              AND (recovery_abandoned_at_utc IS NOT NULL OR canonical_payload IS NULL);
            """;

        await using var connection = await _dataSource.OpenConnectionAsync(cancellationToken).ConfigureAwait(false);
        await using var transaction = await connection.BeginTransactionAsync(IsolationLevel.ReadCommitted, cancellationToken)
            .ConfigureAwait(false);
        await using var command = new NpgsqlCommand(sql, connection, transaction);
        command.Parameters.AddWithValue("terminal_status", NpgsqlDbType.Integer, (int)CommandTerminalStatus.TechnicalFailure);
        command.Parameters.AddWithValue("completed_at_utc", NpgsqlDbType.TimestampTz, context.OccurredAtUtc.UtcDateTime);
        command.Parameters.AddWithValue("command_id", NpgsqlDbType.Uuid, commandId.Value);
        command.Parameters.AddWithValue("observed_execution_token", NpgsqlDbType.Uuid, observedExecutionToken.Value);
        command.Parameters.AddWithValue(
            "observed_recovery_abandoned_at_utc",
            NpgsqlDbType.TimestampTz,
            observedRecoveryAbandonedAtUtc.HasValue
                ? observedRecoveryAbandonedAtUtc.Value.UtcDateTime
                : DBNull.Value);
        var applied = await command.ExecuteNonQueryAsync(cancellationToken).ConfigureAwait(false) == 1;

        await AppendAuditAsync(
            connection,
            transaction,
            context,
            actingAccountId,
            AuditActionKind.Correction,
            "operations.command-recovery.quarantine.resolve",
            applied ? "technical_failure_recorded" : "fence_lost_or_not_found",
            cancellationToken).ConfigureAwait(false);
        await transaction.CommitAsync(cancellationToken).ConfigureAwait(false);
        return applied;
    }

    private static AccountId RequireAuthorized(OperationalQuarantineActionContext context)
    {
        ArgumentNullException.ThrowIfNull(context);
        var decision = context.Authorization;
        if (!decision.IsAuthorized ||
            decision.Authorization.RequiredCapability != RequiredCapability ||
            decision.ActingAccountId is not { IsEmpty: false } actingAccountId)
        {
            throw new UnauthorizedAccessException("Operational quarantine access requires current authorized staff identity.");
        }

        return actingAccountId;
    }

    private static async ValueTask AppendAuditAsync(
        NpgsqlConnection connection,
        NpgsqlTransaction transaction,
        OperationalQuarantineActionContext context,
        AccountId actingAccountId,
        AuditActionKind actionKind,
        string action,
        string outcome,
        CancellationToken cancellationToken)
    {
        var entry = new AuditEntry(
            AuditId.New(),
            actingAccountId,
            targetAccountId: null,
            actionKind,
            AuditVisibility.InternalOnly,
            context.OccurredAtUtc,
            action,
            outcome,
            safePlayerReason: null,
            context.CaseReference,
            context.CorrelationId,
            causationEventId: null);
        await PostgresAuditWriter.InsertAsync(
            connection,
            transaction,
            entry,
            commandId: null,
            cancellationToken).ConfigureAwait(false);
    }

    private static void ValidateMaximumItems(int maximumItems)
    {
        if (maximumItems <= 0 || maximumItems > MaximumListingItems)
        {
            throw new ArgumentOutOfRangeException(
                nameof(maximumItems),
                $"Quarantine listing size must be between 1 and {MaximumListingItems}.");
        }
    }

    private static void ValidateEventId(EventId eventId)
    {
        if (eventId.Value == Guid.Empty)
        {
            throw new ArgumentException("EventId cannot be empty.", nameof(eventId));
        }
    }

    private static void ValidateUtc(DateTimeOffset value, string parameterName)
    {
        if (value.Offset != TimeSpan.Zero)
        {
            throw new ArgumentException("Quarantine fencing timestamps must be UTC.", parameterName);
        }
    }

    private static DateTimeOffset ToDateTimeOffset(DateTime value) =>
        new(value.Kind == DateTimeKind.Utc ? value : DateTime.SpecifyKind(value, DateTimeKind.Utc));
}
