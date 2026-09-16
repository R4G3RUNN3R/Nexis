using Nexis.Core.Contracts;
using Nexis.Execution;
using Nexis.Execution.Contracts;
using Nexis.Npcs.Contracts;
using Npgsql;
using NpgsqlTypes;

namespace Nexis.Persistence.Postgres;

/// <summary>
/// PostgreSQL write adapter for the NPC lifecycle owner. Slice 01 supports lifecycle creation only;
/// later lifecycle transitions must extend this owner through explicit typed contracts.
/// </summary>
public sealed class PostgresNpcLifecycleTransitionApplier : IPostgresOwnerTransitionApplier
{
    private static readonly CommandReasonCode AlreadyExists = new("npcs.lifecycle.already_exists");

    public OwnerKey Owner => NpcLifecycleSnapshot.OwnerKey;

    public IReadOnlyList<AuthoritativeResourceKey> ResolveLockKeys(IOwnerTransition transition)
    {
        var create = RequireCreate(transition);
        return
        [
            new AuthoritativeResourceKey(
                Owner,
                "npc.lifecycle",
                create.NpcId.Value.ToString("D"))
        ];
    }

    public async ValueTask<PostgresOwnerTransitionResult> ApplyAsync(
        NpgsqlConnection connection,
        NpgsqlTransaction transaction,
        IOwnerTransition transition,
        CancellationToken cancellationToken = default)
    {
        ArgumentNullException.ThrowIfNull(connection);
        ArgumentNullException.ThrowIfNull(transaction);
        var create = RequireCreate(transition);

        if (create.ExpectedRevision is not null)
        {
            throw new InvalidOperationException("NPC lifecycle creation must not carry a prior revision.");
        }

        const string sql = """
            INSERT INTO nexis_v2.npc_lifecycle_state (
                npc_id, revision, birth_instant_utc, lifecycle_status)
            VALUES (@npc_id, 1, @birth_instant_utc, @lifecycle_status)
            ON CONFLICT (npc_id) DO NOTHING;
            """;

        await using var command = new NpgsqlCommand(sql, connection, transaction);
        command.Parameters.AddWithValue("npc_id", NpgsqlDbType.Uuid, create.NpcId.Value);
        command.Parameters.AddWithValue("birth_instant_utc", NpgsqlDbType.TimestampTz, create.BirthInstantUtc.UtcDateTime);
        command.Parameters.AddWithValue("lifecycle_status", NpgsqlDbType.Smallint, (short)NpcLifecycleStatus.Living);

        return await command.ExecuteNonQueryAsync(cancellationToken).ConfigureAwait(false) == 1
            ? PostgresOwnerTransitionResult.Applied()
            : PostgresOwnerTransitionResult.ConcurrencyConflict(AlreadyExists);
    }

    private static CreateNpcLifecycleTransition RequireCreate(IOwnerTransition transition)
    {
        ArgumentNullException.ThrowIfNull(transition);
        return transition as CreateNpcLifecycleTransition
            ?? throw new InvalidOperationException(
                $"NPC lifecycle PostgreSQL owner does not support transition '{transition.Contract.Name}' schema {transition.Contract.SchemaVersion}.");
    }
}

/// <summary>
/// Reads the NPC lifecycle owner's authoritative state. Missing state is never fabricated as a
/// revision-zero NPC because existence itself is owned by this table.
/// </summary>
public sealed class PostgresNpcLifecycleSnapshotReader
{
    private readonly NpgsqlDataSource _dataSource;

    public PostgresNpcLifecycleSnapshotReader(NpgsqlDataSource dataSource)
    {
        _dataSource = dataSource ?? throw new ArgumentNullException(nameof(dataSource));
    }

    public async ValueTask<NpcLifecycleSnapshot> ReadAsync(
        NpcId npcId,
        CancellationToken cancellationToken = default)
    {
        if (npcId.IsEmpty)
        {
            throw new ArgumentException("NPC lifecycle reads require a non-empty NpcId.", nameof(npcId));
        }

        const string sql = """
            SELECT revision, birth_instant_utc, lifecycle_status
            FROM nexis_v2.npc_lifecycle_state
            WHERE npc_id = @npc_id;
            """;

        await using var connection = await _dataSource.OpenConnectionAsync(cancellationToken).ConfigureAwait(false);
        await using var command = new NpgsqlCommand(sql, connection);
        command.Parameters.AddWithValue("npc_id", NpgsqlDbType.Uuid, npcId.Value);
        await using var reader = await command.ExecuteReaderAsync(cancellationToken).ConfigureAwait(false);

        if (!await reader.ReadAsync(cancellationToken).ConfigureAwait(false))
        {
            throw new KeyNotFoundException($"NPC lifecycle state is not provisioned for '{npcId.Value:D}'.");
        }

        var revision = reader.GetInt64(0);
        var birthValue = reader.GetDateTime(1);
        var birth = new DateTimeOffset(
            birthValue.Kind == DateTimeKind.Utc
                ? birthValue
                : DateTime.SpecifyKind(birthValue, DateTimeKind.Utc));
        var status = (NpcLifecycleStatus)reader.GetInt16(2);

        return new NpcLifecycleSnapshot(npcId, revision, birth, status);
    }
}
