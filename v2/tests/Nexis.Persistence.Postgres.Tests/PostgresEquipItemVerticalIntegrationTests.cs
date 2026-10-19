using Microsoft.VisualStudio.TestTools.UnitTesting;
using Nexis.Combat.Contracts;
using Nexis.Content.Contracts;
using Nexis.Content.Registry;
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

[TestClass]
[DoNotParallelize]
public sealed class PostgresEquipItemVerticalIntegrationTests
{
    private static readonly EquipmentSlotKey MainHand = new("main-hand");
    private static readonly EquipmentSlotKey OffHand = new("off-hand");
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
            DROP TRIGGER IF EXISTS record_equipment_state_write ON nexis_v2.equipment_state;
            DROP TRIGGER IF EXISTS record_equipment_binding_write ON nexis_v2.equipment_bindings;
            DROP TRIGGER IF EXISTS record_equipment_slot_write ON nexis_v2.equipment_binding_slots;
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
    public async Task EquipItem_EndToEnd_CommitsRealEquipmentOwnerHistoryAndOutbox()
    {
        var characterId = CharacterId.New();
        var itemId = ItemInstanceId.New();
        await SeedEquipmentStateAsync(characterId, revision: 1);

        var definition = SwordDefinition("iron-sword", "main-hand", MainHand);
        await SeedInventoryStateAsync(characterId, itemId, new ContentDefinitionKey(definition.Contract, definition.DefinitionId), revision: 1);
        var request = await BuildRequestAsync(characterId, itemId, definition, new EquipmentPlacementKey("main-hand"));
        var engine = new CoreRulesEngine();
        var decision = engine.Evaluate(request);

        Assert.AreEqual(CoreOutcomeStatus.Succeeded, decision.Status);
        Assert.AreEqual(2, decision.Transitions.Count);
        CollectionAssert.AreEquivalent(
            new[] { InventorySnapshot.OwnerKey, EquipmentSnapshot.OwnerKey },
            decision.Transitions.Select(static transition => transition.TargetOwner).ToArray());

        var codec = new EquipItemCanonicalCommandCodec();
        var payload = codec.Serialize(request.Intent);
        var receiptRepository = new PostgresCommandReceiptRepository(DataSource);
        var claim = await receiptRepository.TryAcquireAsync(new CommandReceiptAcquireRequest(
            CommandExecutionIdentityFactory.Create(request, payload),
            payload,
            request.Context.CorrelationId,
            Utc(10, 0),
            new CommandExecutionLeaseRequest("equip-integration", TimeSpan.FromMinutes(1))));
        Assert.AreEqual(CommandReceiptDisposition.Acquired, claim.Disposition);

        var plan = new CommandCommitPlanBuilder().Build(
            request,
            payload.Fingerprint,
            claim,
            decision,
            engine.Descriptor,
            Utc(10, 0, 1));
        var committer = new PostgresAtomicCommandCommitter(
            DataSource,
            new IPostgresOwnerTransitionApplier[]
            {
                new PostgresEquipmentTransitionApplier(),
                new PostgresInventoryTransitionApplier()
            });

        var commit = await committer.CommitAsync(plan);

        Assert.AreEqual(CommandCommitDisposition.Committed, commit.Disposition);
        var persisted = await new PostgresEquipmentSnapshotReader(DataSource).ReadAsync(characterId);
        Assert.AreEqual(2L, persisted.Revision);
        Assert.AreEqual(1, persisted.Bindings.Count);
        Assert.AreEqual(itemId, persisted.Bindings[0].ItemInstanceId);
        Assert.AreEqual("main-hand", persisted.Bindings[0].PlacementKey.Value);
        CollectionAssert.AreEquivalent(new[] { MainHand }, persisted.Bindings[0].OccupiedSlots.ToArray());
        Assert.AreEqual(1, await ScalarIntAsync("SELECT count(*) FROM nexis_v2.authoritative_events;"));
        Assert.AreEqual(1, await ScalarIntAsync("SELECT count(*) FROM nexis_v2.outbox;"));
        Assert.AreEqual((int)CommandTerminalStatus.Succeeded, await ReadTerminalStatusAsync(request.Context.CommandId));

        var inventoryAfterEquip = await new PostgresInventorySnapshotReader(DataSource).ReadAsync(characterId);
        Assert.AreEqual(EquipmentSnapshot.OwnerKey, inventoryAfterEquip.FindReservation(itemId)?.HoldingOwner);
        Assert.AreEqual(1, inventoryAfterEquip.Items.Count, "Equipping must not remove the item from Inventory.");

        var duplicate = await receiptRepository.TryAcquireAsync(new CommandReceiptAcquireRequest(
            CommandExecutionIdentityFactory.Create(request, payload),
            payload,
            CorrelationId.New(),
            Utc(10, 0, 2),
            new CommandExecutionLeaseRequest("duplicate", TimeSpan.FromMinutes(1))));
        Assert.AreEqual(CommandReceiptDisposition.DuplicateCompleted, duplicate.Disposition);
        Assert.AreEqual(CommandTerminalStatus.Succeeded, duplicate.TerminalOutcome?.Status);
    }

    [TestMethod]
    public async Task EquipItem_StaleEquipmentRevision_RollsBackRealOwnerAndCommandEffects()
    {
        var characterId = CharacterId.New();
        var itemId = ItemInstanceId.New();
        await SeedEquipmentStateAsync(characterId, revision: 1);
        var definition = SwordDefinition("iron-sword", "main-hand", MainHand);
        await SeedInventoryStateAsync(characterId, itemId, new ContentDefinitionKey(definition.Contract, definition.DefinitionId), revision: 1);
        var request = await BuildRequestAsync(characterId, itemId, definition, new EquipmentPlacementKey("main-hand"));
        var engine = new CoreRulesEngine();
        var decision = engine.Evaluate(request);
        Assert.AreEqual(CoreOutcomeStatus.Succeeded, decision.Status);

        var codec = new EquipItemCanonicalCommandCodec();
        var payload = codec.Serialize(request.Intent);
        var receiptRepository = new PostgresCommandReceiptRepository(DataSource);
        var claim = await receiptRepository.TryAcquireAsync(new CommandReceiptAcquireRequest(
            CommandExecutionIdentityFactory.Create(request, payload),
            payload,
            request.Context.CorrelationId,
            Utc(10, 0),
            new CommandExecutionLeaseRequest("equip-conflict", TimeSpan.FromMinutes(1))));
        Assert.AreEqual(CommandReceiptDisposition.Acquired, claim.Disposition);

        // Another Equipment-owner command commits after Core read revision 1 but before this commit.
        await ExecuteAsync(
            "UPDATE nexis_v2.equipment_state SET revision = revision + 1 WHERE character_id = @character_id;",
            characterId);

        var plan = new CommandCommitPlanBuilder().Build(
            request,
            payload.Fingerprint,
            claim,
            decision,
            engine.Descriptor,
            Utc(10, 0, 1));
        var commit = await new PostgresAtomicCommandCommitter(
            DataSource,
            new IPostgresOwnerTransitionApplier[]
            {
                new PostgresEquipmentTransitionApplier(),
                new PostgresInventoryTransitionApplier()
            })
            .CommitAsync(plan);

        Assert.AreEqual(CommandCommitDisposition.ConcurrencyConflict, commit.Disposition);
        Assert.AreEqual("equipment.revision_conflict", commit.Reason?.Value);
        var persisted = await new PostgresEquipmentSnapshotReader(DataSource).ReadAsync(characterId);
        Assert.AreEqual(2L, persisted.Revision);
        Assert.AreEqual(0, persisted.Bindings.Count);
        Assert.AreEqual(0, await ScalarIntAsync("SELECT count(*) FROM nexis_v2.authoritative_events;"));
        Assert.AreEqual(0, await ScalarIntAsync("SELECT count(*) FROM nexis_v2.outbox;"));
        Assert.AreEqual(
            0,
            await ScalarIntAsync("SELECT count(*) FROM nexis_v2.inventory_item_reservations;"),
            "A rolled-back equip must not leave an orphaned Inventory reservation.");
        Assert.IsNull(await ReadTerminalStatusAsync(request.Context.CommandId));
    }

    [TestMethod]
    public async Task EquipItem_MultiSlotPlacement_PersistsOneBindingAcrossAllOccupiedSlots()
    {
        var characterId = CharacterId.New();
        var itemId = ItemInstanceId.New();
        await SeedEquipmentStateAsync(characterId, revision: 4);
        var definition = new EquippableItemDefinition(
            new ContentDefinitionId("greatsword"),
            new[]
            {
                new EquipmentPlacementDefinition(
                    new EquipmentPlacementKey("two-hand"),
                    new[] { MainHand, OffHand })
            });
        await SeedInventoryStateAsync(characterId, itemId, new ContentDefinitionKey(definition.Contract, definition.DefinitionId), revision: 1);
        var request = await BuildRequestAsync(characterId, itemId, definition, new EquipmentPlacementKey("two-hand"));
        var engine = new CoreRulesEngine();
        var decision = engine.Evaluate(request);
        Assert.AreEqual(CoreOutcomeStatus.Succeeded, decision.Status);

        var payload = new EquipItemCanonicalCommandCodec().Serialize(request.Intent);
        var receiptRepository = new PostgresCommandReceiptRepository(DataSource);
        var claim = await receiptRepository.TryAcquireAsync(new CommandReceiptAcquireRequest(
            CommandExecutionIdentityFactory.Create(request, payload),
            payload,
            request.Context.CorrelationId,
            Utc(10, 0),
            new CommandExecutionLeaseRequest("two-hand", TimeSpan.FromMinutes(1))));
        var plan = new CommandCommitPlanBuilder().Build(
            request,
            payload.Fingerprint,
            claim,
            decision,
            engine.Descriptor,
            Utc(10, 0, 1));

        var commit = await new PostgresAtomicCommandCommitter(
            DataSource,
            new IPostgresOwnerTransitionApplier[]
            {
                new PostgresEquipmentTransitionApplier(),
                new PostgresInventoryTransitionApplier()
            })
            .CommitAsync(plan);

        Assert.AreEqual(CommandCommitDisposition.Committed, commit.Disposition);
        var persisted = await new PostgresEquipmentSnapshotReader(DataSource).ReadAsync(characterId);
        Assert.AreEqual(5L, persisted.Revision);
        Assert.AreEqual(1, persisted.Bindings.Count);
        CollectionAssert.AreEquivalent(
            new[] { MainHand, OffHand },
            persisted.Bindings[0].OccupiedSlots.ToArray());
        Assert.AreEqual(2, await ScalarIntAsync(
            "SELECT count(*) FROM nexis_v2.equipment_binding_slots;"));
    }
    [TestMethod]
    public async Task EquipmentDeclaredLockKeys_MatchActualSqlWriteAcquisitionOrder()
    {
        const string guardSql = """
            CREATE SCHEMA IF NOT EXISTS nexis_v2_test;
            CREATE TABLE IF NOT EXISTS nexis_v2_test.equipment_write_order (
                sequence bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
                owner_key text NOT NULL,
                resource_type text NOT NULL,
                resource_id text NOT NULL
            );
            TRUNCATE TABLE nexis_v2_test.equipment_write_order RESTART IDENTITY;

            CREATE OR REPLACE FUNCTION nexis_v2_test.record_equipment_write()
            RETURNS trigger
            LANGUAGE plpgsql
            AS $$
            BEGIN
                IF TG_TABLE_NAME = 'equipment_state' THEN
                    INSERT INTO nexis_v2_test.equipment_write_order(owner_key, resource_type, resource_id)
                    VALUES ('Equipment', 'equipment.aggregate', NEW.character_id::text);
                ELSIF TG_TABLE_NAME = 'equipment_bindings' THEN
                    INSERT INTO nexis_v2_test.equipment_write_order(owner_key, resource_type, resource_id)
                    VALUES ('Equipment', 'equipment.binding', NEW.character_id::text || '/' || NEW.item_instance_id::text);
                ELSIF TG_TABLE_NAME = 'equipment_binding_slots' THEN
                    INSERT INTO nexis_v2_test.equipment_write_order(owner_key, resource_type, resource_id)
                    VALUES ('Equipment', 'equipment.slot', NEW.character_id::text || '/' || NEW.slot_key);
                ELSE
                    RAISE EXCEPTION 'Unexpected Equipment table %', TG_TABLE_NAME;
                END IF;
                RETURN NEW;
            END;
            $$;

            DROP TRIGGER IF EXISTS record_equipment_state_write ON nexis_v2.equipment_state;
            DROP TRIGGER IF EXISTS record_equipment_binding_write ON nexis_v2.equipment_bindings;
            DROP TRIGGER IF EXISTS record_equipment_slot_write ON nexis_v2.equipment_binding_slots;
            CREATE TRIGGER record_equipment_state_write
                AFTER UPDATE ON nexis_v2.equipment_state
                FOR EACH ROW EXECUTE FUNCTION nexis_v2_test.record_equipment_write();
            CREATE TRIGGER record_equipment_binding_write
                AFTER INSERT ON nexis_v2.equipment_bindings
                FOR EACH ROW EXECUTE FUNCTION nexis_v2_test.record_equipment_write();
            CREATE TRIGGER record_equipment_slot_write
                AFTER INSERT ON nexis_v2.equipment_binding_slots
                FOR EACH ROW EXECUTE FUNCTION nexis_v2_test.record_equipment_write();
            """;

        await using (var connection = await DataSource.OpenConnectionAsync())
        await using (var command = new NpgsqlCommand(guardSql, connection))
        {
            await command.ExecuteNonQueryAsync();
        }

        var characterId = CharacterId.New();
        var itemId = ItemInstanceId.New();
        await SeedEquipmentStateAsync(characterId, revision: 1);
        var definition = new EquippableItemDefinition(
            new ContentDefinitionId("lock-order-greatsword"),
            new[]
            {
                new EquipmentPlacementDefinition(
                    new EquipmentPlacementKey("two-hand"),
                    new[] { MainHand, OffHand })
            });
        await SeedInventoryStateAsync(characterId, itemId, new ContentDefinitionKey(definition.Contract, definition.DefinitionId), revision: 1);
        var request = await BuildRequestAsync(
            characterId,
            itemId,
            definition,
            new EquipmentPlacementKey("two-hand"));
        var engine = new CoreRulesEngine();
        var decision = engine.Evaluate(request);
        var transition = decision.Transitions.OfType<EquipItemTransition>().Single();
        var applier = new PostgresEquipmentTransitionApplier();
        var declared = applier.ResolveLockKeys(transition)
            .Select(static key => key.ToString())
            .ToArray();

        var payload = new EquipItemCanonicalCommandCodec().Serialize(request.Intent);
        var claim = await new PostgresCommandReceiptRepository(DataSource).TryAcquireAsync(
            new CommandReceiptAcquireRequest(
                CommandExecutionIdentityFactory.Create(request, payload),
                payload,
                request.Context.CorrelationId,
                Utc(10, 0),
                new CommandExecutionLeaseRequest("equipment-lock-order", TimeSpan.FromMinutes(1))));
        var plan = new CommandCommitPlanBuilder().Build(
            request,
            payload.Fingerprint,
            claim,
            decision,
            engine.Descriptor,
            Utc(10, 0, 1));

        var result = await new PostgresAtomicCommandCommitter(
            DataSource,
            new IPostgresOwnerTransitionApplier[] { applier, new PostgresInventoryTransitionApplier() })
            .CommitAsync(plan);
        Assert.AreEqual(CommandCommitDisposition.Committed, result.Disposition);

        var observed = new List<string>();
        await using (var connection = await DataSource.OpenConnectionAsync())
        await using (var command = new NpgsqlCommand(
            """
            SELECT owner_key || '/' || resource_type || '/' || resource_id
            FROM nexis_v2_test.equipment_write_order
            ORDER BY sequence;
            """,
            connection))
        await using (var reader = await command.ExecuteReaderAsync())
        {
            while (await reader.ReadAsync())
            {
                observed.Add(reader.GetString(0));
            }
        }

        CollectionAssert.AreEqual(
            declared,
            observed,
            "Equipment ResolveLockKeys must describe the real SQL write acquisition sequence exactly.");
    }


    private static async Task<CoreEvaluationRequest> BuildRequestAsync(
        CharacterId characterId,
        ItemInstanceId itemId,
        EquippableItemDefinition definition,
        EquipmentPlacementKey placement)
    {
        var contentVersion = new ContentVersion("equipment-proof-v1");
        var definitionKey = new ContentDefinitionKey(definition.Contract, definition.DefinitionId);
        var registry = new ImmutableContentRegistry(new[]
        {
            new ContentRegistryEntry(contentVersion, definition)
        });
        var resolved = await registry.ResolveAsync(new ContentResolutionRequest(
            contentVersion,
            new[] { definitionKey }));
        var equipment = await new PostgresEquipmentSnapshotReader(DataSource).ReadAsync(characterId);

        return new CoreEvaluationRequest(
            CoreContractVersion.V1,
            new CoreEvaluationContext(
                CommandId.New(),
                CorrelationId.New(),
                TrustedActorContext.CreatePlayer(AccountId.New(), characterId, 1),
                Utc(10, 0),
                new RuleVersion("equipment-proof-rules-v1"),
                contentVersion,
                new FixedRandomFactory()),
            new EquipItemIntent(characterId, itemId, placement),
            new IAuthoritativeSnapshot[]
            {
                await new PostgresInventorySnapshotReader(DataSource).ReadAsync(characterId),
                equipment,
                new CombatParticipationSnapshot(characterId, 1, false)
            },
            resolved.AsCoreInputs());
    }

    private static EquippableItemDefinition SwordDefinition(
        string definitionId,
        string placement,
        EquipmentSlotKey slot) =>
        new(
            new ContentDefinitionId(definitionId),
            new[]
            {
                new EquipmentPlacementDefinition(
                    new EquipmentPlacementKey(placement),
                    new[] { slot })
            });

    private static async Task SeedInventoryStateAsync(
        CharacterId characterId,
        ItemInstanceId itemId,
        ContentDefinitionKey definitionKey,
        long revision)
    {
        await using var connection = await DataSource.OpenConnectionAsync();
        await using (var state = new NpgsqlCommand(
            "INSERT INTO nexis_v2.inventory_state(character_id, revision) VALUES (@c, @r);", connection))
        {
            state.Parameters.AddWithValue("c", NpgsqlDbType.Uuid, characterId.Value);
            state.Parameters.AddWithValue("r", NpgsqlDbType.Bigint, revision);
            await state.ExecuteNonQueryAsync();
        }

        await using var item = new NpgsqlCommand(
            """
            INSERT INTO nexis_v2.inventory_items(
                character_id, item_instance_id, definition_contract_name,
                definition_schema_version, definition_id)
            VALUES (@c, @i, @n, @v, @d);
            """,
            connection);
        item.Parameters.AddWithValue("c", NpgsqlDbType.Uuid, characterId.Value);
        item.Parameters.AddWithValue("i", NpgsqlDbType.Uuid, itemId.Value);
        item.Parameters.AddWithValue("n", NpgsqlDbType.Text, definitionKey.Contract.Name);
        item.Parameters.AddWithValue("v", NpgsqlDbType.Integer, definitionKey.Contract.SchemaVersion);
        item.Parameters.AddWithValue("d", NpgsqlDbType.Text, definitionKey.DefinitionId.Value);
        await item.ExecuteNonQueryAsync();
    }

    private static async Task SeedEquipmentStateAsync(CharacterId characterId, long revision)
    {
        await using var connection = await DataSource.OpenConnectionAsync();
        await using var command = new NpgsqlCommand(
            "INSERT INTO nexis_v2.equipment_state(character_id, revision) VALUES (@character_id, @revision);",
            connection);
        command.Parameters.AddWithValue("character_id", NpgsqlDbType.Uuid, characterId.Value);
        command.Parameters.AddWithValue("revision", NpgsqlDbType.Bigint, revision);
        await command.ExecuteNonQueryAsync();
    }

    private static async Task ExecuteAsync(string sql, CharacterId characterId)
    {
        await using var connection = await DataSource.OpenConnectionAsync();
        await using var command = new NpgsqlCommand(sql, connection);
        command.Parameters.AddWithValue("character_id", NpgsqlDbType.Uuid, characterId.Value);
        await command.ExecuteNonQueryAsync();
    }

    private static async Task<int> ScalarIntAsync(string sql)
    {
        await using var connection = await DataSource.OpenConnectionAsync();
        await using var command = new NpgsqlCommand(sql, connection);
        return Convert.ToInt32(await command.ExecuteScalarAsync());
    }

    private static async Task<int?> ReadTerminalStatusAsync(CommandId commandId)
    {
        await using var connection = await DataSource.OpenConnectionAsync();
        await using var command = new NpgsqlCommand(
            "SELECT terminal_status FROM nexis_v2.command_receipts WHERE command_id = @command_id;",
            connection);
        command.Parameters.AddWithValue("command_id", NpgsqlDbType.Uuid, commandId.Value);
        var value = await command.ExecuteScalarAsync();
        return value is null or DBNull ? null : Convert.ToInt32(value);
    }

    private static DateTimeOffset Utc(int hour, int minute, int second = 0) =>
        new(2026, 8, 26, hour, minute, second, TimeSpan.Zero);

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
