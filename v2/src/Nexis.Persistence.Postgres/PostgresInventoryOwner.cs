using Nexis.Content.Contracts;
using Nexis.Core.Contracts;
using Nexis.Execution;
using Nexis.Execution.Contracts;
using Nexis.Identity.Contracts;
using Nexis.Inventory.Contracts;
using Nexis.Items.Contracts;
using Npgsql;
using NpgsqlTypes;

namespace Nexis.Persistence.Postgres;

/// <summary>
/// Real PostgreSQL write adapter for the Inventory owner under M-reserve. It applies only typed
/// reservation transitions. It never creates, deletes or transfers item possession, and it never
/// writes Equipment state.
/// </summary>
public sealed class PostgresInventoryTransitionApplier : IPostgresOwnerTransitionApplier
{
    private static readonly CommandReasonCode RevisionConflict = new("inventory.revision_conflict");
    private static readonly CommandReasonCode ReservationConflict = new("inventory.reservation_conflict");
    private static readonly CommandReasonCode PossessionConflict = new("inventory.possession_conflict");
    private static readonly CommandReasonCode ReservationNotReleasable = new("inventory.reservation_not_releasable");

    private const string UniqueViolation = "23505";
    private const string ForeignKeyViolation = "23503";

    public OwnerKey Owner => InventorySnapshot.OwnerKey;

    public IReadOnlyList<AuthoritativeResourceKey> ResolveLockKeys(IOwnerTransition transition)
    {
        var (characterId, itemInstanceId) = Describe(transition);
        var character = characterId.Value.ToString("D");
        var item = itemInstanceId.Value.ToString("D");

        return CanonicalResourceLockOrder.Order(new[]
        {
            new AuthoritativeResourceKey(Owner, "inventory.aggregate", character),
            new AuthoritativeResourceKey(Owner, "inventory.reservation", $"{character}/{item}")
        });
    }

    public async ValueTask<PostgresOwnerTransitionResult> ApplyAsync(
        NpgsqlConnection connection,
        NpgsqlTransaction transaction,
        IOwnerTransition transition,
        CancellationToken cancellationToken = default)
    {
        ArgumentNullException.ThrowIfNull(connection);
        ArgumentNullException.ThrowIfNull(transaction);
        ArgumentNullException.ThrowIfNull(transition);

        var (characterId, itemInstanceId) = Describe(transition);
        if (transition.ExpectedRevision is not { } expectedRevision)
        {
            throw new InvalidOperationException("Inventory transitions require an optimistic Inventory revision.");
        }

        const string revisionSql = """
            UPDATE nexis_v2.inventory_state
            SET revision = revision + 1
            WHERE character_id = @character_id
              AND revision = @expected_revision;
            """;

        await using (var revisionCommand = new NpgsqlCommand(revisionSql, connection, transaction))
        {
            revisionCommand.Parameters.AddWithValue("character_id", NpgsqlDbType.Uuid, characterId.Value);
            revisionCommand.Parameters.AddWithValue("expected_revision", NpgsqlDbType.Bigint, expectedRevision);
            if (await revisionCommand.ExecuteNonQueryAsync(cancellationToken).ConfigureAwait(false) != 1)
            {
                return PostgresOwnerTransitionResult.ConcurrencyConflict(RevisionConflict);
            }
        }

        return transition switch
        {
            ReserveInventoryItemTransition reserve =>
                await ReserveAsync(connection, transaction, reserve, cancellationToken).ConfigureAwait(false),
            ReleaseInventoryItemReservationTransition release =>
                await ReleaseAsync(connection, transaction, release, cancellationToken).ConfigureAwait(false),
            _ => throw Unsupported(transition)
        };
    }

    private static async ValueTask<PostgresOwnerTransitionResult> ReserveAsync(
        NpgsqlConnection connection,
        NpgsqlTransaction transaction,
        ReserveInventoryItemTransition reserve,
        CancellationToken cancellationToken)
    {
        const string sql = """
            INSERT INTO nexis_v2.inventory_item_reservations (
                character_id, item_instance_id, holding_owner)
            VALUES (@character_id, @item_instance_id, @holding_owner);
            """;

        await using var command = new NpgsqlCommand(sql, connection, transaction);
        command.Parameters.AddWithValue("character_id", NpgsqlDbType.Uuid, reserve.CharacterId.Value);
        command.Parameters.AddWithValue("item_instance_id", NpgsqlDbType.Uuid, reserve.ItemInstanceId.Value);
        command.Parameters.AddWithValue("holding_owner", NpgsqlDbType.Text, reserve.HoldingOwner.Value);

        try
        {
            await command.ExecuteNonQueryAsync(cancellationToken).ConfigureAwait(false);
            return PostgresOwnerTransitionResult.Applied();
        }
        catch (PostgresException exception) when (exception.SqlState == UniqueViolation)
        {
            // The item was reserved by a concurrent command between snapshot load and commit.
            // This is contention over a scarce resource, not an infrastructure fault.
            return PostgresOwnerTransitionResult.ConcurrencyConflict(ReservationConflict);
        }
        catch (PostgresException exception) when (exception.SqlState == ForeignKeyViolation)
        {
            // Possession changed under us; Core evaluated against a stale Inventory snapshot.
            return PostgresOwnerTransitionResult.ConcurrencyConflict(PossessionConflict);
        }
    }

    private static async ValueTask<PostgresOwnerTransitionResult> ReleaseAsync(
        NpgsqlConnection connection,
        NpgsqlTransaction transaction,
        ReleaseInventoryItemReservationTransition release,
        CancellationToken cancellationToken)
    {
        // The predicate is the persistence-boundary half of the removal-restriction rule: a
        // restricted reservation is not releasable even if Core were bypassed or stale.
        const string sql = """
            DELETE FROM nexis_v2.inventory_item_reservations
            WHERE character_id = @character_id
              AND item_instance_id = @item_instance_id
              AND holding_owner = @holding_owner
              AND restriction_declaring_owner IS NULL;
            """;

        await using var command = new NpgsqlCommand(sql, connection, transaction);
        command.Parameters.AddWithValue("character_id", NpgsqlDbType.Uuid, release.CharacterId.Value);
        command.Parameters.AddWithValue("item_instance_id", NpgsqlDbType.Uuid, release.ItemInstanceId.Value);
        command.Parameters.AddWithValue("holding_owner", NpgsqlDbType.Text, release.HoldingOwner.Value);

        return await command.ExecuteNonQueryAsync(cancellationToken).ConfigureAwait(false) == 1
            ? PostgresOwnerTransitionResult.Applied()
            : PostgresOwnerTransitionResult.ConcurrencyConflict(ReservationNotReleasable);
    }

    private static (CharacterId CharacterId, ItemInstanceId ItemInstanceId) Describe(IOwnerTransition transition) =>
        transition switch
        {
            ReserveInventoryItemTransition reserve => (reserve.CharacterId, reserve.ItemInstanceId),
            ReleaseInventoryItemReservationTransition release => (release.CharacterId, release.ItemInstanceId),
            _ => throw Unsupported(transition)
        };

    private static InvalidOperationException Unsupported(IOwnerTransition transition) =>
        new($"Inventory PostgreSQL owner does not support transition '{transition.Contract.Name}' schema {transition.Contract.SchemaVersion}.");
}

/// <summary>
/// Consistent reader for the Inventory owner's authoritative snapshot, including the M-reserve
/// availability answer. Missing owner state is treated as provisioning failure rather than
/// fabricated revision zero.
/// </summary>
public sealed class PostgresInventorySnapshotReader
{
    private readonly NpgsqlDataSource _dataSource;

    public PostgresInventorySnapshotReader(NpgsqlDataSource dataSource)
    {
        _dataSource = dataSource ?? throw new ArgumentNullException(nameof(dataSource));
    }

    public async ValueTask<InventorySnapshot> ReadAsync(
        CharacterId characterId,
        CancellationToken cancellationToken = default)
    {
        if (characterId.IsEmpty)
        {
            throw new ArgumentException("Inventory snapshot reads require a non-empty CharacterId.", nameof(characterId));
        }

        const string sql = """
            SELECT s.revision,
                   i.item_instance_id,
                   i.definition_contract_name,
                   i.definition_schema_version,
                   i.definition_id,
                   r.holding_owner,
                   r.restriction_declaring_owner
            FROM nexis_v2.inventory_state AS s
            LEFT JOIN nexis_v2.inventory_items AS i
              ON i.character_id = s.character_id
            LEFT JOIN nexis_v2.inventory_item_reservations AS r
              ON r.character_id = i.character_id
             AND r.item_instance_id = i.item_instance_id
            WHERE s.character_id = @character_id
            ORDER BY i.item_instance_id;
            """;

        await using var connection = await _dataSource.OpenConnectionAsync(cancellationToken).ConfigureAwait(false);
        await using var command = new NpgsqlCommand(sql, connection);
        command.Parameters.AddWithValue("character_id", NpgsqlDbType.Uuid, characterId.Value);
        await using var reader = await command.ExecuteReaderAsync(cancellationToken).ConfigureAwait(false);

        long? revision = null;
        var items = new List<InventoryItemReference>();
        var reservations = new List<InventoryItemReservation>();

        while (await reader.ReadAsync(cancellationToken).ConfigureAwait(false))
        {
            revision ??= reader.GetInt64(0);
            if (reader.IsDBNull(1))
            {
                continue;
            }

            var itemId = new ItemInstanceId(reader.GetGuid(1));
            items.Add(new InventoryItemReference(
                itemId,
                new ContentDefinitionKey(
                    new ContractDescriptor(reader.GetString(2), reader.GetInt32(3)),
                    new ContentDefinitionId(reader.GetString(4)))));

            if (!reader.IsDBNull(5))
            {
                reservations.Add(new InventoryItemReservation(
                    itemId,
                    new OwnerKey(reader.GetString(5)),
                    reader.IsDBNull(6) ? null : new ItemReleaseRestriction(new OwnerKey(reader.GetString(6)))));
            }
        }

        if (!revision.HasValue)
        {
            throw new KeyNotFoundException($"Inventory state is not provisioned for character '{characterId.Value:D}'.");
        }

        return new InventorySnapshot(characterId, revision.Value, items, reservations);
    }
}
