using System.Text;
using Microsoft.VisualStudio.TestTools.UnitTesting;
using Nexis.Core.Contracts;
using Nexis.Execution;
using Nexis.Execution.Contracts;
using Nexis.Identity.Contracts;
using Nexis.Kernel.Commands;
using Nexis.Kernel.Events;
using Nexis.Kernel.Randomness;

namespace Nexis.Architecture.Tests;

[TestClass]
public sealed class CommandCommitPlanTests
{
    [TestMethod]
    public void Builder_UsesOriginalReceiptCorrelationForTraceAndEvents()
    {
        var requestCorrelation = CorrelationId.New();
        var originalCorrelation = CorrelationId.New();
        var request = CreateRequest(requestCorrelation);
        var claim = CommandReceiptClaim.Acquired(originalCorrelation, CommandExecutionToken.New());
        var decision = CoreDecision.Succeeded(events: new[] { new SyntheticEvent("tests.event") });

        var plan = new CommandCommitPlanBuilder().Build(
            request,
            Fingerprint("payload"),
            claim,
            decision,
            Descriptor(),
            Utc(10, 5));

        Assert.AreEqual(originalCorrelation, plan.Trace.CorrelationId);
        Assert.AreNotEqual(requestCorrelation, plan.Trace.CorrelationId);
        Assert.AreEqual(1, plan.Events.Count);
        Assert.AreEqual(originalCorrelation, plan.Events[0].Metadata.CorrelationId);
        Assert.AreEqual(request.Context.EvaluationTimeUtc, plan.Events[0].Metadata.OccurredAtUtc);
    }

    [TestMethod]
    public void Builder_MapsDomainFailureAndPreservesCommittedGameplayConsequences()
    {
        var request = CreateRequest(CorrelationId.New());
        var claim = CommandReceiptClaim.Acquired(request.Context.CorrelationId, CommandExecutionToken.New());
        var transition = new SyntheticTransition();
        var domainEvent = new SyntheticEvent("tests.domain_failed");
        var decision = CoreDecision.DomainFailed(
            new CoreReasonCode("tests.failed_in_world"),
            transitions: new[] { transition },
            events: new[] { domainEvent });

        var plan = new CommandCommitPlanBuilder().Build(
            request,
            Fingerprint("payload"),
            claim,
            decision,
            Descriptor(),
            Utc(10, 5));

        Assert.AreEqual(CommandTerminalStatus.DomainFailed, plan.TerminalOutcome.Status);
        Assert.AreEqual("tests.failed_in_world", plan.TerminalOutcome.Reason?.Value);
        Assert.AreEqual(1, plan.Transitions.Count);
        Assert.AreSame(transition, plan.Transitions[0]);
        Assert.AreEqual(1, plan.Events.Count);
        Assert.AreSame(domainEvent, plan.Events[0].Descriptor);
    }

    [TestMethod]
    public void Builder_CapturesReplayCriticalCoreRuleAndContentVersions()
    {
        var request = CreateRequest(CorrelationId.New());
        var claim = CommandReceiptClaim.Acquired(request.Context.CorrelationId, CommandExecutionToken.New());

        var plan = new CommandCommitPlanBuilder().Build(
            request,
            Fingerprint("payload"),
            claim,
            CoreDecision.Succeeded(),
            Descriptor(),
            Utc(10, 5));

        Assert.AreEqual("Test.Core", plan.Trace.CoreImplementation.ImplementationName);
        Assert.AreEqual("1.2.3-test", plan.Trace.CoreImplementation.ImplementationVersion);
        Assert.AreEqual(CoreContractVersion.V1, plan.Trace.CoreContractVersion);
        Assert.AreEqual("tests.rules.v1", plan.Trace.RuleVersion.Value);
        Assert.AreEqual("tests.content.v1", plan.Trace.ContentVersion.Value);
        Assert.AreEqual(request.Context.EvaluationTimeUtc, plan.Trace.EvaluatedAtUtc);
    }

    [TestMethod]
    public void Builder_RejectsDuplicateOrCompletedReceiptInsteadOfCommittingAgain()
    {
        var request = CreateRequest(CorrelationId.New());
        var duplicate = CommandReceiptClaim.DuplicateInProgress(request.Context.CorrelationId);

        Assert.ThrowsExactly<InvalidOperationException>(() => new CommandCommitPlanBuilder().Build(
            request,
            Fingerprint("payload"),
            duplicate,
            CoreDecision.Succeeded(),
            Descriptor(),
            Utc(10, 5)));
    }

    [TestMethod]
    public async Task CommitCoordinator_SubmitsOneWholePlanToAtomicCommitter()
    {
        var request = CreateRequest(CorrelationId.New());
        var claim = CommandReceiptClaim.Acquired(request.Context.CorrelationId, CommandExecutionToken.New());
        var plan = new CommandCommitPlanBuilder().Build(
            request,
            Fingerprint("payload"),
            claim,
            CoreDecision.Succeeded(
                transitions: new[] { new SyntheticTransition() },
                events: new[] { new SyntheticEvent("tests.event") }),
            Descriptor(),
            Utc(10, 5));
        var committer = new RecordingAtomicCommitter(CommandCommitResult.Committed());
        var coordinator = new CommandCommitCoordinator(committer);

        var result = await coordinator.CommitAsync(plan);

        Assert.AreEqual(CommandCommitDisposition.Committed, result.Disposition);
        Assert.AreEqual(1, committer.CallCount);
        Assert.AreSame(plan, committer.LastPlan);
    }

    [TestMethod]
    public async Task CommitFailure_DoesNotRewriteProposedTerminalOutcomeAsCommitted()
    {
        var request = CreateRequest(CorrelationId.New());
        var claim = CommandReceiptClaim.Acquired(request.Context.CorrelationId, CommandExecutionToken.New());
        var plan = new CommandCommitPlanBuilder().Build(
            request,
            Fingerprint("payload"),
            claim,
            CoreDecision.Succeeded(),
            Descriptor(),
            Utc(10, 5));
        var committer = new RecordingAtomicCommitter(
            CommandCommitResult.TechnicalFailure(new CommandReasonCode("tests.persistence_failed")));

        var result = await new CommandCommitCoordinator(committer).CommitAsync(plan);

        Assert.AreEqual(CommandTerminalStatus.Succeeded, plan.TerminalOutcome.Status);
        Assert.AreEqual(CommandCommitDisposition.TechnicalFailure, result.Disposition);
        Assert.AreEqual("tests.persistence_failed", result.Reason?.Value);
    }

    private static CoreEvaluationRequest CreateRequest(CorrelationId correlationId) =>
        new(
            CoreContractVersion.V1,
            new CoreEvaluationContext(
                CommandId.New(),
                correlationId,
                TrustedActorContext.CreatePlayer(AccountId.New(), CharacterId.New(), 1),
                Utc(10, 0),
                new RuleVersion("tests.rules.v1"),
                new ContentVersion("tests.content.v1"),
                new FixedRandomFactory()),
            new SyntheticIntent(),
            Array.Empty<IAuthoritativeSnapshot>());

    private static CommandPayloadFingerprint Fingerprint(string value) =>
        CommandPayloadFingerprint.Compute(Encoding.UTF8.GetBytes(value));

    private static CoreImplementationDescriptor Descriptor() =>
        new("Test.Core", "1.2.3-test", CoreContractVersion.V1);

    private static DateTimeOffset Utc(int hour, int minute) =>
        new(2026, 8, 26, hour, minute, 0, TimeSpan.Zero);

    private sealed record SyntheticIntent : ICoreIntent
    {
        public ContractDescriptor Contract { get; } = new("tests.command", 1);
    }

    private sealed record SyntheticTransition : IOwnerTransition
    {
        public ContractDescriptor Contract { get; } = new("tests.transition", 1);

        public OwnerKey TargetOwner { get; } = new("TestsOwner");

        public long? ExpectedRevision => 1;
    }

    private sealed record SyntheticEvent : ICoreEventDescriptor
    {
        public SyntheticEvent(string name)
        {
            Contract = new ContractDescriptor(name, 1);
        }

        public ContractDescriptor Contract { get; }
    }

    private sealed class FixedRandomFactory : IDeterministicRandomFactory
    {
        public IDeterministicRandomSource Create() => new FixedRandomSource();

        private sealed class FixedRandomSource : IDeterministicRandomSource
        {
            public ulong NextUInt64() => 1;
        }
    }

    private sealed class RecordingAtomicCommitter : IAtomicCommandCommitter
    {
        private readonly CommandCommitResult _result;

        public RecordingAtomicCommitter(CommandCommitResult result)
        {
            _result = result;
        }

        public int CallCount { get; private set; }

        public CommandCommitPlan? LastPlan { get; private set; }

        public ValueTask<CommandCommitResult> CommitAsync(
            CommandCommitPlan plan,
            CancellationToken cancellationToken = default)
        {
            cancellationToken.ThrowIfCancellationRequested();
            CallCount++;
            LastPlan = plan;
            return ValueTask.FromResult(_result);
        }
    }
}
