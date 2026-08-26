using Nexis.Core.Contracts;
using Nexis.Eventing.Contracts;
using Nexis.Kernel.Commands;
using Nexis.Kernel.Events;
using Npgsql;
using NpgsqlTypes;

namespace Nexis.Persistence.Postgres;

public readonly record struct OutboxLeaseToken
{
    public OutboxLeaseToken(Guid value)
    {
        if (value == Guid.Empty)
        {
            throw new ArgumentException("Outbox lease token cannot be empty.", nameof(value));
        }

        Value = value;
    }

    public Guid Value { get; }

    public bool IsEmpty => Value == Guid.Empty;

    public static OutboxLeaseToken New() => new(Guid.NewGuid());
}

public sealed record PostgresOutboxDeliveryItem
{
    public PostgresOutboxDeliveryItem(CommittedEventMessage message, int attemptCount)
    {
        Message = message ?? throw new ArgumentNullException(nameof(message));
        if (attemptCount <= 0)
        {
            throw new ArgumentOutOfRangeException(nameof(attemptCount), "Outbox attempt count must be positive after a claim.");
        }

        AttemptCount = attemptCount;
    }

    public CommittedEventMessage Message { get; }

    public int AttemptCount { get; }
}

public sealed record PostgresOutboxLease
{
    public PostgresOutboxLease(
        OutboxLeaseToken leaseToken,
        string workerId,
        DateTimeOffset expiresAtUtc,
        IEnumerable<PostgresOutboxDeliveryItem> items)
    {
        if (leaseToken.IsEmpty)
        {
            throw new ArgumentException("Outbox leases require a non-empty token.", nameof(leaseToken));
        }

        ArgumentException.ThrowIfNullOrWhiteSpace(workerId);
        if (expiresAtUtc.Offset != TimeSpan.Zero)
        {
            throw new ArgumentException("Outbox lease expiry must be UTC.", nameof(expiresAtUtc));
        }

        var frozenItems = (items ?? throw new ArgumentNullException(nameof(items))).ToArray();
        if (frozenItems.Any(static item => item is null))
        {
            throw new ArgumentException("Outbox leases cannot contain null delivery items.", nameof(items));
        }

        LeaseToken = leaseToken;
        WorkerId = workerId;
        ExpiresAtUtc = expiresAtUtc;
        Items = Array.AsReadOnly(frozenItems);
    }

    public OutboxLeaseToken LeaseToken { get; }

    public string WorkerId { get; }

    public DateTimeOffset ExpiresAtUtc { get; }

    public IReadOnlyList<PostgresOutboxDeliveryItem> Items { get; }
}

/// <summary>
/// Durable PostgreSQL outbox queue. Claims use FOR UPDATE SKIP LOCKED so independent workers can
/// consume queue-like rows without contending on the same event.
/// </summary>
public sealed class PostgresOutboxStore
{
    private readonly NpgsqlDataSource _dataSource;

    public PostgresOutboxStore(NpgsqlDataSource dataSource)
    {
        _dataSource = dataSource ?? throw new ArgumentNullException(nameof(dataSource));
    }

    public async ValueTask<PostgresOutboxLease> ClaimBatchAsync(
        string workerId,
        int maximumItems,
        DateTimeOffset nowUtc,
        TimeSpan leaseDuration,
        CancellationToken cancellationToken = default)
    {
        ArgumentException.ThrowIfNullOrWhiteSpace(workerId);
        if (maximumItems <= 0)
        {
            throw new ArgumentOutOfRangeException(nameof(maximumItems), "Outbox batch size must be positive.");
        }

        ValidateUtc(nowUtc, nameof(nowUtc));
        if (leaseDuration <= TimeSpan.Zero)
        {
            throw new ArgumentOutOfRangeException(nameof(leaseDuration), "Outbox lease duration must be positive.");
        }

        var leaseToken = OutboxLeaseToken.New();
        var expiresAtUtc = nowUtc + leaseDuration;

        const string sql = """
            WITH candidates AS (
                SELECT event_id
                FROM nexis_v2.outbox
                WHERE published_at_utc IS NULL
                  AND available_at_utc <= @now_utc
                  AND (lease_expires_at_utc IS NULL OR lease_expires_at_utc <= @now_utc)
                ORDER BY created_at_utc, event_id
                FOR UPDATE SKIP LOCKED
                LIMIT @maximum_items
            )
            UPDATE nexis_v2.outbox AS o
            SET lease_token = @lease_token,
                lease_owner = @worker_id,
                lease_expires_at_utc = @lease_expires_at_utc,
                attempt_count = o.attempt_count + 1
            FROM candidates AS c
            WHERE o.event_id = c.event_id
            RETURNING o.event_id,
                      o.command_id,
                      o.correlation_id,
                      o.occurred_at_utc,
                      o.contract_name,
                      o.contract_schema_version,
                      o.payload::text,
                      o.attempt_count;
            """;

        var items = new List<PostgresOutboxDeliveryItem>();
        await using var connection = await _dataSource.OpenConnectionAsync(cancellationToken).ConfigureAwait(false);
        await using var command = new NpgsqlCommand(sql, connection);
        command.Parameters.AddWithValue("now_utc", NpgsqlDbType.TimestampTz, nowUtc.UtcDateTime);
        command.Parameters.AddWithValue("maximum_items", NpgsqlDbType.Integer, maximumItems);
        command.Parameters.AddWithValue("lease_token", NpgsqlDbType.Uuid, leaseToken.Value);
        command.Parameters.AddWithValue("worker_id", NpgsqlDbType.Text, workerId);
        command.Parameters.AddWithValue("lease_expires_at_utc", NpgsqlDbType.TimestampTz, expiresAtUtc.UtcDateTime);

        await using var reader = await command.ExecuteReaderAsync(cancellationToken).ConfigureAwait(false);
        while (await reader.ReadAsync(cancellationToken).ConfigureAwait(false))
        {
            items.Add(new PostgresOutboxDeliveryItem(
                new CommittedEventMessage(
                    new EventId(reader.GetGuid(0)),
                    new CommandId(reader.GetGuid(1)),
                    new CorrelationId(reader.GetGuid(2)),
                    ToDateTimeOffset(reader.GetDateTime(3)),
                    new ContractDescriptor(reader.GetString(4), reader.GetInt32(5)),
                    reader.GetString(6)),
                reader.GetInt32(7)));
        }

        return new PostgresOutboxLease(leaseToken, workerId, expiresAtUtc, items);
    }

    public ValueTask<bool> RenewAsync(
        EventId eventId,
        OutboxLeaseToken leaseToken,
        string workerId,
        DateTimeOffset newExpiryUtc,
        CancellationToken cancellationToken = default) =>
        UpdateLeaseAsync(
            eventId,
            leaseToken,
            workerId,
            "lease_expires_at_utc = @timestamp_utc",
            newExpiryUtc,
            cancellationToken);

    public async ValueTask<bool> AcknowledgePublishedAsync(
        EventId eventId,
        OutboxLeaseToken leaseToken,
        string workerId,
        DateTimeOffset publishedAtUtc,
        CancellationToken cancellationToken = default)
    {
        ValidateEventAndLease(eventId, leaseToken, workerId);
        ValidateUtc(publishedAtUtc, nameof(publishedAtUtc));

        const string sql = """
            UPDATE nexis_v2.outbox
            SET published_at_utc = @published_at_utc,
                lease_token = NULL,
                lease_owner = NULL,
                lease_expires_at_utc = NULL
            WHERE event_id = @event_id
              AND published_at_utc IS NULL
              AND lease_token = @lease_token
              AND lease_owner = @worker_id;
            """;

        await using var connection = await _dataSource.OpenConnectionAsync(cancellationToken).ConfigureAwait(false);
        await using var command = new NpgsqlCommand(sql, connection);
        AddLeaseIdentity(command, eventId, leaseToken, workerId);
        command.Parameters.AddWithValue("published_at_utc", NpgsqlDbType.TimestampTz, publishedAtUtc.UtcDateTime);
        return await command.ExecuteNonQueryAsync(cancellationToken).ConfigureAwait(false) == 1;
    }

    public async ValueTask<bool> ReleaseAsync(
        EventId eventId,
        OutboxLeaseToken leaseToken,
        string workerId,
        DateTimeOffset availableAtUtc,
        CancellationToken cancellationToken = default)
    {
        ValidateEventAndLease(eventId, leaseToken, workerId);
        ValidateUtc(availableAtUtc, nameof(availableAtUtc));

        const string sql = """
            UPDATE nexis_v2.outbox
            SET available_at_utc = @available_at_utc,
                lease_token = NULL,
                lease_owner = NULL,
                lease_expires_at_utc = NULL
            WHERE event_id = @event_id
              AND published_at_utc IS NULL
              AND lease_token = @lease_token
              AND lease_owner = @worker_id;
            """;

        await using var connection = await _dataSource.OpenConnectionAsync(cancellationToken).ConfigureAwait(false);
        await using var command = new NpgsqlCommand(sql, connection);
        AddLeaseIdentity(command, eventId, leaseToken, workerId);
        command.Parameters.AddWithValue("available_at_utc", NpgsqlDbType.TimestampTz, availableAtUtc.UtcDateTime);
        return await command.ExecuteNonQueryAsync(cancellationToken).ConfigureAwait(false) == 1;
    }

    private async ValueTask<bool> UpdateLeaseAsync(
        EventId eventId,
        OutboxLeaseToken leaseToken,
        string workerId,
        string assignmentSql,
        DateTimeOffset timestampUtc,
        CancellationToken cancellationToken)
    {
        ValidateEventAndLease(eventId, leaseToken, workerId);
        ValidateUtc(timestampUtc, nameof(timestampUtc));

        var sql = $"""
            UPDATE nexis_v2.outbox
            SET {assignmentSql}
            WHERE event_id = @event_id
              AND published_at_utc IS NULL
              AND lease_token = @lease_token
              AND lease_owner = @worker_id;
            """;

        await using var connection = await _dataSource.OpenConnectionAsync(cancellationToken).ConfigureAwait(false);
        await using var command = new NpgsqlCommand(sql, connection);
        AddLeaseIdentity(command, eventId, leaseToken, workerId);
        command.Parameters.AddWithValue("timestamp_utc", NpgsqlDbType.TimestampTz, timestampUtc.UtcDateTime);
        return await command.ExecuteNonQueryAsync(cancellationToken).ConfigureAwait(false) == 1;
    }

    private static void AddLeaseIdentity(
        NpgsqlCommand command,
        EventId eventId,
        OutboxLeaseToken leaseToken,
        string workerId)
    {
        command.Parameters.AddWithValue("event_id", NpgsqlDbType.Uuid, eventId.Value);
        command.Parameters.AddWithValue("lease_token", NpgsqlDbType.Uuid, leaseToken.Value);
        command.Parameters.AddWithValue("worker_id", NpgsqlDbType.Text, workerId);
    }

    private static void ValidateEventAndLease(EventId eventId, OutboxLeaseToken leaseToken, string workerId)
    {
        if (eventId.Value == Guid.Empty)
        {
            throw new ArgumentException("EventId cannot be empty.", nameof(eventId));
        }

        if (leaseToken.IsEmpty)
        {
            throw new ArgumentException("Outbox lease token cannot be empty.", nameof(leaseToken));
        }

        ArgumentException.ThrowIfNullOrWhiteSpace(workerId);
    }

    private static void ValidateUtc(DateTimeOffset value, string parameterName)
    {
        if (value.Offset != TimeSpan.Zero)
        {
            throw new ArgumentException("Outbox timestamps must be UTC.", parameterName);
        }
    }

    private static DateTimeOffset ToDateTimeOffset(DateTime value) =>
        new(value.Kind == DateTimeKind.Utc ? value : DateTime.SpecifyKind(value, DateTimeKind.Utc));
}
