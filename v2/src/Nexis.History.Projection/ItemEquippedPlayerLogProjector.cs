using System.Text.Json;
using Nexis.Equipment.Contracts;
using Nexis.Eventing.Contracts;
using Nexis.History.Contracts;
using Nexis.Identity.Contracts;

namespace Nexis.History.Projection;

/// <summary>
/// First real gameplay Player Log projection. It deliberately exposes only the Character audience and
/// semantic placement key; item-instance identity and the raw authoritative event payload remain internal.
/// </summary>
public sealed class ItemEquippedPlayerLogProjector : IPlayerLogEventProjector
{
    private static readonly PlayerLogCategoryKey EquipmentCategory = new("equipment");
    private static readonly PlayerLogTemplateKey ItemEquippedTemplate = new("equipment.item-equipped");

    public Nexis.Core.Contracts.ContractDescriptor SourceContract => ItemEquippedEvent.EventContract;

    public IReadOnlyList<PlayerLogEntry> Project(CommittedEventMessage message)
    {
        ArgumentNullException.ThrowIfNull(message);
        if (message.Contract != SourceContract)
        {
            throw new ArgumentException("Item Equipped projector received the wrong event contract.", nameof(message));
        }

        try
        {
            using var document = JsonDocument.Parse(message.PayloadJson);
            var root = document.RootElement;
            var characterId = new CharacterId(ReadGuidValue(root, "CharacterId"));
            var placement = ReadStringValue(root, "PlacementKey");

            return new[]
            {
                new PlayerLogEntry(
                    PlayerLogAudience.ForCharacter(characterId),
                    PlayerLogSource.FromEvent(message.EventId),
                    message.CorrelationId,
                    message.OccurredAtUtc,
                    EquipmentCategory,
                    ItemEquippedTemplate,
                    new[]
                    {
                        new PlayerLogArgument("placement", new PlayerLogPlainText(placement))
                    })
            };
        }
        catch (JsonException exception)
        {
            throw new InvalidOperationException("Item Equipped event payload does not match its versioned Player Log projection schema.", exception);
        }
    }

    private static Guid ReadGuidValue(JsonElement root, string propertyName)
    {
        var value = ReadProperty(root, propertyName);
        if (value.ValueKind == JsonValueKind.Object)
        {
            value = ReadProperty(value, "Value");
        }

        if (value.ValueKind == JsonValueKind.String && Guid.TryParse(value.GetString(), out var parsed) && parsed != Guid.Empty)
        {
            return parsed;
        }

        throw new JsonException($"'{propertyName}' is not a non-empty GUID value.");
    }

    private static string ReadStringValue(JsonElement root, string propertyName)
    {
        var value = ReadProperty(root, propertyName);
        if (value.ValueKind == JsonValueKind.Object)
        {
            value = ReadProperty(value, "Value");
        }

        if (value.ValueKind == JsonValueKind.String && !string.IsNullOrWhiteSpace(value.GetString()))
        {
            return value.GetString()!;
        }

        throw new JsonException($"'{propertyName}' is not a non-empty string value.");
    }

    private static JsonElement ReadProperty(JsonElement element, string propertyName)
    {
        if (element.ValueKind != JsonValueKind.Object || !element.TryGetProperty(propertyName, out var value))
        {
            throw new JsonException($"Required property '{propertyName}' is missing.");
        }

        return value;
    }
}
