using System.Reflection;
using Npgsql;

namespace Nexis.Persistence.Postgres;

public static class PostgresExecutionSchema
{
    private static readonly string[] OrderedResources =
    {
        "Nexis.Persistence.Postgres.Migrations.0001_execution_foundation.sql",
        "Nexis.Persistence.Postgres.Migrations.0002_outbox_delivery.sql",
        "Nexis.Persistence.Postgres.Migrations.0003_command_recovery.sql",
        "Nexis.Persistence.Postgres.Migrations.0004_equipment_owner.sql",
        "Nexis.Persistence.Postgres.Migrations.0005_system_actor_identity.sql"
    };

    public static async ValueTask EnsureCreatedAsync(
        NpgsqlDataSource dataSource,
        CancellationToken cancellationToken = default)
    {
        ArgumentNullException.ThrowIfNull(dataSource);

        await using var connection = await dataSource.OpenConnectionAsync(cancellationToken).ConfigureAwait(false);

        foreach (var resourceName in OrderedResources)
        {
            await using var stream = Assembly.GetExecutingAssembly().GetManifestResourceStream(resourceName)
                ?? throw new InvalidOperationException($"Embedded PostgreSQL migration '{resourceName}' was not found.");
            using var reader = new StreamReader(stream);
            var sql = await reader.ReadToEndAsync(cancellationToken).ConfigureAwait(false);

            await using var command = new NpgsqlCommand(sql, connection);
            await command.ExecuteNonQueryAsync(cancellationToken).ConfigureAwait(false);
        }
    }
}
