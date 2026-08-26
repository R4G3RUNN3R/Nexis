using Microsoft.VisualStudio.TestTools.UnitTesting;
using Nexis.Execution;
using Nexis.Execution.Contracts;

namespace Nexis.Architecture.Tests;

[TestClass]
public sealed class ExecutionArchitectureTests
{
    [TestMethod]
    public void ExecutionContracts_DoNotReferenceImplementationAssemblies()
    {
        var references = GetNexisReferences(typeof(ICommandReceiptRepository).Assembly);

        Assert.IsTrue(references.Contains("Nexis.Audit.Contracts", StringComparer.Ordinal));
        Assert.IsTrue(references.Contains("Nexis.Core.Contracts", StringComparer.Ordinal));
        Assert.IsTrue(references.Contains("Nexis.Identity.Contracts", StringComparer.Ordinal));
        Assert.IsTrue(references.Contains("Nexis.Kernel", StringComparer.Ordinal));
        Assert.IsFalse(references.Contains("Nexis.Execution", StringComparer.Ordinal));
        Assert.IsFalse(references.Any(static name => name.StartsWith("Nexis.Modules.", StringComparison.Ordinal)));
        Assert.IsFalse(references.Contains("Nexis.Host.Api", StringComparer.Ordinal));
    }

    [TestMethod]
    public void ExecutionImplementation_DependsOnlyOnApprovedStableBoundaries()
    {
        var references = GetNexisReferences(typeof(CommandReceiptCoordinator).Assembly);

        CollectionAssert.AreEquivalent(
            new[]
            {
                "Nexis.Audit.Contracts",
                "Nexis.Core.Contracts",
                "Nexis.Execution.Contracts",
                "Nexis.Identity.Contracts",
                "Nexis.Kernel"
            },
            references);
    }

    private static string[] GetNexisReferences(System.Reflection.Assembly assembly) =>
        assembly.GetReferencedAssemblies()
            .Select(static reference => reference.Name ?? string.Empty)
            .Where(static name => name.StartsWith("Nexis.", StringComparison.Ordinal))
            .OrderBy(static name => name, StringComparer.Ordinal)
            .ToArray();
}
