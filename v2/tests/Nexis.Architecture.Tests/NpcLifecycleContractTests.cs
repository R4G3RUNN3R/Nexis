using Microsoft.VisualStudio.TestTools.UnitTesting;
using Nexis.Npcs.Contracts;

namespace Nexis.Architecture.Tests;

[TestClass]
public sealed class NpcLifecycleContractTests
{
    [TestMethod]
    public void NpcId_IsStableNonEmptyGuidIdentity()
    {
        var id = NpcId.New();
        Assert.IsFalse(id.IsEmpty);
        Assert.AreEqual(id.Value.ToString("D"), id.ToString());
        Assert.ThrowsExactly<ArgumentException>(() =>
            new NpcLifecycleSnapshot(
                new NpcId(Guid.Empty), 1,
                new DateTimeOffset(2026, 9, 16, 10, 0, 0, TimeSpan.Zero),
                NpcLifecycleStatus.Living));
    }

    [TestMethod]
    public void LifecycleSnapshot_UsesOneOwnerAndRejectsInvalidShape()
    {
        var id = NpcId.New();
        var birth = new DateTimeOffset(2000, 9, 16, 10, 0, 0, TimeSpan.Zero);
        var snapshot = new NpcLifecycleSnapshot(id, 1, birth, NpcLifecycleStatus.Living);

        Assert.AreEqual("NpcLifecycle", snapshot.Owner.Value);
        Assert.AreEqual(1L, snapshot.Revision);
        Assert.AreEqual(birth, snapshot.BirthInstantUtc);
        Assert.AreEqual(NpcLifecycleStatus.Living, snapshot.Status);
        Assert.ThrowsExactly<ArgumentOutOfRangeException>(() =>
            new NpcLifecycleSnapshot(id, -1, birth, NpcLifecycleStatus.Living));
        Assert.ThrowsExactly<ArgumentException>(() =>
            new NpcLifecycleSnapshot(id, 1, birth.ToOffset(TimeSpan.FromHours(1)), NpcLifecycleStatus.Living));
        Assert.ThrowsExactly<ArgumentOutOfRangeException>(() =>
            new NpcLifecycleSnapshot(id, 1, birth, (NpcLifecycleStatus)999));
    }

    [TestMethod]
    public void ChronologicalAge_UsesAnniversaryRatherThanFixedDayCount()
    {
        var birth = new DateTimeOffset(2000, 9, 16, 10, 30, 0, TimeSpan.Zero);

        Assert.AreEqual(24, NpcChronology.CalculateChronologicalAge(
            birth,
            new DateTimeOffset(2025, 9, 16, 10, 29, 59, TimeSpan.Zero)));
        Assert.AreEqual(25, NpcChronology.CalculateChronologicalAge(
            birth,
            new DateTimeOffset(2025, 9, 16, 10, 30, 0, TimeSpan.Zero)));
    }

    [TestMethod]
    public void ChronologicalAge_February29UsesAddYearsCalendarSemantics()
    {
        var birth = new DateTimeOffset(2024, 2, 29, 12, 0, 0, TimeSpan.Zero);

        Assert.AreEqual(0, NpcChronology.CalculateChronologicalAge(
            birth,
            new DateTimeOffset(2025, 2, 28, 11, 59, 59, TimeSpan.Zero)));
        Assert.AreEqual(1, NpcChronology.CalculateChronologicalAge(
            birth,
            new DateTimeOffset(2025, 2, 28, 12, 0, 0, TimeSpan.Zero)));
    }

    [TestMethod]
    public void ChronologicalAge_RejectsNonUtcOrPreBirthEvaluation()
    {
        var birth = new DateTimeOffset(2026, 9, 16, 12, 0, 0, TimeSpan.Zero);

        Assert.ThrowsExactly<ArgumentException>(() =>
            NpcChronology.CalculateChronologicalAge(
                birth.ToOffset(TimeSpan.FromHours(1)), birth));
        Assert.ThrowsExactly<ArgumentException>(() =>
            NpcChronology.CalculateChronologicalAge(
                birth, birth.ToOffset(TimeSpan.FromHours(1))));
        Assert.ThrowsExactly<ArgumentOutOfRangeException>(() =>
            NpcChronology.CalculateChronologicalAge(birth, birth.AddTicks(-1)));
    }
}
