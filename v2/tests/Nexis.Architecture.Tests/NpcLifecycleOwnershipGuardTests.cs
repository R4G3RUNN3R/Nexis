using System.Xml.Linq;
using Microsoft.VisualStudio.TestTools.UnitTesting;
using Nexis.Npcs.Contracts;

namespace Nexis.Architecture.Tests;

[TestClass]
public sealed class NpcLifecycleOwnershipGuardTests
{
    [TestMethod]
    public void NpcContracts_AreInfrastructureNeutral()
    {
        var references = typeof(NpcLifecycleSnapshot).Assembly
            .GetReferencedAssemblies()
            .Select(static reference => reference.Name ?? string.Empty)
            .ToArray();
        var forbidden = new[] { "Npgsql", "EntityFrameworkCore", "AspNetCore", "StackExchange.Redis" };

        Assert.IsFalse(
            references.Any(reference => forbidden.Any(fragment =>
                reference.Contains(fragment, StringComparison.OrdinalIgnoreCase))),
            $"NPC contracts leaked infrastructure references: {string.Join(", ", references)}");
    }

    [TestMethod]
    public void OnlyNpcLifecyclePostgresOwnerWritesNpcLifecycleTableFromCSharp()
    {
        var src = Path.Combine(FindSolutionDirectory(), "src");
        var writers = Directory.EnumerateFiles(src, "*.cs", SearchOption.AllDirectories)
            .Where(path => File.ReadAllText(path).Contains(
                "nexis_v2.npc_lifecycle_state",
                StringComparison.Ordinal))
            .Select(path => Path.GetRelativePath(src, path).Replace('\\', '/'))
            .OrderBy(static path => path, StringComparer.Ordinal)
            .ToArray();

        CollectionAssert.AreEqual(
            new[] { "Nexis.Persistence.Postgres/PostgresNpcLifecycleOwner.cs" },
            writers);
    }

    [TestMethod]
    public void HostApi_DoesNotReferenceNpcMutationModuleInSlice01()
    {
        var root = FindSolutionDirectory();
        var hostProject = XDocument.Load(Path.Combine(root, "src", "Nexis.Host.Api", "Nexis.Host.Api.csproj"));
        var refs = hostProject.Descendants("ProjectReference")
            .Select(static element => element.Attribute("Include")?.Value ?? string.Empty)
            .Select(static include => include.Replace('\\', '/'))
            .ToArray();

        Assert.IsFalse(refs.Any(static include =>
            include.EndsWith("Nexis.Modules.Npcs/Nexis.Modules.Npcs.csproj", StringComparison.Ordinal)));
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

        throw new DirectoryNotFoundException("Could not locate the Nexis V2 solution root.");
    }
}
