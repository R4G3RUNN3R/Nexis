namespace Nexis.Persistence.Postgres;

internal readonly record struct PostgresOutboxPoisonFailureResult(
    bool FenceOwned,
    int PoisonAttemptCount,
    bool DeadLettered)
{
    public static PostgresOutboxPoisonFailureResult FenceLost => new(false, 0, false);
}
