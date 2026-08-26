namespace Nexis.Kernel.Commands;

/// <summary>
/// Authoritative mutation ingress lane. Read-only queries are deliberately not represented here.
/// </summary>
public enum CommandExecutionLane
{
    Player = 0,
    Admin = 1,
    System = 2,
    Realtime = 3
}
