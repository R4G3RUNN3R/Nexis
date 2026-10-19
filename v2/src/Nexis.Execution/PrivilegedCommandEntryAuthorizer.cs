using System.Security.Cryptography;
using System.Text;
using Nexis.Execution.Contracts;
using Nexis.Identity.Contracts;
using Nexis.Operations.Contracts;

namespace Nexis.Execution;

/// <summary>
/// Reusable Admin-lane entry boundary. It delegates authority to current Identity policy facts and
/// binds successful entry to the real acting staff AccountId for downstream atomic Admin Audit.
///
/// Every decision - authorized or denied - records who attempted it and the security version and
/// time it was evaluated against. A refusal additionally emits a bounded operational signal, because
/// a denial never reaches a commit plan and would otherwise leave no trace anywhere, making repeated
/// privilege-escalation attempts invisible.
/// </summary>
public sealed class PrivilegedCommandEntryAuthorizer : IPrivilegedCommandEntryAuthorizer
{
    private readonly IPlatformAuthorizationPolicy _authorizationPolicy;
    private readonly IOperationalSignalSink? _operationalSignalSink;
    private readonly TimeProvider _timeProvider;

    public PrivilegedCommandEntryAuthorizer(
        IPlatformAuthorizationPolicy authorizationPolicy,
        IOperationalSignalSink? operationalSignalSink = null,
        TimeProvider? timeProvider = null)
    {
        _authorizationPolicy = authorizationPolicy ?? throw new ArgumentNullException(nameof(authorizationPolicy));
        _operationalSignalSink = operationalSignalSink;
        _timeProvider = timeProvider ?? TimeProvider.System;
    }

    public PrivilegedCommandEntryDecision Authorize(PrivilegedCommandEntryRequest request)
    {
        ArgumentNullException.ThrowIfNull(request);
        var authorization = _authorizationPolicy.Authorize(
            request.Actor,
            request.CurrentSecurity,
            request.RequiredCapability);

        var evaluatedAtUtc = _timeProvider.GetUtcNow().ToUniversalTime();
        var evaluatedSecurityVersion = request.CurrentSecurity.SecurityVersion;

        if (!authorization.IsAuthorized)
        {
            var decision = PrivilegedCommandEntryDecision.Denied(
                authorization,
                request.Actor.AccountId,
                request.TargetAccountId,
                evaluatedSecurityVersion,
                evaluatedAtUtc);

            ReportDenialBestEffort(request, authorization, evaluatedAtUtc);
            return decision;
        }

        if (request.Actor.AccountId is not { } actingAccountId)
        {
            throw new InvalidOperationException("Identity policy authorized a privileged actor without an AccountId.");
        }

        return PrivilegedCommandEntryDecision.Authorized(
            authorization,
            actingAccountId,
            request.TargetAccountId,
            evaluatedSecurityVersion,
            evaluatedAtUtc);
    }

    private void ReportDenialBestEffort(
        PrivilegedCommandEntryRequest request,
        PlatformAuthorizationDecision authorization,
        DateTimeOffset evaluatedAtUtc)
    {
        if (_operationalSignalSink is null)
        {
            return;
        }

        try
        {
            var signal = new OperationalSignal(
                OperationalConditionKind.PrivilegedEntryDenied,
                OperationalSeverity.Warning,
                new OperationalComponentKey("execution.privileged-entry"),
                new OperationalReasonCode(ReasonFor(authorization.Outcome)),
                evaluatedAtUtc,
                actorDiscriminator: CreateActorDiscriminator(request.Actor));

            var pending = _operationalSignalSink.ReportAsync(signal, CancellationToken.None);
            if (!pending.IsCompletedSuccessfully)
            {
                pending.AsTask().GetAwaiter().GetResult();
            }
        }
        catch (Exception)
        {
            // Observability is never allowed to change an authorization outcome. A refusal stays a
            // refusal when monitoring is unavailable, and the boundary does not throw at callers.
        }
    }

    private static string ReasonFor(PlatformAuthorizationOutcome outcome) => outcome switch
    {
        PlatformAuthorizationOutcome.StaffActorRequired => "privileged_entry.staff_actor_required",
        PlatformAuthorizationOutcome.ActorMismatch => "privileged_entry.actor_mismatch",
        PlatformAuthorizationOutcome.StaleSecurityContext => "privileged_entry.stale_security_context",
        PlatformAuthorizationOutcome.ExplicitlyDenied => "privileged_entry.explicitly_denied",
        PlatformAuthorizationOutcome.CapabilityMissing => "privileged_entry.capability_missing",
        _ => "privileged_entry.refused"
    };

    /// <summary>
    /// A bounded pseudonymous discriminator for the attempting actor binding. Unlike the CommandId
    /// integrity discriminator, this is deliberately NOT salted per attempt: counting repeated denied
    /// attempts by one actor is the entire point, so the value must be stable for a given actor while
    /// still carrying no recoverable identity.
    /// </summary>
    private static OperationalActorDiscriminator CreateActorDiscriminator(TrustedActorContext actor)
    {
        var canonical = FormattableString.Invariant(
            $"privileged-entry|{(int)actor.Lane}|{actor.AccountId?.Value:N}|{actor.CharacterId?.Value:N}|{actor.SystemActorKey?.Value}");
        var digest = SHA256.HashData(Encoding.UTF8.GetBytes(canonical));
        return new OperationalActorDiscriminator(Convert.ToHexString(digest).ToLowerInvariant());
    }
}
