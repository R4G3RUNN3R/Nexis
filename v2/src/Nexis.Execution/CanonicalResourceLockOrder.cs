using Nexis.Execution.Contracts;

namespace Nexis.Execution;

/// <summary>
/// Produces one deterministic lock order for multi-resource authoritative operations, independent
/// of call direction or collection order. Persistence adapters must acquire locks in this order.
/// </summary>
public static class CanonicalResourceLockOrder
{
    private static readonly IComparer<AuthoritativeResourceKey> Comparer =
        Comparer<AuthoritativeResourceKey>.Create(static (left, right) =>
        {
            var ownerComparison = StringComparer.Ordinal.Compare(left.Owner.Value, right.Owner.Value);
            if (ownerComparison != 0)
            {
                return ownerComparison;
            }

            var typeComparison = StringComparer.Ordinal.Compare(left.ResourceType, right.ResourceType);
            if (typeComparison != 0)
            {
                return typeComparison;
            }

            return StringComparer.Ordinal.Compare(left.ResourceId, right.ResourceId);
        });

    public static IReadOnlyList<AuthoritativeResourceKey> Order(
        IEnumerable<AuthoritativeResourceKey> resources)
    {
        ArgumentNullException.ThrowIfNull(resources);

        var items = resources.ToArray();
        if (items.Any(static item => item is null))
        {
            throw new ArgumentException("Resource lock collections cannot contain null entries.", nameof(resources));
        }

        return Array.AsReadOnly(items
            .Distinct()
            .OrderBy(static resource => resource, Comparer)
            .ToArray());
    }
}
