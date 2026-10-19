using System.Runtime.ExceptionServices;
using Nexis.Core.Contracts;
using Nexis.Eventing.Contracts;
using Nexis.Operations.Contracts;
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
    private static readonly OperationalComponentKey OperationalComponent = new("postgres.projection-consumer");
    private static readonly OperationalReasonCode SideEffectFailedReason = new("projection.side_effect_failed");
    private static readonly OperationalReasonCode CheckpointCommitFailedReason =
        new("projection.checkpoint_commit_failed");

    private readonly NpgsqlDataSource _dataSource;
    private readonly TimeProvider _timeProvider;
    private readonly IOperationalSignalSink? _operationalSignalSink;

    public PostgresProjectionConsumerExecutor(
        NpgsqlDataSource dataSource,
        TimeProvider? timeProvider = null,
        IOperationalSignalSink? operationalSignalSink = null)
    {
        _dataSource = dataSource ?? throw new ArgumentNullException(nameof(dataSource));
        _timeProvider = timeProvider ?? TimeProvider.System;
        _operationalSignalSink = operationalSignalSink;
    }

    /// <summary>
    /// Reporting is diagnostic only. A throwing or absent sink cannot commit a rolled-back
    /// projection, cannot advance the checkpoint and cannot replace the original failure.
    /// </summary>
    private async ValueTask ReportProjectionFailureBestEffortAsync(
        CommittedEventMessage message,
        OperationalReasonCode reason)
    {
        await PostgresOperationalSignalReporter.ReportBestEffortAsync(
            _operationalSignalSink,
            new OperationalSignal(
                OperationalConditionKind.ProjectionFailure,
                OperationalSeverity.Error,
                OperationalComponent,
                reason,
                _timeProvider.GetUtcNow(),
                message.CommandId,
                message.CorrelationId,
                message.EventId)).ConfigureAwait(false);
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

        var attempt = await ConsumeAuthoritativelyAsync(consumer, message, cancellationToken).ConfigureAwait(false);
        if (attempt.Failure is not null)
        {
            await ReportProjectionFailureBestEffortAsync(message, attempt.Reason).ConfigureAwait(false);
            attempt.Failure.Throw();
        }

        return attempt.Disposition;
    }

    private async ValueTask<ProjectionConsumeAttempt> ConsumeAuthoritativelyAsync(
        IPostgresProjectionEventConsumer consumer,
        CommittedEventMessage message,
        CancellationToken cancellationToken)
    {
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
                return ProjectionConsumeAttempt.Completed(ProjectionConsumeDisposition.AlreadyProcessed);
            }
        }

        var reason = SideEffectFailedReason;
        try
        {
            await consumer.ApplyAsync(connection, transaction, message, cancellationToken).ConfigureAwait(false);
            reason = CheckpointCommitFailedReason;
            await transaction.CommitAsync(cancellationToken).ConfigureAwait(false);
        }
        catch (OperationCanceledException) when (cancellationToken.IsCancellationRequested)
        {
            // Cooperative cancellation is not a projection defect. The uncommitted transaction still
            // rolls back on disposal, so the checkpoint and side effect remain absent together.
            throw;
        }
        catch (Exception exception)
        {
            var failure = ExceptionDispatchInfo.Capture(exception);
            await SafeRollbackAsync(transaction).ConfigureAwait(false);
            return ProjectionConsumeAttempt.Failed(failure, reason);
        }

        return ProjectionConsumeAttempt.Completed(ProjectionConsumeDisposition.Applied);
    }

    private static async ValueTask SafeRollbackAsync(NpgsqlTransaction transaction)
    {
        try
        {
            await transaction.RollbackAsync(CancellationToken.None).ConfigureAwait(false);
        }
        catch (Exception exception) when (exception is NpgsqlException or InvalidOperationException)
        {
            // The original projection failure remains authoritative; disposal still closes scope.
        }
    }

    private sealed record ProjectionConsumeAttempt(
        ProjectionConsumeDisposition Disposition,
        ExceptionDispatchInfo? Failure,
        OperationalReasonCode Reason)
    {
        public static ProjectionConsumeAttempt Completed(ProjectionConsumeDisposition disposition) =>
            new(disposition, null, SideEffectFailedReason);

        public static ProjectionConsumeAttempt Failed(
            ExceptionDispatchInfo failure,
            OperationalReasonCode reason) =>
            new(default, failure, reason);
    }
}
