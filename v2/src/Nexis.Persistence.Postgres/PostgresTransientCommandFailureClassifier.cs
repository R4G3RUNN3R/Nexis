using Nexis.Execution.Contracts;
using Npgsql;

namespace Nexis.Persistence.Postgres;

/// <summary>
/// Only PostgreSQL errors that guarantee the transaction was aborted and are explicitly safe for
/// full-operation retry are classified here. Network/commit-ack failures remain outcome-ambiguous
/// and must be reconciled by CommandId receipt before any new execution attempt.
/// </summary>
public sealed class PostgresTransientCommandFailureClassifier : ITransientCommandFailureClassifier
{
    public const string SerializationFailureSqlState = "40001";
    public const string DeadlockDetectedSqlState = "40P01";

    public bool IsRetryable(Exception exception) =>
        exception is PostgresException postgresException && IsRetryableSqlState(postgresException.SqlState);

    public static bool IsRetryableSqlState(string? sqlState) =>
        string.Equals(sqlState, SerializationFailureSqlState, StringComparison.Ordinal) ||
        string.Equals(sqlState, DeadlockDetectedSqlState, StringComparison.Ordinal);
}
