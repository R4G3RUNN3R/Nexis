using Nexis.Core.Contracts;
using Nexis.Identity.Contracts;
using Nexis.Kernel.Commands;
using Nexis.Kernel.Events;

namespace Nexis.Automation.Contracts;

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
/// </summary>
public interface IAutomatedCommandGateway
{
    ValueTask SubmitAsync(
        AutomatedCommandRequest request,
        CancellationToken cancellationToken = default);
}
