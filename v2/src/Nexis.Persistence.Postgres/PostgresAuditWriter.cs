using Nexis.Audit.Contracts;
using Nexis.Kernel.Commands;
using Npgsql;
using NpgsqlTypes;

namespace Nexis.Persistence.Postgres;

internal static class PostgresAuditWriter
{
    public static async ValueTask InsertAsync(
        NpgsqlConnection connection,
        NpgsqlTransaction? transaction,
        AuditEntry entry,
        CommandId? commandId,
        CancellationToken cancellationToken)
    {
        const string sql = """
            INSERT INTO nexis_v2.admin_audit (
                audit_id, command_id, acting_account_id, target_account_id,
                action_kind, visibility, occurred_at_utc, action, outcome,
                safe_player_reason, case_reference, correlation_id, causation_event_id)
            VALUES (
                @audit_id, @command_id, @acting_account_id, @target_account_id,
                @action_kind, @visibility, @occurred_at_utc, @action, @outcome,
                @safe_player_reason, @case_reference, @correlation_id, @causation_event_id);
            """;

        await using var command = new NpgsqlCommand(sql, connection, transaction);
        command.Parameters.AddWithValue("audit_id", NpgsqlDbType.Uuid, entry.AuditId.Value);
        command.Parameters.AddWithValue(
            "command_id",
            NpgsqlDbType.Uuid,
            commandId.HasValue ? commandId.Value.Value : DBNull.Value);
        command.Parameters.AddWithValue("acting_account_id", NpgsqlDbType.Uuid, entry.ActingAccountId.Value);
        command.Parameters.AddWithValue(
            "target_account_id",
            NpgsqlDbType.Uuid,
            entry.TargetAccountId.HasValue ? entry.TargetAccountId.Value.Value : DBNull.Value);
        command.Parameters.AddWithValue("action_kind", NpgsqlDbType.Integer, (int)entry.ActionKind);
        command.Parameters.AddWithValue("visibility", NpgsqlDbType.Integer, (int)entry.Visibility);
        command.Parameters.AddWithValue("occurred_at_utc", NpgsqlDbType.TimestampTz, entry.OccurredAtUtc.UtcDateTime);
        command.Parameters.AddWithValue("action", NpgsqlDbType.Text, entry.Action);
        command.Parameters.AddWithValue("outcome", NpgsqlDbType.Text, entry.Outcome);
        command.Parameters.AddWithValue("safe_player_reason", NpgsqlDbType.Text, (object?)entry.SafePlayerReason ?? DBNull.Value);
        command.Parameters.AddWithValue("case_reference", NpgsqlDbType.Text, (object?)entry.CaseReference ?? DBNull.Value);
        command.Parameters.AddWithValue("correlation_id", NpgsqlDbType.Uuid, entry.CorrelationId.Value);
        command.Parameters.AddWithValue(
            "causation_event_id",
            NpgsqlDbType.Uuid,
            entry.CausationEventId.HasValue ? entry.CausationEventId.Value.Value : DBNull.Value);
        await command.ExecuteNonQueryAsync(cancellationToken).ConfigureAwait(false);
    }
}
