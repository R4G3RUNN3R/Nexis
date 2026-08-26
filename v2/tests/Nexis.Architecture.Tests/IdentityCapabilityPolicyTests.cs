using Microsoft.VisualStudio.TestTools.UnitTesting;
using Nexis.Identity.Contracts;
using Nexis.Modules.Identity;

namespace Nexis.Architecture.Tests;

[TestClass]
public sealed class IdentityCapabilityPolicyTests
{
    private static readonly PlatformCapabilityKey InspectSupport = new("support.inspect.standard");
    private static readonly PlatformCapabilityKey CorrectPlayerState = new("player-state.correct");

    [TestMethod]
    public void ExactRoleBundleDoesNotGrantCapabilityFromOrdinalRoleOrdering()
    {
        var policy = CreatePolicy(
            (AccountRole.Moderator, new[] { InspectSupport }),
            (AccountRole.Administrator, new[] { CorrectPlayerState }));
        var accountId = AccountId.New();
        var actor = TrustedActorContext.CreateStaff(accountId, 7);
        var current = IdentitySecuritySnapshot.Create(accountId, 7, AccountRole.Moderator);

        var decision = policy.Authorize(actor, current, CorrectPlayerState);

        Assert.AreEqual(PlatformAuthorizationOutcome.CapabilityMissing, decision.Outcome);
        Assert.IsFalse(decision.IsAuthorized);
    }

    [TestMethod]
    public void ExplicitDenyOverridesRoleBundleAndExplicitGrant()
    {
        var policy = CreatePolicy((AccountRole.Administrator, new[] { CorrectPlayerState }));
        var accountId = AccountId.New();
        var actor = TrustedActorContext.CreateStaff(accountId, 3);
        var current = IdentitySecuritySnapshot.Create(
            accountId,
            3,
            AccountRole.Administrator,
            explicitGrants: new[] { CorrectPlayerState },
            explicitDenies: new[] { CorrectPlayerState });

        var decision = policy.Authorize(actor, current, CorrectPlayerState);

        Assert.AreEqual(PlatformAuthorizationOutcome.ExplicitlyDenied, decision.Outcome);
    }

    [TestMethod]
    public void CommercialEntitlementCannotGrantPlatformCapability()
    {
        var policy = CreatePolicy();
        var accountId = AccountId.New();
        var actor = TrustedActorContext.CreateStaff(
            accountId,
            1,
            entitlements: new[] { new EntitlementKey(CorrectPlayerState.Value) });
        var current = IdentitySecuritySnapshot.Create(
            accountId,
            1,
            AccountRole.Player,
            entitlements: new[] { new EntitlementKey(CorrectPlayerState.Value) });

        var decision = policy.Authorize(actor, current, CorrectPlayerState);

        Assert.AreEqual(PlatformAuthorizationOutcome.CapabilityMissing, decision.Outcome);
    }

    [TestMethod]
    public void SecurityVersionChangeRejectsStaleActorCapabilities()
    {
        var policy = CreatePolicy((AccountRole.Administrator, new[] { CorrectPlayerState }));
        var accountId = AccountId.New();
        var actor = TrustedActorContext.CreateStaff(
            accountId,
            4,
            capabilities: new[] { CorrectPlayerState });
        var current = IdentitySecuritySnapshot.Create(
            accountId,
            5,
            AccountRole.Administrator,
            explicitDenies: new[] { CorrectPlayerState });

        var decision = policy.Authorize(actor, current, CorrectPlayerState);

        Assert.AreEqual(PlatformAuthorizationOutcome.StaleSecurityContext, decision.Outcome);
    }

    [TestMethod]
    public void CurrentExplicitRevocationTakesEffectOnFreshEvaluation()
    {
        var policy = CreatePolicy((AccountRole.Administrator, new[] { CorrectPlayerState }));
        var accountId = AccountId.New();
        var actor = TrustedActorContext.CreateStaff(accountId, 8);
        var current = IdentitySecuritySnapshot.Create(
            accountId,
            8,
            AccountRole.Administrator,
            explicitDenies: new[] { CorrectPlayerState });

        var decision = policy.Authorize(actor, current, CorrectPlayerState);

        Assert.AreEqual(PlatformAuthorizationOutcome.ExplicitlyDenied, decision.Outcome);
    }

    [TestMethod]
    public void ActorCannotUseAnotherAccountsCurrentSecurityFacts()
    {
        var policy = CreatePolicy((AccountRole.PrimaryOwner, new[] { CorrectPlayerState }));
        var actor = TrustedActorContext.CreateStaff(AccountId.New(), 2);
        var current = IdentitySecuritySnapshot.Create(
            AccountId.New(),
            2,
            AccountRole.PrimaryOwner);

        var decision = policy.Authorize(actor, current, CorrectPlayerState);

        Assert.AreEqual(PlatformAuthorizationOutcome.ActorMismatch, decision.Outcome);
    }

    [TestMethod]
    public void PlayerCharacterContextCannotAuthorizePlatformStaffCapability()
    {
        var policy = CreatePolicy((AccountRole.PrimaryOwner, new[] { CorrectPlayerState }));
        var accountId = AccountId.New();
        var actor = TrustedActorContext.CreatePlayer(accountId, CharacterId.New(), 2);
        var current = IdentitySecuritySnapshot.Create(
            accountId,
            2,
            AccountRole.PrimaryOwner);

        var decision = policy.Authorize(actor, current, CorrectPlayerState);

        Assert.AreEqual(PlatformAuthorizationOutcome.StaffActorRequired, decision.Outcome);
    }

    private static PlatformAuthorizationPolicy CreatePolicy(
        params (AccountRole Role, IReadOnlyCollection<PlatformCapabilityKey> Capabilities)[] bundles) =>
        new(bundles.ToDictionary(
            static bundle => bundle.Role,
            static bundle => bundle.Capabilities));
}
