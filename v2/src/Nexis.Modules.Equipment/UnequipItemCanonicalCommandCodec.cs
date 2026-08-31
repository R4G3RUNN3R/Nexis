using System.Globalization;
using System.Text.Json;
using Nexis.Core.Contracts;
using Nexis.Equipment.Contracts;
using Nexis.Execution.Contracts;
using Nexis.Identity.Contracts;
using Nexis.Items.Contracts;

namespace Nexis.Modules.Equipment;

/// <summary>
/// Explicit stable codec for Unequip Item schema v1. Property order and GUID formatting are fixed so
/// the canonical payload fingerprint is deterministic and recoverable across process restarts.
/// </summary>
public sealed class UnequipItemCanonicalCommandCodec : ICanonicalCommandCodec
{
    public ContractDescriptor IntentContract => UnequipItemIntent.IntentContract;

    public CanonicalCommandPayload Serialize(ICoreIntent intent)
    {
        if (intent is not UnequipItemIntent unequip)
        {
            throw new ArgumentException("Unequip Item codec received the wrong typed intent.", nameof(intent));
        }

        var json = string.Create(
            CultureInfo.InvariantCulture,
            $"{{\"characterId\":\"{unequip.CharacterId.Value:D}\",\"itemInstanceId\":\"{unequip.ItemInstanceId.Value:D}\"}}");
        return CanonicalCommandPayload.FromTrustedJson(json);
    }

    public ICoreIntent Deserialize(CanonicalCommandPayload payload)
    {
        ArgumentNullException.ThrowIfNull(payload);
        using var document = JsonDocument.Parse(payload.Json);
        if (document.RootElement.ValueKind != JsonValueKind.Object)
        {
            throw new FormatException("Unequip Item payload must be a JSON object.");
        }

        string? characterId = null;
        string? itemInstanceId = null;
        var seen = new HashSet<string>(StringComparer.Ordinal);

        foreach (var property in document.RootElement.EnumerateObject())
        {
            if (!seen.Add(property.Name))
            {
                throw new FormatException($"Unequip Item payload contains duplicate property '{property.Name}'.");
            }

            switch (property.Name)
            {
                case "characterId":
                    characterId = ReadString(property);
                    break;
                case "itemInstanceId":
                    itemInstanceId = ReadString(property);
                    break;
                default:
                    throw new FormatException($"Unequip Item payload contains unknown property '{property.Name}'.");
            }
        }

        if (!Guid.TryParseExact(characterId, "D", out var parsedCharacterId))
        {
            throw new FormatException("Unequip Item payload contains an invalid characterId.");
        }

        if (!Guid.TryParseExact(itemInstanceId, "D", out var parsedItemInstanceId))
        {
            throw new FormatException("Unequip Item payload contains an invalid itemInstanceId.");
        }

        return new UnequipItemIntent(
            new CharacterId(parsedCharacterId),
            new ItemInstanceId(parsedItemInstanceId));
    }

    private static string ReadString(JsonProperty property)
    {
        if (property.Value.ValueKind != JsonValueKind.String)
        {
            throw new FormatException($"Unequip Item payload property '{property.Name}' must be a string.");
        }

        return property.Value.GetString()
            ?? throw new FormatException($"Unequip Item payload property '{property.Name}' cannot be null.");
    }
}
