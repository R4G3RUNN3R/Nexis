using Microsoft.VisualStudio.TestTools.UnitTesting;
using Nexis.Execution;
using Nexis.Execution.Contracts;
using Nexis.Identity.Contracts;
using Nexis.Modules.Identity;
using Nexis.Operations.Contracts;

namespace Nexis.Architecture.Tests;

/// <summary>
/// C4 and O-4, found by the Claude afternoon shift and closed here.
///
/// C4: PrivilegedCommandEntryAuthorizer refuses an unauthorized privileged attempt correctly, but
/// the refusal is invisible. Denied(...) sets ActingAccountId to null by construction - which is
/// right, a denied actor must never be presentable as acting authority - and request.Actor, which
/// carries the AccountId, is simply dropped. PlatformAuthorizationDecision holds only an outcome and
/// a capability key, so a denied decision contains zero attribution of who attempted it. A denial
/// never reaches a commit plan, so the Admin-lane audit rule never engages either. Repeated denied
/// privileged attempts are the canonical privilege-escalation signal and the system cannot see them.
///
/// The fix is deliberately NOT to populate ActingAccountId on denial. A separate always-populated
/// AttemptedByAccountId keeps authorized and denied structurally distinct while making denial
/// attributable.
///
/// O-4: a decision carries no evaluation time and no security version, so a consumer that caches or
/// forwards one cannot refuse a stale decision. The approved Laravel BFF is the obvious future
/// violator; this closes before it consumes the boundary.
///
/// Naming follows ClaudeOvernightAdversarialTests: "Must" = RED until fixed.
/// </summary>
[TestClass]
public sealed class ClaudeContinuationPrivilegedEntryTests
{
    private static readonly PlatformCapabilityKey CorrectPlayerState = new("player-state.correct");
    private static readonly DateTimeOffset EvaluatedAt = new(2026, 8, 29, 17, 30, 0, TimeSpan.Zero);

    // ---------------------------------------------------------------------------------------------
    // C4 - RED until denial is attributable.
    // ---------------------------------------------------------------------------------------------

    [TestMethod]
    public void DeniedPrivilegedEntry_MustAttributeTheAttemptWithoutPresentingItAsActingAuthority()
    {
        var attemptingAccountId = AccountId.New();
        var decision = Deny(attemptingAccountId);

        Assert.IsFalse(decision.IsAuthorized);
        Assert.IsNull(
            decision.ActingAccountId,
            "A denied actor must never be presentable as acting authority. If this ever becomes "
            + "non-null the fix has been applied to the wrong field.");
        Assert.AreEqual(
            attemptingAccountId,
            decision.AttemptedByAccountId,
            "A denied privileged entry attempt must record who attempted it. Without this the "
            + "decision contains zero attribution, no audit row is ever written because denial never "
            + "reaches a commit plan, and repeated escalation attempts are invisible.");
    }

    [TestMethod]
    public void AuthorizedPrivilegedEntry_StillCarriesBothActingAndAttemptedByAttribution()
    {
        var actingAccountId = AccountId.New();
        var decision = Authorize(actingAccountId);

        Assert.IsTrue(decision.IsAuthorized);
        Assert.AreEqual(actingAccountId, decision.ActingAccountId);
        Assert.AreEqual(
            actingAccountId,
            decision.AttemptedByAccountId,
            "AttemptedByAccountId is always populated, so a consumer can attribute every privileged "
            + "attempt uniformly without first branching on the outcome.");
    }

    [TestMethod]
    public void DeniedPrivilegedEntry_MustEmitOneBoundedOperationalSignalNamingTheRefusalOutcome()
    {
        var sink = new RecordingOperationalSignalSink();
        _ = Deny(AccountId.New(), sink);

        var signal = sink.Signals.Single();
        Assert.AreEqual(OperationalConditionKind.PrivilegedEntryDenied, signal.Kind);
        Assert.AreEqual(OperationalSeverity.Warning, signal.Severity);
        Assert.AreEqual("execution.privileged-entry", signal.Component.Value);
        Assert.AreEqual(
            "privileged_entry.capability_missing",
            signal.Reason.Value,
            "The refusal outcome must be distinguishable, so an operator can separate a missing "
            + "capability from an explicit deny or a stale security context.");
        Assert.AreEqual(EvaluatedAt, signal.OccurredAtUtc);
    }

    [TestMethod]
    public void AuthorizedPrivilegedEntry_MustEmitNoDenialSignal()
    {
        var sink = new RecordingOperationalSignalSink();
        _ = Authorize(AccountId.New(), sink);

        Assert.AreEqual(
            0,
            sink.Signals.Count,
            "An authorized entry is not an operational condition and must not add noise that would "
            + "bury real denial bursts.");
    }

    /// <summary>
    /// The signal must be correlatable across attempts by the same account without carrying that
    /// account. Counting repeated denials is the entire point of the finding, so unlike the M4
    /// integrity discriminator - which is salted per CommandId - this one is deliberately stable for
    /// a given account so a burst is countable.
    /// </summary>
    [TestMethod]
    public void DeniedPrivilegedEntrySignal_MustBeStablePerAccountAndCarryNoRawIdentity()
    {
        var attemptingAccountId = AccountId.New();
        var otherAccountId = AccountId.New();
        var sink = new RecordingOperationalSignalSink();

        _ = Deny(attemptingAccountId, sink);
        _ = Deny(attemptingAccountId, sink);
        _ = Deny(otherAccountId, sink);

        var discriminators = sink.Signals.Select(static signal => signal.ActorDiscriminator?.Value).ToArray();
        Assert.IsTrue(discriminators.All(static value => value is { Length: 64 }));
        Assert.AreEqual(
            discriminators[0],
            discriminators[1],
            "Two denied attempts by the same account must share a discriminator, otherwise repeated "
            + "escalation attempts cannot be counted, which is the finding.");
        Assert.AreNotEqual(
            discriminators[0],
            discriminators[2],
            "Two different accounts must not collide into one discriminator.");

        var rendered = string.Join(
            '|',
            sink.Signals.Select(static signal =>
                $"{signal.Component.Value}{signal.Reason.Value}{signal.ActorDiscriminator?.Value}"));
        Assert.IsFalse(
            rendered.Contains(attemptingAccountId.Value.ToString("N"), StringComparison.OrdinalIgnoreCase)
            || rendered.Contains(attemptingAccountId.Value.ToString("D"), StringComparison.OrdinalIgnoreCase),
            "A raw AccountId leaked into an operational label.");
    }

    /// <summary>
    /// Protective. A monitoring outage must not turn a refusal into an acceptance, and must not
    /// throw out of a security boundary either.
    /// </summary>
    [TestMethod]
    public void FailingSignalSink_CannotConvertARefusalIntoAnAuthorization()
    {
        var decision = Deny(AccountId.New(), new ThrowingOperationalSignalSink());

        Assert.IsFalse(decision.IsAuthorized);
        Assert.IsNull(decision.ActingAccountId);
    }

    // ---------------------------------------------------------------------------------------------
    // O-4 - RED until a decision can be judged stale.
    // ---------------------------------------------------------------------------------------------

    [TestMethod]
    public void PrivilegedDecision_MustRecordTheSecurityVersionAndTimeItWasEvaluatedAgainst()
    {
        var accountId = AccountId.New();
        var authorized = Authorize(accountId);
        var denied = Deny(accountId);

        Assert.AreEqual(
            7L,
            authorized.EvaluatedSecurityVersion,
            "Without the evaluated security version a consumer cannot tell a fresh authorization "
            + "from one evaluated before the actor's capabilities or password changed.");
        Assert.AreEqual(EvaluatedAt, authorized.EvaluatedAtUtc);
        Assert.AreEqual(
            7L,
            denied.EvaluatedSecurityVersion,
            "Freshness evidence must be present on denied decisions too, so a cached denial cannot "
            + "outlive the grant that would now permit the action.");
        Assert.AreEqual(EvaluatedAt, denied.EvaluatedAtUtc);
    }

    // ---------------------------------------------------------------------------------------------
    // Fixtures.
    // ---------------------------------------------------------------------------------------------

    private static PrivilegedCommandEntryDecision Authorize(
        AccountId accountId,
        IOperationalSignalSink? sink = null) =>
        CreateAuthorizer(sink, (AccountRole.Administrator, new[] { CorrectPlayerState })).Authorize(
            new PrivilegedCommandEntryRequest(
                TrustedActorContext.CreateStaff(accountId, 7),
                IdentitySecuritySnapshot.Create(accountId, 7, AccountRole.Administrator),
                CorrectPlayerState,
                AccountId.New()));

    private static PrivilegedCommandEntryDecision Deny(
        AccountId accountId,
        IOperationalSignalSink? sink = null) =>
        CreateAuthorizer(sink, (AccountRole.Administrator, Array.Empty<PlatformCapabilityKey>())).Authorize(
            new PrivilegedCommandEntryRequest(
                TrustedActorContext.CreateStaff(accountId, 7),
                IdentitySecuritySnapshot.Create(accountId, 7, AccountRole.Administrator),
                CorrectPlayerState,
                AccountId.New()));

    private static PrivilegedCommandEntryAuthorizer CreateAuthorizer(
        IOperationalSignalSink? sink,
        params (AccountRole Role, IReadOnlyCollection<PlatformCapabilityKey> Capabilities)[] bundles) =>
        new(
            new PlatformAuthorizationPolicy(bundles.ToDictionary(
                static bundle => bundle.Role,
                static bundle => bundle.Capabilities)),
            sink,
            new FixedTimeProvider(EvaluatedAt));

    private sealed class FixedTimeProvider(DateTimeOffset utcNow) : TimeProvider
    {
        public override DateTimeOffset GetUtcNow() => utcNow;
    }

    private sealed class RecordingOperationalSignalSink : IOperationalSignalSink
    {
        public List<OperationalSignal> Signals { get; } = [];

        public ValueTask ReportAsync(OperationalSignal signal, CancellationToken cancellationToken = default)
        {
            Signals.Add(signal);
            return ValueTask.CompletedTask;
        }
    }

    private sealed class ThrowingOperationalSignalSink : IOperationalSignalSink
    {
        public ValueTask ReportAsync(OperationalSignal signal, CancellationToken cancellationToken = default) =>
            ValueTask.FromException(new InvalidOperationException("monitoring unavailable"));
    }
}
