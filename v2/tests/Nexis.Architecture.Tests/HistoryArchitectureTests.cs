using Microsoft.VisualStudio.TestTools.UnitTesting;
using Nexis.History.Contracts;
using Nexis.History.Projection;

namespace Nexis.Architecture.Tests;

[TestClass]
public sealed class HistoryArchitectureTests
{
    [TestMethod]
    public void HistoryContracts_ReferenceOnlyStableFoundationContracts()
    {
        var references = GetNexisReferences(typeof(PlayerLogEntry).Assembly);

        CollectionAssert.AreEquivalent(
            new[]
            {
                "Nexis.Audit.Contracts",
                "Nexis.Core.Contracts",
                "Nexis.Eventing.Contracts",
                "Nexis.Identity.Contracts",
                "Nexis.Kernel"
            },
            references);
    }

    [TestMethod]
    public void HistoryProjection_DoesNotReferencePersistenceConcreteCoreOrExecutionImplementation()
    {
        var references = GetNexisReferences(typeof(PlayerLogProjectionRegistry).Assembly);

        CollectionAssert.AreEquivalent(
            new[]
            {
                "Nexis.Audit.Contracts",
                "Nexis.Core.Contracts",
                "Nexis.Equipment.Contracts",
                "Nexis.Eventing.Contracts",
                "Nexis.History.Contracts",
                "Nexis.Identity.Contracts",
                "Nexis.Items.Contracts",
                "Nexis.Kernel"
            },
            references);

        Assert.IsFalse(references.Contains("Nexis.Persistence.Postgres", StringComparer.Ordinal));
        Assert.IsFalse(references.Contains("Nexis.Core", StringComparer.Ordinal));
        Assert.IsFalse(references.Contains("Nexis.Execution", StringComparer.Ordinal));
    }

    [TestMethod]
    public void PlayerLogEntry_HasNoRawPayloadOrGenericObjectBag()
    {
        var properties = typeof(PlayerLogEntry).GetProperties();

        Assert.IsFalse(properties.Any(static property =>
            property.Name.Contains("Payload", StringComparison.OrdinalIgnoreCase)));
        Assert.IsFalse(properties.Any(static property => property.PropertyType == typeof(object)));
        Assert.IsFalse(properties.Any(static property =>
            typeof(System.Collections.IDictionary).IsAssignableFrom(property.PropertyType)));
    }

    [TestMethod]
    public void PlayerLogProjectionInterfaces_CannotReturnAuthoritativeMutationContracts()
    {
        var eventReturn = typeof(IPlayerLogEventProjector)
            .GetMethod(nameof(IPlayerLogEventProjector.Project))!
            .ReturnType;
        var auditReturn = typeof(IPlayerLogAuditProjector)
            .GetMethod(nameof(IPlayerLogAuditProjector.Project))!
            .ReturnType;

        Assert.AreEqual(typeof(IReadOnlyList<PlayerLogEntry>), eventReturn);
        Assert.AreEqual(typeof(IReadOnlyList<PlayerLogEntry>), auditReturn);
    }

    private static string[] GetNexisReferences(System.Reflection.Assembly assembly) =>
        assembly.GetReferencedAssemblies()
            .Select(static reference => reference.Name ?? string.Empty)
            .Where(static name => name.StartsWith("Nexis.", StringComparison.Ordinal))
            .OrderBy(static name => name, StringComparer.Ordinal)
            .ToArray();
}
