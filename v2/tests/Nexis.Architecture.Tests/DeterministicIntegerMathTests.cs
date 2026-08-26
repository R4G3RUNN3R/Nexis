using Microsoft.VisualStudio.TestTools.UnitTesting;
using Nexis.Core.Numerics;

namespace Nexis.Architecture.Tests;

[TestClass]
public sealed class DeterministicIntegerMathTests
{
    [TestMethod]
    public void MultiplyDivide_AppliesExactRatioWithoutRounding()
    {
        var result = DeterministicIntegerMath.MultiplyDivide(
            100,
            150,
            100,
            DeterministicRoundingMode.ToNearestEven);

        Assert.AreEqual(150L, result);
    }

    [TestMethod]
    public void MultiplyDivide_PositiveMidpointHonorsAllRoundingModes()
    {
        Assert.AreEqual(2L, Calculate(5, 1, 2, DeterministicRoundingMode.TowardZero));
        Assert.AreEqual(3L, Calculate(5, 1, 2, DeterministicRoundingMode.AwayFromZero));
        Assert.AreEqual(2L, Calculate(5, 1, 2, DeterministicRoundingMode.Floor));
        Assert.AreEqual(3L, Calculate(5, 1, 2, DeterministicRoundingMode.Ceiling));
        Assert.AreEqual(2L, Calculate(5, 1, 2, DeterministicRoundingMode.ToNearestEven));
        Assert.AreEqual(3L, Calculate(5, 1, 2, DeterministicRoundingMode.ToNearestAwayFromZero));
    }

    [TestMethod]
    public void MultiplyDivide_NegativeMidpointHonorsAllRoundingModes()
    {
        Assert.AreEqual(-2L, Calculate(-5, 1, 2, DeterministicRoundingMode.TowardZero));
        Assert.AreEqual(-3L, Calculate(-5, 1, 2, DeterministicRoundingMode.AwayFromZero));
        Assert.AreEqual(-3L, Calculate(-5, 1, 2, DeterministicRoundingMode.Floor));
        Assert.AreEqual(-2L, Calculate(-5, 1, 2, DeterministicRoundingMode.Ceiling));
        Assert.AreEqual(-2L, Calculate(-5, 1, 2, DeterministicRoundingMode.ToNearestEven));
        Assert.AreEqual(-3L, Calculate(-5, 1, 2, DeterministicRoundingMode.ToNearestAwayFromZero));
    }

    [TestMethod]
    public void MultiplyDivide_NormalizesNegativeDenominator()
    {
        Assert.AreEqual(-2L, Calculate(5, 1, -2, DeterministicRoundingMode.TowardZero));
        Assert.AreEqual(-3L, Calculate(5, 1, -2, DeterministicRoundingMode.Floor));
        Assert.AreEqual(-2L, Calculate(5, 1, -2, DeterministicRoundingMode.Ceiling));
    }

    [TestMethod]
    public void MultiplyDivide_UsesWideIntermediateWithoutPrematureOverflow()
    {
        var result = Calculate(
            long.MaxValue,
            long.MaxValue,
            long.MaxValue,
            DeterministicRoundingMode.TowardZero);

        Assert.AreEqual(long.MaxValue, result);
    }

    [TestMethod]
    public void MultiplyDivide_ThrowsWhenFinalResultCannotFitLong()
    {
        Assert.ThrowsExactly<OverflowException>(() => Calculate(
            long.MaxValue,
            2,
            1,
            DeterministicRoundingMode.TowardZero));
    }

    [TestMethod]
    public void MultiplyDivide_ThrowsForZeroDenominator()
    {
        Assert.ThrowsExactly<DivideByZeroException>(() => Calculate(
            1,
            1,
            0,
            DeterministicRoundingMode.TowardZero));
    }

    [TestMethod]
    public void MultiplyDivide_RejectsUnknownRoundingMode()
    {
        Assert.ThrowsExactly<ArgumentOutOfRangeException>(() => Calculate(
            2,
            1,
            1,
            (DeterministicRoundingMode)999));
    }

    private static long Calculate(
        long value,
        long numerator,
        long denominator,
        DeterministicRoundingMode roundingMode) =>
        DeterministicIntegerMath.MultiplyDivide(value, numerator, denominator, roundingMode);
}
