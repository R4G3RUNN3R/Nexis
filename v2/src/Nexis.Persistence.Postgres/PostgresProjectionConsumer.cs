using Nexis.Core.Contracts;
using Nexis.Eventing.Contracts;
using Npgsql;
using NpgsqlTypes;

namespace Nexis.Persistence.Postgres;

public interface IPostgresProjectionEventConsumer
{
    string ConsumerName { get; }

    bool Handles(ContractDescriptor contract);

    /// <summary>
    /// Apply only non-authoritative projection/read-model side effects using the supplied transaction.
    /// Gameplay owner state must never be mutated here; gameplay reactions issue a normal System command.
    /// </summary>
    ValueTask ApplyAsync(
        NpgsqlConnection connection,
        NpgsqlTransaction transaction,
        CommittedEventMessage message,
        CancellationToken cancellationToken = default);
}

public enum ProjectionConsumeDisposition
{
    Applied = 0,
    AlreadyProcessed = 1,
    Ignored = 2
}

/// <summary>
/// Executes one PostgreSQL projection consumer so its side effect and (consumer, EventId)
/// checkpoint commit in the same database transaction. Concurrent duplicate delivery therefore
/// produces at most one committed projection side effect for this executor/consumer pair.
/// </summary>
public sealed class PostgresProjectionConsumerExecutor
{
    private readonly NpgsqlDataSource _dataSource;
    private readonly TimeProvider _timeProvider;

    public PostgresProjectionConsumerExecutor(
        NpgsqlDataSource dataSource,
        TimeProvider? timeProvider = null)
    {
        _dataSource = dataSource ?? throw new ArgumentNullException(nameof(dataSource));
        _timeProvider = timeProvider ?? TimeProvider.System;
    }

    public async ValueTask<ProjectionConsumeDisposition> ConsumeAsync(
        IPostgresProjectionEventConsumer consumer,
        CommittedEventMessage message,
        CancellationToken cancellationToken = default)
    {
        ArgumentNullException.ThrowIfNull(consumer);
        ArgumentNullException.ThrowIfNull(message);
        ArgumentException.ThrowIfNullOrWhiteSpace(consumer.ConsumerName);

        if (!consumer.Handles(message.Contract))
        {
            return ProjectionConsumeDisposition.Ignored;
        }

        await using var connection = await _dataSource.OpenConnectionAsync(cancellationToken).ConfigureAwait(false);
        await using var transaction = await connection.BeginTransactionAsync(cancellationToken).ConfigureAwait(false);

        const string checkpointSql = """
            INSERT INTO nexis_v2.event_consumer_checkpoints (
                consumer_name, event_id, processed_at_utc)
            VALUES (@consumer_name, @event_id, @processed_at_utc)
            ON CONFLICT (consumer_name, event_id) DO NOTHING;
            """;

        await using (var checkpoint = new NpgsqlCommand(checkpointSql, connection, transaction))
        {
            checkpoint.Parameters.AddWithValue("consumer_name", NpgsqlDbType.Text, consumer.ConsumerName);
            checkpoint.Parameters.AddWithValue("event_id", NpgsqlDbType.Uuid, message.EventId.Value);
            checkpoint.Parameters.AddWithValue("processed_at_utc", NpgsqlDbType.TimestampTz, _timeProvider.GetUtcNow().UtcDateTime);

            if (await checkpoint.ExecuteNonQueryAsync(cancellationToken).ConfigureAwait(false) == 0)
            {
                await transaction.RollbackAsync(cancellationToken).ConfigureAwait(false);
                return ProjectionConsumeDisposition.AlreadyProcessed;
            }
        }

        await consumer.ApplyAsync(connection, transaction, message, cancellationToken).ConfigureAwait(false);
        await transaction.CommitAsync(cancellationToken).ConfigureAwait(false);
        return ProjectionConsumeDisposition.Applied;
    }
}
