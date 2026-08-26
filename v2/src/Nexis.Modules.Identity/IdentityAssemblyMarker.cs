using Nexis.Identity.Contracts;

namespace Nexis.Modules.Identity;

/// <summary>
/// Marker for the replaceable Identity implementation assembly. Stable identity primitives and
/// public contracts live in Nexis.Identity.Contracts.
/// </summary>
public static class IdentityAssemblyMarker
{
    /// <summary>
    /// Provides a compile-time/binary dependency anchor for architecture verification without
    /// exposing implementation state or persistence details.
    /// </summary>
    public static Type ContractsAnchor => typeof(AccountId);
}
