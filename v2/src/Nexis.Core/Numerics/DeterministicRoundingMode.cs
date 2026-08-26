namespace Nexis.Core.Numerics;

/// <summary>
/// Explicit rounding strategies for authoritative integer/rational gameplay calculations.
/// Rule implementations must choose a mode deliberately instead of inheriting runtime defaults.
/// </summary>
public enum DeterministicRoundingMode
{
    TowardZero = 0,
    AwayFromZero = 1,
    Floor = 2,
    Ceiling = 3,
    ToNearestEven = 4,
    ToNearestAwayFromZero = 5
}
