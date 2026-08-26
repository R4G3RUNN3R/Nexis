using Microsoft.VisualStudio.TestTools.UnitTesting;
using Nexis.Identity.Contracts;
using Nexis.Modules.Identity;

namespace Nexis.Architecture.Tests;

[TestClass]
public sealed class IdentityArchitectureTests
{
    [TestMethod]
    public void IdentityContracts_DoNotReferenceImplementationAssemblies()
    {
        var references = GetNexisReferences(typeof(AccountId).Assembly);

        Assert.AreEqual(0, references.Length, $"Identity contracts reference: {string.Join(", ", references)}");
    }

    [TestMethod]
    public void IdentityImplementation_ReferencesStableIdentityContracts()
    {
        var references = GetNexisReferences(typeof(IdentityAssemblyMarker).Assembly);

        Assert.IsTrue(references.Contains("Nexis.Identity.Contracts", StringComparer.Ordinal));
        Assert.IsFalse(references.Contains("Nexis.Core", StringComparer.Ordinal));
        Assert.IsFalse(references.Contains("Nexis.Host.Api", StringComparer.Ordinal));
    }

    [TestMethod]
    public void AccountAndCharacterIds_RemainDistinctTypes()
    {
        Assert.AreNotEqual(typeof(AccountId), typeof(CharacterId));
        Assert.AreEqual(Guid.Empty, default(AccountId).Value);
        Assert.AreEqual(Guid.Empty, default(CharacterId).Value);
    }

    private static string[] GetNexisReferences(System.Reflection.Assembly assembly) =>
        assembly.GetReferencedAssemblies()
            .Select(static reference => reference.Name ?? string.Empty)
            .Where(static name => name.StartsWith("Nexis.", StringComparison.Ordinal))
            .OrderBy(static name => name, StringComparer.Ordinal)
            .ToArray();
}
