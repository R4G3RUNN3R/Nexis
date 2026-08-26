using Nexis.Core.Contracts;
using Nexis.Execution.Contracts;

namespace Nexis.Execution;

/// <summary>
/// Explicit command-codec registry keyed by stable intent contract name + schema version. This is
/// the only supported recovery rehydration path; no assembly scanning, CLR type-name activation or
/// arbitrary JSON-to-object deserialization is performed here.
/// </summary>
public sealed class CanonicalCommandCodecRegistry
{
    private readonly IReadOnlyDictionary<ContractDescriptor, ICanonicalCommandCodec> _codecs;

    public CanonicalCommandCodecRegistry(IEnumerable<ICanonicalCommandCodec> codecs)
    {
        ArgumentNullException.ThrowIfNull(codecs);

        var registered = new Dictionary<ContractDescriptor, ICanonicalCommandCodec>();
        foreach (var codec in codecs)
        {
            if (codec is null)
            {
                throw new ArgumentException("Command codec collections cannot contain null entries.", nameof(codecs));
            }

            var contract = codec.IntentContract
                ?? throw new ArgumentException("Command codecs must declare a non-null intent contract.", nameof(codecs));

            if (!registered.TryAdd(contract, codec))
            {
                throw new ArgumentException(
                    $"A canonical command codec is already registered for '{contract.Name}' schema {contract.SchemaVersion}.",
                    nameof(codecs));
            }
        }

        _codecs = registered;
    }

    public CanonicalCommandPayload Serialize(ICoreIntent intent)
    {
        ArgumentNullException.ThrowIfNull(intent);
        var contract = intent.Contract
            ?? throw new InvalidOperationException("Command intent returned a null contract descriptor.");
        var codec = Resolve(contract);
        var payload = codec.Serialize(intent)
            ?? throw new InvalidOperationException($"Command codec for '{contract.Name}' schema {contract.SchemaVersion} returned null payload.");

        return payload;
    }

    public ICoreIntent Deserialize(
        ContractDescriptor intentContract,
        CanonicalCommandPayload payload)
    {
        ArgumentNullException.ThrowIfNull(intentContract);
        ArgumentNullException.ThrowIfNull(payload);

        var codec = Resolve(intentContract);
        var intent = codec.Deserialize(payload)
            ?? throw new InvalidOperationException(
                $"Command codec for '{intentContract.Name}' schema {intentContract.SchemaVersion} returned null intent.");
        var actualContract = intent.Contract
            ?? throw new InvalidOperationException("Recovered command intent returned a null contract descriptor.");

        if (actualContract != intentContract)
        {
            throw new InvalidOperationException(
                $"Command codec registered for '{intentContract.Name}' schema {intentContract.SchemaVersion} returned " +
                $"intent contract '{actualContract.Name}' schema {actualContract.SchemaVersion}.");
        }

        return intent;
    }

    public ICoreIntent Deserialize(RecoveredCommandExecution recoveredCommand)
    {
        ArgumentNullException.ThrowIfNull(recoveredCommand);
        return Deserialize(recoveredCommand.IntentContract, recoveredCommand.Payload);
    }

    public bool Supports(ContractDescriptor intentContract)
    {
        ArgumentNullException.ThrowIfNull(intentContract);
        return _codecs.ContainsKey(intentContract);
    }

    private ICanonicalCommandCodec Resolve(ContractDescriptor contract) =>
        _codecs.TryGetValue(contract, out var codec)
            ? codec
            : throw new KeyNotFoundException(
                $"No canonical command codec is registered for '{contract.Name}' schema {contract.SchemaVersion}.");
}
