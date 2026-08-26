using Nexis.Core.Contracts;
using Nexis.Identity.Contracts;

namespace Nexis.Combat.Contracts;

/// <summary>
/// Minimal authoritative Combat-owned fact required by persistent loadout rules. It deliberately
/// does not expose combat-engine internals, encounter turns or derived combat calculations.
/// </summary>
public sealed record CombatParticipationSnapshot : IAuthoritativeSnapshot
{
    public static ContractDescriptor SnapshotContract { get; } =
        new("nexis.combat.participation-snapshot", 1);

    public static OwnerKey OwnerKey { get; } = new("Combat");

    public CombatParticipationSnapshot(
        CharacterId characterId,
        long revision,
        bool isInActiveCombat)
    {
        if (characterId.IsEmpty)
        {
            throw new ArgumentException("Combat participation requires a non-empty CharacterId.", nameof(characterId));
        }

        if (revision < 0)
        {
            throw new ArgumentOutOfRangeException(nameof(revision), "Snapshot revision cannot be negative.");
        }

        CharacterId = characterId;
        Revision = revision;
        IsInActiveCombat = isInActiveCombat;
    }

    public ContractDescriptor Contract => SnapshotContract;

    public OwnerKey Owner => OwnerKey;

    public CharacterId CharacterId { get; }

    public long Revision { get; }

    public bool IsInActiveCombat { get; }
}
