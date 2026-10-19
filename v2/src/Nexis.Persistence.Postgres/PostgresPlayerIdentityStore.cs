using Nexis.Identity.Contracts;
using Npgsql;
using NpgsqlTypes;

namespace Nexis.Persistence.Postgres;

/// <summary>
/// Raised when a requested identity mapping contradicts one the Identity owner already holds, for
/// example a second playable character for one account or a character already controlled elsewhere.
/// This is a durable ownership conflict, not an infrastructure fault.
/// </summary>
public sealed class PlayerIdentityConflictException : Exception
{
    public PlayerIdentityConflictException(string message)
        : base(message)
    {
    }
}

/// <summary>
/// Real PostgreSQL persistence for the Identity owner's account/character/public-identity
/// relationships.
///
/// Provisioning is idempotent: repeating it for the same account and character returns the original
/// identity rather than minting a second public identifier. Public identifiers come from a sequence,
/// so concurrent provisioning cannot allocate the same ordinal twice.
/// </summary>
public sealed class PostgresPlayerIdentityStore
{
    private const string UniqueViolation = "23505";

    private readonly NpgsqlDataSource _dataSource;

    public PostgresPlayerIdentityStore(NpgsqlDataSource dataSource)
    {
        _dataSource = dataSource ?? throw new ArgumentNullException(nameof(dataSource));
    }

    /// <summary>
    /// Provisions the single playable character for an account, or returns the identity that
    /// already exists. Safe to retry.
    /// </summary>
    public async ValueTask<PlayerIdentity> ProvisionAsync(
        AccountId accountId,
        CharacterId characterId,
        PlayerDisplayName displayName,
        CancellationToken cancellationToken = default)
    {
        if (accountId.IsEmpty)
        {
            throw new ArgumentException("Provisioning requires a non-empty AccountId.", nameof(accountId));
        }

        if (characterId.IsEmpty)
        {
            throw new ArgumentException("Provisioning requires a non-empty CharacterId.", nameof(characterId));
        }

        // The insert is conditional on nothing already existing for this account or character, and
        // the ordinal is only drawn when the insert actually proceeds.
        const string insertSql = """
            INSERT INTO nexis_v2.player_identities (
                account_id, character_id, public_player_ordinal, display_name)
            VALUES (
                @account_id,
                @character_id,
                nextval('nexis_v2.public_player_ordinal_seq'),
                @display_name)
            ON CONFLICT DO NOTHING
            RETURNING account_id, character_id, public_player_ordinal, display_name;
            """;

        await using (var connection = await _dataSource.OpenConnectionAsync(cancellationToken).ConfigureAwait(false))
        await using (var command = new NpgsqlCommand(insertSql, connection))
        {
            command.Parameters.AddWithValue("account_id", NpgsqlDbType.Uuid, accountId.Value);
            command.Parameters.AddWithValue("character_id", NpgsqlDbType.Uuid, characterId.Value);
            command.Parameters.AddWithValue("display_name", NpgsqlDbType.Text, displayName.Value);

            try
            {
                await using var reader = await command.ExecuteReaderAsync(cancellationToken).ConfigureAwait(false);
                if (await reader.ReadAsync(cancellationToken).ConfigureAwait(false))
                {
                    return Map(reader);
                }
            }
            catch (PostgresException exception) when (exception.SqlState == UniqueViolation)
            {
                // A concurrent provisioner won the race between the conflict probe and the write.
                // Fall through and read the identity it committed.
            }
        }

        // Either the row already existed or a concurrent caller created it. Reconcile against what
        // is actually stored: an existing identity for this exact account and character is the
        // idempotent answer; anything else is a genuine ownership conflict.
        var existing = await FindByAccountAsync(accountId, cancellationToken).ConfigureAwait(false);
        if (existing is not null)
        {
            if (existing.CharacterId != characterId)
            {
                throw new PlayerIdentityConflictException(
                    $"Account '{accountId}' already has a playable character. Nexis exposes one playable character per normal account.");
            }

            return existing;
        }

        var byCharacter = await FindByCharacterAsync(characterId, cancellationToken).ConfigureAwait(false);
        if (byCharacter is not null)
        {
            throw new PlayerIdentityConflictException(
                $"Character '{characterId}' is already controlled by another account.");
        }

        throw new InvalidOperationException(
            $"Player identity provisioning for account '{accountId}' neither inserted nor found a row.");
    }

    /// <summary>
    /// Changes only the display name. Every identifier is left untouched, and the database refuses
    /// the update outright if any of them would change.
    /// </summary>
    public async ValueTask<PlayerIdentity> RenameAsync(
        AccountId accountId,
        PlayerDisplayName displayName,
        CancellationToken cancellationToken = default)
    {
        const string sql = """
            UPDATE nexis_v2.player_identities
            SET display_name = @display_name
            WHERE account_id = @account_id
            RETURNING account_id, character_id, public_player_ordinal, display_name;
            """;

        await using var connection = await _dataSource.OpenConnectionAsync(cancellationToken).ConfigureAwait(false);
        await using var command = new NpgsqlCommand(sql, connection);
        command.Parameters.AddWithValue("account_id", NpgsqlDbType.Uuid, accountId.Value);
        command.Parameters.AddWithValue("display_name", NpgsqlDbType.Text, displayName.Value);

        await using var reader = await command.ExecuteReaderAsync(cancellationToken).ConfigureAwait(false);
        if (!await reader.ReadAsync(cancellationToken).ConfigureAwait(false))
        {
            throw new KeyNotFoundException($"No player identity is provisioned for account '{accountId}'.");
        }

        return Map(reader);
    }

    public ValueTask<PlayerIdentity?> FindByAccountAsync(
        AccountId accountId,
        CancellationToken cancellationToken = default) =>
        FindAsync("account_id", NpgsqlDbType.Uuid, accountId.Value, cancellationToken);

    public ValueTask<PlayerIdentity?> FindByCharacterAsync(
        CharacterId characterId,
        CancellationToken cancellationToken = default) =>
        FindAsync("character_id", NpgsqlDbType.Uuid, characterId.Value, cancellationToken);

    /// <summary>
    /// Public identifiers are world-readable, so this resolves only to the knowledge-safe
    /// projection. Internal identifiers never leave this method.
    /// </summary>
    public async ValueTask<PublicPlayerProjection?> FindPublicProjectionAsync(
        PublicPlayerId publicPlayerId,
        CancellationToken cancellationToken = default)
    {
        var identity = await FindAsync(
            "public_player_ordinal",
            NpgsqlDbType.Bigint,
            publicPlayerId.Ordinal,
            cancellationToken).ConfigureAwait(false);

        return identity?.ToPublicProjection();
    }

    private async ValueTask<PlayerIdentity?> FindAsync(
        string column,
        NpgsqlDbType type,
        object value,
        CancellationToken cancellationToken)
    {
        // The column name is chosen from this class's own closed set, never from caller input.
        var sql = $"""
            SELECT account_id, character_id, public_player_ordinal, display_name
            FROM nexis_v2.player_identities
            WHERE {column} = @value;
            """;

        await using var connection = await _dataSource.OpenConnectionAsync(cancellationToken).ConfigureAwait(false);
        await using var command = new NpgsqlCommand(sql, connection);
        command.Parameters.AddWithValue("value", type, value);

        await using var reader = await command.ExecuteReaderAsync(cancellationToken).ConfigureAwait(false);
        return await reader.ReadAsync(cancellationToken).ConfigureAwait(false) ? Map(reader) : null;
    }

    private static PlayerIdentity Map(NpgsqlDataReader reader) =>
        PlayerIdentity.Create(
            new AccountId(reader.GetGuid(0)),
            new CharacterId(reader.GetGuid(1)),
            new PublicPlayerId(reader.GetInt64(2)),
            new PlayerDisplayName(reader.GetString(3)));
}
