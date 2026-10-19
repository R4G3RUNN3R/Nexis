using System.Data;
using Nexis.Core.Contracts;
using Nexis.Execution.Contracts;
using Nexis.Identity.Contracts;
using Nexis.Kernel.Commands;
using Nexis.Kernel.Events;
using Nexis.Operations.Contracts;
using Npgsql;
using NpgsqlTypes;

namespace Nexis.Persistence.Postgres;

/// <summary>
/// PostgreSQL crash-recovery implementation. The command receipt row is the fencing point: an
/// ambiguous earlier COMMIT must resolve before SELECT ... FOR UPDATE can return, and every
/// successful takeover rotates execution_token before re-execution is allowed.
/// </summary>
public sealed class PostgresCommandRecoveryRepository : ICommandExecutionRecoveryRepository
{
    private readonly NpgsqlDataSource _dataSource;
    private readonly IOperationalSignalSink? _operationalSignalSink;

    public PostgresCommandRecoveryRepository(NpgsqlDataSource dataSource)
        : this(dataSource, null)
    {
    }

    public PostgresCommandRecoveryRepository(
        NpgsqlDataSource dataSource,
        IOperationalSignalSink? operationalSignalSink)
    {
        _dataSource = dataSource ?? throw new ArgumentNullException(nameof(dataSource));
        _operationalSignalSink = operationalSignalSink;
    }

    public async ValueTask<CommandRecoveryResult> ReconcileAsync(
        CommandId commandId,
        CommandExecutionToken observedExecutionToken,
        CommandExecutionLeaseRequest replacementLease,
        DateTimeOffset nowUtc,
        CancellationToken cancellationToken = default)
    {
        ValidateCommandAndLease(commandId, observedExecutionToken, replacementLease, nowUtc);
        var newExpiry = nowUtc + replacementLease.Duration;

        await using var connection = await _dataSource.OpenConnectionAsync(cancellationToken).ConfigureAwait(false);
        await using var transaction = await connection.BeginTransactionAsync(IsolationLevel.ReadCommitted, cancellationToken).ConfigureAwait(false);

        var row = await ReadForUpdateAsync(connection, transaction, commandId, cancellationToken).ConfigureAwait(false);
        if (row is null)
        {
            await transaction.CommitAsync(cancellationToken).ConfigureAwait(false);
            return CommandRecoveryResult.Missing();
        }

        if (row.TerminalStatus.HasValue)
        {
            var terminal = BuildTerminalOutcome(row);
            await transaction.CommitAsync(cancellationToken).ConfigureAwait(false);
            return CommandRecoveryResult.Completed(new CorrelationId(row.OriginalCorrelationId), terminal);
        }

        if (row.ExecutionToken != observedExecutionToken.Value)
        {
            await transaction.CommitAsync(cancellationToken).ConfigureAwait(false);
            return CommandRecoveryResult.OwnershipLost(new CorrelationId(row.OriginalCorrelationId));
        }

        if (row.CanonicalPayload is null || row.RecoveryAbandonedAtUtc.HasValue)
        {
            await transaction.CommitAsync(cancellationToken).ConfigureAwait(false);
            return CommandRecoveryResult.NotRecoverable(new CorrelationId(row.OriginalCorrelationId));
        }

        var newToken = CommandExecutionToken.New();
        if (!TryBuildRecovered(row, newToken, replacementLease.WorkerId, newExpiry, out var recovered))
        {
            await AbandonRecoveryAsync(
                connection,
                transaction,
                row.CommandId,
                row.ExecutionToken,
                CommandExecutionToken.New().Value,
                nowUtc,
                cancellationToken)
                .ConfigureAwait(false);
            await transaction.CommitAsync(cancellationToken).ConfigureAwait(false);
            await ReportRecoveryAbandonedAsync(row, nowUtc, CancellationToken.None).ConfigureAwait(false);
            return CommandRecoveryResult.NotRecoverable(new CorrelationId(row.OriginalCorrelationId));
        }

        await RotateFenceAsync(
            connection,
            transaction,
            row.CommandId,
            observedExecutionToken.Value,
            newToken,
            replacementLease.WorkerId,
            newExpiry,
            cancellationToken).ConfigureAwait(false);

        await transaction.CommitAsync(cancellationToken).ConfigureAwait(false);
        return CommandRecoveryResult.Recovered(recovered);
    }

    public async ValueTask<IReadOnlyList<RecoveredCommandExecution>> ClaimExpiredBatchAsync(
        CommandExecutionLeaseRequest replacementLease,
        DateTimeOffset nowUtc,
        int maximumItems,
        CancellationToken cancellationToken = default)
    {
        ArgumentNullException.ThrowIfNull(replacementLease);
        ValidateUtc(nowUtc, nameof(nowUtc));
        if (maximumItems <= 0)
        {
            throw new ArgumentOutOfRangeException(nameof(maximumItems), "Recovery batch size must be positive.");
        }

        var newExpiry = nowUtc + replacementLease.Duration;
        await using var connection = await _dataSource.OpenConnectionAsync(cancellationToken).ConfigureAwait(false);
        await using var transaction = await connection.BeginTransactionAsync(IsolationLevel.ReadCommitted, cancellationToken).ConfigureAwait(false);

        const string selectSql = """
            SELECT command_id, lane, actor_account_id, actor_character_id, actor_system_key,
                   intent_name, intent_schema_version, payload_fingerprint,
                   original_correlation_id, received_at_utc, execution_token,
                   canonical_payload, execution_owner, execution_lease_expires_at_utc,
                   terminal_status, terminal_reason, completed_at_utc,
                   recovery_abandoned_at_utc, recovery_abandon_reason
            FROM nexis_v2.command_receipts
            WHERE terminal_status IS NULL
              AND canonical_payload IS NOT NULL
              AND execution_lease_expires_at_utc <= @now_utc
              AND recovery_abandoned_at_utc IS NULL
            ORDER BY execution_lease_expires_at_utc, received_at_utc, command_id
            FOR UPDATE SKIP LOCKED
            LIMIT @maximum_items;
            """;

        var rows = new List<StoredRecoveryRow>();
        await using (var select = new NpgsqlCommand(selectSql, connection, transaction))
        {
            select.Parameters.AddWithValue("now_utc", NpgsqlDbType.TimestampTz, nowUtc.UtcDateTime);
            select.Parameters.AddWithValue("maximum_items", NpgsqlDbType.Integer, maximumItems);
            await using var reader = await select.ExecuteReaderAsync(cancellationToken).ConfigureAwait(false);
            while (await reader.ReadAsync(cancellationToken).ConfigureAwait(false))
            {
                rows.Add(ReadRecoveryRow(reader));
            }
        }

        var recovered = new List<RecoveredCommandExecution>(rows.Count);
        foreach (var row in rows)
        {
            var newToken = CommandExecutionToken.New();
            if (!TryBuildRecovered(row, newToken, replacementLease.WorkerId, newExpiry, out var recoveredExecution))
            {
                await AbandonRecoveryAsync(
                connection,
                transaction,
                row.CommandId,
                row.ExecutionToken,
                CommandExecutionToken.New().Value,
                nowUtc,
                cancellationToken)
                    .ConfigureAwait(false);
                continue;
            }

            await RotateFenceAsync(
                connection,
                transaction,
                row.CommandId,
                row.ExecutionToken,
                newToken,
                replacementLease.WorkerId,
                newExpiry,
                cancellationToken).ConfigureAwait(false);

            recovered.Add(recoveredExecution);
        }

        await transaction.CommitAsync(cancellationToken).ConfigureAwait(false);

        foreach (var abandoned in rows.Where(static row => row.RecoveryAbandonedAtUtc is null)
                     .Where(row => recovered.All(item => item.CommandId.Value != row.CommandId)))
        {
            await ReportRecoveryAbandonedAsync(abandoned, nowUtc, CancellationToken.None).ConfigureAwait(false);
        }

        return recovered.AsReadOnly();
    }

    public async ValueTask<bool> RenewLeaseAsync(
        CommandId commandId,
        CommandExecutionToken executionToken,
        CommandExecutionLeaseRequest currentLease,
        DateTimeOffset nowUtc,
        CancellationToken cancellationToken = default)
    {
        ValidateCommandAndLease(commandId, executionToken, currentLease, nowUtc);
        var newExpiry = nowUtc + currentLease.Duration;

        const string sql = """
            UPDATE nexis_v2.command_receipts
            SET execution_lease_expires_at_utc = @new_expiry_utc
            WHERE command_id = @command_id
              AND execution_token = @execution_token
              AND execution_owner = @execution_owner
              AND terminal_status IS NULL
              AND canonical_payload IS NOT NULL
              AND recovery_abandoned_at_utc IS NULL;
            """;

        await using var connection = await _dataSource.OpenConnectionAsync(cancellationToken).ConfigureAwait(false);
        await using var command = new NpgsqlCommand(sql, connection);
        command.Parameters.AddWithValue("new_expiry_utc", NpgsqlDbType.TimestampTz, newExpiry.UtcDateTime);
        command.Parameters.AddWithValue("command_id", NpgsqlDbType.Uuid, commandId.Value);
        command.Parameters.AddWithValue("execution_token", NpgsqlDbType.Uuid, executionToken.Value);
        command.Parameters.AddWithValue("execution_owner", NpgsqlDbType.Text, currentLease.WorkerId);
        if (await command.ExecuteNonQueryAsync(cancellationToken).ConfigureAwait(false) == 1)
        {
            return true;
        }

        await ReportLeaseRenewalRefusedAsync(commandId, nowUtc, CancellationToken.None).ConfigureAwait(false);
        return false;
    }

    private static async ValueTask<StoredRecoveryRow?> ReadForUpdateAsync(
        NpgsqlConnection connection,
        NpgsqlTransaction transaction,
        CommandId commandId,
        CancellationToken cancellationToken)
    {
        const string sql = """
            SELECT command_id, lane, actor_account_id, actor_character_id, actor_system_key,
                   intent_name, intent_schema_version, payload_fingerprint,
                   original_correlation_id, received_at_utc, execution_token,
                   canonical_payload, execution_owner, execution_lease_expires_at_utc,
                   terminal_status, terminal_reason, completed_at_utc,
                   recovery_abandoned_at_utc, recovery_abandon_reason
            FROM nexis_v2.command_receipts
            WHERE command_id = @command_id
            FOR UPDATE;
            """;

        await using var command = new NpgsqlCommand(sql, connection, transaction);
        command.Parameters.AddWithValue("command_id", NpgsqlDbType.Uuid, commandId.Value);
        await using var reader = await command.ExecuteReaderAsync(CommandBehavior.SingleRow, cancellationToken).ConfigureAwait(false);
        return await reader.ReadAsync(cancellationToken).ConfigureAwait(false)
            ? ReadRecoveryRow(reader)
            : null;
    }

    private static StoredRecoveryRow ReadRecoveryRow(NpgsqlDataReader reader) =>
        new(
            reader.GetGuid(0),
            reader.GetInt32(1),
            reader.IsDBNull(2) ? null : reader.GetGuid(2),
            reader.IsDBNull(3) ? null : reader.GetGuid(3),
            reader.IsDBNull(4) ? null : reader.GetString(4),
            reader.GetString(5),
            reader.GetInt32(6),
            reader.GetString(7).TrimEnd(),
            reader.GetGuid(8),
            ToDateTimeOffset(reader.GetDateTime(9)),
            reader.GetGuid(10),
            reader.IsDBNull(11) ? null : reader.GetString(11),
            reader.IsDBNull(12) ? null : reader.GetString(12),
            reader.IsDBNull(13) ? null : ToDateTimeOffset(reader.GetDateTime(13)),
            reader.IsDBNull(14) ? null : reader.GetInt32(14),
            reader.IsDBNull(15) ? null : reader.GetString(15),
            reader.IsDBNull(16) ? null : ToDateTimeOffset(reader.GetDateTime(16)),
            reader.IsDBNull(17) ? null : ToDateTimeOffset(reader.GetDateTime(17)),
            reader.IsDBNull(18) ? null : reader.GetString(18));

    private static RecoveredCommandExecution BuildRecovered(
        StoredRecoveryRow row,
        CommandExecutionToken newToken,
        string workerId,
        DateTimeOffset newExpiry)
    {
        if (row.CanonicalPayload is null)
        {
            throw new InvalidOperationException("Cannot build a recovered command without its canonical payload.");
        }

        var payload = CanonicalCommandPayload.FromTrustedJson(row.CanonicalPayload);
        var storedFingerprint = CommandPayloadFingerprint.Parse(row.PayloadFingerprint);
        if (payload.Fingerprint != storedFingerprint)
        {
            throw new InvalidOperationException("Stored canonical command payload does not match its durable fingerprint.");
        }

        var lane = (CommandExecutionLane)row.Lane;
        var accountId = row.ActorAccountId.HasValue ? new AccountId(row.ActorAccountId.Value) : (AccountId?)null;
        var characterId = row.ActorCharacterId.HasValue ? new CharacterId(row.ActorCharacterId.Value) : (CharacterId?)null;
        var systemActorKey = row.ActorSystemKey is null ? null : new SystemActorKey(row.ActorSystemKey);

        return new RecoveredCommandExecution(
            new CommandId(row.CommandId),
            lane,
            accountId,
            characterId,
            systemActorKey,
            new ContractDescriptor(row.IntentName, row.IntentSchemaVersion),
            payload,
            new CorrelationId(row.OriginalCorrelationId),
            row.ReceivedAtUtc,
            newToken,
            workerId,
            newExpiry);
    }

    private static CommandTerminalOutcome BuildTerminalOutcome(StoredRecoveryRow row)
    {
        var receipt = new PostgresCommandReceiptRow(
            row.Lane,
            row.ActorAccountId,
            row.ActorCharacterId,
            row.ActorSystemKey,
            row.IntentName,
            row.IntentSchemaVersion,
            row.PayloadFingerprint,
            row.OriginalCorrelationId,
            row.TerminalStatus,
            row.TerminalReason,
            row.CompletedAtUtc);
        return PostgresCommandReceiptRepository.BuildTerminalOutcome(receipt);
    }

    private static bool TryBuildRecovered(
        StoredRecoveryRow row,
        CommandExecutionToken newToken,
        string workerId,
        DateTimeOffset newExpiry,
        out RecoveredCommandExecution recovered)
    {
        try
        {
            recovered = BuildRecovered(row, newToken, workerId, newExpiry);
            return true;
        }
        catch (Exception exception) when (exception is ArgumentException
            or InvalidOperationException
            or FormatException
            or System.Text.Json.JsonException
            or OverflowException)
        {
            recovered = null!;
            return false;
        }
    }

    private static async ValueTask AbandonRecoveryAsync(
        NpgsqlConnection connection,
        NpgsqlTransaction transaction,
        Guid commandId,
        Guid observedToken,
        Guid quarantineToken,
        DateTimeOffset abandonedAtUtc,
        CancellationToken cancellationToken)
    {
        const string sql = """
            UPDATE nexis_v2.command_receipts
            SET execution_token = @quarantine_execution_token,
                recovery_abandoned_at_utc = @abandoned_at_utc,
                recovery_abandon_reason = 'stored_recovery_artifact_invalid'
            WHERE command_id = @command_id
              AND execution_token = @observed_execution_token
              AND terminal_status IS NULL
              AND recovery_abandoned_at_utc IS NULL;
            """;

        await using var command = new NpgsqlCommand(sql, connection, transaction);
        command.Parameters.AddWithValue("abandoned_at_utc", NpgsqlDbType.TimestampTz, abandonedAtUtc.UtcDateTime);
        command.Parameters.AddWithValue("command_id", NpgsqlDbType.Uuid, commandId);
        command.Parameters.AddWithValue("observed_execution_token", NpgsqlDbType.Uuid, observedToken);
        command.Parameters.AddWithValue("quarantine_execution_token", NpgsqlDbType.Uuid, quarantineToken);

        if (await command.ExecuteNonQueryAsync(cancellationToken).ConfigureAwait(false) != 1)
        {
            throw new InvalidOperationException("Command recovery quarantine fence changed while its receipt row was locked.");
        }
    }

    private async ValueTask ReportLeaseRenewalRefusedAsync(
        CommandId commandId,
        DateTimeOffset occurredAtUtc,
        CancellationToken cancellationToken)
    {
        if (_operationalSignalSink is null)
        {
            return;
        }

        CorrelationId? correlationId = null;
        try
        {
            await using var connection = await _dataSource.OpenConnectionAsync(cancellationToken).ConfigureAwait(false);
            await using var command = new NpgsqlCommand(
                "SELECT original_correlation_id FROM nexis_v2.command_receipts WHERE command_id = @command_id;",
                connection);
            command.Parameters.AddWithValue("command_id", NpgsqlDbType.Uuid, commandId.Value);
            var storedCorrelation = await command.ExecuteScalarAsync(cancellationToken).ConfigureAwait(false);
            if (storedCorrelation is Guid value)
            {
                correlationId = new CorrelationId(value);
            }

            await _operationalSignalSink.ReportAsync(
                new OperationalSignal(
                    OperationalConditionKind.LeaseFencingFailure,
                    OperationalSeverity.Error,
                    new OperationalComponentKey("postgres.command-recovery"),
                    new OperationalReasonCode("retry_lease_renewal_refused"),
                    occurredAtUtc,
                    commandId,
                    correlationId),
                cancellationToken).ConfigureAwait(false);
        }
        catch (Exception)
        {
            // The receipt fence is authoritative. Monitoring failures cannot restore retry ownership.
        }
    }

    private async ValueTask ReportRecoveryAbandonedAsync(
        StoredRecoveryRow row,
        DateTimeOffset occurredAtUtc,
        CancellationToken cancellationToken)
    {
        if (_operationalSignalSink is null)
        {
            return;
        }

        try
        {
            await _operationalSignalSink.ReportAsync(
                new OperationalSignal(
                    OperationalConditionKind.CommandRecoveryFailure,
                    OperationalSeverity.Error,
                    new OperationalComponentKey("postgres.command-recovery"),
                    new OperationalReasonCode("stored_recovery_artifact_invalid"),
                    occurredAtUtc,
                    new CommandId(row.CommandId),
                    new CorrelationId(row.OriginalCorrelationId)),
                cancellationToken).ConfigureAwait(false);
            await _operationalSignalSink.ReportAsync(
                new OperationalSignal(
                    OperationalConditionKind.LeaseFencingFailure,
                    OperationalSeverity.Error,
                    new OperationalComponentKey("postgres.command-recovery"),
                    new OperationalReasonCode("recovery_quarantine_fence_rotated"),
                    occurredAtUtc,
                    new CommandId(row.CommandId),
                    new CorrelationId(row.OriginalCorrelationId)),
                cancellationToken).ConfigureAwait(false);
        }
        catch (Exception)
        {
            // Recovery quarantine is durable before diagnostics run. A failing monitoring sink must
            // not change recovery fencing or make a quarantined command appear recoverable again.
        }
    }

    private static async ValueTask RotateFenceAsync(
        NpgsqlConnection connection,
        NpgsqlTransaction transaction,
        Guid commandId,
        Guid observedToken,
        CommandExecutionToken newToken,
        string newOwner,
        DateTimeOffset newExpiry,
        CancellationToken cancellationToken)
    {
        const string sql = """
            UPDATE nexis_v2.command_receipts
            SET execution_token = @new_execution_token,
                execution_owner = @new_execution_owner,
                execution_lease_expires_at_utc = @new_lease_expiry
            WHERE command_id = @command_id
              AND execution_token = @observed_execution_token
              AND terminal_status IS NULL
              AND recovery_abandoned_at_utc IS NULL;
            """;

        await using var command = new NpgsqlCommand(sql, connection, transaction);
        command.Parameters.AddWithValue("new_execution_token", NpgsqlDbType.Uuid, newToken.Value);
        command.Parameters.AddWithValue("new_execution_owner", NpgsqlDbType.Text, newOwner);
        command.Parameters.AddWithValue("new_lease_expiry", NpgsqlDbType.TimestampTz, newExpiry.UtcDateTime);
        command.Parameters.AddWithValue("command_id", NpgsqlDbType.Uuid, commandId);
        command.Parameters.AddWithValue("observed_execution_token", NpgsqlDbType.Uuid, observedToken);

        if (await command.ExecuteNonQueryAsync(cancellationToken).ConfigureAwait(false) != 1)
        {
            throw new InvalidOperationException("Command execution fence changed while its receipt row was locked.");
        }
    }

    private static void ValidateCommandAndLease(
        CommandId commandId,
        CommandExecutionToken executionToken,
        CommandExecutionLeaseRequest lease,
        DateTimeOffset nowUtc)
    {
        if (commandId.IsEmpty)
        {
            throw new ArgumentException("CommandId cannot be empty.", nameof(commandId));
        }

        if (executionToken.IsEmpty)
        {
            throw new ArgumentException("Execution token cannot be empty.", nameof(executionToken));
        }

        ArgumentNullException.ThrowIfNull(lease);
        ValidateUtc(nowUtc, nameof(nowUtc));
    }

    private static void ValidateUtc(DateTimeOffset value, string parameterName)
    {
        if (value.Offset != TimeSpan.Zero)
        {
            throw new ArgumentException("Command recovery timestamps must be UTC.", parameterName);
        }
    }

    private static DateTimeOffset ToDateTimeOffset(DateTime value) =>
        new(value.Kind == DateTimeKind.Utc ? value : DateTime.SpecifyKind(value, DateTimeKind.Utc));

    private sealed record StoredRecoveryRow(
        Guid CommandId,
        int Lane,
        Guid? ActorAccountId,
        Guid? ActorCharacterId,
        string? ActorSystemKey,
        string IntentName,
        int IntentSchemaVersion,
        string PayloadFingerprint,
        Guid OriginalCorrelationId,
        DateTimeOffset ReceivedAtUtc,
        Guid ExecutionToken,
        string? CanonicalPayload,
        string? ExecutionOwner,
        DateTimeOffset? ExecutionLeaseExpiresAtUtc,
        int? TerminalStatus,
        string? TerminalReason,
        DateTimeOffset? CompletedAtUtc,
        DateTimeOffset? RecoveryAbandonedAtUtc,
        string? RecoveryAbandonReason);
}
