using Microsoft.VisualStudio.TestTools.UnitTesting;
using Nexis.Core.Contracts;
using Nexis.Execution;
using Nexis.Execution.Contracts;
using Nexis.Identity.Contracts;
using Nexis.Kernel.Commands;
using Nexis.Kernel.Events;
using Nexis.Kernel.Randomness;

namespace Nexis.Architecture.Tests;

[TestClass]
public sealed class CommandReceiptTests
{
    [TestMethod]
    public async Task SameCommandAndIdentity_IsAcquiredOnlyOnce()
    {
        var repository = new InMemoryReceiptRepository();
        var coordinator = new CommandReceiptCoordinator(repository);
        var commandId = CommandId.New();
        var actor = CreatePlayerActor();
        var payload = Payload("same-payload");
        var firstCorrelation = CorrelationId.New();

        var first = await coordinator.AcquireAsync(
            CreateRequest(commandId, actor, firstCorrelation),
            payload,
            Lease("worker-a"),
            Utc(10, 0));

        var duplicate = await coordinator.AcquireAsync(
            CreateRequest(commandId, actor, CorrelationId.New()),
            payload,
            Lease("worker-b"),
            Utc(10, 1));

        Assert.AreEqual(CommandReceiptDisposition.Acquired, first.Disposition);
        Assert.IsTrue(first.ExecutionToken.HasValue);
        Assert.AreEqual(CommandReceiptDisposition.DuplicateInProgress, duplicate.Disposition);
        Assert.AreEqual(firstCorrelation, duplicate.OriginalCorrelationId);
        Assert.IsFalse(duplicate.ExecutionToken.HasValue);
    }

    [TestMethod]
    public async Task SameCommandWithChangedPayload_IsIntegrityViolation()
    {
        var repository = new InMemoryReceiptRepository();
        var coordinator = new CommandReceiptCoordinator(repository);
        var commandId = CommandId.New();
        var actor = CreatePlayerActor();

        await coordinator.AcquireAsync(
            CreateRequest(commandId, actor, CorrelationId.New()),
            Payload("payload-a"),
            Lease("worker-a"),
            Utc(10, 0));

        var second = await coordinator.AcquireAsync(
            CreateRequest(commandId, actor, CorrelationId.New()),
            Payload("payload-b"),
            Lease("worker-b"),
            Utc(10, 1));

        Assert.AreEqual(CommandReceiptDisposition.IntegrityViolation, second.Disposition);
    }

    [TestMethod]
    public async Task SameCommandWithChangedActor_IsIntegrityViolation()
    {
        var repository = new InMemoryReceiptRepository();
        var coordinator = new CommandReceiptCoordinator(repository);
        var commandId = CommandId.New();
        var payload = Payload("same-payload");

        await coordinator.AcquireAsync(
            CreateRequest(commandId, CreatePlayerActor(), CorrelationId.New()),
            payload,
            Lease("worker-a"),
            Utc(10, 0));

        var second = await coordinator.AcquireAsync(
            CreateRequest(commandId, CreatePlayerActor(), CorrelationId.New()),
            payload,
            Lease("worker-b"),
            Utc(10, 1));

        Assert.AreEqual(CommandReceiptDisposition.IntegrityViolation, second.Disposition);
    }

    [TestMethod]
    public async Task SameStableActorWithChangedCapabilities_RemainsSameIdempotencyIdentity()
    {
        var repository = new InMemoryReceiptRepository();
        var coordinator = new CommandReceiptCoordinator(repository);
        var commandId = CommandId.New();
        var accountId = AccountId.New();
        var characterId = CharacterId.New();
        var payload = Payload("same-payload");

        var actorAtReceive = TrustedActorContext.CreatePlayer(
            accountId,
            characterId,
            4,
            capabilities: new[] { new PlatformCapabilityKey("player.basic") },
            entitlements: new[] { new EntitlementKey("supporter.cosmetic") });

        var actorAtRetry = TrustedActorContext.CreatePlayer(
            accountId,
            characterId,
            5,
            capabilities: new[] { new PlatformCapabilityKey("player.basic"), new PlatformCapabilityKey("player.newly_granted") },
            entitlements: Array.Empty<EntitlementKey>());

        await coordinator.AcquireAsync(
            CreateRequest(commandId, actorAtReceive, CorrelationId.New()),
            payload,
            Lease("worker-a"),
            Utc(10, 0));

        var retry = await coordinator.AcquireAsync(
            CreateRequest(commandId, actorAtRetry, CorrelationId.New()),
            payload,
            Lease("worker-b"),
            Utc(10, 1));

        Assert.AreEqual(CommandReceiptDisposition.DuplicateInProgress, retry.Disposition);
    }

    [TestMethod]
    public async Task CompletedDuplicate_ReconstructsStoredTerminalOutcomeWithoutNewClaim()
    {
        var repository = new InMemoryReceiptRepository();
        var coordinator = new CommandReceiptCoordinator(repository);
        var commandId = CommandId.New();
        var actor = CreatePlayerActor();
        var payload = Payload("same-payload");
        var originalCorrelation = CorrelationId.New();

        var first = await coordinator.AcquireAsync(
            CreateRequest(commandId, actor, originalCorrelation),
            payload,
            Lease("worker-a"),
            Utc(10, 0));

        Assert.AreEqual(CommandReceiptDisposition.Acquired, first.Disposition);

        var terminal = CommandTerminalOutcome.Succeeded(Utc(10, 2));
        repository.Complete(commandId, terminal);

        var duplicate = await coordinator.AcquireAsync(
            CreateRequest(commandId, actor, CorrelationId.New()),
            payload,
            Lease("worker-b"),
            Utc(10, 3));

        Assert.AreEqual(CommandReceiptDisposition.DuplicateCompleted, duplicate.Disposition);
        Assert.AreSame(terminal, duplicate.TerminalOutcome);
        Assert.AreEqual(originalCorrelation, duplicate.OriginalCorrelationId);
        Assert.IsFalse(duplicate.ExecutionToken.HasValue);
    }

    [TestMethod]
    public async Task ChangedIntentContract_WithSameCommandId_IsIntegrityViolation()
    {
        var repository = new InMemoryReceiptRepository();
        var coordinator = new CommandReceiptCoordinator(repository);
        var commandId = CommandId.New();
        var actor = CreatePlayerActor();
        var payload = Payload("same-payload");

        await coordinator.AcquireAsync(
            CreateRequest(commandId, actor, CorrelationId.New(), "tests.command.a"),
            payload,
            Lease("worker-a"),
            Utc(10, 0));

        var second = await coordinator.AcquireAsync(
            CreateRequest(commandId, actor, CorrelationId.New(), "tests.command.b"),
            payload,
            Lease("worker-b"),
            Utc(10, 1));

        Assert.AreEqual(CommandReceiptDisposition.IntegrityViolation, second.Disposition);
    }

    [TestMethod]
    public void Coordinator_RejectsNonUtcReceiveTime()
    {
        var coordinator = new CommandReceiptCoordinator(new InMemoryReceiptRepository());
        var request = CreateRequest(CommandId.New(), CreatePlayerActor(), CorrelationId.New());

        Assert.ThrowsExactly<ArgumentException>(() => coordinator.AcquireAsync(
            request,
            Payload("payload"),
            Lease("worker-a"),
            new DateTimeOffset(2026, 8, 26, 10, 0, 0, TimeSpan.FromHours(1))));
    }

    [TestMethod]
    public void CanonicalPayload_IsValidJsonAndOwnsItsDeterministicFingerprint()
    {
        const string json = "{\"action\":\"test\",\"amount\":3}";
        var first = CanonicalCommandPayload.FromTrustedJson(json);
        var second = CanonicalCommandPayload.FromTrustedJson(json);
        var parsed = CommandPayloadFingerprint.Parse(first.Fingerprint.Value.ToUpperInvariant());

        Assert.AreEqual(json, first.Json);
        Assert.AreEqual(first, second);
        Assert.AreEqual(first.Fingerprint, parsed);
        Assert.AreEqual(64, first.Fingerprint.Value.Length);
    }

    [TestMethod]
    public void CanonicalPayload_RejectsInvalidJson()
    {
        Assert.ThrowsExactly<FormatException>(() => CanonicalCommandPayload.FromTrustedJson("not-json"));
    }

    [TestMethod]
    public void AcquireRequest_RejectsPayloadThatDoesNotMatchIdentityFingerprint()
    {
        var request = CreateRequest(CommandId.New(), CreatePlayerActor(), CorrelationId.New());
        var identity = CommandExecutionIdentityFactory.Create(request, Payload("payload-a"));

        Assert.ThrowsExactly<ArgumentException>(() => new CommandReceiptAcquireRequest(
            identity,
            Payload("payload-b"),
            request.Context.CorrelationId,
            Utc(10, 0),
            Lease("worker-a")));
    }

    private static CoreEvaluationRequest CreateRequest(
        CommandId commandId,
        TrustedActorContext actor,
        CorrelationId correlationId,
        string intentName = "tests.command") =>
        new(
            CoreContractVersion.V1,
            new CoreEvaluationContext(
                commandId,
                correlationId,
                actor,
                Utc(9, 59),
                new RuleVersion("tests.rules.v1"),
                new ContentVersion("tests.content.v1"),
                new FixedRandomFactory()),
            new SyntheticIntent(intentName),
            Array.Empty<IAuthoritativeSnapshot>());

    private static TrustedActorContext CreatePlayerActor() =>
        TrustedActorContext.CreatePlayer(AccountId.New(), CharacterId.New(), 1);

    private static CanonicalCommandPayload Payload(string value) =>
        CanonicalCommandPayload.FromTrustedJson($"{{\"value\":\"{value}\"}}");

    private static CommandExecutionLeaseRequest Lease(string workerId) =>
        new(workerId, TimeSpan.FromMinutes(1));

    private static DateTimeOffset Utc(int hour, int minute) =>
        new(2026, 8, 26, hour, minute, 0, TimeSpan.Zero);

    private sealed record SyntheticIntent : ICoreIntent
    {
        public SyntheticIntent(string name)
        {
            Contract = new ContractDescriptor(name, 1);
        }

        public ContractDescriptor Contract { get; }
    }

    private sealed class FixedRandomFactory : IDeterministicRandomFactory
    {
        public IDeterministicRandomSource Create() => new FixedRandomSource();

        private sealed class FixedRandomSource : IDeterministicRandomSource
        {
            public ulong NextUInt64() => 1;
        }
    }

    private sealed class InMemoryReceiptRepository : ICommandReceiptRepository
    {
        private readonly object _gate = new();
        private readonly Dictionary<CommandId, Entry> _entries = new();

        public ValueTask<CommandReceiptClaim> TryAcquireAsync(
            CommandReceiptAcquireRequest request,
            CancellationToken cancellationToken = default)
        {
            ArgumentNullException.ThrowIfNull(request);
            cancellationToken.ThrowIfCancellationRequested();

            lock (_gate)
            {
                if (!_entries.TryGetValue(request.Identity.CommandId, out var entry))
                {
                    var token = CommandExecutionToken.New();
                    _entries.Add(
                        request.Identity.CommandId,
                        new Entry(request.Identity, request.Payload, request.CorrelationId, token));
                    return ValueTask.FromResult(CommandReceiptClaim.Acquired(request.CorrelationId, token));
                }

                if (entry.Identity != request.Identity)
                {
                    return ValueTask.FromResult(CommandReceiptClaim.IntegrityViolation(entry.CorrelationId));
                }

                if (entry.TerminalOutcome is not null)
                {
                    return ValueTask.FromResult(CommandReceiptClaim.DuplicateCompleted(entry.CorrelationId, entry.TerminalOutcome));
                }

                return ValueTask.FromResult(CommandReceiptClaim.DuplicateInProgress(entry.CorrelationId));
            }
        }

        public void Complete(CommandId commandId, CommandTerminalOutcome outcome)
        {
            ArgumentNullException.ThrowIfNull(outcome);

            lock (_gate)
            {
                var entry = _entries[commandId];
                entry.TerminalOutcome = outcome;
            }
        }

        private sealed class Entry
        {
            public Entry(
                CommandExecutionIdentity identity,
                CanonicalCommandPayload payload,
                CorrelationId correlationId,
                CommandExecutionToken executionToken)
            {
                Identity = identity;
                Payload = payload;
                CorrelationId = correlationId;
                ExecutionToken = executionToken;
            }

            public CommandExecutionIdentity Identity { get; }

            public CanonicalCommandPayload Payload { get; }

            public CorrelationId CorrelationId { get; }

            public CommandExecutionToken ExecutionToken { get; }

            public CommandTerminalOutcome? TerminalOutcome { get; set; }
        }
    }
}
