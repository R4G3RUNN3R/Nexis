using Microsoft.VisualStudio.TestTools.UnitTesting;
using Nexis.Execution;
using Nexis.Execution.Contracts;
using Nexis.Identity.Contracts;
using Nexis.Modules.Identity;

namespace Nexis.Architecture.Tests;

[TestClass]
public sealed class PrivilegedCommandEntryAuthorizationTests
{
    private static readonly PlatformCapabilityKey CorrectPlayerState = new("player-state.correct");
    private static readonly EntitlementKey MatchingEntitlement = new(CorrectPlayerState.Value);

    [TestMethod]
    public void AuthorizedEntryPreservesActingStaffAccountSeparatelyFromTarget()
    {
        var actingAccountId = AccountId.New();
        var targetAccountId = AccountId.New();
        var authorizer = CreateAuthorizer(
            (AccountRole.Administrator, new[] { CorrectPlayerState }));
        var request = new PrivilegedCommandEntryRequest(
            TrustedActorContext.CreateStaff(actingAccountId, 7),
            IdentitySecuritySnapshot.Create(actingAccountId, 7, AccountRole.Administrator),
            CorrectPlayerState,
            targetAccountId);

        var decision = authorizer.Authorize(request);

        Assert.IsTrue(decision.IsAuthorized);
        Assert.AreEqual(actingAccountId, decision.ActingAccountId);
        Assert.AreEqual(targetAccountId, decision.TargetAccountId);
        Assert.AreNotEqual(decision.ActingAccountId, decision.TargetAccountId);
    }

    [TestMethod]
    public void TargetSecurityFactsCannotReplaceActingStaffIdentity()
    {
        var actor = TrustedActorContext.CreateStaff(AccountId.New(), 7);
        var targetAccountId = AccountId.New();
        var authorizer = CreateAuthorizer(
            (AccountRole.Administrator, new[] { CorrectPlayerState }));
        var request = new PrivilegedCommandEntryRequest(
            actor,
            IdentitySecuritySnapshot.Create(targetAccountId, 7, AccountRole.Administrator),
            CorrectPlayerState,
            targetAccountId);

        var decision = authorizer.Authorize(request);

        Assert.IsFalse(decision.IsAuthorized);
        Assert.AreEqual(PlatformAuthorizationOutcome.ActorMismatch, decision.Authorization.Outcome);
        Assert.IsNull(decision.ActingAccountId);
        Assert.AreEqual(targetAccountId, decision.TargetAccountId);
    }

    [TestMethod]
    public void HigherOrdinalRoleCannotImplicitlyConferRequiredCapabilityAtEntry()
    {
        var accountId = AccountId.New();
        var authorizer = CreateAuthorizer(
            (AccountRole.Moderator, new[] { CorrectPlayerState }));
        var request = new PrivilegedCommandEntryRequest(
            TrustedActorContext.CreateStaff(accountId, 1),
            IdentitySecuritySnapshot.Create(accountId, 1, AccountRole.PrimaryOwner),
            CorrectPlayerState);

        var decision = authorizer.Authorize(request);

        Assert.AreEqual(PlatformAuthorizationOutcome.CapabilityMissing, decision.Authorization.Outcome);
        Assert.IsFalse(decision.IsAuthorized);
    }

    [TestMethod]
    public void CommercialEntitlementAndActorClaimCannotImplicitlyConferAuthorityAtEntry()
    {
        var accountId = AccountId.New();
        var authorizer = CreateAuthorizer();
        var request = new PrivilegedCommandEntryRequest(
            TrustedActorContext.CreateStaff(
                accountId,
                2,
                capabilities: new[] { CorrectPlayerState },
                entitlements: new[] { MatchingEntitlement }),
            IdentitySecuritySnapshot.Create(
                accountId,
                2,
                AccountRole.Player,
                entitlements: new[] { MatchingEntitlement }),
            CorrectPlayerState);

        var decision = authorizer.Authorize(request);

        Assert.AreEqual(PlatformAuthorizationOutcome.CapabilityMissing, decision.Authorization.Outcome);
        Assert.IsFalse(decision.IsAuthorized);
    }

    [TestMethod]
    public void CharacterIdentityCannotConferStaffAuthorityAtEntry()
    {
        var accountId = AccountId.New();
        var authorizer = CreateAuthorizer(
            (AccountRole.PrimaryOwner, new[] { CorrectPlayerState }));
        var request = new PrivilegedCommandEntryRequest(
            TrustedActorContext.CreatePlayer(accountId, CharacterId.New(), 3),
            IdentitySecuritySnapshot.Create(accountId, 3, AccountRole.PrimaryOwner),
            CorrectPlayerState);

        var decision = authorizer.Authorize(request);

        Assert.AreEqual(PlatformAuthorizationOutcome.StaffActorRequired, decision.Authorization.Outcome);
        Assert.IsFalse(decision.IsAuthorized);
    }

    [TestMethod]
    public void StaleSecurityVersionIsRejectedAtEntry()
    {
        var accountId = AccountId.New();
        var authorizer = CreateAuthorizer(
            (AccountRole.Administrator, new[] { CorrectPlayerState }));
        var request = new PrivilegedCommandEntryRequest(
            TrustedActorContext.CreateStaff(accountId, 4),
            IdentitySecuritySnapshot.Create(accountId, 5, AccountRole.Administrator),
            CorrectPlayerState);

        var decision = authorizer.Authorize(request);

        Assert.AreEqual(PlatformAuthorizationOutcome.StaleSecurityContext, decision.Authorization.Outcome);
        Assert.IsFalse(decision.IsAuthorized);
    }

    [TestMethod]
    public void ExplicitDenyOverridesEveryGrantAtEntry()
    {
        var accountId = AccountId.New();
        var authorizer = CreateAuthorizer(
            (AccountRole.Administrator, new[] { CorrectPlayerState }));
        var request = new PrivilegedCommandEntryRequest(
            TrustedActorContext.CreateStaff(accountId, 6),
            IdentitySecuritySnapshot.Create(
                accountId,
                6,
                AccountRole.Administrator,
                explicitGrants: new[] { CorrectPlayerState },
                explicitDenies: new[] { CorrectPlayerState }),
            CorrectPlayerState);

        var decision = authorizer.Authorize(request);

        Assert.AreEqual(PlatformAuthorizationOutcome.ExplicitlyDenied, decision.Authorization.Outcome);
        Assert.IsFalse(decision.IsAuthorized);
        Assert.IsNull(decision.ActingAccountId);
    }

    [TestMethod]
    public void PrivilegedDecisionCarriesSecurityVersionAndEvaluationTimeForFreshnessChecks()
    {
        var properties = typeof(PrivilegedCommandEntryDecision)
            .GetProperties()
            .ToDictionary(static property => property.Name, static property => property.PropertyType);

        Assert.AreEqual(typeof(long), properties["EvaluatedSecurityVersion"]);
        Assert.AreEqual(typeof(DateTimeOffset), properties["EvaluatedAtUtc"]);
    }

    private static PrivilegedCommandEntryAuthorizer CreateAuthorizer(
        params (AccountRole Role, IReadOnlyCollection<PlatformCapabilityKey> Capabilities)[] bundles) =>
        new(new PlatformAuthorizationPolicy(bundles.ToDictionary(
            static bundle => bundle.Role,
            static bundle => bundle.Capabilities)));
}
