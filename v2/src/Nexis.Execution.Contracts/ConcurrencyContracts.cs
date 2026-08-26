using Nexis.Core.Contracts;

namespace Nexis.Execution.Contracts;

/// <summary>
/// Stable identity for an authoritative persistence resource that may require ordered locking.
/// This is a concurrency identity only, never a generic state/property path or mutation mechanism.
/// </summary>
public sealed record AuthoritativeResourceKey
{
    public AuthoritativeResourceKey(OwnerKey owner, string resourceType, string resourceId)
    {
        Owner = owner ?? throw new ArgumentNullException(nameof(owner));
        ArgumentException.ThrowIfNullOrWhiteSpace(resourceType);
        ArgumentException.ThrowIfNullOrWhiteSpace(resourceId);
        ResourceType = resourceType;
        ResourceId = resourceId;
    }

    public OwnerKey Owner { get; }

    public string ResourceType { get; }

    public string ResourceId { get; }

    public override string ToString() => $"{Owner.Value}/{ResourceType}/{ResourceId}";
}

/// <summary>
/// Infrastructure-specific classifier for transient failures that are safe to retry by rerunning
/// the complete authoritative command attempt from fresh state. Implementations must not classify
/// business-rule, authorization, insufficient-resource or permanent constraint failures as retryable.
/// </summary>
public interface ITransientCommandFailureClassifier
{
    bool IsRetryable(Exception exception);
}
