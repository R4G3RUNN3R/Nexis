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
    public void SystemActorRegistryIsClosedCaseNormalizedAndCannotBeEmpty()
    {
        Assert.ThrowsExactly<ArgumentException>(() => new SystemActorRegistry(Array.Empty<SystemActorKey>()));

        var registry = new SystemActorRegistry(new[]
        {
            new SystemActorKey("NEXIS.SCHEDULER"),
            new SystemActorKey("nexis.ciel")
        });

        Assert.IsTrue(registry.IsRegistered(new SystemActorKey("nexis.scheduler")));
        Assert.IsTrue(registry.IsRegistered(new SystemActorKey("NEXIS.CIEL")));
        Assert.IsFalse(registry.IsRegistered(new SystemActorKey("nexis.retired-authority")));
    }

    [TestMethod]
    public void AutomatedGatewayContractRequiresAnExplicitSubmissionDisposition()
    {
        var submit = typeof(IAutomatedCommandGateway).GetMethod(nameof(IAutomatedCommandGateway.SubmitAsync));

        Assert.IsNotNull(submit);
        Assert.AreEqual(
            typeof(ValueTask<AutomatedCommandSubmissionResult>),
            submit.ReturnType,
            "Automated ingress must make identity rejection explicit to its caller.");
    }

    [TestMethod]
    public void OnlyExplicitCompositionProjectsMayReferenceMutationAssemblies()
    {
        var solutionDirectory = FindSolutionDirectory();
        var sourceDirectory = Path.Combine(solutionDirectory, "src");
        var sourceProjects = Directory
            .EnumerateFiles(sourceDirectory, "*.csproj", SearchOption.AllDirectories)
            .ToArray();

        Assert.IsTrue(sourceProjects.Length > 0, "The automation dependency guard must govern a non-empty source-project set.");

        var dependencies = sourceProjects.SelectMany(projectPath =>
            XDocument.Load(projectPath)
                .Descendants("ProjectReference")
                .Select(static element => element.Attribute("Include")?.Value ?? string.Empty)
                .Select(static path => Path.GetFileNameWithoutExtension(path) ?? string.Empty)
                .Where(static name => !string.IsNullOrWhiteSpace(name))
                .Select(reference => (Project: Path.GetFileNameWithoutExtension(projectPath)!, Reference: reference)));

        var bypasses = FindMutationBypasses(dependencies);

        Assert.AreEqual(
            0,
            bypasses.Length,
            "A project outside the explicit trusted composition allowlist references a mutation boundary: "
            + string.Join(", ", bypasses));
    }

    internal static string[] FindMutationBypasses(IEnumerable<(string Project, string Reference)> dependencies)
    {
        var allowed = new HashSet<(string Project, string Reference)>
        {
            ("Nexis.Host.Api", "Nexis.Core"),
            ("Nexis.Host.Api", "Nexis.Modules.Audit"),
            ("Nexis.Host.Api", "Nexis.Modules.Identity"),
            ("Nexis.Modules.Equipment", "Nexis.Execution.Contracts"),
            ("Nexis.Persistence.Postgres", "Nexis.Execution"),
            ("Nexis.Persistence.Postgres", "Nexis.Execution.Contracts")
        };

        return dependencies
            .Where(static dependency => IsMutationBoundary(dependency.Reference))
            .Where(dependency => !allowed.Contains(dependency))
            .Select(static dependency => $"{dependency.Project}->{dependency.Reference}")
            .OrderBy(static dependency => dependency, StringComparer.Ordinal)
            .ToArray();
    }

    private static bool IsMutationBoundary(string reference) =>
        string.Equals(reference, "Nexis.Core", StringComparison.Ordinal) ||
        string.Equals(reference, "Nexis.Execution", StringComparison.Ordinal) ||
        string.Equals(reference, "Nexis.Execution.Contracts", StringComparison.Ordinal) ||
        string.Equals(reference, "Nexis.Persistence.Postgres", StringComparison.Ordinal) ||
        reference.StartsWith("Nexis.Modules.", StringComparison.Ordinal);

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
