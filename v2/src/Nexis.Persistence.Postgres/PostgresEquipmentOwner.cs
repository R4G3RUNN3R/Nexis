using System.Data;
using Nexis.Core.Contracts;
using Nexis.Equipment.Contracts;
using Nexis.Execution.Contracts;
using Nexis.Identity.Contracts;
using Nexis.Items.Contracts;
using Npgsql;
using NpgsqlTypes;

namespace Nexis.Persistence.Postgres;

/// <summary>
/// Real PostgreSQL write adapter for the Equipment owner. It accepts only typed Equipment
/// transitions and never mutates Inventory possession or Combat state.
/// </summary>
public sealed class PostgresEquipmentTransitionApplier : IPostgresOwnerTransitionApplier
{
    private static readonly CommandReasonCode RevisionConflict = new("equipment.revision_conflict");

    public OwnerKey Owner => EquipmentSnapshot.OwnerKey;

    public async ValueTask<PostgresOwnerTransitionResult> ApplyAsync(
        NpgsqlConnection connection,
        NpgsqlTransaction transaction,
        IOwnerTransition transition,
        CancellationToken cancellationToken = default)
    {
        ArgumentNullException.ThrowIfNull(connection);
        ArgumentNullException.ThrowIfNull(transaction);
        ArgumentNullException.ThrowIfNull(transition);

        if (transition is not EquipItemTransition equip)
        {
            throw new InvalidOperationException(
                $"Equipment PostgreSQL owner does not support transition '{transition.Contract.Name}' schema {transition.Contract.SchemaVersion}.");
        }

        if (!equip.ExpectedRevision.HasValue)
        {
            throw new InvalidOperationException("Equip Item transitions require an optimistic Equipment revision.");
        }

        const string revisionSql = """
            UPDATE nexis_v2.equipment_state
            SET revision = revision + 1
            WHERE character_id = @character_id
              AND revision = @expected_revision;
            """;

        await using (var revisionCommand = new NpgsqlCommand(revisionSql, connection, transaction))
        {
            revisionCommand.Parameters.AddWithValue("character_id", NpgsqlDbType.Uuid, equip.CharacterId.Value);
            revisionCommand.Parameters.AddWithValue("expected_revision", NpgsqlDbType.Bigint, equip.ExpectedRevision.Value);
            if (await revisionCommand.ExecuteNonQueryAsync(cancellationToken).ConfigureAwait(false) != 1)
            {
                return PostgresOwnerTransitionResult.ConcurrencyConflict(RevisionConflict);
            }
        }

        const string bindingSql = """
            INSERT INTO nexis_v2.equipment_bindings (
                character_id, item_instance_id, placement_key)
            VALUES (@character_id, @item_instance_id, @placement_key);
            """;

        await using (var bindingCommand = new NpgsqlCommand(bindingSql, connection, transaction))
        {
            bindingCommand.Parameters.AddWithValue("character_id", NpgsqlDbType.Uuid, equip.CharacterId.Value);
            bindingCommand.Parameters.AddWithValue("item_instance_id", NpgsqlDbType.Uuid, equip.ItemInstanceId.Value);
            bindingCommand.Parameters.AddWithValue("placement_key", NpgsqlDbType.Text, equip.PlacementKey.Value);
            await bindingCommand.ExecuteNonQueryAsync(cancellationToken).ConfigureAwait(false);
        }

        const string slotSql = """
            INSERT INTO nexis_v2.equipment_binding_slots (
                character_id, item_instance_id, slot_key)
            VALUES (@character_id, @item_instance_id, @slot_key);
            """;

        foreach (var slot in equip.OccupiedSlots)
        {
            await using var slotCommand = new NpgsqlCommand(slotSql, connection, transaction);
            slotCommand.Parameters.AddWithValue("character_id", NpgsqlDbType.Uuid, equip.CharacterId.Value);
            slotCommand.Parameters.AddWithValue("item_instance_id", NpgsqlDbType.Uuid, equip.ItemInstanceId.Value);
            slotCommand.Parameters.AddWithValue("slot_key", NpgsqlDbType.Text, slot.Value);
            await slotCommand.ExecuteNonQueryAsync(cancellationToken).ConfigureAwait(false);
        }

        return PostgresOwnerTransitionResult.Applied();
    }
}

/// <summary>
/// Consistent single-statement reader for the Equipment owner's authoritative snapshot.
/// Missing owner state is treated as provisioning failure rather than fabricated revision zero.
/// </summary>
public sealed class PostgresEquipmentSnapshotReader
{
    private readonly NpgsqlDataSource _dataSource;

    public PostgresEquipmentSnapshotReader(NpgsqlDataSource dataSource)
    {
        _dataSource = dataSource ?? throw new ArgumentNullException(nameof(dataSource));
    }

    public async ValueTask<EquipmentSnapshot> ReadAsync(
        CharacterId characterId,
        CancellationToken cancellationToken = default)
    {
        if (characterId.IsEmpty)
        {
            throw new ArgumentException("Equipment snapshot reads require a non-empty CharacterId.", nameof(characterId));
        }

        const string sql = """
            SELECT s.revision,
                   b.item_instance_id,
                   b.placement_key,
                   bs.slot_key
            FROM nexis_v2.equipment_state AS s
            LEFT JOIN nexis_v2.equipment_bindings AS b
              ON b.character_id = s.character_id
            LEFT JOIN nexis_v2.equipment_binding_slots AS bs
              ON bs.character_id = b.character_id
             AND bs.item_instance_id = b.item_instance_id
            WHERE s.character_id = @character_id
            ORDER BY b.item_instance_id, bs.slot_key;
            """;

        await using var connection = await _dataSource.OpenConnectionAsync(cancellationToken).ConfigureAwait(false);
        await using var command = new NpgsqlCommand(sql, connection);
        command.Parameters.AddWithValue("character_id", NpgsqlDbType.Uuid, characterId.Value);
        await using var reader = await command.ExecuteReaderAsync(cancellationToken).ConfigureAwait(false);

        long? revision = null;
        var builders = new Dictionary<Guid, BindingBuilder>();
        while (await reader.ReadAsync(cancellationToken).ConfigureAwait(false))
        {
            revision ??= reader.GetInt64(0);
            if (reader.IsDBNull(1))
            {
                continue;
            }

            var itemId = reader.GetGuid(1);
            if (!builders.TryGetValue(itemId, out var builder))
            {
                builder = new BindingBuilder(
                    reader.GetString(2),
                    new List<EquipmentSlotKey>());
                builders.Add(itemId, builder);
            }

            if (!reader.IsDBNull(3))
            {
                builder.Slots.Add(new EquipmentSlotKey(reader.GetString(3)));
            }
        }

        if (!revision.HasValue)
        {
            throw new KeyNotFoundException($"Equipment state is not provisioned for character '{characterId.Value:D}'.");
        }

        var bindings = builders
            .OrderBy(static pair => pair.Key)
            .Select(pair => new EquippedItemBinding(
                new ItemInstanceId(pair.Key),
                new EquipmentPlacementKey(pair.Value.PlacementKey),
                pair.Value.Slots))
            .ToArray();

        return new EquipmentSnapshot(characterId, revision.Value, bindings);
    }

    private sealed record BindingBuilder(string PlacementKey, List<EquipmentSlotKey> Slots);
}
