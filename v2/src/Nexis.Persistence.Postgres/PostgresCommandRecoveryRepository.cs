using System.Data;
using Nexis.Core.Contracts;
using Nexis.Execution.Contracts;
using Nexis.Identity.Contracts;
using Nexis.Kernel.Commands;
using Nexis.Kernel.Events;
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

    public PostgresCommandRecoveryRepository(NpgsqlDataSource dataSource)
    {
        _dataSource = dataSource ?? throw new ArgumentNullException(nameof(dataSource));
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

        if (row.CanonicalPayload is null)
        {
            await transaction.CommitAsync(cancellationToken).ConfigureAwait(false);
            return CommandRecoveryResult.NotRecoverable(new CorrelationId(row.OriginalCorrelationId));
        }

        var newToken = CommandExecutionToken.New();
        await RotateFenceAsync(
            connection,
            transaction,
            row.CommandId,
            observedExecutionToken.Value,
            newToken,
            replacementLease.WorkerId,
            newExpiry,
            cancellationToken).ConfigureAwait(false);

        var recovered = BuildRecovered(row, newToken, replacementLease.WorkerId, newExpiry);
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
            SELECT command_id, lane, actor_account_id, actor_character_id,
                   intent_name, intent_schema_version, payload_fingerprint,
                   original_correlation_id, received_at_utc, execution_token,
                   canonical_payload, execution_owner, execution_lease_expires_at_utc,
                   terminal_status, terminal_reason, completed_at_utc
            FROM nexis_v2.command_receipts
            WHERE terminal_status IS NULL
              AND canonical_payload IS NOT NULL
              AND execution_lease_expires_at_utc <= @now_utc
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
            await RotateFenceAsync(
                connection,
                transaction,
                row.CommandId,
                row.ExecutionToken,
                newToken,
                replacementLease.WorkerId,
                newExpiry,
                cancellationToken).ConfigureAwait(false);

            recovered.Add(BuildRecovered(row, newToken, replacementLease.WorkerId, newExpiry));
        }

        await transaction.CommitAsync(cancellationToken).ConfigureAwait(false);
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
              AND canonical_payload IS NOT NULL;
            """;

        await using var connection = await _dataSource.OpenConnectionAsync(cancellationToken).ConfigureAwait(false);
        await using var command = new NpgsqlCommand(sql, connection);
        command.Parameters.AddWithValue("new_expiry_utc", NpgsqlDbType.TimestampTz, newExpiry.UtcDateTime);
        command.Parameters.AddWithValue("command_id", NpgsqlDbType.Uuid, commandId.Value);
        command.Parameters.AddWithValue("execution_token", NpgsqlDbType.Uuid, executionToken.Value);
        command.Parameters.AddWithValue("execution_owner", NpgsqlDbType.Text, currentLease.WorkerId);
        return await command.ExecuteNonQueryAsync(cancellationToken).ConfigureAwait(false) == 1;
    }

    private static async ValueTask<StoredRecoveryRow?> ReadForUpdateAsync(
        NpgsqlConnection connection,
        NpgsqlTransaction transaction,
        CommandId commandId,
        CancellationToken cancellationToken)
    {
        const string sql = """
            SELECT command_id, lane, actor_account_id, actor_character_id,
                   intent_name, intent_schema_version, payload_fingerprint,
                   original_correlation_id, received_at_utc, execution_token,
                   canonical_payload, execution_owner, execution_lease_expires_at_utc,
                   terminal_status, terminal_reason, completed_at_utc
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
            reader.GetString(4),
            reader.GetInt32(5),
            reader.GetString(6).TrimEnd(),
            reader.GetGuid(7),
            ToDateTimeOffset(reader.GetDateTime(8)),
            reader.GetGuid(9),
            reader.IsDBNull(10) ? null : reader.GetString(10),
            reader.IsDBNull(11) ? null : reader.GetString(11),
            reader.IsDBNull(12) ? null : ToDateTimeOffset(reader.GetDateTime(12)),
            reader.IsDBNull(13) ? null : reader.GetInt32(13),
            reader.IsDBNull(14) ? null : reader.GetString(14),
            reader.IsDBNull(15) ? null : ToDateTimeOffset(reader.GetDateTime(15)));

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

        return new RecoveredCommandExecution(
            new CommandId(row.CommandId),
            lane,
            accountId,
            characterId,
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
            row.IntentName,
            row.IntentSchemaVersion,
            row.PayloadFingerprint,
            row.OriginalCorrelationId,
            row.TerminalStatus,
            row.TerminalReason,
            row.CompletedAtUtc);
        return PostgresCommandReceiptRepository.BuildTerminalOutcome(receipt);
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
              AND terminal_status IS NULL;
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
        DateTimeOffset? CompletedAtUtc);
}
