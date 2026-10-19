using Nexis.Core.Contracts;

namespace Nexis.Npcs.Contracts;

public sealed record EstablishNpcLifecycleIntent : ICoreIntent
{
    public static ContractDescriptor IntentContract { get; } =
        new("nexis.npcs.establish-lifecycle", 1);

    public EstablishNpcLifecycleIntent(NpcId npcId, DateTimeOffset birthInstantUtc)
    {
        Validate(npcId, birthInstantUtc);
        NpcId = npcId;
        BirthInstantUtc = birthInstantUtc;
    }

    public ContractDescriptor Contract => IntentContract;
    public NpcId NpcId { get; }
    public DateTimeOffset BirthInstantUtc { get; }

    internal static void Validate(NpcId npcId, DateTimeOffset birthInstantUtc)
    {
        if (npcId.IsEmpty)
        {
            throw new ArgumentException("NPC lifecycle establishment requires a non-empty NpcId.", nameof(npcId));
        }

        if (birthInstantUtc.Offset != TimeSpan.Zero)
        {
            throw new ArgumentException("NPC birth instant must be UTC.", nameof(birthInstantUtc));
        }
    }
}

public sealed record CreateNpcLifecycleTransition : IOwnerTransition
{
    public static ContractDescriptor TransitionContract { get; } =
        new("nexis.npcs.create-lifecycle", 1);

    public CreateNpcLifecycleTransition(NpcId npcId, DateTimeOffset birthInstantUtc)
    {
        EstablishNpcLifecycleIntent.Validate(npcId, birthInstantUtc);
        NpcId = npcId;
        BirthInstantUtc = birthInstantUtc;
    }

    public ContractDescriptor Contract => TransitionContract;
    public OwnerKey TargetOwner => NpcLifecycleSnapshot.OwnerKey;
    public long? ExpectedRevision => null;
    public NpcId NpcId { get; }
    public DateTimeOffset BirthInstantUtc { get; }
}

public sealed record NpcLifecycleEstablishedEvent : ICoreEventDescriptor
{
    public static ContractDescriptor EventContract { get; } =
        new("nexis.npcs.lifecycle-established", 1);

    public NpcLifecycleEstablishedEvent(NpcId npcId, DateTimeOffset birthInstantUtc)
    {
        EstablishNpcLifecycleIntent.Validate(npcId, birthInstantUtc);
        NpcId = npcId;
        BirthInstantUtc = birthInstantUtc;
    }

    public ContractDescriptor Contract => EventContract;
    public NpcId NpcId { get; }
    public DateTimeOffset BirthInstantUtc { get; }
}
