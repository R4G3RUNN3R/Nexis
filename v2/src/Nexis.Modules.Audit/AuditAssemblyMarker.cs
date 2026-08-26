using Nexis.Audit.Contracts;

namespace Nexis.Modules.Audit;

/// <summary>
/// Marker for the replaceable Audit implementation assembly. Stable audit types live in
/// Nexis.Audit.Contracts.
/// </summary>
public static class AuditAssemblyMarker
{
    public static Type ContractAnchor => typeof(AuditId);
}
