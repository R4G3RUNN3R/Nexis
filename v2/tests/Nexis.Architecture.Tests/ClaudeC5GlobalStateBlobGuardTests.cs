using System.Collections;
using System.Reflection;
using System.Text.Json;
using System.Text.Json.Nodes;
using System.Text.RegularExpressions;
using Microsoft.VisualStudio.TestTools.UnitTesting;
using Nexis.Core.Contracts;

namespace Nexis.Architecture.Tests;

/// <summary>
/// The stop condition that no global authoritative player blob exists had no executable guard, even
/// though `AGENT-HANDOFF.md`, `STATE-OWNERSHIP.md` (required architecture test 5) and
/// `COMMAND-EXECUTION.md` (required test 17) all name it. Documentation is not a guard: the whole
/// point of the prohibition is that a future slice must fail loudly the moment it reintroduces the
/// V1 shape, not that a reviewer must remember to notice.
///
/// Three prohibitions are enforced, from `STATE-OWNERSHIP.md`:
///
/// 1. no type is a global mutable current-state container (`PlayerState`, `RuntimeState`,
///    `CharacterState`, `Qualities`, global `counters`, universal `PlayerSnapshot`);
/// 2. no public contract exposes a generic string-keyed bag as an ownership model;
/// 3. no owner transition is a generic path/value patch such as `player.gold -= 20`.
///
/// Two scans are used because they have different reach. Reflection inspects real member types but
/// only sees assemblies this test project references; the source scan sees every project under
/// `src/`, including `Nexis.Persistence.Postgres` and `Nexis.Host.Api`, which this project
/// deliberately does not reference. Each scan has a non-vacuity test proving it actually detects a
/// violation, because a scan that has never caught anything is indistinguishable from a scan that
/// cannot.
/// </summary>
[TestClass]
public sealed class ClaudeC5GlobalStateBlobGuardTests
{
    /// <summary>
    /// Names V1 used, or would naturally be reached for, when reintroducing one mutable object that
    /// owns the whole player. Matched on the declared type name only, so a capability token or a
    /// staff-facing label containing these words is unaffected.
    /// </summary>
    private static readonly string[] ProhibitedStateContainerNames =
    [
        "PlayerState",
        "RuntimeState",
        "RuntimePlayerState",
        "CharacterState",
        "PlayerAggregate",
        "PlayerBlob",
        "PlayerSnapshot",
        "PlayerCurrent",
        "PlayerQualities",
        "Qualities",
        "PlayerCounters",
        "PlayerCondition"
    ];

    private static readonly Type[] ProhibitedBagValueTypes =
    [
        typeof(object),
        typeof(JsonElement),
        typeof(JsonNode),
        typeof(JsonDocument)
    ];

    private static readonly string[] ProhibitedPatchPathMemberNames =
    [
        "Path",
        "PropertyPath",
        "FieldPath",
        "StatePath",
        "Pointer"
    ];

    // ---------------------------------------------------------------------------------------
    // Reflection scans
    // ---------------------------------------------------------------------------------------

    [TestMethod]
    public void NoNexisAssemblyDeclaresAGlobalPlayerOrRuntimeStateContainer()
    {
        var violations = FindProhibitedStateContainers(NexisTypes());

        Assert.AreEqual(
            0,
            violations.Length,
            "A global authoritative player/runtime state container reappeared: " + string.Join(", ", violations));
    }

    [TestMethod]
    public void NoNexisTypeExposesAGenericStringKeyedStateBag()
    {
        var violations = FindGenericStateBags(NexisTypes());

        Assert.AreEqual(
            0,
            violations.Length,
            "A generic string-keyed state bag is not an ownership model: " + string.Join(", ", violations));
    }

    [TestMethod]
    public void NoOwnerTransitionIsAGenericPathValuePatch()
    {
        var transitions = NexisTypes()
            .Where(static type => typeof(IOwnerTransition).IsAssignableFrom(type))
            .Where(static type => type is { IsInterface: false, IsAbstract: false })
            .ToArray();

        Assert.IsTrue(
            transitions.Length > 0,
            "The patch guard must govern a non-empty set of real owner transitions.");

        var violations = FindPathValuePatches(transitions);

        Assert.AreEqual(
            0,
            violations.Length,
            "Owner transitions must be typed and owner-addressed, never a path/value patch: "
            + string.Join(", ", violations));
    }

    /// <summary>
    /// The reflection scan is only meaningful if it governs the real contract surface, so the
    /// assembly set is pinned rather than left to whatever happened to be loaded.
    /// </summary>
    [TestMethod]
    public void ReflectionScan_GovernsTheRealContractAndCoreSurface()
    {
        var scanned = NexisAssemblies()
            .Select(static assembly => assembly.GetName().Name ?? string.Empty)
            .ToArray();

        foreach (var required in new[]
                 {
                     "Nexis.Core",
                     "Nexis.Core.Contracts",
                     "Nexis.Equipment.Contracts",
                     "Nexis.Execution",
                     "Nexis.Identity.Contracts",
                     "Nexis.Inventory.Contracts",
                     "Nexis.Kernel"
                 })
        {
            Assert.IsTrue(
                scanned.Contains(required, StringComparer.Ordinal),
                $"The blob guard must govern {required}.");
        }

        Assert.IsFalse(
            scanned.Contains("Nexis.Architecture.Tests", StringComparer.Ordinal),
            "The test assembly holds deliberate synthetic violations and must never be scanned.");
        Assert.IsTrue(NexisTypes().Length > 100, "The blob guard must govern a substantial type surface.");
    }

    // ---------------------------------------------------------------------------------------
    // Reflection non-vacuity
    // ---------------------------------------------------------------------------------------

    [TestMethod]
    public void StateContainerScan_ActuallyDetectsAContainerWhenOneExists()
    {
        var violations = FindProhibitedStateContainers([typeof(RuntimeState), typeof(EquipItemSafeType)]);

        CollectionAssert.AreEqual(
            new[] { typeof(RuntimeState).FullName },
            violations);
    }

    [TestMethod]
    public void GenericBagScan_ActuallyDetectsEachProhibitedBagShape()
    {
        var violations = FindGenericStateBags([
            typeof(ForbiddenDictionaryBag),
            typeof(ForbiddenReadOnlyJsonBag),
            typeof(ForbiddenBagField),
            typeof(EquipItemSafeType)
        ]);

        Assert.AreEqual(3, violations.Length, string.Join(", ", violations));
        Assert.IsTrue(violations.All(static violation => !violation.Contains(nameof(EquipItemSafeType), StringComparison.Ordinal)));
    }

    [TestMethod]
    public void PathValuePatchScan_ActuallyDetectsAPatchTransitionWhenOneExists()
    {
        var violations = FindPathValuePatches([typeof(ForbiddenPatchTransition), typeof(TypedOwnerTransition)]);

        CollectionAssert.AreEqual(
            new[] { $"{typeof(ForbiddenPatchTransition).FullName}.Path" },
            violations);
    }

    // ---------------------------------------------------------------------------------------
    // Source scan, covering projects this test project deliberately does not reference
    // ---------------------------------------------------------------------------------------

    [TestMethod]
    public void NoSourceProjectDeclaresAGlobalPlayerOrRuntimeStateContainer()
    {
        var sources = ReadSourceFiles();

        Assert.IsTrue(sources.Length > 50, "The source blob scan must govern the real source tree.");
        Assert.IsTrue(
            sources.Any(static source => source.Path.EndsWith("PostgresAtomicCommandCommitter.cs", StringComparison.Ordinal)),
            "The source scan must reach projects the test project does not reference.");

        var violations = FindDeclaredStateContainers(sources);

        Assert.AreEqual(
            0,
            violations.Length,
            "A global authoritative player/runtime state container was declared in source: "
            + string.Join(", ", violations));
    }

    [TestMethod]
    public void SourceScan_ActuallyDetectsEveryProhibitedDeclarationForm()
    {
        var violations = FindDeclaredStateContainers([
            new SourceFile("Synthetic/Blob.cs", "public sealed class RuntimeState { }"),
            new SourceFile("Synthetic/Record.cs", "public sealed record PlayerState(int Gold);"),
            new SourceFile("Synthetic/Struct.cs", "internal readonly struct Qualities { }"),
            new SourceFile("Synthetic/Interface.cs", "public interface CharacterState { }"),
            new SourceFile("Synthetic/Safe.cs", "public sealed class InventorySnapshot { }"),
            new SourceFile(
                "Synthetic/SafeMention.cs",
                "// PlayerState is prohibited; see STATE-OWNERSHIP.md\nvar playerStateLabel = \"PlayerState\";")
        ]);

        CollectionAssert.AreEquivalent(
            new[]
            {
                "Synthetic/Blob.cs: RuntimeState",
                "Synthetic/Record.cs: PlayerState",
                "Synthetic/Struct.cs: Qualities",
                "Synthetic/Interface.cs: CharacterState"
            },
            violations);
    }

    // ---------------------------------------------------------------------------------------
    // Scans
    // ---------------------------------------------------------------------------------------

    private static string[] FindProhibitedStateContainers(IEnumerable<Type> types) =>
        types
            .Where(static type => ProhibitedStateContainerNames.Contains(
                TrimGenericArity(type.Name),
                StringComparer.Ordinal))
            .Select(static type => type.FullName ?? type.Name)
            .OrderBy(static name => name, StringComparer.Ordinal)
            .ToArray();

    private static string[] FindGenericStateBags(IEnumerable<Type> types) =>
        types
            .SelectMany(static type => DeclaredMembers(type)
                .Where(static member => IsProhibitedBag(MemberType(member)))
                .Select(member => $"{type.FullName ?? type.Name}.{member.Name}"))
            .OrderBy(static name => name, StringComparer.Ordinal)
            .ToArray();

    private static string[] FindPathValuePatches(IEnumerable<Type> types) =>
        types
            .SelectMany(static type => DeclaredMembers(type)
                .Where(static member =>
                    ProhibitedPatchPathMemberNames.Contains(member.Name, StringComparer.Ordinal) ||
                    MemberType(member) == typeof(object))
                .Select(member => $"{type.FullName ?? type.Name}.{member.Name}"))
            .OrderBy(static name => name, StringComparer.Ordinal)
            .ToArray();

    private static string[] FindDeclaredStateContainers(IEnumerable<SourceFile> sources)
    {
        var pattern = new Regex(
            @"\b(?:class|record|struct|interface)\s+(?<name>\w+)",
            RegexOptions.CultureInvariant);

        return sources
            .SelectMany(source => pattern.Matches(source.Text)
                .Select(match => match.Groups["name"].Value)
                .Where(static name => ProhibitedStateContainerNames.Contains(name, StringComparer.Ordinal))
                .Select(name => $"{source.Path}: {name}"))
            .OrderBy(static violation => violation, StringComparer.Ordinal)
            .ToArray();
    }

    private static bool IsProhibitedBag(Type type)
    {
        if (type.IsArray || !typeof(IEnumerable).IsAssignableFrom(type))
        {
            return false;
        }

        foreach (var candidate in new[] { type }.Concat(type.GetInterfaces()))
        {
            if (!candidate.IsGenericType)
            {
                continue;
            }

            var arguments = candidate.GetGenericArguments();
            if (arguments.Length == 2 &&
                arguments[0] == typeof(string) &&
                ProhibitedBagValueTypes.Contains(arguments[1]))
            {
                return true;
            }

            if (arguments.Length == 1 &&
                arguments[0].IsGenericType &&
                arguments[0].GetGenericTypeDefinition() == typeof(KeyValuePair<,>) &&
                arguments[0].GetGenericArguments() is [var key, var value] &&
                key == typeof(string) &&
                ProhibitedBagValueTypes.Contains(value))
            {
                return true;
            }
        }

        return false;
    }

    private static MemberInfo[] DeclaredMembers(Type type) =>
        type.GetMembers(BindingFlags.Public | BindingFlags.Instance | BindingFlags.DeclaredOnly)
            .Where(static member => member is PropertyInfo or FieldInfo)
            .ToArray();

    private static Type MemberType(MemberInfo member) => member switch
    {
        PropertyInfo property => property.PropertyType,
        FieldInfo field => field.FieldType,
        _ => typeof(void)
    };

    private static string TrimGenericArity(string name)
    {
        var index = name.IndexOf('`', StringComparison.Ordinal);
        return index < 0 ? name : name[..index];
    }

    private static Assembly[] NexisAssemblies() =>
        Directory
            .EnumerateFiles(AppContext.BaseDirectory, "Nexis.*.dll")
            .Select(Path.GetFileNameWithoutExtension)
            .OfType<string>()
            .Where(static name => !name.EndsWith(".Tests", StringComparison.Ordinal))
            .Distinct(StringComparer.Ordinal)
            .Select(static name => Assembly.Load(name))
            .OrderBy(static assembly => assembly.GetName().Name, StringComparer.Ordinal)
            .ToArray();

    private static Type[] NexisTypes() =>
        NexisAssemblies().SelectMany(static assembly => assembly.GetTypes()).ToArray();

    private static SourceFile[] ReadSourceFiles()
    {
        var sourceDirectory = Path.Combine(FindSolutionDirectory(), "src");
        return Directory
            .EnumerateFiles(sourceDirectory, "*.cs", SearchOption.AllDirectories)
            .Where(static path => !path.Contains($"{Path.DirectorySeparatorChar}obj{Path.DirectorySeparatorChar}", StringComparison.Ordinal))
            .Where(static path => !path.Contains($"{Path.DirectorySeparatorChar}bin{Path.DirectorySeparatorChar}", StringComparison.Ordinal))
            .Select(static path => new SourceFile(path, File.ReadAllText(path)))
            .ToArray();
    }

    private static string FindSolutionDirectory()
    {
        var directory = new DirectoryInfo(AppContext.BaseDirectory);
        while (directory is not null)
        {
            if (File.Exists(Path.Combine(directory.FullName, "Nexis.slnx")))
            {
                return directory.FullName;
            }

            directory = directory.Parent;
        }

        throw new DirectoryNotFoundException("Could not locate the Nexis V2 solution root for the blob guard.");
    }

    private sealed record SourceFile(string Path, string Text);

    // ---------------------------------------------------------------------------------------
    // Deliberate synthetic violations, used only to prove the scans are not vacuous
    // ---------------------------------------------------------------------------------------

    /// <summary>
    /// Deliberately named exactly what the prohibition forbids, so the scan is exercised against a
    /// real match. It is nested inside the test assembly, which the reflection scan excludes and the
    /// source scan never reads, so it cannot become a false positive for the real guards.
    /// </summary>
    private sealed class RuntimeState;

    private sealed class EquipItemSafeType
    {
        public IReadOnlyList<string> Slots { get; } = Array.Empty<string>();

        public IReadOnlyDictionary<string, int> Counts { get; } = new Dictionary<string, int>();
    }

    private sealed class ForbiddenDictionaryBag
    {
        public Dictionary<string, object> Qualities { get; } = new();
    }

    private sealed class ForbiddenReadOnlyJsonBag
    {
        public IReadOnlyDictionary<string, JsonElement> Extensions { get; } =
            new Dictionary<string, JsonElement>();
    }

    private sealed class ForbiddenBagField
    {
#pragma warning disable CA2211
        public IDictionary<string, object> Counters = new Dictionary<string, object>();
#pragma warning restore CA2211
    }

    private sealed record ForbiddenPatchTransition : IOwnerTransition
    {
        public ContractDescriptor Contract { get; } = new("tests.forbidden.patch", 1);

        public OwnerKey TargetOwner { get; } = new("Anything");

        public long? ExpectedRevision => null;

        public string Path { get; } = "player.gold";
    }

    private sealed record TypedOwnerTransition : IOwnerTransition
    {
        public ContractDescriptor Contract { get; } = new("tests.typed.transition", 1);

        public OwnerKey TargetOwner { get; } = new("Economy");

        public long? ExpectedRevision => 1;

        public long DebitMinorUnits { get; } = 20;
    }
}
