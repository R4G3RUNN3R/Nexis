using System.Text.Json;
using Microsoft.VisualStudio.TestTools.UnitTesting;
using Nexis.Core.Contracts;
using Nexis.Execution;
using Nexis.Execution.Contracts;
using Nexis.Identity.Contracts;
using Nexis.Kernel.Commands;
using Nexis.Kernel.Events;

namespace Nexis.Architecture.Tests;

[TestClass]
public sealed class CanonicalCommandCodecRegistryTests
{
    [TestMethod]
    public void Serialize_UsesExplicitContractCodecAndProducesStablePayload()
    {
        var registry = new CanonicalCommandCodecRegistry(new[] { new SyntheticCodec() });
        var intent = new SyntheticIntent("iron", 7);

        var first = registry.Serialize(intent);
        var second = registry.Serialize(intent);

        Assert.AreEqual("{\"name\":\"iron\",\"amount\":7}", first.Json);
        Assert.AreEqual(first, second);
        Assert.AreEqual(first.Fingerprint, second.Fingerprint);
    }

    [TestMethod]
    public void Deserialize_RehydratesOnlyRegisteredContractSchema()
    {
        var registry = new CanonicalCommandCodecRegistry(new[] { new SyntheticCodec() });
        var payload = CanonicalCommandPayload.FromTrustedJson("{\"name\":\"oak\",\"amount\":3}");

        var recovered = registry.Deserialize(SyntheticIntent.ContractDescriptor, payload);

        Assert.IsInstanceOfType<SyntheticIntent>(recovered);
        var typed = (SyntheticIntent)recovered;
        Assert.AreEqual("oak", typed.Name);
        Assert.AreEqual(3, typed.Amount);
    }

    [TestMethod]
    public void DifferentSchema_IsNotSilentlyAccepted()
    {
        var registry = new CanonicalCommandCodecRegistry(new[] { new SyntheticCodec() });
        var differentSchema = new ContractDescriptor("tests.codec.command", 2);
        var payload = CanonicalCommandPayload.FromTrustedJson("{\"name\":\"oak\",\"amount\":3}");

        Assert.ThrowsExactly<KeyNotFoundException>(() => registry.Deserialize(differentSchema, payload));
    }

    [TestMethod]
    public void DuplicateCodecRegistration_IsRejected()
    {
        Assert.ThrowsExactly<ArgumentException>(() => new CanonicalCommandCodecRegistry(
            new ICanonicalCommandCodec[] { new SyntheticCodec(), new SyntheticCodec() }));
    }

    [TestMethod]
    public void CodecReturningDifferentIntentContract_IsRejected()
    {
        var registry = new CanonicalCommandCodecRegistry(new ICanonicalCommandCodec[] { new MismatchedCodec() });
        var payload = CanonicalCommandPayload.FromTrustedJson("{\"name\":\"oak\",\"amount\":3}");

        Assert.ThrowsExactly<InvalidOperationException>(() =>
            registry.Deserialize(MismatchedCodec.RegisteredContract, payload));
    }

    [TestMethod]
    public void RecoveredCommand_UsesStoredContractAndPayloadWithoutCreatingAuthority()
    {
        var registry = new CanonicalCommandCodecRegistry(new[] { new SyntheticCodec() });
        var payload = CanonicalCommandPayload.FromTrustedJson("{\"name\":\"oak\",\"amount\":3}");
        var accountId = AccountId.New();
        var characterId = CharacterId.New();
        var recovered = new RecoveredCommandExecution(
            CommandId.New(),
            CommandExecutionLane.Player,
            accountId,
            characterId,
            SyntheticIntent.ContractDescriptor,
            payload,
            CorrelationId.New(),
            new DateTimeOffset(2026, 8, 26, 10, 0, 0, TimeSpan.Zero),
            CommandExecutionToken.New(),
            "recovery-worker",
            new DateTimeOffset(2026, 8, 26, 10, 1, 0, TimeSpan.Zero));

        var intent = registry.Deserialize(recovered);

        Assert.IsInstanceOfType<SyntheticIntent>(intent);
        Assert.AreEqual(accountId, recovered.AccountId);
        Assert.AreEqual(characterId, recovered.CharacterId);
    }

    private sealed record SyntheticIntent(string Name, int Amount) : ICoreIntent
    {
        public static ContractDescriptor ContractDescriptor { get; } = new("tests.codec.command", 1);

        public ContractDescriptor Contract => ContractDescriptor;
    }

    private sealed class SyntheticCodec : ICanonicalCommandCodec
    {
        public ContractDescriptor IntentContract => SyntheticIntent.ContractDescriptor;

        public CanonicalCommandPayload Serialize(ICoreIntent intent)
        {
            if (intent is not SyntheticIntent typed)
            {
                throw new ArgumentException("Synthetic codec received the wrong typed intent.", nameof(intent));
            }

            var name = JsonSerializer.Serialize(typed.Name);
            return CanonicalCommandPayload.FromTrustedJson($"{{\"name\":{name},\"amount\":{typed.Amount}}}");
        }

        public ICoreIntent Deserialize(CanonicalCommandPayload payload)
        {
            using var document = JsonDocument.Parse(payload.Json);
            return new SyntheticIntent(
                document.RootElement.GetProperty("name").GetString()
                    ?? throw new InvalidOperationException("Synthetic payload name is missing."),
                document.RootElement.GetProperty("amount").GetInt32());
        }
    }

    private sealed class MismatchedCodec : ICanonicalCommandCodec
    {
        public static ContractDescriptor RegisteredContract { get; } = new("tests.codec.mismatch", 1);

        public ContractDescriptor IntentContract => RegisteredContract;

        public CanonicalCommandPayload Serialize(ICoreIntent intent) =>
            throw new NotSupportedException();

        public ICoreIntent Deserialize(CanonicalCommandPayload payload) => new SyntheticIntent("wrong", 1);
    }
}
