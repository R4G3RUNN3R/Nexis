using System.Text;
using Microsoft.VisualStudio.TestTools.UnitTesting;
using Nexis.Audit.Contracts;
using Nexis.Core.Contracts;
using Nexis.Execution;
using Nexis.Execution.Contracts;
using Nexis.Identity.Contracts;
using Nexis.Kernel.Commands;
using Nexis.Kernel.Events;
using Nexis.Kernel.Randomness;

namespace Nexis.Architecture.Tests;

[TestClass]
public sealed class AdminAuditCommitTests
{
    [TestMethod]
    public void AdminCommand_CannotBuildCommitPlanWithoutAtomicAuditEntry()
    {
        var accountId = AccountId.New();
        var request = CreateAdminRequest(accountId, CorrelationId.New());
        var claim = CommandReceiptClaim.Acquired(request.Context.CorrelationId, CommandExecutionToken.New());

        Assert.ThrowsExactly<ArgumentException>(() => new CommandCommitPlanBuilder().Build(
            request,
            Fingerprint(),
            claim,
            CoreDecision.Rejected(new CoreReasonCode("tests.rejected")),
            Descriptor(),
            Utc(10, 5)));
    }

    [TestMethod]
    public void AdminCommand_AuditEntryCommitsInSamePlanWithOriginalCorrelation()
    {
        var accountId = AccountId.New();
        var originalCorrelation = CorrelationId.New();
        var retryCorrelation = CorrelationId.New();
        var request = CreateAdminRequest(accountId, retryCorrelation);
        var claim = CommandReceiptClaim.Acquired(originalCorrelation, CommandExecutionToken.New());
        var auditEntry = CreateAudit(accountId, originalCorrelation);

        var plan = new CommandCommitPlanBuilder().Build(
            request,
            Fingerprint(),
            claim,
            CoreDecision.Rejected(new CoreReasonCode("tests.rejected")),
            Descriptor(),
            Utc(10, 5),
            auditEntries: new[] { auditEntry });

        Assert.AreEqual(1, plan.AuditEntries.Count);
        Assert.AreSame(auditEntry, plan.AuditEntries[0]);
        Assert.AreEqual(originalCorrelation, plan.AuditEntries[0].CorrelationId);
    }

    [TestMethod]
    public void AdminCommand_RejectsAuditFromDifferentActor()
    {
        var actingAccount = AccountId.New();
        var correlation = CorrelationId.New();
        var request = CreateAdminRequest(actingAccount, correlation);
        var claim = CommandReceiptClaim.Acquired(correlation, CommandExecutionToken.New());
        var wrongActorAudit = CreateAudit(AccountId.New(), correlation);

        Assert.ThrowsExactly<ArgumentException>(() => new CommandCommitPlanBuilder().Build(
            request,
            Fingerprint(),
            claim,
            CoreDecision.Succeeded(),
            Descriptor(),
            Utc(10, 5),
            auditEntries: new[] { wrongActorAudit }));
    }

    [TestMethod]
    public void AdminCommand_RejectsAuditWithDifferentCorrelation()
    {
        var actingAccount = AccountId.New();
        var correlation = CorrelationId.New();
        var request = CreateAdminRequest(actingAccount, correlation);
        var claim = CommandReceiptClaim.Acquired(correlation, CommandExecutionToken.New());
        var wrongCorrelationAudit = CreateAudit(actingAccount, CorrelationId.New());

        Assert.ThrowsExactly<ArgumentException>(() => new CommandCommitPlanBuilder().Build(
            request,
            Fingerprint(),
            claim,
            CoreDecision.Succeeded(),
            Descriptor(),
            Utc(10, 5),
            auditEntries: new[] { wrongCorrelationAudit }));
    }

    private static CoreEvaluationRequest CreateAdminRequest(AccountId accountId, CorrelationId correlationId) =>
        new(
            CoreContractVersion.V1,
            new CoreEvaluationContext(
                CommandId.New(),
                correlationId,
                TrustedActorContext.CreateStaff(
                    accountId,
                    1,
                    capabilities: new[] { new PlatformCapabilityKey("admin.state.correct") }),
                Utc(10, 0),
                new RuleVersion("tests.rules.v1"),
                new ContentVersion("tests.content.v1"),
                new FixedRandomFactory()),
            new SyntheticIntent(),
            Array.Empty<IAuthoritativeSnapshot>());

    private static AuditEntry CreateAudit(AccountId actingAccountId, CorrelationId correlationId) =>
        new(
            AuditId.New(),
            actingAccountId,
            null,
            AuditActionKind.StateMutation,
            AuditVisibility.InternalOnly,
            Utc(10, 5),
            "admin.state.correct",
            "rejected",
            null,
            "TEST-CASE",
            correlationId,
            null);

    private static CommandPayloadFingerprint Fingerprint() =>
        CommandPayloadFingerprint.Compute(Encoding.UTF8.GetBytes("admin-payload"));

    private static CoreImplementationDescriptor Descriptor() =>
        new("Test.Core", "1.2.3-test", CoreContractVersion.V1);

    private static DateTimeOffset Utc(int hour, int minute) =>
        new(2026, 8, 26, hour, minute, 0, TimeSpan.Zero);

    private sealed record SyntheticIntent : ICoreIntent
    {
        public ContractDescriptor Contract { get; } = new("tests.admin.command", 1);
    }

    private sealed class FixedRandomFactory : IDeterministicRandomFactory
    {
        public IDeterministicRandomSource Create() => new FixedRandomSource();

        private sealed class FixedRandomSource : IDeterministicRandomSource
        {
            public ulong NextUInt64() => 1;
        }
    }
}
