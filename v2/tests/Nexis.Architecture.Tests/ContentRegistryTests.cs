using Microsoft.VisualStudio.TestTools.UnitTesting;
using Nexis.Content.Contracts;
using Nexis.Content.Registry;
using Nexis.Core.Contracts;

namespace Nexis.Architecture.Tests;

[TestClass]
public sealed class ContentRegistryTests
{
    [TestMethod]
    public void ContentContracts_ReferenceOnlyCoreContracts()
    {
        var references = GetNexisReferences(typeof(IContentRegistryReader).Assembly);

        CollectionAssert.AreEquivalent(new[] { "Nexis.Core.Contracts" }, references);
    }

    [TestMethod]
    public void CoreContracts_DoNotDependOnContentRegistryContracts()
    {
        var references = GetNexisReferences(typeof(ICoreContentInput).Assembly);

        Assert.IsFalse(references.Contains("Nexis.Content.Contracts", StringComparer.Ordinal));
        Assert.IsFalse(references.Contains("Nexis.Content.Registry", StringComparer.Ordinal));
    }

    [TestMethod]
    public void ContentContracts_AreInfrastructureNeutral()
    {
        var references = typeof(IContentRegistryReader).Assembly
            .GetReferencedAssemblies()
            .Select(static reference => reference.Name ?? string.Empty)
            .ToArray();
        var forbidden = new[] { "Npgsql", "EntityFrameworkCore", "AspNetCore", "StackExchange.Redis", "Newtonsoft.Json" };

        Assert.IsFalse(
            references.Any(reference => forbidden.Any(fragment => reference.Contains(fragment, StringComparison.OrdinalIgnoreCase))),
            $"Content contracts leaked infrastructure references: {string.Join(", ", references)}");
    }

    [TestMethod]
    public async Task Registry_ResolvesExactVersionAndPreservesRequestedOrder()
    {
        var v1 = new ContentVersion("content-v1");
        var v2 = new ContentVersion("content-v2");
        var swordKey = Key("items.weapon", 1, "iron-sword");
        var potionKey = Key("items.consumable", 1, "healing-potion");
        var swordV1 = Definition(swordKey, 10);
        var swordV2 = Definition(swordKey, 20);
        var potionV2 = Definition(potionKey, 30);
        var registry = new ImmutableContentRegistry(new[]
        {
            new ContentRegistryEntry(v1, swordV1),
            new ContentRegistryEntry(v2, swordV2),
            new ContentRegistryEntry(v2, potionV2)
        });

        var result = await registry.ResolveAsync(new ContentResolutionRequest(v2, new[] { potionKey, swordKey }));

        Assert.AreEqual(v2, result.Version);
        Assert.AreSame(potionV2, result.Definitions[0]);
        Assert.AreSame(swordV2, result.Definitions[1]);
        Assert.AreEqual(2, result.AsCoreInputs().Count);
    }

    [TestMethod]
    public async Task Registry_DoesNotFallbackToLatestOrAnotherVersion()
    {
        var v1 = new ContentVersion("content-v1");
        var v2 = new ContentVersion("content-v2");
        var key = Key("items.weapon", 1, "iron-sword");
        var registry = new ImmutableContentRegistry(new[]
        {
            new ContentRegistryEntry(v2, Definition(key, 20))
        });

        var exception = await Assert.ThrowsExactlyAsync<ContentDefinitionNotFoundException>(async () =>
        {
            await registry.ResolveAsync(new ContentResolutionRequest(v1, new[] { key }));
        });

        Assert.AreEqual(v1, exception.Version);
        Assert.AreEqual(key, exception.Key);
    }

    [TestMethod]
    public void Registry_RejectsDuplicateDefinitionForSameVersionAndKey()
    {
        var version = new ContentVersion("content-v1");
        var key = Key("items.weapon", 1, "iron-sword");

        Assert.ThrowsExactly<ArgumentException>(() => new ImmutableContentRegistry(new[]
        {
            new ContentRegistryEntry(version, Definition(key, 10)),
            new ContentRegistryEntry(version, Definition(key, 11))
        }));
    }

    [TestMethod]
    public void ResolutionRequest_RejectsDuplicateKeysAndFreezesCallerCollection()
    {
        var version = new ContentVersion("content-v1");
        var first = Key("items.weapon", 1, "iron-sword");
        var second = Key("items.weapon", 1, "steel-sword");
        var mutable = new List<ContentDefinitionKey> { first, second };
        var request = new ContentResolutionRequest(version, mutable);

        mutable.Clear();

        Assert.AreEqual(2, request.Keys.Count);
        Assert.ThrowsExactly<ArgumentException>(() =>
            new ContentResolutionRequest(version, new[] { first, first }));
    }

    [TestMethod]
    public void Resolution_RejectsWrongDefinitionEvenWhenCountMatches()
    {
        var version = new ContentVersion("content-v1");
        var requested = Key("items.weapon", 1, "iron-sword");
        var wrong = Key("items.weapon", 1, "steel-sword");
        var request = new ContentResolutionRequest(version, new[] { requested });

        Assert.ThrowsExactly<ArgumentException>(() =>
            new ContentResolution(request, new[] { Definition(wrong, 99) }));
    }

    [TestMethod]
    public async Task SameDefinitionIdUnderDifferentTypedContract_RemainsDistinct()
    {
        var version = new ContentVersion("content-v1");
        var weaponKey = Key("items.weapon", 1, "shared-name");
        var spellKey = Key("magic.spell", 1, "shared-name");
        var weapon = Definition(weaponKey, 1);
        var spell = Definition(spellKey, 2);
        var registry = new ImmutableContentRegistry(new[]
        {
            new ContentRegistryEntry(version, weapon),
            new ContentRegistryEntry(version, spell)
        });

        var result = await registry.ResolveAsync(new ContentResolutionRequest(version, new[] { weaponKey, spellKey }));

        Assert.AreSame(weapon, result.Definitions[0]);
        Assert.AreSame(spell, result.Definitions[1]);
    }

    private static ContentDefinitionKey Key(string contractName, int schemaVersion, string definitionId) =>
        new(new ContractDescriptor(contractName, schemaVersion), new ContentDefinitionId(definitionId));

    private static SyntheticDefinition Definition(ContentDefinitionKey key, int value) =>
        new(key.Contract, key.DefinitionId, value);

    private static string[] GetNexisReferences(System.Reflection.Assembly assembly) =>
        assembly.GetReferencedAssemblies()
            .Select(static reference => reference.Name ?? string.Empty)
            .Where(static name => name.StartsWith("Nexis.", StringComparison.Ordinal))
            .OrderBy(static name => name, StringComparer.Ordinal)
            .ToArray();

    private sealed record SyntheticDefinition(
        ContractDescriptor Contract,
        ContentDefinitionId DefinitionId,
        int Value) : IVersionedContentDefinition;
}
