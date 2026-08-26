namespace Nexis.Core.Numerics;

/// <summary>
/// Deterministic integer/rational helpers for the concrete Nexis Core implementation.
/// Intermediate arithmetic uses Int128 and final narrowing is checked so authoritative gameplay
/// never silently wraps on overflow.
/// </summary>
public static class DeterministicIntegerMath
{
    public static long MultiplyDivide(
        long value,
        long numerator,
        long denominator,
        DeterministicRoundingMode roundingMode)
    {
        if (denominator == 0)
        {
            throw new DivideByZeroException("Deterministic ratio denominator cannot be zero.");
        }

        ValidateRoundingMode(roundingMode);

        var normalizedNumerator = (Int128)numerator;
        var normalizedDenominator = (Int128)denominator;

        if (normalizedDenominator < 0)
        {
            normalizedNumerator = -normalizedNumerator;
            normalizedDenominator = -normalizedDenominator;
        }

        var product = (Int128)value * normalizedNumerator;
        var quotient = product / normalizedDenominator;
        var remainder = product % normalizedDenominator;
        var rounded = Round(quotient, remainder, normalizedDenominator, roundingMode);

        return checked((long)rounded);
    }

    private static void ValidateRoundingMode(DeterministicRoundingMode roundingMode)
    {
        switch (roundingMode)
        {
            case DeterministicRoundingMode.TowardZero:
            case DeterministicRoundingMode.AwayFromZero:
            case DeterministicRoundingMode.Floor:
            case DeterministicRoundingMode.Ceiling:
            case DeterministicRoundingMode.ToNearestEven:
            case DeterministicRoundingMode.ToNearestAwayFromZero:
                return;
            default:
                throw new ArgumentOutOfRangeException(
                    nameof(roundingMode),
                    roundingMode,
                    "Unknown deterministic rounding mode.");
        }
    }

    private static Int128 Round(
        Int128 quotient,
        Int128 remainder,
        Int128 positiveDenominator,
        DeterministicRoundingMode roundingMode)
    {
        if (remainder == 0)
        {
            return quotient;
        }

        var direction = remainder > 0 ? (Int128)1 : -1;

        return roundingMode switch
        {
            DeterministicRoundingMode.TowardZero => quotient,
            DeterministicRoundingMode.AwayFromZero => quotient + direction,
            DeterministicRoundingMode.Floor => remainder < 0 ? quotient - 1 : quotient,
            DeterministicRoundingMode.Ceiling => remainder > 0 ? quotient + 1 : quotient,
            DeterministicRoundingMode.ToNearestEven => RoundToNearest(
                quotient,
                remainder,
                positiveDenominator,
                direction,
                midpointAwayFromZero: false),
            DeterministicRoundingMode.ToNearestAwayFromZero => RoundToNearest(
                quotient,
                remainder,
                positiveDenominator,
                direction,
                midpointAwayFromZero: true),
            _ => throw new System.Diagnostics.UnreachableException("Rounding mode was validated before calculation.")
        };
    }

    private static Int128 RoundToNearest(
        Int128 quotient,
        Int128 remainder,
        Int128 positiveDenominator,
        Int128 direction,
        bool midpointAwayFromZero)
    {
        var absoluteRemainder = remainder < 0 ? -remainder : remainder;
        var doubledRemainder = absoluteRemainder * 2;

        if (doubledRemainder < positiveDenominator)
        {
            return quotient;
        }

        if (doubledRemainder > positiveDenominator)
        {
            return quotient + direction;
        }

        if (midpointAwayFromZero)
        {
            return quotient + direction;
        }

        return quotient % 2 == 0
            ? quotient
            : quotient + direction;
    }
}
