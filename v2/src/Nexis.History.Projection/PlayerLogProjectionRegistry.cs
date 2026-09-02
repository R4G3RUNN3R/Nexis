using Nexis.Core.Contracts;
using Nexis.Eventing.Contracts;
using Nexis.History.Contracts;

namespace Nexis.History.Projection;

/// <summary>
/// Fail-closed router for player-facing event history. Only explicitly registered event contracts can
/// produce Player Log entries. Unregistered internal events remain invisible rather than falling back
/// to raw payload display.
///
/// An event whose contract NAME is projected but whose schema version has no registered projector is
/// treated as a misconfiguration and fails loudly, because that case silently stops producing player
/// history rather than deliberately withholding it.
/// </summary>
public sealed class PlayerLogProjectionRegistry
{
    private readonly IReadOnlyDictionary<ContractDescriptor, IPlayerLogEventProjector> _projectors;

    // Event contract NAMES that are deliberately projected. A name in this set with an unknown
    // schema version is a misconfiguration, not an intentionally internal event.
    private readonly IReadOnlySet<string> _projectedContractNames;

    public PlayerLogProjectionRegistry(IEnumerable<IPlayerLogEventProjector>? projectors = null)
    {
        var registered = new Dictionary<ContractDescriptor, IPlayerLogEventProjector>();
        foreach (var projector in projectors ?? Array.Empty<IPlayerLogEventProjector>())
        {
            if (projector is null)
            {
                throw new ArgumentException("Player Log projector collections cannot contain null entries.", nameof(projectors));
            }

            var contract = projector.SourceContract ??
                throw new ArgumentException("Player Log projectors require a source contract.", nameof(projectors));

            if (!registered.TryAdd(contract, projector))
            {
                throw new ArgumentException(
                    $"Duplicate Player Log projector for event contract '{contract.Name}' schema {contract.SchemaVersion}.",
                    nameof(projectors));
            }
        }

        _projectors = registered;
        _projectedContractNames = new HashSet<string>(
            registered.Keys.Select(static contract => contract.Name),
            StringComparer.Ordinal);
    }

    public IReadOnlyList<PlayerLogEntry> Project(CommittedEventMessage message)
    {
        ArgumentNullException.ThrowIfNull(message);

        if (!_projectors.TryGetValue(message.Contract, out var projector))
        {
            // A contract name nobody registered is a deliberately internal event and stays invisible.
            // A contract name that IS projected, arriving at an unregistered schema version, is a
            // missing projector: player history would silently stop being produced. Fail loudly so
            // the misconfiguration is visible instead of losing player history in silence.
            if (_projectedContractNames.Contains(message.Contract.Name))
            {
                throw new InvalidOperationException(
                    $"Player Log projection is registered for event contract '{message.Contract.Name}' but not for "
                    + $"schema version {message.Contract.SchemaVersion}. Register a projector for the new schema "
                    + "version or explicitly retire the contract; player history must not vanish silently.");
            }

            return Array.Empty<PlayerLogEntry>();
        }

        var projected = projector.Project(message) ??
            throw new InvalidOperationException("Player Log event projector returned null instead of an entry collection.");
        var entries = projected.ToArray();
        if (entries.Any(static entry => entry is null))
        {
            throw new InvalidOperationException("Player Log event projector returned a null entry.");
        }

        var expectedSource = PlayerLogSource.FromEvent(message.EventId);
        foreach (var entry in entries)
        {
            if (entry.Source != expectedSource ||
                entry.CorrelationId != message.CorrelationId ||
                entry.OccurredAtUtc != message.OccurredAtUtc)
            {
                throw new InvalidOperationException(
                    "Player Log event projections must preserve authoritative source, correlation and occurrence time.");
            }
        }

        return Array.AsReadOnly(entries);
    }
}
