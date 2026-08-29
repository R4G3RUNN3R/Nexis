using Nexis.Core.Contracts;
using Nexis.Execution.Contracts;
using Npgsql;

namespace Nexis.Persistence.Postgres;

public enum PostgresOwnerTransitionDisposition
{
    Applied = 0,
    ConcurrencyConflict = 1
}

public sealed record PostgresOwnerTransitionResult
{
    private PostgresOwnerTransitionResult(
        PostgresOwnerTransitionDisposition disposition,
        CommandReasonCode? reason)
    {
        Disposition = disposition;
        Reason = reason;
    }

    public PostgresOwnerTransitionDisposition Disposition { get; }

    public CommandReasonCode? Reason { get; }

    public static PostgresOwnerTransitionResult Applied() =>
        new(PostgresOwnerTransitionDisposition.Applied, null);

    public static PostgresOwnerTransitionResult ConcurrencyConflict(CommandReasonCode reason) =>
        new(
            PostgresOwnerTransitionDisposition.ConcurrencyConflict,
            reason ?? throw new ArgumentNullException(nameof(reason)));
}

/// <summary>
/// Infrastructure boundary implemented by each PostgreSQL authoritative-owner adapter. Npgsql
/// types are allowed here because this project is infrastructure, never a stable gameplay contract.
/// </summary>
public interface IPostgresOwnerTransitionApplier
{
    OwnerKey Owner { get; }

    /// <summary>
    /// Purely and completely identifies every authoritative resource the transition can lock or
    /// conditionally update. The returned keys must describe the same order-sensitive SQL work as
    /// <see cref="ApplyAsync"/>.
    /// </summary>
    IReadOnlyList<AuthoritativeResourceKey> ResolveLockKeys(IOwnerTransition transition);

    ValueTask<PostgresOwnerTransitionResult> ApplyAsync(
        NpgsqlConnection connection,
        NpgsqlTransaction transaction,
        IOwnerTransition transition,
        CancellationToken cancellationToken = default);
}
