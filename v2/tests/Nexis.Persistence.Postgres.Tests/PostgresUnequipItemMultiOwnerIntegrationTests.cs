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
    [TestMethod]
    public async Task UnequipItem_CommitsEquipmentClearAndInventoryReleaseAtomically()
    {
        var characterId = CharacterId.New();
        var itemId = ItemInstanceId.New();
        await SeedEquippedItemAsync(characterId, itemId, reserve: true, bind: true);

        var commit = await ExecuteUnequipAsync(characterId, itemId, CommandId.New(), "c3-happy");

        Assert.AreEqual(CommandCommitDisposition.Committed, commit.Result.Disposition);

        var equipment = await new PostgresEquipmentSnapshotReader(DataSource).ReadAsync(characterId);
        Assert.AreEqual(2L, equipment.Revision);
        Assert.AreEqual(0, equipment.Bindings.Count, "Equipment must have cleared the equipped reference.");
        Assert.AreEqual(0, await ScalarIntAsync("SELECT count(*) FROM nexis_v2.equipment_binding_slots;"));

        var inventory = await new PostgresInventorySnapshotReader(DataSource).ReadAsync(characterId);
        Assert.AreEqual(2L, inventory.Revision);
        Assert.IsNull(inventory.FindReservation(itemId), "Inventory must have released the same reservation.");
        Assert.AreEqual(1, inventory.Items.Count, "Possession must be unchanged by unequip.");

        Assert.AreEqual(1, await ScalarIntAsync("SELECT count(*) FROM nexis_v2.authoritative_events;"));
        Assert.AreEqual(1, await ScalarIntAsync("SELECT count(*) FROM nexis_v2.outbox;"));
        Assert.AreEqual(
            1,
            await ScalarIntAsync(
                "SELECT count(*) FROM nexis_v2.authoritative_events "
                + "WHERE contract_name = 'nexis.equipment.item-unequipped';"));
    }

    [TestMethod]
    public async Task UnequipItem_StaleInventoryRevision_CommitsNeitherOwnerTransition()
    {
        var characterId = CharacterId.New();
        var itemId = ItemInstanceId.New();
        await SeedEquippedItemAsync(characterId, itemId, reserve: true, bind: true);

        var commit = await ExecuteUnequipAsync(
            characterId,
            itemId,
            CommandId.New(),
            "c3-stale-inventory",
            beforeCommit: async () => await BumpRevisionAsync("nexis_v2.inventory_state", characterId));

        Assert.AreEqual(CommandCommitDisposition.ConcurrencyConflict, commit.Result.Disposition);
        await AssertNothingCommittedAsync(characterId, itemId);
    }

    [TestMethod]
    public async Task UnequipItem_StaleEquipmentRevision_CommitsNeitherOwnerTransition()
    {
        var characterId = CharacterId.New();
        var itemId = ItemInstanceId.New();
        await SeedEquippedItemAsync(characterId, itemId, reserve: true, bind: true);

        var commit = await ExecuteUnequipAsync(
            characterId,
            itemId,
            CommandId.New(),
            "c3-stale-equipment",
            beforeCommit: async () => await BumpRevisionAsync("nexis_v2.equipment_state", characterId));

        Assert.AreEqual(CommandCommitDisposition.ConcurrencyConflict, commit.Result.Disposition);
        Assert.AreEqual("equipment.revision_conflict", commit.Result.Reason?.Value);
        Assert.AreEqual(1, await ScalarIntAsync("SELECT count(*) FROM nexis_v2.equipment_bindings;"));
        Assert.AreEqual(1, await ScalarIntAsync("SELECT count(*) FROM nexis_v2.inventory_item_reservations;"));
        Assert.AreEqual(0, await ScalarIntAsync("SELECT count(*) FROM nexis_v2.authoritative_events;"));
        Assert.AreEqual(0, await ScalarIntAsync("SELECT count(*) FROM nexis_v2.outbox;"));
    }

    [TestMethod]
    public async Task UnequipItem_RepeatedCommandId_IsExactlyOnceAndNeverReleasesTwice()
    {
        var characterId = CharacterId.New();
        var itemId = ItemInstanceId.New();
        await SeedEquippedItemAsync(characterId, itemId, reserve: true, bind: true);
        var commandId = CommandId.New();

        var first = await ExecuteUnequipAsync(characterId, itemId, commandId, "c3-idempotent-1");
        Assert.AreEqual(CommandCommitDisposition.Committed, first.Result.Disposition);

        var replay = await new PostgresCommandReceiptRepository(DataSource).TryAcquireAsync(
            new CommandReceiptAcquireRequest(
                first.Identity,
                first.Payload,
                CorrelationId.New(),
                Utc(10, 5),
                new CommandExecutionLeaseRequest("c3-idempotent-2", TimeSpan.FromMinutes(1))));

        Assert.AreEqual(CommandReceiptDisposition.DuplicateCompleted, replay.Disposition);
        Assert.AreEqual(CommandTerminalStatus.Succeeded, replay.TerminalOutcome?.Status);

        var inventory = await new PostgresInventorySnapshotReader(DataSource).ReadAsync(characterId);
        Assert.AreEqual(2L, inventory.Revision, "A retried unequip must not advance the Inventory revision again.");
        Assert.AreEqual(1, inventory.Items.Count, "A retried unequip must not duplicate the item.");
        Assert.AreEqual(1, await ScalarIntAsync("SELECT count(*) FROM nexis_v2.authoritative_events;"));
        Assert.AreEqual(1, await ScalarIntAsync("SELECT count(*) FROM nexis_v2.outbox;"));
    }

    [TestMethod]
    public async Task ConcurrentUnequips_ProduceExactlyOneReleaseAndNoDoubleSpend()
    {
        var characterId = CharacterId.New();
        var itemId = ItemInstanceId.New();
        await SeedEquippedItemAsync(characterId, itemId, reserve: true, bind: true);

        // Both commands evaluate against the same pre-unequip snapshots, as two racing clients would.
        var first = await PrepareUnequipAsync(characterId, itemId, CommandId.New(), "c3-race-a");
        var second = await PrepareUnequipAsync(characterId, itemId, CommandId.New(), "c3-race-b");

        var results = await Task.WhenAll(
            Committer().CommitAsync(first.Plan).AsTask(),
            Committer().CommitAsync(second.Plan).AsTask());

        Assert.AreEqual(
            1,
            results.Count(static result => result.Disposition == CommandCommitDisposition.Committed),
            "Exactly one concurrent unequip may win.");
        Assert.AreEqual(
            1,
            results.Count(static result => result.Disposition == CommandCommitDisposition.ConcurrencyConflict));

        var inventory = await new PostgresInventorySnapshotReader(DataSource).ReadAsync(characterId);
        Assert.AreEqual(2L, inventory.Revision);
        Assert.AreEqual(1, inventory.Items.Count, "The item must never be duplicated by a race.");
        Assert.AreEqual(0, await ScalarIntAsync("SELECT count(*) FROM nexis_v2.inventory_item_reservations;"));
        Assert.AreEqual(1, await ScalarIntAsync("SELECT count(*) FROM nexis_v2.authoritative_events;"));
    }

    [TestMethod]
    public async Task OpposingReservationAfterUnequip_CannotDoubleSpendTheItem()
    {
        var characterId = CharacterId.New();
        var itemId = ItemInstanceId.New();
        await SeedEquippedItemAsync(characterId, itemId, reserve: true, bind: true);

        // A competing owner captured the pre-unequip Inventory snapshot and tries to escrow the
        // item after the unequip has already advanced Inventory.
        var opposing = new ReserveInventoryItemTransition(1, characterId, itemId, new OwnerKey("Marketplace"));

        var unequip = await ExecuteUnequipAsync(characterId, itemId, CommandId.New(), "c3-opposing");
        Assert.AreEqual(CommandCommitDisposition.Committed, unequip.Result.Disposition);

        var stale = await ApplyDirectlyAsync(new PostgresInventoryTransitionApplier(), opposing);
        Assert.AreEqual(PostgresOwnerTransitionDisposition.ConcurrencyConflict, stale.Disposition);
        Assert.AreEqual("inventory.revision_conflict", stale.Reason?.Value);
        Assert.AreEqual(0, await ScalarIntAsync("SELECT count(*) FROM nexis_v2.inventory_item_reservations;"));
    }

    [TestMethod]
    public async Task UnequipDeniedByRemovalRestriction_CommitsNeitherOwnerTransition()
    {
        var characterId = CharacterId.New();
        var itemId = ItemInstanceId.New();
        await SeedEquippedItemAsync(characterId, itemId, reserve: true, bind: true);
        await SetReleaseRestrictionAsync(itemId, "Curse");

        // 1. Core refuses before any transition exists.
        var request = await BuildUnequipRequestAsync(characterId, itemId, CommandId.New());
        var decision = new CoreRulesEngine().Evaluate(request);
        Assert.AreEqual(CoreOutcomeStatus.Rejected, decision.Status);
        Assert.AreEqual("equipment.unequip.release_restricted", decision.Reason?.Value);
        Assert.AreEqual(0, decision.Transitions.Count);

        // 2. The persistence boundary refuses independently, so a bypassed or stale Core cannot
        //    commit the Equipment clear either. Both transitions are forced into one plan.
        var forced = await PrepareForcedReleasePlanAsync(characterId, itemId, CommandId.New(), "c3-restricted");
        var commit = await Committer().CommitAsync(forced);

        Assert.AreEqual(CommandCommitDisposition.ConcurrencyConflict, commit.Disposition);
        Assert.AreEqual("inventory.reservation_not_releasable", commit.Reason?.Value);
        await AssertNothingCommittedAsync(characterId, itemId);
    }

    [TestMethod]
    public async Task UnequipDeclaredLockKeys_CoverEveryResourceTheCommandWrites()
    {
        var characterId = CharacterId.New();
        var itemId = ItemInstanceId.New();
        var equipmentApplier = new PostgresEquipmentTransitionApplier();
        var inventoryApplier = new PostgresInventoryTransitionApplier();

        var unbind = new UnequipItemTransition(1, characterId, itemId, MainHandPlacement, new[] { MainHand });
        var release = new ReleaseInventoryItemReservationTransition(1, characterId, itemId, EquipmentSnapshot.OwnerKey);

        var declared = CanonicalResourceLockOrder.Order(
                equipmentApplier.ResolveLockKeys(unbind).Concat(inventoryApplier.ResolveLockKeys(release)))
            .Select(static key => key.ToString())
            .ToArray();

        CollectionAssert.AreEqual(
            new[]
            {
                $"Equipment/equipment.aggregate/{characterId.Value:D}",
                $"Equipment/equipment.binding/{characterId.Value:D}/{itemId.Value:D}",
                $"Equipment/equipment.slot/{characterId.Value:D}/main-hand",
                $"Inventory/inventory.aggregate/{characterId.Value:D}",
                $"Inventory/inventory.reservation/{characterId.Value:D}/{itemId.Value:D}"
            },
            declared,
            "Both owners must declare every resource the unequip command touches, in one canonical order.");
    }

    private static async Task AssertNothingCommittedAsync(CharacterId characterId, ItemInstanceId itemId)
    {
        var equipment = await new PostgresEquipmentSnapshotReader(DataSource).ReadAsync(characterId);
        Assert.AreEqual(1, equipment.Bindings.Count, "Equipment must not have cleared its binding.");
        Assert.AreEqual(itemId, equipment.Bindings[0].ItemInstanceId);
        Assert.AreEqual(1, await ScalarIntAsync("SELECT count(*) FROM nexis_v2.inventory_item_reservations;"));
        Assert.AreEqual(0, await ScalarIntAsync("SELECT count(*) FROM nexis_v2.authoritative_events;"));
        Assert.AreEqual(0, await ScalarIntAsync("SELECT count(*) FROM nexis_v2.outbox;"));
        Assert.AreEqual(
            0,
            await ScalarIntAsync("SELECT count(*) FROM nexis_v2.command_receipts WHERE terminal_status IS NOT NULL;"));
    }

    private static async Task BumpRevisionAsync(string table, CharacterId characterId)
    {
        await using var connection = await DataSource.OpenConnectionAsync();
        await ExecAsync(connection,
            $"UPDATE {table} SET revision = revision + 1 WHERE character_id = @c;",
            ("c", NpgsqlDbType.Uuid, characterId.Value));
    }

    private static PostgresAtomicCommandCommitter Committer() =>
        new(
            DataSource,
            new IPostgresOwnerTransitionApplier[]
            {
                new PostgresEquipmentTransitionApplier(),
                new PostgresInventoryTransitionApplier()
            });

    private static async Task<CoreEvaluationRequest> BuildUnequipRequestAsync(
        CharacterId characterId,
        ItemInstanceId itemId,
        CommandId commandId)
    {
        var inventory = await new PostgresInventorySnapshotReader(DataSource).ReadAsync(characterId);
        var equipment = await new PostgresEquipmentSnapshotReader(DataSource).ReadAsync(characterId);

        return new CoreEvaluationRequest(
            CoreContractVersion.V1,
            new CoreEvaluationContext(
                commandId,
                CorrelationId.New(),
                TrustedActorContext.CreatePlayer(AccountId.New(), characterId, 1),
                Utc(10, 0),
                new RuleVersion("unequip-proof-rules-v1"),
                new ContentVersion("unequip-proof-v1"),
                new FixedRandomFactory()),
            new UnequipItemIntent(characterId, itemId),
            new IAuthoritativeSnapshot[]
            {
                inventory,
                equipment,
                new CombatParticipationSnapshot(characterId, 1, false)
            });
    }

    private static async Task<PreparedCommand> PrepareUnequipAsync(
        CharacterId characterId,
        ItemInstanceId itemId,
        CommandId commandId,
        string owner)
    {
        var request = await BuildUnequipRequestAsync(characterId, itemId, commandId);
        var engine = new CoreRulesEngine();
        var decision = engine.Evaluate(request);
        Assert.AreEqual(CoreOutcomeStatus.Succeeded, decision.Status);

        var payload = new UnequipItemCanonicalCommandCodec().Serialize(request.Intent);
        var identity = CommandExecutionIdentityFactory.Create(request, payload);
        var claim = await new PostgresCommandReceiptRepository(DataSource).TryAcquireAsync(
            new CommandReceiptAcquireRequest(
                identity,
                payload,
                request.Context.CorrelationId,
                Utc(10, 0),
                new CommandExecutionLeaseRequest(owner, TimeSpan.FromMinutes(1))));
        Assert.AreEqual(CommandReceiptDisposition.Acquired, claim.Disposition);

        var plan = new CommandCommitPlanBuilder().Build(
            request,
            payload.Fingerprint,
            claim,
            decision,
            engine.Descriptor,
            Utc(10, 0, 1));

        return new PreparedCommand(identity, payload, plan);
    }

    private static async Task<CommandCommitPlan> PrepareForcedReleasePlanAsync(
        CharacterId characterId,
        ItemInstanceId itemId,
        CommandId commandId,
        string owner)
    {
        var equipment = await new PostgresEquipmentSnapshotReader(DataSource).ReadAsync(characterId);
        var inventory = await new PostgresInventorySnapshotReader(DataSource).ReadAsync(characterId);
        var binding = equipment.Bindings.Single(b => b.ItemInstanceId == itemId);

        var request = await BuildUnequipRequestAsync(characterId, itemId, commandId);
        var engine = new CoreRulesEngine();
        var forcedDecision = CoreDecision.Succeeded(
            transitions: new IOwnerTransition[]
            {
                new UnequipItemTransition(
                    equipment.Revision, characterId, itemId, binding.PlacementKey, binding.OccupiedSlots),
                new ReleaseInventoryItemReservationTransition(
                    inventory.Revision, characterId, itemId, EquipmentSnapshot.OwnerKey)
            },
            events: new ICoreEventDescriptor[]
            {
                new ItemUnequippedEvent(characterId, itemId, binding.PlacementKey, binding.OccupiedSlots)
            });

        var payload = new UnequipItemCanonicalCommandCodec().Serialize(request.Intent);
        var claim = await new PostgresCommandReceiptRepository(DataSource).TryAcquireAsync(
            new CommandReceiptAcquireRequest(
                CommandExecutionIdentityFactory.Create(request, payload),
                payload,
                request.Context.CorrelationId,
                Utc(10, 0),
                new CommandExecutionLeaseRequest(owner, TimeSpan.FromMinutes(1))));

        return new CommandCommitPlanBuilder().Build(
            request, payload.Fingerprint, claim, forcedDecision, engine.Descriptor, Utc(10, 0, 1));
    }

    private static async Task<ExecutedCommand> ExecuteUnequipAsync(
        CharacterId characterId,
        ItemInstanceId itemId,
        CommandId commandId,
        string owner,
        Func<Task>? beforeCommit = null)
    {
        var prepared = await PrepareUnequipAsync(characterId, itemId, commandId, owner);
        if (beforeCommit is not null)
        {
            await beforeCommit();
        }

        var result = await Committer().CommitAsync(prepared.Plan);
        return new ExecutedCommand(prepared.Identity, prepared.Payload, result);
    }

    private sealed record PreparedCommand(
        CommandExecutionIdentity Identity,
        CanonicalCommandPayload Payload,
        CommandCommitPlan Plan);

    private sealed record ExecutedCommand(
        CommandExecutionIdentity Identity,
        CanonicalCommandPayload Payload,
        CommandCommitResult Result);

}
