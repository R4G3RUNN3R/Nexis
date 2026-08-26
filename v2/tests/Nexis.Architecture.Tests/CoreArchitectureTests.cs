using Microsoft.VisualStudio.TestTools.UnitTesting;
using Nexis.Core;
using Nexis.Core.Contracts;
using Nexis.Kernel.Time;

namespace Nexis.Architecture.Tests;

[TestClass]
public sealed class CoreArchitectureTests
{
    [TestMethod]
    public void Kernel_DoesNotReferenceOtherNexisAssemblies()
    {
        var references = GetNexisReferences(typeof(IGameClock).Assembly);

        Assert.AreEqual(0, references.Length, $"Kernel references: {string.Join(", ", references)}");
    }

    [TestMethod]
    public void CoreContracts_DoNotReferenceConcreteCoreOrSystemImplementations()
    {
        var references = GetNexisReferences(typeof(ICoreRulesEngine).Assembly);

        Assert.IsTrue(references.Contains("Nexis.Kernel", StringComparer.Ordinal));
        Assert.IsFalse(references.Contains("Nexis.Core", StringComparer.Ordinal));
        Assert.IsFalse(references.Any(static name => name.StartsWith("Nexis.Modules.", StringComparison.Ordinal)));
    }

    [TestMethod]
    public void ConcreteCore_DependsOnlyOnApprovedNexisFoundationAssemblies()
    {
        var references = GetNexisReferences(typeof(CoreAssemblyMarker).Assembly);

        CollectionAssert.AreEquivalent(
            new[] { "Nexis.Core.Contracts", "Nexis.Kernel" },
            references);
    }

    [TestMethod]
    public void CoreContracts_AreInfrastructureNeutral()
    {
        var references = typeof(ICoreRulesEngine).Assembly
            .GetReferencedAssemblies()
            .Select(static reference => reference.Name ?? string.Empty)
            .ToArray();

        var forbidden = new[]
        {
            "EntityFrameworkCore",
            "Npgsql",
            "AspNetCore",
            "StackExchange.Redis"
        };

        Assert.IsFalse(
            references.Any(reference => forbidden.Any(fragment => reference.Contains(fragment, StringComparison.OrdinalIgnoreCase))),
            $"Core contracts leaked infrastructure references: {string.Join(", ", references)}");
    }

    [TestMethod]
    public void ReplacementCore_CanSatisfyStableContract()
    {
        ICoreRulesEngine replacement = new FakeReplacementCore();

        Assert.IsTrue(replacement.Supports(CoreContractVersion.V1));
        Assert.AreEqual("Test.ReplacementCore", replacement.Descriptor.ImplementationName);
    }

    private static string[] GetNexisReferences(System.Reflection.Assembly assembly) =>
        assembly.GetReferencedAssemblies()
            .Select(static reference => reference.Name ?? string.Empty)
            .Where(static name => name.StartsWith("Nexis.", StringComparison.Ordinal))
            .OrderBy(static name => name, StringComparer.Ordinal)
            .ToArray();

    private sealed class FakeReplacementCore : ICoreRulesEngine
    {
        public CoreImplementationDescriptor Descriptor { get; } = new(
            "Test.ReplacementCore",
            "1.0.0",
            CoreContractVersion.V1);

        public bool Supports(CoreContractVersion contractVersion) =>
            contractVersion == CoreContractVersion.V1;

        public CoreDecision Evaluate(CoreEvaluationRequest request)
        {
            ArgumentNullException.ThrowIfNull(request);
            return CoreDecision.Rejected(new CoreReasonCode("test.rejected"));
        }
    }
}
