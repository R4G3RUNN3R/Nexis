using Microsoft.VisualStudio.TestTools.UnitTesting;
using Nexis.Identity.Contracts;
using Nexis.Kernel.Commands;
using Nexis.Modules.Identity;

namespace Nexis.Architecture.Tests;

[TestClass]
public sealed class IdentityArchitectureTests
{
    [TestMethod]
    public void IdentityContracts_ReferenceOnlyKernelAmongNexisAssemblies()
    {
        var references = GetNexisReferences(typeof(AccountId).Assembly);

        CollectionAssert.AreEquivalent(new[] { "Nexis.Kernel" }, references);
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

    [TestMethod]
    public void PlayerActorCarriesTrustedAccountCharacterAndSeparateEntitlementFacts()
    {
        var capability = new PlatformCapabilityKey("support.inspect.standard");
        var entitlement = new EntitlementKey("supporter.cosmetics");
        var actor = TrustedActorContext.CreatePlayer(
            AccountId.New(),
            CharacterId.New(),
            4,
            new[] { capability, capability },
            new[] { entitlement, entitlement });

        Assert.AreEqual(ActorKind.Player, actor.Kind);
        Assert.AreEqual(CommandExecutionLane.Player, actor.Lane);
        Assert.IsTrue(actor.AccountId.HasValue);
        Assert.IsTrue(actor.CharacterId.HasValue);
        Assert.AreEqual(4L, actor.SecurityVersion);
        Assert.AreEqual(1, actor.Capabilities.Count);
        Assert.AreEqual(1, actor.Entitlements.Count);
        Assert.IsTrue(actor.HasCapability(capability));
        Assert.IsTrue(actor.HasEntitlement(entitlement));
    }

    [TestMethod]
    public void StaffActorUsesAdminLaneWithoutCharacterImpersonation()
    {
        var actor = TrustedActorContext.CreateStaff(
            AccountId.New(),
            2,
            new[] { new PlatformCapabilityKey("player-state.correct") });

        Assert.AreEqual(ActorKind.Staff, actor.Kind);
        Assert.AreEqual(CommandExecutionLane.Admin, actor.Lane);
        Assert.IsTrue(actor.AccountId.HasValue);
        Assert.IsFalse(actor.CharacterId.HasValue);
    }

    [TestMethod]
    public void SystemActorHasNoAccountOrCharacterIdentity()
    {
        var actor = TrustedActorContext.CreateSystem();

        Assert.AreEqual(ActorKind.System, actor.Kind);
        Assert.AreEqual(CommandExecutionLane.System, actor.Lane);
        Assert.IsFalse(actor.AccountId.HasValue);
        Assert.IsFalse(actor.CharacterId.HasValue);
        Assert.IsFalse(actor.SecurityVersion.HasValue);
    }

    [TestMethod]
    public void TrustedActorContextDoesNotCarryOrdinalAccountRole()
    {
        var propertyTypes = typeof(TrustedActorContext)
            .GetProperties()
            .Select(static property => property.PropertyType)
            .ToArray();

        Assert.IsFalse(propertyTypes.Contains(typeof(AccountRole)));
    }

    [TestMethod]
    public void EmptyPlayerIdentityIsRejected()
    {
        Assert.ThrowsExactly<ArgumentException>(() => TrustedActorContext.CreatePlayer(
            default,
            CharacterId.New(),
            0));

        Assert.ThrowsExactly<ArgumentException>(() => TrustedActorContext.CreatePlayer(
            AccountId.New(),
            default,
            0));
    }

    private static string[] GetNexisReferences(System.Reflection.Assembly assembly) =>
        assembly.GetReferencedAssemblies()
            .Select(static reference => reference.Name ?? string.Empty)
            .Where(static name => name.StartsWith("Nexis.", StringComparison.Ordinal))
            .OrderBy(static name => name, StringComparer.Ordinal)
            .ToArray();
}
