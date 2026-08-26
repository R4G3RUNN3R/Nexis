namespace Nexis.Kernel.Randomness;

/// <summary>
/// Controlled randomness source supplied to deterministic gameplay evaluation.
/// Implementations must be replayable from retained authoritative RNG inputs.
/// </summary>
public interface IDeterministicRandomSource
{
    ulong NextUInt64();
}
