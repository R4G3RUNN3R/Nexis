using System.Data;
using Nexis.Execution.Contracts;
using Nexis.Kernel.Events;
using Npgsql;
using NpgsqlTypes;

namespace Nexis.Persistence.Postgres;

public sealed class PostgresCommandReceiptRepository : ICommandReceiptRepository
{
    private readonly NpgsqlDataSource _dataSource;

    public PostgresCommandReceiptRepository(NpgsqlDataSource dataSource)
    {
        _dataSource = dataSource ?? throw new ArgumentNullException(nameof(dataSource));
    }

    public async ValueTask<CommandReceiptClaim> TryAcquireAsync(
        CommandReceiptAcquireRequest request,
        CancellationToken cancellationToken = default)
    {
        ArgumentNullException.ThrowIfNull(request);
        var identity = request.Identity;
        var executionToken = CommandExecutionToken.New();

        await using var connection = await _dataSource.OpenConnectionAsync(cancellationToken).ConfigureAwait(false);

        const string insertSql = """
            INSERT INTO nexis_v2.command_receipts (
                command_id, lane, actor_account_id, actor_character_id,
                intent_name, intent_schema_version, payload_fingerprint,
                original_correlation_id, execution_token, received_at_utc,
                canonical_payload, execution_owner, execution_lease_expires_at_utc)
            VALUES (
                @command_id, @lane, @actor_account_id, @actor_character_id,
                @intent_name, @intent_schema_version, @payload_fingerprint,
                @correlation_id, @execution_token, @received_at_utc,
                @canonical_payload, @execution_owner, @execution_lease_expires_at_utc)
            ON CONFLICT (command_id) DO NOTHING;
            """;

        await using (var insert = new NpgsqlCommand(insertSql, connection))
        {
            AddIdentityParameters(insert, identity);
            insert.Parameters.AddWithValue("correlation_id", NpgsqlDbType.Uuid, request.CorrelationId.Value);
            insert.Parameters.AddWithValue("execution_token", NpgsqlDbType.Uuid, executionToken.Value);
            insert.Parameters.AddWithValue("received_at_utc", NpgsqlDbType.TimestampTz, request.ReceivedAtUtc.UtcDateTime);
            insert.Parameters.AddWithValue("canonical_payload", NpgsqlDbType.Jsonb, request.Payload.Json);
            insert.Parameters.AddWithValue("execution_owner", NpgsqlDbType.Text, request.ExecutionLease.WorkerId);
            insert.Parameters.AddWithValue("execution_lease_expires_at_utc", NpgsqlDbType.TimestampTz, request.LeaseExpiresAtUtc.UtcDateTime);

            if (await insert.ExecuteNonQueryAsync(cancellationToken).ConfigureAwait(false) == 1)
            {
                return CommandReceiptClaim.Acquired(request.CorrelationId, executionToken);
            }
        }

        const string selectSql = """
            SELECT lane, actor_account_id, actor_character_id,
                   intent_name, intent_schema_version, payload_fingerprint,
                   original_correlation_id, terminal_status, terminal_reason, completed_at_utc
            FROM nexis_v2.command_receipts
            WHERE command_id = @command_id;
            """;

        await using var select = new NpgsqlCommand(selectSql, connection);
        select.Parameters.AddWithValue("command_id", NpgsqlDbType.Uuid, identity.CommandId.Value);
        await using var result = await select.ExecuteReaderAsync(CommandBehavior.SingleRow, cancellationToken).ConfigureAwait(false);

        if (!await result.ReadAsync(cancellationToken).ConfigureAwait(false))
        {
            throw new InvalidOperationException("Command receipt disappeared after a CommandId conflict.");
        }

        var stored = ReadReceipt(result);
        if (!Matches(identity, stored))
        {
            return CommandReceiptClaim.IntegrityViolation(new CorrelationId(stored.OriginalCorrelationId));
        }

        if (!stored.TerminalStatus.HasValue)
        {
            return CommandReceiptClaim.DuplicateInProgress(new CorrelationId(stored.OriginalCorrelationId));
        }

        return CommandReceiptClaim.DuplicateCompleted(
            new CorrelationId(stored.OriginalCorrelationId),
            BuildTerminalOutcome(stored));
    }

    internal static bool Matches(CommandExecutionIdentity identity, PostgresCommandReceiptRow stored) =>
        stored.Lane == (int)identity.Actor.Lane &&
        stored.ActorAccountId == identity.Actor.AccountId?.Value &&
        stored.ActorCharacterId == identity.Actor.CharacterId?.Value &&
        string.Equals(stored.IntentName, identity.IntentContract.Name, StringComparison.Ordinal) &&
        stored.IntentSchemaVersion == identity.IntentContract.SchemaVersion &&
        string.Equals(stored.PayloadFingerprint, identity.PayloadFingerprint.Value, StringComparison.Ordinal);

    internal static PostgresCommandReceiptRow ReadReceipt(NpgsqlDataReader reader) =>
        new(
            reader.GetInt32(0),
            reader.IsDBNull(1) ? null : reader.GetGuid(1),
            reader.IsDBNull(2) ? null : reader.GetGuid(2),
            reader.GetString(3),
            reader.GetInt32(4),
            reader.GetString(5).TrimEnd(),
            reader.GetGuid(6),
            reader.IsDBNull(7) ? null : reader.GetInt32(7),
            reader.IsDBNull(8) ? null : reader.GetString(8),
            reader.IsDBNull(9) ? null : ToDateTimeOffset(reader.GetDateTime(9)));

    internal static CommandTerminalOutcome BuildTerminalOutcome(PostgresCommandReceiptRow stored)
    {
        if (!stored.TerminalStatus.HasValue || !stored.CompletedAtUtc.HasValue)
        {
            throw new InvalidOperationException("Completed command receipt is missing terminal fields.");
        }

        var status = (CommandTerminalStatus)stored.TerminalStatus.Value;
        if (!Enum.IsDefined(typeof(CommandTerminalStatus), status))
        {
            throw new InvalidOperationException("Stored command receipt contains an unknown terminal status.");
        }

        if (status == CommandTerminalStatus.Succeeded)
        {
            return CommandTerminalOutcome.Succeeded(stored.CompletedAtUtc.Value);
        }

        if (string.IsNullOrWhiteSpace(stored.TerminalReason))
        {
            throw new InvalidOperationException("Failed command receipt is missing its reason code.");
        }

        return CommandTerminalOutcome.Failed(
            status,
            new CommandReasonCode(stored.TerminalReason),
            stored.CompletedAtUtc.Value);
    }

    internal static void AddIdentityParameters(NpgsqlCommand command, CommandExecutionIdentity identity)
    {
        command.Parameters.AddWithValue("command_id", NpgsqlDbType.Uuid, identity.CommandId.Value);
        command.Parameters.AddWithValue("lane", NpgsqlDbType.Integer, (int)identity.Actor.Lane);
        command.Parameters.AddWithValue(
            "actor_account_id",
            NpgsqlDbType.Uuid,
            identity.Actor.AccountId.HasValue ? identity.Actor.AccountId.Value.Value : DBNull.Value);
        command.Parameters.AddWithValue(
            "actor_character_id",
            NpgsqlDbType.Uuid,
            identity.Actor.CharacterId.HasValue ? identity.Actor.CharacterId.Value.Value : DBNull.Value);
        command.Parameters.AddWithValue("intent_name", NpgsqlDbType.Text, identity.IntentContract.Name);
        command.Parameters.AddWithValue("intent_schema_version", NpgsqlDbType.Integer, identity.IntentContract.SchemaVersion);
        command.Parameters.AddWithValue("payload_fingerprint", NpgsqlDbType.Char, identity.PayloadFingerprint.Value);
    }

    private static DateTimeOffset ToDateTimeOffset(DateTime value) =>
        new(value.Kind == DateTimeKind.Utc ? value : DateTime.SpecifyKind(value, DateTimeKind.Utc));
}

internal sealed record PostgresCommandReceiptRow(
    int Lane,
    Guid? ActorAccountId,
    Guid? ActorCharacterId,
    string IntentName,
    int IntentSchemaVersion,
    string PayloadFingerprint,
    Guid OriginalCorrelationId,
    int? TerminalStatus,
    string? TerminalReason,
    DateTimeOffset? CompletedAtUtc);
