using System.Globalization;
using System.Text.Json;
using Nexis.Core.Contracts;
using Nexis.Execution.Contracts;
using Nexis.Npcs.Contracts;

namespace Nexis.Modules.Npcs;

public sealed class EstablishNpcLifecycleCanonicalCommandCodec : ICanonicalCommandCodec
{
    public ContractDescriptor IntentContract => EstablishNpcLifecycleIntent.IntentContract;

    public CanonicalCommandPayload Serialize(ICoreIntent intent)
    {
        if (intent is not EstablishNpcLifecycleIntent establish)
        {
            throw new ArgumentException("NPC lifecycle codec received the wrong typed intent.", nameof(intent));
        }

        var birth = establish.BirthInstantUtc.ToString("O", CultureInfo.InvariantCulture);
        var json = string.Create(
            CultureInfo.InvariantCulture,
            $"{{\"npcId\":\"{establish.NpcId.Value:D}\",\"birthInstantUtc\":\"{birth}\"}}");
        return CanonicalCommandPayload.FromTrustedJson(json);
    }

    public ICoreIntent Deserialize(CanonicalCommandPayload payload)
    {
        ArgumentNullException.ThrowIfNull(payload);
        using var document = JsonDocument.Parse(payload.Json);
        if (document.RootElement.ValueKind != JsonValueKind.Object)
        {
            throw new FormatException("NPC lifecycle payload must be a JSON object.");
        }

        string? npcId = null;
        string? birthInstantUtc = null;
        var seen = new HashSet<string>(StringComparer.Ordinal);

        foreach (var property in document.RootElement.EnumerateObject())
        {
            if (!seen.Add(property.Name))
            {
                throw new FormatException($"NPC lifecycle payload contains duplicate property '{property.Name}'.");
            }

            switch (property.Name)
            {
                case "npcId":
                    npcId = ReadString(property);
                    break;
                case "birthInstantUtc":
                    birthInstantUtc = ReadString(property);
                    break;
                default:
                    throw new FormatException($"NPC lifecycle payload contains unknown property '{property.Name}'.");
            }
        }

        if (!Guid.TryParseExact(npcId, "D", out var parsedNpcId))
        {
            throw new FormatException("NPC lifecycle payload contains an invalid npcId.");
        }

        if (!DateTimeOffset.TryParseExact(
                birthInstantUtc,
                "O",
                CultureInfo.InvariantCulture,
                DateTimeStyles.RoundtripKind,
                out var parsedBirth) ||
            parsedBirth.Offset != TimeSpan.Zero)
        {
            throw new FormatException("NPC lifecycle payload contains an invalid UTC birthInstantUtc.");
        }

        return new EstablishNpcLifecycleIntent(new NpcId(parsedNpcId), parsedBirth);
    }

    private static string ReadString(JsonProperty property)
    {
        if (property.Value.ValueKind != JsonValueKind.String)
        {
            throw new FormatException($"NPC lifecycle payload property '{property.Name}' must be a string.");
        }

        return property.Value.GetString()
            ?? throw new FormatException($"NPC lifecycle payload property '{property.Name}' cannot be null.");
    }
}
