using System.Reflection;
using Microsoft.VisualStudio.TestTools.UnitTesting;
using Nexis.Execution.Contracts;
using Nexis.Identity.Contracts;
using Nexis.Kernel.Commands;

namespace Nexis.Architecture.Tests;

/// <summary>
/// M3 residual regression guard. Found by the Claude late shift, proven RED by the Claude afternoon
/// shift against ea6937c, and closed in the same commit that carries this file.
///
/// <c>ea6937c</c> deleted the <see cref="RecoveredCommandExecution"/> overload that fabricated
/// <c>SystemActorKey.Platform</c>, but the same defect class survived one assembly over as a public
/// static factory: <c>TrustedActorContext.CreateSystem()</c> minted the System-lane authority
/// <c>nexis.system</c> from zero arguments. That overload is now gone.
///
/// The sibling guard <c>NoIdentityOrExecutionContractFactoryMayDefaultASystemActorKeyForTheSystemLane</c>
/// was widened over the same two axes in place. Both are kept deliberately, and this one is NOT
/// redundant: it is the only one of the two that carries a negative control, a false-positive control
/// and an explicit <see cref="SystemActorKey"/> scope control, so it is the one that cannot silently
/// become vacuous. Do not delete this file to resolve a duplicate-coverage observation.
///
/// Naming follows ClaudeOvernightAdversarialTests: "Must" = RED until fixed, never to be made green by
/// weakening an assertion; "Remains"/"Actually" = protective, expected to pass today.
/// </summary>
[TestClass]
public sealed class ClaudeAfternoonSystemAuthorityMintingTests
{
    /// <summary>
    /// The two assemblies that are permitted to describe automated authority at all. Both are scanned,
    /// because the defect moved between them once already.
    /// </summary>
    private static IEnumerable<Assembly> AuthorityContractAssemblies =>
    [
        typeof(RecoveredCommandExecution).Assembly, // Nexis.Execution.Contracts
        typeof(TrustedActorContext).Assembly        // Nexis.Identity.Contracts
    ];

    // ---------------------------------------------------------------------------------------------
    // M3 residual - RED at ea6937c.
    // ---------------------------------------------------------------------------------------------

    [TestMethod]
    public void NoPublicFactoryOrConstructorMayMintSystemAuthorityWithoutNamingIt()
    {
        var offenders = AuthorityContractAssemblies
            .SelectMany(static assembly => assembly.GetExportedTypes())
            .SelectMany(FindAuthorityMintingMembers)
            .OrderBy(static description => description, StringComparer.Ordinal)
            .ToArray();

        Assert.AreEqual(
            0,
            offenders.Length,
            "A public member of Nexis.Execution.Contracts or Nexis.Identity.Contracts can produce a "
            + "System-lane authority without the caller naming which automated authority acted: "
            + string.Join(", ", offenders)
            + ". Such a member can only supply the missing identity by inventing one, and the invented "
            + "value is what gets durably persisted as actor_system_key. AutomationArchitectureTests "
            + "treats scheduler != CIEL != platform as a security distinction, and "
            + "IMPLEMENTATION-STATUS.md's automated-authority proof #4 claims recovery 'preserves the "
            + "same System principal rather than degrading it to anonymous SYSTEM authority' - a "
            + "zero-argument factory is precisely that degradation. Close it by DELETING the overload "
            + "and naming an explicit key at each call site. Do NOT close it by adding validation to "
            + "the SystemActorKey constructor: retired-but-historically-valid keys must stay "
            + "constructible for recovery and replay.");
    }

    // ---------------------------------------------------------------------------------------------
    // Negative control. L4 exists because a guard that enumerates an empty set passes vacuously and
    // proves nothing. This proves the scanner above actually fires on a member of the shape it hunts.
    // ---------------------------------------------------------------------------------------------

    [TestMethod]
    public void AuthorityMintingScan_ActuallyDetectsAZeroArgumentSystemFactoryWhenOneExists()
    {
        var detected = FindAuthorityMintingMembers(typeof(DecoyAuthoritySource)).ToArray();

        Assert.AreEqual(
            1,
            detected.Length,
            "The authority-minting scanner failed to detect a deliberately planted zero-argument "
            + "System factory. The scanner is broken, so a green result from "
            + nameof(NoPublicFactoryOrConstructorMayMintSystemAuthorityWithoutNamingIt)
            + " would be meaningless. Detected: "
            + string.Join(", ", detected));
    }

    /// <summary>
    /// Protective. A factory that DOES require the caller to name the authority is legitimate and must
    /// never be flagged, otherwise the only correct way to construct System authority becomes a
    /// violation and the guard would push implementers toward deleting the wrong overload.
    /// </summary>
    [TestMethod]
    public void AuthorityMintingScan_RemainsSilentForFactoriesThatRequireAnExplicitKey()
    {
        var detected = FindAuthorityMintingMembers(typeof(CompliantAuthoritySource)).ToArray();

        Assert.AreEqual(
            0,
            detected.Length,
            "A factory that requires an explicit SystemActorKey was flagged as an authority-minting "
            + "offender. That is a false positive: naming the authority is the required shape, not the "
            + "defect. Detected: " + string.Join(", ", detected));
    }

    /// <summary>
    /// Protective, and a deliberate scope limit on the scan. SystemActorKey itself must stay freely
    /// constructible from a string: recovery and replay have to rehydrate authorities that were valid
    /// when they acted and have since been retired. Closed-set membership is an ingress concern
    /// (ISystemActorRegistry), never a constructor concern. If this test starts failing, the scan has
    /// grown into the SystemActorKey constructor and will break historical replay.
    /// </summary>
    [TestMethod]
    public void RetiredSystemActorKeyType_RemainsOutsideTheAuthorityMintingScan()
    {
        var detected = FindAuthorityMintingMembers(typeof(SystemActorKey)).ToArray();

        Assert.AreEqual(
            0,
            detected.Length,
            "The authority-minting scan reached SystemActorKey itself: "
            + string.Join(", ", detected)
            + ". A retired-but-historically-valid key must remain constructible for recovery and "
            + "replay.");

        var retired = new SystemActorKey("nexis.retired-authority");
        Assert.AreEqual("nexis.retired-authority", retired.Value);
        Assert.AreNotEqual(SystemActorKey.Platform, retired);
    }

    // ---------------------------------------------------------------------------------------------
    // Scanner.
    // ---------------------------------------------------------------------------------------------

    /// <summary>
    /// A member mints unnamed System authority when it can yield a System-lane actor/execution context
    /// but accepts no <see cref="SystemActorKey"/> from its caller. Two shapes qualify:
    /// a public constructor accepting a <see cref="CommandExecutionLane"/>, and a public static factory
    /// returning its own declaring type that is either lane-parameterised or named for the System lane.
    ///
    /// <see cref="SystemActorKey"/> is deliberately exempt - see
    /// <see cref="RetiredSystemActorKeyType_RemainsOutsideTheAuthorityMintingScan"/>.
    /// </summary>
    private static IEnumerable<string> FindAuthorityMintingMembers(Type type)
    {
        if (type == typeof(SystemActorKey))
        {
            yield break;
        }

        foreach (var constructor in type.GetConstructors(BindingFlags.Public | BindingFlags.Instance))
        {
            var parameters = constructor.GetParameters();
            if (AcceptsLane(parameters) && !AcceptsSystemActorKey(parameters))
            {
                yield return $"{type.FullName}..ctor({parameters.Length} args)";
            }
        }

        foreach (var method in type.GetMethods(BindingFlags.Public | BindingFlags.Static | BindingFlags.DeclaredOnly))
        {
            if (method.ReturnType != type)
            {
                continue;
            }

            var parameters = method.GetParameters();
            if (AcceptsSystemActorKey(parameters))
            {
                continue;
            }

            if (AcceptsLane(parameters) || NamesTheSystemLane(method.Name))
            {
                yield return $"{type.FullName}.{method.Name}({parameters.Length} args)";
            }
        }
    }

    private static bool AcceptsLane(ParameterInfo[] parameters) =>
        parameters.Any(static parameter => parameter.ParameterType == typeof(CommandExecutionLane));

    private static bool AcceptsSystemActorKey(ParameterInfo[] parameters) =>
        parameters.Any(static parameter => parameter.ParameterType == typeof(SystemActorKey));

    private static bool NamesTheSystemLane(string methodName) =>
        methodName.StartsWith("Create", StringComparison.Ordinal)
        && methodName.Contains("System", StringComparison.Ordinal);

    // ---------------------------------------------------------------------------------------------
    // Fixtures for the negative controls. These are test-local and never reachable from src.
    // ---------------------------------------------------------------------------------------------

    private sealed class DecoyAuthoritySource
    {
        public static DecoyAuthoritySource CreateSystem() => new();
    }

    private sealed class CompliantAuthoritySource
    {
        public static CompliantAuthoritySource CreateSystem(SystemActorKey systemActorKey)
        {
            ArgumentNullException.ThrowIfNull(systemActorKey);
            return new CompliantAuthoritySource();
        }
    }
}
