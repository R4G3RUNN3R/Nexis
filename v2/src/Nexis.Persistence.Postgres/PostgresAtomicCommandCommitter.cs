using System.Data;
using System.Text.Json;
using Nexis.Core.Contracts;
using Nexis.Execution.Contracts;
using Npgsql;
using NpgsqlTypes;

namespace Nexis.Persistence.Postgres;

public sealed class PostgresAtomicCommandCommitter : IAtomicCommandCommitter
{
    private static readonly CommandReasonCode ReceiptMissing = new("execution.receipt.missing");
    private static readonly CommandReasonCode ReceiptOwnershipLost = new("execution.receipt.ownership_lost");
    private static readonly CommandReasonCode ReceiptAlreadyCompleted = new("execution.receipt.already_completed");
    private static readonly CommandReasonCode OwnerApplierMissing = new("execution.owner.applier_missing");
    private static readonly CommandReasonCode PersistenceFailure = new("execution.persistence.failed");

    private readonly NpgsqlDataSource _dataSource;
    private readonly IReadOnlyDictionary<OwnerKey, IPostgresOwnerTransitionApplier> _appliers;
    private readonly JsonSerializerOptions _jsonOptions;

    public PostgresAtomicCommandCommitter(
        NpgsqlDataSource dataSource,
        IEnumerable<IPostgresOwnerTransitionApplier>? ownerTransitionAppliers = null,
        JsonSerializerOptions? jsonOptions = null)
    {
        _dataSource = dataSource ?? throw new ArgumentNullException(nameof(dataSource));
        _jsonOptions = jsonOptions is null ? new JsonSerializerOptions() : new JsonSerializerOptions(jsonOptions);

        var appliers = new Dictionary<OwnerKey, IPostgresOwnerTransitionApplier>();
        foreach (var applier in ownerTransitionAppliers ?? Array.Empty<IPostgresOwnerTransitionApplier>())
        {
            if (applier is null)
            {
                throw new ArgumentException("Owner transition appliers cannot contain null entries.", nameof(ownerTransitionAppliers));
            }

            if (!appliers.TryAdd(applier.Owner, applier))
            {
                throw new ArgumentException($"Duplicate PostgreSQL transition applier for owner '{applier.Owner.Value}'.", nameof(ownerTransitionAppliers));
            }
        }

        _appliers = appliers;
    }

    public async ValueTask<CommandCommitResult> CommitAsync(
        CommandCommitPlan plan,
        CancellationToken cancellationToken = default)
    {
        ArgumentNullException.ThrowIfNull(plan);

        var serializedEvents = plan.Events
            .Select(eventEnvelope => new SerializedEvent(
                eventEnvelope,
                JsonSerializer.Serialize(
                    eventEnvelope.Descriptor,
                    eventEnvelope.Descriptor.GetType(),
                    _jsonOptions)))
            .ToArray();

        await using var connection = await _dataSource.OpenConnectionAsync(cancellationToken).ConfigureAwait(false);
        await using var transaction = await connection.BeginTransactionAsync(IsolationLevel.ReadCommitted, cancellationToken).ConfigureAwait(false);

        try
        {
            var receiptVerification = await VerifyReceiptAsync(connection, transaction, plan, cancellationToken).ConfigureAwait(false);
            if (receiptVerification is not null)
            {
                await transaction.RollbackAsync(cancellationToken).ConfigureAwait(false);
                return CommandCommitResult.TechnicalFailure(receiptVerification);
            }

            foreach (var transition in plan.Transitions)
            {
                if (!_appliers.TryGetValue(transition.TargetOwner, out var applier))
                {
                    await transaction.RollbackAsync(cancellationToken).ConfigureAwait(false);
                    return CommandCommitResult.TechnicalFailure(OwnerApplierMissing);
                }

                var applyResult = await applier.ApplyAsync(
                    connection,
                    transaction,
                    transition,
                    cancellationToken).ConfigureAwait(false);

                if (applyResult.Disposition == PostgresOwnerTransitionDisposition.ConcurrencyConflict)
                {
                    await transaction.RollbackAsync(cancellationToken).ConfigureAwait(false);
                    return CommandCommitResult.ConcurrencyConflict(
                        applyResult.Reason ?? new CommandReasonCode("execution.owner.revision_conflict"));
                }
            }

            foreach (var serializedEvent in serializedEvents)
            {
                await InsertEventAndOutboxAsync(
                    connection,
                    transaction,
                    plan,
                    serializedEvent,
                    cancellationToken).ConfigureAwait(false);
            }

            foreach (var auditEntry in plan.AuditEntries)
            {
                await PostgresAuditWriter.InsertAsync(
                    connection,
                    transaction,
                    auditEntry,
                    plan.Trace.Identity.CommandId,
                    cancellationToken).ConfigureAwait(false);
            }

            if (await CompleteReceiptAsync(connection, transaction, plan, cancellationToken).ConfigureAwait(false) != 1)
            {
                await transaction.RollbackAsync(cancellationToken).ConfigureAwait(false);
                return CommandCommitResult.TechnicalFailure(ReceiptOwnershipLost);
            }

            await transaction.CommitAsync(cancellationToken).ConfigureAwait(false);
            return CommandCommitResult.Committed();
        }
        catch (PostgresException exception) when (
            PostgresTransientCommandFailureClassifier.IsRetryableSqlState(exception.SqlState))
        {
            await SafeRollbackAsync(transaction, cancellationToken).ConfigureAwait(false);
            throw;
        }
        catch (PostgresException)
        {
            await SafeRollbackAsync(transaction, cancellationToken).ConfigureAwait(false);
            return CommandCommitResult.TechnicalFailure(PersistenceFailure);
        }
    }

    private static async ValueTask<CommandReasonCode?> VerifyReceiptAsync(
        NpgsqlConnection connection,
        NpgsqlTransaction transaction,
        CommandCommitPlan plan,
        CancellationToken cancellationToken)
    {
        const string sql = """
            SELECT lane, actor_account_id, actor_character_id,
                   intent_name, intent_schema_version, payload_fingerprint,
                   original_correlation_id, terminal_status, terminal_reason, completed_at_utc,
                   execution_token
            FROM nexis_v2.command_receipts
            WHERE command_id = @command_id
            FOR UPDATE;
            """;

        await using var command = new NpgsqlCommand(sql, connection, transaction);
        command.Parameters.AddWithValue("command_id", NpgsqlDbType.Uuid, plan.Trace.Identity.CommandId.Value);
        await using var reader = await command.ExecuteReaderAsync(CommandBehavior.SingleRow, cancellationToken).ConfigureAwait(false);

        if (!await reader.ReadAsync(cancellationToken).ConfigureAwait(false))
        {
            return ReceiptMissing;
        }

        var stored = PostgresCommandReceiptRepository.ReadReceipt(reader);
        var executionToken = reader.GetGuid(10);

        if (!PostgresCommandReceiptRepository.Matches(plan.Trace.Identity, stored) ||
            stored.OriginalCorrelationId != plan.Trace.CorrelationId.Value ||
            executionToken != plan.ExecutionToken.Value)
        {
            return ReceiptOwnershipLost;
        }

        return stored.TerminalStatus.HasValue ? ReceiptAlreadyCompleted : null;
    }

    private static async ValueTask<int> CompleteReceiptAsync(
        NpgsqlConnection connection,
        NpgsqlTransaction transaction,
        CommandCommitPlan plan,
        CancellationToken cancellationToken)
    {
        const string sql = """
            UPDATE nexis_v2.command_receipts
            SET terminal_status = @terminal_status,
                terminal_reason = @terminal_reason,
                completed_at_utc = @completed_at_utc,
                core_implementation_name = @core_implementation_name,
                core_implementation_version = @core_implementation_version,
                core_contract_version = @core_contract_version,
                rule_version = @rule_version,
                content_version = @content_version,
                evaluated_at_utc = @evaluated_at_utc
            WHERE command_id = @command_id
              AND execution_token = @execution_token
              AND terminal_status IS NULL;
            """;

        await using var command = new NpgsqlCommand(sql, connection, transaction);
        command.Parameters.AddWithValue("terminal_status", NpgsqlDbType.Integer, (int)plan.TerminalOutcome.Status);
        command.Parameters.AddWithValue(
            "terminal_reason",
            NpgsqlDbType.Text,
            (object?)plan.TerminalOutcome.Reason?.Value ?? DBNull.Value);
        command.Parameters.AddWithValue("completed_at_utc", NpgsqlDbType.TimestampTz, plan.TerminalOutcome.CompletedAtUtc.UtcDateTime);
        command.Parameters.AddWithValue("core_implementation_name", NpgsqlDbType.Text, plan.Trace.CoreImplementation.ImplementationName);
        command.Parameters.AddWithValue("core_implementation_version", NpgsqlDbType.Text, plan.Trace.CoreImplementation.ImplementationVersion);
        command.Parameters.AddWithValue("core_contract_version", NpgsqlDbType.Integer, plan.Trace.CoreContractVersion.Value);
        command.Parameters.AddWithValue("rule_version", NpgsqlDbType.Text, plan.Trace.RuleVersion.Value);
        command.Parameters.AddWithValue("content_version", NpgsqlDbType.Text, plan.Trace.ContentVersion.Value);
        command.Parameters.AddWithValue("evaluated_at_utc", NpgsqlDbType.TimestampTz, plan.Trace.EvaluatedAtUtc.UtcDateTime);
        command.Parameters.AddWithValue("command_id", NpgsqlDbType.Uuid, plan.Trace.Identity.CommandId.Value);
        command.Parameters.AddWithValue("execution_token", NpgsqlDbType.Uuid, plan.ExecutionToken.Value);
        return await command.ExecuteNonQueryAsync(cancellationToken).ConfigureAwait(false);
    }

    private static async ValueTask InsertEventAndOutboxAsync(
        NpgsqlConnection connection,
        NpgsqlTransaction transaction,
        CommandCommitPlan plan,
        SerializedEvent serializedEvent,
        CancellationToken cancellationToken)
    {
        const string eventSql = """
            INSERT INTO nexis_v2.authoritative_events (
                event_id, command_id, correlation_id, occurred_at_utc, causation_event_id,
                contract_name, contract_schema_version, payload)
            VALUES (
                @event_id, @command_id, @correlation_id, @occurred_at_utc, @causation_event_id,
                @contract_name, @contract_schema_version, @payload);
            """;

        var envelope = serializedEvent.Envelope;
        await using (var eventCommand = new NpgsqlCommand(eventSql, connection, transaction))
        {
            AddEventParameters(eventCommand, plan, envelope, serializedEvent.Json);
            await eventCommand.ExecuteNonQueryAsync(cancellationToken).ConfigureAwait(false);
        }

        const string outboxSql = """
            INSERT INTO nexis_v2.outbox (
                event_id, command_id, correlation_id, occurred_at_utc,
                contract_name, contract_schema_version, payload)
            VALUES (
                @event_id, @command_id, @correlation_id, @occurred_at_utc,
                @contract_name, @contract_schema_version, @payload);
            """;

        await using var outboxCommand = new NpgsqlCommand(outboxSql, connection, transaction);
        AddEventParameters(outboxCommand, plan, envelope, serializedEvent.Json, includeCausation: false);
        await outboxCommand.ExecuteNonQueryAsync(cancellationToken).ConfigureAwait(false);
    }

    private static void AddEventParameters(
        NpgsqlCommand command,
        CommandCommitPlan plan,
        AuthoritativeEventEnvelope envelope,
        string json,
        bool includeCausation = true)
    {
        command.Parameters.AddWithValue("event_id", NpgsqlDbType.Uuid, envelope.Metadata.EventId.Value);
        command.Parameters.AddWithValue("command_id", NpgsqlDbType.Uuid, plan.Trace.Identity.CommandId.Value);
        command.Parameters.AddWithValue("correlation_id", NpgsqlDbType.Uuid, envelope.Metadata.CorrelationId.Value);
        command.Parameters.AddWithValue("occurred_at_utc", NpgsqlDbType.TimestampTz, envelope.Metadata.OccurredAtUtc.UtcDateTime);
        if (includeCausation)
        {
            command.Parameters.AddWithValue(
                "causation_event_id",
                NpgsqlDbType.Uuid,
                envelope.Metadata.CausationId.HasValue ? envelope.Metadata.CausationId.Value.Value : DBNull.Value);
        }
        command.Parameters.AddWithValue("contract_name", NpgsqlDbType.Text, envelope.Descriptor.Contract.Name);
        command.Parameters.AddWithValue("contract_schema_version", NpgsqlDbType.Integer, envelope.Descriptor.Contract.SchemaVersion);
        command.Parameters.AddWithValue("payload", NpgsqlDbType.Jsonb, json);
    }

    private static async ValueTask SafeRollbackAsync(
        NpgsqlTransaction transaction,
        CancellationToken cancellationToken)
    {
        try
        {
            await transaction.RollbackAsync(cancellationToken).ConfigureAwait(false);
        }
        catch (NpgsqlException)
        {
            // The original PostgreSQL failure remains the meaningful result. A transport failure
            // while rolling back is not reclassified as safe-to-retry here.
        }
    }

    private sealed record SerializedEvent(AuthoritativeEventEnvelope Envelope, string Json);
}
