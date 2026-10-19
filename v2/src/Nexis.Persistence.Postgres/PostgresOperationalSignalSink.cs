using Nexis.Operations.Contracts;
using Npgsql;
using NpgsqlTypes;

namespace Nexis.Persistence.Postgres;

/// <summary>
/// Durable append-only storage adapter for structured operational signals. It owns no gameplay
/// state and exposes no mutation API for previously recorded signals.
/// </summary>
public sealed class PostgresOperationalSignalSink : IOperationalSignalSink
{
    private readonly NpgsqlDataSource _dataSource;

    public PostgresOperationalSignalSink(NpgsqlDataSource dataSource)
    {
        _dataSource = dataSource ?? throw new ArgumentNullException(nameof(dataSource));
    }

    public async ValueTask ReportAsync(
        OperationalSignal signal,
        CancellationToken cancellationToken = default)
    {
        ArgumentNullException.ThrowIfNull(signal);

        await using var connection = await _dataSource.OpenConnectionAsync(cancellationToken).ConfigureAwait(false);
        await using var command = new NpgsqlCommand(
            """
            INSERT INTO nexis_v2.operational_signals (
                signal_id, condition_kind, severity, component, reason, occurred_at_utc,
                command_id, correlation_id, original_correlation_id, actor_discriminator,
                event_id, attempt_count)
            VALUES (
                @signal_id, @condition_kind, @severity, @component, @reason, @occurred_at_utc,
                @command_id, @correlation_id, @original_correlation_id, @actor_discriminator,
                @event_id, @attempt_count);
            """,
            connection);

        command.Parameters.AddWithValue("signal_id", NpgsqlDbType.Uuid, Guid.NewGuid());
        command.Parameters.AddWithValue("condition_kind", NpgsqlDbType.Integer, (int)signal.Kind);
        command.Parameters.AddWithValue("severity", NpgsqlDbType.Integer, (int)signal.Severity);
        command.Parameters.AddWithValue("component", NpgsqlDbType.Text, signal.Component.Value);
        command.Parameters.AddWithValue("reason", NpgsqlDbType.Text, signal.Reason.Value);
        command.Parameters.AddWithValue("occurred_at_utc", NpgsqlDbType.TimestampTz, signal.OccurredAtUtc.UtcDateTime);
        command.Parameters.AddWithValue(
            "command_id",
            NpgsqlDbType.Uuid,
            signal.CommandId.HasValue ? signal.CommandId.Value.Value : DBNull.Value);
        command.Parameters.AddWithValue(
            "correlation_id",
            NpgsqlDbType.Uuid,
            signal.CorrelationId.HasValue ? signal.CorrelationId.Value.Value : DBNull.Value);
        command.Parameters.AddWithValue(
            "original_correlation_id",
            NpgsqlDbType.Uuid,
            signal.OriginalCorrelationId.HasValue ? signal.OriginalCorrelationId.Value.Value : DBNull.Value);
        command.Parameters.AddWithValue(
            "actor_discriminator",
            NpgsqlDbType.Char,
            signal.ActorDiscriminator is not null ? signal.ActorDiscriminator.Value : DBNull.Value);
        command.Parameters.AddWithValue(
            "event_id",
            NpgsqlDbType.Uuid,
            signal.EventId.HasValue ? signal.EventId.Value.Value : DBNull.Value);
        command.Parameters.AddWithValue(
            "attempt_count",
            NpgsqlDbType.Integer,
            signal.AttemptCount.HasValue ? signal.AttemptCount.Value : DBNull.Value);

        await command.ExecuteNonQueryAsync(cancellationToken).ConfigureAwait(false);
    }
}
