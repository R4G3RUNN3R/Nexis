using System.Text;
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
        var payload = Fingerprint("same-payload");
        var firstCorrelation = CorrelationId.New();

        var first = await coordinator.AcquireAsync(
            CreateRequest(commandId, actor, firstCorrelation),
            payload,
            Utc(10, 0));

        var duplicate = await coordinator.AcquireAsync(
            CreateRequest(commandId, actor, CorrelationId.New()),
            payload,
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
            Fingerprint("payload-a"),
            Utc(10, 0));

        var second = await coordinator.AcquireAsync(
            CreateRequest(commandId, actor, CorrelationId.New()),
            Fingerprint("payload-b"),
            Utc(10, 1));

        Assert.AreEqual(CommandReceiptDisposition.IntegrityViolation, second.Disposition);
    }

    [TestMethod]
    public async Task SameCommandWithChangedActor_IsIntegrityViolation()
    {
        var repository = new InMemoryReceiptRepository();
        var coordinator = new CommandReceiptCoordinator(repository);
        var commandId = CommandId.New();
        var payload = Fingerprint("same-payload");

        await coordinator.AcquireAsync(
            CreateRequest(commandId, CreatePlayerActor(), CorrelationId.New()),
            payload,
            Utc(10, 0));

        var second = await coordinator.AcquireAsync(
            CreateRequest(commandId, CreatePlayerActor(), CorrelationId.New()),
            payload,
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
        var payload = Fingerprint("same-payload");

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
            Utc(10, 0));

        var retry = await coordinator.AcquireAsync(
            CreateRequest(commandId, actorAtRetry, CorrelationId.New()),
            payload,
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
        var payload = Fingerprint("same-payload");
        var originalCorrelation = CorrelationId.New();

        var first = await coordinator.AcquireAsync(
            CreateRequest(commandId, actor, originalCorrelation),
            payload,
            Utc(10, 0));

        Assert.AreEqual(CommandReceiptDisposition.Acquired, first.Disposition);

        var terminal = CommandTerminalOutcome.Succeeded(Utc(10, 2));
        repository.Complete(commandId, terminal);

        var duplicate = await coordinator.AcquireAsync(
            CreateRequest(commandId, actor, CorrelationId.New()),
            payload,
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
        var payload = Fingerprint("same-payload");

        await coordinator.AcquireAsync(
            CreateRequest(commandId, actor, CorrelationId.New(), "tests.command.a"),
            payload,
            Utc(10, 0));

        var second = await coordinator.AcquireAsync(
            CreateRequest(commandId, actor, CorrelationId.New(), "tests.command.b"),
            payload,
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
            Fingerprint("payload"),
            new DateTimeOffset(2026, 8, 26, 10, 0, 0, TimeSpan.FromHours(1))));
    }

    [TestMethod]
    public void PayloadFingerprint_IsDeterministicAndNormalizesHexCase()
    {
        var payloadBytes = Encoding.UTF8.GetBytes("canonical-payload");
        var first = CommandPayloadFingerprint.Compute(payloadBytes);
        var second = CommandPayloadFingerprint.Compute(payloadBytes);
        var parsed = CommandPayloadFingerprint.Parse(first.Value.ToUpperInvariant());

        Assert.AreEqual(first, second);
        Assert.AreEqual(first, parsed);
        Assert.AreEqual(64, first.Value.Length);
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

    private static CommandPayloadFingerprint Fingerprint(string payload) =>
        CommandPayloadFingerprint.Compute(Encoding.UTF8.GetBytes(payload));

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
            CommandExecutionIdentity identity,
            CorrelationId correlationId,
            DateTimeOffset receivedAtUtc,
            CancellationToken cancellationToken = default)
        {
            cancellationToken.ThrowIfCancellationRequested();

            if (receivedAtUtc.Offset != TimeSpan.Zero)
            {
                throw new ArgumentException("Receive time must be UTC.", nameof(receivedAtUtc));
            }

            lock (_gate)
            {
                if (!_entries.TryGetValue(identity.CommandId, out var entry))
                {
                    var token = CommandExecutionToken.New();
                    _entries.Add(identity.CommandId, new Entry(identity, correlationId, token));
                    return ValueTask.FromResult(CommandReceiptClaim.Acquired(correlationId, token));
                }

                if (entry.Identity != identity)
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
                CorrelationId correlationId,
                CommandExecutionToken executionToken)
            {
                Identity = identity;
                CorrelationId = correlationId;
                ExecutionToken = executionToken;
            }

            public CommandExecutionIdentity Identity { get; }

            public CorrelationId CorrelationId { get; }

            public CommandExecutionToken ExecutionToken { get; }

            public CommandTerminalOutcome? TerminalOutcome { get; set; }
        }
    }
}
