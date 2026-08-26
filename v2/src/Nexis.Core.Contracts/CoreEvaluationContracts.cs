using Nexis.Kernel.Commands;
using Nexis.Kernel.Events;
using Nexis.Kernel.Randomness;

namespace Nexis.Core.Contracts;

public sealed record ContractDescriptor
{
    public ContractDescriptor(string name, int schemaVersion)
    {
        ArgumentException.ThrowIfNullOrWhiteSpace(name);

        if (schemaVersion <= 0)
        {
            throw new ArgumentOutOfRangeException(nameof(schemaVersion), "Schema versions must be positive.");
        }

        Name = name;
        SchemaVersion = schemaVersion;
    }

    public string Name { get; }

    public int SchemaVersion { get; }
}

public sealed record OwnerKey
{
    public OwnerKey(string value)
    {
        ArgumentException.ThrowIfNullOrWhiteSpace(value);
        Value = value;
    }

    public string Value { get; }

    public override string ToString() => Value;
}

public interface IVersionedCoreContract
{
    ContractDescriptor Contract { get; }
}

/// <summary>
/// Typed command intent presented to the rules engine. Implementations belong to stable
/// domain/system contract assemblies, never to persistence or client DTO assemblies.
/// </summary>
public interface ICoreIntent : IVersionedCoreContract
{
}

/// <summary>
/// Immutable authoritative facts supplied by exactly one state owner for evaluation.
/// There is deliberately no universal PlayerSnapshot implementation.
/// </summary>
public interface IAuthoritativeSnapshot : IVersionedCoreContract
{
    OwnerKey Owner { get; }

    long Revision { get; }
}

/// <summary>
/// Typed state transition addressed to the owner permitted to persist that fact.
/// Implementations must express domain fields explicitly and may not be generic path/value patches.
/// </summary>
public interface IOwnerTransition : IVersionedCoreContract
{
    OwnerKey TargetOwner { get; }

    long? ExpectedRevision { get; }
}

/// <summary>
/// Semantic event description proposed by Core. Event identity/time and durable commit metadata
/// are assigned by the authoritative command/history boundary when the result is committed.
/// </summary>
public interface ICoreEventDescriptor : IVersionedCoreContract
{
}

/// <summary>
/// Optional typed result data returned to the coordinating application layer.
/// </summary>
public interface ICoreResultPayload : IVersionedCoreContract
{
}

public sealed record CoreEvaluationContext
{
    public CoreEvaluationContext(
        CommandId commandId,
        CorrelationId correlationId,
        DateTimeOffset evaluationTimeUtc,
        RuleVersion ruleVersion,
        ContentVersion contentVersion,
        IDeterministicRandomSource random)
    {
        if (commandId.IsEmpty)
        {
            throw new ArgumentException("CommandId cannot be empty.", nameof(commandId));
        }

        if (correlationId.Value == Guid.Empty)
        {
            throw new ArgumentException("CorrelationId cannot be empty.", nameof(correlationId));
        }

        if (evaluationTimeUtc.Offset != TimeSpan.Zero)
        {
            throw new ArgumentException("Core evaluation time must be UTC.", nameof(evaluationTimeUtc));
        }

        CommandId = commandId;
        CorrelationId = correlationId;
        EvaluationTimeUtc = evaluationTimeUtc;
        RuleVersion = ruleVersion ?? throw new ArgumentNullException(nameof(ruleVersion));
        ContentVersion = contentVersion ?? throw new ArgumentNullException(nameof(contentVersion));
        Random = random ?? throw new ArgumentNullException(nameof(random));
    }

    public CommandId CommandId { get; }

    public CorrelationId CorrelationId { get; }

    public DateTimeOffset EvaluationTimeUtc { get; }

    public RuleVersion RuleVersion { get; }

    public ContentVersion ContentVersion { get; }

    public IDeterministicRandomSource Random { get; }
}

public sealed class CoreEvaluationRequest
{
    public CoreEvaluationRequest(
        CoreContractVersion contractVersion,
        CoreEvaluationContext context,
        ICoreIntent intent,
        IEnumerable<IAuthoritativeSnapshot> snapshots)
    {
        ContractVersion = contractVersion;
        Context = context ?? throw new ArgumentNullException(nameof(context));
        Intent = intent ?? throw new ArgumentNullException(nameof(intent));
        ArgumentNullException.ThrowIfNull(snapshots);

        Snapshots = Array.AsReadOnly(snapshots.ToArray());
    }

    public CoreContractVersion ContractVersion { get; }

    public CoreEvaluationContext Context { get; }

    public ICoreIntent Intent { get; }

    public IReadOnlyList<IAuthoritativeSnapshot> Snapshots { get; }
}
