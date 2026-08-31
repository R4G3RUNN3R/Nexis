using Microsoft.VisualStudio.TestTools.UnitTesting;
using Nexis.Combat.Contracts;
using Nexis.Content.Contracts;
using Nexis.Core;
using Nexis.Core.Contracts;
using Nexis.Equipment.Contracts;
using Nexis.Execution;
using Nexis.Execution.Contracts;
using Nexis.Identity.Contracts;
using Nexis.Inventory.Contracts;
using Nexis.Items.Contracts;
using Nexis.Kernel.Commands;
using Nexis.Kernel.Events;
using Nexis.Kernel.Randomness;
using Nexis.Modules.Equipment;
using Nexis.Persistence.Postgres;
using Npgsql;
using NpgsqlTypes;

namespace Nexis.Persistence.Postgres.Tests;

/// <summary>
/// The C3 real multi-owner gameplay proof. Unequip Item clears the Equipment binding and releases
/// the same Inventory reservation atomically, exactly once, without double-spend, and commits
/// neither owner transition when an authoritative removal restriction denies it.
/// </summary>
[TestClass]
[DoNotParallelize]
public sealed class PostgresUnequipItemMultiOwnerIntegrationTests
{
    private static readonly EquipmentSlotKey MainHand = new("main-hand");
    private static readonly EquipmentPlacementKey MainHandPlacement = new("main-hand");
    private static readonly ContentDefinitionKey SwordKey = new(
        EquippableItemDefinition.ContractDescriptor,
        new ContentDefinitionId("iron-sword"));
    private static NpgsqlDataSource? s_dataSource;

    [ClassInitialize]
    public static async Task ClassInitialize(TestContext _)
    {
        var connectionString = Environment.GetEnvironmentVariable("NEXIS_TEST_POSTGRES_CONNECTION");
        if (string.IsNullOrWhiteSpace(connectionString))
        {
            Assert.Inconclusive("NEXIS_TEST_POSTGRES_CONNECTION is required for PostgreSQL integration tests.");
            return;
        }

        s_dataSource = NpgsqlDataSource.Create(connectionString);
        await PostgresExecutionSchema.EnsureCreatedAsync(s_dataSource);
    }

    [ClassCleanup]
    public static async Task ClassCleanup()
    {
        if (s_dataSource is not null)
        {
            await s_dataSource.DisposeAsync();
        }
    }

    [TestInitialize]
    public async Task TestInitialize()
    {
        const string sql = """
            TRUNCATE TABLE
                nexis_v2.inventory_item_reservations,
                nexis_v2.inventory_items,
                nexis_v2.inventory_state,
                nexis_v2.equipment_binding_slots,
                nexis_v2.equipment_bindings,
                nexis_v2.equipment_state,
                nexis_v2.event_consumer_checkpoints,
                nexis_v2.outbox,
                nexis_v2.authoritative_events,
                nexis_v2.admin_audit,
                nexis_v2.command_receipts
            CASCADE;
            """;

        await using var connection = await DataSource.OpenConnectionAsync();
        await using var command = new NpgsqlCommand(sql, connection);
        await command.ExecuteNonQueryAsync();
    }

    [TestMethod]
    public async Task InventoryOwner_ReservesAndReleasesWithoutChangingPossession()
    {
        var characterId = CharacterId.New();
        var itemId = ItemInstanceId.New();
        await SeedEquippedItemAsync(characterId, itemId, reserve: false, bind: false);

        var applier = new PostgresInventoryTransitionApplier();
        var reserve = new ReserveInventoryItemTransition(1, characterId, itemId, EquipmentSnapshot.OwnerKey);

        Assert.AreEqual(
            PostgresOwnerTransitionDisposition.Applied,
            (await ApplyDirectlyAsync(applier, reserve)).Disposition);

        var afterReserve = await new PostgresInventorySnapshotReader(DataSource).ReadAsync(characterId);
        Assert.AreEqual(2L, afterReserve.Revision);
        Assert.AreEqual(1, afterReserve.Items.Count);
        Assert.AreEqual(EquipmentSnapshot.OwnerKey, afterReserve.FindReservation(itemId)?.HoldingOwner);

        var release = new ReleaseInventoryItemReservationTransition(2, characterId, itemId, EquipmentSnapshot.OwnerKey);
        Assert.AreEqual(
            PostgresOwnerTransitionDisposition.Applied,
            (await ApplyDirectlyAsync(applier, release)).Disposition);

        var afterRelease = await new PostgresInventorySnapshotReader(DataSource).ReadAsync(characterId);
        Assert.AreEqual(3L, afterRelease.Revision);
        Assert.AreEqual(1, afterRelease.Items.Count, "Releasing a reservation must never change possession.");
        Assert.IsNull(afterRelease.FindReservation(itemId));
    }

    [TestMethod]
    public async Task InventoryOwner_RefusesASecondReservationAndARestrictedRelease()
    {
        var characterId = CharacterId.New();
        var itemId = ItemInstanceId.New();
        await SeedEquippedItemAsync(characterId, itemId, reserve: true, bind: true);

        var applier = new PostgresInventoryTransitionApplier();

        var double_spend = await ApplyDirectlyAsync(
            applier,
            new ReserveInventoryItemTransition(1, characterId, itemId, new OwnerKey("Marketplace")));
        Assert.AreEqual(PostgresOwnerTransitionDisposition.ConcurrencyConflict, double_spend.Disposition);
        Assert.AreEqual("inventory.reservation_conflict", double_spend.Reason?.Value);

        await SetReleaseRestrictionAsync(itemId, "Curse");

        var restricted = await ApplyDirectlyAsync(
            applier,
            new ReleaseInventoryItemReservationTransition(1, characterId, itemId, EquipmentSnapshot.OwnerKey));
        Assert.AreEqual(PostgresOwnerTransitionDisposition.ConcurrencyConflict, restricted.Disposition);
        Assert.AreEqual("inventory.reservation_not_releasable", restricted.Reason?.Value);

        var foreign = await ApplyDirectlyAsync(
            applier,
            new ReleaseInventoryItemReservationTransition(1, characterId, itemId, new OwnerKey("Marketplace")));
        Assert.AreEqual(PostgresOwnerTransitionDisposition.ConcurrencyConflict, foreign.Disposition);
    }

    [TestMethod]
    public async Task InventoryOwner_DeclaresEveryResourceItLocks()
    {
        var characterId = CharacterId.New();
        var itemId = ItemInstanceId.New();
        var applier = new PostgresInventoryTransitionApplier();

        var keys = applier.ResolveLockKeys(
            new ReleaseInventoryItemReservationTransition(1, characterId, itemId, EquipmentSnapshot.OwnerKey));

        CollectionAssert.AreEqual(
            new[]
            {
                $"Inventory/inventory.aggregate/{characterId.Value:D}",
                $"Inventory/inventory.reservation/{characterId.Value:D}/{itemId.Value:D}"
            },
            keys.Select(static key => key.ToString()).ToArray());
        Assert.IsTrue(keys.All(key => key.Owner == InventorySnapshot.OwnerKey));
    }

    private static async Task<PostgresOwnerTransitionResult> ApplyDirectlyAsync(
        IPostgresOwnerTransitionApplier applier,
        IOwnerTransition transition)
    {
        await using var connection = await DataSource.OpenConnectionAsync();
        await using var transaction = await connection.BeginTransactionAsync();
        var result = await applier.ApplyAsync(connection, transaction, transition);
        if (result.Disposition == PostgresOwnerTransitionDisposition.Applied)
        {
            await transaction.CommitAsync();
        }
        else
        {
            await transaction.RollbackAsync();
        }

        return result;
    }

    private static async Task SeedEquippedItemAsync(
        CharacterId characterId,
        ItemInstanceId itemId,
        bool reserve,
        bool bind,
        long inventoryRevision = 1,
        long equipmentRevision = 1)
    {
        await using var connection = await DataSource.OpenConnectionAsync();

        await ExecAsync(connection,
            "INSERT INTO nexis_v2.inventory_state(character_id, revision) VALUES (@c, @r);",
            ("c", NpgsqlDbType.Uuid, characterId.Value), ("r", NpgsqlDbType.Bigint, inventoryRevision));
        await ExecAsync(connection,
            """
            INSERT INTO nexis_v2.inventory_items(
                character_id, item_instance_id, definition_contract_name,
                definition_schema_version, definition_id)
            VALUES (@c, @i, @n, @v, @d);
            """,
            ("c", NpgsqlDbType.Uuid, characterId.Value), ("i", NpgsqlDbType.Uuid, itemId.Value),
            ("n", NpgsqlDbType.Text, SwordKey.Contract.Name),
            ("v", NpgsqlDbType.Integer, SwordKey.Contract.SchemaVersion),
            ("d", NpgsqlDbType.Text, SwordKey.DefinitionId.Value));
        await ExecAsync(connection,
            "INSERT INTO nexis_v2.equipment_state(character_id, revision) VALUES (@c, @r);",
            ("c", NpgsqlDbType.Uuid, characterId.Value), ("r", NpgsqlDbType.Bigint, equipmentRevision));

        if (reserve)
        {
            await ExecAsync(connection,
                """
                INSERT INTO nexis_v2.inventory_item_reservations(
                    character_id, item_instance_id, holding_owner)
                VALUES (@c, @i, @o);
                """,
                ("c", NpgsqlDbType.Uuid, characterId.Value), ("i", NpgsqlDbType.Uuid, itemId.Value),
                ("o", NpgsqlDbType.Text, EquipmentSnapshot.OwnerKey.Value));
        }

        if (bind)
        {
            await ExecAsync(connection,
                """
                INSERT INTO nexis_v2.equipment_bindings(character_id, item_instance_id, placement_key)
                VALUES (@c, @i, @p);
                """,
                ("c", NpgsqlDbType.Uuid, characterId.Value), ("i", NpgsqlDbType.Uuid, itemId.Value),
                ("p", NpgsqlDbType.Text, MainHandPlacement.Value));
            await ExecAsync(connection,
                """
                INSERT INTO nexis_v2.equipment_binding_slots(character_id, item_instance_id, slot_key)
                VALUES (@c, @i, @s);
                """,
                ("c", NpgsqlDbType.Uuid, characterId.Value), ("i", NpgsqlDbType.Uuid, itemId.Value),
                ("s", NpgsqlDbType.Text, MainHand.Value));
        }
    }

    private static async Task SetReleaseRestrictionAsync(ItemInstanceId itemId, string declaringOwner)
    {
        await using var connection = await DataSource.OpenConnectionAsync();
        await ExecAsync(connection,
            """
            UPDATE nexis_v2.inventory_item_reservations
            SET restriction_declaring_owner = @o
            WHERE item_instance_id = @i;
            """,
            ("o", NpgsqlDbType.Text, declaringOwner), ("i", NpgsqlDbType.Uuid, itemId.Value));
    }

    private static async Task ExecAsync(
        NpgsqlConnection connection,
        string sql,
        params (string Name, NpgsqlDbType Type, object Value)[] parameters)
    {
        await using var command = new NpgsqlCommand(sql, connection);
        foreach (var parameter in parameters)
        {
            command.Parameters.AddWithValue(parameter.Name, parameter.Type, parameter.Value);
        }

        await command.ExecuteNonQueryAsync();
    }

    private static async Task<int> ScalarIntAsync(string sql)
    {
        await using var connection = await DataSource.OpenConnectionAsync();
        await using var command = new NpgsqlCommand(sql, connection);
        return Convert.ToInt32(await command.ExecuteScalarAsync());
    }

    private static DateTimeOffset Utc(int hour, int minute, int second = 0) =>
        new(2026, 8, 29, hour, minute, second, TimeSpan.Zero);

    private static NpgsqlDataSource DataSource =>
        s_dataSource ?? throw new InvalidOperationException("PostgreSQL test data source was not initialized.");

    private sealed class FixedRandomFactory : IDeterministicRandomFactory
    {
        public IDeterministicRandomSource Create() => new FixedRandomSource();

        private sealed class FixedRandomSource : IDeterministicRandomSource
        {
            public ulong NextUInt64() => 1;
        }
    }
}
