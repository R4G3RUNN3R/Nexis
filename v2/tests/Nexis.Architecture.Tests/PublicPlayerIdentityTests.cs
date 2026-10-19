using System.Reflection;
using Microsoft.VisualStudio.TestTools.UnitTesting;
using Nexis.Identity.Contracts;
using Nexis.Modules.Identity;

namespace Nexis.Architecture.Tests;

/// <summary>
/// The account-scoped stable public player identity boundary required by
/// <c>IDENTITY-AUTHORIZATION.md</c>. One normal account is one player is one playable character.
/// PublicPlayerId is immutable, distinct from every internal identifier, and grants zero authority.
/// </summary>
[TestClass]
public sealed class PublicPlayerIdentityTests
{
    private static readonly PlayerDisplayName Original = new("Hennet");
    private static readonly PlayerDisplayName Renamed = new("Hennet Reborn");

    [TestMethod]
    public void PublicPlayerId_IsDistinctFromEveryInternalIdentifierType()
    {
        Assert.AreNotEqual(typeof(PublicPlayerId), typeof(AccountId));
        Assert.AreNotEqual(typeof(PublicPlayerId), typeof(CharacterId));
        Assert.AreNotEqual(typeof(PublicPlayerId), typeof(PlayerDisplayName));

        // Structural non-interchangeability: the internal identifiers are GUID-shaped and the
        // public identifier is not, so no accidental cast or reinterpretation can bridge them.
        Assert.AreEqual(typeof(Guid), typeof(AccountId).GetProperty("Value")!.PropertyType);
        Assert.AreEqual(typeof(Guid), typeof(CharacterId).GetProperty("Value")!.PropertyType);
        Assert.AreEqual(typeof(long), typeof(PublicPlayerId).GetProperty("Ordinal")!.PropertyType);
    }

    [TestMethod]
    public void PublicPlayerId_RendersTheCanonicalPreservedV1PublicForm()
    {
        var id = new PublicPlayerId(1_000_020);

        Assert.AreEqual("P1000020", id.Value);
        Assert.AreEqual("P1000020", id.ToString());
        Assert.AreEqual(id, PublicPlayerId.Parse("P1000020"));
    }

    [TestMethod]
    public void PublicPlayerId_RejectsMalformedForeignAndBelowFloorValues()
    {
        Assert.ThrowsExactly<ArgumentOutOfRangeException>(() => new PublicPlayerId(0));
        Assert.ThrowsExactly<ArgumentOutOfRangeException>(() => new PublicPlayerId(-1));
        Assert.ThrowsExactly<ArgumentOutOfRangeException>(() => new PublicPlayerId(999_999));

        Assert.ThrowsExactly<FormatException>(() => PublicPlayerId.Parse("1000020"));
        Assert.ThrowsExactly<FormatException>(() => PublicPlayerId.Parse("P100002"));
        Assert.ThrowsExactly<FormatException>(() => PublicPlayerId.Parse("Pabcdefg"));
        Assert.ThrowsExactly<FormatException>(() => PublicPlayerId.Parse("p1000020"));
        Assert.ThrowsExactly<ArgumentException>(() => PublicPlayerId.Parse("  "));
    }

    [TestMethod]
    public void PublicPlayerId_ReservesTheLowRangeFromOrdinaryPlayerAllocation()
    {
        Assert.IsTrue(new PublicPlayerId(1_000_000).IsReserved);
        Assert.IsTrue(new PublicPlayerId(1_000_019).IsReserved);
        Assert.IsFalse(PublicPlayerId.FirstAllocatable.IsReserved);
        Assert.AreEqual(1_000_020L, PublicPlayerId.FirstAllocatable.Ordinal);
    }

    [TestMethod]
    public void DisplayNameChange_LeavesAccountCharacterAndPublicPlayerIdUnchanged()
    {
        var identity = CreateIdentity();

        var renamed = identity.WithDisplayName(Renamed);

        Assert.AreEqual(Renamed, renamed.DisplayName);
        Assert.AreNotEqual(identity.DisplayName, renamed.DisplayName);
        Assert.AreEqual(identity.AccountId, renamed.AccountId);
        Assert.AreEqual(identity.CharacterId, renamed.CharacterId);
        Assert.AreEqual(identity.PublicPlayerId, renamed.PublicPlayerId);
    }

    [TestMethod]
    public void PlayerIdentity_ExposesNoMutablePublicPlayerIdSetter()
    {
        var property = typeof(PlayerIdentity).GetProperty(nameof(PlayerIdentity.PublicPlayerId))!;

        Assert.IsNull(property.SetMethod, "PublicPlayerId must be immutable for the life of the player identity.");
        Assert.IsNull(typeof(PlayerIdentity).GetProperty(nameof(PlayerIdentity.AccountId))!.SetMethod);
        Assert.IsNull(typeof(PlayerIdentity).GetProperty(nameof(PlayerIdentity.CharacterId))!.SetMethod);
    }

    [TestMethod]
    public void PublicProjection_LeaksNeitherAccountIdNorCharacterId()
    {
        var identity = CreateIdentity();

        var projection = identity.ToPublicProjection();

        Assert.AreEqual(identity.PublicPlayerId, projection.PublicPlayerId);
        Assert.AreEqual(identity.DisplayName, projection.DisplayName);

        var propertyTypes = typeof(PublicPlayerProjection)
            .GetProperties(BindingFlags.Public | BindingFlags.Instance)
            .Select(static property => property.PropertyType)
            .ToArray();

        CollectionAssert.DoesNotContain(propertyTypes, typeof(AccountId));
        CollectionAssert.DoesNotContain(propertyTypes, typeof(CharacterId));
        CollectionAssert.DoesNotContain(propertyTypes, typeof(AccountId?));
        CollectionAssert.DoesNotContain(propertyTypes, typeof(CharacterId?));

        var rendered = projection.ToString();
        StringAssert.DoesNotMatch(rendered, new System.Text.RegularExpressions.Regex(
            System.Text.RegularExpressions.Regex.Escape(identity.AccountId.Value.ToString("D"))));
        StringAssert.DoesNotMatch(rendered, new System.Text.RegularExpressions.Regex(
            System.Text.RegularExpressions.Regex.Escape(identity.CharacterId.Value.ToString("D"))));
    }

    [TestMethod]
    public void PublicProjection_LeaksNoRoleCapabilitySecurityVersionOrEntitlementData()
    {
        var forbidden = new[]
        {
            typeof(AccountRole),
            typeof(AccountRole?),
            typeof(PlatformCapabilityKey),
            typeof(EntitlementKey),
            typeof(IdentitySecuritySnapshot),
            typeof(TrustedActorContext)
        };

        var properties = typeof(PublicPlayerProjection)
            .GetProperties(BindingFlags.Public | BindingFlags.Instance)
            .ToArray();

        foreach (var property in properties)
        {
            CollectionAssert.DoesNotContain(forbidden, property.PropertyType, $"{property.Name} leaks privileged state.");
        }

        foreach (var fragment in new[] { "role", "capabilit", "securityversion", "entitlement", "grant", "deny", "sanction" })
        {
            Assert.IsFalse(
                properties.Any(property => property.Name.Contains(fragment, StringComparison.OrdinalIgnoreCase)),
                $"Public projection exposes a '{fragment}' shaped member.");
        }

        // The projection surface is deliberately exactly two facts.
        CollectionAssert.AreEquivalent(
            new[] { nameof(PublicPlayerProjection.PublicPlayerId), nameof(PublicPlayerProjection.DisplayName) },
            properties.Select(static property => property.Name).ToArray());
    }

    [TestMethod]
    public void PublicPlayerId_CannotActAsAccountOrCharacterAuthority()
    {
        var identity = CreateIdentity();

        // There is no conversion, factory or accessor anywhere in the contract surface that turns a
        // PublicPlayerId into an internal identifier or an actor context.
        var bridges = typeof(PublicPlayerId)
            .GetMembers(BindingFlags.Public | BindingFlags.Instance | BindingFlags.Static)
            .Where(static member => member is MethodInfo or PropertyInfo or FieldInfo)
            .Where(member => MemberValueType(member) is { } type
                && (type == typeof(AccountId) || type == typeof(CharacterId) || type == typeof(TrustedActorContext)))
            .ToArray();

        Assert.AreEqual(0, bridges.Length, "PublicPlayerId must expose no bridge to internal identity or actor authority.");

        // A PublicPlayerId is not accepted anywhere an actor is constructed.
        Assert.IsFalse(
            typeof(TrustedActorContext)
                .GetMethods(BindingFlags.Public | BindingFlags.Static | BindingFlags.Instance)
                .SelectMany(static method => method.GetParameters())
                .Any(static parameter => parameter.ParameterType == typeof(PublicPlayerId)),
            "No TrustedActorContext factory may accept a PublicPlayerId.");

        Assert.AreNotEqual<object>(identity.PublicPlayerId, identity.AccountId);
        Assert.AreNotEqual<object>(identity.PublicPlayerId, identity.CharacterId);
    }

    [TestMethod]
    public void ForgedClientPublicPlayerId_CannotAuthorizeAnotherCharacter()
    {
        var victim = CreateIdentity();
        var attacker = PlayerIdentity.Create(AccountId.New(), CharacterId.New(), new PublicPlayerId(1_000_021), new PlayerDisplayName("Mallory"));

        // The attacker submits the victim's public identifier as though it selected the character.
        var resolver = new PlayerIdentityDirectory(new[] { victim, attacker });
        var attackerActor = TrustedActorContext.CreatePlayer(attacker.AccountId, attacker.CharacterId, 1);

        var resolved = resolver.ResolveControlledCharacter(attackerActor, victim.PublicPlayerId);

        Assert.AreEqual(PlayerIdentityResolution.NotControlledByActor, resolved.Outcome);
        Assert.IsNull(resolved.CharacterId, "A forged public identifier must not yield a controllable CharacterId.");

        // The attacker's own public identifier still resolves, and only to its own character.
        var own = resolver.ResolveControlledCharacter(attackerActor, attacker.PublicPlayerId);
        Assert.AreEqual(PlayerIdentityResolution.Controlled, own.Outcome);
        Assert.AreEqual(attacker.CharacterId, own.CharacterId);
    }

    [TestMethod]
    public void NoPublicPlayerIdIncludingHennets_GrantsPlatformAuthority()
    {
        var hennet = CreateIdentity();
        var capability = new PlatformCapabilityKey("staff.manage.authorization");

        // The capability is deliberately granted to every staff bundle, so nothing about this
        // policy is stingy. Hennet's *player* actor still receives no authority from it.
        var policy = new PlatformAuthorizationPolicy(
            new Dictionary<AccountRole, IReadOnlyCollection<PlatformCapabilityKey>>
            {
                [AccountRole.Moderator] = new[] { capability },
                [AccountRole.Administrator] = new[] { capability },
                [AccountRole.PrimaryOwner] = new[] { capability }
            });

        // An ordinary player actor whose identity happens to be Hennet's, with a Hennet display
        // name and Hennet's public identifier, holds no capability.
        var actor = TrustedActorContext.CreatePlayer(hennet.AccountId, hennet.CharacterId, 1);
        var security = IdentitySecuritySnapshot.Create(hennet.AccountId, 1, AccountRole.Player);

        var decision = policy.Authorize(actor, security, capability);

        Assert.IsFalse(decision.IsAuthorized);
        Assert.AreEqual(PlatformAuthorizationOutcome.StaffActorRequired, decision.Outcome);

        // No authorization surface anywhere accepts a PublicPlayerId or a display name.
        var authorizeParameters = typeof(IPlatformAuthorizationPolicy)
            .GetMethods()
            .SelectMany(static method => method.GetParameters())
            .Select(static parameter => parameter.ParameterType)
            .ToArray();

        CollectionAssert.DoesNotContain(authorizeParameters, typeof(PublicPlayerId));
        CollectionAssert.DoesNotContain(authorizeParameters, typeof(PlayerDisplayName));
    }

    [TestMethod]
    public void IdentityContracts_ContainNoHardCodedPublicPlayerIdOrNamePrivilege()
    {
        var suspects = new[] { "hennet", "P1000020", "primaryowner", "isowner", "isadmin" };

        foreach (var type in new[] { typeof(PublicPlayerId), typeof(PlayerIdentity), typeof(PublicPlayerProjection), typeof(PlayerDisplayName) })
        {
            foreach (var member in type.GetMembers(BindingFlags.Public | BindingFlags.NonPublic | BindingFlags.Static | BindingFlags.Instance))
            {
                foreach (var suspect in suspects)
                {
                    Assert.IsFalse(
                        member.Name.Contains(suspect, StringComparison.OrdinalIgnoreCase),
                        $"{type.Name}.{member.Name} looks like hard-coded identity privilege.");
                }
            }
        }
    }

    [TestMethod]
    public void OneAccountIsOnePlayerIsOnePlayableCharacter_WithoutCollapsingIdentifierTypes()
    {
        var accountId = AccountId.New();
        var first = PlayerIdentity.Create(accountId, CharacterId.New(), new PublicPlayerId(1_000_020), Original);
        var second = PlayerIdentity.Create(accountId, CharacterId.New(), new PublicPlayerId(1_000_021), Renamed);

        var directory = new PlayerIdentityDirectory(new[] { first });

        Assert.ThrowsExactly<InvalidOperationException>(
            () => _ = new PlayerIdentityDirectory(new[] { first, second }),
            "A second playable character for one account must be refused; Nexis has no slots, alts or campaign characters.");

        Assert.AreEqual(first.CharacterId, directory.FindByAccount(accountId)?.CharacterId);

        // Enforcement must not have been achieved by making the identifiers the same value.
        Assert.AreNotEqual(first.AccountId.Value, first.CharacterId.Value);
        Assert.AreNotEqual<object>(first.AccountId, first.CharacterId);
    }

    [TestMethod]
    public void PlayerIdentityDirectory_RefusesDuplicateCharacterOrPublicPlayerIdMappings()
    {
        var sharedCharacter = CharacterId.New();
        var duplicateCharacter = new[]
        {
            PlayerIdentity.Create(AccountId.New(), sharedCharacter, new PublicPlayerId(1_000_020), Original),
            PlayerIdentity.Create(AccountId.New(), sharedCharacter, new PublicPlayerId(1_000_021), Renamed)
        };

        Assert.ThrowsExactly<InvalidOperationException>(() => _ = new PlayerIdentityDirectory(duplicateCharacter));

        var sharedPublicId = new PublicPlayerId(1_000_022);
        var duplicatePublicId = new[]
        {
            PlayerIdentity.Create(AccountId.New(), CharacterId.New(), sharedPublicId, Original),
            PlayerIdentity.Create(AccountId.New(), CharacterId.New(), sharedPublicId, Renamed)
        };

        Assert.ThrowsExactly<InvalidOperationException>(() => _ = new PlayerIdentityDirectory(duplicatePublicId));
    }

    [TestMethod]
    public void PlayerDisplayName_IsPresentationOnlyAndValidated()
    {
        Assert.AreEqual("Hennet", Original.Value);
        Assert.ThrowsExactly<ArgumentException>(() => new PlayerDisplayName(" "));
        Assert.ThrowsExactly<ArgumentException>(() => new PlayerDisplayName("A"));
        Assert.ThrowsExactly<ArgumentException>(() => new PlayerDisplayName(new string('A', 21)));
        Assert.ThrowsExactly<ArgumentException>(() => new PlayerDisplayName("Rob3rt"));

        // Renaming to the same name is legal and still changes nothing structural.
        var identity = CreateIdentity();
        Assert.AreEqual(identity.PublicPlayerId, identity.WithDisplayName(Original).PublicPlayerId);
    }

    private static Type? MemberValueType(MemberInfo member) => member switch
    {
        PropertyInfo property => property.PropertyType,
        FieldInfo field => field.FieldType,
        MethodInfo method => method.ReturnType,
        _ => null
    };

    private static PlayerIdentity CreateIdentity() =>
        PlayerIdentity.Create(AccountId.New(), CharacterId.New(), new PublicPlayerId(1_000_020), Original);
}
