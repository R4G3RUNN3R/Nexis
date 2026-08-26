using Nexis.Core.Contracts;

namespace Nexis.Execution.Contracts;

/// <summary>
/// Explicit versioned codec for one typed command intent contract. Implementations own a stable
/// canonical JSON representation for their schema. Runtime CLR type names and reflection metadata
/// are never persisted as command authority.
/// </summary>
public interface ICanonicalCommandCodec
{
    ContractDescriptor IntentContract { get; }

    CanonicalCommandPayload Serialize(ICoreIntent intent);

    ICoreIntent Deserialize(CanonicalCommandPayload payload);
}
