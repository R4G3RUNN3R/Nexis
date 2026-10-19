using System.Reflection;
using Microsoft.VisualStudio.TestTools.UnitTesting;
using Nexis.Core;
using Nexis.Core.Contracts;

namespace Nexis.Architecture.Tests;

/// <summary>
/// The approved systemic item interaction design is explicit: "Players may equip items regardless
/// of stat, skill, or knowledge qualification." Low capability changes effectiveness, control, cost
/// and risk - it does not prevent the attempt. These guards make that a mechanical property of the
/// Core assembly rather than a promise in a document.
/// </summary>
[TestClass]
public sealed class MReserveFreedomRuleTests
{
    private static readonly string[] CapabilityGateFragments =
    {
        "requirement", "required_level", "level", "stat", "attribute",
        "skill", "mastery", "knowledge", "qualif", "proficien"
    };

    [TestMethod]
    public void CoreAssembly_TakesNoCompileTimeDependencyOnCapabilityOwners()
    {
        var references = typeof(CoreRulesEngine).Assembly
            .GetReferencedAssemblies()
            .Select(static reference => reference.Name ?? string.Empty)
            .ToArray();

        Assert.IsTrue(references.Length > 0, "Reflection returned no referenced assemblies at all.");

        var forbidden = new[]
        {
            "Nexis.Progression", "Nexis.Skills", "Nexis.Knowledge", "Nexis.Magic", "Nexis.Recognition"
        };

        var leaked = references
            .Where(reference => forbidden.Any(prefix =>
                reference.StartsWith(prefix, StringComparison.Ordinal)))
            .ToArray();

        Assert.AreEqual(
            0,
            leaked.Length,
            "Nexis.Core acquired a compile-time dependency on a capability/progression owner: "
            + string.Join(", ", leaked)
            + ". Equip and unequip must not become capability-gated. Effectiveness rules that "
            + "legitimately consume capability belong to a later approved resolver slice, not here.");
    }

    [TestMethod]
    public void EquipAndUnequipRules_DeclareNoCapabilityGateReasonCode()
    {
        var equipCodes = ReadReasonCodes("Nexis.Core.Rules.Equipment.EquipItemRuleEvaluator");
        var unequipCodes = ReadReasonCodes("Nexis.Core.Rules.Equipment.UnequipItemRuleEvaluator");

        Assert.AreEqual(14, equipCodes.Length, "Equip reason-code set changed; review it against the freedom rule.");
        Assert.AreEqual(11, unequipCodes.Length, "Unequip reason-code set changed; review it against the freedom rule.");

        var offending = equipCodes.Concat(unequipCodes)
            .Where(static code => CapabilityGateFragments.Any(fragment =>
                code.Contains(fragment, StringComparison.OrdinalIgnoreCase)))
            .OrderBy(static code => code, StringComparer.Ordinal)
            .ToArray();

        Assert.AreEqual(
            0,
            offending.Length,
            "A capability-shaped rejection reason appeared in the equip/unequip rules: "
            + string.Join(", ", offending)
            + ". The approved design forbids stat, level, skill or knowledge equip blockers.");
    }

    private static string[] ReadReasonCodes(string evaluatorTypeName)
    {
        var type = typeof(CoreRulesEngine).Assembly.GetType(evaluatorTypeName, throwOnError: true)!;
        var codes = type
            .GetFields(BindingFlags.NonPublic | BindingFlags.Static)
            .Where(static field => field.FieldType == typeof(CoreReasonCode))
            .Select(field => ((CoreReasonCode)field.GetValue(null)!).Value)
            .ToArray();

        Assert.IsTrue(
            codes.Length > 0,
            $"Reflected zero CoreReasonCode fields from {evaluatorTypeName}. The guard is vacuous.");

        return codes;
    }
}
