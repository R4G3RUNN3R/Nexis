using Microsoft.VisualStudio.TestTools.UnitTesting;
using Nexis.Identity.Contracts;
using Nexis.Persistence.Postgres;
using Npgsql;
using NpgsqlTypes;

namespace Nexis.Persistence.Postgres.Tests;

/// <summary>
/// Durable proof for the account-scoped stable public player identity boundary. The database, not
/// only C#, refuses duplicate, conflicting, reassigned and concurrently created mappings.
/// </summary>
[TestClass]
[DoNotParallelize]
public sealed class PostgresPlayerIdentityIntegrationTests
{
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
        await using var connection = await DataSource.OpenConnectionAsync();
        await using var command = new NpgsqlCommand("TRUNCATE TABLE nexis_v2.player_identities CASCADE;", connection);
        await command.ExecuteNonQueryAsync();
    }

    [TestMethod]
    public async Task Provisioning_AllocatesAStablePublicPlayerIdAboveTheReservedRange()
    {
        var store = new PostgresPlayerIdentityStore(DataSource);
        var accountId = AccountId.New();
        var characterId = CharacterId.New();

        var identity = await store.ProvisionAsync(accountId, characterId, new PlayerDisplayName("Hennet"));

        Assert.AreEqual(accountId, identity.AccountId);
        Assert.AreEqual(characterId, identity.CharacterId);
        Assert.IsFalse(identity.PublicPlayerId.IsReserved);
        Assert.IsTrue(identity.PublicPlayerId.Ordinal >= PublicPlayerId.FirstAllocatable.Ordinal);

        var read = await store.FindByAccountAsync(accountId);
        Assert.AreEqual(identity.PublicPlayerId, read!.PublicPlayerId);
        Assert.AreEqual(identity.CharacterId, read.CharacterId);
    }

    [TestMethod]
    public async Task Provisioning_IsIdempotentUnderRetryAndNeverMintsASecondPublicPlayerId()
    {
        var store = new PostgresPlayerIdentityStore(DataSource);
        var accountId = AccountId.New();
        var characterId = CharacterId.New();
        var name = new PlayerDisplayName("Hennet");

        var first = await store.ProvisionAsync(accountId, characterId, name);
        var retry = await store.ProvisionAsync(accountId, characterId, name);

        Assert.AreEqual(first.PublicPlayerId, retry.PublicPlayerId, "A retried provision must return the original identity.");
        Assert.AreEqual(1, await ScalarIntAsync("SELECT count(*) FROM nexis_v2.player_identities;"));
    }

    [TestMethod]
    public async Task ConcurrentProvisioning_CannotCreateDuplicateOrConflictingMappings()
    {
        var store = new PostgresPlayerIdentityStore(DataSource);
        var accountId = AccountId.New();
        var characterId = CharacterId.New();
        var name = new PlayerDisplayName("Hennet");

        // Eight racing provisioners for the same account, exactly as retried concurrent sign-in
        // would produce.
        var results = await Task.WhenAll(Enumerable.Range(0, 8)
            .Select(_ => store.ProvisionAsync(accountId, characterId, name).AsTask()));

        Assert.AreEqual(1, results.Select(static identity => identity.PublicPlayerId).Distinct().Count(),
            "Concurrent provisioning must converge on exactly one public player identifier.");
        Assert.AreEqual(1, await ScalarIntAsync("SELECT count(*) FROM nexis_v2.player_identities;"));
        Assert.AreEqual(1, await ScalarIntAsync(
            $"SELECT count(*) FROM nexis_v2.player_identities WHERE account_id = '{accountId.Value:D}';"));
    }

    [TestMethod]
    public async Task Database_RefusesASecondPlayableCharacterForOneAccount()
    {
        var store = new PostgresPlayerIdentityStore(DataSource);
        var accountId = AccountId.New();
        await store.ProvisionAsync(accountId, CharacterId.New(), new PlayerDisplayName("Hennet"));

        // A second character for the same account is refused by the primary key, and the attempt
        // surfaces as a typed conflict rather than a silently different identity.
        await Assert.ThrowsExactlyAsync<PlayerIdentityConflictException>(
            async () => await store.ProvisionAsync(accountId, CharacterId.New(), new PlayerDisplayName("Alt")));

        Assert.AreEqual(1, await ScalarIntAsync("SELECT count(*) FROM nexis_v2.player_identities;"));
    }

    [TestMethod]
    public async Task Database_RefusesOneCharacterBeingControlledByTwoAccounts()
    {
        var store = new PostgresPlayerIdentityStore(DataSource);
        var characterId = CharacterId.New();
        await store.ProvisionAsync(AccountId.New(), characterId, new PlayerDisplayName("Hennet"));

        await Assert.ThrowsExactlyAsync<PlayerIdentityConflictException>(
            async () => await store.ProvisionAsync(AccountId.New(), characterId, new PlayerDisplayName("Thief")));
    }

    [TestMethod]
    public async Task Database_RefusesADuplicatePublicPlayerIdEvenWhenForcedDirectly()
    {
        var store = new PostgresPlayerIdentityStore(DataSource);
        var existing = await store.ProvisionAsync(AccountId.New(), CharacterId.New(), new PlayerDisplayName("Hennet"));

        var duplicate = await Assert.ThrowsExactlyAsync<PostgresException>(async () => await ExecAsync(
            """
            INSERT INTO nexis_v2.player_identities(account_id, character_id, public_player_ordinal, display_name)
            VALUES (@a, @c, @o, @n);
            """,
            ("a", NpgsqlDbType.Uuid, AccountId.New().Value),
            ("c", NpgsqlDbType.Uuid, CharacterId.New().Value),
            ("o", NpgsqlDbType.Bigint, existing.PublicPlayerId.Ordinal),
            ("n", NpgsqlDbType.Text, "Impostor")));

        Assert.AreEqual("23505", duplicate.SqlState);
    }

    [TestMethod]
    public async Task Database_RefusesReservedAndBelowFloorPublicPlayerOrdinals()
    {
        foreach (var ordinal in new long[] { 0, 999_999, PublicPlayerId.Floor, PublicPlayerId.Floor + PublicPlayerId.ReservedCount - 1 })
        {
            var rejected = await Assert.ThrowsExactlyAsync<PostgresException>(async () => await ExecAsync(
                """
                INSERT INTO nexis_v2.player_identities(account_id, character_id, public_player_ordinal, display_name)
                VALUES (@a, @c, @o, @n);
                """,
                ("a", NpgsqlDbType.Uuid, AccountId.New().Value),
                ("c", NpgsqlDbType.Uuid, CharacterId.New().Value),
                ("o", NpgsqlDbType.Bigint, ordinal),
                ("n", NpgsqlDbType.Text, "Reserved")));

            Assert.AreEqual("23514", rejected.SqlState, $"Ordinal {ordinal} must fail the check constraint.");
        }
    }

    [TestMethod]
    public async Task Database_RefusesReassignmentOfAnyIdentifierWhileAllowingRename()
    {
        var store = new PostgresPlayerIdentityStore(DataSource);
        var identity = await store.ProvisionAsync(AccountId.New(), CharacterId.New(), new PlayerDisplayName("Hennet"));

        foreach (var (column, parameter) in new (string, NpgsqlParameter)[]
        {
            ("account_id", new NpgsqlParameter("v", NpgsqlDbType.Uuid) { Value = AccountId.New().Value }),
            ("character_id", new NpgsqlParameter("v", NpgsqlDbType.Uuid) { Value = CharacterId.New().Value }),
            ("public_player_ordinal", new NpgsqlParameter("v", NpgsqlDbType.Bigint) { Value = identity.PublicPlayerId.Ordinal + 1 })
        })
        {
            var refused = await Assert.ThrowsExactlyAsync<PostgresException>(async () =>
            {
                await using var connection = await DataSource.OpenConnectionAsync();
                await using var command = new NpgsqlCommand(
                    $"UPDATE nexis_v2.player_identities SET {column} = @v WHERE account_id = @a;",
                    connection);
                command.Parameters.Add(parameter);
                command.Parameters.AddWithValue("a", NpgsqlDbType.Uuid, identity.AccountId.Value);
                await command.ExecuteNonQueryAsync();
            });

            Assert.AreEqual("P0001", refused.SqlState, $"Reassigning {column} must be refused by the database.");
        }

        // Renaming is the one permitted mutation, and it changes no identifier.
        var renamed = await store.RenameAsync(identity.AccountId, new PlayerDisplayName("Hennet Reborn"));

        Assert.AreEqual("Hennet Reborn", renamed.DisplayName.Value);
        Assert.AreEqual(identity.AccountId, renamed.AccountId);
        Assert.AreEqual(identity.CharacterId, renamed.CharacterId);
        Assert.AreEqual(identity.PublicPlayerId, renamed.PublicPlayerId);
    }

    [TestMethod]
    public async Task PublicLookup_ReturnsOnlyTheKnowledgeSafeProjection()
    {
        var store = new PostgresPlayerIdentityStore(DataSource);
        var identity = await store.ProvisionAsync(AccountId.New(), CharacterId.New(), new PlayerDisplayName("Hennet"));

        var projection = await store.FindPublicProjectionAsync(identity.PublicPlayerId);

        Assert.IsNotNull(projection);
        Assert.AreEqual(identity.PublicPlayerId, projection.PublicPlayerId);
        Assert.AreEqual(identity.DisplayName, projection.DisplayName);

        var rendered = projection.ToString();
        StringAssert.DoesNotMatch(rendered, new System.Text.RegularExpressions.Regex(
            System.Text.RegularExpressions.Regex.Escape(identity.AccountId.Value.ToString("D"))));
        StringAssert.DoesNotMatch(rendered, new System.Text.RegularExpressions.Regex(
            System.Text.RegularExpressions.Regex.Escape(identity.CharacterId.Value.ToString("D"))));

        Assert.IsNull(await store.FindPublicProjectionAsync(new PublicPlayerId(9_999_999)));
    }

    private static async Task ExecAsync(string sql, params (string Name, NpgsqlDbType Type, object Value)[] parameters)
    {
        await using var connection = await DataSource.OpenConnectionAsync();
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

    private static NpgsqlDataSource DataSource =>
        s_dataSource ?? throw new InvalidOperationException("PostgreSQL test data source was not initialized.");
}
