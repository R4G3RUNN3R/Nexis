using Nexis.Identity.Contracts;
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

public interface ICoreIntent : IVersionedCoreContract
{
}

public interface IAuthoritativeSnapshot : IVersionedCoreContract
{
    OwnerKey Owner { get; }

    long Revision { get; }
}

public interface ICoreContentInput : IVersionedCoreContract
{
}

public interface IOwnerTransition : IVersionedCoreContract
{
    OwnerKey TargetOwner { get; }

    long? ExpectedRevision { get; }
}

public interface ICoreEventDescriptor : IVersionedCoreContract
{
}

public interface ICoreResultPayload : IVersionedCoreContract
{
}

public sealed record CoreEvaluationContext
{
    public CoreEvaluationContext(
        CommandId commandId,
        CorrelationId correlationId,
        TrustedActorContext actor,
        DateTimeOffset evaluationTimeUtc,
        RuleVersion ruleVersion,
        ContentVersion contentVersion,
        IDeterministicRandomFactory randomFactory)
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
        Actor = actor ?? throw new ArgumentNullException(nameof(actor));
        EvaluationTimeUtc = evaluationTimeUtc;
        RuleVersion = ruleVersion ?? throw new ArgumentNullException(nameof(ruleVersion));
        ContentVersion = contentVersion ?? throw new ArgumentNullException(nameof(contentVersion));
        RandomFactory = randomFactory ?? throw new ArgumentNullException(nameof(randomFactory));
    }

    public CommandId CommandId { get; }

    public CorrelationId CorrelationId { get; }

    public TrustedActorContext Actor { get; }

    public DateTimeOffset EvaluationTimeUtc { get; }

    public RuleVersion RuleVersion { get; }

    public ContentVersion ContentVersion { get; }

    public IDeterministicRandomFactory RandomFactory { get; }
}

public sealed class CoreEvaluationRequest
{
    public CoreEvaluationRequest(
        CoreContractVersion contractVersion,
        CoreEvaluationContext context,
        ICoreIntent intent,
        IEnumerable<IAuthoritativeSnapshot> snapshots,
        IEnumerable<ICoreContentInput>? content = null)
    {
        if (!contractVersion.IsValid)
        {
            throw new ArgumentOutOfRangeException(nameof(contractVersion), "Core contract version must be positive.");
        }

        ContractVersion = contractVersion;
        Context = context ?? throw new ArgumentNullException(nameof(context));
        Intent = intent ?? throw new ArgumentNullException(nameof(intent));
        ArgumentNullException.ThrowIfNull(snapshots);

        Snapshots = Freeze(snapshots, nameof(snapshots));
        Content = Freeze(content ?? Array.Empty<ICoreContentInput>(), nameof(content));
    }

    public CoreContractVersion ContractVersion { get; }

    public CoreEvaluationContext Context { get; }

    public ICoreIntent Intent { get; }

    public IReadOnlyList<IAuthoritativeSnapshot> Snapshots { get; }

    public IReadOnlyList<ICoreContentInput> Content { get; }

    private static IReadOnlyList<T> Freeze<T>(IEnumerable<T> values, string parameterName)
        where T : class
    {
        var items = values.ToArray();

        for (var index = 0; index < items.Length; index++)
        {
            if (items[index] is null)
            {
                throw new ArgumentException("Core evaluation collections cannot contain null entries.", parameterName);
            }
        }

        return Array.AsReadOnly(items);
    }
}
