using Microsoft.VisualStudio.TestTools.UnitTesting;

namespace Nexis.Architecture.Tests;

/// <summary>
/// L4 residual, found by the Claude continuation shift against 2f68ef2.
///
/// 2f68ef2 correctly inverted the automation dependency guard from a prefix scan over
/// Nexis.Ciel*/Nexis.Scheduling* - neither of which exists - into an explicit trusted-composition
/// allowlist, and gave it a negative control. But the negative control feeds already-clean pairs
/// straight into the policy function, so it never exercises the .csproj parsing path, and that is
/// where the vacuity moved to rather than being removed.
///
/// ProjectReference Include attributes carry Windows separators
/// (<c>..\Nexis.Execution.Contracts\Nexis.Execution.Contracts.csproj</c>). On Linux
/// <see cref="System.IO.Path.GetFileNameWithoutExtension(string)"/> does not treat '\' as a
/// separator, so the reference parses with its directory prefix still attached and matches no
/// mutation-boundary name. The classified set is empty, every allowlist entry is unreachable dead
/// configuration, and OnlyExplicitCompositionProjectsMayReferenceMutationAssemblies reports zero
/// bypasses because it looked at nothing.
///
/// These tests bound the guard from below: they assert it observes the repository at all. Without
/// them the allowlist can silently stop governing anything again and still report green - the exact
/// failure mode L4 was raised for.
///
/// Naming follows ClaudeOvernightAdversarialTests: "Must" = RED until fixed, never to be made green
/// by weakening an assertion.
/// </summary>
[TestClass]
public sealed class ClaudeContinuationAutomationGuardTests
{
    /// <summary>
    /// The parser must yield bare assembly names. A name still carrying a path separator cannot
    /// match any entry in the allowlist or any mutation-boundary name, so it is silently unguarded.
    /// </summary>
    [TestMethod]
    public void AutomationDependencyScan_MustParseProjectReferencesIntoBareAssemblyNames()
    {
        var malformed = AutomationArchitectureTests.ReadSourceDependencies()
            .Where(static dependency =>
                dependency.Reference.Contains('\\', StringComparison.Ordinal) ||
                dependency.Reference.Contains('/', StringComparison.Ordinal))
            .Select(static dependency => $"{dependency.Project}->{dependency.Reference}")
            .OrderBy(static description => description, StringComparer.Ordinal)
            .ToArray();

        Assert.AreEqual(
            0,
            malformed.Length,
            "The automation dependency scan produced reference names that still contain a path "
            + "separator, so they can never equal a mutation-boundary assembly name nor an allowlist "
            + "entry: "
            + string.Join(", ", malformed)
            + ". ProjectReference Include uses Windows separators and Path.GetFileNameWithoutExtension "
            + "does not split on '\\' when running on Linux. Normalize the separator before taking "
            + "the file name. Do NOT resolve this by relaxing the allowlist or by deleting the guard.");
    }

    /// <summary>
    /// Non-vacuity. v2/src genuinely contains trusted composition projects that reference mutation
    /// boundaries, so a working scan must classify at least one. Zero means the guard is asserting
    /// over an empty set again.
    /// </summary>
    [TestMethod]
    public void AutomationDependencyScan_MustActuallyObserveRealMutationBoundaryReferences()
    {
        var observed = AutomationArchitectureTests.ReadSourceDependencies()
            .Where(static dependency => AutomationArchitectureTests.IsMutationBoundary(dependency.Reference))
            .Select(static dependency => $"{dependency.Project}->{dependency.Reference}")
            .OrderBy(static description => description, StringComparer.Ordinal)
            .ToArray();

        Assert.IsTrue(
            observed.Length > 0,
            "The automation dependency guard classified zero mutation-boundary references across the "
            + "whole of v2/src. Nexis.Host.Api, Nexis.Persistence.Postgres and Nexis.Modules.Equipment "
            + "all reference one today, so a scan that sees none is not observing the repository and "
            + "its allowlist is unreachable dead configuration. "
            + "OnlyExplicitCompositionProjectsMayReferenceMutationAssemblies is then green because it "
            + "looked at nothing, which is precisely finding L4.");
    }

    /// <summary>
    /// Protective. Every reference the scan classifies as a mutation boundary must be accounted for
    /// by the allowlist, and the allowlist must not have drifted into listing entries that no longer
    /// exist. This is what stops the guard being "fixed" by widening the allowlist to cover whatever
    /// it happens to find.
    /// </summary>
    [TestMethod]
    public void AutomationAllowlist_RemainsExactlyTheObservedTrustedCompositionSet()
    {
        var observed = AutomationArchitectureTests.ReadSourceDependencies()
            .Where(static dependency => AutomationArchitectureTests.IsMutationBoundary(dependency.Reference))
            .Select(static dependency => $"{dependency.Project}->{dependency.Reference}")
            .Distinct(StringComparer.Ordinal)
            .OrderBy(static description => description, StringComparer.Ordinal)
            .ToArray();

        CollectionAssert.AreEqual(
            new[]
            {
                "Nexis.Execution->Nexis.Execution.Contracts",
                "Nexis.History.Replay->Nexis.Execution.Contracts",
                "Nexis.Host.Api->Nexis.Core",
                "Nexis.Host.Api->Nexis.Modules.Audit",
                "Nexis.Host.Api->Nexis.Modules.Identity",
                "Nexis.Modules.Equipment->Nexis.Execution.Contracts",
                "Nexis.Persistence.Postgres->Nexis.Execution",
                "Nexis.Persistence.Postgres->Nexis.Execution.Contracts"
            },
            observed,
            "The set of mutation-boundary references in v2/src changed. If a project was added, it "
            + "must be reviewed and added to the allowlist in AutomationArchitectureTests "
            + "deliberately, not absorbed silently.");
    }
}
