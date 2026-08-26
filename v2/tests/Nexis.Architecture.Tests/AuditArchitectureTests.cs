using Microsoft.VisualStudio.TestTools.UnitTesting;
using Nexis.Audit.Contracts;
using Nexis.Identity.Contracts;
using Nexis.Kernel.Events;
using Nexis.Modules.Audit;

namespace Nexis.Architecture.Tests;

[TestClass]
public sealed class AuditArchitectureTests
{
    [TestMethod]
    public void AuditContracts_ReferenceOnlyStableFoundationAssemblies()
    {
        var references = GetNexisReferences(typeof(AuditEntry).Assembly);

        CollectionAssert.AreEquivalent(
            new[] { "Nexis.Identity.Contracts", "Nexis.Kernel" },
            references);
    }

    [TestMethod]
    public void AuditImplementation_DependsOnlyOnStableAuditContracts()
    {
        var references = GetNexisReferences(typeof(AuditAssemblyMarker).Assembly);

        CollectionAssert.AreEquivalent(new[] { "Nexis.Audit.Contracts" }, references);
    }

    [TestMethod]
    public void AuditEntry_UsesTypedIdentityAndEventPrimitives()
    {
        var properties = typeof(AuditEntry).GetProperties().ToDictionary(static property => property.Name);

        Assert.AreEqual(typeof(AccountId), properties[nameof(AuditEntry.ActingAccountId)].PropertyType);
        Assert.AreEqual(typeof(AccountId?), properties[nameof(AuditEntry.TargetAccountId)].PropertyType);
        Assert.AreEqual(typeof(CorrelationId), properties[nameof(AuditEntry.CorrelationId)].PropertyType);
        Assert.AreEqual(typeof(EventId?), properties[nameof(AuditEntry.CausationEventId)].PropertyType);
    }

    [TestMethod]
    public void AuditEntry_RejectsNonUtcOccurrenceTime()
    {
        Assert.ThrowsExactly<ArgumentException>(() => new AuditEntry(
            AuditId.New(),
            AccountId.New(),
            null,
            AuditActionKind.PrivilegedRead,
            AuditVisibility.InternalOnly,
            new DateTimeOffset(2026, 8, 26, 10, 0, 0, TimeSpan.FromHours(1)),
            "admin.read",
            "allowed",
            null,
            null,
            CorrelationId.New(),
            null));
    }

    private static string[] GetNexisReferences(System.Reflection.Assembly assembly) =>
        assembly.GetReferencedAssemblies()
            .Select(static reference => reference.Name ?? string.Empty)
            .Where(static name => name.StartsWith("Nexis.", StringComparison.Ordinal))
            .OrderBy(static name => name, StringComparer.Ordinal)
            .ToArray();
}
