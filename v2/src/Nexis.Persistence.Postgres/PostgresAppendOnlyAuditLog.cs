using Nexis.Audit.Contracts;
using Npgsql;

namespace Nexis.Persistence.Postgres;

public sealed class PostgresAppendOnlyAuditLog : IAppendOnlyAuditLog
{
    private readonly NpgsqlDataSource _dataSource;

    public PostgresAppendOnlyAuditLog(NpgsqlDataSource dataSource)
    {
        _dataSource = dataSource ?? throw new ArgumentNullException(nameof(dataSource));
    }

    public async ValueTask AppendAsync(
        AuditEntry entry,
        CancellationToken cancellationToken = default)
    {
        ArgumentNullException.ThrowIfNull(entry);
        await using var connection = await _dataSource.OpenConnectionAsync(cancellationToken).ConfigureAwait(false);
        await PostgresAuditWriter.InsertAsync(connection, null, entry, null, cancellationToken).ConfigureAwait(false);
    }
}
