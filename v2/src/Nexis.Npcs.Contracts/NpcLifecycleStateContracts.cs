using Nexis.Core.Contracts;

namespace Nexis.Npcs.Contracts;

public sealed record NpcLifecycleSnapshot : IAuthoritativeSnapshot
{
    public static ContractDescriptor SnapshotContract { get; } =
        new("nexis.npcs.lifecycle-snapshot", 1);

    public static OwnerKey OwnerKey { get; } = new("NpcLifecycle");

    public NpcLifecycleSnapshot(
        NpcId npcId,
        long revision,
        DateTimeOffset birthInstantUtc,
        NpcLifecycleStatus status)
    {
        if (npcId.IsEmpty)
        {
            throw new ArgumentException("NPC lifecycle snapshots require a non-empty NpcId.", nameof(npcId));
        }

        if (revision < 0)
        {
            throw new ArgumentOutOfRangeException(nameof(revision), "Lifecycle revision cannot be negative.");
        }

        if (birthInstantUtc.Offset != TimeSpan.Zero)
        {
            throw new ArgumentException("NPC birth instant must be UTC.", nameof(birthInstantUtc));
        }

        if (!Enum.IsDefined(status))
        {
            throw new ArgumentOutOfRangeException(nameof(status));
        }

        NpcId = npcId;
        Revision = revision;
        BirthInstantUtc = birthInstantUtc;
        Status = status;
    }

    public ContractDescriptor Contract => SnapshotContract;
    public OwnerKey Owner => OwnerKey;
    public NpcId NpcId { get; }
    public long Revision { get; }
    public DateTimeOffset BirthInstantUtc { get; }
    public NpcLifecycleStatus Status { get; }
}
