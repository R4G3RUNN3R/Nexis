using Microsoft.VisualStudio.TestTools.UnitTesting;
using Nexis.Core.Contracts;
using Nexis.Execution;
using Nexis.Execution.Contracts;
using Nexis.Identity.Contracts;
using Nexis.Kernel.Commands;
using Nexis.Kernel.Events;
using Nexis.Kernel.Randomness;
using Nexis.Persistence.Postgres;
using Npgsql;
using NpgsqlTypes;

namespace Nexis.Persistence.Postgres.Tests;

/// <summary>
/// Independent Claude review evidence for the H1 canonical-lock-ordering remediation.
///
/// The remediation orders transitions by the lowest canonical position among the keys each
/// transition resolves, then applies each transition as a unit. That is deterministic, and it is
/// correct whenever every transition of one owner resolves exactly one key or shares a common
/// lowest key. It is NOT sufficient in general: when two transitions of one owner resolve key sets
/// that interleave in the global canonical order, the resulting lock ACQUISITION sequence is not
/// globally canonical, which is the property COMMAND-EXECUTION.md rule 12 actually requires.
/// </summary>
[TestClass]
[DoNotParallelize]
public sealed class ClaudeOvernightLockOrderTests
{
    private static NpgsqlDataSource? s_dataSource;
    private static readonly OwnerKey Owner = new("ClaudeLockOwner");

    private static NpgsqlDataSource DataSource =>
        s_dataSource ?? throw new InvalidOperationException("PostgreSQL data source was not initialised.");

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

        const string sql = """
            CREATE SCHEMA IF NOT EXISTS nexis_v2_claude_test;
            CREATE TABLE IF NOT EXISTS nexis_v2_claude_test.lock_owner (
                resource_id text PRIMARY KEY,
                value integer NOT NULL
            );
            """;

        await using var connection = await s_dataSource.OpenConnectionAsync();
        await using var command = new NpgsqlCommand(sql, connection);
        await command.ExecuteNonQueryAsync();
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
                nexis_v2.event_consumer_checkpoints,
                nexis_v2.outbox,
                nexis_v2.authoritative_events,
                nexis_v2.admin_audit,
                nexis_v2.command_receipts,
                nexis_v2_claude_test.lock_owner
            CASCADE;
            INSERT INTO nexis_v2_claude_test.lock_owner(resource_id, value)
            VALUES ('wide', 0), ('narrow', 0);
            """;

        await using var connection = await DataSource.OpenConnectionAsync();
        await using var command = new NpgsqlCommand(sql, connection);
        await command.ExecuteNonQueryAsync();
    }

    /// <summary>
    /// RED. Two transitions of one owner whose resolved key sets interleave in the global canonical
    /// order. "wide" locks {res/a, res/c}; "narrow" locks {res/b}. The globally canonical
    /// acquisition sequence is a, b, c. Ordering whole transitions by their lowest key produces
    /// a, c, b, so a concurrent command that legitimately acquires b then c deadlocks against it.
    /// </summary>
    [TestMethod]
    public async Task InterleavedSameOwnerTransitions_MustAcquireResourcesInOneGlobalCanonicalOrder()
    {
        var acquisitionOrder = new List<AuthoritativeResourceKey>();

        var wide = new KeyedTransition("wide");
        var narrow = new KeyedTransition("narrow");

        await CommitAsync(new[] { wide, narrow }, acquisitionOrder);

        var expected = CanonicalResourceLockOrder
            .Order(KeyedTransition.KeysFor("wide").Concat(KeyedTransition.KeysFor("narrow")))
            .Select(static key => key.ToString())
            .ToArray();
        var observed = acquisitionOrder.Select(static key => key.ToString()).ToArray();

        CollectionAssert.AreEqual(
            expected,
            observed,
            "Resolved owner resources were acquired as "
            + string.Join(" -> ", observed)
            + " instead of the global canonical order "
            + string.Join(" -> ", expected)
            + ". Ordering whole transitions by their lowest canonical key is deterministic but not "
            + "globally canonical: when two transitions of one owner resolve interleaving key sets, "
            + "a second command that acquires the same resources in canonical order can deadlock "
            + "against this one. COMMAND-EXECUTION.md rule 12 and required test 5 ask for a canonical "
            + "acquisition order over resources, not over transitions. Close this by acquiring every "
            + "resolved key in one canonical sweep before any applier runs, rather than by removing "
            + "or narrowing the assertion.");
    }

    /// <summary>
    /// Protective. The existing single-key-per-transition guarantee that the remediation already
    /// proves must survive whatever closes the RED test above.
    /// </summary>
    [TestMethod]
    public async Task SingleKeyTransitions_RemainCanonicallyOrderedRegardlessOfEmissionDirection()
    {
        var forward = new List<AuthoritativeResourceKey>();
        var reverse = new List<AuthoritativeResourceKey>();

        await CommitAsync(new[] { new KeyedTransition("narrow"), new KeyedTransition("narrow") }, forward);
        await TestInitialize();
        await CommitAsync(new[] { new KeyedTransition("narrow"), new KeyedTransition("narrow") }, reverse);

        CollectionAssert.AreEqual(
            forward.Select(static key => key.ToString()).ToArray(),
            reverse.Select(static key => key.ToString()).ToArray());
    }

    private static async Task CommitAsync(
        IReadOnlyList<KeyedTransition> transitions,
        List<AuthoritativeResourceKey> acquisitionOrder)
    {
        var commandId = CommandId.New();
        var correlationId = CorrelationId.New();
        var request = CreateRequest(commandId, correlationId);
        var payload = CanonicalCommandPayload.FromTrustedJson($$"""{"probe":"{{Guid.NewGuid():N}}"}""");

        var repository = new PostgresCommandReceiptRepository(DataSource);
        var claim = await repository.TryAcquireAsync(new CommandReceiptAcquireRequest(
            CommandExecutionIdentityFactory.Create(request, payload),
            payload,
            correlationId,
            Utc(10, 0),
            new CommandExecutionLeaseRequest("claude-lock-order-tests", TimeSpan.FromMinutes(1))));

        Assert.AreEqual(CommandReceiptDisposition.Acquired, claim.Disposition);

        var plan = new CommandCommitPlanBuilder().Build(
            request,
            payload.Fingerprint,
            claim,
            CoreDecision.Succeeded(transitions: transitions),
            new CoreImplementationDescriptor("Test.Core", "1.0.0-test", CoreContractVersion.V1),
            Utc(10, 5));

        var committer = new PostgresAtomicCommandCommitter(
            DataSource,
            new IPostgresOwnerTransitionApplier[] { new KeyedApplier() },
            resourceLockAcquirer: new RecordingResourceLockAcquirer(acquisitionOrder));

        var result = await committer.CommitAsync(plan);
        Assert.AreEqual(CommandCommitDisposition.Committed, result.Disposition);
    }

    private static CoreEvaluationRequest CreateRequest(CommandId commandId, CorrelationId correlationId) =>
        new(
            CoreContractVersion.V1,
            new CoreEvaluationContext(
                commandId,
                correlationId,
                TrustedActorContext.CreatePlayer(AccountId.New(), CharacterId.New(), 1),
                Utc(10, 0),
                new RuleVersion("tests.rules.v1"),
                new ContentVersion("tests.content.v1"),
                new FixedRandomFactory()),
            new ProbeIntent(),
            Array.Empty<IAuthoritativeSnapshot>());

    private static DateTimeOffset Utc(int hour, int minute) =>
        new(2026, 8, 29, hour, minute, 0, TimeSpan.Zero);

    private sealed record ProbeIntent : ICoreIntent
    {
        public ContractDescriptor Contract { get; } = new("tests.claude.lock-order", 1);
    }

    private sealed record KeyedTransition(string ResourceId) : IOwnerTransition
    {
        public ContractDescriptor Contract { get; } = new("tests.claude.lock-order.transition", 1);

        public OwnerKey TargetOwner => Owner;

        public long? ExpectedRevision => null;

        public static IReadOnlyList<AuthoritativeResourceKey> KeysFor(string resourceId) =>
            resourceId switch
            {
                // Deliberately interleaves with "narrow" in the global canonical order.
                "wide" => new[]
                {
                    new AuthoritativeResourceKey(Owner, "res", "a"),
                    new AuthoritativeResourceKey(Owner, "res", "c")
                },
                "narrow" => new[] { new AuthoritativeResourceKey(Owner, "res", "b") },
                _ => throw new InvalidOperationException($"Unknown probe resource '{resourceId}'.")
            };
    }

    private sealed class KeyedApplier : IPostgresOwnerTransitionApplier
    {

        public OwnerKey Owner => ClaudeOvernightLockOrderTests.Owner;

        public IReadOnlyList<AuthoritativeResourceKey> ResolveLockKeys(IOwnerTransition transition)
        {
            if (transition is not KeyedTransition keyed)
            {
                throw new InvalidOperationException("Claude lock-order probe received an unsupported transition.");
            }

            return CanonicalResourceLockOrder.Order(KeyedTransition.KeysFor(keyed.ResourceId));
        }

        public async ValueTask<PostgresOwnerTransitionResult> ApplyAsync(
            NpgsqlConnection connection,
            NpgsqlTransaction transaction,
            IOwnerTransition transition,
            CancellationToken cancellationToken = default)
        {
            var keys = ResolveLockKeys(transition);

            // Mirrors a real applier with more than one SQL statement. The committer must already
            // hold every declared advisory lock before this code starts.
            foreach (var key in keys)
            {
                await using var command = new NpgsqlCommand(
                    """
                    UPDATE nexis_v2_claude_test.lock_owner
                    SET value = value + 1
                    WHERE resource_id = @resource_id;
                    """,
                    connection,
                    transaction);
                command.Parameters.AddWithValue(
                    "resource_id",
                    NpgsqlDbType.Text,
                    ((KeyedTransition)transition).ResourceId);
                await command.ExecuteNonQueryAsync(cancellationToken);
            }

            return PostgresOwnerTransitionResult.Applied();
        }
    }

    private sealed class RecordingResourceLockAcquirer : IPostgresResourceLockAcquirer
    {
        private readonly List<AuthoritativeResourceKey> _acquisitionOrder;
        private readonly PostgresAdvisoryResourceLockAcquirer _inner = new();

        public RecordingResourceLockAcquirer(List<AuthoritativeResourceKey> acquisitionOrder)
        {
            _acquisitionOrder = acquisitionOrder;
        }

        public async ValueTask AcquireAsync(
            NpgsqlConnection connection,
            NpgsqlTransaction transaction,
            AuthoritativeResourceKey resource,
            CancellationToken cancellationToken = default)
        {
            await _inner.AcquireAsync(
                connection,
                transaction,
                resource,
                cancellationToken);
            _acquisitionOrder.Add(resource);
        }
    }

    private sealed class FixedRandomFactory : IDeterministicRandomFactory
    {
        public IDeterministicRandomSource Create() => new FixedRandomSource();

        private sealed class FixedRandomSource : IDeterministicRandomSource
        {
            public ulong NextUInt64() => 1;
        }
    }
}
