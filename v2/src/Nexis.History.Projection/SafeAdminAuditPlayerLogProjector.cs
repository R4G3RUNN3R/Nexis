using Nexis.Audit.Contracts;
using Nexis.History.Contracts;

namespace Nexis.History.Projection;

/// <summary>
/// Converts only explicitly player-disclosable Admin material effects into safe Player Log entries.
/// Internal action/outcome/case data is intentionally never copied into the player-facing projection.
/// </summary>
public sealed class SafeAdminAuditPlayerLogProjector : IPlayerLogAuditProjector
{
    private static readonly PlayerLogCategoryKey AdministrationCategory = new("administration");
    private static readonly PlayerLogTemplateKey MaterialEffectTemplate = new("admin.material-effect");

    public IReadOnlyList<PlayerLogEntry> Project(AuditEntry entry)
    {
        ArgumentNullException.ThrowIfNull(entry);

        if (entry.Visibility == AuditVisibility.InternalOnly)
        {
            return Array.Empty<PlayerLogEntry>();
        }

        if (entry.Visibility != AuditVisibility.PlayerMaterialEffect)
        {
            throw new InvalidOperationException("Unknown Admin audit visibility cannot be projected to Player Log.");
        }

        if (!entry.TargetAccountId.HasValue || string.IsNullOrWhiteSpace(entry.SafePlayerReason))
        {
            throw new InvalidOperationException(
                "Player-material Admin audit requires a target Account and an explicit safe player reason before disclosure.");
        }

        return new[]
        {
            new PlayerLogEntry(
                PlayerLogAudience.ForAccount(entry.TargetAccountId.Value),
                PlayerLogSource.FromAudit(entry.AuditId),
                entry.CorrelationId,
                entry.OccurredAtUtc,
                AdministrationCategory,
                MaterialEffectTemplate,
                new[]
                {
                    new PlayerLogArgument("reason", new PlayerLogPlainText(entry.SafePlayerReason))
                })
        };
    }
}
