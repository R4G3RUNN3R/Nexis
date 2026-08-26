using System.Xml.Linq;
using Microsoft.VisualStudio.TestTools.UnitTesting;
using Nexis.Automation.Contracts;
using Nexis.Core.Contracts;
using Nexis.Execution.Contracts;
using Nexis.Identity.Contracts;
using Nexis.Kernel.Commands;
using Nexis.Kernel.Events;

namespace Nexis.Architecture.Tests;

[TestClass]
public sealed class AutomationArchitectureTests
{
    [TestMethod]
    public void AutomationContracts_ReferenceOnlyApprovedStableBoundaries()
    {
        var references = GetNexisReferences(typeof(IAutomatedCommandGateway).Assembly);

        CollectionAssert.AreEquivalent(
            new[] { "Nexis.Core.Contracts", "Nexis.Identity.Contracts", "Nexis.Kernel" },
            references);
    }

    [TestMethod]
    public void AutomatedRequestCarriesIntentAndSystemIdentityButNoMutationResult()
    {
        var actor = new SystemActorKey("NEXIS.SCHEDULER");
        var request = new AutomatedCommandRequest(
            actor,
            CommandId.New(),
            CorrelationId.New(),
            new SyntheticIntent());

        Assert.AreEqual("nexis.scheduler", request.Actor.Value);
        Assert.AreEqual("tests.automation.synthetic", request.Intent.Contract.Name);

        var propertyTypes = typeof(AutomatedCommandRequest)
            .GetProperties()
            .Select(static property => property.PropertyType)
            .ToArray();

        Assert.IsFalse(propertyTypes.Any(static type => typeof(IOwnerTransition).IsAssignableFrom(type)));
        Assert.IsFalse(propertyTypes.Contains(typeof(CoreDecision)));
    }

    [TestMethod]
    public void SystemActorBindingDistinguishesAutomatedAuthorities()
    {
        var scheduler = CommandActorBinding.From(
            TrustedActorContext.CreateSystem(new SystemActorKey("nexis.scheduler")));
        var ciel = CommandActorBinding.From(
            TrustedActorContext.CreateSystem(new SystemActorKey("nexis.ciel")));

        Assert.AreNotEqual(scheduler, ciel);
        Assert.AreEqual("nexis.scheduler", scheduler.SystemActorKey?.Value);
        Assert.AreEqual("nexis.ciel", ciel.SystemActorKey?.Value);
        Assert.IsFalse(scheduler.AccountId.HasValue);
        Assert.IsFalse(scheduler.CharacterId.HasValue);
    }

    [TestMethod]
    public void FutureCielAndSchedulingProjectsCannotReferenceMutationBypassAssemblies()
    {
        var solutionDirectory = FindSolutionDirectory();
        var sourceDirectory = Path.Combine(solutionDirectory, "src");
        var guardedProjects = Directory
            .EnumerateFiles(sourceDirectory, "*.csproj", SearchOption.AllDirectories)
            .Where(static path =>
            {
                var projectName = Path.GetFileNameWithoutExtension(path);
                return projectName.StartsWith("Nexis.Ciel", StringComparison.OrdinalIgnoreCase) ||
                       projectName.StartsWith("Nexis.Scheduling", StringComparison.OrdinalIgnoreCase);
            })
            .ToArray();

        var forbidden = new[]
        {
            "Nexis.Core",
            "Nexis.Execution",
            "Nexis.Execution.Contracts",
            "Nexis.Persistence.Postgres"
        };

        foreach (var projectPath in guardedProjects)
        {
            var document = XDocument.Load(projectPath);
            var references = document
                .Descendants("ProjectReference")
                .Select(static element => element.Attribute("Include")?.Value ?? string.Empty)
                .Select(Path.GetFileNameWithoutExtension)
                .Where(static name => !string.IsNullOrWhiteSpace(name))
                .ToArray();

            var forbiddenReference = references.FirstOrDefault(reference =>
                forbidden.Any(blocked => string.Equals(reference, blocked, StringComparison.OrdinalIgnoreCase)) ||
                reference.StartsWith("Nexis.Modules.", StringComparison.OrdinalIgnoreCase));

            Assert.IsNull(
                forbiddenReference,
                $"Automated component '{Path.GetFileNameWithoutExtension(projectPath)}' bypasses the approved command gateway via '{forbiddenReference}'.");
        }
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

        throw new DirectoryNotFoundException("Could not locate the Nexis V2 solution root for automation architecture tests.");
    }

    private static string[] GetNexisReferences(System.Reflection.Assembly assembly) =>
        assembly.GetReferencedAssemblies()
            .Select(static reference => reference.Name ?? string.Empty)
            .Where(static name => name.StartsWith("Nexis.", StringComparison.Ordinal))
            .OrderBy(static name => name, StringComparer.Ordinal)
            .ToArray();

    private sealed record SyntheticIntent : ICoreIntent
    {
        public ContractDescriptor Contract { get; } = new("tests.automation.synthetic", 1);
    }
}
