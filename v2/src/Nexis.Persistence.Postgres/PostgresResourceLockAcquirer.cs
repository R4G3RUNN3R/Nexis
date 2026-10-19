using System.Buffers.Binary;
using System.Security.Cryptography;
using System.Text;
using Nexis.Execution.Contracts;
using Npgsql;
using NpgsqlTypes;

namespace Nexis.Persistence.Postgres;

/// <summary>
/// Acquires transaction-scoped PostgreSQL locks for already-resolved authoritative resources.
/// The atomic committer calls this boundary once per globally ordered key before any owner
/// transition is applied.
/// </summary>
public interface IPostgresResourceLockAcquirer
{
    ValueTask AcquireAsync(
        NpgsqlConnection connection,
        NpgsqlTransaction transaction,
        AuthoritativeResourceKey resource,
        CancellationToken cancellationToken = default);
}

/// <summary>
/// Uses a stable SHA-256-derived 64-bit advisory-lock identity. Lock acquisition order is supplied
/// by <see cref="CanonicalResourceLockOrder"/>; the hash is only the PostgreSQL lock namespace.
/// </summary>
public sealed class PostgresAdvisoryResourceLockAcquirer : IPostgresResourceLockAcquirer
{
    public async ValueTask AcquireAsync(
        NpgsqlConnection connection,
        NpgsqlTransaction transaction,
        AuthoritativeResourceKey resource,
        CancellationToken cancellationToken = default)
    {
        ArgumentNullException.ThrowIfNull(connection);
        ArgumentNullException.ThrowIfNull(transaction);
        ArgumentNullException.ThrowIfNull(resource);

        const string sql = "SELECT pg_advisory_xact_lock(@lock_key);";
        await using var command = new NpgsqlCommand(sql, connection, transaction);
        command.Parameters.AddWithValue("lock_key", NpgsqlDbType.Bigint, DeriveLockKey(resource));
        await command.ExecuteNonQueryAsync(cancellationToken).ConfigureAwait(false);
    }

    public static long DeriveLockKey(AuthoritativeResourceKey resource)
    {
        ArgumentNullException.ThrowIfNull(resource);

        var owner = resource.Owner.Value;
        var type = resource.ResourceType;
        var id = resource.ResourceId;
        var identity = $"{owner.Length}:{owner}{type.Length}:{type}{id.Length}:{id}";
        var digest = SHA256.HashData(Encoding.UTF8.GetBytes(identity));
        return BinaryPrimitives.ReadInt64BigEndian(digest);
    }
}
