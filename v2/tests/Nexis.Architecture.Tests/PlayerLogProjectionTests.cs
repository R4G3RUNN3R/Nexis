using System.Text.Json;
using Microsoft.VisualStudio.TestTools.UnitTesting;
using Nexis.Audit.Contracts;
using Nexis.Core.Contracts;
using Nexis.Equipment.Contracts;
using Nexis.Eventing.Contracts;
using Nexis.History.Contracts;
using Nexis.History.Projection;
using Nexis.Identity.Contracts;
using Nexis.Items.Contracts;
using Nexis.Kernel.Commands;
using Nexis.Kernel.Events;

namespace Nexis.Architecture.Tests;

[TestClass]
public sealed class PlayerLogProjectionTests
{
    [TestMethod]
    public void UnregisteredAuthoritativeEvent_IsNotProjectedByDefault()
    {
        var registry = new PlayerLogProjectionRegistry();
        var message = Message(new ContractDescriptor("tests.internal-only", 1), "{\"secret\":\"never expose\"}");

        var entries = registry.Project(message);

        Assert.AreEqual(0, entries.Count);
    }

    [TestMethod]
    public void DuplicateEventProjectorRegistration_IsRejected()
    {
        var projector = new SyntheticProjector(new ContractDescriptor("tests.duplicate", 1));

        Assert.ThrowsExactly<ArgumentException>(() =>
            new PlayerLogProjectionRegistry(new IPlayerLogEventProjector[] { projector, projector }));
    }

    [TestMethod]
    public void Registry_RejectsProjectorThatForgesEventProvenance()
    {
        var contract = new ContractDescriptor("tests.forged", 1);
        var registry = new PlayerLogProjectionRegistry(new[] { new ForgedSourceProjector(contract) });
        var message = Message(contract, "{}");

        Assert.ThrowsExactly<InvalidOperationException>(() => registry.Project(message));
    }

    [TestMethod]
    public void ItemEquippedEvent_ProjectsSafeCharacterEntryWithoutItemInstanceIdentity()
    {
        var characterId = CharacterId.New();
        var itemInstanceId = ItemInstanceId.New();
        var descriptor = new ItemEquippedEvent(
            characterId,
            itemInstanceId,
            new EquipmentPlacementKey("main-hand"),
            new[] { new EquipmentSlotKey("main-hand") });
        var payload = JsonSerializer.Serialize(descriptor, descriptor.GetType());
        var message = Message(descriptor.Contract, payload);
        var registry = new PlayerLogProjectionRegistry(new IPlayerLogEventProjector[]
        {
            new ItemEquippedPlayerLogProjector()
        });

        var entries = registry.Project(message);

        Assert.AreEqual(1, entries.Count);
        var entry = entries[0];
        Assert.AreEqual(PlayerLogAudienceKind.Character, entry.Audience.Kind);
        Assert.AreEqual(characterId, entry.Audience.CharacterId);
        Assert.IsNull(entry.Audience.AccountId);
        Assert.AreEqual(PlayerLogSource.FromEvent(message.EventId), entry.Source);
        Assert.AreEqual("equipment", entry.Category.Value);
        Assert.AreEqual("equipment.item-equipped", entry.Template.Value);
        Assert.AreEqual(1, entry.Arguments.Count);
        Assert.AreEqual("placement", entry.Arguments[0].Key);
        Assert.AreEqual("main-hand", entry.Arguments[0].Value.Value);
        Assert.IsFalse(entry.Arguments.Any(argument =>
            argument.Value.Value.Contains(itemInstanceId.Value.ToString("D"), StringComparison.OrdinalIgnoreCase)));
        Assert.IsFalse(entry.Arguments.Any(argument =>
            argument.Value.Value.Contains(message.PayloadJson, StringComparison.Ordinal)));
    }

    [TestMethod]
    public void ItemEquippedEvent_WithIncompleteTypedPayload_FailsClosed()
    {
        var payload = JsonSerializer.Serialize(new
        {
            CharacterId = CharacterId.New(),
            PlacementKey = new EquipmentPlacementKey("main-hand")
        });
        var message = Message(ItemEquippedEvent.EventContract, payload);
        var registry = new PlayerLogProjectionRegistry(new IPlayerLogEventProjector[]
        {
            new ItemEquippedPlayerLogProjector()
        });

        Assert.ThrowsExactly<InvalidOperationException>(() => registry.Project(message));
    }

    [TestMethod]
    public void InternalAdminAudit_IsNeverProjectedToPlayerLog()
    {
        var projector = new SafeAdminAuditPlayerLogProjector();
        var audit = Audit(
            AuditVisibility.InternalOnly,
            AccountId.New(),
            safePlayerReason: "This should still remain internal.");

        var entries = projector.Project(audit);

        Assert.AreEqual(0, entries.Count);
    }

    [TestMethod]
    public void PlayerMaterialAdminAudit_ProjectsOnlySafeReasonToAccountAudience()
    {
        var targetAccount = AccountId.New();
        var audit = Audit(
            AuditVisibility.PlayerMaterialEffect,
            targetAccount,
            safePlayerReason: "A moderator restored an incorrectly removed item.");
        var projector = new SafeAdminAuditPlayerLogProjector();

        var entries = projector.Project(audit);

        Assert.AreEqual(1, entries.Count);
        var entry = entries[0];
        Assert.AreEqual(PlayerLogAudienceKind.Account, entry.Audience.Kind);
        Assert.AreEqual(targetAccount, entry.Audience.AccountId);
        Assert.IsNull(entry.Audience.CharacterId);
        Assert.AreEqual(PlayerLogSource.FromAudit(audit.AuditId), entry.Source);
        Assert.AreEqual("administration", entry.Category.Value);
        Assert.AreEqual("admin.material-effect", entry.Template.Value);
        Assert.AreEqual(1, entry.Arguments.Count);
        Assert.AreEqual("reason", entry.Arguments[0].Key);
        Assert.AreEqual("A moderator restored an incorrectly removed item.", entry.Arguments[0].Value.Value);
        Assert.IsFalse(entry.Arguments.Any(argument => argument.Value.Value.Contains(audit.Action, StringComparison.Ordinal)));
        Assert.IsFalse(entry.Arguments.Any(argument => argument.Value.Value.Contains(audit.Outcome, StringComparison.Ordinal)));
        Assert.IsFalse(entry.Arguments.Any(argument =>
            audit.CaseReference is not null && argument.Value.Value.Contains(audit.CaseReference, StringComparison.Ordinal)));
    }

    [TestMethod]
    public void PlayerMaterialAdminAuditWithoutSafeReason_FailsClosed()
    {
        var projector = new SafeAdminAuditPlayerLogProjector();
        var audit = Audit(AuditVisibility.PlayerMaterialEffect, AccountId.New(), safePlayerReason: null);

        Assert.ThrowsExactly<InvalidOperationException>(() => projector.Project(audit));
    }

    [TestMethod]
    public void PlayerLogPlainText_CollapsesControlCharacters()
    {
        var text = new PlayerLogPlainText("  restored\r\n\titem  ");

        Assert.AreEqual("restored item", text.Value);
    }

    [TestMethod]
    public void PlayerLogArgumentSet_IsValueEqualAndCanonicallyOrdered()
    {
        var first = new PlayerLogArgumentSet(new[]
        {
            new PlayerLogArgument("zeta", new PlayerLogPlainText("2")),
            new PlayerLogArgument("alpha", new PlayerLogPlainText("1"))
        });
        var second = new PlayerLogArgumentSet(new[]
        {
            new PlayerLogArgument("alpha", new PlayerLogPlainText("1")),
            new PlayerLogArgument("zeta", new PlayerLogPlainText("2"))
        });

        Assert.AreEqual(first, second);
        Assert.AreEqual(first.GetHashCode(), second.GetHashCode());
        Assert.AreEqual("alpha", first[0].Key);
        Assert.AreEqual("zeta", first[1].Key);
    }

    private static CommittedEventMessage Message(ContractDescriptor contract, string payload) =>
        new(
            EventId.New(),
            CommandId.New(),
            CorrelationId.New(),
            Utc(),
            contract,
            payload);

    private static AuditEntry Audit(
        AuditVisibility visibility,
        AccountId targetAccountId,
        string? safePlayerReason) =>
        new(
            AuditId.New(),
            AccountId.New(),
            targetAccountId,
            AuditActionKind.StateMutation,
            visibility,
            Utc(),
            "admin.secret.internal-action",
            "internal-outcome-token",
            safePlayerReason,
            "CASE-SECRET-123",
            CorrelationId.New(),
            null);

    private static DateTimeOffset Utc() =>
        new(2026, 8, 26, 15, 30, 0, TimeSpan.Zero);

    private sealed class SyntheticProjector : IPlayerLogEventProjector
    {
        public SyntheticProjector(ContractDescriptor contract)
        {
            SourceContract = contract;
        }

        public ContractDescriptor SourceContract { get; }

        public IReadOnlyList<PlayerLogEntry> Project(CommittedEventMessage message) =>
            Array.Empty<PlayerLogEntry>();
    }

    private sealed class ForgedSourceProjector : IPlayerLogEventProjector
    {
        public ForgedSourceProjector(ContractDescriptor contract)
        {
            SourceContract = contract;
        }

        public ContractDescriptor SourceContract { get; }

        public IReadOnlyList<PlayerLogEntry> Project(CommittedEventMessage message) =>
            new[]
            {
                new PlayerLogEntry(
                    PlayerLogAudience.ForCharacter(CharacterId.New()),
                    PlayerLogSource.FromEvent(EventId.New()),
                    message.CorrelationId,
                    message.OccurredAtUtc,
                    new PlayerLogCategoryKey("tests"),
                    new PlayerLogTemplateKey("tests.forged"))
            };
    }
}
