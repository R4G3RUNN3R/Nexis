using Nexis.Identity.Contracts;

namespace Nexis.Execution.Contracts;

/// <summary>
/// Trusted inputs for one privileged command entry check. Target identity is retained for later
/// audit construction but never participates in the platform-authority decision.
/// </summary>
public sealed record PrivilegedCommandEntryRequest
{
    public PrivilegedCommandEntryRequest(
        TrustedActorContext actor,
        IdentitySecuritySnapshot currentSecurity,
        PlatformCapabilityKey requiredCapability,
        AccountId? targetAccountId = null)
    {
        if (targetAccountId is { IsEmpty: true })
        {
            throw new ArgumentException("Target AccountId cannot be empty when supplied.", nameof(targetAccountId));
        }

        Actor = actor ?? throw new ArgumentNullException(nameof(actor));
        CurrentSecurity = currentSecurity ?? throw new ArgumentNullException(nameof(currentSecurity));
        RequiredCapability = requiredCapability ?? throw new ArgumentNullException(nameof(requiredCapability));
        TargetAccountId = targetAccountId;
    }

    public TrustedActorContext Actor { get; }

    public IdentitySecuritySnapshot CurrentSecurity { get; }

    public PlatformCapabilityKey RequiredCapability { get; }

    public AccountId? TargetAccountId { get; }
}

/// <summary>
/// Fail-closed privileged entry result. ActingAccountId is populated only after the current
/// Identity policy authorizes the trusted staff actor and is never derived from TargetAccountId.
/// </summary>
public sealed record PrivilegedCommandEntryDecision
{
    private PrivilegedCommandEntryDecision(
        PlatformAuthorizationDecision authorization,
        AccountId? actingAccountId,
        AccountId? attemptedByAccountId,
        AccountId? targetAccountId,
        long evaluatedSecurityVersion,
        DateTimeOffset evaluatedAtUtc)
    {
        if (evaluatedAtUtc.Offset != TimeSpan.Zero)
        {
            throw new ArgumentException("Privileged entry decisions must be evaluated in UTC.", nameof(evaluatedAtUtc));
        }

        Authorization = authorization ?? throw new ArgumentNullException(nameof(authorization));
        ActingAccountId = actingAccountId;
        AttemptedByAccountId = attemptedByAccountId;
        TargetAccountId = targetAccountId;
        EvaluatedSecurityVersion = evaluatedSecurityVersion;
        EvaluatedAtUtc = evaluatedAtUtc;
    }

    public PlatformAuthorizationDecision Authorization { get; }

    public bool IsAuthorized => Authorization.IsAuthorized;

    /// <summary>
    /// Populated only for an authorized decision. A denied actor is never presentable as acting
    /// authority, so this stays null on refusal - use <see cref="AttemptedByAccountId"/> to attribute
    /// the attempt.
    /// </summary>
    public AccountId? ActingAccountId { get; }

    /// <summary>
    /// Who attempted privileged entry, populated for authorized and denied decisions alike whenever
    /// the actor carries an account identity. This is attribution, never authority.
    /// </summary>
    public AccountId? AttemptedByAccountId { get; }

    public AccountId? TargetAccountId { get; }

    /// <summary>
    /// The account-security version this decision was evaluated against, so a consumer that caches or
    /// forwards a decision can refuse one that predates a capability or password change.
    /// </summary>
    public long EvaluatedSecurityVersion { get; }

    public DateTimeOffset EvaluatedAtUtc { get; }

    public static PrivilegedCommandEntryDecision Authorized(
        PlatformAuthorizationDecision authorization,
        AccountId actingAccountId,
        AccountId? targetAccountId,
        long evaluatedSecurityVersion,
        DateTimeOffset evaluatedAtUtc)
    {
        ArgumentNullException.ThrowIfNull(authorization);
        if (!authorization.IsAuthorized)
        {
            throw new ArgumentException("Authorized entry decisions require an authorized Identity decision.", nameof(authorization));
        }

        if (actingAccountId.IsEmpty)
        {
            throw new ArgumentException("Authorized entry decisions require the acting staff AccountId.", nameof(actingAccountId));
        }

        return new PrivilegedCommandEntryDecision(
            authorization,
            actingAccountId,
            actingAccountId,
            targetAccountId,
            evaluatedSecurityVersion,
            evaluatedAtUtc);
    }

    public static PrivilegedCommandEntryDecision Denied(
        PlatformAuthorizationDecision authorization,
        AccountId? attemptedByAccountId,
        AccountId? targetAccountId,
        long evaluatedSecurityVersion,
        DateTimeOffset evaluatedAtUtc)
    {
        ArgumentNullException.ThrowIfNull(authorization);
        if (authorization.IsAuthorized)
        {
            throw new ArgumentException("Denied entry decisions cannot carry an authorized Identity decision.", nameof(authorization));
        }

        if (attemptedByAccountId is { IsEmpty: true })
        {
            throw new ArgumentException(
                "Attempted-by AccountId cannot be empty when supplied.",
                nameof(attemptedByAccountId));
        }

        return new PrivilegedCommandEntryDecision(
            authorization,
            null,
            attemptedByAccountId,
            targetAccountId,
            evaluatedSecurityVersion,
            evaluatedAtUtc);
    }
}

public interface IPrivilegedCommandEntryAuthorizer
{
    PrivilegedCommandEntryDecision Authorize(PrivilegedCommandEntryRequest request);
}
