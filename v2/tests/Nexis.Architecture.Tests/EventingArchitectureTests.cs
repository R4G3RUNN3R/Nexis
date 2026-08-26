using Microsoft.VisualStudio.TestTools.UnitTesting;
using Nexis.Eventing.Contracts;

namespace Nexis.Architecture.Tests;

[TestClass]
public sealed class EventingArchitectureTests
{
    [TestMethod]
    public void EventingContracts_ReferenceOnlyStableFoundationAssemblies()
    {
        var references = typeof(ICommittedEventTransport).Assembly
            .GetReferencedAssemblies()
            .Select(static reference => reference.Name ?? string.Empty)
            .Where(static name => name.StartsWith("Nexis.", StringComparison.Ordinal))
            .OrderBy(static name => name, StringComparer.Ordinal)
            .ToArray();

        CollectionAssert.AreEquivalent(
            new[] { "Nexis.Core.Contracts", "Nexis.Kernel" },
            references);
    }

    [TestMethod]
    public void EventingContracts_AreInfrastructureNeutral()
    {
        var references = typeof(ICommittedEventTransport).Assembly
            .GetReferencedAssemblies()
            .Select(static reference => reference.Name ?? string.Empty)
            .ToArray();

        var forbidden = new[] { "Npgsql", "EntityFrameworkCore", "AspNetCore", "StackExchange.Redis" };
        Assert.IsFalse(
            references.Any(reference => forbidden.Any(fragment => reference.Contains(fragment, StringComparison.OrdinalIgnoreCase))),
            $"Eventing contracts leaked infrastructure references: {string.Join(", ", references)}");
    }
}
