using Nexis.Core.Contracts;
using Nexis.Identity.Contracts;
using Nexis.Kernel.Commands;
using Nexis.Kernel.Events;

namespace Nexis.Automation.Contracts;

public interface ISystemActorRegistry
{
    bool IsRegistered(SystemActorKey key);
}

public sealed class SystemActorRegistry : ISystemActorRegistry
{
    private readonly IReadOnlySet<SystemActorKey> _registered;

    public SystemActorRegistry(IEnumerable<SystemActorKey> registered)
    {
        ArgumentNullException.ThrowIfNull(registered);
        var keys = registered.ToHashSet();
        if (keys.Count == 0)
        {
            throw new ArgumentException("The configured system actor registry cannot be empty.", nameof(registered));
        }

        _registered = keys;
    }

    public bool IsRegistered(SystemActorKey key)
    {
        ArgumentNullException.ThrowIfNull(key);
        return _registered.Contains(key);
    }
}

public enum AutomatedCommandSubmissionDisposition
{
    Accepted = 0,
    UnregisteredSystemActor = 1
}

public sealed record AutomatedCommandSubmissionResult(AutomatedCommandSubmissionDisposition Disposition)
{
    public static AutomatedCommandSubmissionResult Accepted() => new(AutomatedCommandSubmissionDisposition.Accepted);
    public static AutomatedCommandSubmissionResult UnregisteredSystemActor() => new(AutomatedCommandSubmissionDisposition.UnregisteredSystemActor);
}

/// <summary>
/// Narrow trusted submission envelope for scheduler/CIEL/background automation. It can request
/// authoritative work but cannot carry owner transitions, persistence handles or a precomputed
/// gameplay outcome. The receiving Application boundary must still perform normal command
/// idempotency, current-state loading, Core evaluation and atomic owner commit.
/// </summary>
public sealed record AutomatedCommandRequest
{
    public AutomatedCommandRequest(
        SystemActorKey actor,
        CommandId commandId,
        CorrelationId correlationId,
        ICoreIntent intent)
    {
        Actor = actor ?? throw new ArgumentNullException(nameof(actor));
        if (commandId.IsEmpty)
        {
            throw new ArgumentException("Automated commands require a non-empty CommandId.", nameof(commandId));
        }

        if (correlationId.Value == Guid.Empty)
        {
            throw new ArgumentException("Automated commands require a non-empty CorrelationId.", nameof(correlationId));
        }

        CommandId = commandId;
        CorrelationId = correlationId;
        Intent = intent ?? throw new ArgumentNullException(nameof(intent));
    }

    public SystemActorKey Actor { get; }

    public CommandId CommandId { get; }

    public CorrelationId CorrelationId { get; }

    public ICoreIntent Intent { get; }
}

/// <summary>
/// The only state-changing port intended for automated V2 components. Implementations belong to
/// the trusted Application/execution composition boundary, not scheduler or CIEL assemblies.
/// The first implementation must enforce the closed system-actor registry and the acceptance
/// contract in AUTOMATED-COMMAND-GATEWAY.md before establishing CommandId identity.
/// </summary>
public interface IAutomatedCommandGateway
{
    ValueTask<AutomatedCommandSubmissionResult> SubmitAsync(
        AutomatedCommandRequest request,
        CancellationToken cancellationToken = default);
}
