using System.Globalization;
using System.Text.Json;
using Nexis.Core.Contracts;
using Nexis.Equipment.Contracts;
using Nexis.Execution.Contracts;
using Nexis.Identity.Contracts;
using Nexis.Items.Contracts;

namespace Nexis.Modules.Equipment;

/// <summary>
/// Explicit stable codec for Equip Item schema v1. Property order and GUID formatting are fixed so
/// the canonical payload fingerprint is deterministic and recoverable across process restarts.
/// </summary>
public sealed class EquipItemCanonicalCommandCodec : ICanonicalCommandCodec
{
    public ContractDescriptor IntentContract => EquipItemIntent.IntentContract;

    public CanonicalCommandPayload Serialize(ICoreIntent intent)
    {
        if (intent is not EquipItemIntent equip)
        {
            throw new ArgumentException("Equip Item codec received the wrong typed intent.", nameof(intent));
        }

        var placementJson = JsonSerializer.Serialize(equip.PlacementKey.Value);
        var json = string.Create(
            CultureInfo.InvariantCulture,
            $"{{\"characterId\":\"{equip.CharacterId.Value:D}\",\"itemInstanceId\":\"{equip.ItemInstanceId.Value:D}\",\"placement\":{placementJson}}}");
        return CanonicalCommandPayload.FromTrustedJson(json);
    }

    public ICoreIntent Deserialize(CanonicalCommandPayload payload)
    {
        ArgumentNullException.ThrowIfNull(payload);
        using var document = JsonDocument.Parse(payload.Json);
        if (document.RootElement.ValueKind != JsonValueKind.Object)
        {
            throw new FormatException("Equip Item payload must be a JSON object.");
        }

        string? characterId = null;
        string? itemInstanceId = null;
        string? placement = null;
        var seen = new HashSet<string>(StringComparer.Ordinal);

        foreach (var property in document.RootElement.EnumerateObject())
        {
            if (!seen.Add(property.Name))
            {
                throw new FormatException($"Equip Item payload contains duplicate property '{property.Name}'.");
            }

            switch (property.Name)
            {
                case "characterId":
                    characterId = ReadString(property);
                    break;
                case "itemInstanceId":
                    itemInstanceId = ReadString(property);
                    break;
                case "placement":
                    placement = ReadString(property);
                    break;
                default:
                    throw new FormatException($"Equip Item payload contains unknown property '{property.Name}'.");
            }
        }

        if (!Guid.TryParseExact(characterId, "D", out var parsedCharacterId))
        {
            throw new FormatException("Equip Item payload contains an invalid characterId.");
        }

        if (!Guid.TryParseExact(itemInstanceId, "D", out var parsedItemInstanceId))
        {
            throw new FormatException("Equip Item payload contains an invalid itemInstanceId.");
        }

        if (string.IsNullOrWhiteSpace(placement))
        {
            throw new FormatException("Equip Item payload is missing placement.");
        }

        return new EquipItemIntent(
            new CharacterId(parsedCharacterId),
            new ItemInstanceId(parsedItemInstanceId),
            new EquipmentPlacementKey(placement));
    }

    private static string ReadString(JsonProperty property)
    {
        if (property.Value.ValueKind != JsonValueKind.String)
        {
            throw new FormatException($"Equip Item payload property '{property.Name}' must be a string.");
        }

        return property.Value.GetString()
            ?? throw new FormatException($"Equip Item payload property '{property.Name}' cannot be null.");
    }
}
