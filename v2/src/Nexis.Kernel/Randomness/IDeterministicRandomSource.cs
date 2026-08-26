namespace Nexis.Kernel.Randomness;

/// <summary>
/// Creates a fresh deterministic random stream for a single Core evaluation.
/// Repeated calls to <see cref="Create"/> for the same factory must begin from the same retained
/// authoritative RNG inputs so identical evaluations can be replayed without sharing a mutable cursor.
/// </summary>
public interface IDeterministicRandomFactory
{
    IDeterministicRandomSource Create();
}

/// <summary>
/// Controlled random stream consumed inside one deterministic gameplay evaluation.
/// Implementations must be replayable from retained authoritative RNG inputs.
/// </summary>
public interface IDeterministicRandomSource
{
    ulong NextUInt64();
}
